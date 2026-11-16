// Общие хелперы разбора ISO-BMFF/fragmented MP4 (ISO/IEC 14496-12): чистые
// функции без React/DOM, работают напрямую с Uint8Array. Сервер отдаёт
// полноценный fMP4 (ftyp+moov, затем moof+mdat). Основной путь воспроизведения —
// MediaSource Extensions (браузер сам разбирает moof/mdat); parseMoof/findNextMdat
// ниже нужны только для WebCodecs-fallback (см. VideoStream.jsx) на браузерах,
// где MediaSource недоступен (iOS Safari) — там сэмплы приходится вычленять
// из фрагментов вручную и кормить в VideoDecoder/AudioDecoder.

export function readU32(buf, o) {
  return buf[o] * 16777216 + (buf[o + 1] << 16) + (buf[o + 2] << 8) + buf[o + 3]
}

export function readU64(buf, o) {
  return readU32(buf, o) * 4294967296 + readU32(buf, o + 4)
}

export function readBoxType(buf, o) {
  return String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3])
}

export function* iterBoxes(buf, start, end) {
  let offset = start
  while (offset + 8 <= end) {
    const size = readU32(buf, offset)
    const type = readBoxType(buf, offset + 4)
    let headerSize = 8
    let boxSize = size
    if (size === 1) {
      if (offset + 16 > end) return
      boxSize = readU64(buf, offset + 8)
      headerSize = 16
    } else if (size === 0) {
      boxSize = end - offset
    }
    if (boxSize < headerSize || offset + boxSize > end) return
    yield { type, start: offset, bodyStart: offset + headerSize, end: offset + boxSize }
    offset += boxSize
  }
}

export function findBox(buf, start, end, type) {
  for (const box of iterBoxes(buf, start, end)) {
    if (box.type === type) return box
  }
  return null
}

export function dumpTopLevelBoxes(buf, start = 0, end = buf.length) {
  const boxes = []
  for (const box of iterBoxes(buf, start, end)) {
    boxes.push({ type: box.type, size: box.end - box.start, start: box.start })
  }
  return boxes
}

