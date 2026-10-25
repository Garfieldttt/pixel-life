// Underwater motif in a Jules Verne look: a brass and glass dome on the
// sea floor with people inside, a riveted submarine that docks at its
// tower, helmet divers, merfolk who wave, knock on the glass and hunt fish,
// fish schools, turtles, jellyfish, kelp, coral, an old wreck and now and
// then a kraken that passes by or settles on the glass. The
// light from the surface follows the clock and the weather.
import {rand, randi, chance, pick, weighted, clamp} from './util.js';
import {mix, pack} from './gfx.js';
import * as A from './art.js';
import {Cells, drawFigure, lightPos} from './figure.js';
import {makePerson, drawPerson, personFigure, SKINS} from './people.js';
import {Timers} from './timers.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const INK = A.INK;
const BRASS = [0x5a3a1a, 0x8a5a28, 0xc08a3a, 0xe0b058, 0xf8e0a0];
const BRASS_ = BRASS;
const IRON = [0x23302f, 0x3a4a4a, 0x56686a, 0x7a8e8c, 0xa8bcb4];
const WATER = [0x48b4d0, 0x2a88b0, 0x1a6090, 0x10406c, 0x0a2c52];
const SAND = [0x8a7050, 0xb09468, 0xd0b484, 0xe4cc9c, 0xf4e4c0];
const CORALS = [0xf06a7a, 0xf09040, 0xc05ad0, 0xf0d050, 0x60c8b0, 0xe85aa0, 0xff7a5a];
const MER_TAILS = [0x2aa88a, 0x3a8ad8, 0x8a5ad0, 0xd05a8a, 0x40c0c0, 0xe0a030];
const MER_HAIR = [0xc8442c, 0xf0d060, 0x2a2430, 0x3aa0a0, 0xf0f0e8, 0x8a5ad0, 0x6a3c20];
const FISHFOLK = [0x4aa08a, 0x5a8ac0, 0x6aa060, 0x8a7ab8];

const hash = (x, y, s = 0) => ((((x + s * 131) * 73856093) ^ ((y - s * 71) * 19349663)) >>> 0) % 1000;

// ---------------- sprites ----------------

const CACHE = new Map();
const cached = (key, fn) => {
    let v = CACHE.get(key);
    if (!v) {
        v = fn();
        CACHE.set(key, v);
    }
    return v;
};

const FISH = {
    sardine: {l: 7, h: 3, c: 0xc8d8e4, back: 0x4a6a90},
    tang: {l: 8, h: 6, c: 0xf0d030, back: 0xd8a820},
    clown: {l: 7, h: 4, c: 0xf07a28, back: 0xd05a18, stripes: 0xf8f8f0},
    blue: {l: 8, h: 5, c: 0x3a6ad8, back: 0x2a3a90, tail: 0xf0d030},
    snapper: {l: 10, h: 5, c: 0xe05a48, back: 0xb03a38},
    angel: {l: 8, h: 8, c: 0xf0e8a0, back: 0x3a3a48, stripes: 0x2a2a38},
    grouper: {l: 20, h: 10, c: 0x8a6a4a, back: 0x5a4434, spots: 0xb08a5a},
};

function fishSprite(kind, frame) {
    return cached(`fish:${kind}:${frame}`, () => {
        const s = FISH[kind], l = s.l, h = s.h;
        const c = new Cells(l + 4, h + 2);
        const cy = (h + 1) / 2;
        for (let x = 0; x < l; x++) {
            const u = x / (l - 1);
            const hh = Math.max(0.6, Math.sin(Math.PI * Math.pow(u, 0.8)) * h / 2 + (kind === 'angel' ? 0.5 : 0));
            for (let y = Math.round(cy - hh); y < Math.round(cy + hh); y++) {
                let col = y < cy - hh * 0.3 ? s.back : y > cy + hh * 0.4 ? mix(s.c, 0xffffff, 0.35) : s.c;
                if (s.stripes && (x === Math.floor(l * 0.35) || x === Math.floor(l * 0.65)))
                    col = s.stripes;
                if (s.spots && hash(x, y) < 250)
                    col = s.spots;
                c.set(x + 3, y, col);
            }
        }
        const tail = s.tail ?? s.back;
        const ty = Math.round(cy) - 1 + (frame ? 1 : 0);
        c.rect(1, ty - 1, 2, 1, tail);
        c.rect(2, ty, 1, 2, tail);
        c.rect(1, ty + 2, 2, 1, tail);
        if (kind === 'angel') {
            c.rect(5, 0, 2, 1, s.back);
            c.rect(5, h + 1, 2, 1, s.back);
        }
        c.set(l + 1, Math.round(cy) - 1, 0x101018);
        return c.finish(l > 9 ? 0x182028 : null);
    });
}

function turtleSprite(frame) {
    return cached(`turtle:${frame}`, () => {
        const c = new Cells(32, 15);
        for (let x = 6; x < 24; x++) {
            const u = (x - 6) / 17, hh = Math.round(Math.sin(Math.PI * u) * 6);
            for (let y = 8 - hh; y < 9; y++)
                c.set(x, y, (x + y) % 5 === 0 || (x - y) % 5 === 0 ? 0x5a6a2a : y < 5 ? 0x8a9a4a : 0x6a7a3a);
        }
        c.rect(6, 9, 18, 2, 0xc8b878);
        c.rect(24, 6, 4, 3, 0x8aa070);
        c.rect(27, 7, 3, 2, 0x8aa070);
        c.set(28, 7, 0x101010);
        const f = frame ? 2 : -2;
        c.rect(17, 10 + Math.max(0, f), 5, 2, 0x7a9060);
        c.rect(19, 11 + f + 1, 4, 2, 0x7a9060);
        c.rect(5, 10, 3, 2, 0x7a9060);
        c.rect(3, 9, 3, 1, 0x7a9060);
        return c.finish(0x1a2420);
    });
}

function sharkSprite(frame) {
    return cached(`shark:${frame}`, () => {
        const c = new Cells(58, 20);
        for (let x = 6; x < 54; x++) {
            const u = (x - 6) / 47;
            const top = 10 - Math.round(Math.sin(Math.PI * Math.pow(u, 0.7)) * 6), bot = 10 + Math.round(Math.sin(Math.PI * Math.pow(u, 0.7)) * 4);
            for (let y = top; y <= bot; y++)
                c.set(x, y, y > 11 ? 0xe0e4e4 : y < top + 2 ? 0x5a6a78 : 0x7a8a98);
        }
        for (let i = 0; i < 6; i++)
            c.rect(26 + i, 4 - i + 1, 1, 1 + i, 0x5a6a78);
        c.rect(20, 3, 6, 3, 0x5a6a78);
        const tf = frame ? 1 : -1;
        for (let i = 0; i < 6; i++) {
            c.set(5 - Math.floor(i / 2), 9 - i + tf, 0x5a6a78);
            c.set(5 - Math.floor(i / 3), 11 + i / 2 + tf, 0x5a6a78);
        }
        c.rect(1, 3 + tf, 3, 6, 0x5a6a78);
        c.rect(1, 11 + tf, 2, 3, 0x5a6a78);
        c.rect(34, 13, 5, 2, 0x6a7a88);
        for (let i = 0; i < 3; i++)
            c.rect(42 + i * 2, 9, 1, 3, 0x4a5a68);
        c.set(49, 8, 0x101018);
        return c.finish(0x182028);
    });
}

function mantaSprite(frame) {
    return cached(`manta:${frame}`, () => {
        const c = new Cells(44, 16);
        const lift = [-5, 0, 4][frame];
        for (let x = 0; x < 34; x++) {
            const d = Math.abs(x - 17) / 17;
            const y = 7 + Math.round(lift * d * d);
            c.rect(x + 4, y, 1, Math.max(1, Math.round(4 * (1 - d)) + 1), d > 0.95 ? 0x2a3040 : 0x3a4458);
            c.set(x + 4, y + Math.max(1, Math.round(4 * (1 - d)) + 1), 0xd8dce0);
        }
        c.rect(37, 8, 3, 3, 0x3a4458);
        c.rect(39, 7, 2, 1, 0x3a4458);
        c.rect(39, 11, 2, 1, 0x3a4458);
        c.rect(0, 9, 5, 1, 0x2a3040);
        return c.finish(0x141820);
    });
}

function crabSprite(frame) {
    return cached(`crab:${frame}`, () => {
        const c = new Cells(11, 6);
        c.rect(2, 2, 7, 3, 0xd84a30);
        c.rect(3, 1, 5, 1, 0xf06a48);
        c.set(4, 0, 0x101010);
        c.set(6, 0, 0x101010);
        c.rect(0, 1, 2, 2, 0xe85a38);
        c.rect(9, 1, 2, 2, 0xe85a38);
        for (let i = 0; i < 3; i++) {
            c.set(2 + i * 2 + (frame ? 1 : 0), 5, 0xb03a28);
            c.set(8 - i * 2 - (frame ? 1 : 0), 5, 0xb03a28);
        }
        return c.finish(0x281410);
    });
}

function seahorseSprite() {
    return cached('seahorse', () => {
        const c = new Cells(6, 13);
        c.rect(1, 0, 3, 3, 0xf0b040);
        c.rect(4, 1, 2, 1, 0xf0b040);
        c.rect(1, 3, 3, 5, 0xe8a030);
        c.rect(0, 4, 1, 2, 0xf8d070);
        c.rect(2, 8, 2, 2, 0xe8a030);
        c.rect(3, 10, 1, 2, 0xd89028);
        c.set(2, 12, 0xd89028);
        c.set(2, 1, 0x101010);
        return c.finish(0x3a2010);
    });
}

function octoSprite(color, frame) {
    return cached(`octo:${color}:${frame}`, () => {
        const c = new Cells(16, 12);
        c.rect(4, 0, 8, 6, color);
        c.rect(5, 0, 6, 1, mix(color, 0xffffff, 0.3));
        c.set(6, 3, 0x101010);
        c.set(9, 3, 0x101010);
        c.set(6, 2, 0xffffff);
        c.set(9, 2, 0xffffff);
        for (let k = 0; k < 6; k++) {
            const bx = 2 + k * 2.4;
            for (let i = 0; i < 6; i++) {
                const off = Math.round(Math.sin(i * 0.9 + k + frame * 1.6) * 1.2);
                c.set(Math.round(bx + off + (k - 2.5) * i * 0.25), 6 + i, i % 2 ? mix(color, 0x000000, 0.2) : color);
            }
        }
        return c.finish(0x200c18);
    });
}

const COPPER = [0x4a2418, 0x84422a, 0xb8683a, 0xd88a50, 0xf0b888];
const SUITS = [0xb8a888, 0x8a8478, 0x9a6a48, 0x5a6a7a, 0xa8a090];

// Helmet diver facing right; suit indexes SUITS, copper picks the helmet
// metal and frame 4 is a wave with the front arm raised. A round helmet
// with a big barred face port, a side port, a bolted breastplate and an
// air tank on the back like the Rouquayrol apparatus in Verne.
export function diverSprite(frame, suit = 0, copper = false) {
    return cached(`diver:${frame}:${suit}:${copper}`, () => {
        const c = new Cells(22, 29), O = 3;
        const B = copper ? COPPER : BRASS_;
        const S = A.ramp(SUITS[suit]);
        const port = (cx, cy, rg, rr, glass) => {
            for (let y = -4; y <= 4; y++)
                for (let x = -4; x <= 4; x++) {
                    const d = Math.hypot(x, y);
                    if (d < rg)
                        c.set(cx + x, cy + y, glass);
                    else if (d < rr)
                        c.set(cx + x, cy + y, x + y < 0 ? B[4] : B[1]);
                }
        };
        // waving uses the back arm, raised behind the helmet
        if (frame === 4) {
            c.rect(O - 1, 3, 2, 14, S[1]);
            c.rect(O - 1, 1, 2, 2, 0x5a4a3a);
        }
        // air tank on the back, hose into the back of the helmet
        c.rect(0, 13, 3, 7, IRON[2]);
        c.rect(1, 13, 1, 7, IRON[4]);
        c.rect(0, 19, 3, 1, IRON[1]);
        c.set(1, 12, B[2]);
        for (const [x, y] of [[1, 11], [1, 10], [2, 9]])
            c.set(x, y, 0x2a2622);
        // round helmet, lit from the upper left
        for (let y = 0; y < 15; y++)
            for (let x = 0; x < 15; x++) {
                const dx = x - 7, dy = y - 7;
                if (dx * dx + dy * dy < 50) {
                    const n = (-dx * 0.6 - dy * 0.8) / 7;
                    c.set(x + O, y, n > 0.5 ? B[4] : n > 0.05 ? B[3] : n > -0.5 ? B[2] : B[1]);
                }
            }
        // the big face plate stands out in front, with a grille bar
        port(O + 14, 8, 2.6, 3.9, 0x1e4a5e);
        c.rect(O + 14, 6, 1, 5, B[1]);
        c.set(O + 13, 7, 0xb8e8f4);
        c.set(O + 15, 9, 0xe0b090);
        // barred side port
        port(O + 6, 7, 1.5, 2.6, 0x2a5a70);
        c.set(O + 6, 7, B[1]);
        c.set(O + 5, 6, 0x9ad0e0);
        // breastplate with bolts
        c.rect(O - 1, 14, 17, 3, B[2]);
        c.rect(O, 14, 15, 1, B[3]);
        c.rect(O - 1, 16, 17, 1, B[1]);
        for (let x = O; x < O + 16; x += 3)
            c.set(x, 15, B[4]);
        // canvas suit, belt with lead weights and the lamp
        c.rect(O + 1, 17, 12, 6, S[2]);
        c.rect(O + 1, 17, 2, 6, S[1]);
        c.rect(O + 1, 21, 12, 1, 0x5a4030);
        c.rect(O + 5, 21, 3, 2, 0x6a6a70);
        c.rect(O + 11, 18, 3, 3, B[1]);
        c.set(O + 13, 19, 0xfff0c0);
        const sw = frame === 4 ? 0 : [0, 1, 0, -1][frame];
        c.rect(O + 8 + sw, 17, 2, 5, S[1]);
        c.rect(O + 8 + sw, 22, 2, 1, 0x5a4a3a);
        // legs and lead boots with brass toes
        const a = [1, 0, -1, 0, 0][frame];
        c.rect(O + 2 + a, 23, 4, 4, S[1]);
        c.rect(O + 7 - a, 23, 4, 4, S[2]);
        c.rect(O + 1 + a, 27, 6, 2, 0x3a3030);
        c.rect(O + 6 - a, 27, 6, 2, 0x4a3a34);
        c.set(O + 11 - a, 27, B[2]);
        c.light(O + 13, 19, 0xfff0c0, 'lamp');
        return c.finish(0x1a1410);
    });
}

