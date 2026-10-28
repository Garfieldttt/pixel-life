// Aircraft in side view for the airport: airliners, a jumbo, a turboprop,
// a business jet and a little high-wing single, in the colors of made-up
// airlines. A plane is drawn once per direction into a sprite (outlined
// like everything else) and sheared for the climb; its lights, lit cabin
// windows and propellers are drawn live on top.
import {pick} from './util.js';
import {mix} from './gfx.js';

const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.3) => mix(c, 0xfff4d0, t);
const lerp = (a, b, t) => a + (b - a) * t;

export const AIRLINES = [
    {name: 'SKYLINE', body: 0xf4f4f8, belly: 0xd4d8e0, tail: 0x2a5ad0, stripe: 0x2a5ad0, eng: 0x2a5ad0, logo: 'ring', lc: 0xffffff},
    {name: 'PIXAIR', body: 0xf4f4f8, belly: 0xf4f4f8, tail: 0xe04848, stripe: 0xe04848, eng: 0xf4f4f8, logo: 'chevron', lc: 0xffe040},
    {name: 'NORDWIND', body: 0xf0f2f6, belly: 0x2a3a6a, tail: 0x2a3a6a, stripe: 0x60a0e0, eng: 0x2a3a6a, logo: 'star', lc: 0xffffff},
    {name: 'SUNJET', body: 0xfff8ea, belly: 0xf0a030, tail: 0xf0a030, stripe: 0xe05030, eng: 0xf0a030, logo: 'sun', lc: 0xfff0a0},
    {name: 'ALPINA', body: 0xf4f4f8, belly: 0xc8ccd4, tail: 0x1a8a5a, stripe: 0x1a8a5a, eng: 0xf4f4f8, logo: 'peak', lc: 0xffffff},
    {name: 'VIOLA', body: 0xf6f2fa, belly: 0x6a3aa0, tail: 0x6a3aa0, stripe: 0xe060b0, eng: 0x6a3aa0, logo: 'ring', lc: 0xf8c8f0},
    {name: 'TEAL', body: 0xf4f6f6, belly: 0xd0d8d8, tail: 0x1a9aa0, stripe: 0xf0c040, eng: 0x1a9aa0, logo: 'wave', lc: 0xffffff},
];
export const CARGO = {name: 'CARGO', body: 0xe8e8ec, belly: 0xc0c4cc, tail: 0x8a4a2a, stripe: 0xf0a020, eng: 0xc0c4cc, logo: 'box', lc: 0xf0a020, noWindows: true};
export const PRIVATE = [
    {name: '', body: 0xf6f6f8, belly: 0xf6f6f8, tail: 0x1a1a2a, stripe: 0xb08a40, eng: 0xf6f6f8, logo: 'none', lc: 0xb08a40},
    {name: '', body: 0xf6f6f8, belly: 0xc83838, tail: 0xc83838, stripe: 0xc83838, eng: 0xf6f6f8, logo: 'none', lc: 0xffffff},
    {name: '', body: 0xf6f6f8, belly: 0x2a5ad0, tail: 0x2a5ad0, stripe: 0xf0c040, eng: 0xf6f6f8, logo: 'none', lc: 0xffffff},
];

// L: length, H: fuselage height, gear: belly above ground, tail: fin
// height above the fuselage, wing: where the wing root ends (share of L)
export const TYPES = {
    narrow: {L: 118, H: 15, gear: 7, tail: 26, wing: 0.38, eng: 'wing', text: true},
    wide: {L: 166, H: 20, gear: 9, tail: 32, wing: 0.38, eng: 'wing', text: true, bogie: 3},
    jumbo: {L: 176, H: 20, gear: 9, tail: 34, wing: 0.36, eng: 'wing4', text: true, hump: true, bogie: 3},
    regional: {L: 84, H: 12, gear: 6, tail: 20, wing: 0.42, eng: 'prop', high: true, ttail: true},
    bizjet: {L: 58, H: 9, gear: 5, tail: 14, wing: 0.42, eng: 'rear', ttail: true},
    cessna: {L: 36, H: 8, gear: 4, tail: 9, wing: 0.38, eng: 'nose', high: true},
};

export function makePlane(type, livery) {
    return {type, T: TYPES[type], liv: livery || pick(AIRLINES), sprites: {}, x: 0, y: 0, dir: 1, speed: 0, pitch: 0,
        gear: 1, engines: 0, beacon: 0, t: Math.random() * 10};
}

