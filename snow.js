// Christmas snow: light fall → 2 min blizzard; pile reaches full drift by 3 min.

const Snow = {
    canvas: null,
    ctx: null,
    veil: null,
    flakes: [],
    cols: [],
    colStep: 20,
    animationId: null,
    running: false,
    accumulatedMs: 0,
    sessionStartedAt: null,
    _saveTimer: null,
    _persistBound: null,

    STORAGE_PREFIX: 'christmasSnow_',

    BLIZZARD_MS: 2 * 60 * 1000,
    PILE_FILL_MS: 2 * 60 * 1000,
    MAX_FLAKES: 260,

    SNOW_FILL: 'rgba(250, 252, 255, 0.88)',
    SNOW_EDGE: 'rgba(210, 222, 232, 0.72)',
    AIR_FLAKE_FILL: 'rgba(255, 255, 255, 0.95)',

    w() {
        return this.canvas ? this.canvas.width : window.innerWidth;
    },

    h() {
        return this.canvas ? this.canvas.height : window.innerHeight;
    },

    weekKey() {
        if (typeof Storage === 'undefined' || !Storage.getCurrentWeek) return null;
        const live = Storage.getCurrentWeek();
        const seen = (w) => localStorage.getItem(`themePopupSeen_${w}`);
        if (
            typeof ThemeGenerator !== 'undefined' &&
            ThemeGenerator.isChristmasWeekKey(live) &&
            seen(live)
        ) {
            return live;
        }
        const ambient =
            typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem('christmasAmbientPreviewWeek')
                : null;
        if (
            ambient &&
            typeof ThemeGenerator !== 'undefined' &&
            ThemeGenerator.isChristmasWeekKey(ambient) &&
            seen(ambient)
        ) {
            return ambient;
        }
        return live;
    },

    elapsedMs() {
        if (!this.sessionStartedAt) return this.accumulatedMs || 0;
        return (this.accumulatedMs || 0) + (performance.now() - this.sessionStartedAt);
    },

    blizzardT() {
        const t = this.elapsedMs() / this.BLIZZARD_MS;
        return t < 0 ? 0 : t > 1 ? 1 : t;
    },

    /** Gentle flurries early → whiteout by minute 2. */
    blizzardPower() {
        const t = this.blizzardT();
        return t * t * t;
    },

    intensity() {
        return this.blizzardPower();
    },

    /** 0→1 over PILE_FILL_MS — drifts may grow to full height when this hits 1. */
    pileFill() {
        const t = this.elapsedMs() / this.PILE_FILL_MS;
        const linear = t < 0 ? 0 : t > 1 ? 1 : t;
        return linear * linear * (3 - 2 * linear);
    },

    storageKey() {
        const week = this.weekKey();
        return week ? `${this.STORAGE_PREFIX}${week}` : null;
    },

    loadState() {
        const key = this.storageKey();
        if (!key) return null;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.week !== this.weekKey()) return null;
            return data;
        } catch {
            return null;
        }
    },

    pruneOtherWeeks(keepWeek) {
        if (!keepWeek) return;
        const prefix = this.STORAGE_PREFIX;
        const keep = prefix + keepWeek;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix) && k !== keep) localStorage.removeItem(k);
        }
    },

    applySavedCols(savedCols, refH) {
        if (!savedCols?.length) return;
        const n = this.cols.length;
        if (n < 1) return;
        const scale = refH > 0 ? this.h() / refH : 1;
        const cap = this.maxPile();
        for (let i = 0; i < n; i++) {
            const src = Math.min(
                savedCols.length - 1,
                Math.round((i / Math.max(1, n - 1)) * (savedCols.length - 1))
            );
            this.cols[i] = Math.min(cap, (savedCols[src] || 0) * scale);
        }
    },

    persist() {
        const key = this.storageKey();
        if (!key || !this.running) return;
        const week = this.weekKey();
        if (!week) return;
        const payload = {
            v: 1,
            week,
            elapsedMs: this.elapsedMs(),
            cols: this.cols.slice(),
            refH: this.h(),
            savedAt: Date.now()
        };
        try {
            localStorage.setItem(key, JSON.stringify(payload));
        } catch {
            /* quota */
        }
    },

    bindPersist() {
        if (this._persistBound) return;
        this._persistBound = () => this.persist();
        window.addEventListener('pagehide', this._persistBound);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.persist();
        });
    },

    unbindPersist() {
        if (this._persistBound) {
            window.removeEventListener('pagehide', this._persistBound);
            this._persistBound = null;
        }
        if (this._saveTimer != null) {
            clearInterval(this._saveTimer);
            this._saveTimer = null;
        }
    },

    pileHeightCap() {
        return this.maxPile() * this.pileFill();
    },

    maxPile() {
        return this.h() * 0.75;
    },

    start() {
        if (this.running) return;
        const week = this.weekKey();
        this.pruneOtherWeeks(week);

        this.flakes = [];
        this.ensureDom();
        this.resize();

        const saved = this.loadState();
        if (saved && saved.week === week) {
            this.accumulatedMs = Math.max(0, saved.elapsedMs || 0);
            this.applySavedCols(saved.cols, saved.refH);
        } else {
            this.accumulatedMs = 0;
            this.cols = this.cols.map(() => 0);
        }

        this._snowWeek = week;
        this.sessionStartedAt = performance.now();
        this.running = true;
        this.bindPersist();
        this._saveTimer = setInterval(() => this.persist(), 4000);

        const power = this.blizzardPower();
        const spawnCount = Math.min(this.targetFlakeCount(), 6 + Math.floor(power * 24));
        for (let i = 0; i < spawnCount; i++) this.spawnFlake(power);

        this.tick();
    },

    stop() {
        if (this.running) this.persist();
        this.running = false;
        if (this.animationId != null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.unbindPersist();
        if (this._resizeBound) {
            window.removeEventListener('resize', this._resizeBound);
            this._resizeBound = null;
        }
        this.canvas?.remove();
        this.veil?.remove();
        this.canvas = null;
        this.ctx = null;
        this.veil = null;
        this.flakes = [];
        this.cols = [];
        this.accumulatedMs = 0;
        this.sessionStartedAt = null;
    },

    ensureDom() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'snow-canvas';
            this.canvas.style.cssText =
                'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:1001;';
            document.body.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d', { alpha: true });
        }
        if (!this.veil) {
            this.veil = document.createElement('div');
            this.veil.id = 'snow-veil';
            this.veil.style.cssText =
                'position:fixed;inset:0;pointer-events:none;z-index:1000;background:#fff;opacity:0;';
            document.body.appendChild(this.veil);
        }
        if (!this._resizeBound) {
            this._resizeBound = () => this.resize();
            window.addEventListener('resize', this._resizeBound);
        }
    },

    resize() {
        if (!this.canvas) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.canvas.width = width;
        this.canvas.height = height;
        const n = Math.max(12, Math.ceil(width / this.colStep));
        if (this.cols.length === n) return;
        const prev = this.cols;
        this.cols = new Array(n).fill(0);
        if (!prev.length) return;
        for (let i = 0; i < n; i++) {
            const src = Math.min(prev.length - 1, Math.round((i / (n - 1)) * (prev.length - 1)));
            this.cols[i] = Math.min(this.maxPile(), prev[src] || 0);
        }
    },

    columnHeightAt(x) {
        const w = this.w();
        const n = this.cols.length;
        if (n < 2) return 0;
        const pos = (Math.max(0, Math.min(w, x)) / w) * (n - 1);
        const i0 = Math.floor(pos);
        const i1 = Math.min(n - 1, i0 + 1);
        const t = pos - i0;
        return this.cols[i0] * (1 - t) + this.cols[i1] * t;
    },

    /** Wavy drift outline (visual only; flakes always land at y = h). */
    pileY(x) {
        const height = this.h();
        const base = height - this.columnHeightAt(x);
        if (base >= height - 0.5) return height;

        const intense = this.intensity();
        const phase = this.elapsedMs() * 0.00001;
        const t = performance.now() * 0.0001;
        const amp = Math.min(22, 3 + this.columnHeightAt(x) * 0.06);
        const bump =
            Math.sin(x * 0.008 + t) * amp * 0.5 +
            Math.sin(x * 0.021 - t * 1.2 + phase) * amp * 0.35 +
            Math.sin(x * 0.05 + t * 0.7) * amp * (0.15 + intense * 0.1);

        return base - bump;
    },

    targetFlakeCount() {
        const power = this.blizzardPower();
        const tail = this.blizzardT() > 0.85 ? 1 + (this.blizzardT() - 0.85) * 6 : 1;
        return Math.min(this.MAX_FLAKES + 40, Math.floor(4 + power * (this.MAX_FLAKES - 4) * tail));
    },

    spawnFlake(power) {
        const w = this.w();
        const sky = power > 0.2 ? Math.random() * (60 + 220 * power) : 0;
        const streak = power > 0.75 && Math.random() < 0.35;
        this.flakes.push({
            x: Math.random() * w,
            y: -6 - Math.random() * (35 + sky),
            r: streak ? 1.5 + power * 2.5 : 1.1 + Math.random() * 2 + power * 6.5,
            vy: 0.32 + Math.random() * 0.45 + power * 6.5,
            vx: (Math.random() - 0.5) * (0.3 + power * 1.6),
            phase: Math.random() * 6.28
        });
    },

    deposit(x, radius) {
        const intense = this.intensity();
        const fill = this.pileFill();
        const heightCap = this.pileHeightCap();
        if (heightCap < 0.5) return;

        const n = this.cols.length;
        if (!n) this.resize();
        let maxCol = 0;
        for (let i = 0; i < n; i++) if (this.cols[i] > maxCol) maxCol = this.cols[i];

        const behind = heightCap > 1 ? Math.max(1, heightCap / Math.max(1, maxCol)) : 1;
        const catchUp = Math.min(2.4, 0.75 + behind * 0.35);
        const rate = (0.2 + fill * 0.75) * (0.45 + Math.max(intense, fill) * 0.55) * catchUp;
        const amount = (radius * 0.16 + 0.07) * rate;
        if (amount <= 0) return;

        const w = this.w();
        const centre = Math.round((Math.max(0, Math.min(w, x)) / w) * (n - 1));
        const spread = 3;
        for (let d = -spread; d <= spread; d++) {
            const i = centre + d;
            if (i < 0 || i >= n) continue;
            const weight = 1 - Math.abs(d) / (spread + 1);
            const add = amount * weight;
            this.cols[i] = Math.min(heightCap, Math.min(this.maxPile(), this.cols[i] + add));
        }
    },

    drawPile() {
        const ctx = this.ctx;
        const w = this.w();
        const height = this.h();
        let maxCol = 0;
        for (let i = 0; i < this.cols.length; i++) {
            if (this.cols[i] > maxCol) maxCol = this.cols[i];
        }
        if (maxCol < 1) return;

        const step = 6;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= w; x += step) {
            ctx.lineTo(x, this.pileY(x));
        }
        ctx.lineTo(w, height);
        ctx.closePath();
        ctx.fillStyle = this.SNOW_FILL;
        ctx.fill();
        ctx.strokeStyle = this.SNOW_EDGE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    },

    drawFlakes(flakeList, fill) {
        const ctx = this.ctx;
        ctx.fillStyle = fill;
        for (const f of flakeList) {
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r, 0, 6.283);
            ctx.fill();
        }
    },

    tick() {
        if (!this.running || !this.ctx) return;

        const week = this.weekKey();
        if (week && this._snowWeek && week !== this._snowWeek) {
            this.persist();
            this._snowWeek = week;
            this.pruneOtherWeeks(week);
            this.accumulatedMs = 0;
            this.cols = this.cols.map(() => 0);
            const next = this.loadState();
            if (next && next.week === week) {
                this.accumulatedMs = Math.max(0, next.elapsedMs || 0);
                this.applySavedCols(next.cols, next.refH);
            }
            this.sessionStartedAt = performance.now();
        }

        const power = this.blizzardPower();
        const t = this.blizzardT();
        const w = this.w();
        const height = this.h();
        const target = this.targetFlakeCount();

        if (this.veil) {
            const maxOpacity = document.body.classList.contains('christmas-season') ? 0.22 : 0.48;
            const whiteout = power + Math.max(0, t - 0.9) * 4;
            this.veil.style.opacity = String(Math.min(1, whiteout * maxOpacity));
        }

        const deficit = target - this.flakes.length;
        const spawnChance = 0.28 + power * 0.72;
        if (deficit > 0 && Math.random() < spawnChance) {
            let batch = 1 + Math.floor(power * 14);
            if (t >= 0.9) batch += 2 + Math.floor(Math.random() * 4);
            batch = Math.min(deficit, batch);
            for (let i = 0; i < batch; i++) this.spawnFlake(power);
        }

        this.ctx.clearRect(0, 0, w, height);

        const gust =
            Math.sin(performance.now() / 900) * 1.1 +
            Math.sin(performance.now() / 520) * 0.65 +
            Math.sin(performance.now() / 2100) * 0.4;
        const wind = gust * (0.15 + power * 5.5);
        const still = [];

        for (const f of this.flakes) {
            f.y += f.vy;
            const swirl = Math.sin(f.phase + performance.now() * (0.002 + power * 0.004)) * (0.15 + power * 0.35);
            f.x += f.vx + wind + swirl;
            if (f.x < 0) f.x += w;
            if (f.x > w) f.x -= w;

            if (f.y + f.r >= height) {
                this.deposit(f.x, f.r);
                continue;
            }
            if (f.y < height + 20) still.push(f);
        }
        this.flakes = still;

        const inAir = [];
        const intoPile = [];
        for (const f of this.flakes) {
            const surface = this.pileY(f.x);
            if (f.y - f.r >= surface) continue;
            if (f.y + f.r <= surface) inAir.push(f);
            else intoPile.push(f);
        }

        this.drawFlakes(inAir, this.AIR_FLAKE_FILL);
        this.drawFlakes(intoPile, this.SNOW_FILL);
        this.drawPile();

        this.animationId = requestAnimationFrame(() => this.tick());
    }
};