// Merfolk: m = {tail: bool, skin, hair, body}; pose 'swim' (head right)
// or 'up' (upright, arm on the right side raised in frames 1 and 2).
function merSprite(m, pose, frame) {
    return cached(`mer:${m.id}:${pose}:${frame}`, () => {
        const sk = m.skin, body = m.body, dk = mix(body, 0x102030, 0.35), lt = mix(body, 0xffffff, 0.3);
        if (pose === 'swim') {
            const c = new Cells(32, 11);
            // head and hair streaming back
            c.rect(25, 3, 5, 5, sk);
            c.set(29, 4, 0x101018);
            if (m.tail) {
                c.rect(19, 2, 8, 2, m.hair);
                c.rect(15, 3, 6, 2, m.hair);
                c.rect(12, 4 + (frame === 1 ? 1 : 0), 4, 1, m.hair);
            } else {
                for (let i = 0; i < 5; i++)
                    c.set(23 + i, 2 - (i % 2), m.fin);
                c.set(28, 6, mix(sk, 0x102030, 0.3));
            }
            // torso and arm
            c.rect(16, 5, 9, 4, m.tail ? sk : body);
            c.rect(17, 8, 6, 1, mix(m.tail ? sk : body, 0x102030, 0.25));
            if (m.tail)
                c.rect(20, 5, 3, 2, m.top);
            c.rect(17 + frame, 9, 6, 1, m.tail ? sk : body);
            if (m.tail) {
                for (let x = 4; x < 16; x++) {
                    const hh = Math.max(1, Math.round(2 * (x - 3) / 12) + 1);
                    const y0 = 7 - hh + Math.round(Math.sin((x - 16) * 0.35 + frame * 2) * 0.8);
                    for (let y = y0; y < y0 + hh * 2 - 1; y++)
                        c.set(x, y, (x + y) % 3 === 0 ? lt : y === y0 ? lt : body);
                }
                const fy = [3, 6, 8][frame];
                c.rect(0, fy - 2, 2, 3, dk);
                c.rect(2, fy - 1, 2, 2, body);
                c.rect(0, fy + 1, 2, 2, dk);
            } else {
                const k = [2, 0, -2][frame];
                c.rect(6, 5 + Math.round(k / 2), 10, 2, dk);
                c.rect(6, 7 - Math.round(k / 2), 10, 2, body);
                c.rect(2, 4 + k, 4, 3, m.fin);
                c.rect(2, 7 - k, 4, 3, mix(m.fin, 0x000000, 0.2));
            }
            if (m.glow && m.tail)
                c.light(10, 6, m.glow, 'spot');
            return c.finish(0x14202a);
        }
        const c = new Cells(14, 32);
        c.rect(4, 1, 6, 6, sk);
        c.set(8, 3, 0x101018);
        c.set(6, 3, 0x101018);
        if (m.tail) {
            c.rect(3, 0, 8, 2, m.hair);
            c.rect(2, 1, 2, 10, m.hair);
            c.rect(10, 1, 2, 8, m.hair);
        } else {
            for (let i = 0; i < 6; i++)
                c.set(4 + i, i % 2 ? 0 : 1, m.fin);
            c.rect(2, 3, 2, 3, m.fin);
            c.rect(10, 3, 2, 3, m.fin);
        }
        const torso = m.tail ? sk : body;
        c.rect(4, 7, 6, 8, torso);
        if (m.tail)
            c.rect(4, 9, 6, 2, m.top);
        // arms: left hangs, right one moves with the frame
        c.rect(2, 8, 2, 6, torso);
        if (frame === 0)
            c.rect(10, 8, 2, 6, torso);
        else if (frame === 1)
            c.rect(10, 2, 2, 7, torso);
        else
            c.rect(11, 1, 2, 7, torso);
        if (frame)
            c.rect(frame === 1 ? 10 : 11, frame === 1 ? 1 : 0, 3, 2, torso);
        if (m.tail) {
            for (let y = 15; y < 28; y++) {
                const hw = Math.max(1, Math.round(3 - (y - 15) / 5));
                const sx = 7 + Math.round(Math.sin(y * 0.4 + frame) * 1);
                for (let x = sx - hw; x < sx + hw; x++)
                    c.set(x, y, (x + y) % 3 === 0 ? lt : body);
            }
            c.rect(3, 28, 4, 3, dk);
            c.rect(7, 28, 4, 3, body);
        } else {
            c.rect(4, 15, 3, 10, dk);
            c.rect(7, 15, 3, 10, body);
            c.rect(2, 25, 5, 3, m.fin);
            c.rect(7, 25, 5, 3, mix(m.fin, 0x000000, 0.2));
        }
        return c.finish(0x14202a);
    });
}

function subSprite(L) {
    return cached(`sub:${L}`, () => {
        const H0 = 12, cy = 16;
        const c = new Cells(L + 20, 34);
        const top = [];
        for (let x = 0; x < L; x++) {
            const u = x / L;
            let hh = u < 0.14 ? H0 * (0.35 + u / 0.14 * 0.65) : u > 0.78 ? H0 * Math.sqrt(Math.max(0.02, (1 - u) / 0.22)) : H0;
            hh = Math.round(hh);
            top[x] = cy - hh;
            for (let y = cy - hh; y <= cy + Math.round(hh * 0.85); y++) {
                const r = (y - (cy - hh)) / (hh * 1.85);
                let col = r < 0.12 ? IRON[4] : r < 0.4 ? IRON[3] : r < 0.75 ? IRON[2] : IRON[1];
                if (x % 14 === 0 && x > 4)
                    col = IRON[1];
                if ((x % 14 === 2 || x % 14 === 12) && (y - cy) % 4 === 0)
                    col = IRON[4];
                c.set(x + 8, y, col);
            }
        }
        // saw-tooth dorsal ridge
        for (let x = Math.floor(L * 0.22); x < Math.floor(L * 0.76); x++) {
            const h = 4 - (x % 6 < 3 ? x % 6 : 6 - x % 6);
            for (let y = top[x] - h; y < top[x]; y++)
                c.set(x + 8, y, IRON[3]);
        }
        // ram spike at the nose
        for (let x = 0; x < 18; x++)
            c.rect(L + 8 + x - 2, cy - 1 + (x > 12 ? 1 : 0), 1, x > 12 ? 1 : 2, x % 3 ? IRON[3] : IRON[4]);
        // pilot house with lens windows
        const wx = Math.floor(L * 0.66);
        c.rect(wx + 8, top[wx] - 9, 20, 9, IRON[2]);
        c.rect(wx + 8, top[wx] - 9, 20, 1, IRON[4]);
        for (let k = 0; k < 4; k++) {
            c.rect(wx + 10 + k * 5, top[wx] - 6, 3, 3, 0x1a2a3a);
            c.light(wx + 11 + k * 5, top[wx] - 5, 0xfff0b0, 'win');
        }
        // the salon window with its organ
        const sx = Math.floor(L * 0.44) + 8;
        for (let y = -8; y <= 8; y++)
            for (let x = -8; x <= 8; x++) {
                const d = x * x + y * y;
                if (d <= 64)
                    c.set(sx + x, cy + y, d > 42 ? (y < 0 ? BRASS[3] : BRASS[2]) : 0x1a2a40);
            }
        for (let k = -4; k <= 4; k += 2)
            c.rect(sx + k, cy + 2 - (4 - Math.abs(k)), 1, 6 - Math.abs(k) / 2 + (4 - Math.abs(k)), BRASS[1]);
        c.light(sx, cy, 0xffd890, 'salon');
        // portholes
        for (let x = Math.floor(L * 0.18); x < Math.floor(L * 0.8); x += 12) {
            if (Math.abs(x + 8 - sx) < 14)
                continue;
            c.rect(x + 8, cy + 1, 3, 3, BRASS[2]);
            c.set(x + 9, cy + 2, 0x1a2a3a);
            c.light(x + 9, cy + 2, 0xffe0a0, 'win');
        }
        // rudder and fins at the stern
        c.rect(6, cy - 11, 4, 9, IRON[2]);
        c.rect(6, cy + 3, 4, 8, IRON[1]);
        c.rect(2, cy - 1, 6, 2, IRON[2]);
        c.light(L + 6, cy - 4, 0xfff4d0, 'lamp');
        c.light(1, cy, 0, 'prop');
        return c.finish(0x101818);
    });
}

// ---------------- scene ----------------

export class Deep {
    constructor(w, h, env) {
        this.name = 'underwater';
        this.ownSky = true;
        this.w = w;
        this.h = h;
        this.timers = new Timers();
        this.layout(env);
    }

    ambient(env) {
        const d = (1 - env.dark) * (1 - env.weather.v.dim * 0.45);
        return [0.2 + 0.74 * d, 0.27 + 0.7 * d, 0.42 + 0.58 * d];
    }

    layout(env) {
        const W = this.w, H = this.h;
        this.t = 0;
        this.surfY = Math.max(10, Math.round(H * 0.04));
        this.horizon = this.surfY;
        this.flip = chance(0.5);
        const base = Math.round(H * 0.83);
        const r = Math.round(Math.min(W * 0.25, H * 0.48));
        const dx = Math.round(W * (this.flip ? rand(0.36, 0.48) : rand(0.52, 0.64)));
        this.dome = {x: dx, r, base};
        const side = this.flip ? 1 : -1;
        this.tower = {x: dx + side * (r + 26), top: base - Math.round(r * 0.75), side};
        const ay = this.tower.top + 14;
        this.tower.dock = {x: side > 0 ? this.tower.x + 25 : this.tower.x - 25, y: ay + 4};
        this.tower.beacon = [this.tower.x, this.tower.top - 15];
        this.deck = base - 6;
        this.airlock = {x: dx - side * (r + 4), y: base};
        this.wreck = {x: this.flip ? Math.round(W * rand(0.8, 0.88)) : Math.round(W * rand(0.12, 0.2)), w: randi(130, 170), dir: chance(0.5) ? 1 : -1};
        // sea floor height, flat around the dome and the wreck
        const seed = randi(0, 1e6);
        this.floor = new Int16Array(W + 1);
        for (let x = 0; x <= W; x++) {
            let y = base + Math.sin(x * 0.011 + seed) * 7 + Math.sin(x * 0.031 + seed * 2) * 3;
            const dd = Math.abs(x - dx) - r - 40;
            if (dd < 40)
                y = base + (y - base) * clamp(dd / 40, 0, 1);
            this.floor[x] = Math.round(y);
        }
        this.ridges = [0, 1].map(l => {
            const pts = [];
            let y = rand(0.3, 0.7);
            for (let x = 0; x <= W + 8; x += 6) {
                y = clamp(y + rand(-0.18, 0.18), 0.05, 1);
                pts.push(y);
            }
            for (let k = 0; k < 2; k++)
                for (let i = 1; i < pts.length - 1; i++)
                    pts[i] = (pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4;
            return {pts, h: l === 0 ? rand(0.25, 0.35) * H : rand(0.12, 0.2) * H};
        });
        this.arch = chance(0.6) ? {x: randi(40, W - 120), w: randi(70, 110), h: randi(50, 80)} : null;
        const free = (x, pad) => Math.abs(x - dx) > r + 34 + pad && Math.abs(x - this.tower.x) > 16 + pad &&
            Math.abs(x - (this.wreck.x)) > this.wreck.w / 2 + pad;
        // kelp in clusters
        this.kelp = [];
        for (let k = 0; k < Math.max(4, Math.round(W / 170)); k++) {
            const cx = randi(10, W - 10);
            for (let i = 0; i < randi(4, 9); i++) {
                const x = cx + randi(-30, 30);
                if (x > 0 && x < W && free(x, 4))
                    this.kelp.push({x, h: rand(0.3, 0.62) * H, ph: rand(6.28), c: pick([0x5a8a2a, 0x6a9a30, 0x4a7a2a, 0x7a8a2a])});
            }
        }
        this.kelp.sort((a, b) => b.h - a.h);
        // coral, rocks, sponges and small things on the floor
        this.deco = [];
        // big reef rocks with coral on top
        this.reefs = [];
        for (let k = 0; k < 60 && this.reefs.length < Math.max(2, Math.round(W / 400)); k++) {
            const x = randi(30, W - 30);
            if (free(x, 30) && !this.reefs.some(o => Math.abs(o.x - x) < 120))
                this.reefs.push({x, w: randi(40, 80), h: randi(18, 34), seed: randi(0, 1e6)});
        }
        // coral grows in patches, with grass and shells in between
        for (let k = 0; k < W / 70; k++) {
            const px = randi(0, W);
            for (let i = 0; i < randi(4, 10); i++) {
                const x = px + randi(-36, 36);
                if (x < 4 || x > W - 8 || !free(x, 0))
                    continue;
                this.deco.push({x, kind: weighted([['brain', 2], ['branch', 3], ['fan', 2], ['tube', 2], ['rock', 1.5], ['grass', 3], ['star', 0.7], ['shell', 0.8]]), c: pick(CORALS), s: rand(1, 2.2), seed: randi(0, 1e6)});
            }
        }
        for (let i = 0; i < W / 30; i++) {
            const x = randi(4, W - 8);
            if (free(x, 0))
                this.deco.push({x, kind: weighted([['grass', 4], ['rock', 1.5], ['shell', 1], ['star', 1], ['brain', 1], ['branch', 1], ['tube', 0.6]]), c: pick(CORALS), s: rand(0.9, 1.8), seed: randi(0, 1e6), dy: randi(6, Math.round(H * 0.13))});
        }
        this.deco.sort((a, b) => (a.dy || 0) - (b.dy || 0) || (a.kind === 'rock' ? 0 : 1) - (b.kind === 'rock' ? 0 : 1));
        this.anemones = [];
        for (let i = 0; i < randi(3, 6); i++) {
            const x = randi(10, W - 10);
            if (free(x, 6))
                this.anemones.push({x, c: pick([0xf080a0, 0xa0e070, 0xf0a040, 0xc080f0]), ph: rand(6.28)});
        }
        this.vents = [this.wreck.x + randi(-30, 30), ...this.anemones.map(a => a.x)];
        this.chest = {x: this.wreck.x + (this.wreck.dir > 0 ? this.wreck.w / 2 + 16 : -this.wreck.w / 2 - 30)};
        // people inside the dome
        const fake = {season: 'summer', weather: {v: {rain: 0}}, holidays: {}, dark: 0};
        // twice the usual number exist, the people slider shows a share
        this.allPeople = [];
        this.peopleBase = randi(4, 8);
        for (let i = 0; i < this.peopleBase * 2; i++) {
            const p = makePerson(fake);
            p.dog = null;
            p.balloon = null;
            p.umbrella = null;
            p.x = dx + rand(-r * 0.7, r * 0.7);
            p.dir = chance(0.5) ? 1 : -1;
            p.state = 'walk';
            p.timer = rand(2, 8);
            this.allPeople.push(p);
        }
        this.people = this.allPeople.slice(0, Math.round(this.peopleBase * env.people));
        this.lamps = [dx - Math.round(r * 0.55), dx + Math.round(r * 0.55)];
        this.schools = [];
        this.big = [];
        this.jellies = [];
        this.crabs = [];
        this.merfolk = [];
        this.divers = [];
        this.bubbles = [];
        this.snow = [];
        this.splashes = [];
        this.notes = [];
        this.boat = null;
        this.whale = null;
        this.sub = null;
        for (let i = 0; i < Math.round(W * H / 9000); i++)
            this.snow.push({x: rand(W), y: rand(this.surfY, H), v: rand(1, 4), p: rand(6.28), glow: chance(0.25)});
        for (let i = 0; i < randi(3, 5); i++)
            this._school(true);
        for (let i = 0; i < randi(1, 3); i++)
            this._crab(true);
        for (let i = 0; i < randi(1, 3); i++)
            this._jelly(true);
        let ox = this.deco.find(d => d.kind === 'rock')?.x;
        for (let i = 0; i < 40 && ox === undefined; i++) {
            const x = randi(20, W - 20);
            if (free(x, 10))
                ox = x;
        }
        this.octo = chance(0.7) && ox !== undefined ? {x: ox, c: pick([0xd86a4a, 0x9a5ab0, 0xe08a6a]), t: rand(5), timer: rand(10, 40)} : null;
        this.horses = this.kelp.length ? [{k: pick(this.kelp), t: rand(6), dy: rand(0.2, 0.6)}] : [];
        this.eventTimer = rand(8, 20);
        this.merTimer = rand(10, 40);
        this.subTimer = rand(30, 120);
        this.diverTimer = rand(10, 60);
        this.krakenTimer = rand(90, 300);
        this.kraken = null;
        this.ink = [];
        if (chance(0.5 * env.traffic))
            this.trigger('sub', env, null, true);
        if (chance(0.6 * env.people))
            this.trigger('merfolk', env);
        this.layerA = this.layerB = null;
        this._caustics();
    }

    _caustics() {
        // two sine tables combine into the moving net of light on the sand
        this.ca = new Float32Array(1024);
        this.cb = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
            this.ca[i] = Math.sin(i / 1024 * Math.PI * 2 * 9) + 0.5 * Math.sin(i / 1024 * Math.PI * 2 * 23);
            this.cb[i] = Math.sin(i / 1024 * Math.PI * 2 * 13) + 0.5 * Math.sin(i / 1024 * Math.PI * 2 * 31);
        }
    }

