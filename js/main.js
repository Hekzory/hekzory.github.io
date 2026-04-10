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

    // ============================================================================
    // TERMINAL SYSTEM
    // ============================================================================

    /**
     * Weighted random selection — shared by scenario & easter egg pickers.
     * Accepts an array of objects with a `weight` property.
     * Returns null for empty arrays.
     */
    const weightedRandom = (items) => {
        if (items.length === 0) return null;
        const total = items.reduce((s, i) => s + i.weight, 0);
        let r = Math.random() * total;
        for (const item of items) {
            r -= item.weight;
            if (r <= 0) return item;
        }
        return items[0];
    };

    /**
     * Virtual File System - Realistic Linux-like directory structure
     */
    const createFileSystem = () => ({
        '~': {
            type: 'dir',
            children: {
                'projects': {
                    type: 'dir',
                    children: {
                        'hekzory.github.io': {
                            type: 'dir',
                            children: {
                                'src': { type: 'dir', children: {} },
                                'package.json': { type: 'file', content: '{\n  "name": "hekzory.github.io",\n  "version": "1.0.0"\n}' },
                                'README.md': { type: 'file', content: '# Personal Website\n\nBuilt with Vite + vanilla JS\nStyled after Hyprland/Tokyo Night' }
                            }
                        },
                        'dotfiles': {
                            type: 'dir',
                            children: {
                                'hypr': { type: 'dir', children: {} },
                                'nvim': { type: 'dir', children: {} },
                                'fish': { type: 'dir', children: {} },
                                'install.sh': { type: 'file', content: '#!/bin/bash\n# Dotfiles installer\nstow -v -t ~ .' }
                            }
                        },
                        'docker-labs': {
                            type: 'dir',
                            children: {
                                'docker-compose.yml': { type: 'file', content: 'version: "3.8"\nservices:\n  web:\n    image: nginx:alpine\n    ports:\n      - "80:80"' },
                                'Dockerfile': { type: 'file', content: 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]' }
                            }
                        },
                        'py-scripts': {
                            type: 'dir',
                            children: {
                                'main.py': { type: 'file', content: '#!/usr/bin/env python3\n"""Quick automation script."""\nimport sys\nimport json\n\ndef main():\n    print("Running analysis...")\n    return 0\n\nif __name__ == "__main__":\n    sys.exit(main())' },
                                'requirements.txt': { type: 'file', content: 'requests>=2.31.0\npython-dotenv>=1.0.0\nrich>=13.0.0' },
                                'pyproject.toml': { type: 'file', content: '[project]\nname = "py-scripts"\nversion = "0.1.0"\nrequires-python = ">= 3.11"' }
                            }
                        }
                    }
                },
                'documents': {
                    type: 'dir',
                    children: {
                        'notes.md': { type: 'file', content: '# Notes\n\n- Check out Zig lang\n- Update resume\n- Learn more about WebGPU' },
                        'ideas.txt': { type: 'file', content: 'Terminal portfolio concept\nNeobrutal design system\nDocker containers' }
                    }
                },
                'downloads': {
                    type: 'dir',
                    children: {
                        'cachyos-desktop-2024.01.iso': { type: 'file', content: '[BINARY: 2.1GB]' },
                        'resume-2024.pdf': { type: 'file', content: '[PDF CONTENT]' }
                    }
                },
                '.config': {
                    type: 'dir',
                    children: {
                        'hypr': {
                            type: 'dir',
                            children: {
                                'hyprland.conf': { type: 'file', content: '# Hyprland config\nmonitor=,preferred,auto,1\n\nexec-once = waybar\nexec-once = dunst\n\ngeneral {\n    gaps_in = 4\n    gaps_out = 8\n    border_size = 2\n}' }
                            }
                        },
                        'fish': {
                            type: 'dir',
                            children: {
                                'config.fish': { type: 'file', content: 'set -gx EDITOR nvim\nset -gx VISUAL nvim\n\nalias ll="eza -la"\nalias cat="bat"\nalias vim="nvim"\n\noh-my-posh init fish --config ~/.config/ohmyposh/config.toml | source' }
                            }
                        },
                        'nvim': {
                            type: 'dir',
                            children: {
                                'init.lua': { type: 'file', content: '-- Neovim config\nvim.g.mapleader = " "\n\nrequire("lazy").setup({\n  "folke/tokyonight.nvim",\n  "nvim-treesitter/nvim-treesitter",\n})' },
                                'lua': { type: 'dir', children: {} }
                            }
                        },
                        'ohmyposh': {
                            type: 'dir',
                            children: {
                                'config.toml': { type: 'file', content: 'version = 3\nfinal_space = true\n\n[palette]\nterminal-blue = "#7aa2f7"\nterminal-magenta = "#bb9af7"\npistachio-green = "#9ece6a"\nterminal-yellow = "#e0af68"\n\n[[blocks]]\ntype = "prompt"\nalignment = "left"\nnewline = true' }
                            }
                        }
                    }
                },
                '.local': {
                    type: 'dir',
                    children: {
                        'bin': {
                            type: 'dir',
                            children: {
                                'backup.sh': { type: 'file', content: '#!/bin/bash\nrsync -av --progress ~/projects /mnt/backup/' }
                            }
                        }
                    }
                },
                'music': {
                    type: 'dir',
                    children: {
                        'lofi-beats': { type: 'dir', children: {} },
                        'synthwave': { type: 'dir', children: {} },
                        'playlist.m3u': { type: 'file', content: '#EXTM3U\nlofi-beats/chill_morning.mp3\nsynthwave/neon_nights.mp3' }
                    }
                },
                '.gitconfig': { type: 'file', content: '[user]\n    name = Oleg Tsvetkov\n    email = oleg@tsv.one\n\n[core]\n    editor = nvim' },
                'README.md': { type: 'file', content: '# ~\n\nWelcome to my home directory.\nNothing to see here, just the usual Linux chaos.' }
            }
        }
    });

    /**
     * Scenario definitions - Coherent command sequences
     */
    const SCENARIOS = {
        morning_coffee: {
            name: 'Morning Coffee',
            weight: 10,
            commands: (ctx) => [
                { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']) },
                { cmd: 'git status', output: 'On branch main\nYour branch is up to date with \'origin/main\'.\n\nnothing to commit, working tree clean' },
                { cmd: 'cat README.md' },
                { cmd: 'cd ~', effect: () => ctx.cd(['~']) }
            ]
        },

        dotfiles_tinkering: {
            name: 'Config Editing',
            weight: 15,
            commands: (ctx) => [
                { cmd: 'cd .config/nvim', effect: () => ctx.cd(['~', '.config', 'nvim']) },
                { cmd: 'ls -la' },
                { cmd: 'cat init.lua' },
                { cmd: 'cd ../ohmyposh', effect: () => ctx.cd(['~', '.config', 'ohmyposh']) },
                { cmd: 'cat config.toml' }
            ]
        },

        shell_setup: {
            name: 'Shell Setup',
            weight: 10,
            commands: (ctx) => [
                { cmd: 'cd .config/fish', effect: () => ctx.cd(['~', '.config', 'fish']) },
                { cmd: 'cat config.fish' },
                { cmd: 'cd ~', effect: () => ctx.cd(['~']) },
                { cmd: 'which nvim', output: '/usr/bin/nvim' }
            ]
        },

        hyprland_config: {
            name: 'Hyprland Setup',
            weight: 12,
            commands: (ctx) => [
                { cmd: 'cd .config/hypr', effect: () => ctx.cd(['~', '.config', 'hypr']) },
                { cmd: 'cat hyprland.conf' },
                { cmd: 'hyprctl monitors', output: 'Monitor DP-1 (ID 0):\n\t2560x1440@144 at 0x0\n\tactive workspace: 1\n\treserved: 0 36 0 0\n\tscale: 1.00' }
            ]
        },

        project_browse: {
            name: 'Project Browse',
            weight: 15,
            commands: (ctx) => [
                { cmd: 'cd projects', effect: () => ctx.cd(['~', 'projects']) },
                { cmd: 'ls -la' },
                { cmd: 'cd dotfiles', effect: () => ctx.cd(['~', 'projects', 'dotfiles']) },
                { cmd: 'cat install.sh' }
            ]
        },

        system_check: {
            name: 'System Check',
            weight: 8,
            commands: (ctx) => [
                { cmd: 'uname -a', output: `Linux ${SYS.host} ${SYS.kernel} #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` },
                {
                    cmd: 'uptime', output: () => {
                        const h = Math.floor(Math.random() * 72) + 1;
                        const m = Math.floor(Math.random() * 60);
                        return ` 15:42:01 up ${h}:${String(m).padStart(2, '0')},  1 user,  load average: 0.42, 0.38, 0.35`;
                    }
                },
                { cmd: 'free -h', output: '              total        used        free      shared  buff/cache   available\nMem:           31Gi       8.2Gi        14Gi       892Mi       8.6Gi        21Gi\nSwap:         8.0Gi          0B       8.0Gi' }
            ]
        },

        git_workflow: {
            name: 'Git Workflow',
            weight: 12,
            commands: (ctx) => [
                { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'main' },
                {
                    cmd: 'git log --oneline -3', output: () => {
                        const msgs = ['fix: typo in readme', 'feat: add terminal animation', 'chore: update deps'];
                        const hashes = ['a3f2c1d', 'b8e4f2a', 'c9d1e3b'];
                        return msgs.map((m, i) => `${hashes[i]} ${m}`).join('\n');
                    }
                },
                { cmd: 'git branch', output: '* main\n  dev\n  feature/terminal-rework' }
            ]
        },

        // Docker operations
        docker_ops: {
            name: 'Docker Ops',
            weight: 8,
            commands: (ctx) => [
                { cmd: 'cd projects/docker-labs', effect: () => ctx.cd(['~', 'projects', 'docker-labs']) },
                { cmd: 'cat Dockerfile' },
                { cmd: 'docker build -t my-app .', output: 'Sending build context to Docker daemon  3.072kB\nStep 1/4 : FROM node:20-alpine\n ---> 4e4c4c75d6e2\nStep 2/4 : WORKDIR /app\n ---> Using cache\n ---> 9b1f2e3a4d5c\nSuccessfully built 9b1f2e3a4d5c\nSuccessfully tagged my-app:latest' },
                { cmd: 'docker images', output: 'REPOSITORY   TAG       IMAGE ID       CREATED        SIZE\nmy-app       latest    9b1f2e3a4d5c   2 seconds ago  180MB\nnginx        alpine    total          2 weeks ago    43MB' }
            ]
        },

        notes_review: {
            name: 'Notes Review',
            weight: 10,
            commands: (ctx) => [
                { cmd: 'cd documents', effect: () => ctx.cd(['~', 'documents']) },
                { cmd: 'ls' },
                { cmd: 'cat notes.md' },
                { cmd: 'cat ideas.txt' }
            ]
        },

        music_vibes: {
            name: 'Music Vibes',
            weight: 5,
            commands: (ctx) => [
                { cmd: 'cd music', effect: () => ctx.cd(['~', 'music']) },
                { cmd: 'ls' },
                { cmd: 'cat playlist.m3u' },
                { cmd: 'cd ~', effect: () => ctx.cd(['~']) }
            ]
        },

        identity_check: {
            name: 'Identity Check',
            weight: 6,
            commands: (ctx) => [
                { cmd: 'whoami', output: SYS.user },
                { cmd: 'hostname', output: SYS.host },
                { cmd: 'pwd', output: () => ctx.cwdString() },
                {
                    cmd: 'date', output: () => new Date().toLocaleString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        hour12: false
                    }) + ' MSK 2026'
                }
            ]
        },

        git_config: {
            name: 'Git Config',
            weight: 6,
            commands: (ctx) => [
                { cmd: 'cat ~/.gitconfig' },
                { cmd: 'git config --global user.name', output: 'Oleg Tsvetkov' },
                { cmd: 'git config --global user.email', output: 'oleg@tsv.one' }
            ]
        },

        python_dev: {
            name: 'Python Dev',
            weight: 10,
            commands: (ctx) => [
                { cmd: 'cd projects/py-scripts', effect: () => ctx.cd(['~', 'projects', 'py-scripts']) },
                { cmd: 'cat pyproject.toml' },
                { cmd: 'python --version', output: 'Python 3.12.4' },
                { cmd: 'pip list | head -5', output: 'Package         Version\n--------------  --------\npip             24.0\nrequests        2.31.0\nrich            13.7.0' },
                { cmd: 'cat main.py' }
            ]
        }
    };

    /**
     * Easter Eggs - Context-aware special scenarios
     */
    const EASTER_EGGS = {
        // Late night (after midnight, before 6am)
        late_night: {
            condition: () => {
                const hour = new Date().getHours();
                return hour >= 0 && hour < 6;
            },
            weight: 25,
            commands: (ctx) => [
                {
                    cmd: 'date', output: () => {
                        const d = new Date();
                        return d.toLocaleString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: false
                        }) + ' # still awake?';
                    }
                },
                { cmd: 'cat ~/.config/nvim/init.lua | head -5' },
                { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'main *' },
                { cmd: 'git diff --stat HEAD~1', output: ' js/main.js | 42 +++++++++++++++++++++++---\n 1 file changed, 38 insertions(+), 4 deletions(-)' }
            ]
        },

        // Return visitor (has been here before)
        return_visitor: {
            condition: () => {
                const visits = parseInt(localStorage.getItem('terminal_visits') || '0', 10);
                return visits > 2;
            },
            weight: 10,
            commands: (ctx) => [
                { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'main' },
                { cmd: 'git log --oneline -3', output: 'a3f2c1d feat: you know the way around\nb8e4f2a fix: terminal polish\nc9d1e3b chore: deps update' },
                { cmd: 'git status', output: 'On branch main\nYour branch is up to date.\n\nnothing to commit, working tree clean' }
            ]
        },

        // Birthday (September 11)
        birthday: {
            condition: () => {
                const d = new Date();
                return d.getMonth() === 8 && d.getDate() === 11;
            },
            weight: 100,
            commands: (ctx) => [
                {
                    cmd: 'cal', output: () => {
                        const y = new Date().getFullYear();
                        return `   September ${y}\nSu Mo Tu We Th Fr Sa\n       1  2  3  4  5\n 6  7  8  9 10 [11] 12\n13 14 15 16 17 18 19\n20 21 22 23 24 25 26\n27 28 29 30`;
                    }
                },
                {
                    cmd: 'cowsay "Happy Birthday!"', output: () => {
                        const age = new Date().getFullYear() - 2003;
                        return ` ${'_'.repeat(20)}\n< Happy Birthday!    >\n< Level ${age} unlocked. >\n ${'\u203e'.repeat(20)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;
                    }
                }
            ]
        },

        // Weekend chill
        weekend: {
            condition: () => {
                const day = new Date().getDay();
                return day === 0 || day === 6;
            },
            weight: 10,
            commands: (ctx) => [
                { cmd: 'cd music', effect: () => ctx.cd(['~', 'music']) },
                { cmd: 'ls' },
                { cmd: 'mpv --shuffle lofi-beats/', output: 'Playing: chill_morning.mp3\n (+) Audio --aid=1 (aac 2ch 44100Hz)\nAV: 00:00:42 / 00:03:21 (21%)' }
            ]
        },

        // Early bird (6am-9am)
        early_bird: {
            condition: () => {
                const hour = new Date().getHours();
                return hour >= 6 && hour < 9;
            },
            weight: 12,
            commands: (ctx) => [
                {
                    cmd: 'fastfetch --logo-type small', output: `  ╭─╮   ${SYS.user}@${SYS.host}
 ╭╯ ╰╮  OS: ${SYS.os}
 ╰─╮ │  Kernel: ${SYS.kernel}
   ╰─╯  Uptime: 4 hours, 32 mins` },
                { cmd: 'cd projects', effect: () => ctx.cd(['~', 'projects']) },
                { cmd: 'ls', output: 'docker-labs  dotfiles  hekzory.github.io  py-scripts' }
            ]
        },

        // Lunch break (12-14)
        lunch_break: {
            condition: () => {
                const hour = new Date().getHours();
                return hour >= 12 && hour < 14;
            },
            weight: 8,
            commands: (ctx) => [
                { cmd: 'cd music', effect: () => ctx.cd(['~', 'music']) },
                { cmd: 'cat playlist.m3u' },
                { cmd: 'mpv lofi-beats/chill_morning.mp3', output: 'Playing: chill_morning.mp3\n (+) Audio --aid=1 (aac 2ch 44100Hz)\nAV: 00:01:23 / 00:03:21 (41%)' }
            ]
        },

        // Evening coding (18-22)
        evening_session: {
            condition: () => {
                const hour = new Date().getHours();
                return hour >= 18 && hour < 22;
            },
            weight: 10,
            commands: (ctx) => [
                { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'dev *' },
                { cmd: 'git status', output: 'On branch dev\nChanges not staged for commit:\n  modified:   js/main.js\n\nno changes added to commit' },
                { cmd: 'git diff --stat', output: ' js/main.js | 15 +++++++++------\n 1 file changed, 9 insertions(+), 6 deletions(-)' }
            ]
        },

        // Monday blues
        monday: {
            condition: () => new Date().getDay() === 1,
            weight: 8,
            commands: (ctx) => [
                { cmd: 'date +%A', output: 'Monday' },
                { cmd: 'cat ~/documents/notes.md' },
                { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'main' },
                { cmd: 'git pull', output: 'Already up to date.' }
            ]
        },

        // Friday vibes
        friday: {
            condition: () => new Date().getDay() === 5,
            weight: 10,
            commands: (ctx) => [
                { cmd: 'date +%A', output: 'Friday' },
                { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'main' },
                { cmd: 'git log --oneline -1', output: 'a3f2c1d feat: wrapped up the week' },
                { cmd: 'git push', output: 'Everything up-to-date' }
            ]
        },

        // New Year
        new_year: {
            condition: () => {
                const d = new Date();
                return d.getMonth() === 0 && d.getDate() <= 7;
            },
            weight: 80,
            commands: (ctx) => [
                {
                    cmd: 'cal', output: () => {
                        const year = new Date().getFullYear();
                        return `    January ${year}\nSu Mo Tu We Th Fr Sa\n          1  2  3  4\n 5  6  7  8  9 10 11\n12 13 14 15 16 17 18\n19 20 21 22 23 24 25\n26 27 28 29 30 31`;
                    }
                },
                { cmd: 'uptime', output: () => `up ${Math.floor(Math.random() * 7) + 1} days` }
            ]
        },

        // Frequent visitor — dynamic visit count
        power_user: {
            condition: () => {
                const visits = parseInt(localStorage.getItem('terminal_visits') || '0', 10);
                return visits > 10;
            },
            weight: 10,
            commands: (ctx) => {
                const visits = parseInt(localStorage.getItem('terminal_visits') || '0', 10);
                return [
                    { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'main' },
                    { cmd: 'git shortlog -sn --all | head -4', output: `   142  Oleg Tsvetkov\n    ${visits}  You (frequent visitor)\n     3  dependabot[bot]\n     1  GitHub Actions` },
                    { cmd: 'wc -l js/main.js', output: '1199 js/main.js' },
                    { cmd: 'du -sh .', output: '4.2M    .' }
                ];
            }
        },

        // Deep dive into config
        config_deep_dive: {
            condition: () => Math.random() < 0.15,
            weight: 5,
            commands: (ctx) => [
                { cmd: 'cd .config', effect: () => ctx.cd(['~', '.config']) },
                { cmd: 'ls', output: 'fish  hypr  nvim  ohmyposh' },
                { cmd: 'wc -l */*', output: '   8 fish/config.fish\n  11 hypr/hyprland.conf\n   7 nvim/init.lua\n  12 ohmyposh/config.toml\n  38 total' }
            ]
        },

        // Code review
        code_review: {
            condition: () => Math.random() < 0.12,
            weight: 6,
            commands: (ctx) => [
                { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'feature/terminal-rework' },
                { cmd: 'git log --oneline main..HEAD', output: 'f8a3c2b feat: scenario engine\nd2e1b4a refactor: clean up prompts\n9c7d5e1 fix: mobile touch events' },
                { cmd: 'git diff --stat main', output: ' js/main.js  | 847 +++++++++++++++++++++++++++++++++++++++++++++++++++++++----\n css/style.css |  45 +++--\n 2 files changed, 824 insertions(+), 68 deletions(-)' }
            ]
        },

        // Timezone traveler — visitor not in Moscow (UTC+3)
        timezone_traveler: {
            condition: () => {
                const offset = new Date().getTimezoneOffset(); // minutes, negative = east
                return offset !== -180; // UTC+3 = -180 minutes
            },
            weight: 12,
            commands: (ctx) => {
                const offsetMin = new Date().getTimezoneOffset();
                const sign = offsetMin <= 0 ? '+' : '-';
                const absH = Math.floor(Math.abs(offsetMin) / 60);
                const absM = Math.abs(offsetMin) % 60;
                const tz = `UTC${sign}${absH}${absM ? ':' + String(absM).padStart(2, '0') : ''}`;
                const mskDiff = (-180 - (-offsetMin)) / 60; // hours difference from MSK
                const diffStr = mskDiff > 0 ? `+${mskDiff}h` : `${mskDiff}h`;
                return [
                    {
                        cmd: 'timedatectl', output: `               Local time: ${new Date().toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}\n           Universal time: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC\n                 RTC time: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}\n                Time zone: ${tz} (${tz}, ${diffStr} from MSK)\nSystem clock synchronized: yes\n              NTP service: active\n          RTC in local TZ: no`
                    },
                    { cmd: 'echo $TZ', output: tz },
                    {
                        cmd: 'date -d "TZ=Europe/Moscow"', output: () => {
                            const msk = new Date(Date.now() + (offsetMin + 180) * 60000);
                            return `Moscow: ${msk.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} MSK`;
                        }
                    }
                ];
            }
        },

        // Slow connection
        slow_connection: {
            condition: () => {
                const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                return conn && typeof conn.downlink === 'number' && conn.downlink < 1.5;
            },
            weight: 20,
            commands: (ctx) => {
                const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                const dl = conn ? conn.downlink : 0.8;
                const rtt = conn ? (conn.rtt || 300) : 300;
                return [
                    { cmd: 'speedtest-cli --simple', output: `Ping: ${rtt} ms\nDownload: ${(dl * 0.9).toFixed(2)} Mbit/s\nUpload: ${(dl * 0.3).toFixed(2)} Mbit/s` },
                    { cmd: 'ping -c 3 1.1.1.1', output: `PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.\n64 bytes: icmp_seq=1 ttl=57 time=${rtt}ms\n64 bytes: icmp_seq=2 ttl=57 time=${Math.round(rtt * 0.9)}ms\n64 bytes: icmp_seq=3 ttl=57 time=${Math.round(rtt * 1.1)}ms\n\n--- 1.1.1.1 ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss` },
                    { cmd: 'echo "patience is a virtue"', output: 'patience is a virtue' }
                ];
            }
        },

        // Battery saver — device battery ≤ 20%
        battery_saver: {
            condition: () => {
                // Checked async in trackBattery(); result cached
                return Terminal._batteryLow === true;
            },
            weight: 25,
            commands: (ctx) => {
                const lvl = Terminal._batteryLevel ?? 15;
                const charging = Terminal._batteryCharging ? 'charging' : 'discharging';
                return [
                    {
                        cmd: 'upower -i /org/freedesktop/UPower/devices/battery_BAT0', output: `  native-path:          BAT0\n  model:                LGC-LGC4.5\n  energy-full:          48.8 Wh\n  energy-rate:          12.4 W\n  percentage:           ${Math.round(lvl * 100)}%\n  state:                ${charging}\n  time to empty:        ${Math.round(lvl * 100 * 2.4)} minutes`
                    },
                    { cmd: 'cat /sys/class/power_supply/BAT0/status', output: charging.charAt(0).toUpperCase() + charging.slice(1) },
                    { cmd: 'echo "conserve power — closing unnecessary services"', output: 'conserve power — closing unnecessary services' }
                ];
            }
        },

        // Git anniversary — project milestone dates
        git_anniversary: {
            condition: () => {
                const now = new Date();
                const md = `${now.getMonth() + 1}-${now.getDate()}`;
                // Milestone dates: first commit, v1 launch, major rewrite
                return ['12-6', '1-1', '9-11'].includes(md);
            },
            weight: 40,
            commands: (ctx) => {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return [
                    { cmd: 'cd projects/hekzory.github.io', effect: () => ctx.cd(['~', 'projects', 'hekzory.github.io']), gitBranch: 'main' },
                    { cmd: `git log --oneline --after="${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}" --before="${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate() + 1).padStart(2, '0')}"`, output: `f4a2e1c feat: milestone commit on ${dateStr}\nb3c7d8e refactor: project anniversary edition\n8a1f9c2 docs: one year since the rewrite` },
                    { cmd: 'git log --format="%H" | wc -l', output: '142' },
                    { cmd: `echo "${dateStr} — still shipping"`, output: `${dateStr} — still shipping` }
                ];
            }
        }
    };

    /**
     * Terminal Class - Animation-only, no interactivity
     */
    class Terminal {
        /** @type {boolean|undefined} */
        static _batteryLow;
        /** @type {number|undefined} */
        static _batteryLevel;
        /** @type {boolean|undefined} */
        static _batteryCharging;
        static {
            // One-shot async battery probe — result cached on class
            if (navigator.getBattery) {
                navigator.getBattery().then(b => {
                    Terminal._batteryLevel = b.level;
                    Terminal._batteryCharging = b.charging;
                    Terminal._batteryLow = b.level <= 0.2 && !b.charging;
                }).catch(() => { Terminal._batteryLow = false; });
            } else {
                Terminal._batteryLow = false;
            }
        }

        constructor(elementId) {
            this.element = document.getElementById(elementId);
            this.fs = createFileSystem();
            this.currentPath = ['~'];
            this.currentGitBranch = null;
            this.state = 'idle';
            this.isTyping = false;
            this.maxLines = 50;
            this.abortController = null;

            this.trackVisit();
        }

        trackVisit() {
            const visits = parseInt(localStorage.getItem('terminal_visits') || '0', 10);
            localStorage.setItem('terminal_visits', String(visits + 1));
            localStorage.setItem('terminal_last_visit', new Date().toISOString());
        }

        /**
         * Start the terminal animation
         */
        async start() {
            if (!this.element) return;

            this.state = 'playing';
            this.abortController = new AbortController();

            try {
                const easterEgg = this.selectEasterEgg();
                if (easterEgg) {
                    await this.playScenario(easterEgg, this.abortController.signal);
                } else {
                    const scenarioCount = Math.floor(Math.random() * 2) + 2;
                    const usedScenarios = new Set();

                    for (let i = 0; i < scenarioCount; i++) {
                        if (this.abortController.signal.aborted) break;

                        const scenario = this.selectScenario(usedScenarios);
                        if (scenario) {
                            usedScenarios.add(scenario.name);
                            await this.playScenario(scenario, this.abortController.signal);

                            if (i < scenarioCount - 1) {
                                await this.wait(800 + Math.random() * 400);
                            }
                        }
                    }
                }

                this.currentPath = ['~'];
                this.currentGitBranch = null;
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error('Terminal error:', e);
                }
            }

            if (!this.abortController.signal.aborted) {
                this.printPrompt();
                this.state = 'idle';
            }
        }

        selectEasterEgg() {
            const eligible = Object.entries(EASTER_EGGS)
                .filter(([_, egg]) => egg.condition())
                .map(([name, egg]) => ({ name, ...egg }));
            return weightedRandom(eligible);
        }

        selectScenario(exclude = new Set()) {
            const available = Object.entries(SCENARIOS)
                .filter(([name]) => !exclude.has(name))
                .map(([name, scenario]) => ({ name, ...scenario }));
            return weightedRandom(available);
        }

        async playScenario(scenario, signal) {
            const ctx = this.createContext();
            const commands = scenario.commands(ctx);

            for (const cmd of commands) {
                if (signal.aborted) return;

                // Update git branch if specified
                if (cmd.gitBranch !== undefined) {
                    this.currentGitBranch = cmd.gitBranch;
                }

                await this.typeCommand(cmd.cmd, signal);

                if (signal.aborted) return;

                let output = cmd.output;
                if (typeof output === 'function') {
                    output = output();
                } else if (output === undefined) {
                    output = this.resolveCommand(cmd.cmd);
                }

                if (output) {
                    this.addOutput(output);
                }

                if (cmd.effect) {
                    cmd.effect();
                }

                this.scrollToBottom();
                await this.wait(600 + Math.random() * 800);
            }
        }

        createContext() {
            return {
                cd: (path) => { this.currentPath = path; },
                cwdString: () => this.currentPath.join('/').replace(/^~/, '~'),
                clear: () => { this.element.innerHTML = ''; }
            };
        }

        resolveCommand(cmdString) {
            const parts = cmdString.split(' ');
            const cmd = parts[0];
            const args = parts.slice(1);

            switch (cmd) {
                case 'ls':
                case 'ls -la':
                    return this.formatLs(this.resolvePath(this.currentPath).children);
                case 'cat':
                    if (args[0]) {
                        const target = args[0].replace('~/', '');
                        const targetPath = target.startsWith('~')
                            ? target.split('/')
                            : [...this.currentPath, ...target.split('/')];
                        const node = this.resolvePathSafe(targetPath);
                        if (node && node.type === 'file') {
                            return node.content;
                        }
                    }
                    return '';
                case 'pwd':
                    return this.currentPath.join('/').replace(/^~/, '/home/oleg');
                default:
                    return '';
            }
        }

        resolvePath(pathArray) {
            let current = this.fs['~'];
            for (let i = 1; i < pathArray.length; i++) {
                if (current.children && current.children[pathArray[i]]) {
                    current = current.children[pathArray[i]];
                } else {
                    return current;
                }
            }
            return current;
        }

        resolvePathSafe(pathArray) {
            try {
                return this.resolvePath(pathArray);
            } catch {
                return null;
            }
        }

        formatLs(children) {
            if (!children) return '';

            let output = 'total ' + Object.keys(children).length + '\n';
            output += 'drwxr-xr-x  .\n';
            output += 'drwxr-xr-x  ..\n';

            const entries = Object.entries(children).sort(([a], [b]) => {
                const aDot = a.startsWith('.');
                const bDot = b.startsWith('.');
                if (aDot && !bDot) return -1;
                if (!aDot && bDot) return 1;
                return a.localeCompare(b);
            });

            for (const [name, node] of entries) {
                const perm = node.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
                output += `${perm}  ${name}\n`;
            }

            return output.trim();
        }

        /**
         * Generate oh-my-posh style prompt HTML
         * Line 1: user@host [time] path | git_info
         * Line 2: ❯
         */
        generatePromptHTML(showCursor = false, showInput = false) {
            const pathStr = this.currentPath.join('/');
            const time = new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            // Git branch display
            let gitPart = '';
            if (this.currentGitBranch) {
                gitPart = `<span class="git-branch text-accent">on ${this.currentGitBranch}</span>`;
            }

            // Line 1: user@host [time] path | git
            let line1 = `<span class="posh-user text-warning font-bold">${SYS.user}@${SYS.host}</span> `;
            line1 += `<span class="posh-time text-primary font-bold">[${time}]</span>`;
            line1 += `<span class="posh-path text-secondary font-bold"> ${pathStr} </span>`;
            if (gitPart) {
                line1 += `| ${gitPart}`;
            }

            // Line 2: prompt char (❯)
            let line2 = `<span class="posh-prompt text-success">❯</span>`;

            if (showInput) {
                line2 += ` <span class="cmd"></span>`;
            }

            if (showCursor) {
                line2 += `<span class="cursor">▋</span>`;
            }

            return `<div class="posh-line1">${line1}</div><div class="posh-line2">${line2}</div>`;
        }

        /**
         * Type a command with animation
         */
        async typeCommand(text, signal) {
            this.isTyping = true;

            const line = document.createElement('div');
            line.className = 'line posh-prompt-block';
            line.innerHTML = this.generatePromptHTML(true, true);

            this.element.appendChild(line);
            this.scrollToBottom();
            this.pruneLines();

            const cmdSpan = line.querySelector('.cmd');
            let currentText = '';

            // Use textContent during typing — avoids HTML parse/serialize per keystroke
            for (let i = 0; i < text.length; i++) {
                if (signal && signal.aborted) {
                    this.isTyping = false;
                    return;
                }

                let delay = 35 + Math.random() * 45;
                if (text[i - 1] === ' ') delay += 40;
                if (text[i - 1] === text[i]) delay -= 15;

                // Occasional typo
                if (Math.random() < 0.02 && i > 0 && i < text.length - 1) {
                    const typoChar = this.randomChar();
                    cmdSpan.textContent = currentText + typoChar;
                    await this.wait(60);
                    cmdSpan.textContent = currentText;
                    await this.wait(80);
                }

                await this.wait(delay);
                currentText += text[i];
                cmdSpan.textContent = currentText;
            }

            // Apply syntax highlighting once at the end
            cmdSpan.innerHTML = this.highlightCommand(currentText);
            await this.wait(150);

            const cursor = line.querySelector('.cursor');
            if (cursor) cursor.remove();

            this.isTyping = false;
        }

        randomChar() {
            const chars = 'abcdefghijklmnopqrstuvwxyz';
            return chars[Math.floor(Math.random() * chars.length)];
        }

        /**
         * Highlight command input (smart syntax highlighting)
         */
        highlightCommand(text) {
            if (!text) return '';

            // Basic tokenizer
            // Command (first word): Green
            // Flags (-v, --help): Yellow
            // Strings ("...", '...'): Cyan
            // Operators (|, &&, >, <): Red
            // Rest: Foreground color

            const parts = text.split(/(\s+|\||&&|;|"|')/);
            let html = '';
            let isCommand = true;
            let inString = null; // " or '

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!part) continue;

                // Handle strings
                if (inString) {
                    html += `<span class="text-accent">${part}</span>`;
                    if (part === inString) inString = null;
                    continue;
                }
                if (part === '"' || part === "'") {
                    inString = part;
                    html += `<span class="text-accent">${part}</span>`;
                    continue;
                }

                // Whitespace
                if (/^\s+$/.test(part)) {
                    html += part;
                    continue;
                }

                // Operators
                if (/^(\|\|?|&&|;|>[>]?|<)$/.test(part)) {
                    html += `<span class="text-error">${part}</span>`;
                    isCommand = true; // Next word is a command
                    continue;
                }

                // Command (first non-whitespace, non-operator word)
                if (isCommand) {
                    html += `<span class="text-success font-bold">${part}</span>`;
                    isCommand = false;
                } else {
                    // Flags
                    if (part.startsWith('-')) {
                        html += `<span class="text-warning">${part}</span>`;
                    } else {
                        // Arguments
                        html += `<span class="text-fg">${part}</span>`;
                    }
                }
            }

            return html;
        }

        /**
         * Print final prompt
         */
        printPrompt() {
            const line = document.createElement('div');
            line.className = 'line posh-prompt-block';
            line.innerHTML = this.generatePromptHTML(true, false);
            this.element.appendChild(line);
            this.scrollToBottom();
        }

        addOutput(text) {
            if (!text) return;

            const lines = text.split('\n');
            const frag = document.createDocumentFragment();
            for (const lineText of lines) {
                const div = document.createElement('div');
                div.className = 'line output';
                div.innerHTML = this.highlightSyntax(lineText);
                frag.appendChild(div);
            }
            this.element.appendChild(frag);

            this.pruneLines();
        }

        /**
         * Apply syntax highlighting to output text
         */
        highlightSyntax(text) {
            // Escape HTML first
            let html = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Git branch/commit hashes (7 char hex)
            html = html.replace(/\b([a-f0-9]{7})\b/g, '<span class="text-warning">$1</span>');

            // File paths (containing /)
            html = html.replace(/([\w.-]+\/[\w./-]+)/g, '<span class="text-secondary">$1</span>');

            // Filenames with extensions
            html = html.replace(/\b([\w-]+\.(js|ts|py|rs|toml|json|md|txt|lua|fish|conf|sh|css|html|iso|pdf|mp3|m3u))\b/g, '<span class="text-accent">$1</span>');

            // Numbers with units
            html = html.replace(/\b(\d+\.?\d*)(Gi|Mi|Ki|MB|GB|KB|ms|s|m|h|d|%)\b/g, '<span class="text-warning">$1$2</span>');

            // Pure numbers
            html = html.replace(/\b(\d+)\b/g, '<span class="text-warning">$1</span>');

            // Git keywords
            html = html.replace(/\b(main|master|dev|HEAD|origin|branch|commit|modified|deleted|added|Checking|Finished|Playing|total)\b/g, '<span class="text-success">$1</span>');

            // Successful messages
            html = html.replace(/(up to date|clean|Everything up-to-date|Already up to date)/g, '<span class="text-success">$1</span>');

            // Diff additions/deletions
            html = html.replace(/(\+{2,})/g, '<span class="text-success">$1</span>');
            html = html.replace(/(-{2,})/g, '<span class="text-error">$1</span>');

            // Permissions (drwxr-xr-x etc)
            html = html.replace(/([d-][rwx-]{9})/g, '<span class="text-dim">$1</span>');

            // Directory markers (. and ..)
            html = html.replace(/^(\s*[d-][rwx-]{9}\s+)(\.\.?)$/gm, '$1<span class="text-dim">$2</span>');

            // Email addresses
            html = html.replace(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, '<span class="text-accent">$1</span>');

            // Comments (# ...)
            html = html.replace(/(#.*)$/gm, '<span class="text-dim">$1</span>');

            return html;
        }

        pruneLines() {
            while (this.element.children.length > this.maxLines) {
                this.element.removeChild(this.element.firstChild);
            }
        }

        scrollToBottom() {
            this.element.scrollTop = this.element.scrollHeight;
        }

        wait(ms) {
            return new Promise((resolve, reject) => {
                const ac = this.abortController;
                const onDone = () => {
                    if (ac) ac.signal.removeEventListener('abort', onAbort);
                    resolve();
                };
                const onAbort = () => {
                    clearTimeout(timeout);
                    reject(new DOMException('Aborted', 'AbortError'));
                };
                const timeout = setTimeout(onDone, ms);
                if (ac) {
                    if (ac.signal.aborted) { clearTimeout(timeout); reject(new DOMException('Aborted', 'AbortError')); return; }
                    ac.signal.addEventListener('abort', onAbort, { once: true });
                }
            });
        }

        stop() {
            if (this.abortController) {
                this.abortController.abort();
            }
            this.state = 'idle';
        }

        reset() {
            this.stop();
            this.element.innerHTML = '';
            this.currentPath = ['~'];
            this.currentGitBranch = null;
        }
    }

    // --- Terminal Instance ---
    let term = null;

    const initTerminal = () => {
        if (isMobile) return;
        const terminalOutput = document.getElementById('terminal-output');
        if (terminalOutput) {
            term = new Terminal('terminal-output');
        }
    };

    initTerminal();

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

    // --- Terminal Toggle ---
    const terminalToggleTile = document.getElementById('terminal-toggle-tile');
    const terminalCloseBtn = document.getElementById('terminal-close');
    const terminalTile = document.querySelector('.terminal-tile');

    if (isMobile) {
        if (terminalToggleTile) terminalToggleTile.remove();
        if (terminalTile) terminalTile.remove();
    }

    if (!isMobile && terminalToggleTile && terminalTile) {
        terminalToggleTile.addEventListener('click', () => openTerminal());
        terminalToggleTile.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openTerminal();
            }
        });
    }

    if (terminalCloseBtn && terminalTile) {
        terminalCloseBtn.addEventListener('click', () => closeTerminal());
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && terminalTile && terminalTile.classList.contains('terminal-open')) {
            closeTerminal();
        }
    });

    // Swipe to close on mobile
    let touchStartY = 0;
    if (!isMobile && terminalTile) {
        terminalTile.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        terminalTile.addEventListener('touchend', (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            if (touchEndY - touchStartY > 80) {
                closeTerminal();
            }
        }, { passive: true });
    }

    function openTerminal() {
        if (!terminalTile) return;

        terminalTile.classList.add('terminal-open');
        if (terminalToggleTile) {
            terminalToggleTile.classList.add('hidden');
        }

        if (term) {
            term.reset();
            term.start();
        }
    }

    function closeTerminal() {
        if (!terminalTile) return;

        terminalTile.classList.remove('terminal-open');
        if (terminalToggleTile) {
            terminalToggleTile.classList.remove('hidden');
        }

        if (term) {
            term.stop();
        }
    }

})();
