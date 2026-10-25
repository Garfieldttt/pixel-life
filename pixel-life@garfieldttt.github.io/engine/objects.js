// Top-down world objects in the cozy pixel look. Each painter draws with its
// base (the point where it touches the ground) at (x, y) and returns the
// bounding box it covers, so the world can redraw it over walkers.
import {mix} from './gfx.js';
import * as A from './art.js';
import {bushClump} from './terrain.js';

const INK = A.INK;
const hash = (x, y, s = 0) => ((((x + s * 131) * 73856093) ^ ((y - s * 71) * 19349663)) >>> 0) % 1000;

const LEAVES = {
    spring: [0x123a20, 0x1e5a2a, 0x2e7a32, 0x48a03c, 0x78c858, 0xa8e078],
    summer: [0x0c2c1c, 0x164a26, 0x22682c, 0x358a34, 0x56aa40, 0x86c858],
    autumn: [0x3a160e, 0x6a2a14, 0x9a4418, 0xc86a20, 0xe8962c, 0xf8c448],
    winter: [0x1a3028, 0x284a3a, 0x3a6450, 0x5a8468, 0xd8e4f0, 0xffffff],
};
const MAPLE = {
    spring: LEAVES.spring,
    summer: [0x3a1a12, 0x6a2a1a, 0x9a3a22, 0xc04a2a, 0xe0703a, 0xf8a050],
    autumn: [0x4a120e, 0x7a1a12, 0xa82a18, 0xd84a20, 0xf07a30, 0xf8b050],
    winter: LEAVES.winter,
};
const PINE = [0x0a2420, 0x123a2c, 0x1c5236, 0x286a40, 0x3a8a4c, 0x5aaa60];
const BARK = [0x2a160e, 0x4a2a18, 0x6a4024, 0x8a5a34, 0xa87848];

// ---------------- trees ----------------

