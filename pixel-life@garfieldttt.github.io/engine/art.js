// Cozy pixel-art building blocks: hue-shifted color ramps, shingle roofs,
// plank/stone/brick walls, framed windows, doors, big leafy trees and
// textured ground tiles. Everything is drawn procedurally, with outlines.
import {mix} from './gfx.js';

export const INK = 0x2c1a2a; // outline color

// 5-step ramp: 0 darkest (shifted to purple) .. 4 lightest (shifted to warm)
export function ramp(base) {
    return [
        mix(mix(base, 0x1a0828, 0.62), base, 0.0),
        mix(base, 0x2a1040, 0.35),
        base,
        mix(base, 0xfff4c8, 0.28),
        mix(base, 0xfff8e0, 0.55),
    ];
}

const hash = (x, y, s = 0) => ((((x + s * 131) * 73856093) ^ ((y - s * 71) * 19349663)) >>> 0) % 1000;

export function outlineRect(g, x, y, w, h, c = INK) {
    g.rect(x, y, w, 1, c);
    g.rect(x, y + h - 1, w, 1, c);
    g.rect(x, y, 1, h, c);
    g.rect(x + w - 1, y, 1, h, c);
}

// ---------------- walls ----------------

export function wallPlanks(g, x, y, w, h, R, seed = 0) {
    g.rect(x, y, w, h, R[2]);
    for (let px = x; px < x + w; px += 6) {
        g.rect(px, y, 1, h, R[0]);
        g.rect(px + 1, y, 1, h, R[3]);
        // board ends and knots
        for (let py = y + (hash(px, 0, seed) % 20); py < y + h; py += 18 + hash(px, py, seed) % 12) {
            g.rect(px + 1, py, 5, 1, R[1]);
            g.rect(px + 1, py + 1, 5, 1, R[3]);
        }
        if (hash(px, 3, seed) < 400)
            g.px(px + 3, y + 4 + hash(px, 5, seed) % Math.max(1, h - 8), R[1]);
        g.rect(px + 5, y, 1, h, R[1]);
    }
}

export function wallSiding(g, x, y, w, h, R, seed = 0) {
    g.rect(x, y, w, h, R[2]);
    for (let py = y; py < y + h; py += 4) {
        g.rect(x, py, w, 1, R[3]);
        g.rect(x, py + 3, w, 1, R[1]);
        if (hash(py, 1, seed) < 300)
            g.px(x + hash(py, 2, seed) % w, py + 2, R[1]);
    }
}

export function wallStone(g, x, y, w, h, R, seed = 0) {
    g.rect(x, y, w, h, R[1]);
    let row = 0;
    for (let py = y; py < y + h; py += 6, row++) {
        let px = x - (row % 2 ? 4 : 0);
        while (px < x + w) {
            const sw = 6 + hash(px, py, seed) % 6;
            const x1 = Math.max(x, px + 1), x2 = Math.min(x + w, px + sw);
            if (x2 - x1 > 1) {
                const tone = hash(px, py, seed + 1) % 3;
                g.rect(x1, py + 1, x2 - x1, 4, tone === 0 ? R[2] : tone === 1 ? R[3] : mix(R[2], R[3], 0.5));
                g.rect(x1, py + 1, x2 - x1, 1, R[4]);
                g.rect(x1, py + 4, x2 - x1, 1, mix(R[1], R[2], 0.5));
                g.px(x2 - 1, py + 2, R[1]);
            }
            px += sw;
        }
    }
}

export function wallBrick(g, x, y, w, h, R, seed = 0) {
    g.rect(x, y, w, h, R[1]);
    let row = 0;
    for (let py = y; py < y + h; py += 4, row++) {
        for (let px = x - (row % 2 ? 4 : 0); px < x + w; px += 8) {
            const x1 = Math.max(x, px + 1), x2 = Math.min(x + w, px + 8);
            if (x2 <= x1)
                continue;
            const t = hash(px, py, seed) % 10;
            g.rect(x1, py + 1, x2 - x1, 3, t < 2 ? R[3] : t > 8 ? mix(R[1], R[2], 0.5) : R[2]);
            g.rect(x1, py + 1, x2 - x1, 1, mix(R[2], R[3], 0.6));
        }
    }
}