    floorAt(x) {
        return this.floor[clamp(Math.round(x), 0, this.w)];
    }

    // ---------- static ----------

    staticKey(env) {
        return [env.lampsOn ? 1 : 0, env.season === 'winter' && env.weather.snowCover > 0.2 ? 1 : 0].join(':');
    }

    renderStatic(g, env) {
        if (!this.layerA) {
            this.layerA = g.layer();
            this.layerB = g.layer();
        }
        this.layerB.fill(0);
        g.into(this.layerA, () => this._drawWater(g, env));
        g.into(this.layerB, () => this._drawFloor(g, env));
    }

    _drawWater(g, env) {
        const W = this.w, H = this.h, t = g.t;
        const cols = WATER.map(c => pack((c >> 16) & 255, (c >> 8) & 255, c & 255));
        for (let y = 0; y < H; y++) {
            const f = clamp((y - this.surfY) / (H - this.surfY), 0, 1) * (cols.length - 1);
            const band = Math.min(cols.length - 2, Math.floor(f)), frac = f - band;
            for (let x = 0, i = y * W; x < W; x++, i++)
                t[i] = frac > BAYER[(y & 3) * 4 + (x & 3)] ? cols[band + 1] : cols[band];
        }
        // far rock ridges fade into the blue
        this.ridges.forEach((rd, l) => {
            const c = mix(WATER[2 + l], 0x0a2040, 0.25 + l * 0.15);
            const base = this.dome.base - (l === 0 ? 30 : 6);
            for (let x = 0; x < W; x++) {
                const i = x / 6, i0 = Math.floor(i), f = i - i0;
                const v = rd.pts[i0] * (1 - f) + rd.pts[Math.min(rd.pts.length - 1, i0 + 1)] * f;
                const top = Math.round(base - v * rd.h);
                g.rect(x, top, 1, H - top, c);
                g.px(x, top, mix(c, 0x80d0e0, 0.25));
            }
        });
        if (this.arch) {
            const a = this.arch, c = mix(WATER[3], 0x0a2040, 0.3), base = this.dome.base;
            for (let x = 0; x < a.w; x++) {
                const u = x / a.w * 2 - 1, inner = Math.sqrt(Math.max(0, 1 - u * u * 1.4)) * a.h * 0.75;
                const top = base - a.h - Math.round(Math.sin(x * 0.2) * 3);
                g.rect(a.x + x, top, 1, Math.max(0, base - inner - top), c);
            }
        }
        // ice sheet at the surface in a cold winter
        if (env.season === 'winter' && env.weather.snowCover > 0.2) {
            g.rect(0, 0, W, this.surfY + 3, 0xd8f0f8);
            g.rect(0, this.surfY + 3, W, 1, 0xa8d0e0);
            for (let x = 0; x < W; x += 1 + hash(x, 3) % 23)
                if (hash(x, 4) < 400)
                    g.line(x, 0, x + hash(x, 5) % 9 - 4, this.surfY + 2, 0x98c4d8);
        }
    }

    _drawFloor(g, env) {
        const W = this.w, H = this.h, d = this.dome;
        // sand with ripples and pebbles
        for (let x = 0; x < W; x++) {
            const fy = this.floor[x];
            g.rect(x, fy, 1, H - fy, SAND[2]);
            // wavy ripples, lit on one side
            for (let y = fy + 4; y < H; y++) {
                const w = (y + Math.round(Math.sin(x * 0.05 + y * 0.02) * 3 + Math.sin(x * 0.013) * 5)) % 9;
                if (w === 0)
                    g.px(x, y, SAND[3]);
                else if (w === 1 && hash(x >> 2, y) < 700)
                    g.px(x, y, mix(SAND[2], SAND[1], 0.6));
            }
            g.px(x, fy, SAND[4]);
            g.px(x, fy + 1, SAND[3]);
            for (let y = fy + 3; y < H; y += 3 + (hash(x >> 3, y) % 3)) {
                const h = hash(x, y);
                if (h < 260)
                    g.px(x, y, SAND[1]);
                else if (h > 930)
                    g.px(x, y, SAND[4]);
            }
            if (((x + Math.round(Math.sin(x * 0.07) * 3)) % 11) < 4)
                g.px(x, fy + 6 + ((x >> 4) % 3) * 5, SAND[1]);
        }
        this._drawWreck(g);
        for (const rf of this.reefs)
            this._reef(g, rf);
        for (const o of this.deco)
            this._deco(g, o);
        this._drawDome(g, env);
        this._drawTower(g, env);
        this._chest(g);
    }

    _deco(g, o) {
        const x = o.x, fy = o.at ?? this.floorAt(x) + 2 + (o.dy || 0), s = o.s, c = o.c;
        if (o.kind === 'rock') {
            const w = Math.round(14 * s + 6), h = Math.round(8 * s + 4);
            for (let yy = 0; yy < h; yy++) {
                const hw = Math.round(w / 2 * Math.sqrt(1 - Math.pow(yy / h, 2)));
                g.rect(x - hw, fy - yy, hw * 2, 1, yy > h * 0.6 ? 0x7a7a72 : 0x5a5a58);
                g.px(x - hw, fy - yy, INK);
                g.px(x + hw - 1, fy - yy, INK);
                if (yy > h * 0.5 && hash(x, yy) < 400)
                    g.px(x - hw + 1 + hash(yy, x) % Math.max(1, hw * 2 - 2), fy - yy, 0x5a8a3a);
            }
            g.rect(x - Math.round(w / 4), fy - h, Math.round(w / 2), 1, INK);
        } else if (o.kind === 'brain') {
            const r = Math.round(7 * s + 3);
            for (let yy = 0; yy < r; yy++) {
                const hw = Math.round(Math.sqrt(r * r - yy * yy));
                for (let xx = -hw; xx < hw; xx++)
                    g.px(x + xx, fy - yy, Math.sin(xx * 0.9 + Math.sin(yy * 0.8) * 2) > 0.4 ? mix(c, 0x401020, 0.35) : yy > r * 0.7 ? mix(c, 0xffffff, 0.25) : c);
                g.px(x - hw - 1, fy - yy, INK);
                g.px(x + hw, fy - yy, INK);
            }
        } else if (o.kind === 'branch') {
            const grow = (bx, by, a, len, depth) => {
                const ex = bx + Math.cos(a) * len, ey = by - Math.sin(a) * len;
                g.line(bx, by, ex, ey, mix(c, 0x401020, 0.2));
                g.line(bx + 1, by, ex + 1, ey, c);
                if (depth > 0) {
                    grow(ex, ey, a + 0.45 + (hash(depth, bx | 0, o.seed) % 30) / 100, len * 0.72, depth - 1);
                    grow(ex, ey, a - 0.45 - (hash(by | 0, depth, o.seed) % 30) / 100, len * 0.72, depth - 1);
                } else {
                    g.px(ex, ey, mix(c, 0xffffff, 0.5));
                    g.px(ex + 1, ey, mix(c, 0xffffff, 0.5));
                }
            };
            grow(x, fy, Math.PI / 2, 7 * s + 3, 3);
        } else if (o.kind === 'fan') {
            const h = Math.round(20 * s + 6);
            for (let k = -4; k <= 4; k++)
                g.line(x, fy, x + k * h / 8, fy - h + Math.abs(k) * 2, mix(c, 0x401040, 0.15));
            for (let y = fy - 4; y > fy - h; y -= 3) {
                const hw = (fy - y) / h * h / 2;
                g.rect(x - hw, y, hw * 2, 1, mix(c, 0xffffff, 0.15));
            }
            g.rect(x, fy - 3, 1, 3, INK);
        } else if (o.kind === 'tube') {
            for (let k = 0; k < 3; k++) {
                const h = Math.round((8 + hash(k, o.seed) % 10) * s), tx = x + k * 4 - 4;
                g.rect(tx - 1, fy - h, 5, h, INK);
                g.rect(tx, fy - h + 1, 3, h - 1, c);
                g.rect(tx, fy - h + 1, 1, h - 1, mix(c, 0xffffff, 0.3));
                g.rect(tx + 1, fy - h, 1, 2, 0x201010);
            }
        } else if (o.kind === 'grass') {
            for (let k = 0; k < 6; k++) {
                const h = 4 + hash(k, o.seed) % 8;
                g.line(x + k, fy, x + k + (k % 3) - 1, fy - h, k % 2 ? 0x4a8a3a : 0x6aa040);
            }
        } else if (o.kind === 'star') {
            const sc = pick([0xf06040, 0xf0a030, 0xb050c0]);
            g.rect(x - 2, fy - 1, 5, 1, sc);
            g.rect(x, fy - 3, 1, 3, sc);
            g.px(x - 1, fy, sc);
            g.px(x + 1, fy, sc);
        } else {
            g.rect(x, fy - 2, 4, 2, 0xf0e0d0);
            g.px(x + 1, fy - 3, 0xf0d0c0);
            g.px(x + 2, fy - 1, 0xc8a8a0);
        }
    }

    _reef(g, rf) {
        const fy = this.floorAt(rf.x) + 3, R = [0x3a3a40, 0x4e4e54, 0x66666a, 0x828078, 0x9a9688];
        const top = [];
        for (let x = 0; x < rf.w; x++) {
            const u = x / rf.w * 2 - 1;
            const h = Math.round(rf.h * Math.pow(1 - u * u, 0.6) * (0.85 + 0.15 * Math.sin(x * 0.4 + rf.seed)));
            top[x] = fy - h;
            for (let y = fy - h; y < fy; y++) {
                const d = y - (fy - h);
                let c = d < 2 ? R[4] : d < h * 0.4 ? R[3] : d < h * 0.75 ? R[2] : R[1];
                if (hash(x >> 1, y >> 1, rf.seed) < 120)
                    c = R[1];
                g.px(rf.x - rf.w / 2 + x, y, c);
            }
            g.px(rf.x - rf.w / 2 + x, fy - h - 1, INK);
        }
        // coral, sponges and anemone colors on top of the rock
        for (let x = 3; x < rf.w - 3; x += randi(5, 9)) {
            const kind = pick(['brain', 'branch', 'fan', 'tube', 'branch', 'grass']);
            this._deco(g, {x: rf.x - rf.w / 2 + x, kind, c: pick(CORALS), s: rand(0.7, 1.4), seed: hash(x, 3, rf.seed), at: top[x] + 1});
        }
    }