// Draw the plane facing right (dir 1) or left with its tail end at x0 and
// the wheels on the ground line `base`; returns where its lights and
// windows are, relative to (x0, base) in the facing-right frame.
export function drawPlane(g, p, x0, base, dir, gearDown = true) {
    const T = p.T, L = T.L, H = T.H, liv = p.liv;
    const X = i => (dir > 0 ? x0 + i : x0 + L - 1 - i);
    const col = (i, y, h, c) => g.rect(X(i), y, 1, h, c);
    const pt = (i, y, c) => g.px(X(i), y, c);
    const belly = base - T.gear, top0 = belly - H;
    const nc = Math.round(H * 1.25), tc = Math.round(L * 0.22);
    const hump = T.hump ? Math.round(L * 0.7) : L;
    // the outline of the fuselage, column by column
    const topAt = i => {
        let t = top0;
        if (i > L - nc) {
            const u = (i - (L - nc)) / nc;
            t += Math.round(H * 0.62 * (1 - Math.sqrt(Math.max(0, 1 - u * u))));
        }
        if (T.hump && i > hump - 22) {
            const u = Math.min(1, (i - (hump - 22)) / 22);
            const v = i > L - nc - 4 ? Math.max(0, 1 - (i - (L - nc - 4)) / (nc + 2)) : 1;
            t = Math.min(t, top0 - Math.round(6 * Math.sin(u * Math.PI / 2) * v));
        }
        if (i < 3)
            t += 3 - i;
        return t;
    };
    const botAt = i => {
        let b = belly;
        if (i < tc)
            b -= Math.round((tc - i) / tc * H * 0.62);
        if (i > L - nc) {
            const u = (i - (L - nc)) / nc;
            b -= Math.round(H * 0.38 * (1 - Math.sqrt(Math.max(0, 1 - u * u))));
        }
        return b;
    };
    const wy = top0 + Math.round(H * (T.text ? 0.55 : 0.36));
    const stripe = wy + 2;
    const lights = {windows: [], nav: null, beacon: [], strobe: [], land: [], logo: null, props: []};
    // the far wing and engine peek out behind the fuselage
    if (!T.high && T.eng !== 'rear') {
        const r0 = Math.round(L * T.wing);
        for (let k = 0; k < 4; k++)
            col(r0 + Math.round(L * 0.12) - k * 3, top0 + 2 - k, 2 + k, sh(0xb8bccc, 0.35));
    }
    // horizontal tail, far half
    if (!T.ttail)
        for (let i = 0; i < Math.round(L * 0.12); i++)
            pt(i + 1, top0 + Math.round(H * 0.35) - Math.round((L * 0.12 - i) * 0.12), sh(liv.body, 0.35));
    // vertical tail with its logo
    const fin = Math.round(L * 0.2);
    for (let k = 0; k <= T.tail; k++) {
        const u = k / T.tail, front = Math.round(lerp(fin, L * 0.085, u)), back = Math.round(lerp(L * 0.05, 0, u));
        const y = topAt(Math.round(L * 0.1)) - k;
        for (let i = back; i <= front; i++)
            pt(i, y, i === front ? hi(liv.tail, 0.3) : i <= back + 1 ? sh(liv.tail, 0.2) : liv.tail);
    }
    {
        const lx = Math.round(L * 0.1), ly = topAt(lx) - Math.round(T.tail * 0.5), c = liv.lc;
        lights.logo = [lx, ly - base];
        const P = (dx, dy) => pt(lx + dx, ly + dy, c);
        if (liv.logo === 'ring') {
            for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]])
                P(dx, dy);
        } else if (liv.logo === 'chevron') {
            for (let k = -2; k <= 2; k++) {
                P(Math.abs(k) - 1, k);
                P(Math.abs(k), k);
            }
        } else if (liv.logo === 'star') {
            for (const [dx, dy] of [[0, -2], [0, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [-1, 2], [1, 2]])
                P(dx, dy);
        } else if (liv.logo === 'sun') {
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++)
                    P(dx, dy);
            for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0], [-2, -2], [2, 2], [-2, 2], [2, -2]])
                P(dx, dy);
        } else if (liv.logo === 'peak') {
            for (let k = 0; k < 4; k++) {
                P(-k, k - 1);
                P(k, k - 1);
            }
            P(0, -2);
        } else if (liv.logo === 'wave') {
            for (let k = -3; k <= 3; k++)
                P(k, Math.round(Math.sin(k) * 1.5));
        } else if (liv.logo === 'box') {
            for (let dy = -1; dy <= 2; dy++)
                for (let dx = -2; dx <= 2; dx++)
                    P(dx, dy);
        }
    }
    if (T.ttail) {
        const ty = topAt(Math.round(L * 0.1)) - T.tail;
        for (let i = Math.round(L * 0.0); i < Math.round(L * 0.17); i++) {
            pt(i, ty, hi(liv.tail, 0.2));
            pt(i, ty + 1, liv.tail);
        }
    }
    // the fuselage
    for (let i = 0; i < L; i++) {
        const t = topAt(i), b = botAt(i);
        for (let y = t; y <= b; y++) {
            let c = y - t < 2 ? hi(liv.body, 0.4) : liv.body;
            if (y > stripe && liv.belly !== liv.body)
                c = liv.belly;
            if (y === stripe || (y === stripe - 1 && i > L * 0.2 && i < L - nc))
                c = liv.stripe;
            if (y >= b - 1)
                c = sh(c, 0.25);
            pt(i, y, c);
        }
    }
    // the near half of the horizontal tail, swept back like the wing
    if (!T.ttail) {
        const y0 = top0 + Math.round(H * 0.42), n = Math.max(3, Math.round(H * 0.25));
        for (let k = 0; k < n; k++) {
            const a = Math.round(L * 0.005) + k * 2 - 2, b = Math.round(L * 0.15) - k;
            for (let i = Math.max(0, a); i <= b; i++)
                pt(i, y0 + k, b - i < 1 ? 0xeef0f6 : k === n - 1 ? 0xa4a8b4 : 0xc8ccd6);
        }
    }
    // cabin windows and doors
    const doors = [Math.round(L * 0.2), L - nc - 5];
    if (L > 150)
        doors.push(Math.round(L * 0.55));
    if (!liv.noWindows) {
        for (let i = Math.round(L * 0.2) + 3; i < L - nc - 2; i += T.H > 12 ? 3 : 4) {
            if (doors.some(d => Math.abs(i - d) < 4))
                continue;
            if (T.hump && i > hump - 10)
                continue;
            pt(i, wy - (i > L * 0.62 && T.hump ? 0 : 0), 0x2a3a5a);
            lights.windows.push([i, wy - base]);
            if (T.hump && i > L * 0.4 && i < hump - 16 && (i % 6 === 0)) {
                pt(i, top0 - 3, 0x2a3a5a);
                lights.windows.push([i, top0 - 3 - base]);
            }
        }
    }
    for (const d of doors) {
        const dc = sh(liv.body, 0.16);
        g.rect(Math.min(X(d), X(d + 3)), wy - 3, 4, 1, dc);
        g.rect(Math.min(X(d), X(d + 3)), Math.min(wy + 4, botAt(d) - 1), 4, 1, dc);
        col(d, wy - 3, Math.min(8, botAt(d) - wy + 3), dc);
        col(d + 3, wy - 3, Math.min(8, botAt(d) - wy + 3), dc);
        pt(d + 2, wy, 0x2a3a5a);
    }
    lights.door = [L - nc - 3, wy - 3 - base];
    lights.rearDoor = [Math.round(L * 0.2) + 1, wy - 3 - base];
    // cockpit windows
    const ci = L - nc + Math.round(nc * 0.25), ct = topAt(ci) + 2;
    const cn = Math.max(4, Math.round(nc * 0.5));
    for (let k = 0; k < cn; k++) {
        const y = ct + Math.floor(k * 1.5 / cn);
        pt(ci + k, y, k % 3 === 2 ? 0x8a9ab0 : 0x1a2a4a);
        pt(ci + k, y + 1, k % 3 === 2 ? 0x8a9ab0 : 0x2a3a5a);
    }
    pt(ci, ct, 0x6a8ab0);
    // radome
    for (let i = L - 3; i < L; i++)
        col(i, topAt(i), botAt(i) - topAt(i) + 1, i === L - 1 ? 0x9a9aa6 : 0xc8c8d0);
    // airline name over the windows
    if (T.text && liv.name) {
        const tw = liv.name.length * 4 - 1, tx = Math.round(L * 0.48 - tw / 2);
        const sx = dir > 0 ? x0 + tx : x0 + L - tx - tw;
        g.text(liv.name, sx, top0 + 2, liv.tail);
    }
    // the near wing (low wing) with flap line and winglet
    const wr = Math.round(L * T.wing);
    if (!T.high) {
        // root along the belly, swept back and down towards us to the tip
        const rootF = wr + Math.round(L * 0.21), rootB = wr - Math.round(L * 0.02), tipF = wr - Math.round(L * 0.1), tipB = wr - Math.round(L * 0.17);
        const y0 = belly - 3, y1 = belly + Math.max(3, Math.round(H * 0.25));
        // the wing-to-body fairing
        for (let i = rootB + 2; i < rootF + 3; i++)
            pt(i, belly, sh(liv.belly, 0.15));
        for (let y = y0; y <= y1; y++) {
            const u = (y - y0) / (y1 - y0), a = Math.round(lerp(rootB, tipB, u)), b = Math.round(lerp(rootF, tipF, u));
            for (let i = a; i <= b; i++)
                pt(i, y, b - i < 1 ? 0xeef0f6 : i - a < 2 ? 0x8a8e9a : y === y1 ? 0xa4a8b4 : (i - a) % 9 === 4 && y > y0 + 1 ? 0xa8acb8 : 0xc8ccd6);
        }
        const tx = tipB + 1;
        for (let k = 1; k < 5; k++)
            pt(tx + Math.floor(k / 2), y1 - k, k < 3 ? liv.tail : hi(liv.tail, 0.2));
        lights.nav = [tx + 2, y1 - 4 - base];
        lights.strobe.push([tx + 1, y1 - base]);
        lights.land.push([rootF - 2, y0 + 1 - base]);
    }
    // engines
    const nacelle = (i0, len, y, h, c) => {
        for (let i = i0; i < i0 + len; i++) {
            const taper = i < i0 + 3 ? i0 + 3 - i : 0;
            for (let yy = y + taper; yy < y + h - taper; yy++)
                pt(i, yy, yy === y + taper ? hi(c, 0.35) : yy >= y + h - taper - 1 ? sh(c, 0.3) : c);
        }
        for (let yy = y + 1; yy < y + h - 1; yy++)
            pt(i0 + len - 1, yy, 0x2a2a36);
        pt(i0 + len - 1, y, 0xd8d8e0);
        pt(i0 + len - 2, y + 1, 0x3a3a48);
    };
    if (T.eng === 'wing' || T.eng === 'wing4') {
        const eh = Math.round(H * 0.45), el = Math.round(L * 0.15);
        // hung under the wing, the intake well ahead of its leading edge
        if (T.eng === 'wing4')
            nacelle(wr - Math.round(L * 0.05), Math.round(el * 0.85), belly + 1, eh - 1, liv.eng);
        nacelle(wr + Math.round(L * 0.1), el, belly - 1, eh, liv.eng);
    } else if (T.eng === 'rear') {
        nacelle(Math.round(L * 0.14), Math.round(L * 0.2), top0 - 2, 6, liv.eng);
        for (let k = 0; k < 3; k++)
            pt(Math.round(L * 0.24) + k, top0 + 3, 0xb0b4be);
    }
    // high wing on top, with the turboprop nacelle or a strut
    if (T.high) {
        const a = wr, b = wr + Math.round(L * (T.eng === 'nose' ? 0.24 : 0.2));
        for (let i = a; i <= b; i++) {
            pt(i, top0 - 2, 0xe0e2ea);
            pt(i, top0 - 1, i - a < 2 ? 0x8a8e9a : 0xc0c4ce);
            pt(i, top0, 0x9a9eaa);
        }
        if (T.eng === 'prop') {
            const n0 = b - 4;
            nacelle(n0, Math.round(L * 0.16), top0 - 1, 7, liv.eng);
            lights.props.push([n0 + Math.round(L * 0.16) + 1, top0 + 2 - base, 6]);
        } else {
            for (let k = 0; k < 6; k++)
                pt(a + 4 + k, top0 + 1 + Math.round(k * 0.6), 0x8a8e9a);
        }
        lights.nav = [b, top0 - 2 - base];
        lights.strobe.push([a + 2, top0 - 2 - base]);
        lights.land.push([b - 1, top0 - base]);
    }
    if (T.eng === 'nose')
        lights.props.push([L, Math.round((topAt(L - 1) + botAt(L - 1)) / 2) - base, 4]);
    // landing gear
    if (gearDown) {
        const wheel = (i, n) => {
            for (let k = 0; k < n; k++) {
                const wi = i + k * 3;
                for (const [dx, dy] of [[0, -3], [1, -3], [2, -3], [0, -2], [2, -2], [0, -1], [1, -1], [2, -1]])
                    pt(wi + dx, base + dy, 0x2a2a30);
                pt(wi + 1, base - 2, 0x9a9aa6);
            }
        };
        const ng = L - nc + 2;
        col(ng + 1, botAt(ng), base - 3 - botAt(ng), 0x9a9aa6);
        wheel(ng, 1);
        lights.land.push([ng + 2, botAt(ng) + 1 - base]);
        const mg = wr + 2, n = T.bogie || (T.L > 70 ? 2 : 1);
        g.rect(Math.min(X(mg + 1), X(mg + 2)), belly, 2, T.gear - 3, 0x8a8a96);
        wheel(mg - (n > 1 ? 1 : 0), n);
    }
    // where the beacons and the tail light sit
    lights.beacon.push([Math.round(L * 0.5), topAt(Math.round(L * 0.5)) - 1 - base], [Math.round(L * 0.45), belly + 1 - base]);
    lights.strobe.push([2, topAt(2) - base]);
    lights.main = wr + 2;
    lights.belly = belly - base;
    lights.top = Math.min(topAt(Math.round(L * 0.1)) - T.tail, top0 - 7) - base;
    return lights;
}