export function wallPlaster(g, x, y, w, h, R, seed = 0) {
    g.rect(x, y, w, h, R[2]);
    for (let py = y; py < y + h; py++)
        for (let px = x; px < x + w; px++) {
            const v = hash(px, py, seed);
            if (v < 18)
                g.px(px, py, R[3]);
            else if (v > 988)
                g.px(px, py, R[1]);
        }
    // a few cracks
    for (let i = 0; i < Math.floor(w * h / 1800); i++) {
        let cx = x + hash(i, 9, seed) % w, cy = y + hash(i, 7, seed) % h;
        for (let k = 0; k < 5; k++) {
            g.px(cx, cy, R[1]);
            cx += (hash(k, i, seed) % 3) - 1;
            cy += 1;
        }
    }
}

// ---------------- roofs ----------------

// Shingle tiles filling a polygon given per-row spans: span(y) -> [x1, x2] or null
export function shingles(g, top, bottom, span, R, seed = 0, tileW = 8, rowH = 5) {
    for (let y = top; y < bottom; y++) {
        const s = span(y);
        if (!s)
            continue;
        const [x1, x2] = s;
        const row = Math.floor((y - top) / rowH), ry = (y - top) % rowH;
        const off = row % 2 ? tileW / 2 : 0;
        for (let x = x1; x < x2; x++) {
            const tx = (x - x1 + off + 1000 * tileW) % tileW;
            const tile = Math.floor((x - x1 + off) / tileW) + row * 7;
            // mostly one tone, a few lighter or darker tiles; every row
            // lies in the shadow of the row above it, the joints between
            // tiles stop short of that shadow so rows read as overlapping
            const tone = hash(tile, row, seed) % 9;
            let c = tone === 0 ? R[1] : tone === 8 ? R[3] : R[2];
            if (ry === 0)
                c = R[0];
            else if (ry === 1)
                c = R[1];
            else if (ry === rowH - 1)
                c = tone === 8 ? R[4] : R[3];
            if (tx === 0 && ry > 1)
                c = R[1];
            else if (ry === rowH - 1 && (tx === 0 || tx === tileW - 1))
                c = R[1]; // rounded tile corners
            g.px(x, y, c);
        }
        g.px(x1 - 1, y, INK);
        g.px(x2, y, INK);
    }
}

// Front gable house shape: A-frame roof over a pentagon facade.
export function gableRoof(g, x, y, w, rh, R, seed, overhang = 4) {
    const cx = x + w / 2;
    shingles(g, y, y + rh, yy => {
        const t = (yy - y + 1) / rh;
        const half = (w / 2 + overhang) * t;
        return [Math.round(cx - half), Math.round(cx + half)];
    }, R, seed);
    // eave line
    g.rect(x - overhang, y + rh, w + overhang * 2, 1, INK);
    g.rect(x - overhang + 1, y + rh - 1, w + overhang * 2 - 2, 1, R[0]);
}

// Front view of a sloped roof (trapezoid), like most town houses.
export function slopeRoof(g, x, y, w, rh, R, seed, overhang = 5) {
    shingles(g, y, y + rh, yy => {
        const t = (yy - y) / rh;
        const inset = Math.round((1 - t) * 6);
        return [x - overhang + inset, x + w + overhang - inset];
    }, R, seed);
    g.rect(x - overhang + 6, y - 1, w + overhang * 2 - 12, 1, INK);
    g.rect(x - overhang, y + rh, w + overhang * 2, 1, INK);
    g.rect(x - overhang, y + rh - 1, w + overhang * 2, 1, R[0]);
    // ridge cap
    g.rect(x - overhang + 6, y, w + overhang * 2 - 12, 1, R[4]);
}