// Leafy tree: crown of many small clusters, lit from the top left.
export function tree(g, x, y, size, season, seed, kind = 'oak', snow = 0) {
    const R = kind === 'maple' ? MAPLE[season] : LEAVES[season];
    const tw = Math.max(6, Math.round(size * 0.36)), th = Math.round(size * 0.75);
    // shadow
    g.blend(x - size * 0.9, y - 3, size * 1.8, 6, 0x0a0818, 0.3);
    // trunk with roots
    g.rect(x - tw / 2 - 1, y - th, tw + 2, th, INK);
    for (let i = 0; i < th; i++) {
        const yy = y - th + i;
        g.rect(x - tw / 2, yy, tw, 1, BARK[2]);
        g.px(x - tw / 2, yy, BARK[3]);
        g.px(x - tw / 2 + 1, yy, BARK[3]);
        g.px(x + tw / 2 - 1, yy, BARK[1]);
        if (hash(x, yy, seed) < 250)
            g.px(x - tw / 2 + 2 + hash(yy, x, seed) % Math.max(1, tw - 3), yy, BARK[1]);
    }
    for (const dx of [-tw / 2 - 3, tw / 2]) {
        g.rect(x + dx - 1, y - 4, 5, 4, INK);
        g.rect(x + dx, y - 3, 3, 3, BARK[2]);
        g.px(x + dx, y - 3, BARK[3]);
    }
    if (season === 'winter' && kind !== 'pine' && seed % 3 !== 0) {
        bareBranches(g, x, y - th, size, seed, snow);
        return;
    }
    const cy = y - th - size * 0.6;
    const rx = size, ry = size * 0.85;
    // clusters on an irregular ellipse
    const cl = [];
    const n = Math.round(size * size / 9);
    for (let i = 0; i < n; i++) {
        const a = (hash(i, 1, seed) / 1000) * Math.PI * 2, d = Math.sqrt(hash(i, 2, seed) / 1000);
        cl.push([x + Math.cos(a) * rx * d * 0.82, cy + Math.sin(a) * ry * d * 0.82, 3 + hash(i, 3, seed) % 3]);
    }
    cl.sort((a, b) => a[1] - b[1]);
    for (const [cx, cy2, r] of cl)
        g.disc(Math.round(cx), Math.round(cy2), r + 1, INK);
    for (const [cx0, cy0, r] of cl) {
        const cx = Math.round(cx0), cyy = Math.round(cy0);
        // position inside the crown sets the base tone
        const gl = (-(cx - x) / rx * 0.55 - (cyy - cy) / ry * 0.85);
        const base = gl > 0.45 ? 4 : gl > 0.05 ? 3 : gl > -0.4 ? 2 : 1;
        for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
                const d2 = dx * dx + dy * dy;
                if (d2 > r * r)
                    continue;
                let k = base;
                const v = (-dx - dy) / r;
                if (v > 0.6)
                    k++;
                else if (v < -0.7 || d2 > (r - 0.6) * (r - 0.6) && dy > 0)
                    k--;
                if (hash(cx + dx, cyy + dy, seed) < 70)
                    k--;
                k = Math.max(0, Math.min(5, k));
                let c = R[k];
                if (snow > 0.2 && k >= 4)
                    c = 0xf4f8ff;
                g.px(cx + dx, cyy + dy, c);
            }
    }
    // sparkles of light and fruit
    for (let i = 0; i < size; i++) {
        const px = x + (hash(i, 5, seed) % (rx * 1.4)) - rx * 0.7 - 2, py = cy + (hash(i, 6, seed) % (ry * 1.2)) - ry * 0.7;
        g.px(px, py, R[5]);
    }
    if (kind === 'fruit' && (season === 'summer' || season === 'autumn'))
        for (let i = 0; i < size * 0.5; i++) {
            const fx = x + (hash(i, 7, seed) % (rx * 1.3)) - rx * 0.65, fy = cy + (hash(i, 8, seed) % ry) - ry * 0.4;
            g.rect(fx - 1, fy - 1, 4, 4, INK);
            g.rect(fx, fy, 2, 2, season === 'summer' ? 0xe83030 : 0xf0a020);
            g.px(fx, fy, 0xffa090);
        }
    if (season === 'spring' && kind === 'fruit')
        for (let i = 0; i < size; i++)
            g.px(x + (hash(i, 9, seed) % (rx * 1.4)) - rx * 0.7, cy + (hash(i, 10, seed) % ry) - ry * 0.5, i % 2 ? 0xf8c0d8 : 0xffffff);
}

function bareBranches(g, x, y, size, seed, snow) {
    for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + ((hash(i, 1, seed) / 1000) - 0.5) * 2.6;
        const len = size * (0.5 + hash(i, 2, seed) / 1500);
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        g.line(x - 1, y + 2, ex - 1, ey, INK);
        g.line(x, y + 2, ex, ey, BARK[2]);
        const ex2 = ex + Math.cos(a - 0.6) * len * 0.4, ey2 = ey + Math.sin(a - 0.6) * len * 0.4;
        g.line(ex, ey, ex2, ey2, BARK[1]);
        if (snow > 0.2) {
            g.px(ex, ey - 1, 0xf4f8ff);
            g.px(ex2, ey2 - 1, 0xf4f8ff);
        }
    }
}

