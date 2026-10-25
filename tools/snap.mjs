// Render engine frames to PNG for visual checks: node tools/snap.mjs motif iso-time [weather] [out]
import {writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {Engine} from '../pixel-life@garfieldttt.github.io/engine/scene.js';

const [motif = 'city', time = '2026-10-24T12:00', weather, out = 'snap.png', w = '640', h = '360', clock = 'none'] = process.argv.slice(2);
const crcTable = Array.from({length: 256}, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++)
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc = buf => {
    let c = 0xffffffff;
    for (const b of buf)
        c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
function png(bytes, W, H, scale, crop) {
    const [cx, cy, cw, ch] = crop || [0, 0, W, H];
    const SW = cw * scale, SH = ch * scale;
    const raw = Buffer.alloc((SW * 3 + 1) * SH);
    for (let y = 0; y < SH; y++) {
        raw[y * (SW * 3 + 1)] = 0;
        for (let x = 0; x < SW; x++) {
            const s = (((cy + Math.floor(y / scale)) * W) + cx + Math.floor(x / scale)) * 4;
            const d = y * (SW * 3 + 1) + 1 + x * 3;
            raw[d] = bytes[s]; raw[d + 1] = bytes[s + 1]; raw[d + 2] = bytes[s + 2];
        }
    }
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type), data]);
        const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
        return Buffer.concat([len, td, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(SW, 0); ihdr.writeUInt32BE(SH, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const e = new Engine(+w, +h, {motif, speed: 1, clock, people: +(process.env.PEOPLE ?? 1), traffic: +(process.env.TRAFFIC ?? 1)});
// FORCE=kraken:perch,diver triggers motif events at once (in view)
for (const ev of (process.env.FORCE || '').split(',').filter(Boolean)) {
    const [name, ctx] = ev.split(':');
    e.motif.trigger(name, e.env, ctx, true);
}
e.timeOffset = true;
e.setTime(new Date(time).getTime());
e.opts.speed = 1;
if (weather)
    e.weather.force(weather);
if (process.env.SNOW)
    e.weather.snowCover = +process.env.SNOW;
const t0 = performance.now();
for (let i = 0; i < 20 * (+process.env.SIM || 20); i++) {
    e.tick(0.05);
    if (i % 50 === 0) e.render();
}
const t1 = performance.now();
let bytes;
for (let i = 0; i < 20; i++) { e.tick(0.05); bytes = e.render(); }
const t2 = performance.now();
console.log(`sim ${(t1 - t0).toFixed(0)}ms, render avg ${((t2 - t1) / 20).toFixed(2)}ms/frame`);
const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null;
writeFileSync(out, png(bytes, +w, +h, +(process.env.SCALE || 2), crop));