// ---------------- details ----------------

export const GLASS = [0x3a5a98, 0x5a8ac8, 0x8ac0e8, 0xc0e4f8, 0xf4fcff];

export function windowFrame(g, x, y, w, h, frameR) {
    g.rect(x - 2, y - 2, w + 4, h + 4, INK);
    g.rect(x - 1, y - 1, w + 2, h + 2, frameR[2]);
    g.rect(x - 1, y - 1, w + 2, 1, frameR[3]);
    g.rect(x - 1, y + h, w + 2, 1, frameR[1]);
    // sill
    g.rect(x - 3, y + h + 1, w + 6, 2, frameR[2]);
    g.rect(x - 3, y + h + 1, w + 6, 1, frameR[3]);
    g.rect(x - 3, y + h + 3, w + 6, 1, INK);
}

// Glass (unlit). Returns nothing; mullions are drawn by windowMullions.
export function windowGlass(g, x, y, w, h, sky, night) {
    const top = night ? 0x2a3460 : mix(GLASS[2], sky, 0.25);
    const bot = night ? 0x3a4a80 : GLASS[1];
    for (let i = 0; i < h; i++)
        g.rect(x, y + i, w, 1, mix(top, bot, i / h));
    // diagonal shine
    const s = night ? 0x5a6aa0 : GLASS[4];
    for (let i = 0; i < Math.min(w, h) - 2; i++) {
        if (i % 6 < 3) {
            g.px(x + w - 2 - i, y + 1 + i, s);
            g.px(x + w - 3 - i, y + 1 + i, mix(s, top, 0.5));
        }
    }
}

export function windowMullions(g, x, y, w, h, frameR) {
    g.rect(x + Math.floor(w / 2), y, 1, h, frameR[1]);
    g.rect(x, y + Math.floor(h / 2), w, 1, frameR[1]);
    g.rect(x + Math.floor(w / 2) + 1, y, 1, h, frameR[3]);
}

export function door(g, x, y, w, h, R, kind = 0) {
    g.rect(x - 2, y - 2, w + 4, h + 2, INK);
    g.rect(x - 1, y - 1, w + 2, h + 1, mix(R[1], INK, 0.3));
    g.rect(x, y, w, h, R[2]);
    // panels
    const pw = Math.floor((w - 5) / 2);
    for (const px of [x + 2, x + 3 + pw]) {
        g.rect(px, y + 3, pw, Math.floor(h * 0.35), R[1]);
        g.rect(px + 1, y + 4, pw - 1, Math.floor(h * 0.35) - 1, R[3]);
        g.rect(px + 1, y + 4, pw - 2, Math.floor(h * 0.35) - 2, R[2]);
        g.rect(px, y + Math.floor(h * 0.5), pw, Math.floor(h * 0.38), R[1]);
        g.rect(px + 1, y + Math.floor(h * 0.5) + 1, pw - 1, Math.floor(h * 0.38) - 1, R[2]);
    }
    if (kind === 1) {
        g.rect(x + 3, y + 3, w - 6, 5, GLASS[2]);
        g.px(x + w - 5, y + 4, GLASS[4]);
    }
    g.rect(x + w - 3, y + Math.floor(h * 0.55), 2, 2, 0xf0c040);
    g.px(x + w - 3, y + Math.floor(h * 0.55), 0xfff0a0);
    // step
    g.rect(x - 3, y + h, w + 6, 2, 0xa8a090);
    g.rect(x - 3, y + h, w + 6, 1, 0xd0c8b8);
}