export function pine(g, x, y, size, season, seed, snow = 0) {
    g.blend(x - size * 0.7, y - 3, size * 1.4, 6, 0x0a0818, 0.3);
    g.rect(x - 3, y - 8, 6, 8, INK);
    g.rect(x - 2, y - 8, 4, 8, BARK[2]);
    g.px(x - 2, y - 8, BARK[3]);
    const h = Math.round(size * 2.4);
    const tiers = 4;
    for (let t = tiers - 1; t >= 0; t--) {
        const ty = y - 6 - t * h / tiers / 1.15;
        const tw = size * (1 - t / tiers * 0.7);
        const thh = h / tiers * 1.2;
        for (let i = 0; i < thh; i++) {
            const half = Math.round(tw * (i / thh));
            const yy = Math.round(ty - thh + i);
            g.rect(x - half - 1, yy, half * 2 + 2, 1, INK);
            for (let xx = -half; xx < half; xx++) {
                const v = -xx / (half + 1);
                let k = v > 0.4 ? 4 : v > -0.2 ? 3 : 2;
                if (i > thh - 3)
                    k = 1;
                if (hash(x + xx, yy, seed) < 90)
                    k--;
                let c = PINE[Math.max(0, k)];
                if (snow > 0.2 && i < 3 + (hash(xx, yy, seed) % 3))
                    c = 0xf4f8ff;
                g.px(x + xx, yy, c);
            }
        }
    }
    g.rect(x - 1, Math.round(y - 6 - h - 2), 2, 3, INK);
}

// ---------------- houses ----------------

// Where doors and windows go, shared by drawing and the dynamic windows.
// Sized for people about 31px tall.
export function houseLayout(x, y, w, style, wallH) {
    const door = {x: Math.round(x + w / 2 - 8), y: y - 34, w: 16, h: 34};
    const wins = [];
    const ww = 16, wh = 20, wy = y - wallH + (style === 'gable' ? 14 : 12);
    for (const wx of [x + Math.round(w * 0.2) - 4, x + Math.round(w * 0.8) - ww + 4])
        if (Math.abs(wx + ww / 2 - (door.x + 8)) >= 22)
            wins.push({x: wx, y: wy, w: ww, h: wh});
    return {door, wins};
}

