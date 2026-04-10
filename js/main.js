(function () {
    'use strict';

    const $ = document.querySelector.bind(document);
    const isMobile = window.innerWidth <= 768;

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

    updateUptime();
    setInterval(updateUptime, 60000);

    // --- Clipboard Dialog ---
    class ClipboardDialog {
        constructor() {
            this.$dialog = $('#clipboard-dialog');
            if (!this.$dialog) return;

            this.$wrapper = this.$dialog.querySelector('.wrapper');
            this.$content = document.getElementById('clipboard-content');
            this.$closeBtn = this.$dialog.querySelector('.close-btn');
            this.closeTimeout = null;
            this.setupEvents();
        }

        setupEvents() {
            this.$closeBtn.addEventListener('click', () => this.close());
            this.$dialog.addEventListener('click', (e) => {
                if (e.target === this.$dialog) this.close();
            });
            this.$dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.close();
            });
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
            if (this.closeTimeout) {
                clearTimeout(this.closeTimeout);
                this.closeTimeout = null;
            }
            this.$content.textContent = text;
            if (!this.$dialog.open) {
                this.$dialog.showModal();
            }
        }

        close() {
            this.$dialog.classList.add('closing');
            if (this.closeTimeout) clearTimeout(this.closeTimeout);
            this.closeTimeout = setTimeout(() => {
                this.$dialog.close();
                this.$dialog.classList.remove('closing');
                this.closeTimeout = null;
            }, 300);
        }
    }

    new ClipboardDialog();

    // --- Terminal (lazy-loaded; desktop + index page only) ---
    // Terminal code is ~900 lines of scenarios/easter-eggs/Terminal class that
    // mobile users and resume/404 visitors never touch. Dynamic import tells
    // Rolldown to split it into its own chunk.
    const terminalToggleTile = document.getElementById('terminal-toggle-tile');
    const terminalTile = document.querySelector('.terminal-tile');

    if (isMobile) {
        // Remove the terminal tiles from the DOM on mobile — grid layout cleanup.
        if (terminalToggleTile) terminalToggleTile.remove();
        if (terminalTile) terminalTile.remove();
    } else if (terminalToggleTile && terminalTile) {
        // Only the index page has these tiles, so resume/404 never load the chunk.
        import('./terminal.js').then(({ initTerminal }) => initTerminal(SYS));
    }

})();