export function flowerBox(g, x, y, w, season, seed = 0) {
    g.rect(x - 1, y - 1, w + 2, 5, INK);
    g.rect(x, y, w, 3, 0x9a5a30);
    g.rect(x, y, w, 1, 0xc0783a);
    if (season === 'winter')
        return;
    const cols = [0xe84860, 0xf8d048, 0xf0f0f0, 0xb860d8, 0xf890b0];
    for (let i = 0; i < w; i += 2) {
        g.rect(x + i, y - 2, 2, 2, 0x4a9a3a);
        if (season !== 'autumn' && hash(i, x, seed) < 650) {
            const c = cols[(hash(i, 3, seed)) % cols.length];
            g.px(x + i, y - 3, c);
            g.px(x + i + 1, y - 2, mix(c, 0xffffff, 0.3));
        }
    }
}

export function chimney(g, x, y, w, h, R) {
    g.rect(x - 1, y - 1, w + 2, h + 1, INK);
    wallStone(g, x, y, w, h, R, x);
    g.rect(x - 2, y - 2, w + 4, 3, INK);
    g.rect(x - 1, y - 1, w + 2, 1, R[3]);
}

// ---------------- vegetation ----------------

const LEAF = {
    spring: [0x2e5a2a, 0x3e7a32, 0x58a03a, 0x80c048, 0xb0e070],
    summer: [0x24502a, 0x2e6a30, 0x46903a, 0x6ab048, 0x98d060],
    autumn: [0x6a2a1a, 0x9a3a1a, 0xc85a20, 0xe88a30, 0xf8c050],
    winter: [0x2a4a3a, 0x3a5a48, 0x507a5a, 0x7a9a7a, 0xa8c0a8],
};

// per-tree variety: autumn colors and slight green tints
const AUTUMN = [
    [0x6a2a1a, 0x9a3a1a, 0xc85a20, 0xe88a30, 0xf8c050],
    [0x6a4a14, 0x9a6a18, 0xc89a20, 0xe8c030, 0xf8e070],
    [0x5a1a1a, 0x8a2422, 0xb83a2a, 0xd85a3a, 0xf08a60],
    [0x4a4a1e, 0x6a6a24, 0x8a8a2a, 0xb0a83a, 0xd8c860],
];
const TINTS = [null, 0x9ab040, 0x2a6a6a, 0x4a8a20];

function treeLeaves(season, seed) {
    const v = Math.floor(seed / 11);
    if (season === 'autumn')
        return AUTUMN[v % AUTUMN.length];
    const tint = TINTS[v % TINTS.length];
    return tint ? LEAF[season].map(c => mix(c, tint, 0.18)) : LEAF[season];
}

export function leafRamp(season) {
    return LEAF[season];
}

// Leafy bush of overlapping clumps, `w` wide with its foot on `ground`.
// All outlines go down first so the clumps merge into one silhouette,
// then shade, mid tone and a lit rim on the top left of each clump.
export function bush(g, x, ground, w, R, seed = 0) {
    const n = Math.max(2, Math.round(w / 8)), r = Math.max(4, Math.round(w / n / 2) + 1);
    const lobes = [];
    for (let i = 0; i < n; i++)
        lobes.push([x + r + Math.round(i * (w - 2 * r) / (n - 1)), ground - r - 2, r]);
    for (let i = 1; i < n; i += 2)
        lobes.push([lobes[i - 1][0] + Math.round((lobes[i][0] - lobes[i - 1][0]) / 2), ground - r - 3 - hash(i, 3, seed) % 3, r]);
    for (const [cx, cy, rr] of lobes)
        g.disc(cx, cy, rr + 1, INK);
    for (const [cx, cy, rr] of lobes)
        g.disc(cx, cy, rr, R[1]);
    for (const [cx, cy, rr] of lobes)
        g.disc(cx - 1, cy - 1, rr - 2, R[2]);
    for (const [cx, cy, rr] of lobes) {
        g.rect(cx - rr + 2, cy - rr + 2, 3, 1, R[3]);
        g.px(cx - rr + 2, cy - rr + 3, R[3]);
        g.px(cx - rr + 3, cy - rr + 2, R[4]);
    }
    g.rect(x + 1, ground - 1, w - 2, 1, R[0]);
    return lobes;
}