// Top-down house: roof seen from above-front, a front wall with door and
// windows on a stone plinth. style 'hip' (long roof) or 'gable' (A-frame).
export function house(g, x, y, w, opts) {
    const {wallH = 34, roofH = 36, wallR, roofR, mat = 'planks', seed = 1, frameR, chimney = true, season = 'summer', style = 'hip'} = opts;
    const top = y - wallH;
    g.blend(x - 6, y - 2, w + 14, 7, 0x0a0818, 0.32);
    // wall
    g.rect(x - 1, top, w + 2, wallH, INK);
    if (mat === 'stone')
        A.wallStone(g, x, top, w, wallH, wallR, seed);
    else if (mat === 'brick')
        A.wallBrick(g, x, top, w, wallH, wallR, seed);
    else if (mat === 'siding')
        A.wallSiding(g, x, top, w, wallH, wallR, seed);
    else
        A.wallPlanks(g, x, top, w, wallH, wallR, seed);
    g.rect(x, top, 3, wallH, mix(wallR[3], wallR[2], 0.3));
    g.rect(x + w - 3, top, 3, wallH, wallR[1]);
    // corner posts and stone plinth
    const post = A.ramp(0x6a4228);
    if (mat === 'planks' || mat === 'siding') {
        g.rect(x, top, 3, wallH, post[2]);
        g.rect(x + w - 3, top, 3, wallH, post[1]);
    }
    const plinth = A.ramp(0x8a8478);
    g.rect(x - 2, y - 6, w + 4, 6, INK);
    A.wallStone(g, x - 1, y - 5, w + 2, 5, plinth, seed + 3);
    const rTop = top - roofH;
    if (chimney)
        A.chimney(g, x + Math.round(w * 0.72), rTop - (style === 'gable' ? -6 : 6), 9, 16, A.ramp(0x9a9aa4));
    if (style === 'gable') {
        // A-frame: big triangle of shingles, eaves reaching past the wall
        const cx = x + w / 2;
        A.shingles(g, rTop, top + 4, yy => {
            const t = (yy - rTop + 1) / (roofH + 4);
            const half = (w / 2 + 6) * Math.min(1, t * 1.25);
            return [Math.round(cx - half), Math.round(cx + half)];
        }, roofR, seed, 8, 5);
        g.rect(x - 6, top + 4, w + 12, 1, INK);
        g.rect(x - 5, top + 3, w + 10, 1, roofR[0]);
        g.line(cx, rTop - 1, x - 7, top + 4, INK);
        g.line(cx, rTop - 1, x + w + 6, top + 4, INK);
        // little round attic window
        g.disc(cx, rTop + roofH * 0.55, 4, INK);
        g.disc(cx, rTop + roofH * 0.55, 3, frameR[2]);
        g.disc(cx, rTop + roofH * 0.55, 2, A.GLASS[2]);
        g.px(cx - 1, rTop + roofH * 0.55 - 1, A.GLASS[4]);
    } else {
        A.shingles(g, rTop, top + 3, yy => {
            const t = (yy - rTop) / roofH;
            const inset = Math.round(Math.max(0, 1 - t * 4) * 5);
            return [x - 5 + inset, x + w + 5 - inset];
        }, roofR, seed, 8, 5);
        g.rect(x, rTop - 1, w, 1, INK);
        g.rect(x - 5, top + 3, w + 10, 1, INK);
        g.rect(x - 4, top + 2, w + 8, 1, roofR[0]);
        g.rect(x + 2, rTop, w - 4, 2, roofR[4]);
        g.rect(x + 2, rTop + 2, w - 4, 1, roofR[3]);
    }
    if (season === 'winter') {
        const sh = Math.round(roofH * 0.65);
        for (let i = 0; i < sh; i++) {
            const t = (i + 1) / (roofH + 4), half = style === 'gable' ? (w / 2 + 5) * Math.min(1, t * 1.25) : w / 2 + 4;
            g.rect(Math.round(x + w / 2 - half), rTop + i, Math.round(half * 2), 1, i % 4 === 3 ? 0xdce6f6 : 0xf4f8ff);
        }
    }
    const L = houseLayout(x, y, w, style, wallH);
    A.door(g, L.door.x, L.door.y, L.door.w, L.door.h, A.ramp(opts.doorColor || 0x8a4a30), 1);
    // door canopy
    g.rect(L.door.x - 4, L.door.y - 5, L.door.w + 8, 3, INK);
    g.rect(L.door.x - 3, L.door.y - 4, L.door.w + 6, 1, roofR[3]);
    for (const wn of L.wins) {
        A.windowFrame(g, wn.x, wn.y, wn.w, wn.h, frameR);
        // shutters
        for (const sx of [wn.x - 6, wn.x + wn.w + 2]) {
            g.rect(sx - 1, wn.y - 2, 6, wn.h + 4, INK);
            g.rect(sx, wn.y - 1, 4, wn.h + 2, roofR[2]);
            for (let i = 1; i < wn.h; i += 3)
                g.rect(sx + 1, wn.y + i, 2, 1, roofR[1]);
        }
    }
    g.rect(L.door.x + L.door.w + 3, L.door.y + 2, 4, 5, INK);
    g.rect(L.door.x + L.door.w + 4, L.door.y + 3, 2, 3, 0xe8d8a0);
    return L;
}

// ---------------- props ----------------

// A post well above head height of the people.
export function lampPost(g, x, y) {
    const P = 48;
    g.blend(x - 4, y - 2, 9, 3, 0x0a0818, 0.3);
    g.rect(x - 2, y - P, 4, P, INK);
    g.rect(x - 1, y - P, 2, P, 0x3a3a48);
    g.px(x - 1, y - P, 0x6a6a7a);
    g.rect(x - 4, y - 4, 8, 4, INK);
    g.rect(x - 3, y - 3, 6, 3, 0x3a3a48);
    g.rect(x - 5, y - P - 10, 10, 11, INK);
    g.rect(x - 4, y - P - 9, 8, 9, 0x2a2a38);
    g.rect(x - 3, y - P - 7, 6, 6, 0xd8d0b0);
    g.rect(x - 6, y - P - 12, 12, 3, INK);
    g.rect(x - 5, y - P - 11, 10, 1, 0x5a5a6a);
    return [x - 3, y - P - 7, 6, 6];
}

