#!/usr/bin/env node
// Генератор placeholder-иконок для PWA (public/icons/*.png).
// Пишет валидные PNG (RGBA) через встроенный zlib — никаких внешних зависимостей.
// Рисует однотонный тёмный фон и «ZH» глифами на 5×7 пиксельной сетке
// (масштабируется до нужного размера), в цвете акцента.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons')
mkdirSync(OUT_DIR, { recursive: true })

// #05070d
const BG = [0x05, 0x07, 0x0d, 0xff]
// #00aaff → «ZH»
const FG = [0x00, 0xaa, 0xff, 0xff]

// Пиксельная маска 5×7 для букв "Z" и "H" (1 = FG, 0 = BG).
// Те же глифы, что в scripts/generate-logo-svgs.mjs.
const GLYPHS = {
  Z: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  H: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
}

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })())
  c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(width, height, pixels /* Uint8Array RGBA */) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // filter byte 0 per scanline
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    pixels.subarray(y * stride, (y + 1) * stride).copy(raw, y * (stride + 1) + 1)
  }
  const idat = deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function makeIcon(size, { padding = 0.15 } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  // fill BG
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = BG[0]
    pixels[i * 4 + 1] = BG[1]
    pixels[i * 4 + 2] = BG[2]
    pixels[i * 4 + 3] = BG[3]
  }

  // safe area — учтём padding для maskable
  const inset = Math.floor(size * padding)
  const innerSize = size - inset * 2

  // «ZH» — 2 глифа по 5×7 + 1 колонка отступа между ними → всего 11×7
  const glyphW = 5
  const glyphH = 7
  const gap = 1
  const totalW = glyphW * 2 + gap
  const totalH = glyphH

  const scale = Math.floor(Math.min(innerSize / totalW, innerSize / totalH))
  const drawW = totalW * scale
  const drawH = totalH * scale
  const offsetX = inset + Math.floor((innerSize - drawW) / 2)
  const offsetY = inset + Math.floor((innerSize - drawH) / 2)

  function plotGlyph(mask, ox) {
    for (let gy = 0; gy < glyphH; gy++) {
      for (let gx = 0; gx < glyphW; gx++) {
        if (!mask[gy][gx]) continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = offsetX + ox + gx * scale + dx
            const y = offsetY + gy * scale + dy
            if (x < 0 || y < 0 || x >= size || y >= size) continue
            const idx = (y * size + x) * 4
            pixels[idx] = FG[0]
            pixels[idx + 1] = FG[1]
            pixels[idx + 2] = FG[2]
            pixels[idx + 3] = FG[3]
          }
        }
      }
    }
  }

  plotGlyph(GLYPHS.Z, 0)
  plotGlyph(GLYPHS.H, (glyphW + gap) * scale)

  return encodePng(size, size, pixels)
}

const targets = [
  { name: 'icon-192.png', size: 192, padding: 0.12 },
  { name: 'icon-512.png', size: 512, padding: 0.12 },
  { name: 'icon-maskable-512.png', size: 512, padding: 0.22 }, // safe area для maskable
  { name: 'apple-touch-icon-180.png', size: 180, padding: 0.12 },
]

for (const t of targets) {
  const buf = makeIcon(t.size, { padding: t.padding })
  writeFileSync(resolve(OUT_DIR, t.name), buf)
  console.log('wrote', t.name, buf.length, 'bytes')
}