// Boulder about 22px wide incl. a pebble, foot at y: lit top face,
// shaded side, a crack and some moss.
export function boulder(g, x, y, seed, season) {
    const b = {seed};
    // a boulder: lit top face, cool shadow side, a crack and moss
    const R = ramp(0x8c8ca0), rows = [6, 10, 13, 15, 16, 16, 16, 15, 13];
    const cx = x + 8, top = y - rows.length;
    rows.forEach((wd, i) => {
        const lx = cx - Math.floor(wd / 2);
        g.rect(lx - 1, top + i, wd + 2, 1, INK);
        g.rect(lx, top + i, wd, 1, R[2]);
        g.rect(lx + wd - Math.ceil(wd / 3), top + i, Math.ceil(wd / 3), 1, R[1]);
        if (i < 4)
            g.rect(lx + 1, top + i, Math.floor(wd / 2), 1, R[3]);
    });
    g.rect(cx - 2, top - 1, 6, 1, INK);
    g.px(cx - 3, top + 1, R[4]);
    g.px(cx - 2, top + 1, R[4]);
    g.line(cx + 2, top + 2, cx + 4, top + 6, R[0]);
    g.rect(cx - 7, y - 2, 14, 1, R[1]);
    if (season === 'winter')
        for (let i = 0; i < 3; i++)
            g.rect(cx - Math.floor(rows[i] / 2) + 1, top + i, rows[i] - 2, 1, i ? 0xdce4f4 : 0xf4f8ff);
    else if (b.seed % 2) {
        const M = leafRamp(season);
        g.rect(cx - 4, top + 1, 5, 1, M[2]);
        g.rect(cx - 5, top + 2, 3, 1, M[1]);
        g.px(cx - 3, top + 1, M[3]);
    }
    // a pebble next to it
    g.rect(cx + 9, y - 3, 5, 3, INK);
    g.rect(cx + 10, y - 3, 3, 2, R[2]);
    g.px(cx + 10, y - 3, R[3]);
}

// Tree stump about 20px wide incl. roots, foot at y.
export function stump(g, x, y, season) {
    // cut log: bark sides, the cut face with growth rings, roots
    const B = ramp(0x7a4a30), W = ramp(0xd8a868), cx = x + 7;
    g.rect(cx - 7, y - 10, 15, 10, INK);
    g.rect(cx - 6, y - 8, 13, 8, B[2]);
    g.rect(cx - 6, y - 8, 2, 8, B[3]);
    g.rect(cx + 4, y - 8, 3, 8, B[1]);
    for (let i = 0; i < 3; i++)
        g.rect(cx - 3 + i * 3, y - 7 + (i % 2) * 2, 1, 4, B[1]);
    // roots flaring out at the ground
    g.rect(cx - 10, y - 2, 5, 2, INK);
    g.rect(cx - 9, y - 2, 4, 1, B[2]);
    g.rect(cx + 6, y - 3, 5, 3, INK);
    g.rect(cx + 6, y - 2, 4, 1, B[1]);
    // cut face
    g.rect(cx - 6, y - 12, 13, 1, INK);
    g.rect(cx - 7, y - 11, 15, 3, INK);
    g.rect(cx - 5, y - 11, 11, 3, W[2]);
    g.rect(cx - 6, y - 10, 13, 1, W[2]);
    g.rect(cx - 3, y - 10, 7, 1, W[1]);
    g.rect(cx - 1, y - 10, 3, 1, W[2]);
    g.px(cx, y - 10, W[0]);
    g.rect(cx - 4, y - 11, 4, 1, W[3]);
    if (season === 'autumn' || season === 'summer') {
        g.rect(cx + 7, y - 6, 4, 2, INK);
        g.rect(cx + 7, y - 5, 3, 1, 0xd89048);
    }
}

