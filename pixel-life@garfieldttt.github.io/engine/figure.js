// Tiny cell canvas for building outlined sprites procedurally (people,
// animals, vehicles). Built once per variant and frame, then cached.
import {OUTLINE} from './gfx.js';

export class Cells {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.c = new Int32Array(w * h).fill(-1);
        this.lights = [];
    }

    set(x, y, c) {
        if (x >= 0 && y >= 0 && x < this.w && y < this.h)
            this.c[y * this.w + x] = c;
    }

    rect(x, y, w, h, c) {
        for (let yy = y; yy < y + h; yy++)
            for (let xx = x; xx < x + w; xx++)
                this.set(xx, yy, c);
    }

    hline(x, y, w, c) {
        this.rect(x, y, w, 1, c);
    }

    get(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : -1;
    }

    // Light points (emissive), relative to the finished figure.
    light(x, y, c, kind) {
        this.lights.push({x: x + 1, y: y + 1, c, kind});
    }

    // Integer upscale; finish() afterwards keeps the outline 1px thin.
    scaled(s) {
        const out = new Cells(this.w * s, this.h * s);
        for (let y = 0; y < out.h; y++)
            for (let x = 0; x < out.w; x++)
                out.c[y * out.w + x] = this.c[Math.floor(y / s) * this.w + Math.floor(x / s)];
        out.lights = this.lights.map(l => ({...l, x: (l.x - 1) * s + 1, y: (l.y - 1) * s + 1,
            ...(l.w ? {w: l.w * s, h: l.h * s} : {})}));
        return out;
    }

    // -> {w, h, pts: [x, y, color, ...], lights}; adds a 1px outline.
    finish(outline = OUTLINE) {
        const W = this.w + 2, H = this.h + 2, pts = [];
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const c = this.get(x - 1, y - 1);
                if (c >= 0) {
                    pts.push(x, y, c);
                } else if (outline !== null && (this.get(x - 2, y - 1) >= 0 || this.get(x, y - 1) >= 0 ||
                    this.get(x - 1, y - 2) >= 0 || this.get(x - 1, y) >= 0)) {
                    pts.push(x, y, outline);
                }
            }
        }
        return {w: W, h: H, pts, lights: this.lights};
    }
}

// Draw a finished figure with its feet at (x, bottom).
export function drawFigure(g, f, x, bottom, flip = false) {
    const ox = Math.floor(x), oy = Math.floor(bottom) - f.h;
    const pts = f.pts;
    for (let i = 0; i < pts.length; i += 3)
        g.px(flip ? ox + f.w - 1 - pts[i] : ox + pts[i], oy + pts[i + 1], pts[i + 2]);
}

export function lightPos(f, l, x, bottom, flip) {
    return [Math.floor(x) + (flip ? f.w - 1 - l.x : l.x), Math.floor(bottom) - f.h + l.y];
}
