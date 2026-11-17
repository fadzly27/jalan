// Generates the app icons (PNG) with no dependencies: a white map pin on the Jalan blue.
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BLUE = [0, 102, 204];

function inPin(x, y, s, scale) {
  // coordinates in a 512 design grid, glyph scaled around the centre
  const u = (x / s) * 512, v = (y / s) * 512;
  const gx = 256 + (u - 256) / scale, gy = 256 + (v - 256) / scale;
  const cx = 256, cy = 214, R = 118, tip = 430, hole = 46;
  const dx = gx - cx, dy = gy - cy;
  const r2 = dx * dx + dy * dy;
  if (r2 <= hole * hole) return false;
  if (r2 <= R * R) return true;
  const d = tip - cy;
  const tan = R / Math.sqrt(d * d - R * R);
  if (gy >= cy + (R * R) / d && gy <= tip && Math.abs(dx) <= (tip - gy) * tan) return true;
  return false;
}

function png(size, scale) {
  const N = 4; // supersampling
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (inPin(x + (i + 0.5) / N, y + (j + 0.5) / N, size, scale)) hit++;
      const a = hit / (N * N);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(BLUE[0] + (255 - BLUE[0]) * a);
      raw[o + 1] = Math.round(BLUE[1] + (255 - BLUE[1]) * a);
      raw[o + 2] = Math.round(BLUE[2] + (255 - BLUE[2]) * a);
      raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/apple-touch-icon.png', png(180, 0.82));
writeFileSync('public/icon-192.png', png(192, 0.82));
writeFileSync('public/icon-512.png', png(512, 0.82));
writeFileSync('public/icon-maskable-512.png', png(512, 0.62));
console.log('icons written');