// Big round tree: thick trunk with roots, crown of leaf clumps. The
// seed picks the shape (round, tall, wide or birch) and the leaf colors.
export function bigTree(g, x, ground, size, season, seed, snow = 0) {
    const shape = ['round', 'round', 'tall', 'wide', 'birch'][Math.floor(seed / 7) % 5];
    const R = treeLeaves(season, seed);
    const birch = shape === 'birch';
    const bark = birch ? [0x3a3438, 0x8a8480, 0xd8d4cc, 0xf0ece4, 0xffffff] : [0x3a2018, 0x5a3424, 0x7a4a30, 0x9a6440, 0xb88050];
    const sx = shape === 'tall' ? 0.78 : shape === 'wide' ? 1.35 : birch ? 0.8 : 1;
    const sy = shape === 'tall' ? 1.35 : shape === 'wide' ? 0.75 : birch ? 1.15 : 1;
    const th = Math.floor(size * (shape === 'wide' ? 0.7 : birch || shape === 'tall' ? 1.05 : 0.9));
    const tw = Math.max(birch ? 3 : 5, Math.floor(size * (birch ? 0.2 : 0.32)));
    // shadow on the ground
    g.footShadow(x, ground, size * 1.8, 0.3);
    // trunk with roots
    g.rect(x - tw / 2 - 1, ground - th, tw + 2, th, INK);
    g.rect(x - tw / 2, ground - th, tw, th, bark[2]);
    g.rect(x - tw / 2, ground - th, 1, th, bark[3]);
    g.rect(x + tw / 2 - 1, ground - th, 1, th, bark[1]);
    for (let i = 0; i < th; i += 3)
        if (birch)
            g.rect(x - tw / 2 + (i * 5 + seed) % Math.max(1, tw - 1), ground - th + i, 2, 1, bark[0]);
        else
            g.px(x - tw / 2 + 1 + (i * 7 + seed) % Math.max(1, tw - 2), ground - th + i, bark[1]);
    g.rect(x - tw / 2 - 3, ground - 3, tw + 6, 3, INK);
    g.rect(x - tw / 2 - 2, ground - 3, tw + 4, 2, bark[2]);
    g.rect(x - tw / 2 - 2, ground - 3, 2, 1, bark[3]);
    if (season === 'winter' && seed % 4 !== 0) {
        // bare branches
        const cy = ground - th;
        for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + ((hash(i, 1, seed) / 1000) - 0.5) * 2.4;
            const len = size * (0.5 + hash(i, 2, seed) / 1600);
            const ex = x + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
            g.line(x, cy + 2, ex, ey, INK);
            g.line(x + 1, cy + 2, ex + 1, ey, bark[2]);
            if (snow > 0.2)
                g.px(ex, ey - 1, 0xf4f8ff);
        }
        return;
    }
    // crown: clumps
    const cy = ground - th - size * 0.55 * sy;
    const clumps = [];
    const n = 7 + (seed % 4) + (shape === 'wide' ? 3 : 0);
    const cr = birch ? 0.7 : 1;
    clumps.push([x, cy, size * 0.62 * cr]);
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (seed % 10) * 0.3;
        const d = size * (0.42 + (hash(i, 4, seed) % 200) / 1000);
        clumps.push([x + Math.cos(a) * d * 1.15 * sx, cy + Math.sin(a) * d * 0.8 * sy, size * (0.34 + (hash(i, 6, seed) % 140) / 1000) * cr]);
    }
    if (shape === 'tall')
        clumps.push([x, cy - size * 0.7, size * 0.4]);
    clumps.sort((a, b) => a[1] - b[1]);
    // back clumps first; each front clump gets its own outline, so the
    // crown reads as separate leaf clusters
    for (const [bx, by, br] of clumps)
        g.disc(Math.round(bx), Math.round(by), Math.round(br) + 1, INK);
    for (const [bx, by, br] of clumps) {
        const r = Math.round(br);
        g.disc(Math.round(bx), Math.round(by), r + 1, R[0]);
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const d2 = dx * dx + dy * dy;
                if (d2 > r * r)
                    continue;
                const px = Math.round(bx) + dx, py = Math.round(by) + dy;
                const v = (-dx * 0.55 - dy * 0.85) / r;
                let k = v > 0.55 ? 4 : v > 0.15 ? 3 : v > -0.35 ? 2 : 1;
                const hv = hash(px, py, seed);
                if (hv < 90 && k > 1)
                    k--;
                else if (hv > 930 && k < 4)
                    k++;
                if (d2 > (r - 1) * (r - 1) && dy > 0)
                    k = Math.min(k, 1);
                let c = R[k];
                if (snow > 0.2 && v > 0.5)
                    c = 0xf4f8ff;
                g.px(px, py, c);
            }
        }
    }
    // a few leaf highlights and fruit
    for (let i = 0; i < size * 1.5; i++) {
        const px = x + (hash(i, 11, seed) % (size * 2)) - size, py = cy + (hash(i, 13, seed) % (size * 1.4)) - size * 0.7;
        if ((px - x) ** 2 + ((py - cy) * 1.2) ** 2 < size * size * 0.5) {
            g.px(px, py, R[4]);
            g.px(px + 1, py + 1, R[2]);
        }
    }
    if (season === 'spring' && seed % 3 === 0)
        for (let i = 0; i < size * 2; i++)
            g.px(x + (hash(i, 17, seed) % (size * 2)) - size, cy + (hash(i, 19, seed) % size) - size / 2, i % 2 ? 0xf8c0d8 : 0xffe8f0);
    if (season === 'summer' && seed % 4 === 1)
        for (let i = 0; i < size * 0.6; i++) {
            const fx = x + (hash(i, 23, seed) % (size * 1.6)) - size * 0.8, fy = cy + (hash(i, 29, seed) % size) - size / 2;
            g.rect(fx, fy, 2, 2, 0xd83030);
            g.px(fx, fy, 0xff8070);
        }
}

