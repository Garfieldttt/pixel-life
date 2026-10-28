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

// Selective outlines (sel-out): instead of one near-black everywhere, an
// outline takes a dark shade of the color it encloses, as hand-drawn
// pixel art does. The two plain outline colors are recolored; anything
// else drawn dark stays as it is.
const SELOUT = new Set([0x3a2230, 0x2c1a2a]);
const lum = c => ((c >> 16) & 255) * 3 + ((c >> 8) & 255) * 6 + (c & 255);
export function isOutline(c) {
    return SELOUT.has(c);
}
// darkest of the neighbouring colors, deepened towards a cool purple
export function outlineOf(colors) {
    let best = colors[0];
    for (const c of colors)
        if (lum(c) < lum(best))
            best = c;
    return mix(best, 0x1a0a20, 0.68);
}

const unpack = p => ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255);
const SELOUT_PACKED = new Set([...SELOUT].map(c => pack(c >> 16, (c >> 8) & 255, c & 255)));

// Recolor the plain outline pixels in a box of a packed pixel buffer
// (row width W) from their opaque neighbours.
export function seloutBuffer(buf, W, H, x0 = 0, y0 = 0, w = W, h = H) {
    const changes = [];
    const x1 = Math.max(0, x0), y1 = Math.max(0, y0), x2 = Math.min(W, x0 + w), y2 = Math.min(H, y0 + h);
    for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
            const i = y * W + x;
            if (!SELOUT_PACKED.has(buf[i]))
                continue;
            const n = [];
            for (const j of [x > x1 ? i - 1 : -1, x < x2 - 1 ? i + 1 : -1, y > y1 ? i - W : -1, y < y2 - 1 ? i + W : -1]) {
                const v = j >= 0 ? buf[j] : 0;
                if (v && !SELOUT_PACKED.has(v) && (v >>> 24) === 255)
                    n.push(unpack(v));
            }
            if (n.length) {
                const c = outlineOf(n);
                changes.push(i, pack(c >> 16, (c >> 8) & 255, c & 255));
            }
        }
    }
    for (let k = 0; k < changes.length; k += 2)
        buf[changes[k]] = changes[k + 1];
}

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
        // feet drawn on screen this frame and the last ([x, y, width]
        // flat, from footShadow), so grass can rustle where somebody walks
        this.steps = [];
        this.prevSteps = [];
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
        this._copyRuns(lit ? this.litBuffer(layer) : layer, runs, s, e);
    }

    // The layer in the current light, as compose(..., true) puts it on
    // screen; in full daylight that is the layer itself. The lit copy is
    // cached until the light or the layer changes.
    litBuffer(layer) {
        if (this.ar === 1 && this.ag === 1 && this.ab === 1)
            return layer;
        const runs = this._runs(layer);
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
        return c.buf;
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

    // Draw one object through the empty scratch layer into target and
    // return its pixel mask {box, mask} (null if nothing was drawn); hint
    // = rough box [x, y, w, h] it paints into. Walkers behind it get the
    // masked pixels copied back with occlude(). Without a target the
    // pixels are kept as a sprite (px) for drawSprite().
    masked(target, scratch, hint, draw) {
        const W = this.w, H = this.h, S = scratch;
        this.into(S, draw);
        const [hx, hy, hw, hh] = hint;
        const sx1 = Math.max(0, Math.floor(hx) - 8), sx2 = Math.min(W, Math.ceil(hx + hw) + 8);
        const sy1 = Math.max(0, Math.floor(hy) - 8), sy2 = Math.min(H, Math.ceil(hy + hh) + 8);
        // alone on the scratch layer the object's own colors are known
        seloutBuffer(S, W, H, sx1, sy1, sx2 - sx1, sy2 - sy1);
        let x1 = W, y1 = H, x2 = -1, y2 = -1;
        for (let y = sy1; y < sy2; y++) {
            const row = y * W;
            let any = false;
            for (let x = sx1; x < sx2; x++) {
                if (S[row + x]) {
                    any = true;
                    if (x < x1)
                        x1 = x;
                    if (x > x2)
                        x2 = x;
                }
            }
            if (any) {
                if (y < y1)
                    y1 = y;
                y2 = y;
            }
        }
        let res = null;
        if (x2 >= 0) {
            const bw = x2 - x1 + 1, bh = y2 - y1 + 1;
            const mask = new Uint8Array(bw * bh), px = target ? null : new Uint32Array(bw * bh);
            for (let y = y1; y <= y2; y++) {
                for (let x = x1; x <= x2; x++) {
                    const i = y * W + x, p = S[i];
                    if (p) {
                        if (px)
                            px[(y - y1) * bw + (x - x1)] = p;
                        else
                            target[i] = p;
                        mask[(y - y1) * bw + (x - x1)] = 1;
                    }
                }
            }
            res = {box: [x1, y1, bw, bh], mask, px};
        }
        for (let y = sy1; y < sy2; y++)
            S.fill(0, y * W + sx1, y * W + sx2);
        return res;
    }

    // Copy the masked pixels of s (from masked()) from the on-screen copy of its
    // layer (litBuffer) back over the box x..x+w, top..top+h; a sprite
    // brings its own pixels as drawSprite() last put them.
    occlude(lit, s, x, top, w, h) {
        if (s.px) {
            this.drawSprite(s, s.offs, [x, top, w, h]);
            return;
        }
        const [bx, by, bw, bh] = s.box;
        if (bx > x + w || bx + bw < x || by > top + h || by + bh < top)
            return;
        const W = this.w, t = this.t;
        const x1 = Math.max(bx, Math.floor(x)), x2 = Math.min(bx + bw, Math.ceil(x + w));
        const y1 = Math.max(by, Math.floor(top)), y2 = Math.min(by + bh, Math.ceil(top + h));
        for (let yy = y1; yy < y2; yy++)
            for (let xx = x1; xx < x2; xx++)
                if (s.mask[(yy - by) * bw + (xx - bx)])
                    t[yy * W + xx] = lit[yy * W + xx];
    }

    // A sprite from masked() in the current light; offs = optional
    // horizontal offset per sprite row (a tree leaning in the wind), clip =
    // [x, y, w, h] limits it to that box.
    drawSprite(s, offs = null, clip = null) {
        let src = s.px;
        if (this.ar !== 1 || this.ag !== 1 || this.ab !== 1) {
            const key = this._luts().lutKey;
            if (s.litKey !== key) {
                const {lr, lg, lb} = this;
                s.lit = s.lit || new Uint32Array(src.length);
                for (let i = 0; i < src.length; i++) {
                    const p = src[i];
                    s.lit[i] = !p || (p >>> 24) === 254 ? p : (0xff000000 | lb[(p >> 16) & 255] | lg[(p >> 8) & 255] | lr[p & 255]) >>> 0;
                }
                s.litKey = key;
            }
            src = s.lit;
        }
        s.offs = offs;
        const [bx, by, bw, bh] = s.box, W = this.w, t = this.t;
        let cx1 = 0, cy1 = 0, cx2 = W, cy2 = this.h;
        if (clip) {
            cx1 = Math.max(0, Math.floor(clip[0]));
            cy1 = Math.max(0, Math.floor(clip[1]));
            cx2 = Math.min(W, Math.ceil(clip[0] + clip[2]));
            cy2 = Math.min(this.h, Math.ceil(clip[1] + clip[3]));
        }
        for (let r = Math.max(0, cy1 - by); r < bh && by + r < cy2; r++) {
            const row = (by + r) * W, dx = bx + (offs ? offs[r] : 0);
            for (let c = Math.max(0, cx1 - dx); c < bw && dx + c < cx2; c++) {
                const p = src[r * bw + c];
                if (p)
                    t[row + dx + c] = p;
            }
        }
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
        if (this.t === this.buf)
            this.steps.push(cx, y + 1, half);
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
