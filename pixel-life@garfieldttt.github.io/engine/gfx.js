// Software pixel buffer. Colors are 0xRRGGBB ints. World colors go through
// the ambient light (rect, px, sprite), light sources do not (rectE, pxE).
// The buffer is RGBA bytes, ready for St.ImageContent or a canvas ImageData.

export function pack(r, g, b) {
    return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

// Light sources carry alpha 254 so the ambient pass leaves them bright.
function packE(r, g, b) {
    return (0xfe000000 | (b << 16) | (g << 8) | r) >>> 0;
}

export function mix(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const r = ar + (((b >> 16) & 255) - ar) * t;
    const g = ag + (((b >> 8) & 255) - ag) * t;
    const bl = ab + ((b & 255) - ab) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

export function scale(c, f) {
    const r = Math.min(255, ((c >> 16) & 255) * f);
    const g = Math.min(255, ((c >> 8) & 255) * f);
    const b = Math.min(255, (c & 255) * f);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// Hue-shifted shading: shadows drift to purple, highlights to warm yellow.
export const shadow = (c, t = 0.3) => mix(c, 0x2a1838, t);
export const highlight = (c, t = 0.25) => mix(c, 0xfff2c0, t);
export const OUTLINE = 0x3a2230;

// Sprite from text rows; every non-space char is a palette key.
export function sprite(rows) {
    const pts = [];
    let w = 0;
    rows.forEach((row, y) => {
        w = Math.max(w, row.length);
        for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch !== ' ' && ch !== '.')
                pts.push(x, y, ch);
        }
    });
    return {w, h: rows.length, pts};
}

const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111',
    2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
    6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
    '/': '001001010100100', '-': '000000111000000', '&': '010101010101011', '!': '010010010000010',
    '.': '000000000000010', ':': '000010000010000', ' ': '000000000000000', "'": '010010000000000',
};

export class Gfx {
    constructor(w, h) {
        this.shadeCache = new Map();
        this.emCache = new Map();
        this.ar = this.ag = this.ab = 1;
        this.layerVersion = 0;
        this.resize(w, h);
    }

    resize(w, h) {
        this.w = w;
        this.h = h;
        this.buf = new Uint32Array(w * h);
        this.bytes = new Uint8Array(this.buf.buffer);
        this.t = this.buf;
    }

    layer() {
        return new Uint32Array(this.w * this.h);
    }

    // Draw into another layer (static backgrounds).
    into(target, fn) {
        const old = this.t;
        this.t = target;
        try {
            fn();
        } finally {
            this.t = old;
        }
    }

    // Copy the opaque pixels of a layer onto the target, rows y1..y2.
    // Layers are drawn unlit; lit=true applies the ambient light here,
    // except to light sources (alpha 254).
    compose(layer, y1 = 0, y2 = this.h, lit = false) {
        const W = this.w;
        const s = Math.max(0, Math.floor(y1)) * W, e = Math.min(this.h, Math.ceil(y2)) * W;
        const runs = this._runs(layer);
        if (!lit || (this.ar === 1 && this.ag === 1 && this.ab === 1)) {
            this._copyRuns(layer, runs, s, e);
            return;
        }
        // the lit copy is cached until the light or the layer changes
        this.litCache = this.litCache || new WeakMap();
        const key = this._luts().lutKey + '|' + this.layerVersion;
        let c = this.litCache.get(layer);
        if (!c || c.key !== key) {
            const {lr, lg, lb} = this;
            const reuse = c && c.buf.length === layer.length;
            const buf = reuse ? c.buf : new Uint32Array(layer.length);
            if (reuse)
                buf.fill(0);
            for (let r = 0; r < runs.length; r += 2) {
                for (let i = runs[r]; i < runs[r + 1]; i++) {
                    const p = layer[i];
                    buf[i] = (p >>> 24) === 254 ? p : (0xff000000 | lb[(p >> 16) & 255] | lg[(p >> 8) & 255] | lr[p & 255]) >>> 0;
                }
            }
            c = {key, buf};
            this.litCache.set(layer, c);
        }
        this._copyRuns(c.buf, runs, s, e);
    }

    // Start/end index pairs of the non-transparent stretches of a layer,
    // kept until the static layers are drawn again. Copying those whole
    // stretches is much faster than testing every pixel each frame.
    _runs(layer) {
        this.runCache = this.runCache || new WeakMap();
        let c = this.runCache.get(layer);
        if (!c || c.version !== this.layerVersion) {
            const runs = [], n = layer.length;
            let i = 0;
            while (i < n) {
                while (i < n && !layer[i])
                    i++;
                const start = i;
                while (i < n && layer[i])
                    i++;
                if (i > start)
                    runs.push(start, i);
            }
            c = {version: this.layerVersion, runs: Int32Array.from(runs)};
            this.runCache.set(layer, c);
        }
        return c.runs;
    }

    _copyRuns(src, runs, s, e) {
        const t = this.t;
        for (let r = 0; r < runs.length; r += 2) {
            const a = Math.max(runs[r], s), b = Math.min(runs[r + 1], e);
            if (a < b)
                t.set(src.subarray(a, b), a);
        }
    }

