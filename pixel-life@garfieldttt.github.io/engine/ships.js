// Vessels in side view for the harbor, drawn facing right with the
// waterline at `wl`. Every ship is described in metres and drawn at the
// scale k (pixels per metre) of the water it lies in, so a yacht at the
// marina and a container ship in the basin keep their true proportions
// against the people next to them. Each returns where its lights sit,
// relative to (x0, wl) in the facing-right frame.
import {pick, rand} from './util.js';
import {mix} from './gfx.js';

const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.3) => mix(c, 0xfff4d0, t);
export const INK2 = 0x2a1e30;
const WIN = 0x2a3a5a;

// length range in metres
const LEN = {container: [150, 200], ferry: [95, 115], tug: [26, 32], tallship: [72, 86], fishing: [16, 21],
    yacht: [9, 13], motor: [6, 9], dinghy: [3.2, 3.8], pilot: [15, 17], racer: [7, 9]};
const NAMES = ['PIXEL STAR', 'NORDIC SUN', 'BLUE WAVE', 'OCEAN ROSE', 'MERIDIAN', 'POLARIS', 'SEA LARK', 'ALBATROS', 'HELGA', 'MOEWE'];

// k: pixels per metre of the zone; len: metres (optional)
export function makeShip(kind, k, len) {
    const [a, b] = LEN[kind];
    const m = len || rand(a, b);
    const s = {kind, k, m, L: Math.max(8, Math.round(m * k)), sprites: {}, x: 0, dir: 1, speed: 0, t: Math.random() * 10};
    s.hull = {container: pick([0x2a3a6a, 0x8a2a2a, 0x2a5a3a, 0x2a2a30, 0x1a5a8a]), fishing: pick([0x2a6ab0, 0xc83a3a, 0x2a8a6a, 0xf0f0f0]),
        ferry: 0xf4f4f8, yacht: 0xf6f6f8, tug: pick([0xc8302a, 0x2a2a30, 0xe8a020]), motor: pick([0xf6f6f8, 0x2a2a3a, 0xd83838, 0xf6f6f8]),
        tallship: 0x2a2420, dinghy: pick([0xb8784a, 0xf0f0f0, 0x4a8ac8]), pilot: 0x1a1a22, racer: pick([0xf6f6f8, 0x2a4a8a])}[kind];
    s.band = pick([0x2a5ad0, 0xd84848, 0x1a8a7a, 0xf0a020]);
    s.name = pick(NAMES);
    s.num = pick(['HF', 'SK', 'FB', 'NB']) + ' ' + (10 + Math.floor(Math.random() * 80));
    s.sail = pick([0xf8f8f8, 0xf8f8f8, 0xf0e0c0, 0xe85050]);
    s.cover = pick([0x2a4a8a, 0x2a6a9a, 0x8a2a2a, 0x3a3a44]);
    s.sails = false;
    return s;
}

// helpers mapping the facing-right frame to the screen
function frame(g, s, x0, dir) {
    const L = s.L;
    const X = i => (dir > 0 ? x0 + i : x0 + L - 1 - i);
    return {
        X,
        pt: (i, y, c) => g.px(X(i), y, c),
        col: (i, y, h, c) => g.rect(X(i), y, 1, h, c),
        row: (i, y, w, c) => g.rect(dir > 0 ? x0 + i : x0 + L - i - w, y, w, 1, c),
        box: (i, y, w, h, c) => g.rect(dir > 0 ? x0 + i : x0 + L - i - w, y, w, h, c),
        ln: (i0, y0, i1, y1, c) => g.line(X(i0), y0, X(i1), y1, c),
    };
}

