import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Combo row bound to a string key: [[value, label], ...]
function comboRow(settings, key, title, choices) {
    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(choices.map(c => c[1])),
    });
    const sync = () => {
        const i = choices.findIndex(c => c[0] === settings.get_string(key));
        row.selected = Math.max(0, i);
    };
    sync();
    row.connect('notify::selected', () => settings.set_string(key, choices[row.selected][0]));
    return row;
}

function spinRow(settings, key, title, subtitle, lower, upper, step, digits = 0) {
    const row = new Adw.SpinRow({
        title,
        subtitle: subtitle ?? '',
        digits,
        adjustment: new Gtk.Adjustment({lower, upper, step_increment: step}),
    });
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

// Slider bound to an integer key, shown in percent
function scaleRow(settings, key, title, subtitle, lower, upper) {
    const row = new Adw.ActionRow({title, subtitle});
    const scale = new Gtk.Scale({
        adjustment: new Gtk.Adjustment({lower, upper, step_increment: 10, page_increment: 25}),
        draw_value: true,
        value_pos: Gtk.PositionType.LEFT,
        digits: 0,
        hexpand: true,
        width_request: 220,
        valign: Gtk.Align.CENTER,
    });
    scale.set_format_value_func((_s, v) => `${Math.round(v)} %`);
    scale.add_mark(100, Gtk.PositionType.BOTTOM, null);
    settings.bind(key, scale.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(scale);
    return row;
}

export default class PixelLifePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Pixel Life', icon_name: 'preferences-desktop-wallpaper-symbolic'});

        const scene = new Adw.PreferencesGroup({title: 'Scene'});
        scene.add(comboRow(settings, 'motif', 'Motif', [['village', 'Village by the lake'], ['city', 'Big city (side view)'], ['country', 'Countryside (side view)'], ['medieval', 'Medieval town (side view)'], ['space', 'Space'], ['underwater', 'Under the sea'], ['auto', 'Alternate']]));
        scene.add(spinRow(settings, 'rotate-minutes', 'Change scene every', 'Minutes, when alternating', 5, 1440, 5));
        page.add(scene);

        const crowd = new Adw.PreferencesGroup({title: 'Crowd', description: 'Turn down when the scene feels too busy'});
        crowd.add(scaleRow(settings, 'people-density', 'People', 'Walkers, divers and merfolk', 0, 200));
        crowd.add(scaleRow(settings, 'traffic-density', 'Vehicles', 'Cars, trains, ships and submarines', 0, 200));
        page.add(crowd);

        const time = new Adw.PreferencesGroup({title: 'Time and weather', description: 'Automatic follows the clock and date of this computer'});
        time.add(comboRow(settings, 'time-of-day', 'Time of day', [['auto', 'Automatic'], ['morning', 'Morning'], ['day', 'Day'], ['evening', 'Evening'], ['night', 'Night']]));
        time.add(comboRow(settings, 'season', 'Season', [['auto', 'Automatic'], ['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']]));
        time.add(comboRow(settings, 'weather', 'Weather', [['auto', 'Automatic'], ['clear', 'Clear'], ['partly', 'Partly cloudy'], ['overcast', 'Overcast'], ['drizzle', 'Drizzle'], ['rain', 'Rain'], ['storm', 'Thunderstorm'], ['snow', 'Snow'], ['fog', 'Fog']]));
        page.add(time);

        const clock = new Adw.PreferencesGroup({title: 'Clock'});
        clock.add(comboRow(settings, 'clock-style', 'Style', [['none', 'Off'], ['infobox', 'Info box'], ['digital', 'Digital'], ['analog', 'Analog']]));
        clock.add(comboRow(settings, 'clock-position', 'Position', [['top-right', 'Top right'], ['top-left', 'Top left'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left']]));
        page.add(clock);

        const perf = new Adw.PreferencesGroup({title: 'Performance'});
        perf.add(spinRow(settings, 'pixel-scale', 'Pixel size', 'Screen pixels per art pixel; bigger is faster', 2, 8, 1));
        perf.add(spinRow(settings, 'fps', 'Frames per second', null, 5, 30, 1));
        const pause = new Adw.SwitchRow({title: 'Pause when covered', subtitle: 'While a maximized or fullscreen window fills the screen'});
        settings.bind('pause-when-covered', pause, 'active', Gio.SettingsBindFlags.DEFAULT);
        perf.add(pause);
        page.add(perf);

        const panel = new Adw.PreferencesGroup({title: 'Top bar'});
        const indicator = new Adw.SwitchRow({title: 'Show menu in the top bar', subtitle: 'Quick access to scene and clock'});
        settings.bind('show-indicator', indicator, 'active', Gio.SettingsBindFlags.DEFAULT);
        panel.add(indicator);
        page.add(panel);

        // the shell caches extension code until it restarts, and on Wayland
        // a restart means a new session
        page.add(new Adw.PreferencesGroup({
            title: 'Note',
            description: 'Settings apply right away. After installing or updating the extension by hand, log out and back in so GNOME Shell loads the new version.',
        }));

        const about = new Adw.PreferencesGroup({title: 'About'});
        const author = new Adw.ActionRow({title: 'Author', subtitle: 'Garfieldttt (Thomas Rzen)'});
        author.add_suffix(new Gtk.LinkButton({uri: 'https://github.com/Garfieldttt/pixel-life', label: 'GitHub', valign: Gtk.Align.CENTER}));
        about.add(author);
        const coffee = new Adw.ActionRow({title: 'Buy me a coffee', subtitle: 'If you enjoy Pixel Life'});
        coffee.add_suffix(new Gtk.LinkButton({uri: 'https://www.paypal.com/paypalme/opengamepoint', label: 'PayPal', valign: Gtk.Align.CENTER}));
        about.add(coffee);
        page.add(about);

        window.add(page);
    }
}