    // The cached lit copy of a layer (after compose(..., true) ran this frame).
    litBuffer(layer) {
        const c = this.litCache && this.litCache.get(layer);
        return c ? c.buf : null;
    }

    _luts() {
        if (this.lutKey !== this.ar + ':' + this.ag + ':' + this.ab) {
            this.lutKey = this.ar + ':' + this.ag + ':' + this.ab;
            this.lr = new Uint32Array(256);
            this.lg = new Uint32Array(256);
            this.lb = new Uint32Array(256);
            for (let v = 0; v < 256; v++) {
                this.lr[v] = Math.min(255, v * this.ar) | 0;
                this.lg[v] = (Math.min(255, v * this.ag) | 0) << 8;
                this.lb[v] = (Math.min(255, v * this.ab) | 0) << 16;
            }
        }
        return this;
    }

    // Run fn with neutral light (for drawing unlit static layers).
    unlit(fn) {
        const a = [this.ar, this.ag, this.ab];
        this.setAmbient(1, 1, 1);
        try {
            fn();
        } finally {
            this.setAmbient(...a);
        }
    }

    setAmbient(r, g, b) {
        if (r === this.ar && g === this.ag && b === this.ab)
            return;
        this.ar = r;
        this.ag = g;
        this.ab = b;
        this.shadeCache.clear();
    }

    sh(c) {
        let v = this.shadeCache.get(c);
        if (v === undefined) {
            v = pack(Math.min(255, ((c >> 16) & 255) * this.ar) | 0,
                Math.min(255, ((c >> 8) & 255) * this.ag) | 0,
                Math.min(255, (c & 255) * this.ab) | 0);
            this.shadeCache.set(c, v);
        }
        return v;
    }

    em(c) {
        let v = this.emCache.get(c);
        if (v === undefined) {
            v = packE((c >> 16) & 255, (c >> 8) & 255, c & 255);
            this.emCache.set(c, v);
        }
        return v;
    }

    fill(x, y, w, h, p) {
        let x1 = Math.floor(x), y1 = Math.floor(y);
        let x2 = Math.floor(x + w), y2 = Math.floor(y + h);
        if (x1 < 0)
            x1 = 0;
        if (y1 < 0)
            y1 = 0;
        if (x2 > this.w)
            x2 = this.w;
        if (y2 > this.h)
            y2 = this.h;
        if (x1 >= x2 || y1 >= y2)
            return;
        const t = this.t, W = this.w;
        for (let yy = y1; yy < y2; yy++)
            t.fill(p, yy * W + x1, yy * W + x2);
    }

    clear(c) {
        this.t.fill(c === undefined ? 0 : this.sh(c));
    }

    rect(x, y, w, h, c) {
        this.fill(x, y, w, h, this.sh(c));
    }

    rectE(x, y, w, h, c) {
        this.fill(x, y, w, h, this.em(c));
    }