// ---------------- ground ----------------

export const GRASS = {
    spring: [0x3a7a30, 0x4a9a38, 0x62b844, 0x86d058, 0xb0e47a],
    summer: [0x346c2c, 0x428a34, 0x58a63e, 0x78c04c, 0xa0d868],
    autumn: [0x3e6228, 0x52802e, 0x6c9a36, 0x90b444, 0xbccc66],
    winter: [0xa8b8d0, 0xc8d4e8, 0xe4ecf8, 0xf4f8ff, 0xffffff],
};

// smooth value noise 0..1 on a grid of `cell` pixels
function patchNoise(px, py, cell, seed) {
    const gx = Math.floor(px / cell), gy = Math.floor(py / cell);
    const fx = px / cell - gx, fy = py / cell - gy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const v = (i, j) => hash(gx + i, gy + j, seed + 17) / 1000;
    const a = v(0, 0) + (v(1, 0) - v(0, 0)) * sx, b = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
    return a + (b - a) * sy;
}

export function grass(g, x, y, w, h, season, seed = 0) {
    const R = GRASS[season];
    g.rect(x, y, w, h, R[2]);
    for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
            // darker and lighter patches with a dithered edge, wider than
            // tall because the meadow is seen at a low angle
            const n = patchNoise(px, py * 2.2, 46, seed) + (hash(px, py, seed + 5) - 500) / 9000;
            if (n < 0.3 || (n < 0.33 && (px + py) % 2))
                g.px(px, py, R[1]);
            else if (n > 0.74 || (n > 0.71 && (px + py) % 2))
                g.px(px, py, R[3]);
            const v = hash(px, py, seed);
            if (v < 40) {
                // little grass blade: light tip, dark base
                g.px(px, py, R[3]);
                g.px(px, py + 1, R[1]);
            } else if (v > 985) {
                g.px(px, py, R[4]);
            } else if (v > 960) {
                g.px(px, py, R[1]);
            }
        }
    }
    // tufts
    for (let i = 0; i < w * h / 220; i++) {
        const tx = x + hash(i, 31, seed) % w, ty = y + hash(i, 37, seed) % h;
        g.px(tx, ty, R[4]);
        g.px(tx - 1, ty + 1, R[3]);
        g.px(tx + 1, ty + 1, R[3]);
        g.rect(tx - 1, ty + 2, 3, 1, R[1]);
    }
}

