/**
 * generate-placeholders.js
 *
 * Generates all placeholder PNG assets for development.
 * Pure Node.js — no native dependencies required (no canvas, no sharp).
 * Uses Node's built-in zlib to write valid 16×16 RGB PNG files.
 *
 * Usage:
 *   node scripts/generate-placeholders.js
 *
 * Output:
 *   public/assets/placeholders/*.png
 *
 * To swap in real art: replace files in public/assets/ and update
 * paths in src/game/assets/AssetManifest.ts — no other code changes needed.
 */

import zlib from 'zlib';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuration ────────────────────────────────────────────────────────────

const TILE_SIZE  = 16;
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/placeholders');

/** All placeholder assets: filename → fill color (hex string) */
const PLACEHOLDERS = {
  // Tiles
  'tile-undiscovered.png':     '#000000',
  'tile-floor.png':            '#cccccc', // light grey
  'tile-wall.png':             '#4a3728', // dark brown per spec
  'tile-corridor.png':         '#666666', // dark grey
  'tile-entrance.png':         '#ff8800', // orange — player spawn marker
  // Player
  'player.png':                '#4488ff',
  // Enemies
  'enemy-breadknight.png':     '#ff4444',
  'enemy-saucerer.png':        '#cc2288',
  'enemy-mouldy-goblin.png':   '#44aa44',
  'enemy-condiment-witch.png': '#ff8800',
  // Base gear (permanent, upgradeable, ∞ uses)
  'item-base.png':             '#66ccff',
  // Found items (consumable, finite uses)
  'item-found.png':            '#ffdd00',
  // UI
  'ui-chest.png':              '#ddaa00',
  'ui-exit.png':               '#00ffcc',
  'ui-stairs.png':             '#00ff44', // bright green staircase marker
};

// ─── Minimal PNG encoder (pure Node.js) ──────────────────────────────────────

/** Pre-computed CRC32 lookup table */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len       = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Creates a solid-color PNG buffer.
 * Color type 2 = RGB (no alpha) — keeps files minimal.
 */
function createSolidPng(size, hex) {
  const { r, g, b } = hexToRgb(hex);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // colour type: RGB
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: adaptive
  ihdr[12] = 0; // interlace: none

  // Raw scanlines: 1 filter byte (None=0) + width × 3 RGB bytes
  const rowBytes = 1 + size * 3;
  const raw      = Buffer.alloc(size * rowBytes);
  for (let y = 0; y < size; y++) {
    const base = y * rowBytes;
    raw[base] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const px = base + 1 + x * 3;

      // Main fill
      raw[px]     = r;
      raw[px + 1] = g;
      raw[px + 2] = b;

      // 1-pixel dark border to make adjacent tiles distinguishable
      if (x === 0 || x === size - 1 || y === 0 || y === size - 1) {
        raw[px]     = Math.max(0, r - 40);
        raw[px + 1] = Math.max(0, g - 40);
        raw[px + 2] = Math.max(0, b - 40);
      }
    }
  }

  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Generating placeholder assets (${TILE_SIZE}×${TILE_SIZE}px) → ${OUTPUT_DIR}\n`);

  for (const [filename, color] of Object.entries(PLACEHOLDERS)) {
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, createSolidPng(TILE_SIZE, color));
    console.log(`  ✅  ${filename}  (${color})`);
  }

  console.log(`\nDone. ${Object.keys(PLACEHOLDERS).length} files written.`);
}

main();
