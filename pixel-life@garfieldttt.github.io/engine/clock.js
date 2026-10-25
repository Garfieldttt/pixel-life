// Optional clock overlay: 'infobox' (info box), 'digital', 'analog'.
import {shadow, highlight, OUTLINE} from './gfx.js';

const WOOD = 0xb86a30, WOOD_DK = 0x7a3e1c, PAPER = 0xf8dca0, INK = 0x5a2a10;

function frame(g, x, y, w, h) {
    g.rectE(x, y, w, h, OUTLINE);
    g.rectE(x + 1, y + 1, w - 2, h - 2, WOOD);
    g.rectE(x + 1, y + 1, w - 2, 1, highlight(WOOD, 0.3));
    g.rectE(x + 1, y + h - 2, w - 2, 1, WOOD_DK);
    g.rectE(x + 3, y + 3, w - 6, h - 6, WOOD_DK);
    g.rectE(x + 4, y + 4, w - 8, h - 8, PAPER);
    g.rectE(x + 4, y + 4, w - 8, 1, highlight(PAPER, 0.4));
}

function weatherIcon(g, x, y, env) {
    const v = env.weather.v;
    if (v.snow > 0.4) {
        g.rectE(x + 1, y, 1, 5, 0x6a8ac8);
        g.rectE(x - 1, y + 2, 5, 1, 0x6a8ac8);
        g.pxE(x, y + 1, 0x6a8ac8);
        g.pxE(x + 2, y + 3, 0x6a8ac8);
    } else if (v.rain > 0.3) {
        g.rectE(x, y, 5, 2, 0x8a9ab0);
        g.pxE(x, y + 3, 0x4870c8);
        g.pxE(x + 2, y + 4, 0x4870c8);
        g.pxE(x + 4, y + 3, 0x4870c8);
    } else if (v.clouds > 0.6) {
        g.rectE(x, y + 1, 6, 3, 0x9aa4b4);
        g.rectE(x + 1, y, 3, 1, 0x9aa4b4);
    } else if (env.dark > 0.5) {
        g.rectE(x + 1, y, 3, 5, 0xf0d860);
        g.rectE(x + 2, y, 2, 4, PAPER);
    } else {
        g.rectE(x, y, 5, 5, 0xf8c030);
        g.pxE(x, y, PAPER);
        g.pxE(x + 4, y, PAPER);
        g.pxE(x, y + 4, PAPER);
        g.pxE(x + 4, y + 4, PAPER);
    }
}

function clean(s) {
    return s.replace(/[^A-Za-z0-9 .:]/g, '').toUpperCase();
}

export function drawClock(g, env, style, pos) {
    if (!style || style === 'none')
        return;
    const d = env.clockDate ?? env.date;
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    const colon = d.getSeconds() % 2 === 0 ? ':' : ' ';
    let w, h;
    if (style === 'infobox') {
        w = 66;
        h = 34;
    } else if (style === 'digital') {
        w = g.textWidth('00:00', 3) + 14;
        h = 15 + 10;
    } else {
        w = h = 40;
    }
    const margin = 6, top = 12;
    const x = pos.includes('left') ? margin : g.w - w - margin;
    const y = pos.includes('top') ? top : g.h - h - margin;
    if (style === 'infobox') {
        frame(g, x, y, w, h);
        let wd;
        try {
            wd = clean(d.toLocaleDateString(undefined, {weekday: 'short'})).slice(0, 3);
        } catch {
            wd = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d.getDay()];
        }
        g.text(`${wd} ${d.getDate()}.${d.getMonth() + 1}.`, x + 7, y + 7, INK, true);
        weatherIcon(g, x + w - 13, y + 7, env);
        g.rectE(x + 6, y + 14, w - 12, 1, shadow(PAPER, 0.25));
        g.text(`${hh}${colon}${mm}`, x + Math.floor((w - g.textWidth('00:00', 2)) / 2), y + 18, INK, true, 2);
    } else if (style === 'digital') {
        g.blend(x, y, w, h, 0x101420, 0.55, true);
        const tx = x + 7, ty = y + 5;
        g.text(`${hh}${colon}${mm}`, tx + 1, ty + 1, 0x1a1020, true, 3);
        g.text(`${hh}${colon}${mm}`, tx, ty, 0xfff0d0, true, 3);
    } else {
        const cx = x + 20, cy = y + 20, r = 17;
        g.disc(cx, cy, r + 2, OUTLINE, true);
        g.disc(cx, cy, r + 1, WOOD, true);
        g.disc(cx, cy, r - 1, PAPER, true);
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            const k = i % 3 === 0 ? 3 : 1;
            for (let j = 0; j < k; j++)
                g.pxE(cx + Math.sin(a) * (r - 2 - j), cy - Math.cos(a) * (r - 2 - j), INK);
        }
        const hrs = (d.getHours() % 12) + d.getMinutes() / 60, min = d.getMinutes() + d.getSeconds() / 60;
        const ha = hrs / 12 * Math.PI * 2, ma = min / 60 * Math.PI * 2, sa = d.getSeconds() / 60 * Math.PI * 2;
        g.line(cx, cy, cx + Math.sin(ha) * 8, cy - Math.cos(ha) * 8, INK, true);
        g.line(cx + 1, cy, cx + 1 + Math.sin(ha) * 8, cy - Math.cos(ha) * 8, INK, true);
        g.line(cx, cy, cx + Math.sin(ma) * 13, cy - Math.cos(ma) * 13, INK, true);
        g.line(cx, cy, cx + Math.sin(sa) * 14, cy - Math.cos(sa) * 14, 0xd04030, true);
        g.rectE(cx - 1, cy - 1, 3, 3, WOOD_DK);
    }
}
