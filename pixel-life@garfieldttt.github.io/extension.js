// Pixel Life Wallpaper: renders the pixel-art scene of engine/ into an
// actor in the shell's background group, one scene per monitor.
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Cogl from 'gi://Cogl';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Engine} from './engine/scene.js';

const DEFAULT_LAT = 48;
const ZONE_TABLES = ['/usr/share/zoneinfo/zone1970.tab', '/usr/share/zoneinfo/zone.tab'];

// Latitude of the computer's time zone from the tz database, so sunrise
// and sunset fit the place without a setting. Read without blocking the
// shell; calls back once with the latitude, or not at all when the zone
// is not listed.
function readZoneLatitude(cancellable, callback, files = ZONE_TABLES) {
    if (!files.length)
        return;
    const id = GLib.TimeZone.new_local().get_identifier();
    Gio.File.new_for_path(files[0]).load_contents_async(cancellable, (file, res) => {
        let bytes;
        try {
            [, bytes] = file.load_contents_finish(res);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                readZoneLatitude(cancellable, callback, files.slice(1));
            return;
        }
        for (const line of new TextDecoder().decode(bytes).split('\n')) {
            const cols = line.split('\t');
            const m = cols[2] === id && /^([+-])(\d\d)(\d\d)(\d\d)?[+-]/.exec(cols[1]);
            if (m) {
                callback((m[1] === '-' ? -1 : 1) * (+m[2] + m[3] / 60 + (m[4] ?? 0) / 3600));
                return;
            }
        }
        readZoneLatitude(cancellable, callback, files.slice(1));
    });
}

class MonitorScene {
    constructor(monitor, settings, lat) {
        this.index = monitor.index;
        const scale = settings.get_int('pixel-scale');
        this.w = Math.ceil(monitor.width / scale);
        this.h = Math.ceil(monitor.height / scale);
        this.engine = new Engine(this.w, this.h, {
            motif: settings.get_string('motif'),
            rotateMinutes: settings.get_int('rotate-minutes'),
            clock: settings.get_string('clock-style'),
            clockPos: settings.get_string('clock-position'),
            lat,
            season: settings.get_string('season'),
            timeOfDay: settings.get_string('time-of-day'),
            weather: settings.get_string('weather'),
            people: settings.get_int('people-density') / 100,
            traffic: settings.get_int('traffic-density') / 100,
        });
        this.content = St.ImageContent.new_with_preferred_size(this.w, this.h);
        this.actor = new St.Widget({
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            reactive: false,
        });
        this.actor.set_content(this.content);
        this.actor.set_content_scaling_filters(Clutter.ScalingFilter.NEAREST, Clutter.ScalingFilter.NEAREST);
        this.covered = false;
    }

    // set_data reads the buffer directly; a GLib.Bytes per frame would
    // copy several MB into the JS heap and stall the shell with GC pauses
    render(coglContext) {
        this.content.set_data(coglContext, this.engine.render(),
            Cogl.PixelFormat.RGBA_8888, this.w, this.h, this.w * 4);
    }

    destroy() {
        this.actor.destroy();
        this.actor = null;
        this.content = null;
        this.engine = null;
    }
}

// GNOME 49 added is_maximized(); GNOME 48 only has the two properties
function isMaximized(w) {
    return w.is_maximized?.() ?? (w.maximized_horizontally && w.maximized_vertically);
}