    _drawWreck(g) {
        const wk = this.wreck, w = wk.w, x0 = Math.round(wk.x - w / 2), fy = this.floorAt(wk.x) + 6;
        const PL = [0x2a1e18, 0x3e2c22, 0x54402e, 0x6a5038, 0x86684a];
        const tilt = 0.12 * wk.dir;
        const h = Math.round(w * 0.3);
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const keel = Math.round(fy - (x - w / 2) * tilt * 0.3);
            const bow = u > 0.85 ? (u - 0.85) / 0.15 : u < 0.1 ? (0.1 - u) / 0.1 : 0;
            const top = keel - h + Math.round(bow * bow * 10) - Math.round((x - w / 2) * tilt);
            const bottom = keel - Math.round(Math.pow(Math.abs(u - 0.5) * 2, 3) * h * 0.5);
            if (bottom <= top)
                continue;
            for (let y = top; y < bottom; y++) {
                const r = (y - top) % 5;
                let c = r === 0 ? PL[1] : r === 4 ? PL[2] : PL[3];
                if ((x + Math.floor((y - top) / 5) * 7) % 23 === 0)
                    c = PL[1];
                if (hash(x >> 2, y >> 2, 9) < 90)
                    c = 0x0a1418;
                if (hash(x, y, 7) < 60)
                    c = 0x5a7a4a;
                g.px(x0 + x, y, c);
            }
            g.px(x0 + x, top, PL[4]);
            g.px(x0 + x, top - 1, INK);
        }
        // portholes and a jagged hole
        for (let k = 0; k < 5; k++) {
            const px = x0 + Math.round(w * (0.2 + k * 0.13));
            const py = Math.round(fy - h * 0.55 - (px - wk.x) * tilt);
            g.rect(px, py, 4, 4, BRASS[1]);
            g.rect(px + 1, py + 1, 2, 2, 0x0a1418);
        }
        // broken mast with a tattered sail
        const mx = x0 + Math.round(w * 0.45), my = Math.round(fy - h - (mx - wk.x) * tilt);
        const mh = Math.round(h * 2), lean = wk.dir * 0.35;
        for (let i = 0; i < mh; i++)
            g.rect(mx + Math.round(i * lean), my - i, 3, 1, i % 9 === 0 ? PL[1] : PL[3]);
        const ty = my - Math.round(mh * 0.7);
        g.rect(mx + Math.round(mh * 0.7 * lean) - 14, ty, 30, 2, PL[2]);
        for (let y = 0; y < 22; y++)
            for (let x = 0; x < 24; x++)
                if (hash(x, y, 3) > 280 + y * 25)
                    g.px(mx + Math.round(mh * 0.7 * lean) - 12 + x + Math.round(y * lean), ty + 2 + y, mix(0xc8c0a0, 0x6a8a7a, 0.4 + (y / 22) * 0.4));
        // crow's nest
        g.rect(mx + Math.round(mh * lean) - 4, my - mh, 10, 4, PL[2]);
        g.rect(mx + Math.round(mh * lean) - 4, my - mh, 10, 1, PL[4]);
        // half buried in sand
        for (let x = -4; x < w + 4; x++)
            g.rect(x0 + x, fy - 4 + Math.round(Math.sin(x * 0.2) * 2), 1, 8, SAND[2]);
    }

    _chest(g) {
        const x = Math.round(this.chest.x), fy = this.floorAt(x) + 2;
        g.rect(x - 1, fy - 9, 18, 10, INK);
        g.rect(x, fy - 8, 16, 8, 0x7a4a28);
        g.rect(x, fy - 5, 16, 1, BRASS[2]);
        g.rect(x + 7, fy - 6, 2, 3, BRASS[3]);
        // the lid stands open, gold spills out
        g.rect(x - 1, fy - 17, 18, 8, INK);
        g.rect(x, fy - 16, 16, 6, 0x8a5a30);
        g.rect(x, fy - 16, 16, 1, BRASS[3]);
        for (let k = 0; k < 12; k++)
            g.px(x + 1 + hash(k, 1) % 14, fy - 9 - hash(k, 2) % 2, k % 3 ? BRASS[4] : BRASS[3]);
        for (let k = 0; k < 6; k++)
            g.rect(x + 16 + k * 2, fy - 1 - (k % 2), 2, 1, BRASS[3]);
        this.chest.glint = [x + 4, fy - 10];
    }

    _drawDome(g, env) {
        const {x: cx, r, base} = this.dome, on = env.lampsOn;
        // the water seen through the glass is lighter
        for (let y = base - r; y < base; y++) {
            const hw = Math.round(Math.sqrt(r * r - (base - y) * (base - y)));
            g.blend(cx - hw, y, hw * 2, 1, 0xc8f0f0, 0.22);
        }
        // deck, garden and houses inside
        const deck = base - 6;
        g.rect(cx - r + 4, deck, r * 2 - 8, 6, 0x8a7a68);
        g.rect(cx - r + 4, deck, r * 2 - 8, 1, 0xb8a890);
        for (let x = cx - r + 6; x < cx + r - 6; x += 8)
            g.rect(x, deck + 1, 1, 5, 0x6a5a4a);
        this.deck = deck;
        const houses = [cx - Math.round(r * 0.42), cx + Math.round(r * 0.32)];
        this._nemoTower(g, houses[0], deck, Math.max(26, Math.round(r * 0.2)), Math.max(36, Math.round(r * 0.5)), on);
        this._nemoHall(g, houses[1], deck, Math.max(46, Math.round(r * 0.44)), Math.max(28, Math.round(r * 0.28)), on);
        // garden between the houses with a little tree and flowers
        A.bigTree(g, cx - 4, deck, Math.round(Math.min(18, r * 0.12)), 'summer', 17);
        for (let x = cx - 20; x < cx + 16; x += 3)
            g.px(x, deck - 1 - (x % 2), pick([0xf06080, 0xf0d040, 0xffffff, 0xa060e0]));
        // glass house with plant rows at the far end
        const gx = cx - Math.round(r * 0.82), gw = Math.round(r * 0.22);
        if (gw > 20) {
            for (let y = 0; y < 22; y++) {
                const hw = Math.round(gw / 2 * Math.sqrt(1 - Math.pow(y / 22, 2)));
                g.rect(gx + gw / 2 - hw, deck - y - 1, hw * 2, 1, mix(0xd0f0e0, 0x80b0a0, y / 22));
            }
            for (let x = gx + 3; x < gx + gw - 3; x += 4) {
                g.rect(x, deck - 8, 3, 7, 0x4a9a4a);
                g.px(x + 1, deck - 9, 0xf0d040);
            }
            g.rect(gx, deck - 1, gw, 1, BRASS[1]);
        }
        // fountain and benches
        const fx = cx + Math.round(r * 0.66);
        g.rect(fx - 9, deck - 5, 18, 5, 0xb8b0a0);
        g.rect(fx - 8, deck - 5, 16, 1, 0x6ab0d8);
        g.rect(fx - 1, deck - 13, 2, 8, 0xb8b0a0);
        g.rect(fx - 3, deck - 14, 6, 2, 0xc8c0b0);
        for (const bx of [cx - Math.round(r * 0.2), cx + Math.round(r * 0.12)]) {
            g.rect(bx, deck - 5, 12, 2, 0x8a5a30);
            g.rect(bx, deck - 9, 12, 2, 0x8a5a30);
            g.rect(bx + 1, deck - 3, 1, 3, INK);
            g.rect(bx + 10, deck - 3, 1, 3, INK);
        }
        for (let x = cx - r + 10; x < cx + r - 10; x += randi(14, 30))
            if (Math.abs(x - cx) > 30 && !houses.some(h => Math.abs(h - x) < 28))
                for (let k = 0; k < 4; k++)
                    g.disc(x + (k % 2) * 3, deck - 3 - Math.floor(k / 2) * 3, 3, k % 2 ? 0x4a8a3a : 0x5aa048);
        // lamp posts
        for (const lx of this.lamps) {
            g.rect(lx, deck - 44, 2, 44, INK);
            g.rect(lx - 2, deck - 47, 6, 4, BRASS[2]);
            if (on)
                g.rectE(lx - 1, deck - 46, 4, 2, 0xfff0b0);
        }
        // central column up to the top of the dome
        g.rect(cx + Math.round(r * 0.05) - 2, base - r + 4, 5, r - 4 - 40, BRASS[1]);
        g.rect(cx + Math.round(r * 0.05) - 1, base - r + 4, 1, r - 44, BRASS[3]);
        // brass foundation ring
        g.rect(cx - r - 6, base - 2, r * 2 + 12, 10, BRASS[1]);
        g.rect(cx - r - 6, base - 2, r * 2 + 12, 2, BRASS[3]);
        for (let x = cx - r - 4; x < cx + r + 6; x += 6)
            g.px(x, base + 3, BRASS[4]);
        // airlock on one side
        const al = this.airlock, ax = al.x - 10;
        g.rect(ax - 1, base - 25, 22, 25, INK);
        g.rect(ax, base - 24, 20, 24, BRASS[1]);
        g.rect(ax, base - 24, 20, 2, BRASS[3]);
        g.disc(ax + 10, base - 12, 7, IRON[1]);
        g.disc(ax + 10, base - 12, 5, IRON[2]);
        g.rect(ax + 9, base - 16, 2, 8, BRASS[3]);
    }

    // riveted iron plates with brass bands, shaded like a cylinder
    _rivetedWall(g, x, y, w, h, R, seam = 10) {
        for (let i = 0; i < w; i++) {
            const t = i / (w - 1);
            g.rect(x + i, y, 1, h, R[t < 0.12 || t > 0.9 ? 1 : t > 0.3 && t < 0.5 ? 3 : 2]);
        }
        for (let yy = y + seam; yy < y + h - 3; yy += seam) {
            g.rect(x, yy, w, 1, R[0]);
            for (let xx = x + 2; xx < x + w - 1; xx += 4)
                g.px(xx, yy + 2, BRASS[3]);
        }
        A.outlineRect(g, x - 1, y, w + 2, h);
    }

    _porthole(g, x, y, rr, on, seed) {
        g.disc(x, y, rr + 2, INK);
        g.disc(x, y, rr + 1, BRASS[2]);
        g.px(x - rr, y - 1, BRASS[4]);
        if (on && hash(x, y, seed) < 800) {
            g.disc(x, y, rr, 0xffd890, true);
            g.pxE(x - 1, y - 1, 0xfff4d0);
        } else {
            g.disc(x, y, rr, 0x1a3a50);
            g.px(x - 1, y - 1, 0x8ac0d0);
        }
    }

    _hatch(g, x, base, w, h) {
        g.rect(x - 1, base - h, w + 2, h, INK);
        g.rect(x, base - h + 1, w, h - 1, IRON[1]);
        g.rect(x, base - h + 1, 1, h - 1, IRON[2]);
        for (let i = 0; i < w / 2; i++)
            g.rect(x + i, base - h - Math.round(Math.sqrt(w * w / 4 - (w / 2 - i - 0.5) ** 2) * 0.5) + 1, w - i * 2, 1, IRON[1]);
        g.disc(x + w / 2, base - h / 2, 3, BRASS[2]);
        g.disc(x + w / 2, base - h / 2, 1, IRON[0]);
    }

    // a round iron tower with portholes and a verdigris copper cupola
    _nemoTower(g, hx, deck, w, h, on) {
        const x = Math.round(hx - w / 2), top = deck - h;
        this._rivetedWall(g, x, top, w, h, IRON, 9);
        g.rect(x - 2, top, w + 4, 3, BRASS[2]);
        g.rect(x - 2, top, w + 4, 1, BRASS[4]);
        g.rect(x - 2, deck - 3, w + 4, 3, BRASS[1]);
        for (let y = top + 9; y < deck - 50; y += 14)
            this._porthole(g, hx, y, 3, on, 3);
        for (const sx of [x + 5, x + w - 6])
            this._porthole(g, sx, deck - 44, 2, on, 5);
        // cupola
        const cr = Math.round(w / 2) + 1, PAT = [0x1e4a44, 0x2e6a5e, 0x48907c, 0x70b49a, 0xa8d8c0];
        for (let yy = 0; yy < cr; yy++) {
            const hw = Math.round(Math.sqrt(cr * cr - yy * yy));
            g.rect(hx - hw - 1, top - yy - 1, hw * 2 + 2, 1, INK);
            for (let i = -hw; i < hw; i++) {
                const t = (i + hw) / (2 * hw);
                g.px(hx + i, top - yy - 1, PAT[t < 0.15 ? 1 : t < 0.4 ? 3 : t > 0.85 ? 1 : 2]);
            }
        }
        g.rect(hx - cr - 1, top - cr - 1, cr * 2 + 2, 1, INK);
        for (let i = -cr + 3; i < cr - 2; i += 5)
            g.rect(hx + i, top - Math.round(Math.sqrt(cr * cr - i * i)) + 1, 1, Math.round(Math.sqrt(cr * cr - i * i)) - 1, PAT[1]);
        g.rect(hx - 1, top - cr - 9, 2, 9, BRASS[2]);
        g.disc(hx, top - cr - 10, 2, BRASS[3]);
        this._hatch(g, hx - 8, deck - 3, 16, 34);
    }

    // a long riveted copper hall under a ribbed barrel roof with the big
    // round salon window of the Nautilus
    _nemoHall(g, hx, deck, w, h, on) {
        const x = Math.round(hx - w / 2), top = deck - h;
        this._rivetedWall(g, x, top, w, h, COPPER, 8);
        for (let xx = x + 12; xx < x + w - 6; xx += 14)
            g.rect(xx, top, 1, h, COPPER[0]);
        g.rect(x - 2, deck - 3, w + 4, 3, BRASS[1]);
        // barrel roof
        const rh = Math.round(h * 0.55);
        for (let yy = 0; yy < rh; yy++) {
            const hw = Math.round((w / 2 + 2) * Math.sqrt(1 - (yy / rh) ** 2));
            g.rect(hx - hw - 1, top - yy - 1, hw * 2 + 2, 1, INK);
            g.rect(hx - hw, top - yy - 1, hw * 2, 1, yy > rh * 0.6 ? IRON[3] : IRON[2]);
            for (let i = -hw + 4; i < hw - 2; i += 7)
                g.px(hx + i, top - yy - 1, BRASS[2]);
        }
        g.rect(x - 3, top - 1, w + 6, 2, BRASS[2]);
        g.rect(x - 3, top - 1, w + 6, 1, BRASS[4]);
        // salon window
        const wr = Math.max(6, Math.round(h * 0.3)), wx = hx + Math.round(w * 0.12), wy = top + Math.round(h * 0.45);
        g.disc(wx, wy, wr + 3, INK);
        g.disc(wx, wy, wr + 2, BRASS[2]);
        for (let a = 0; a < 12; a++)
            g.px(Math.round(wx + Math.cos(a * 0.52) * (wr + 1.5)), Math.round(wy + Math.sin(a * 0.52) * (wr + 1.5)), BRASS[4]);
        g.disc(wx, wy, wr, on ? 0xffc870 : 0x1a3a50, on);
        if (!on) {
            g.blend(wx - wr + 2, wy - wr + 2, wr, 2, 0x8ac0d0, 0.6);
        }
        g.rect(wx - wr, wy, wr * 2 + 1, 1, BRASS[1]);
        g.rect(wx, wy - wr, 1, wr * 2 + 1, BRASS[1]);
        // small portholes, door, pipe with a vent and a pressure gauge
        this._porthole(g, x + w - 7, top + 8, 2, on, 7);
        this._hatch(g, x + 6, deck - 3, 16, 34);
        const px = x + w - 4;
        g.rect(px - 1, top - rh - 8, 4, h + rh + 5, INK);
        g.rect(px, top - rh - 7, 2, h + rh + 4, BRASS[2]);
        g.px(px, top - rh - 7, BRASS[4]);
        g.rect(px - 3, top - rh - 11, 8, 4, INK);
        g.rect(px - 2, top - rh - 10, 6, 2, BRASS[3]);
        g.disc(x + 22, top + 7, 3, INK);
        g.disc(x + 22, top + 7, 2, 0xe8e0c8);
        g.px(x + 23, top + 6, INK);
    }

    _drawTower(g, env) {
        const tw = this.tower, base = this.dome.base;
        g.rect(tw.x - 7, tw.top, 14, base - tw.top, INK);
        g.rect(tw.x - 6, tw.top + 1, 12, base - tw.top - 1, BRASS[1]);
        g.rect(tw.x - 6, tw.top + 1, 3, base - tw.top - 1, BRASS[2]);
        for (let y = tw.top + 10; y < base; y += 16) {
            g.rect(tw.x - 7, y, 14, 2, BRASS[0]);
            g.disc(tw.x, y + 8, 2, env.lampsOn ? 0xffd890 : 0x1a2a3a, env.lampsOn);
        }
        // docking arm with a hatch
        const ay = tw.top + 14, ax = tw.side > 0 ? tw.x + 7 : tw.x - 25;
        g.rect(ax, ay, 18, 8, INK);
        g.rect(ax + 1, ay + 1, 16, 6, BRASS[2]);
        g.rect(ax + 1, ay + 1, 16, 1, BRASS[4]);
        g.rect(tw.x - 9, tw.top - 6, 18, 6, BRASS[2]);
        g.rect(tw.x - 9, tw.top - 6, 18, 1, BRASS[4]);
        g.rect(tw.x - 1, tw.top - 14, 2, 8, INK);
    }

    // ---------- events ----------

    trigger(name, env, ctx, anywhere = false) {
        const W = this.w, H = this.h;
        if (name === 'sub') {
            if (this.sub)
                return;
            const docked = anywhere && chance(0.5);
            const dock = docked || (!anywhere && chance(0.6));
            // a cruising sub is far behind the dome, so it is drawn smaller
            const L = dock ? randi(170, 210) : randi(100, 130);
            const f = subSprite(L);
            const dir = dock ? -this.tower.side : chance(0.5) ? 1 : -1;
            const sub = {f, L, dir, x: dir > 0 ? -f.w - 20 : W + 20, y: dock ? this.tower.dock.y + 18 : Math.round(H * rand(0.22, 0.5)), v: rand(dock ? 10 : 6, dock ? 16 : 10), state: dock ? 'approach' : 'cruise', t: 0, prop: 0};
            if (docked) {
                sub.state = 'dock';
                sub.timer = rand(30, 120);
                this._placeDocked(sub);
            } else if (anywhere) {
                // already under way: cruising, never halfway into the dome
                sub.state = 'cruise';
                sub.y = Math.round(H * rand(0.18, 0.34));
                sub.x = rand(0, W - f.w);
            }
            this.sub = sub;
        } else if (name === 'merfolk') {
            if (this.merfolk.length < 3 && !this.kraken)
                this._mer(env);
        } else if (name === 'diver') {
            if (this.divers.length < 2 && !this.kraken)
                this._diver();
        } else if (name === 'school') {
            this._school(false);
        } else if (name === 'turtle' || name === 'shark' || name === 'manta' || name === 'grouper') {
            const dir = chance(0.5) ? 1 : -1;
            this.big.push({kind: name, dir, x: dir > 0 ? -70 : W + 10, y: H * rand(0.18, 0.7), v: {turtle: 12, shark: 18, manta: 14, grouper: 8}[name] * rand(0.8, 1.2), t: rand(5)});
        } else if (name === 'whale') {
            if (!this.whale)
                this.whale = {dir: chance(0.5) ? 1 : -1, y: H * rand(0.2, 0.4), t: 0};
            this.whale.x = this.whale.dir > 0 ? -260 : W + 20;
        } else if (name === 'jelly') {
            for (let i = 0; i < randi(1, 4); i++)
                this._jelly(false);
        } else if (name === 'boat') {
            if (!this.boat)
                this.boat = {dir: chance(0.5) ? 1 : -1, x: 0, w: randi(60, 110)};
            this.boat.x = this.boat.dir > 0 ? -this.boat.w : W;
        } else if (name === 'crab') {
            this._crab(false);
        } else if (name === 'kraken') {
            if (!this.kraken)
                this._kraken(ctx, anywhere);
        }
    }

    _placeDocked(sub) {
        const d = this.tower.dock;
        sub.x = sub.dir > 0 ? d.x - sub.f.w + 4 : d.x - 4;
        sub.y = d.y + 18;
    }

    // mode 'pass' swims by in open water, 'perch' settles on the dome
    _kraken(mode, anywhere) {
        const W = this.w, H = this.h, {x: cx, r, base} = this.dome;
        mode = mode || (chance(0.5) ? 'perch' : 'pass');
        let M = clamp(Math.round(r * 0.42), 36, 90);
        M = Math.max(24, Math.round(Math.min(M, (base - r - this.surfY - 12) / 1.3)));
        const Wm = Math.round(M * 0.34), H0 = Math.round(M * 0.3), L = Math.round(M * 1.9);
        const dir = chance(0.5) ? 1 : -1;
        const k = {mode, dir, M, Wm, H0, L, t: rand(10), jet: 0, drape: 0, blink: 0, state: 'swim',
            theta: dir > 0 ? 0 : -Math.PI, x: dir > 0 ? -M - 20 : W + M + 20, y: H * rand(0.2, 0.42)};
        if (mode === 'perch') {
            k.px = cx + rand(-0.08, 0.08) * r;
            k.y = base - Math.sqrt(r * r - (k.px - cx) ** 2) - H0 - 1;
        }
        if (anywhere && mode === 'perch') {
            k.x = k.px;
            k.state = 'sit';
            k.drape = 1;
            k.theta = -Math.PI / 2;
            k.timer = rand(14, 26);
        } else if (anywhere) {
            k.x = rand(W * 0.2, W * 0.8);
        }
        this.kraken = k;
    }

    _school(anywhere) {
        const W = this.w, H = this.h, dir = chance(0.5) ? 1 : -1;
        const kind = weighted([['sardine', 4], ['tang', 2], ['clown', 1.5], ['blue', 2], ['snapper', 1.5], ['angel', 1]]);
        const n = kind === 'sardine' ? randi(12, 26) : randi(3, 9);
        const s = {kind, dir, x: anywhere ? rand(0, W) : dir > 0 ? -60 : W + 60, y: H * rand(0.15, 0.75), v: rand(10, 22), t: 0, members: []};
        for (let i = 0; i < n; i++)
            s.members.push({dx: rand(-30, 30) * (kind === 'sardine' ? 1.4 : 1), dy: rand(-14, 14), ph: rand(6.28)});
        this.schools.push(s);
    }

    _crab(anywhere) {
        const W = this.w;
        const dir = chance(0.5) ? 1 : -1;
        this.crabs.push({x: anywhere ? rand(0, W) : dir > 0 ? -12 : W + 2, dir, v: rand(6, 12), t: rand(5), pause: 0});
    }

    _jelly(anywhere) {
        const W = this.w, H = this.h;
        this.jellies.push({x: rand(20, W - 20), y: anywhere ? rand(this.surfY + 30, H * 0.8) : H * 0.85, r: randi(5, 10), c: pick([0xf0a0d0, 0xb0a0ff, 0xa0e0ff, 0xffc0a0]), t: rand(6.28), vx: rand(-2, 2)});
    }

    _mer() {
        const W = this.w, tail = chance(0.6);
        const m = {id: randi(0, 1e9), tail, skin: tail ? pick([...SKINS, 0x9ad0c0, 0xa8c8e8]) : pick(FISHFOLK)};
        m.body = tail ? pick(MER_TAILS) : mix(m.skin, 0x204040, 0.2);
        m.hair = pick(MER_HAIR);
        m.top = pick([0xf0a0c0, 0xf0e0c0, 0xa0d0f0, 0xd0a0f0]);
        m.fin = tail ? m.body : pick([0xd05a8a, 0xe0a030, 0x40c0c0, 0x8a5ad0]);
        // only the tails glow at night, fishfolk legs never do
        m.glow = tail && chance(0.5) ? pick([0x80f0ff, 0xc0a0ff, 0xa0ffc0]) : 0;
        const prey = pick(this.schools.filter(s => !s.far && !s.hunted && s.x > 0 && s.x < W && s.members.length > 2));
        const act = weighted([['wave', 3], ['hunt', prey ? 3 : 0], ['knock', 1.5], ['peek', 2], ['deliver', 1.5], ['ride', 1], ['music', 1], ['play', 1]]);
        const from = chance(0.5) ? -1 : 1;
        const o = {m, act, x: from < 0 ? -40 : W + 10, y: this.dome.base - this.dome.r * rand(0.5, 1.4), dir: -from, t: 0, state: 'go', frame: 0};
        if (act === 'hunt') {
            // come in from behind the school
            o.state = 'hunt';
            o.prey = prey;
            prey.hunted = true;
            o.x = prey.dir > 0 ? -40 : W + 10;
            o.y = prey.y + rand(-30, 30);
            o.dir = prey.dir;
        } else if (act === 'ride' || act === 'play') {
            o.state = 'pass';
            o.y = rand(0.15, 0.55) * this.h;
        } else if (act === 'deliver') {
            o.target = [this.airlock.x + (this.airlock.x < this.dome.x ? -24 : 24), this.dome.base - 16];
        } else {
            // a spot just outside the glass
            const e = rand(0.3, 1.15), side = chance(0.5) ? -1 : 1;
            const rr = this.dome.r + (act === 'peek' || act === 'knock' ? 5 : 10);
            o.target = [this.dome.x + side * Math.cos(e) * rr, this.dome.base - Math.sin(e) * rr + 16];
            o.side = side;
        }
        this.merfolk.push(o);
    }

    _diver() {
        const al = this.airlock, out = al.x < this.dome.x ? -1 : 1;
        this.divers.push({x: al.x - 6, dir: out, t: 0, state: 'out', goal: al.x + out * rand(40, 200), timer: rand(10, 30), bub: rand(1, 3)});
    }

    // ---------- update ----------

    update(dt, real, env) {
        const W = this.w, H = this.h;
        this.t += real;
        const crowd = Math.round(this.peopleBase * env.people);
        if (this.people.length !== crowd)
            this.people = this.allPeople.slice(0, crowd);
        this.timers.run(real);
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(10, 35);
            this.trigger(weighted([['school', 5], ['turtle', 1.2], ['shark', 0.4], ['manta', 0.6], ['grouper', 1], ['whale', 0.25], ['jelly', 1.5], ['boat', 0.6 * env.traffic], ['crab', 1], ['diver', (env.dark > 0.7 ? 0.3 : 1) * env.people]]), env);
        }
        this.merTimer -= real;
        if (this.merTimer <= 0) {
            this.merTimer = rand(40, 120) / Math.max(1, env.people);
            if (chance(env.people))
                this.trigger('merfolk', env);
        }
        this.subTimer -= real;
        if (this.subTimer <= 0) {
            this.subTimer = rand(120, 400) / Math.max(1, env.traffic);
            if (chance(env.traffic))
                this.trigger('sub', env);
        }
        this.diverTimer -= real;
        if (this.diverTimer <= 0) {
            this.diverTimer = rand(60, 200) / Math.max(1, env.people);
            if ((env.dark < 0.8 || chance(0.3)) && chance(env.people))
                this.trigger('diver', env);
        }
        for (const s of this.schools) {
            s.t += real * (s.flee ? 2 : 1);
            s.x += s.dir * s.v * real;
            s.y += Math.sin(s.t * 0.3) * real * 3;
        }
        this.schools = this.schools.filter(s => s.x > -120 && s.x < W + 120);
        if (this.schools.length < 2 && chance(real / 8))
            this._school(false);
        for (const b of this.big) {
            b.t += real;
            b.x += b.dir * b.v * real;
            b.y += Math.sin(b.t * 0.4) * real * 2;
        }
        this.big = this.big.filter(b => b.x > -90 && b.x < W + 90);
        if (this.whale) {
            this.whale.t += real;
            this.whale.x += this.whale.dir * 7 * real;
            if (this.whale.x < -300 || this.whale.x > W + 60)
                this.whale = null;
        }
        for (const j of this.jellies) {
            j.t += real;
            const pulse = Math.max(0, Math.sin(j.t * 1.8));
            j.y -= (2 + pulse * 7) * real;
            j.x += j.vx * real;
        }
        this.jellies = this.jellies.filter(j => j.y > this.surfY + 8);
        for (const c of this.crabs) {
            c.t += real;
            if (c.pause > 0) {
                c.pause -= real;
            } else {
                c.x += c.dir * c.v * real;
                // the dome is in the way
                const dd = c.x + 5 - this.dome.x, edge = this.dome.r + 12;
                if (Math.abs(dd) < edge && Math.abs(dd) > edge - 4 && Math.sign(dd) === -c.dir)
                    c.dir = -c.dir;
                if (chance(real / 4))
                    c.pause = rand(1, 5);
            }
        }
        this.crabs = this.crabs.filter(c => c.x > -20 && c.x < W + 20);
        if (this.octo) {
            const o = this.octo;
            o.t += real;
            o.timer -= real;
            if (o.timer <= 0) {
                o.timer = rand(15, 50);
                o.c = pick([0xd86a4a, 0x9a5ab0, 0xe08a6a, 0x8a8a6a, 0xc84040]);
            }
        }
        for (const h of this.horses)
            h.t += real;
        this.krakenTimer -= real;
        if (this.krakenTimer <= 0 && !this.kraken) {
            this.krakenTimer = rand(300, 720);
            this.trigger('kraken', env);
        }
        this._updateKraken(real);
        this._updateSub(real, env);
        this._updateMer(real, env);
        this._updateDivers(real);
        this._updatePeople(real);
        // bubbles from vents, the wreck and the chest
        if (chance(real * 0.8)) {
            const x = pick(this.vents);
            for (let i = 0; i < randi(1, 4); i++)
                this.bubbles.push({x: x + rand(-2, 2), y: this.floorAt(x) - i * 4, r: chance(0.3) ? 2 : 1, v: rand(14, 24), p: rand(6)});
        }
        for (const b of this.bubbles) {
            b.y -= b.v * real;
            b.p += real * 3;
        }
        this.bubbles = this.bubbles.filter(b => b.y > this.surfY + 2);
        for (const s of this.snow) {
            s.y += s.v * real;
            s.x += Math.sin(this.t * 0.3 + s.p) * real * 2;
            if (s.y > H) {
                s.y = this.surfY;
                s.x = rand(W);
            }
        }
        for (const n of this.notes) {
            n.y -= 9 * real;
            n.x += Math.sin(n.y * 0.2) * real * 6;
            n.life -= real;
        }
        this.notes = this.notes.filter(n => n.life > 0);
        if (this.boat) {
            this.boat.x += this.boat.dir * 18 * real;
            if (this.boat.x < -this.boat.w - 10 || this.boat.x > W + 10)
                this.boat = null;
        }
        const rain = env.weather.v.rain;
        if (rain > 0.15 && !this._iced(env))
            for (let i = 0; i < W * rain * real * 0.5; i++)
                this.splashes.push({x: rand(W), life: 0.4});
        for (const s of this.splashes)
            s.life -= real;
        this.splashes = this.splashes.filter(s => s.life > 0);
    }

    _updateKraken(real) {
        for (const p of this.ink) {
            p.r += p.g * real;
            p.life -= real * 0.16;
        }
        this.ink = this.ink.filter(p => p.life > 0);
        const k = this.kraken;
        if (!k)
            return;
        const W = this.w, {x: cx, r} = this.dome;
        k.t += real;
        // jet pulses: the mantle squeezes and the body shoots forward
        k.jet = Math.pow(Math.max(0, Math.sin(k.t * 1.6)), 2);
        if (k.blink > 0)
            k.blink -= real;
        else if (chance(real / 4))
            k.blink = 0.18;
        const ease = u => u * u * (3 - 2 * u);
        if (k.state === 'swim') {
            const v = 14 * (0.35 + 1.3 * k.jet);
            if (k.mode === 'perch') {
                const dx = k.px - k.x;
                k.x += Math.sign(dx) * Math.min(Math.abs(dx), Math.max(3, Math.min(v, Math.abs(dx) * 0.2)) * real);
                if (Math.abs(dx) < 0.5) {
                    k.state = 'settle';
                    k.st = 0;
                    k.th0 = k.theta;
                }
            } else {
                k.x += k.dir * v * real;
                k.y += Math.sin(k.t * 0.3) * real * 3;
                if (k.x < -k.M - k.L - 40 || k.x > W + k.M + k.L + 40)
                    this.kraken = null;
            }
        } else if (k.state === 'settle') {
            k.st += real;
            const u = Math.min(1, k.st / 3);
            k.drape = ease(u);
            k.theta = k.th0 + (-Math.PI / 2 - k.th0) * k.drape;
            if (u >= 1) {
                k.state = 'sit';
                k.timer = rand(14, 26);
                this._krakenLands();
            }
        } else if (k.state === 'sit') {
            k.timer -= real;
            k.theta = -Math.PI / 2 + Math.sin(k.t * 0.5) * 0.06;
            // now and then an arm tip taps on the glass
            if (chance(real / 3)) {
                const a = Math.PI / 2 + (chance(0.5) ? 1 : -1) * rand(0.4, 0.8);
                this.notes.push({x: cx + Math.cos(a) * r, y: this.dome.base - Math.sin(a) * r, life: 0.6, ring: true});
            }
            if (k.timer <= 0) {
                k.state = 'rise';
                k.st = 0;
                k.dir = chance(0.5) ? 1 : -1;
                k.th1 = k.dir > 0 ? 0 : -Math.PI;
                for (let i = 0; i < 7; i++)
                    this.ink.push({x: k.x + rand(-k.Wm, k.Wm), y: k.y - rand(0, k.M * 0.6), r: rand(4, 8), g: rand(5, 10), life: 1});
            }
        } else if (k.state === 'rise') {
            k.st += real;
            const u = Math.min(1, k.st / 2.5);
            k.drape = 1 - ease(u);
            k.theta = -Math.PI / 2 + (k.th1 + Math.PI / 2) * ease(u);
            k.y -= real * 6;
            if (u >= 1) {
                k.state = 'swim';
                k.mode = 'pass';
            }
        }
        // fish flee, divers head home, merfolk swim off
        for (const s of this.schools)
            if (!s.flee && Math.hypot(s.x - k.x, s.y - k.y) < k.M * 2) {
                s.flee = true;
                s.v = Math.max(s.v, 32);
                s.dir = s.x > k.x ? 1 : -1;
            }
        for (const d of this.divers)
            if (d.state !== 'back') {
                d.state = 'back';
                d.walking = true;
            }
        for (const o of this.merfolk)
            if (o.state === 'go' || o.state === 'act') {
                o.state = 'leave';
                o.dir = o.x < this.dome.x ? -1 : 1;
            }
    }

    // people inside hurry away from under the creature
    _krakenLands() {
        const {x: cx, r} = this.dome;
        for (const p of this.people) {
            p.goal = clamp(cx + (p.x < cx ? -1 : 1) * r * rand(0.6, 0.76), cx - r * 0.78, cx + r * 0.75);
            p.state = 'walk';
            p.wave = rand(6, 14);
            p.scared = true;
        }
    }

    _iced(env) {
        return env.season === 'winter' && env.weather.snowCover > 0.2;
    }

    _updateSub(real) {
        const s = this.sub;
        if (!s)
            return;
        const W = this.w;
        s.t += real;
        s.prop += real * (s.state === 'dock' ? 0 : 10);
        if (s.state === 'cruise') {
            s.x += s.dir * s.v * real;
            if (s.x < -s.f.w - 40 || s.x > W + 40)
                this.sub = null;
        } else if (s.state === 'approach') {
            const d = this.tower.dock;
            const tx = s.dir > 0 ? d.x - s.f.w + 4 : d.x - 4;
            const dx = tx - s.x;
            s.x += Math.sign(dx) * Math.min(Math.abs(dx), Math.max(1.5, Math.min(s.v, Math.abs(dx) * 0.08)) * real);
            if (Math.abs(dx) < 0.5) {
                s.state = 'dock';
                s.timer = rand(60, 200);
                this._placeDocked(s);
            }
        } else if (s.state === 'dock') {
            s.timer -= real;
            if (s.timer <= 0) {
                s.state = 'leave';
                s.dir = -s.dir;
                s.v = 0;
            }
        } else {
            s.v = Math.min(14, s.v + real * 1.5);
            s.x += s.dir * s.v * real;
            s.y -= real * 1.5;
            if (s.x < -s.f.w - 40 || s.x > W + 40)
                this.sub = null;
        }
        if (s.state !== 'dock' && chance(real * 4)) {
            const px = s.dir > 0 ? s.x + 2 : s.x + s.f.w - 2;
            this.bubbles.push({x: px, y: s.y - 17 + rand(-3, 3), r: 1, v: rand(10, 16), p: rand(6)});
        }
    }

    _updateMer(real) {
        const W = this.w;
        for (const o of this.merfolk) {
            o.t += real;
            const swimFrame = Math.floor(o.t * 4) % 3;
            if (o.state === 'pass') {
                o.x += o.dir * 22 * real;
                o.y += Math.sin(o.t * 0.8) * real * 4;
                o.frame = swimFrame;
                if (o.act === 'music' && chance(real * 1.2))
                    this.notes.push({x: o.x + 16, y: o.y - 10, life: 3});
                if (o.x < -60 || o.x > W + 60)
                    o.done = true;
            } else if (o.state === 'hunt') {
                // chase the school; it scatters and flees, sometimes one is caught
                const s = o.prey, gone = !this.schools.includes(s);
                const dx = s.x - o.x, dy = s.y - o.y, d = Math.hypot(dx, dy);
                if (!gone && d < 50 && !s.flee) {
                    s.flee = true;
                    s.v = Math.max(s.v, 30);
                    s.dir = dx > 0 ? 1 : -1;
                }
                if (gone || d < 8 || o.t > 16) {
                    if (!gone && d < 8 && s.members.length > 1 && chance(0.6)) {
                        s.members.splice(randi(0, s.members.length - 1), 1);
                        o.caught = s.kind;
                    }
                    s.hunted = false;
                    o.state = 'leave';
                } else {
                    const v = 38;
                    o.x += dx / d * v * real;
                    o.y += dy / d * v * real;
                    o.dir = dx > 0 ? 1 : -1;
                    o.frame = Math.floor(o.t * 7) % 3;
                }
            } else if (o.state === 'go') {
                const [tx, ty] = o.target;
                const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
                if (d < 2) {
                    o.state = 'act';
                    o.t = 0;
                    o.timer = o.act === 'deliver' ? 4 : rand(8, 16);
                    if (o.act === 'wave' || o.act === 'peek' || o.act === 'knock')
                        this._callPerson(tx);
                } else {
                    const v = Math.min(26, 6 + d * 0.4);
                    o.x += dx / d * v * real;
                    o.y += dy / d * v * real;
                    if (Math.abs(dx) > 3)
                        o.dir = dx > 0 ? 1 : -1;
                    o.frame = swimFrame;
                }
            } else if (o.state === 'act') {
                o.timer -= real;
                const a = o.act;
                o.frame = a === 'wave' ? 1 + Math.floor(o.t * 4) % 2 : a === 'knock' ? (Math.floor(o.t * 3) % 3 === 0 ? 2 : 1) : 0;
                if (a === 'knock' && Math.floor(o.t * 3) % 3 === 0 && Math.floor((o.t - real) * 3) % 3 !== 0)
                    this.notes.push({x: o.x + (o.side > 0 ? -3 : 15), y: o.y - 26, life: 0.6, ring: true});
                if (a === 'music' && chance(real * 1.5))
                    this.notes.push({x: o.x + 8, y: o.y - 30, life: 3});
                if (a === 'deliver' && o.t > 2 && !o.dropped) {
                    o.dropped = true;
                    this.bubbles.push({x: o.x + 6, y: o.y - 20, r: 2, v: 10, p: 0});
                }
                if (o.timer <= 0) {
                    o.state = 'leave';
                    o.dir = o.x < this.dome.x ? -1 : 1;
                }
            } else {
                o.x += o.dir * 24 * real;
                o.y -= real * 6;
                o.frame = swimFrame;
                if (o.x < -60 || o.x > W + 60)
                    o.done = true;
            }
        }
        this.merfolk = this.merfolk.filter(o => !o.done);
    }

    // somebody inside walks to the glass and looks or waves back
    _callPerson(x) {
        const r = this.dome.r;
        const tx = clamp(x, this.dome.x - r * 0.78, this.dome.x + r * 0.78);
        let best = null;
        for (const p of this.people)
            if (!p.goal && (!best || Math.abs(p.x - tx) < Math.abs(best.x - tx)))
                best = p;
        if (best) {
            best.goal = tx;
            best.state = 'walk';
            best.wave = rand(5, 10);
        }
    }

    _updatePeople(real) {
        const r = this.dome.r, cx = this.dome.x;
        for (const p of this.people) {
            p.t += real;
            if (p.goal !== undefined && p.goal !== null) {
                const dx = p.goal - p.x;
                if (Math.abs(dx) < 1) {
                    p.state = 'idle';
                    p.wave -= real;
                    if (p.wave <= 0) {
                        p.goal = null;
                        p.scared = false;
                        p.state = 'walk';
                    }
                } else {
                    p.dir = dx > 0 ? 1 : -1;
                    p.x += p.dir * Math.min(Math.abs(dx), p.speed * (p.scared ? 1.5 : 0.6) * real);
                }
                continue;
            }
            p.timer -= real;
            if (p.timer <= 0) {
                p.timer = rand(2, 9);
                p.state = chance(0.35) ? 'idle' : 'walk';
                if (chance(0.4))
                    p.dir = -p.dir;
            }
            if (p.state === 'walk') {
                p.x += p.dir * p.speed * 0.5 * real;
                if (p.x < cx - r * 0.8 || p.x > cx + r * 0.75) {
                    p.dir = -p.dir;
                    p.x = clamp(p.x, cx - r * 0.8, cx + r * 0.75);
                }
            }
        }
    }

    _updateDivers(real) {
        const al = this.airlock;
        for (const d of this.divers) {
            d.t += real;
            d.bub -= real;
            if (d.bub <= 0) {
                d.bub = rand(2, 4);
                for (let i = 0; i < randi(2, 4); i++)
                    this.bubbles.push({x: d.x + (d.dir > 0 ? 9 : 11) + rand(-1, 1), y: this.floorAt(d.x) - 30 - i * 3, r: i ? 1 : 2, v: rand(14, 20), p: rand(6)});
            }
            if (d.state === 'out' || d.state === 'back') {
                const goal = d.state === 'out' ? d.goal : al.x - 6;
                const dx = goal - d.x;
                d.dir = dx > 0 ? 1 : -1;
                d.x += d.dir * Math.min(Math.abs(dx), 6 * real);
                d.walking = true;
                if (Math.abs(dx) < 0.5) {
                    if (d.state === 'out') {
                        d.state = 'look';
                        d.walking = false;
                    } else {
                        d.done = true;
                    }
                }
            } else {
                d.timer -= real;
                if (d.timer <= 0)
                    d.state = 'back';
            }
        }
        this.divers = this.divers.filter(d => !d.done);
    }

    // ---------- render ----------

    renderDynamic(g, env) {
        const t = this.t, W = this.w, H = this.h;
        const day = (1 - env.dark) * (1 - env.weather.v.clouds * 0.5) * (this._iced(env) ? 0.4 : 1);
        if (this.whale)
            this._renderWhale(g, this.whale);
        // far schools and a cruising sub pass behind the dome
        for (const s of this.schools)
            if (s.far)
                this._renderSchool(g, s, env);
        if (this.sub?.state === 'cruise')
            this._renderSub(g, this.sub, env);
        g.compose(this.layerB, 0, H, true);
        this._renderCaustics(g, day);
        // god rays from the surface
        if (day > 0.05) {
            for (let k = 0; k < 7; k++) {
                const x0 = ((k * 0.17 + 0.05) * W + Math.sin(t * 0.07 + k * 2) * 40) % W;
                const w = 14 + (k * 37 % 30), slope = 0.28;
                const a = day * (0.05 + 0.03 * Math.sin(t * 0.3 + k * 1.7));
                for (let y = this.surfY; y < this.dome.base; y += 2) {
                    const f = 1 - (y - this.surfY) / (this.dome.base - this.surfY);
                    g.add(x0 + (y - this.surfY) * slope, y, w, 2, 0xb0f0ff, a * f);
                }
            }
        }
        this._renderKelp(g, env);
        if (this.octo) {
            const o = this.octo;
            const fy = this.floorAt(o.x);
            drawFigure(g, octoSprite(o.c, Math.floor(o.t * 1.5) % 2), o.x - 8, fy - 6);
        }
        for (const a of this.anemones)
            this._renderAnemone(g, a);
        for (const c of this.crabs)
            drawFigure(g, crabSprite(c.pause > 0 ? 0 : Math.floor(c.t * 8) % 2), c.x, this.floorAt(c.x) + 3);
        for (const h of this.horses) {
            const x = h.k.x + 6, y = this.floorAt(h.k.x) - h.k.h * h.dy + Math.sin(h.t * 0.9) * 4;
            drawFigure(g, seahorseSprite(), x, y);
        }
        // people inside, then the glass on top
        // they live in air under the glass, so no helmets in here
        for (const p of this.people) {
            const waving = p.goal !== null && p.goal !== undefined && p.state === 'idle' && !p.scared;
            if (waving)
                drawFigure(g, personFigure(p, Math.floor(t * 4) % 2 ? 4 : 0, 'down'), p.x, this.deck);
            else
                drawPerson(g, p, p.x, this.deck, p.dir, env);
        }
        if (this.kraken?.drape > 0)
            this._renderKrakenShadow(g, this.kraken);
        if (env.lampsOn) {
            for (const lx of this.lamps)
                g.glow(lx + 1, this.deck - 45, 16, 0xffd890, 0.25);
            // warm light inside the glass, strongest near the deck
            const {x: cx, r, base} = this.dome;
            for (let y = base - r + 2; y < this.deck; y += 2) {
                const hw = Math.sqrt(r * r - (base - y) * (base - y)) - 2;
                const f = Math.pow(1 - (this.deck - y) / r, 2);
                g.add(cx - hw, y, hw * 2, 2, 0xffc880, 0.1 * Math.ceil(f * 4) / 4);
            }
        }
        this._renderGlass(g, env);
        for (const d of this.divers)
            this._renderDiver(g, d, env);
        // docking subs come in from the open side of the tower
        if (this.sub && this.sub.state !== 'cruise')
            this._renderSub(g, this.sub, env);
        for (const b of this.big)
            this._renderBig(g, b, env);
        for (const s of this.schools)
            if (!s.far)
                this._renderSchool(g, s, env);
        for (const o of this.merfolk)
            this._renderMer(g, o, env);
        if (this.kraken)
            this._renderKraken(g, this.kraken, env);
        for (const p of this.ink)
            this._renderInk(g, p);
        for (const j of this.jellies)
            this._renderJelly(g, j, env);
        if (env.dark > 0.6)
            this._renderAngler(g, env);
        // chest glint
        if (this.chest.glint && Math.sin(t * 1.3) > 0.9) {
            const [gx, gy] = this.chest.glint;
            g.pxE(gx, gy, 0xffffff);
            g.pxE(gx - 1, gy, 0xfff0a0);
            g.pxE(gx + 1, gy, 0xfff0a0);
            g.pxE(gx, gy - 1, 0xfff0a0);
            g.pxE(gx, gy + 1, 0xfff0a0);
        }
        // tower beacon
        if ((t % 2.5) < 0.3) {
            const [bx, by] = this.tower.beacon;
            g.pxE(bx, by, 0xff5040);
            g.glow(bx + 0.5, by + 0.5, 6, 0xff5040, 0.4);
        }
        for (const b of this.bubbles) {
            const x = b.x + Math.sin(b.p) * 1.5;
            if (b.r > 1) {
                g.blend(x - 1, b.y - 1, 3, 3, 0xd8f8ff, 0.35);
                g.px(x, b.y - 1, 0xf0ffff);
            } else {
                g.blend(x, b.y, 1, 1, 0xe8ffff, 0.6);
            }
        }
        for (const n of this.notes) {
            if (n.ring) {
                g.blend(n.x - 2, n.y - 2, 5, 5, 0xe0ffff, n.life);
                continue;
            }
            const a = Math.min(1, n.life);
            g.blend(n.x, n.y, 1, 4, 0xfff0c0, a, true);
            g.blend(n.x - 2, n.y + 3, 2, 2, 0xfff0c0, a, true);
            g.blend(n.x + 1, n.y, 2, 1, 0xfff0c0, a, true);
        }
        // drifting particles; at night some of them glow
        for (const s of this.snow) {
            if (s.glow && env.dark > 0.5) {
                const b = 0.5 + 0.5 * Math.sin(t * 2 + s.p * 3);
                if (b > 0.6)
                    g.blend(s.x, s.y, 1, 1, 0x80fff0, b * env.dark, true);
            } else {
                g.blend(s.x, s.y, 1, 1, 0xd0f0f0, 0.25);
            }
        }
        this._renderSurface(g, env);
    }

    _renderCaustics(g, day) {
        if (day < 0.1)
            return;
        const W = this.w, H = this.h, t = this.t, ca = this.ca, cb = this.cb;
        const o1 = Math.floor(t * 9), o2 = Math.floor(t * 6), a = 0.12 * day;
        for (let y = this.floorAt(0) - 10; y < H; y += 2) {
            for (let x = 0; x < W; x += 3) {
                if (y < this.floor[x])
                    continue;
                const v = ca[(x + o1 + y * 2) & 1023] + cb[(x * 2 - o2 - y * 3 + 4096) & 1023];
                if (v > 1.15)
                    g.add(x, y, 3, 1, 0xfff8d0, a);
            }
        }
    }

    _renderKelp(g, env) {
        const t = this.t;
        for (const k of this.kelp) {
            const fy = this.floorAt(k.x) + 2;
            const dark = mix(k.c, 0x0a2018, 0.4);
            let px = k.x, py = fy;
            for (let i = 0; i < k.h; i += 2) {
                const u = i / k.h;
                const x = k.x + Math.sin(t * 0.7 + k.ph + i * 0.035) * 9 * u + Math.sin(t * 1.3 + i * 0.1) * u * 2;
                const y = fy - i;
                g.rect(x, y - 2, 2, 2, i % 6 === 0 ? dark : k.c);
                if (i % 8 === 4) {
                    const s = (i / 8) % 2 ? 1 : -1;
                    g.rect(s > 0 ? x + 2 : x - 4, y - 3, 4, 2, mix(k.c, 0xd0e060, 0.2));
                    g.px(s > 0 ? x + 6 : x - 5, y - 4, mix(k.c, 0xd0e060, 0.3));
                }
                px = x;
                py = y;
            }
            g.rect(px - 1, py - 4, 4, 3, mix(k.c, 0xe0e070, 0.3));
        }
    }

    _renderAnemone(g, a) {
        const fy = this.floorAt(a.x) + 2;
        g.rect(a.x - 4, fy - 4, 9, 4, mix(a.c, 0x301020, 0.4));
        for (let k = 0; k < 7; k++) {
            const bx = a.x - 4 + k * 1.4;
            for (let i = 0; i < 8; i++) {
                const off = Math.sin(this.t * 1.5 + a.ph + k + i * 0.4) * i * 0.3 + (k - 3) * i * 0.15;
                g.px(bx + off, fy - 4 - i, i > 5 ? mix(a.c, 0xffffff, 0.4) : a.c);
            }
        }
    }

    _renderGlass(g, env) {
        const {x: cx, r, base} = this.dome;
        const rib = BRASS[2], dk = BRASS[1];
        // meridians and latitude rings of the frame
        for (const ph of [-1.2, -0.75, -0.3, 0.3, 0.75, 1.2]) {
            const sp = Math.sin(ph);
            let lx = null, ly = null;
            for (let e = 0; e <= Math.PI / 2 + 0.01; e += 0.04) {
                const x = Math.round(cx + r * Math.cos(e) * sp), y = Math.round(base - r * Math.sin(e));
                if (lx !== null)
                    g.line(lx, ly, x, y, rib);
                lx = x;
                ly = y;
            }
        }
        for (const e of [0.35, 0.75, 1.15]) {
            const y = Math.round(base - r * Math.sin(e)), hw = Math.round(r * Math.cos(e));
            g.rect(cx - hw, y, hw * 2, 1, rib);
        }
        // outline, thicker
        for (let a = 0; a <= Math.PI; a += 0.5 / r) {
            const x = cx + Math.cos(a) * r, y = base - Math.sin(a) * r;
            g.px(x, y, dk);
            g.px(x, y - 1, rib);
            g.px(x + (a < Math.PI / 2 ? 1 : -1), y, BRASS[3]);
        }
        // top hatch and highlights on the glass
        g.rect(cx - 6, base - r - 4, 12, 4, BRASS[2]);
        g.rect(cx - 6, base - r - 4, 12, 1, BRASS[4]);
        for (let a = 2.0; a < 2.6; a += 0.02) {
            const x = cx + Math.cos(a) * r * 0.86, y = base - Math.sin(a) * r * 0.86;
            g.blend(x, y, 2, 1, 0xffffff, 0.35);
        }
        for (let a = 2.15; a < 2.35; a += 0.02)
            g.blend(cx + Math.cos(a) * r * 0.78, base - Math.sin(a) * r * 0.78, 1, 1, 0xffffff, 0.3);
        if (env.lampsOn)
            g.glow(cx, base - r - 6, 8, 0xfff0b0, 0.3);
    }

    _renderSchool(g, s, env) {
        const t = s.t;
        for (const m of s.members) {
            const x = s.x + m.dx + Math.sin(t * 0.9 + m.ph) * 4;
            const y = s.y + m.dy + Math.sin(t * 1.3 + m.ph * 2) * 3;
            drawFigure(g, fishSprite(s.kind, Math.floor(t * 6 + m.ph) % 2), x, y, s.dir < 0);
        }
    }

    _renderBig(g, b) {
        const flip = b.dir < 0;
        if (b.kind === 'turtle')
            drawFigure(g, turtleSprite(Math.floor(b.t * 1.2) % 2), b.x, b.y, flip);
        else if (b.kind === 'shark')
            drawFigure(g, sharkSprite(Math.floor(b.t * 2) % 2), b.x, b.y, flip);
        else if (b.kind === 'manta')
            drawFigure(g, mantaSprite([0, 1, 2, 1][Math.floor(b.t * 1.5) % 4]), b.x, b.y, flip);
        else
            drawFigure(g, fishSprite('grouper', Math.floor(b.t * 2) % 2), b.x, b.y, flip);
    }

    _renderWhale(g, w) {
        // a far humpback, only a soft shape in the blue
        const c = mix(WATER[3], 0x061830, 0.5), L = 240, flip = w.dir < 0;
        const tail = Math.sin(w.t * 0.8) * 6;
        const X = i => (flip ? w.x + L - i : w.x + i);
        for (let i = 0; i < L; i++) {
            const u = i / L;
            const up = u < 0.3 ? 2 + Math.pow(u / 0.3, 1.5) * 18 : 20 + Math.sin((u - 0.3) / 0.7 * Math.PI * 0.55) * 4 - Math.pow(Math.max(0, u - 0.85) / 0.15, 2) * 14;
            const down = u < 0.3 ? 2 + Math.pow(u / 0.3, 1.5) * 12 : 14 + Math.sin((u - 0.3) / 0.7 * Math.PI) * 6 - Math.pow(Math.max(0, u - 0.88) / 0.12, 2) * 8;
            const cy = w.y + (u < 0.3 ? tail * Math.pow(1 - u / 0.3, 2) : 0);
            g.blend(X(i), cy - up, 1, up + down, c, 0.5);
        }
        // flukes and the long pectoral fin
        for (let k = 0; k < 14; k++) {
            g.blend(X(-k), w.y + tail - 2 - k * 0.9, 1, 4, c, 0.5);
            g.blend(X(-k), w.y + tail + k * 0.7, 1, 4, c, 0.5);
        }
        for (let k = 0; k < 44; k++)
            g.blend(X(L * 0.66 - k * 0.6), w.y + 12 + k * 0.55, 1, 4, c, 0.5);
    }

    _renderJelly(g, j, env) {
        const pulse = Math.max(0, Math.sin(j.t * 1.8));
        const rw = j.r * (1 - pulse * 0.25), rh = j.r * (0.7 + pulse * 0.2);
        const glow = env.dark > 0.5;
        for (let y = 0; y < rh; y++) {
            const hw = Math.round(rw * Math.sqrt(1 - Math.pow(1 - y / rh, 2)));
            g.blend(j.x - hw, j.y - rh + y, hw * 2 + 1, 1, y < 2 ? mix(j.c, 0xffffff, 0.5) : j.c, 0.55, glow);
        }
        for (let k = 0; k < 5; k++) {
            const bx = j.x - rw * 0.7 + k * rw * 0.35;
            for (let i = 0; i < j.r * 2.2; i += 1)
                g.blend(bx + Math.sin(j.t * 2 + i * 0.3 + k) * 1.5, j.y + i, 1, 1, j.c, 0.45 * (1 - i / (j.r * 2.2)), glow);
        }
        if (glow)
            g.glow(j.x, j.y - rh / 2, j.r * 1.6, j.c, 0.25);
    }

    _renderAngler(g, env) {
        // a deep sea fish hunting with its lure near the floor at night
        const x = (this.t * 9) % (this.w + 80) - 40, y = this.dome.base - 60 + Math.sin(this.t * 0.5) * 8;
        if (Math.abs(x - this.dome.x) < this.dome.r + 10)
            return;
        g.disc(x, y, 5, 0x1a1418);
        g.rect(x - 9, y - 2, 5, 4, 0x1a1418);
        g.px(x + 3, y - 1, 0xe0e0f0);
        for (let i = 0; i < 4; i++)
            g.px(x + 2 + i, y + 3, 0xf0f0f0);
        g.line(x + 1, y - 5, x + 7, y - 10, 0x2a2228);
        g.pxE(x + 8, y - 10, 0xb0ffe0);
        g.glow(x + 8, y - 10, 9, 0x70ffd0, 0.45 * env.dark);
    }

    _renderMer(g, o, env) {
        const up = o.state === 'act';
        const f = merSprite(o.m, up ? 'up' : 'swim', o.frame);
        // upright merfolk raise the arm facing the glass
        const flip = up ? (o.side ? o.side > 0 : o.x > this.dome.x) : o.dir < 0;
        const bob = up ? Math.sin(o.t * 1.5) * 1.5 : 0;
        if (o.act === 'ride' && !up) {
            drawFigure(g, turtleSprite(Math.floor(o.t * 1.2) % 2), o.x - 2, o.y + 10, flip);
            drawFigure(g, f, o.x, o.y - 2, flip);
        } else {
            drawFigure(g, f, o.x, o.y + bob, flip);
        }
        if (o.act === 'deliver' && !o.dropped) {
            const px = flip ? o.x - 2 : o.x + f.w - 2;
            g.disc(px, o.y - (up ? 22 : 6), 2, 0xf8f4f0);
            g.glow(px, o.y - (up ? 22 : 6), 4, 0xffffff, 0.2);
        }
        if (o.caught) {
            const fish = fishSprite(o.caught, Math.floor(o.t * 8) % 2);
            drawFigure(g, fish, flip ? o.x - fish.w + 4 : o.x + f.w - 4, o.y - 4, !flip);
        }
        if (o.act === 'music') {
            const hx = flip ? o.x + 2 : o.x + f.w - 6;
            g.rect(hx, o.y - (up ? 26 : 8), 4, 2, 0xf0d0b0);
        }
        if (o.m.glow && env.dark > 0.5)
            for (const l of f.lights) {
                const [lx, ly] = lightPos(f, l, o.x, o.y, flip);
                g.glow(lx, ly, 5, o.m.glow, 0.35);
            }
    }

    _renderDiver(g, d, env) {
        const fy = this.floorAt(d.x) + 2;
        const frame = d.walking ? Math.floor(d.t * 2.5) % 4 : 0;
        const f = diverSprite(frame);
        drawFigure(g, f, d.x, fy, d.dir < 0);
        if (env.dark > 0.5) {
            const [lx, ly] = lightPos(f, f.lights[0], d.x, fy, d.dir < 0);
            g.pxE(lx, ly, 0xfff0c0);
            for (let i = 2; i < 40; i += 2)
                g.add(d.dir > 0 ? lx + i : lx - i - 1, ly - i * 0.15, 2, 1 + i * 0.4, 0xfff0c0, 0.06);
        }
    }

    // eight arms: trailing behind the head while swimming, wrapped over
    // the dome while sitting; drape blends between the two
    _krakenArms(k) {
        const {x: cx, r, base} = this.dome, t = k.t;
        const ax = Math.cos(k.theta), ay = Math.sin(k.theta), nx = -ay, ny = ax;
        const arms = [];
        for (let a = 0; a < 8; a++) {
            const sp = (a - 3.5) / 3.5;
            const L = k.L * (1 - Math.abs(sp) * 0.15), N = Math.ceil(L / 2);
            const rx = k.x - ax * k.H0 + nx * sp * k.Wm * 0.55, ry = k.y - ay * k.H0 + ny * sp * k.Wm * 0.55;
            const side = a < 4 ? -1 : 1, rank = a < 4 ? 3 - a : a - 4;
            // on the dome each arm follows its own meridian of the sphere
            const phi = side * [0.3, 0.72, 1.12, 1.5][rank];
            const pts = [];
            for (let i = 0; i <= N; i++) {
                const u = i / N, sl = u * L;
                const wave = Math.sin(t * 2.2 - i * 0.18 + a * 1.3) * Math.min(1, sl / 20) * 3;
                const tx = rx - ax * sl + nx * (sp * sl * 0.16 * (1 - k.jet * 0.6) + wave);
                const ty = ry - ay * sl + ny * (sp * sl * 0.16 * (1 - k.jet * 0.6) + wave);
                let px = tx, py = ty;
                if (k.drape > 0) {
                    const e = Math.PI / 2 - Math.min(1.25, sl / r), rad = r + 2;
                    const ph = phi + Math.sin(t * 1.3 + i * 0.25 + a) * 0.06 * u;
                    let dx = cx + rad * Math.cos(e) * Math.sin(ph), dy = base - rad * Math.sin(e);
                    // the tips curl sideways
                    if (u > 0.8)
                        dx += side * Math.pow((u - 0.8) / 0.2, 2) * 7;
                    // near the head the arms start from the root
                    const blend = Math.min(1, sl / (k.H0 * 1.5));
                    dx = rx + (dx - rx) * blend;
                    dy = ry + (dy - ry) * blend;
                    px = tx + (dx - tx) * k.drape;
                    py = ty + (dy - ty) * k.drape;
                }
                pts.push(px, py);
            }
            arms.push({pts, back: rank % 2 === 1});
        }
        return arms;
    }

    _renderKraken(g, k, env) {
        const KR = A.ramp(0xa03848), INKC = 0x1a0a14, night = env.dark > 0.5;
        const ax = Math.cos(k.theta), ay = Math.sin(k.theta), nx = -ay, ny = ax;
        const arms = this._krakenArms(k);
        const armW = Math.max(3, Math.round(k.Wm * 0.4));
        const drawArm = arm => {
            const P = arm.pts, n = P.length / 2;
            for (let pass = 0; pass < 2; pass++)
                for (let i = 0; i < n; i++) {
                    const u = i / n;
                    const w = Math.max(0.6, armW * Math.pow(1 - u, 0.8) / 2);
                    g.disc(P[i * 2], P[i * 2 + 1], pass ? w : w + 1, pass ? (arm.back ? KR[1] : KR[2]) : INKC);
                }
            // suckers along the arm
            for (let i = 3; i < n - 2; i += 3) {
                const w = armW * Math.pow(1 - i / n, 0.8) / 2;
                if (w >= 1.2)
                    g.px(P[i * 2], P[i * 2 + 1] + Math.floor(w * 0.6), 0xf0b8a8);
            }
        };
        // back arms behind the body, front arms over it
        for (const a of arms)
            if (a.back)
                drawArm(a);
        // half widths of the mantle body and of the fins at its tip
        const W = k.Wm;
        const bodyW = s => {
            if (s < 0)
                return W * (0.7 - 0.25 * Math.pow(-s / k.H0, 2));
            const u = s / k.M;
            return W * (u < 0.2 ? 0.75 + 1.25 * u : 1 - Math.pow((u - 0.2) / 0.8, 1.6) * 0.85) * (1 - 0.12 * k.jet);
        };
        const finW = s => s > k.M * 0.68 ? W * 1.1 * (1 - Math.abs(s / k.M - 0.86) / 0.18) : 0;
        const ext = k.M + k.H0 + k.Wm * 1.2;
        const x0 = Math.floor(k.x - ext), x1 = Math.ceil(k.x + ext), y0 = Math.floor(k.y - ext), y1 = Math.ceil(k.y + ext);
        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
                const dx = x - k.x, dy = y - k.y;
                const s = dx * ax + dy * ay, v = dx * nx + dy * ny;
                if (s < -k.H0 || s > k.M)
                    continue;
                const bw = bodyW(s), h = Math.max(bw, finW(s), 0.5), av = Math.abs(v);
                if (av > h)
                    continue;
                let c;
                if (h - av < 1.1 || s > k.M - 1 || s < -k.H0 + 1) {
                    c = INKC;
                } else {
                    // light from the upper left on a round body
                    const lit = (nx * -0.6 + ny * -0.8) * (v / h);
                    c = lit > 0.4 ? KR[3] : lit > -0.3 ? KR[2] : KR[1];
                    if (av > bw)
                        c = mix(c, KR[1], 0.4);
                    const hs = hash(Math.round(s / 3), Math.round(v / 3), 5);
                    if (hs < 110)
                        c = KR[1];
                    else if (hs > 985)
                        c = KR[4];
                }
                g.px(x, y, c);
            }
        for (const a of arms)
            if (!a.back)
                drawArm(a);
        // eyes on the sides of the head: both seen from the front while
        // sitting upright, a three-quarter view while swimming with the
        // far eye smaller and closer to the middle
        const big = Math.max(2, Math.round(k.Wm * 0.2));
        const up = ny > 0 ? -1 : 1;
        const eyes = Math.abs(ny) > 0.5 ? [[up * 0.42, big], [-up * 0.12, Math.max(1, big - 1)]] : [[-0.42, big], [0.42, big]];
        for (const [vs, er] of eyes) {
            const ex = Math.round(k.x - ax * k.H0 * 0.5 + nx * vs * k.Wm), ey = Math.round(k.y - ay * k.H0 * 0.5 + ny * vs * k.Wm);
            g.disc(ex, ey, er + 1, INKC);
            if (k.blink > 0) {
                g.rect(ex - er, ey, er * 2 + 1, 1, KR[1]);
                continue;
            }
            g.disc(ex, ey, er, 0xf0c040, night);
            g.rect(ex - er + 1, ey, er * 2 - 1, 1, 0x101010);
            g.px(ex - 1, ey - er + 1, 0xfff8d0);
            if (night)
                g.glow(ex, ey, er * 3, 0xf0c040, 0.3);
        }
    }

    _renderKrakenShadow(g, k) {
        const {x: cx, r, base} = this.dome, top = base - r, depth = r * 0.55;
        for (let y = top + 1; y < top + depth; y += 1) {
            const hw = Math.sqrt(r * r - (base - y) * (base - y)) - 2;
            g.blend(cx - hw, y, hw * 2, 1, 0x061020, 0.28 * k.drape * (1 - (y - top) / depth));
        }
    }

    _renderInk(g, p) {
        const r = Math.round(p.r), a = 0.55 * p.life;
        for (let y = -r; y <= r; y++) {
            const hw = Math.round(Math.sqrt(r * r - y * y));
            g.blend(p.x - hw, p.y + y, hw * 2 + 1, 1, 0x120a18, a);
        }
    }

    _renderSub(g, s, env) {
        const f = s.f, flip = s.dir < 0, far = s.state === 'cruise';
        if (far) {
            // seen through the blue: faded towards the water colour
            const ox = Math.floor(s.x), oy = Math.floor(s.y) - f.h, P = f.pts;
            for (let i = 0; i < P.length; i += 3)
                g.px(flip ? ox + f.w - 1 - P[i] : ox + P[i], oy + P[i + 1], mix(P[i + 2], WATER[2], 0.45));
        } else {
            drawFigure(g, f, s.x, s.y, flip);
        }
        const night = env.dark > 0.45;
        for (const l of f.lights) {
            const [lx, ly] = lightPos(f, l, s.x, s.y, flip);
            if (l.kind === 'prop') {
                const k = Math.floor(s.prop) % 3, h = [8, 4, 1][k];
                const px = flip ? lx + 1 : lx - 1;
                g.rect(px, ly - h, 2, h * 2 + 1, far ? mix(BRASS[2], WATER[2], 0.45) : BRASS[2]);
                g.px(px, ly, far ? mix(BRASS[4], WATER[2], 0.45) : BRASS[4]);
            } else if (l.kind === 'lamp') {
                if (night) {
                    g.pxE(lx, ly, 0xfff4d0);
                    for (let i = 2; i < (far ? 40 : 90); i += 2)
                        g.add(flip ? lx - i - 2 : lx + i, ly - i * 0.12, 2, 1 + i * 0.35, 0xfff0c0, 0.05);
                }
            } else if (l.kind === 'salon') {
                if (night) {
                    g.glow(lx, ly, 9, 0xffd890, 0.35);
                } else {
                    g.blend(lx - 5, ly - 5, 11, 11, 0x80c0e0, 0.15);
                }
            } else if (night) {
                g.pxE(lx, ly, l.c);
            }
        }
    }

    _renderSurface(g, env) {
        const W = this.w, t = this.t, sy = this.surfY;
        if (this._iced(env))
            return;
        // the underside of the waves, bright and moving
        const top = mix(0xb8f0ff, 0x2a4a68, env.dark);
        const line = mix(0xf0ffff, 0x5a7a98, env.dark);
        for (let x = 0; x < W; x += 2) {
            const y = sy + Math.sin(x * 0.045 + t * 1.1) * 2 + Math.sin(x * 0.12 - t * 0.7);
            g.rect(x, 0, 2, y, top);
            g.rect(x, y, 2, 1, line);
            if ((x + Math.floor(t * 6)) % 16 < 4)
                g.rect(x, y + 2, 2, 1, mix(line, top, 0.5));
        }
        if (this.boat) {
            const b = this.boat;
            g.rect(b.x, sy - 3, b.w, 4, 0x1a2430);
            g.rect(b.x + 6, sy + 1, b.w - 12, 3, 0x1a2430);
            g.rect(b.x + b.w * 0.4, sy + 4, 2, 4, 0x1a2430);
            for (let i = 0; i < 6; i++)
                g.blend(b.dir > 0 ? b.x - 4 - i * 5 : b.x + b.w + i * 5, sy + 1 + (i % 2), 3, 1, 0xffffff, 0.4);
        }
        for (const s of this.splashes)
            g.blend(s.x - 1, sy + 1, 3, 1, 0xffffff, s.life * 1.5);
    }
}