// a hull: sheer rising to the bow, a raked stem, a boot-top at the water
function hull(g, s, x0, wl, dir, fb, color, {bow = 8, stern = 2, boot = 0xb83030, rise = 4, bootH = 2} = {}) {
    const {pt} = frame(g, s, x0, dir), L = s.L;
    for (let i = 0; i < L; i++) {
        const u = i / (L - 1);
        const top = wl - fb - Math.round(rise * u * u);
        let bot = wl;
        if (i > L - bow)
            bot = wl - Math.round((i - (L - bow)) * fb / bow * 0.9);
        if (i < stern)
            bot = wl - (stern - i);
        for (let y = top; y < bot; y++)
            pt(i, y, y === top ? hi(color, 0.35) : y >= wl - bootH ? boot : y > bot - 3 ? sh(color, 0.2) : color);
    }
    return i => wl - fb - Math.round(rise * (Math.max(0, Math.min(L - 1, i)) / (L - 1)) ** 2);
}

function windows(g, s, x0, dir, i0, i1, y, step, lights, c = WIN, h = 1) {
    const {box} = frame(g, s, x0, dir);
    for (let i = i0; i < i1; i += step) {
        box(i, y, 1, h, c);
        lights.windows.push([i, y]);
    }
}

export function drawShip(g, s, x0, wl, dir) {
    const L = s.L, k = s.k, f = frame(g, s, x0, dir), {pt, col, row, box, ln} = f;
    const m = v => Math.max(1, Math.round(v * k));
    const lt = {windows: [], mast: [], side: null, stern: null, deck: 0, lamps: []};
    const rel = y => y - wl;
    switch (s.kind) {
    case 'container': {
        const fb = m(9), deckAt = hull(g, s, x0, wl, dir, fb, s.hull, {bow: m(24), stern: m(4), rise: m(2.5), bootH: m(1.2)});
        // the white name and a hawse hole at the bow, draught marks
        g.text(s.name, dir > 0 ? x0 + L - m(26) - s.name.length * 4 : x0 + m(26), wl - fb + 4, 0xf0f0f0);
        box(L - m(16), deckAt(L - m(16)) + 3, 2, 2, 0x1a1a22);
        for (let q = 0; q < 4; q++)
            row(L - m(30), wl - 3 - q * 2, 1, 0xf0f0f0);
        // forecastle with its breakwater
        const fc = L - m(22);
        for (let i = fc; i < L - m(4); i++)
            col(i, deckAt(i) - m(2), m(2), i === fc ? 0xc8c8d0 : 0xe0e0e8);
        // accommodation block and bridge aft, the funnel behind it
        const a0 = Math.round(L * 0.1), aw = m(14), dk = deckAt(a0), ah = m(22), fl = m(2.8);
        box(a0 - 1, dk - ah - 1, aw + 2, ah + 1, INK2);
        box(a0, dk - ah, aw, ah, 0xf0f0f4);
        box(a0 + aw - 2, dk - ah, 2, ah, 0xd0d0d8);
        for (let y = dk - ah + fl; y < dk - 2; y += fl) {
            row(a0, y + 2, aw, 0xd8d8e0);
            windows(g, s, x0, dir, a0 + 2, a0 + aw - 2, y, 3, lt);
        }
        // the bridge with its wings, glazed all along
        box(a0 - m(4), dk - ah - 2, aw + m(8), 3, INK2);
        box(a0 - m(4), dk - ah - 1, aw + m(8), 2, 0xe8e8f0);
        for (let i = a0 - m(4) + 1; i < a0 + aw + m(4) - 1; i += 2)
            pt(i, dk - ah - 1, WIN);
        box(a0 + 2, dk - ah - m(6), 2, m(6) - 2, 0xd8d8e0);
        row(a0, dk - ah - m(5), 6, 0xd8d8e0);
        lt.mast.push([a0 + 3, rel(dk - ah - m(6) - 1)]);
        const fx = a0 - m(7), fw = m(5);
        box(fx - 1, dk - m(16) - 1, fw + 2, m(16) + 1, INK2);
        box(fx, dk - m(16), fw, m(16), s.band);
        box(fx, dk - m(16), fw, 2, 0x1a1a22);
        box(fx + fw - 2, dk - m(16) + 2, 2, m(16) - 2, sh(s.band, 0.2));
        lt.funnel = [fx + Math.round(fw / 2), rel(dk - m(16) - 1)];
        lt.side = [a0 + aw + m(4) - 1, rel(dk - ah)];
        lt.stern = [1, rel(deckAt(1) - 2)];
        lt.deck = rel(deckAt(Math.round(L * 0.5)));
        lt.deckAt = i => rel(deckAt(i));
        // the cargo bays between the bridge and the forecastle
        lt.bays = [a0 + aw + m(3), fc - m(2)];
        lt.lamps.push([Math.round(L * 0.5), rel(dk - m(18))]);
        break;
    }
    case 'ferry': {
        const fb = m(5), deckAt = hull(g, s, x0, wl, dir, fb, 0xf4f4f8, {bow: m(14), stern: m(3), rise: m(1.5), boot: s.band, bootH: m(1)});
        row(0, wl - fb + m(2), L - m(10), s.band);
        row(0, wl - fb + m(2) + 1, L - m(11), s.band);
        // three tiers of decks, the bridge forward, lifeboats and a funnel
        const d0 = m(6), d1 = L - m(16), dk = deckAt(Math.round(L * 0.5)), tier = m(3);
        let top = dk;
        for (let q = 0; q < 3; q++) {
            const a = d0 + q * m(6), b = d1 - q * m(4) - (q === 2 ? m(20) : 0);
            box(a - 1, top - tier - 1, b - a + 2, tier + 1, INK2);
            box(a, top - tier, b - a, tier, 0xf6f6fa);
            row(a, top - 1, b - a, 0xd0d4dc);
            windows(g, s, x0, dir, a + 2, b - 1, top - tier + 2, q === 0 ? 3 : 2, lt, WIN, q === 0 ? 2 : 1);
            if (q === 1)
                for (let i = a + m(8); i < b - m(8); i += m(11)) {
                    box(i, top - tier + 1, m(7), 2, 0xf08020);
                    row(i, top - tier + 1, m(7), 0xffa850);
                }
            top -= tier;
        }
        // the bridge on top, forward, with wings
        const bx = d1 - m(18), bw = m(14);
        box(bx - 1, top - m(3) - 1, bw + 2, m(3) + 1, INK2);
        box(bx, top - m(3), bw, m(3), 0xf6f6fa);
        for (let i = bx + 1; i < bx + bw - 1; i += 2)
            pt(i, top - m(3) + 2, WIN);
        box(bx - m(3), top - m(3), m(3), 1, 0xe0e0e8);
        box(bx + bw, top - m(3), m(3), 1, 0xe0e0e8);
        const fx = Math.round(L * 0.32), fw = m(6);
        box(fx - 1, top - m(7) - 1, fw + 2, m(7) + 1, INK2);
        box(fx, top - m(7), fw, m(7), s.band);
        box(fx, top - m(7), fw, 2, 0x1a1a22);
        lt.funnel = [fx + Math.round(fw / 2), rel(top - m(7) - 1)];
        col(bx + 3, top - m(9), m(6), 0x8a8a96);
        lt.mast.push([bx + 3, rel(top - m(9) - 1)]);
        lt.side = [bx + bw + m(3) - 1, rel(top - m(3))];
        lt.stern = [1, rel(deckAt(1) - 2)];
        lt.deck = rel(dk);
        // the stern door of the car deck
        box(1, wl - fb + 1, m(2), fb - m(1) - 1, 0x5a5a66);
        g.text('FERRY', dir > 0 ? x0 + Math.round(L * 0.45) : x0 + L - Math.round(L * 0.45) - 19, wl - fb + 1, s.band);
        break;
    }
    case 'tug': {
        const fb = m(2.5), deckAt = hull(g, s, x0, wl, dir, fb, s.hull, {bow: m(5), stern: m(2), rise: m(1.2), boot: 0x2a2a30, bootH: 1});
        // tyre fenders along the gunwale and a fat push fender on the bow
        for (let i = 2; i < L - 3; i += m(1.8))
            pt(i, deckAt(i) + 1, 0x1a1a1a);
        for (let i = L - m(3); i < L; i++)
            col(i, deckAt(i), m(1.2), 0x1a1a1a);
        const w0 = Math.round(L * 0.35), dk = deckAt(w0), hw = Math.round(L * 0.42);
        box(w0 - 1, dk - m(2.4) - 1, hw + 2, m(2.4) + 1, INK2);
        box(w0, dk - m(2.4), hw, m(2.4), 0xf4f4f8);
        // the raised wheelhouse, glazed all round
        const wx = w0 + Math.round(hw * 0.35), ww = Math.round(hw * 0.55), wh = m(2.8);
        box(wx - 1, dk - m(2.4) - wh - 1, ww + 2, wh + 1, INK2);
        box(wx, dk - m(2.4) - wh, ww, wh, 0xf4f4f8);
        box(wx, dk - m(2.4) - wh, ww, 1, s.hull === 0xe8a020 ? 0x2a2a30 : s.hull);
        windows(g, s, x0, dir, wx + 1, wx + ww - 1, dk - m(2.4) - wh + 2, 2, lt);
        const sx = w0 + 1;
        box(sx, dk - m(2.4) - m(2.5), m(1.2), m(2.5), 0x1a1a22);
        row(sx, dk - m(2.4) - m(1.6), m(1.2), s.hull);
        lt.funnel = [sx, rel(dk - m(2.4) - m(2.5) - 1)];
        col(wx + 2, dk - m(2.4) - wh - m(4), m(4), 0x8a8a96);
        lt.mast.push([wx + 2, rel(dk - m(2.4) - wh - m(4) - 1)]);
        lt.side = [wx + ww, rel(dk - m(2.4) - wh + 1)];
        lt.stern = [1, rel(deckAt(1) - 2)];
        lt.deck = rel(dk);
        // the towing hook aft
        col(m(4), deckAt(m(4)) - m(1.5), m(1.5), 0x5a5a66);
        lt.hook = [m(4), rel(deckAt(m(4)) - m(1.5))];
        break;
    }
    case 'tallship': {
        const fb = m(5), deckAt = hull(g, s, x0, wl, dir, fb, s.hull, {bow: m(12), stern: m(3), rise: m(3), boot: 0x6a2a20, bootH: m(0.8)});
        // a white band with painted gunports, gilded stern
        for (let i = m(2); i < L - m(12); i++)
            col(i, deckAt(i) + m(1.5), m(1.2), 0xe8d8b0);
        for (let i = m(5); i < L - m(14); i += m(4))
            box(i, deckAt(i) + m(1.5), m(1.2), m(1.2), 0x1a1a1a);
        box(0, deckAt(0) - 2, m(1.5), 4, 0xd8a840);
        // bowsprit and jib boom
        const bs = m(16);
        for (let q = 0; q < bs; q++)
            pt(L - m(3) + q, deckAt(L - m(3)) - 1 - Math.round(q * 0.35), 0x5a4030);
        const tip = [L - m(3) + bs - 1, deckAt(L - m(3)) - 1 - Math.round((bs - 1) * 0.35)];
        // three masts with yards; sails set when under way, furled in port
        const masts = [[0.24, 42], [0.5, 46], [0.74, 40]].map(([u, h]) => [Math.round(L * u), m(h)]);
        // stays from the mastheads to the bow and the stern (drawn first)
        const stay = 0x6a5a4a;
        ln(masts[2][0], deckAt(masts[2][0]) - masts[2][1], tip[0], tip[1], stay);
        ln(masts[0][0], deckAt(masts[0][0]) - masts[0][1], 1, deckAt(1), stay);
        for (let q = 0; q < 2; q++)
            ln(masts[q][0], deckAt(masts[q][0]) - masts[q][1], masts[q + 1][0], deckAt(masts[q + 1][0]) - Math.round(masts[q + 1][1] * 0.45), stay);
        for (const [mi, mh] of masts) {
            const dk = deckAt(mi);
            col(mi, dk - mh, mh, 0x5a4030);
            lt.mast.push([mi, rel(dk - mh - 1)]);
            const yards = 4, gap = Math.round(mh * 0.85 / yards);
            for (let q = 0; q < yards; q++) {
                const y = dk - mh + m(3) + q * gap, w = Math.round(m(15) * (0.62 + q * 0.13));
                row(mi - Math.round(w / 2), y, w, 0x5a4030);
                if (s.sails) {
                    const sail = gap - 2;
                    for (let r = 1; r <= sail; r++) {
                        const bulge = Math.round(Math.sin(r / sail * Math.PI) * 1.5);
                        row(mi - Math.round(w / 2) + 1 + bulge, y + r, w - 2, r === sail ? sh(0xf6f0e4, 0.15) : r % 4 === 2 ? 0xe8e0d0 : 0xf6f0e4);
                    }
                } else {
                    row(mi - Math.round(w / 2) + 1, y + 1, w - 2, 0xe8e0d0);
                }
            }
        }
        // jibs between the foremast and the bowsprit: the luff runs up the
        // stay, the leech from the head down to the clew on the bowsprit
        if (s.sails) {
            const [fm, fh] = masts[2];
            for (let q = 2; q >= 0; q--) {
                // innermost first; each one hanks on its own stay
                const hx = fm + m(1), hy = deckAt(fm) - Math.round(fh * (0.78 - q * 0.17));
                const tx = tip[0] - q * m(5), ty = tip[1] + Math.round(q * m(5) * 0.35);
                const cx = tx - m(6) - q * m(1), cy = ty + m(2);
                for (let y = hy; y <= cy; y++) {
                    const u1 = (y - hy) / Math.max(1, ty - hy), u2 = (y - hy) / Math.max(1, cy - hy);
                    const xl = Math.round(hx + (tx - hx) * Math.min(1, u1)), xc = Math.round(hx + (cx - hx) * u2);
                    if (xl > xc) {
                        row(xc, y, xl - xc, y % 4 === 0 ? 0xe8e0d0 : 0xf2ece0);
                        pt(xc, y, 0xc8bca8);
                    }
                }
            }
        }
        lt.side = [L - m(14), rel(deckAt(L - m(14)) - 2)];
        lt.stern = [1, rel(deckAt(1) - 2)];
        lt.deck = rel(deckAt(L / 2));
        break;
    }
    case 'fishing': {
        const fb = m(1.8), deckAt = hull(g, s, x0, wl, dir, fb, s.hull, {bow: m(4), stern: m(1.5), rise: m(1.2), boot: 0x8a2a2a, bootH: m(0.4)});
        if (k >= 4)
            g.text(s.num, dir > 0 ? x0 + L - m(5) - g.textWidth(s.num) : x0 + m(5), wl - fb + 2, s.hull === 0xf0f0f0 ? 0x2a3a6a : 0xf4f4f8);
        // tyres as fenders
        for (let i = m(3); i < L - m(5); i += m(3.5))
            g.disc(f.X(i), wl - Math.round(fb * 0.55), Math.max(1, m(0.35)), 0x2a2a30);
        // the wheelhouse forward, a working deck aft
        const w0 = Math.round(L * 0.56), ww = m(4.2), wh = m(2.8), dk = deckAt(w0);
        box(w0 - 1, dk - wh - 1, ww + 2, wh + 1, INK2);
        box(w0, dk - wh, ww, wh, 0xf4f0e8);
        box(w0, dk - wh, ww, Math.max(1, m(0.4)), 0x5a6a7a);
        box(w0 + ww - Math.max(1, m(0.3)), dk - wh, Math.max(1, m(0.3)), wh, 0xd8d0c4);
        windows(g, s, x0, dir, w0 + 1, w0 + ww - 1, dk - wh + Math.max(1, m(0.7)), Math.max(2, m(0.9)), lt, WIN, Math.max(1, m(0.8)));
        // the mast in front of the wheelhouse, booms raised to an A
        const mx = w0 + ww + m(1.2), mh = m(9);
        col(mx, deckAt(mx) - mh, mh, 0x8a6a4a);
        row(mx - m(1), deckAt(mx) - mh + m(2), m(2) + 1, 0x8a6a4a);
        lt.mast.push([mx, rel(deckAt(mx) - mh - 1)]);
        ln(m(3), deckAt(m(3)) - 1, mx, deckAt(mx) - mh + m(3), 0x6a5040);
        // gantry aft with the net drum
        const gx = m(1.2), gh = m(4);
        col(gx, deckAt(gx) - gh, gh, 0x8a8a96);
        col(gx + m(2.5), deckAt(gx + m(2.5)) - gh, gh, 0x8a8a96);
        row(gx, deckAt(gx) - gh, m(2.5) + 1, 0x8a8a96);
        const dr = Math.max(1, m(0.9));
        box(gx + m(0.5), deckAt(gx) - dr * 2 - 1, m(2), dr * 2, 0x2a6a3a);
        for (let i = gx + m(0.5); i < gx + m(2.5); i += 2)
            pt(i, deckAt(gx) - dr - 1, 0x4a8a4a);
        // orange buoys and a fish box on deck
        if (k >= 4) {
            for (const [i, c] of [[m(5.5), 0xf08020], [m(6.5), 0xf0c030]]) {
                g.disc(f.X(i), deckAt(i) - m(0.4), m(0.35), c);
                pt(i, deckAt(i) - m(0.6), hi(c, 0.5));
            }
            box(m(7.5), deckAt(m(7.5)) - m(0.6), m(1.2), m(0.6), 0x3a7ab0);
        }
        lt.side = [w0 + ww - 1, rel(dk - wh + 1)];
        lt.stern = [1, rel(deckAt(1) - 2)];
        lt.lamps.push([gx + m(1.2), rel(deckAt(gx) - gh)]);
        lt.deck = rel(dk);
        break;
    }
    case 'pilot': {
        const fb = m(2), deckAt = hull(g, s, x0, wl, dir, fb, s.hull, {bow: m(4), stern: m(1), rise: m(0.8), boot: 0xf08020, bootH: Math.max(1, m(0.6))});
        const w0 = Math.round(L * 0.4), ww = Math.round(L * 0.4), wh = m(2.4), dk = deckAt(w0);
        box(w0 - 1, dk - wh - 1, ww + 2, wh + 1, INK2);
        box(w0, dk - wh, ww, wh, 0xf08020);
        windows(g, s, x0, dir, w0 + 1, w0 + ww - 1, dk - wh + 1, 2, lt);
        col(w0 + 2, dk - wh - m(3), m(3), 0x8a8a96);
        lt.mast.push([w0 + 2, rel(dk - wh - m(3) - 1)]);
        g.text('PILOT', dir > 0 ? x0 + Math.round(L * 0.35) : x0 + L - Math.round(L * 0.35) - 19, wl - fb + 1, 0xf4f4f8);
        lt.side = [w0 + ww - 1, rel(dk - wh)];
        lt.stern = [1, rel(deckAt(1) - 1)];
        lt.deck = rel(dk);
        break;
    }
    case 'motor': {
        const fb = m(1), deckAt = hull(g, s, x0, wl, dir, fb, s.hull, {bow: m(2), stern: 1, rise: m(0.5), boot: 0x2a5ad0, bootH: Math.max(1, m(0.15))});
        const w0 = Math.round(L * 0.45), dk = deckAt(w0);
        // windscreen, console, the seats and an outboard on the transom
        for (let q = 0; q < m(0.7); q++)
            row(w0 + q, dk - m(0.7) + q, m(0.8) - Math.round(q * 0.5), q === 0 ? 0xd8eef8 : 0x8ac0e8);
        box(w0 - m(0.5), dk - m(0.5), m(0.5), m(0.5), 0xd8d8e0);
        box(m(1), dk - m(0.6), m(1.8), m(0.6), 0xe8dcc0);
        box(-m(0.3), wl - fb - m(0.3), m(0.4), fb + m(0.2), 0x2a2a30);
        lt.side = [w0 + m(0.6), rel(dk - m(0.5))];
        lt.stern = [1, rel(deckAt(1) - 1)];
        col(w0 - m(0.6), dk - m(1.4), m(0.9), 0x8a8a96);
        lt.mast.push([w0 - m(0.6), rel(dk - m(1.4) - 1)]);
        lt.deck = rel(dk);
        break;
    }
    case 'dinghy': {
        const fb = m(0.55), deckAt = hull(g, s, x0, wl, dir, fb, s.hull, {bow: m(0.9), stern: 1, rise: m(0.25), boot: sh(s.hull, 0.3), bootH: 1});
        row(1, deckAt(1), L - 2, s.hull === 0xb8784a ? 0xe0b080 : 0x8a6a4a);
        // the oars shipped along the thwarts
        row(m(0.4), deckAt(m(0.4)) - 1, L - m(1), 0xc8a070);
        lt.deck = rel(deckAt(L / 2));
        break;
    }
    case 'yacht':
    case 'racer': {
        const racer = s.kind === 'racer', fb = m(1.1);
        const deckAt = hull(g, s, x0, wl, dir, fb, s.hull, {bow: m(2.5), stern: 1, rise: m(0.4), boot: s.band, bootH: Math.max(1, m(0.2))});
        const mi = Math.round(L * 0.45), dk = deckAt(mi), mh = m(racer ? 11 : 14);
        // coachroof with its windows, a guard rail on stanchions
        if (!racer) {
            const cw = Math.round(L * 0.32);
            box(mi - Math.round(cw * 0.55), dk - m(0.7), cw, m(0.7), 0xf0f0f0);
            windows(g, s, x0, dir, mi - Math.round(cw * 0.4), mi + Math.round(cw * 0.35), dk - m(0.45), Math.max(2, m(0.7)), lt, WIN, Math.max(1, m(0.25)));
            if (k >= 4) {
                row(m(0.4), deckAt(m(0.4)) - m(0.6), L - m(2), 0xb8c0c8);
                for (let i = m(0.4); i < L - m(1.6); i += m(1.6))
                    col(i, deckAt(i) - m(0.6), m(0.6), 0xb8c0c8);
            }
        }
        col(mi, dk - mh, mh, 0xd8d8e0);
        const boomY = dk - m(1.6), bl = Math.round(L * 0.42);
        row(mi - bl, boomY, bl, 0x8a8a96);
        // forestay to the bow
        ln(mi, dk - Math.round(mh * 0.85), L - m(0.5), deckAt(L - m(0.5)) - 1, 0x9aa0a8);
        if (s.sails) {
            // mainsail aft of the mast, jib forward to the bow
            for (let q = 0; q < mh - m(1.8); q++) {
                const u = q / (mh - m(1.8)), w = Math.round(bl * (1 - u) * (1 - u * 0.15));
                if (w > 0)
                    row(mi - w, boomY - 1 - q, w, q % m(1.5) === 0 ? sh(s.sail, 0.12) : s.sail);
            }
            const jt = Math.round(mh * 0.8), jb = m(1);
            for (let q = 0; q < jt - jb; q++) {
                const u = q / (jt - jb), w = Math.round((L - m(0.5) - mi - 2) * (1 - u));
                if (w > 0)
                    row(mi + 1, dk - jb - q, w, q % 2 ? hi(s.sail, 0.1) : s.sail);
            }
            if (racer)
                g.text(String(s.num.slice(-2)), f.X(mi - Math.round(bl * 0.6)) - 3, boomY - Math.round(mh * 0.35), 0x2a2a3a);
        } else {
            // the main furled under its cover along the boom
            box(mi - bl + m(0.3), boomY - m(0.45), bl - m(0.3), m(0.45), s.cover);
            row(mi - bl + m(0.3), boomY - m(0.45), bl - m(0.3), hi(s.cover, 0.3));
        }
        lt.mast.push([mi, rel(dk - mh - 1)]);
        lt.side = [mi + m(1), rel(dk - 1)];
        lt.stern = [1, rel(deckAt(1) - 1)];
        lt.deck = rel(dk);
        break;
    }
    }
    // windows were collected on screen; hand them back relative to wl
    lt.windows = lt.windows.map(([i, y]) => [i, y - wl]);
    return lt;
}