export default class PixelLifeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._scenes = [];
        this._lat = DEFAULT_LAT;
        this._cancellable = new Gio.Cancellable();
        readZoneLatitude(this._cancellable, lat => {
            this._lat = lat;
            for (const s of this._scenes)
                s.engine.setOption('lat', lat);
        });
        this._group = Main.layoutManager._backgroundGroup;
        this._build();
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this._rebuild());
        // wallpaper changes add new background actors on top; stay above them
        this._childAddedId = this._group.connect('child-added', (_g, child) => {
            if (!this._scenes.some(s => s.actor === child))
                this._raise();
        });
        this._settingsId = this._settings.connect('changed', (_s, key) => this._onSetting(key));
        this._menuItems = [];
        this._bgSignals = [];
        this._menuSignals = [];
        this._hookMenus();
        this._syncIndicator();
    }

    disable() {
        this._cancellable.cancel();
        this._cancellable = null;
        this._removeIndicator();
        this._unhookMenus();
        this._stop();
        if (this._monitorsId)
            Main.layoutManager.disconnect(this._monitorsId);
        if (this._childAddedId)
            this._group.disconnect(this._childAddedId);
        if (this._settingsId)
            this._settings.disconnect(this._settingsId);
        this._monitorsId = this._childAddedId = this._settingsId = null;
        this._destroyScenes();
        this._group = null;
        this._settings = null;
    }

    _build() {
        for (const monitor of Main.layoutManager.monitors) {
            const scene = new MonitorScene(monitor, this._settings, this._lat);
            this._group.add_child(scene.actor);
            this._scenes.push(scene);
        }
        // all monitors show the same weather as the first one
        for (const s of this._scenes.slice(1))
            s.engine.leader = this._scenes[0].engine;
        this._raise();
        this._start();
    }

    _rebuild() {
        this._stop();
        this._destroyScenes();
        this._build();
        this._hookMenus();
    }

    // Scene and clock choices plus Settings, added to any popup menu.
    // Returns a function that moves the check marks to the current values.
    _fillMenu(menu) {
        const choice = (key, options) => {
            const items = options.map(([value, label]) => {
                const item = menu.addAction(label, () => this._settings.set_string(key, value));
                item._value = value;
                return item;
            });
            return () => items.forEach(i => i.setOrnament(i._value === this._settings.get_string(key)
                ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NO_DOT));
        };
        const syncScene = choice('motif', [['village', 'Village by the lake'], ['city', 'Big city'], ['country', 'Countryside'], ['medieval', 'Medieval town'], ['space', 'Space'], ['underwater', 'Under the sea'], ['auto', 'Alternate scenes']]);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const syncClock = choice('clock-style', [['none', 'No clock'], ['infobox', 'Info box clock'], ['digital', 'Digital clock'], ['analog', 'Analog clock']]);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction('Settings...', () => this.openPreferences());
        return () => {
            syncScene();
            syncClock();
        };
    }

    // Top bar button, because desktop icon extensions take over the
    // right-click on the background
    _syncIndicator() {
        const want = this._settings.get_boolean('show-indicator');
        if (want && !this._indicator) {
            this._indicator = new PanelMenu.Button(0.5, 'Pixel Life');
            this._indicator.add_child(new St.Icon({icon_name: 'preferences-desktop-wallpaper-symbolic', style_class: 'system-status-icon'}));
            const sync = this._fillMenu(this._indicator.menu);
            this._indicatorOpenId = this._indicator.menu.connect('open-state-changed', (_m, open) => {
                if (open)
                    sync();
            });
            Main.panel.addToStatusArea(this.uuid, this._indicator);
        } else if (!want) {
            this._removeIndicator();
        }
    }

    _removeIndicator() {
        if (!this._indicator)
            return;
        this._indicator.menu.disconnect(this._indicatorOpenId);
        this._indicator.destroy();
        this._indicator = null;
        this._indicatorOpenId = null;
    }

    // Right-click menu on the desktop background: a "Pixel Life" submenu.
    // The shell recreates the background actor (and its menu) whenever the
    // wallpaper changes, so the entry is added again on 'changed'.
    _hookMenus() {
        this._unhookMenus();
        for (const bgm of Main.layoutManager._bgManagers ?? []) {
            this._bgSignals.push([bgm, bgm.connect('changed', () => this._addMenu(bgm))]);
            this._addMenu(bgm);
        }
    }

    _unhookMenus() {
        for (const [bgm, id] of this._bgSignals ?? [])
            bgm.disconnect(id);
        this._bgSignals = [];
        for (const [menu, ids] of this._menuSignals ?? [])
            ids.forEach(id => menu.disconnect(id));
        this._menuSignals = [];
        for (const [, items] of this._menuItems ?? [])
            items.forEach(i => i.destroy());
        this._menuItems = [];
    }

    _addMenu(bgm) {
        const menu = bgm.backgroundActor?._backgroundMenu;
        if (!menu)
            return;
        const sep = new PopupMenu.PopupSeparatorMenuItem();
        const sub = new PopupMenu.PopupSubMenuMenuItem('Pixel Life');
        const sync = this._fillMenu(sub.menu);
        const openId = menu.connect('open-state-changed', (_m, open) => {
            if (open)
                sync();
        });
        menu.addMenuItem(sep);
        menu.addMenuItem(sub);
        // a replaced background takes its menu and our items with it
        const destroyId = menu.connect('destroy', () => {
            this._menuSignals = this._menuSignals.filter(([m]) => m !== menu);
            this._menuItems = this._menuItems.filter(([m]) => m !== menu);
        });
        this._menuSignals.push([menu, [openId, destroyId]]);
        this._menuItems.push([menu, [sep, sub]]);
    }

    _destroyScenes() {
        for (const s of this._scenes)
            s.destroy();
        this._scenes = [];
    }

    _raise() {
        for (const s of this._scenes)
            this._group.set_child_above_sibling(s.actor, null);
    }

    _onSetting(key) {
        const map = {'motif': 'motif', 'clock-style': 'clock', 'clock-position': 'clockPos', 'rotate-minutes': 'rotateMinutes',
            'season': 'season', 'time-of-day': 'timeOfDay', 'weather': 'weather'};
        if (map[key]) {
            const value = key === 'rotate-minutes' ? this._settings.get_int(key) : this._settings.get_string(key);
            for (const s of this._scenes)
                s.engine.setOption(map[key], value);
        } else if (key === 'people-density' || key === 'traffic-density') {
            for (const s of this._scenes)
                s.engine.setOption(key === 'people-density' ? 'people' : 'traffic', this._settings.get_int(key) / 100);
        } else if (key === 'show-indicator') {
            this._syncIndicator();
        } else if (key === 'fps') {
            this._stop();
            this._start();
        } else {
            this._rebuild();
        }
    }

    _start() {
        const coglContext = global.stage.context.get_backend().get_cogl_context();
        const interval = Math.round(1000 / this._settings.get_int('fps'));
        let last = GLib.get_monotonic_time();
        let coverCheck = 0;
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            const now = GLib.get_monotonic_time();
            const real = (now - last) / 1e6;
            last = now;
            if (Main.sessionMode.isLocked)
                return GLib.SOURCE_CONTINUE;
            coverCheck -= real;
            if (coverCheck <= 0) {
                coverCheck = 1;
                this._updateCovered();
            }
            // tick every scene, the first one leads the shared weather
            for (const s of this._scenes) {
                s.engine.tick(real);
                if (!s.covered)
                    s.render(coglContext);
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stop() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
    }

    _updateCovered() {
        const pause = this._settings.get_boolean('pause-when-covered');
        const ws = global.workspace_manager.get_active_workspace();
        // desktop icon extensions (DING) keep their transparent window
        // maximized; it skips the taskbar, real windows do not
        const windows = pause
            ? ws.list_windows().filter(w => !w.skip_taskbar && w.get_window_type() !== Meta.WindowType.DESKTOP)
            : [];
        for (const s of this._scenes) {
            s.covered = windows.some(w => !w.minimized && w.get_monitor() === s.index &&
                (w.is_fullscreen() || isMaximized(w)));
        }
    }
}