export function concatChunks(chunks, totalLength) {
  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

function readFullBoxHeader(bodyStart) {
  // FullBox: version(1) + flags(3), сами version/flags тут не нужны
  return { bodyStart: bodyStart + 4 }
}

const TFHD_BASE_DATA_OFFSET_PRESENT = 0x000001
const TFHD_DEFAULT_SAMPLE_SIZE_PRESENT = 0x000010
const TFHD_DEFAULT_SAMPLE_FLAGS_PRESENT = 0x000020

function parseTfhd(buf, tfhdBox) {
  const flags = readU32(buf, tfhdBox.start + 8) & 0x00ffffff
  let o = readFullBoxHeader(tfhdBox.bodyStart).bodyStart
  const trackId = readU32(buf, o)
  o += 4
  let baseDataOffset = null
  if (flags & TFHD_BASE_DATA_OFFSET_PRESENT) {
    baseDataOffset = readU64(buf, o)
    o += 8
  }
  let defaultSampleSize = null
  let defaultSampleFlags = null
  // sample_description_index (0x000002) и default_sample_duration (0x000008)
  // нам не нужны, но занимают место перед size/flags — пропускаем по флагам
  if (flags & 0x000002) o += 4
  if (flags & 0x000008) o += 4
  if (flags & TFHD_DEFAULT_SAMPLE_SIZE_PRESENT) {
    defaultSampleSize = readU32(buf, o)
    o += 4
  }
  if (flags & TFHD_DEFAULT_SAMPLE_FLAGS_PRESENT) {
    defaultSampleFlags = readU32(buf, o)
    o += 4
  }
  return { trackId, baseDataOffset, defaultSampleSize, defaultSampleFlags }
}

const TRUN_DATA_OFFSET_PRESENT = 0x000001
const TRUN_FIRST_SAMPLE_FLAGS_PRESENT = 0x000004
const TRUN_SAMPLE_SIZE_PRESENT = 0x000200
const TRUN_SAMPLE_FLAGS_PRESENT = 0x000400
const TRUN_SAMPLE_DURATION_PRESENT = 0x000100
const TRUN_SAMPLE_CTS_PRESENT = 0x000800

function parseTrun(buf, trunBox) {
  const flags = readU32(buf, trunBox.start + 8) & 0x00ffffff
  let o = readFullBoxHeader(trunBox.bodyStart).bodyStart
  const sampleCount = readU32(buf, o)
  o += 4
  let dataOffset = 0
  if (flags & TRUN_DATA_OFFSET_PRESENT) {
    dataOffset = readU32(buf, o) | 0
    o += 4
  }
  let firstSampleFlags = null
  if (flags & TRUN_FIRST_SAMPLE_FLAGS_PRESENT) {
    firstSampleFlags = readU32(buf, o)
    o += 4
  }
  const samples = []
  for (let i = 0; i < sampleCount; i++) {
    if (flags & TRUN_SAMPLE_DURATION_PRESENT) o += 4
    let size = null
    if (flags & TRUN_SAMPLE_SIZE_PRESENT) {
      size = readU32(buf, o)
      o += 4
    }
    let sampleFlags = null
    if (flags & TRUN_SAMPLE_FLAGS_PRESENT) {
      sampleFlags = readU32(buf, o)
      o += 4
    } else if (i === 0 && firstSampleFlags != null) {
      sampleFlags = firstSampleFlags
    }
    if (flags & TRUN_SAMPLE_CTS_PRESENT) o += 4
    samples.push({ size, flags: sampleFlags })
  }
  return { dataOffset, samples }
}

function isKeyframeSample(sampleFlags, defaultSampleFlags) {
  const flags = sampleFlags != null ? sampleFlags : defaultSampleFlags
  if (flags == null) return null
  return (flags & 0x00010000) === 0
}

// Разбор одного moof: возвращает Map(trackId -> { sampleRanges: [{start, end, keyframe}] }).
// Абсолютные смещения sampleRanges — в системе координат общего буфера (того же
// Uint8Array, в котором лежит и сам moof, и следующий за ним mdat).
export function parseMoof(buf, moofBox) {
  const tracks = new Map()
  for (const traf of iterBoxes(buf, moofBox.bodyStart, moofBox.end)) {
    if (traf.type !== 'traf') continue
    const tfhdBox = findBox(buf, traf.bodyStart, traf.end, 'tfhd')
    if (!tfhdBox) continue
    const tfhd = parseTfhd(buf, tfhdBox)
    const trunBox = findBox(buf, traf.bodyStart, traf.end, 'trun')
    if (!trunBox) continue
    const trun = parseTrun(buf, trunBox)
    const baseOffset = (tfhd.baseDataOffset != null ? tfhd.baseDataOffset : moofBox.start) + trun.dataOffset
    const sampleRanges = []
    let cursor = baseOffset
    for (let i = 0; i < trun.samples.length; i++) {
      const sample = trun.samples[i]
      const size = sample.size != null ? sample.size : tfhd.defaultSampleSize
      if (size == null) break
      const keyframeFlag = isKeyframeSample(sample.flags, tfhd.defaultSampleFlags)
      sampleRanges.push({ start: cursor, end: cursor + size, keyframe: keyframeFlag })
      cursor += size
    }
    tracks.set(tfhd.trackId, { sampleRanges })
  }
  return { tracks }
}

// Ищет mdat после moof, толерантно к неизвестным боксам между ними (пропускает
// их типы в skipped). Возвращает null, если mdat ещё не пришёл целиком.
export function findNextMdat(buf, start, end) {
  const skipped = []
  for (const box of iterBoxes(buf, start, end)) {
    if (box.type === 'mdat') return { mdat: box, skipped }
    skipped.push(box.type)
  }
  return null
}

// Отделяет от начала буфера один целый сегмент и возвращает {segment, rest},
// либо null, если целого сегмента в буфере ещё нет.
//
// Нужен потому, что читать поток приходится кусками произвольной длины (границы
// сетевых чанков), а appendBuffer принимает данные, начинающиеся на границе
// сегмента. Медиа-сегмент — это moof вместе со следующим за ним mdat; любой
// другой верхнеуровневый бокс отдаём одиночным сегментом, чтобы не застрять на
// неожиданном потоке.
export function takeSegment(buf) {
  const boxes = iterBoxes(buf, 0, buf.length)
  const first = boxes.next()
  if (first.done || first.value.start !== 0) return null
  const box = first.value

  if (box.type === 'moof') {
    const second = boxes.next()
    // mdat ещё не пришёл целиком — ждём следующего чанка
    if (second.done) return null
    const next = second.value
    if (next.type !== 'mdat') {
      return { segment: buf.subarray(0, box.end), rest: buf.subarray(box.end) }
    }
    return { segment: buf.subarray(0, next.end), rest: buf.subarray(next.end) }
  }

  return { segment: buf.subarray(0, box.end), rest: buf.subarray(box.end) }
}

const AAC_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
]

