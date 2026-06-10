(function () {
    'use strict';

    const $ = document.querySelector.bind(document);

    // --- System identity (single source of truth for host/OS/kernel) ---
    const SYS = {
        os: 'CachyOS',
        host: 'cachyos',
        kernel: '6.19.11-1-cachyos',
        user: 'oleg',
    };

    // Populate System Info tile from SYS
    (() => {
        const map = { 'sys-os': SYS.os, 'sys-host': SYS.host, 'sys-kernel': SYS.kernel };
        for (const [id, val] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }
    })();

    // --- Clock Functionality ---
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        const clockEl = document.getElementById('clock');
        if (clockEl) {
            if (clockEl.textContent !== timeString) {
                clockEl.classList.add('clock-tick');
                setTimeout(() => clockEl.classList.remove('clock-tick'), 200);
            }
            clockEl.textContent = timeString;
        }
    }

    // Sync clock ticks to minute boundaries — display is HH:MM, so per-second updates are wasted work
    updateClock();
    setTimeout(() => {
        updateClock();
        setInterval(updateClock, 60000);
    }, 60000 - (Date.now() % 60000));

    // --- Uptime Functionality ---
    function updateUptime() {
        const uptimeEl = document.getElementById('uptime-value');
        if (!uptimeEl) return;

        const birthDate = new Date('2003-09-11T00:00:00');
        const now = new Date();

        let years = now.getFullYear() - birthDate.getFullYear();
        let months = now.getMonth() - birthDate.getMonth();
        let days = now.getDate() - birthDate.getDate();

        if (days < 0) {
            months--;
            const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            days += prevMonth.getDate();
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        uptimeEl.textContent = `${years}y ${months}m ${days}d`;
    }

    // Age is shown as y/m/d, so it only changes at midnight. Sync one tick to the
    // next local midnight, then refresh once per day — no per-minute wakeups.
    updateUptime();
    (function scheduleUptime() {
        const now = new Date();
        const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        setTimeout(() => {
            updateUptime();
            setInterval(updateUptime, 86400000);
        }, nextMidnight - now);
    })();

    // --- Clipboard Dialog ---
    class ClipboardDialog {
        constructor() {
            this.$dialog = $('#clipboard-dialog');
            if (!this.$dialog) return;

            this.$content = document.getElementById('clipboard-content');
            this.$closeBtn = this.$dialog.querySelector('.close-btn');
            this.setupEvents();
        }

        setupEvents() {
            this.$closeBtn.addEventListener('click', () => this.close());
            this.$dialog.addEventListener('click', (e) => {
                if (e.target === this.$dialog) this.close();
            });
            // Escape is handled natively by <dialog> showModal().
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.connection-item.contact-btn');
                if (!btn) return;
                const content = btn.dataset.content;
                if (content) this.copyToClipboard(content);
            });
        }

        async copyToClipboard(text) {
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(text);
                    this.open(text);
                } else {
                    this.fallbackCopy(text);
                }
            } catch (err) {
                this.fallbackCopy(text);
            }
        }

        fallbackCopy(text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                this.open(text);
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        }

        open(text) {
            this.$content.textContent = text;
            if (!this.$dialog.open) {
                this.$dialog.showModal();
            }
        }

        // Native close() drops [open]; CSS (@starting-style + transition-behavior:
        // allow-discrete) animates the fade-out, so no JS timer is needed.
        close() {
            this.$dialog.close();
        }
    }

    new ClipboardDialog();

    // --- Terminal (lazy-loaded on first interaction; index page only) ---
    // Terminal code is ~900 lines of scenarios/easter-eggs/Terminal class that
    // most visitors never touch. The chunk is fetched on hover/focus of the
    // toggle tile (warm-up, so activation feels instant) or on activation
    // itself. Phones never pay for it: CSS hides the tiles at <=768px, so they
    // can't be interacted with. Resume/404 pages don't have the tile at all.
    const terminalToggleTile = document.getElementById('terminal-toggle-tile');

    if (terminalToggleTile) {
        let terminalReady = null;
        const loadTerminal = () =>
            terminalReady ??= import('./terminal.js').then(({ initTerminal }) => initTerminal(SYS));

        terminalToggleTile.addEventListener('pointerenter', loadTerminal, { once: true });
        terminalToggleTile.addEventListener('focus', loadTerminal, { once: true });

        const activate = (e) => {
            if (e.type === 'keydown') {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
            }
            loadTerminal().then((openTerminal) => openTerminal());
        };
        terminalToggleTile.addEventListener('click', activate);
        terminalToggleTile.addEventListener('keydown', activate);
    }

})();