export function bench(g, x, y, R = A.ramp(0x9a6a40)) {
    g.blend(x - 1, y - 2, 24, 3, 0x0a0818, 0.3);
    g.rect(x - 1, y - 14, 24, 6, INK);
    g.rect(x, y - 13, 22, 4, R[2]);
    g.rect(x, y - 13, 22, 1, R[3]);
    g.rect(x - 1, y - 9, 24, 5, INK);
    g.rect(x, y - 8, 22, 3, R[3]);
    g.rect(x, y - 8, 22, 1, R[4]);
    g.rect(x + 1, y - 5, 2, 5, INK);
    g.rect(x + 19, y - 5, 2, 5, INK);
}

export function barrel(g, x, y) {
    const R = A.ramp(0x9a5a2a);
    g.blend(x - 1, y - 2, 12, 3, 0x0a0818, 0.3);
    g.rect(x - 1, y - 14, 12, 14, INK);
    g.rect(x, y - 13, 10, 12, R[2]);
    g.rect(x, y - 13, 3, 12, R[3]);
    g.rect(x + 8, y - 13, 2, 12, R[1]);
    g.rect(x, y - 11, 10, 1, 0x4a4a54);
    g.rect(x, y - 4, 10, 1, 0x4a4a54);
    g.rect(x + 1, y - 14, 8, 2, R[1]);
    g.rect(x + 2, y - 14, 6, 1, R[0]);
}

export function crate(g, x, y) {
    // plank crate: a frame of darker boards, a diagonal brace, nails
    const R = A.ramp(0xb8884a);
    g.blend(x - 1, y - 2, 14, 3, 0x0a0818, 0.3);
    g.rect(x - 1, y - 13, 14, 13, INK);
    g.rect(x, y - 12, 12, 11, R[2]);
    for (let py = y - 9; py < y - 2; py += 3)
        g.rect(x + 2, py, 8, 1, R[1]);
    g.rect(x, y - 12, 12, 2, R[3]);
    g.rect(x, y - 12, 12, 1, R[4]);
    g.rect(x, y - 3, 12, 2, R[1]);
    g.rect(x, y - 12, 2, 11, R[3]);
    g.rect(x + 10, y - 12, 2, 11, R[1]);
    g.line(x + 2, y - 4, x + 9, y - 10, R[0]);
    for (const [nx, ny] of [[x + 1, y - 11], [x + 10, y - 11], [x + 1, y - 2], [x + 10, y - 2]])
        g.px(nx, ny, 0x5a5a64);
}

export function brazier(g, x, y) {
    g.rect(x - 5, y - 10, 10, 4, INK);
    g.rect(x - 4, y - 9, 8, 2, 0x5a5a64);
    g.line(x - 3, y - 6, x - 5, y, INK);
    g.line(x + 3, y - 6, x + 5, y, INK);
    g.line(x, y - 6, x, y, INK);
    return [x, y - 11];
}

export function well(g, x, y, season) {
    const S = A.ramp(0xa8a098), W = A.ramp(0x8a5a30), roof = A.ramp(0xa84838);
    g.blend(x - 14, y - 3, 28, 6, 0x0a0818, 0.3);
    g.rect(x - 13, y - 14, 26, 14, INK);
    A.wallStone(g, x - 12, y - 13, 24, 12, S, x);
    g.rect(x - 11, y - 16, 22, 4, INK);
    g.rect(x - 10, y - 15, 20, 2, 0x1a2a5a);
    g.rect(x - 11, y - 36, 2, 22, INK);
    g.rect(x + 9, y - 36, 2, 22, INK);
    g.rect(x - 10, y - 35, 1, 20, W[2]);
    g.rect(x + 10, y - 35, 1, 20, W[2]);
    for (let i = 0; i < 7; i++) {
        g.rect(x - 15 + i, y - 44 + i, 30 - i * 2, 1, INK);
        if (i)
            g.rect(x - 14 + i, y - 44 + i, 28 - i * 2, 1, season === 'winter' ? 0xeef4ff : roof[i < 3 ? 3 : 2]);
    }
    g.rect(x - 1, y - 30, 2, 8, 0x5a4a3a);
    g.rect(x - 3, y - 24, 6, 5, INK);
    g.rect(x - 2, y - 23, 4, 3, W[3]);
}

