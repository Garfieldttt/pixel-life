// Small random and math helpers shared by all engine modules.

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const chance = p => Math.random() < p;
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);

// [[value, weight], ...] -> value
export function weighted(entries) {
    let total = 0;
    for (const [, w] of entries)
        total += w;
    let r = Math.random() * total;
    for (const [v, w] of entries) {
        r -= w;
        if (r < 0)
            return v;
    }
    return entries[entries.length - 1][0];
}

// Exponential approach, frame rate independent.
export const approach = (v, target, rate, dt) => target + (v - target) * Math.exp(-rate * dt);

// v (0..1) in n steps; the step only changes once v is clearly past the
// boundary, so a value hovering there does not flip back and forth.
export function steppedLevel(v, prev, n, margin = 0.2) {
    const x = v * n;
    if (prev !== undefined && Math.abs(x - prev) < 0.5 + margin)
        return prev;
    return Math.round(x);
}
