// Canvas confetti — upward burst, slow fall, spinning particles

const Confetti = {
    canvas: null,
    ctx: null,
    particles: [],
    animationId: null,
    running: false,

    colours: ['#265476', '#F3604D', '#CEAD4E', '#52878B', '#659DBD', '#DD062B', '#D5B9AD', '#ACB2A4'],

    burst(originX, originY) {
        this.ensureCanvas();
        const count = 380 + Math.floor(Math.random() * 101);

        for (let i = 0; i < count; i++) {
            const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 1.15;
            const speed = 4 + Math.random() * 7;
            this.particles.push({
                x: originX + (Math.random() - 0.5) * 36,
                y: originY + (Math.random() - 0.5) * 18,
                originX,
                vx: Math.cos(angle) * speed * 0.68 + (Math.random() - 0.5) * 0.8,
                vy: Math.sin(angle) * speed - Math.random() * 2,
                width: 5 + Math.random() * 7,
                height: 3 + Math.random() * 5,
                colour: this.colours[Math.floor(Math.random() * this.colours.length)],
                rotation: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 0.12,
                opacity: 1,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.02 + Math.random() * 0.03
            });
        }

        if (!this.running) {
            this.running = true;
            this.animate();
        }
    },

    ensureCanvas() {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'confetti-canvas';
        this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1001;';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    animate() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const gravity = 0.018;
        const dragX = 0.989;
        const dragY = 0.999;
        const maxDrift = this.canvas.width * 0.42;

        this.particles.forEach(p => {
            p.vy += gravity;
            p.vx *= dragX;
            p.vy *= dragY;
            p.wobble += p.wobbleSpeed;
            p.x += p.vx + Math.sin(p.wobble) * 0.15;
            p.y += p.vy;
            p.rotation += p.spin;

            const drift = p.x - p.originX;
            if (Math.abs(drift) > maxDrift) {
                p.vx += -Math.sign(drift) * 0.08;
            }

            const edgePadding = 24;
            if (p.x < edgePadding) {
                p.vx += (edgePadding - p.x) * 0.02;
            } else if (p.x > this.canvas.width - edgePadding) {
                p.vx -= (p.x - (this.canvas.width - edgePadding)) * 0.02;
            }

            if (p.y > this.canvas.height + 50) {
                p.opacity = 0;
            }

            if (p.opacity <= 0) return;

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = p.colour;
            this.ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            this.ctx.restore();
        });

        this.particles = this.particles.filter(p => p.opacity > 0 && p.y < this.canvas.height + 100);

        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            this.cleanup();
        }
    },

    cleanup() {
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
        this.particles = [];
    }
};