export function cobble(g, x, y, w, h, R, seed = 0) {
    g.rect(x, y, w, h, R[1]);
    let row = 0;
    for (let py = y; py < y + h; py += 5, row++) {
        for (let px = x - (row % 2 ? 3 : 0); px < x + w; px += 6) {
            const x1 = Math.max(x, px + 1), x2 = Math.min(x + w, px + 6);
            const hh = Math.min(4, y + h - py - 1);
            if (x2 <= x1 || hh <= 0)
                continue;
            const t = hash(px, py, seed) % 4;
            g.rect(x1, py + 1, x2 - x1, hh, t === 0 ? R[3] : R[2]);
            g.rect(x1, py + 1, x2 - x1, 1, R[4]);
            g.rect(x1, py + hh, x2 - x1, 1, mix(R[1], R[2], 0.5));
        }
    }
}

export function dirtPath(g, x, y, w, h, season, seed = 0) {
    const R = season === 'winter' ? [0xb8c4d8, 0xd0d8e8, 0xe8eef8, 0xf4f8ff, 0xffffff] : [0x7a5030, 0x9a6a40, 0xb88850, 0xd0a468, 0xe8c48a];
    g.rect(x, y, w, h, R[2]);
    for (let py = y; py < y + h; py++)
        for (let px = x; px < x + w; px++) {
            const v = hash(px, py, seed);
            if (v < 30)
                g.px(px, py, R[1]);
            else if (v > 970)
                g.px(px, py, R[3]);
            else if (v > 955)
                g.rect(px, py, 2, 1, R[4]);
        }
}

export function fence(g, x, y, w, R) {
    // posts every 16px with two rails
    g.rect(x, y - 9, w, 1, INK);
    g.rect(x, y - 8, w, 2, R[2]);
    g.rect(x, y - 8, w, 1, R[3]);
    g.rect(x, y - 6, w, 1, INK);
    g.rect(x, y - 4, w, 1, INK);
    g.rect(x, y - 3, w, 1, R[2]);
    g.rect(x, y - 2, w, 1, INK);
    for (let px = x; px < x + w; px += 16)
        fencePost(g, px, y, R);
    // closing post at the right end
    if ((w - 4) % 16 > 4)
        fencePost(g, x + w - 4, y, R);
}

function fencePost(g, px, y, R) {
    g.rect(px - 1, y - 14, 6, 15, INK);
    g.rect(px, y - 13, 4, 13, R[2]);
    g.rect(px, y - 13, 1, 13, R[3]);
    g.rect(px + 3, y - 13, 1, 13, R[1]);
    g.rect(px, y - 13, 4, 1, R[4]);
}

// fence running away from the viewer, from y1 (back) to y2 (front)
export function sideFence(g, x, y1, y2, R) {
    g.rect(x, y1 - 9, 4, y2 - y1 + 1, INK);
    g.rect(x + 1, y1 - 8, 2, y2 - y1 - 1, R[2]);
    g.rect(x + 1, y1 - 8, 1, y2 - y1 - 1, R[3]);
    for (let py = y1; py <= y2; py += 10)
        fencePost(g, x, py, R);
    if ((y2 - y1) % 10)
        fencePost(g, x, y2, R);
}
