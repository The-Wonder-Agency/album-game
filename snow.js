// Falling snow — intensity ramps with time on page until blizzard; piles at bottom

const Snow = {
    canvas: null,
    ctx: null,
    flakes: [],
    groundCols: [],
    animationId: null,
    running: false,
    startedAt: null,
    veil: null,
    BLIZZARD_MS: 3 * 60 * 1000,
    COL_WIDTH: 12,
    MAX_PILE_PX: 600,

    start() {
        if (this.running) return;
        this.startedAt = performance.now();
        this.ensureCanvas();
        this.ensureVeil();
        this.running = true;
        this.spawnFlakes(8);
        this.animate();
    },

    ensureCanvas() {
        if (this.canvas) return;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'snow-canvas';
        this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1001;';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    ensureVeil() {
        if (this.veil) return;
        this.veil = document.createElement('div');
        this.veil.id = 'snow-veil';
        this.veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1000;background:white;opacity:0;transition:opacity 1.2s ease;';
        document.body.appendChild(this.veil);
    },

    initGround() {
        const w = this.canvas?.width || window.innerWidth;
        const cols = Math.ceil(w / this.COL_WIDTH) + 2;
        const prev = this.groundCols;
        this.groundCols = new Array(cols).fill(0);
        if (prev.length && prev.length !== cols) {
            const ratio = cols / prev.length;
            for (let i = 0; i < cols; i++) {
                const src = Math.min(prev.length - 1, Math.floor(i / ratio));
                this.groundCols[i] = prev[src] || 0;
            }
        }
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.initGround();
    },

    intensity() {
        if (!this.startedAt) return 0;
        const t = performance.now() - this.startedAt;
        return Math.min(1, t / this.BLIZZARD_MS);
    },

    maxPileHeight() {
        return 18 + this.intensity() * this.MAX_PILE_PX;
    },

    pileHeightAt(x) {
        if (!this.groundCols.length) return 0;
        const idx = x / this.COL_WIDTH;
        const i0 = Math.max(0, Math.floor(idx));
        const i1 = Math.min(this.groundCols.length - 1, i0 + 1);
        const t = idx - i0;
        const h0 = this.groundCols[i0] || 0;
        const h1 = this.groundCols[i1] || 0;
        return h0 * (1 - t) + h1 * t;
    },

    depositSnow(x, amount) {
        if (!this.groundCols.length) return;
        const i = Math.floor(x / this.COL_WIDTH);
        if (i < 0 || i >= this.groundCols.length) return;
        const cap = this.maxPileHeight();
        const add = amount;
        this.groundCols[i] = Math.min(cap, this.groundCols[i] + add);
        const spill = add * 0.35;
        if (i > 0) {
            this.groundCols[i - 1] = Math.min(cap, this.groundCols[i - 1] + spill * 0.45);
        }
        if (i < this.groundCols.length - 1) {
            this.groundCols[i + 1] = Math.min(cap, this.groundCols[i + 1] + spill * 0.45);
        }
    },

    smoothGround() {
        if (this.groundCols.length < 3) return;
        const next = this.groundCols.slice();
        for (let i = 1; i < this.groundCols.length - 1; i++) {
            next[i] = (this.groundCols[i - 1] + this.groundCols[i] * 2 + this.groundCols[i + 1]) / 4;
        }
        this.groundCols = next;
    },

    drawPile() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cw = this.COL_WIDTH;
        if (!this.groundCols.some(v => v > 0.5)) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i < this.groundCols.length; i++) {
            const x = i * cw;
            const pileTop = h - this.groundCols[i];
            ctx.lineTo(x, pileTop);
        }
        ctx.lineTo(w, h);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, h - this.maxPileHeight(), 0, h);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        grad.addColorStop(0.4, 'rgba(248, 252, 255, 0.95)');
        grad.addColorStop(1, 'rgba(230, 238, 245, 0.92)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < this.groundCols.length; i++) {
            const x = i * cw;
            const pileTop = h - this.groundCols[i];
            if (i === 0) ctx.moveTo(x, pileTop);
            else ctx.lineTo(x, pileTop);
        }
        ctx.stroke();
        ctx.restore();
    },

    spawnFlakes(count) {
        const w = this.canvas?.width || window.innerWidth;
        const intense = this.intensity();
        for (let i = 0; i < count; i++) {
            const sizeBase = 1.5 + intense * 5;
            this.flakes.push({
                x: Math.random() * w,
                y: -10 - Math.random() * 40,
                r: sizeBase + Math.random() * (2 + intense * 4),
                vy: 0.6 + Math.random() * (1.2 + intense * 3.5),
                vx: (Math.random() - 0.5) * (0.3 + intense * 2.2),
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.02 + Math.random() * 0.04,
                opacity: 0.5 + Math.random() * 0.5
            });
        }
    },

    animate() {
        if (!this.ctx || !this.canvas || !this.running) return;

        const intense = this.intensity();
        if (this.veil) {
            const onChristmasPalette = document.body.classList.contains('christmas-season');
            const veilMax = onChristmasPalette ? 0.22 : 0.55;
            this.veil.style.opacity = String(intense * veilMax);
        }

        const spawnRate = 2 + Math.floor(intense * 14);
        if (Math.random() < 0.35 + intense * 0.65) {
            this.spawnFlakes(spawnRate);
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const wind = (Math.sin(performance.now() / 1200) * 0.4 + intense * 1.8);
        const h = this.canvas.height;

        const surviving = [];
        for (const f of this.flakes) {
            f.wobble += f.wobbleSpeed;
            f.x += f.vx + wind + Math.sin(f.wobble) * (0.2 + intense);
            f.y += f.vy;

            const surface = h - this.pileHeightAt(f.x);
            if (f.y + f.r >= surface) {
                this.depositSnow(f.x, f.r * 0.65 + 0.2);
                continue;
            }

            if (f.y < h + 30 && f.x > -40 && f.x < this.canvas.width + 40) {
                surviving.push(f);
            }
        }
        this.flakes = surviving;

        if (Math.random() < 0.15 + intense * 0.2) {
            this.smoothGround();
        }

        this.drawPile();

        this.flakes.forEach(f => {
            this.ctx.save();
            this.ctx.shadowColor = 'rgba(30, 50, 55, 0.45)';
            this.ctx.shadowBlur = Math.max(2, f.r * 0.8);
            this.ctx.beginPath();
            this.ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, f.opacity + 0.15)})`;
            this.ctx.fill();
            this.ctx.restore();
        });

        const maxFlakes = 400 + Math.floor(intense * 1200);
        if (this.flakes.length > maxFlakes) {
            this.flakes = this.flakes.slice(-maxFlakes);
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    },

    stop() {
        this.running = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
            this.ctx = null;
        }
        if (this.veil) {
            this.veil.remove();
            this.veil = null;
        }
        this.flakes = [];
        this.groundCols = [];
        this.startedAt = null;
    }
};