// AudioSpecificConfig (ISO/IEC 14496-3) для AAC-LC, 2 байта: 5 бит object type +
// 4 бита sampleRateIndex + 4 бита channelConfig + 3 нулевых бита (frameLength/
// dependsOnCoreCoder/extensionFlag = 0).
export function buildAacAudioSpecificConfig({ objectType, sampleRate, channelConfig }) {
  const sampleRateIndex = AAC_SAMPLE_RATES.indexOf(sampleRate)
  if (sampleRateIndex === -1) throw new Error(`Неизвестная частота дискретизации AAC: ${sampleRate}`)
  const bits = (objectType << 11) | (sampleRateIndex << 7) | (channelConfig << 3)
  return new Uint8Array([bits >> 8, bits & 0xff])
}

// Извлекает параметры аудио из moov box (sample rate и количество каналов)
export function findAudioParams(buf, moov) {
  for (const trak of iterBoxes(buf, moov.bodyStart, moov.end)) {
    if (trak.type !== 'trak') continue
    const mdia = findBox(buf, trak.bodyStart, trak.end, 'mdia')
    if (!mdia) continue
    const hdlr = findBox(buf, mdia.bodyStart, mdia.end, 'hdlr')
    if (!hdlr) continue
    // FullBox(hdlr): version+flags(4) + pre_defined(4) + handler_type(4)
    const handlerType = readBoxType(buf, hdlr.bodyStart + 8)
    if (handlerType !== 'soun') continue

    // Нашли аудио трек, ищем mdhd для sampleRate
    const mdhd = findBox(buf, mdia.bodyStart, mdia.end, 'mdhd')
    if (!mdhd) continue

    // mdhd: version(1) + flags(3) + creation_time + modification_time + timescale(4) + duration
    const version = buf[mdhd.bodyStart]
    let timescale
    if (version === 1) {
      // version 1: creation_time(8) + modification_time(8) + timescale(4)
      timescale = readU32(buf, mdhd.bodyStart + 1 + 3 + 8 + 8)
    } else {
      // version 0: creation_time(4) + modification_time(4) + timescale(4)
      timescale = readU32(buf, mdhd.bodyStart + 1 + 3 + 4 + 4)
    }

    // Ищем количество каналов в stsd -> mp4a
    const minf = findBox(buf, mdia.bodyStart, mdia.end, 'minf')
    const stbl = minf && findBox(buf, minf.bodyStart, minf.end, 'stbl')
    const stsd = stbl && findBox(buf, stbl.bodyStart, stbl.end, 'stsd')
    if (!stsd) continue

    // stsd: version+flags(4) + entry_count(4), затем sample entries
    const mp4a = findBox(buf, stsd.bodyStart + 8, stsd.end, 'mp4a')
    if (!mp4a) continue

    // AudioSampleEntry: 6 reserved + 2 data_reference_index + 8 reserved +
    // channelcount(2) + samplesize(2) + 4 reserved + samplerate(4)
    const channelCount = (buf[mp4a.bodyStart + 16] << 8) | buf[mp4a.bodyStart + 17]

    return { sampleRate: timescale, numberOfChannels: channelCount }
  }

  // Если не нашли - возвращаем defaults
  return { sampleRate: 48000, numberOfChannels: 2 }
}

