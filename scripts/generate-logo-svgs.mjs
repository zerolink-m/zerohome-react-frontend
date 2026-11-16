// Генерация pixel-логотипа ZeroHome (полное и короткое ZH).
// 5×7-глифы, каждый пиксель — <rect>. Цвет через currentColor,
// чтобы CSS-переменная --accent из global.css управляла темой.
//
// Стиль подобран под текущий apple-touch-icon (голубые кубические буквы).
// Все глифы монотонны по ширине (5), шаг между глифами — 1 колонка.
//
// Запуск: node scripts/generate-logo-svgs.mjs
// Пишет public/logo/logo-full.svg и public/logo/logo-short.svg.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '..', 'public', 'logo')
mkdirSync(outDir, { recursive: true })

// 5×7 глифы. Используем только буквы, которые нам нужны: Z, e, r, o, H, m.
// Прописные Z, H, M; строчные e, r, o, m.
// Точки для маленьких букв опущены — оставлены только те, что действительно нужны.
const GLYPHS = {
  Z: [
    '11111',
    '....1',
    '...1.',
    '..1..',
    '.1...',
    '1....',
    '11111',
  ],
  e: [
    '.....',
    '.....',
    '.111.',
    '1...1',
    '11111',
    '1....',
    '.111.',
  ],
  r: [
    '.....',
    '.....',
    '1.11.',
    '11..1',
    '1....',
    '1....',
    '1....',
  ],
  o: [
    '.....',
    '.....',
    '.111.',
    '1...1',
    '1...1',
    '1...1',
    '.111.',
  ],
  H: [
    '1...1',
    '1...1',
    '1...1',
    '11111',
    '1...1',
    '1...1',
    '1...1',
  ],
  m: [
    '.....',
    '.....',
    '11.1.',
    '1.1.1',
    '1.1.1',
    '1.1.1',
    '1.1.1',
  ],
}

const GLYPH_W = 5
const GLYPH_H = 7
const GAP = 1 // колонки-разделители между глифами

function renderWord(word, { pixel = 8 } = {}) {
  const totalCols = word.length * GLYPH_W + (word.length - 1) * GAP
  const totalRows = GLYPH_H
  const width = totalCols * pixel
  const height = totalRows * pixel
  const rects = []
  let cursorX = 0
  for (const ch of word) {
    const g = GLYPHS[ch]
    if (!g) throw new Error(`нет глифа для ${ch}`)
    for (let y = 0; y < GLYPH_H; y++) {
      const row = g[y]
      for (let x = 0; x < GLYPH_W; x++) {
        if (row[x] === '1') {
          rects.push(
            `<rect x="${(cursorX + x) * pixel}" y="${y * pixel}" width="${pixel}" height="${pixel}"/>`,
          )
        }
      }
    }
    cursorX += GLYPH_W + GAP
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="currentColor" shape-rendering="crispEdges" role="img" aria-label="${word}">${rects.join('')}</svg>`
}

const full = renderWord('ZeroHome')
const short = renderWord('ZH')

writeFileSync(resolve(outDir, 'logo-full.svg'), full)
writeFileSync(resolve(outDir, 'logo-short.svg'), short)

console.log('wrote', resolve(outDir, 'logo-full.svg'))
console.log('wrote', resolve(outDir, 'logo-short.svg'))
