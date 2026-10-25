// Write a Gfx buffer as an upscaled PNG.
import {writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
const crcT = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function savePng(path, bytes, W, H, S = 4, crop = null) {
    const [cx, cy, cw, ch] = crop || [0, 0, W, H];
    const SW = cw * S, SH = ch * S, raw = Buffer.alloc((SW * 3 + 1) * SH);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        const s = ((cy + (y / S | 0)) * W + cx + (x / S | 0)) * 4, d = y * (SW * 3 + 1) + 1 + x * 3;
        raw[d] = bytes[s]; raw[d + 1] = bytes[s + 1]; raw[d + 2] = bytes[s + 2];
    }
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(SW, 0); ih.writeUInt32BE(SH, 4); ih[8] = 8; ih[9] = 2;
    writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