export function fountain(g, x, y, season) {
    const S = A.ramp(0xb8b0a8);
    g.blend(x - 22, y - 3, 44, 6, 0x0a0818, 0.3);
    g.rect(x - 22, y - 16, 44, 16, INK);
    g.rect(x - 21, y - 15, 42, 14, S[2]);
    g.rect(x - 21, y - 15, 42, 2, S[4]);
    g.rect(x - 21, y - 3, 42, 2, S[1]);
    g.rect(x - 18, y - 13, 36, 8, INK);
    g.rect(x - 17, y - 12, 34, 7, season === 'winter' ? 0xd8e8f8 : 0x3a78c8);
    g.rect(x - 17, y - 12, 34, 1, 0x80b8f0);
    g.rect(x - 4, y - 32, 8, 22, INK);
    g.rect(x - 3, y - 31, 6, 20, S[3]);
    g.rect(x - 3, y - 31, 2, 20, S[4]);
    g.rect(x - 9, y - 35, 18, 5, INK);
    g.rect(x - 8, y - 34, 16, 3, S[3]);
    return [x, y - 36];
}

export function stall(g, x, y, color, goods, season) {
    const W = A.ramp(0x9a6a3a), C = A.ramp(color);
    g.blend(x - 2, y - 3, 44, 6, 0x0a0818, 0.3);
    // counter
    g.rect(x - 1, y - 14, 42, 14, INK);
    g.rect(x, y - 13, 40, 12, W[2]);
    g.rect(x, y - 13, 40, 2, W[4]);
    for (let i = 4; i < 40; i += 8)
        g.rect(x + i, y - 11, 1, 10, W[1]);
    // goods on the counter
    for (let i = 3; i < 38; i += 5) {
        const c = goods[(i / 5 | 0) % goods.length];
        g.rect(x + i - 1, y - 18, 5, 5, INK);
        g.rect(x + i, y - 17, 3, 3, c);
        g.px(x + i, y - 17, mix(c, 0xffffff, 0.5));
    }
    // posts and striped awning
    g.rect(x, y - 40, 2, 26, INK);
    g.rect(x + 38, y - 40, 2, 26, INK);
    g.rect(x - 4, y - 46, 48, 12, INK);
    for (let i = 0; i < 46; i++) {
        const c = Math.floor(i / 6) % 2 ? 0xf4f0e4 : C[2];
        g.rect(x - 3 + i, y - 45, 1, 9, c);
        g.px(x - 3 + i, y - 45, mix(c, 0xffffff, 0.3));
    }
    for (let i = 0; i < 46; i += 6) {
        g.rect(x - 3 + i, y - 36, 5, 2, Math.floor(i / 6) % 2 ? 0xf4f0e4 : C[2]);
        g.rect(x - 3 + i, y - 34, 5, 1, INK);
    }
    if (season === 'winter')
        g.rect(x - 3, y - 46, 46, 3, 0xf4f8ff);
}

export function signpost(g, x, y) {
    const W = A.ramp(0x9a6a3a);
    g.rect(x - 1, y - 22, 4, 22, INK);
    g.rect(x, y - 22, 2, 22, W[2]);
    g.rect(x - 9, y - 26, 20, 9, INK);
    g.rect(x - 8, y - 25, 18, 7, W[3]);
    g.rect(x - 6, y - 23, 14, 1, W[1]);
    g.rect(x - 6, y - 21, 10, 1, W[1]);
}

