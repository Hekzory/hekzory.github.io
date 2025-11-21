(function () {
    'use strict';

    const $ = document.querySelector.bind(document);

    // --- Clock Functionality ---
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        const clockEl = document.getElementById('clock');
        if (clockEl) {
            clockEl.textContent = timeString;
        }
    }

    updateClock();
    setInterval(updateClock, 1000);

    // --- Uptime Functionality ---
    function updateUptime() {
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

        const uptimeString = `${years}y ${months}m ${days}d`;
        const uptimeEl = document.getElementById('uptime-value');
        if (uptimeEl) {
            uptimeEl.textContent = uptimeString;
        }
    }

    updateUptime();
    setInterval(updateUptime, 60000);

    // --- Procedural Terminal ---
    class Terminal {
        constructor(elementId) {
            this.element = document.getElementById(elementId);
            this.fileSystem = {
                '~': {
                    type: 'dir',
                    children: {
                        'projects': {
                            type: 'dir',
                            children: {
                                'hekzory.github.io': { type: 'dir', children: {} },
                                'dotfiles': { type: 'dir', children: {} },
                                'nvim-config': { type: 'dir', children: {} },
                                'todo.md': { type: 'file', content: '- Fix bugs\n- Deploy to prod\n- Sleep' }
                            }
                        },
                        'downloads': {
                            type: 'dir',
                            children: {
                                'arch-linux.iso': { type: 'file', content: '[BINARY DATA]' },
                                'resume.pdf': { type: 'file', content: '[PDF CONTENT]' }
                            }
                        },
                        '.config': {
                            type: 'dir',
                            children: {
                                'hypr': {
                                    type: 'dir',
                                    children: {
                                        'hyprland.conf': { type: 'file', content: 'monitor=,preferred,auto,1\nexec-once = waybar' }
                                    }
                                },
                                'fish': {
                                    type: 'dir',
                                    children: {
                                        'config.fish': { type: 'file', content: 'set -gx EDITOR nvim\nalias ll="ls -la"\nstarship init fish | source' }
                                    }
                                },
                                'nvim': { type: 'dir', children: {} }
                            }
                        },
                        '.zshrc': { type: 'file', content: 'export EDITOR=nvim\nalias ll="ls -la"' },
                        'README.md': { type: 'file', content: '# Hekzory\nWelcome to my system.' }
                    }
                }
            };
            this.currentPath = ['~'];
            this.history = [];
            this.isTyping = false;
            this.maxLines = 15; // Keep DOM light
        }

        async start() {
            if (!this.element) return;

            // Randomly decide how many commands to run (3 to 5)
            const commandLimit = Math.floor(Math.random() * 3) + 3;

            for (let i = 0; i < commandLimit; i++) {
                await this.performAction();
                await this.wait(1000 + Math.random() * 2000);
            }

            // Final prompt
            this.printPrompt();
        }

        async performAction() {
            const action = this.decideNextAction();
            await this.typeCommand(action.cmd);
            this.addOutput(action.output);
            if (action.effect) action.effect();
            this.scrollToBottom();
        }

        decideNextAction() {
            const cwd = this.resolvePath(this.currentPath);
            const choices = ['ls', 'whoami', 'date'];

            // Contextual choices
            const subdirs = Object.entries(cwd.children).filter(([_, node]) => node.type === 'dir');
            const files = Object.entries(cwd.children).filter(([_, node]) => node.type === 'file');

            if (subdirs.length > 0) choices.push('cd_down');
            if (this.currentPath.length > 1) choices.push('cd_up');
            if (files.length > 0) choices.push('cat');

            // Randomly pick
            const choice = choices[Math.floor(Math.random() * choices.length)];

            switch (choice) {
                case 'ls':
                    return {
                        cmd: 'ls -la',
                        output: this.formatLs(cwd.children)
                    };
                case 'whoami':
                    return { cmd: 'whoami', output: 'oleg' };
                case 'date':
                    return { cmd: 'date', output: new Date().toString() };
                case 'cd_down':
                    const [dirName] = subdirs[Math.floor(Math.random() * subdirs.length)];
                    return {
                        cmd: `cd ${dirName}`,
                        output: '',
                        effect: () => this.currentPath.push(dirName)
                    };
                case 'cd_up':
                    return {
                        cmd: 'cd ..',
                        output: '',
                        effect: () => this.currentPath.pop()
                    };
                case 'cat':
                    const [fileName, node] = files[Math.floor(Math.random() * files.length)];
                    return {
                        cmd: `cat ${fileName}`,
                        output: node.content
                    };
                default:
                    return { cmd: 'echo "Hello"', output: 'Hello' };
            }
        }

        resolvePath(pathArray) {
            let current = this.fileSystem['~'];
            for (let i = 1; i < pathArray.length; i++) {
                current = current.children[pathArray[i]];
            }
            return current;
        }

        formatLs(children) {
            let output = 'total 42\n';
            output += 'drwxr-xr-x  . \n';
            output += 'drwxr-xr-x  .. \n';
            for (const [name, node] of Object.entries(children)) {
                const perm = node.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
                output += `${perm}  ${name}\n`;
            }
            return output.trim();
        }

        async typeCommand(text) {
            const line = document.createElement('div');
            line.className = 'line';

            // Fish prompt style: user@host path ❯
            const pathStr = this.currentPath.join('/').replace('~', '~');
            line.innerHTML = `<span class="prompt" style="color: var(--primary)">oleg@hekzory</span> <span class="path" style="color: var(--secondary)">${pathStr}</span> <span class="prompt-char" style="color: var(--success)">❯</span> <span class="cmd"></span><span class="cursor">_</span>`;

            this.element.appendChild(line);
            this.scrollToBottom();

            const cmdSpan = line.querySelector('.cmd');

            for (const char of text) {
                await this.wait(50 + Math.random() * 50);
                cmdSpan.textContent += char;
            }

            await this.wait(200);
            line.querySelector('.cursor').remove();
        }

        printPrompt() {
            const line = document.createElement('div');
            line.className = 'line';
            const pathStr = this.currentPath.join('/').replace('~', '~');
            line.innerHTML = `<span class="prompt" style="color: var(--primary)">oleg@hekzory</span> <span class="path" style="color: var(--secondary)">${pathStr}</span> <span class="prompt-char" style="color: var(--success)">❯</span> <span class="cmd"></span><span class="cursor">_</span>`;
            this.element.appendChild(line);
            this.scrollToBottom();
        }

        addOutput(text) {
            if (!text) return;
            const div = document.createElement('div');
            div.className = 'line output';
            div.innerText = text;
            this.element.appendChild(div);

            // Prune old lines
            while (this.element.children.length > this.maxLines) {
                this.element.removeChild(this.element.firstChild);
            }
        }

        scrollToBottom() {
            this.element.scrollTop = this.element.scrollHeight;
        }

        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    const term = new Terminal('terminal-output');
    term.start();

    // --- Clipboard Dialog ---
    class ClipboardDialog {
        constructor() {
            this.$dialog = $('#clipboard-dialog');
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

    // --- Terminal Toggle ---
    const terminalToggleTile = document.getElementById('terminal-toggle-tile');
    const terminalCloseBtn = document.getElementById('terminal-close');
    const terminalTile = document.querySelector('.terminal-tile');

    if (terminalToggleTile && terminalTile) {
        terminalToggleTile.addEventListener('click', () => {
            terminalTile.classList.add('terminal-open');
            terminalToggleTile.classList.add('hidden');
        });
    }

    if (terminalCloseBtn && terminalTile) {
        terminalCloseBtn.addEventListener('click', () => {
            terminalTile.classList.remove('terminal-open');
            if (terminalToggleTile) {
                terminalToggleTile.classList.remove('hidden');
            }
        });
    }

    // --- Random System Stats ---


})();