    px(x, y, c) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x >= 0 && y >= 0 && x < this.w && y < this.h)
            this.t[y * this.w + x] = this.sh(c);
    }

    pxE(x, y, c) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x >= 0 && y >= 0 && x < this.w && y < this.h)
            this.t[y * this.w + x] = this.em(c);
    }

    // Alpha blend a color over what is there.
    blend(x, y, w, h, c, a, emissive = false) {
        let x1 = Math.floor(x), y1 = Math.floor(y);
        let x2 = Math.floor(x + w), y2 = Math.floor(y + h);
        if (x1 < 0)
            x1 = 0;
        if (y1 < 0)
            y1 = 0;
        if (x2 > this.w)
            x2 = this.w;
        if (y2 > this.h)
            y2 = this.h;
        if (x1 >= x2 || y1 >= y2 || a <= 0)
            return;
        const p = emissive ? this.em(c) : this.sh(c);
        const cr = p & 255, cg = (p >> 8) & 255, cb = (p >> 16) & 255;
        const t = this.t, W = this.w;
        for (let yy = y1; yy < y2; yy++) {
            for (let i = yy * W + x1, e = yy * W + x2; i < e; i++) {
                const s = t[i];
                if (s === 0)
                    continue; // transparent layer pixel
                const r = s & 255, g = (s >> 8) & 255, b = (s >> 16) & 255;
                t[i] = (0xff000000 | ((b + (cb - b) * a) << 16) | ((g + (cg - g) * a) << 8) | (r + (cr - r) * a)) >>> 0;
            }
        }
    }

    // Contact shadow: a flat stepped ellipse whose middle row is the row the
    // feet stand on (bottom - 1), so figures stand in it instead of on it.
    footShadow(cx, bottom, w, a = 0.3) {
        const half = Math.max(2, Math.round(w / 2)), y = Math.floor(bottom) - 1;
        cx = Math.floor(cx);
        const end = Math.max(1, Math.round(half * 0.65));
        this.blend(cx - end, y - 1, end * 2, 1, 0x1a1028, a * 0.7);
        this.blend(cx - half, y, half * 2, 1, 0x1a1028, a);
        this.blend(cx - end, y + 1, end * 2, 1, 0x1a1028, a * 0.7);
        this.blend(cx - Math.round(half * 0.5), y, Math.round(half * 0.5) * 2, 1, 0x1a1028, a * 0.5);
    }

    // Additive light (lamps, beams). a = strength 0..1.
    add(x, y, w, h, c, a) {
        let x1 = Math.floor(x), y1 = Math.floor(y);
        let x2 = Math.floor(x + w), y2 = Math.floor(y + h);
        if (x1 < 0)
            x1 = 0;
        if (y1 < 0)
            y1 = 0;
        if (x2 > this.w)
            x2 = this.w;
        if (y2 > this.h)
            y2 = this.h;
        if (x1 >= x2 || y1 >= y2 || a <= 0)
            return;
        const cr = ((c >> 16) & 255) * a, cg = ((c >> 8) & 255) * a, cb = (c & 255) * a;
        const t = this.t, W = this.w;
        for (let yy = y1; yy < y2; yy++) {
            for (let i = yy * W + x1, e = yy * W + x2; i < e; i++) {
                const s = t[i];
                if (s === 0)
                    continue;
                const r = Math.min(255, (s & 255) + cr), g = Math.min(255, ((s >> 8) & 255) + cg), b = Math.min(255, ((s >> 16) & 255) + cb);
                t[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
            }
        }
    }

    // Soft round light pool; sy squashes it vertically (ground light).
    glow(cx, cy, r, c, a, sy = 1) {
        if (a <= 0.01 || r < 1)
            return;
        const ry = r * sy;
        const x1 = Math.max(0, Math.floor(cx - r)), x2 = Math.min(this.w, Math.ceil(cx + r));
        const y1 = Math.max(0, Math.floor(cy - ry)), y2 = Math.min(this.h, Math.ceil(cy + ry));
        const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;
        const t = this.t, W = this.w;
        for (let y = y1; y < y2; y++) {
            const dy = (y + 0.5 - cy) / ry;
            if (dy * dy >= 1)
                continue;
            // only the width of the circle on this row
            const span = r * Math.sqrt(1 - dy * dy);
            const xa = Math.max(x1, Math.floor(cx - 0.5 - span)), xb = Math.min(x2, Math.ceil(cx - 0.5 + span) + 1);
            for (let x = xa; x < xb; x++) {
                const dx = (x + 0.5 - cx) / r;
                const d = dx * dx + dy * dy;
                if (d >= 1)
                    continue;
                // Stepped falloff gives the banded pixel-art light look.
                const f = a * Math.ceil((1 - d) * (1 - d) * 4) / 4;
                const i = y * W + x, s = t[i];
                if (s === 0)
                    continue;
                const rr = Math.min(255, (s & 255) + cr * f), gg = Math.min(255, ((s >> 8) & 255) + cg * f), bb = Math.min(255, ((s >> 16) & 255) + cb * f);
                t[i] = (0xff000000 | (bb << 16) | (gg << 8) | rr) >>> 0;
            }
        }
    }

    disc(cx, cy, r, c, emissive = false) {
        const p = emissive ? this.em(c) : this.sh(c);
        for (let y = -r; y <= r; y++) {
            const hw = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
            this.fill(cx - hw, cy + y, hw * 2 + 1, 1, p);
        }
    }

    line(x0, y0, x1, y1, c, emissive = false) {
        x0 = Math.floor(x0);
        y0 = Math.floor(y0);
        x1 = Math.floor(x1);
        y1 = Math.floor(y1);
        const p = emissive ? this.em(c) : this.sh(c);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let n = 0; n < 2000; n++) {
            if (x0 >= 0 && y0 >= 0 && x0 < this.w && y0 < this.h)
                this.t[y0 * this.w + x0] = p;
            if (x0 === x1 && y0 === y1)
                break;
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    // pal: {key: color | null}; keys missing from pal are skipped.
    sprite(sp, x, y, pal, flip = false, emissive = false) {
        x = Math.floor(x);
        y = Math.floor(y);
        const pts = sp.pts;
        for (let i = 0; i < pts.length; i += 3) {
            const c = pal[pts[i + 2]];
            if (c === undefined || c === null)
                continue;
            const px = flip ? x + sp.w - 1 - pts[i] : x + pts[i];
            if (emissive)
                this.pxE(px, y + pts[i + 1], c);
            else
                this.px(px, y + pts[i + 1], c);
        }
    }

    text(s, x, y, c, emissive = false, size = 1) {
        s = String(s).toUpperCase();
        for (let n = 0; n < s.length; n++) {
            const g = FONT[s[n]];
            if (g) {
                for (let i = 0; i < 15; i++) {
                    if (g[i] === '1') {
                        const px = x + (i % 3) * size, py = y + Math.floor(i / 3) * size;
                        if (emissive)
                            this.rectE(px, py, size, size, c);
                        else
                            this.rect(px, py, size, size, c);
                    }
                }
            }
            x += 4 * size;
        }
    }

    textWidth(s, size = 1) {
        return String(s).length * 4 * size - size;
    }
}
