// Sun, moon, season and the light/sky colors derived from them.
import {clamp} from './util.js';
import {mix} from './gfx.js';

const RAD = Math.PI / 180;

function stdOffset(date) {
    const y = date.getFullYear();
    return Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
}

// Approximate solar time from the time zone; good enough for a wallpaper.
export function solar(date, lat) {
    const doy = (date - new Date(date.getFullYear(), 0, 0)) / 86400000;
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365) * RAD;
    const dst = date.getTimezoneOffset() < stdOffset(date) ? 1 : 0;
    const t = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600 - dst;
    const la = lat * RAD;
    const elevAt = tt => Math.asin(Math.sin(la) * Math.sin(decl) +
        Math.cos(la) * Math.cos(decl) * Math.cos(15 * (tt - 12) * RAD)) / RAD;
    const half = Math.acos(clamp(-Math.tan(la) * Math.tan(decl), -1, 1)) / RAD / 15;
    return {t, elev: elevAt(t), rise: 12 - half, set: 12 + half, noon: elevAt(12), elevAt};
}

export function moonPhase(date) {
    const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
    return ((days / 29.530588853) % 1 + 1) % 1;
}

// elevation, sky top, sky bottom, ambient light
const SKY = [
    [-18, 0x0a0d24, 0x18183a, [0.30, 0.32, 0.55]],
    [-9, 0x111638, 0x2c2650, [0.34, 0.34, 0.58]],
    [-3, 0x262c66, 0x9a5070, [0.50, 0.42, 0.62]],
    [0, 0x3c4488, 0xf89058, [0.78, 0.58, 0.56]],
    [4, 0x5a7cc8, 0xfcc080, [0.95, 0.82, 0.72]],
    [12, 0x4a94e0, 0xb4e0f8, [1, 1, 1]],
    [90, 0x3c88d8, 0xa4d4f4, [1, 1, 1]],
];

export function skyAt(elev) {
    let i = 0;
    while (i < SKY.length - 2 && elev > SKY[i + 1][0])
        i++;
    const a = SKY[i], b = SKY[i + 1];
    const t = clamp((elev - a[0]) / (b[0] - a[0]), 0, 1);
    return {
        top: mix(a[1], b[1], t),
        bottom: mix(a[2], b[2], t),
        amb: a[3].map((v, k) => v + (b[3][k] - v) * t),
    };
}

export function season(month) {
    if (month === 11 || month <= 1)
        return 'winter';
    if (month <= 4)
        return 'spring';
    if (month <= 7)
        return 'summer';
    return 'autumn';
}

export function holidays(date) {
    const m = date.getMonth(), d = date.getDate(), h = date.getHours();
    return {
        halloween: m === 9 && d >= 20,
        christmas: (m === 11 && d <= 27),
        christmasEve: m === 11 && d === 24 && h >= 17,
        newYear: (m === 11 && d === 31 && h >= 22) || (m === 0 && d === 1 && h < 2),
    };
}
