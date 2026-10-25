// Delayed callbacks driven by the scene's update loop (no real timeouts).
export class Timers {
    constructor() {
        this.list = [];
    }

    add(delay, fn) {
        this.list.push({t: delay, fn});
    }

    run(real) {
        if (!this.list.length)
            return;
        const due = [];
        for (const t of this.list) {
            t.t -= real;
            if (t.t <= 0)
                due.push(t);
        }
        if (due.length) {
            this.list = this.list.filter(t => t.t > 0);
            for (const t of due)
                t.fn();
        }
    }
}
