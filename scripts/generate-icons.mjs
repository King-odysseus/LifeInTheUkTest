// Generates the PWA icon set (navy rounded square + bronze "L" monogram)
// as PNGs plus a matching SVG favicon. Run with: node scripts/generate-icons.mjs
import zlib from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')

const NAVY = [0x0b, 0x0b, 0x45]
const BRONZE = [0xc4, 0x9a, 0x6c]

/* ------------------------------------------------------------------ PNG ---- */

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4)
  const set = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = 255
  }

  const corner = size * 0.18
  const inRounded = (x, y) => {
    const dx = x < corner ? corner - x : x >= size - corner ? x - (size - corner) : 0
    const dy = y < corner ? corner - y : y >= size - corner ? y - (size - corner) : 0
    return dx * dx + dy * dy <= corner * corner
  }

  const c = size / 2
  const circleR = size * 0.3
  const inCircle = (x, y) => (x - c) ** 2 + (y - c) ** 2 <= circleR * circleR

  const inRect = (x, y, x0, x1, y0, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inRounded(x, y)) set(x, y, NAVY)
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inCircle(x, y)) set(x, y, BRONZE)
    }
  }
  // Navy "L" monogram carved out of the bronze disc.
  const vx0 = size * 0.39
  const vx1 = size * 0.48
  const hx1 = size * 0.59
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const vertical = inRect(x, y, vx0, vx1, size * 0.36, size * 0.64)
      const horizontal = inRect(x, y, vx0, hx1, size * 0.56, size * 0.64)
      if ((vertical || horizontal) && inCircle(x, y)) set(x, y, NAVY)
    }
  }
  return px
}

mkdirSync(outDir, { recursive: true })

for (const size of [192, 512, 180, 32]) {
  writeFileSync(join(outDir, `icon-${size}.png`), encodePng(size, makeIcon(size)))
}

/* ----------------------------------------------------------------- SVG ---- */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0B0B45"/>
  <circle cx="32" cy="32" r="19" fill="#C49A6C"/>
  <rect x="25" y="23" width="7" height="18" fill="#0B0B45"/>
  <rect x="25" y="36" width="13" height="5" fill="#0B0B45"/>
</svg>`

writeFileSync(join(root, 'public', 'favicon.svg'), svg)
console.log('Generated icons in public/icons and public/favicon.svg')