export function mailbox(g, x, y) {
    g.rect(x - 1, y - 14, 3, 14, INK);
    g.rect(x - 6, y - 21, 13, 8, INK);
    g.rect(x - 5, y - 20, 11, 6, 0x4c7cd0);
    g.rect(x - 5, y - 20, 11, 1, 0x7aa8f0);
    g.rect(x + 5, y - 24, 2, 5, 0xd84848);
}

export function rock(g, x, y, s, size = 1) {
    g.footShadow(x + 9, y, 20, 0.3);
    A.boulder(g, x, y, hash(x, y, s), 'summer');
}

export function stump(g, x, y) {
    g.footShadow(x + 7, y, 20, 0.3);
    A.stump(g, x, y, 'spring');
}

export function flowerPot(g, x, y, c, season) {
    const R = A.ramp(0xc8683a);
    g.rect(x - 1, y - 8, 12, 8, INK);
    g.rect(x, y - 7, 10, 6, R[2]);
    g.rect(x, y - 7, 10, 1, R[4]);
    if (season === 'winter')
        return;
    bushClump(g, x - 2, y - 18, 14, 12, season, x + y, false);
    for (let i = 0; i < 4; i++) {
        g.rect(x + 1 + i * 2, y - 16 + (i % 2) * 3, 2, 2, c);
        g.px(x + 1 + i * 2, y - 16 + (i % 2) * 3, mix(c, 0xffffff, 0.5));
    }
}

export function pumpkin(g, x, y) {
    const R = A.ramp(0xf08a20);
    g.rect(x - 1, y - 9, 14, 9, INK);
    g.rect(x, y - 8, 12, 7, R[2]);
    g.rect(x + 3, y - 8, 1, 7, R[1]);
    g.rect(x + 8, y - 8, 1, 7, R[1]);
    g.rect(x + 1, y - 8, 2, 1, R[4]);
    g.rect(x + 5, y - 11, 2, 3, 0x4a7a2a);
}

export function snowman(g, x, y) {
    g.disc(x, y - 7, 7, INK);
    g.disc(x, y - 7, 6, 0xf4f8ff);
    g.disc(x, y - 18, 5, INK);
    g.disc(x, y - 18, 4, 0xffffff);
    g.px(x - 2, y - 19, INK);
    g.px(x + 1, y - 19, INK);
    g.rect(x, y - 17, 3, 1, 0xf08a20);
    g.rect(x - 4, y - 25, 9, 3, INK);
    g.rect(x - 3, y - 29, 7, 4, INK);
    g.rect(x - 5, y - 14, 10, 2, 0xd84848);
}

export function fenceRun(g, x, y, w, R = A.ramp(0xb07a48)) {
    A.fence(g, x, y, w, R);
}

export function gardenBed(g, x, y, w, season) {
    const R = A.ramp(0x7a4a2a);
    g.rect(x - 1, y - 9, w + 2, 9, INK);
    g.rect(x, y - 8, w, 7, R[2]);
    g.rect(x, y - 8, w, 1, R[3]);
    if (season === 'winter')
        return;
    for (let i = 2; i < w - 2; i += 5) {
        g.rect(x + i, y - 12, 3, 5, 0x3e8a34);
        g.rect(x + i, y - 13, 3, 2, [0xe84860, 0xf8d048, 0xf0f0f0, 0xb860d8, 0xf890b0][(i + x) % 5]);
    }
}

export function boat(g, x, y) {
    const R = A.ramp(0xa8603a);
    g.rect(x - 1, y - 8, 30, 9, INK);
    g.rect(x, y - 7, 28, 6, R[2]);
    g.rect(x, y - 7, 28, 1, R[4]);
    g.rect(x + 3, y - 5, 22, 3, R[1]);
    g.rect(x + 12, y - 5, 2, 3, R[3]);
}
