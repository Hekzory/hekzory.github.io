(function () {
    const on = addEventListener,
        $ = (q) => document.querySelector(q),
        $body = document.body;
    const client = (function () {
        const o = {
                browser: "other",
                browserVersion: 0,
                os: "other",
                osVersion: 0,
                mobile: false,
                flags: { lsdUnits: false },
            },
            ua = navigator.userAgent,
            browsers = [
                ["firefox", /Firefox\/([0-9\.]+)/],
                ["edge", /Edge\/([0-9\.]+)/],
                ["safari", /Version\/([0-9\.]+).+Safari/],
                ["chrome", /Chrome\/([0-9\.]+)/],
                ["chrome", /CriOS\/([0-9\.]+)/],
                ["ie", /Trident\/.+rv:([0-9]+)/],
            ];
        for (const [name, regex] of browsers) {
            const match = ua.match(regex);
            if (match) {
                o.browser = name;
                o.browserVersion = parseFloat(match[1]);
                break;
            }
        }
        const osList = [
            ["ios", /([0-9_]+) like Mac OS X/, (v) => v.replace(/_/g, ".")],
            ["ios", /CPU like Mac OS X/, () => 0],
            ["ios", /iPad; CPU/, () => 0],
            ["android", /Android ([0-9\.]+)/],
            ["mac", /Macintosh.+Mac OS X ([0-9_]+)/, (v) => v.replace(/_/g, ".")],
            ["windows", /Windows NT ([0-9\.]+)/],
            ["undefined", /Undefined/],
        ];
        for (const [name, regex, processor] of osList) {
            const match = ua.match(regex);
            if (match) {
                o.os = name;
                o.osVersion = parseFloat(processor ? processor(match[1]) : match[1]);
                break;
            }
        }
        if (
            o.os === "mac" &&
            "ontouchstart" in window &&
            [
                [1024, 1366],
                [834, 1112],
                [810, 1080],
                [768, 1024],
            ].some(([w, h]) => screen.width === w && screen.height === h)
        ) {
            o.os = "ios";
        }
        o.mobile = ["android", "ios"].includes(o.os);
        const _canUse = document.createElement("div").style;
        o.canUse = (property, value) => {
            if (!(property in _canUse)) return false;
            if (value !== undefined) {
                _canUse[property] = value;
                if (_canUse[property] === "") return false;
            }
            return true;
        };
        o.flags.lsdUnits = o.canUse("width", "100dvw");
        return o;
    })();
    let loaderTimeout = setTimeout(() => $body.classList.add("with-loader"), 500);
    const loadHandler = () => {
        clearTimeout(loaderTimeout);
        $body.classList.remove("is-loading");
        $body.classList.add("is-playing");
        setTimeout(() => {
            $body.classList.replace("is-playing", "is-ready");
        }, 5e3);
    };
    on("load", loadHandler);
    if (client.mobile) {
        const setViewportHeight = () => {
            const viewportHeight = client.flags.lsdUnits ? "100svh" : `${window.innerHeight}px`;
            const backgroundHeight = client.flags.lsdUnits ? "100lvh" : `${window.innerHeight + 250}px`;
            document.documentElement.style.setProperty("--viewport-height", viewportHeight);
            document.documentElement.style.setProperty("--background-height", backgroundHeight);
        };
        if (!client.flags.lsdUnits) {
            on("load", setViewportHeight);
            on("orientationchange", () => setTimeout(setViewportHeight, 100));
        } else {
            setViewportHeight();
        }
        $body.classList.add("is-touch");
    }
    if (client.os == "android") {
        const adjustHeight = () => {
            document.body.style.height = Math.max(screen.width, screen.height) + "px";
        };
        ["load", "orientationchange", "touchmove"].forEach((event) => on(event, adjustHeight));
    } else if (client.os == "ios" && client.osVersion <= 11) {
        document.body.style.webkitTransform = "scale(1.0)";
        const iosFocusFixHandler = (event) => {
            const isFocus = event.type === "focus";
            document.body.classList.toggle("ios-focus-fix", isFocus);
            document.body.style.height = isFocus ? "calc(100% + 60px)" : "";
        };
        ["focus", "blur"].forEach((event) => on(event, iosFocusFixHandler, true));
    }
    class ClipboardDialog {
        constructor() {
            this.isLocked = false;
            this.$dialog = this.createElement("dialog", "clipboard", document.body);
            this.$contentWrapper = this.createElement("div", "wrapper", this.$dialog);
            this.$content = this.createElement("p", "content", this.$contentWrapper, "-");
            this.createElement("div", "close", this.$dialog).addEventListener("click", () => this.close());
            this.$dialog.addEventListener("click", () => this.close());
            this.$dialog.addEventListener("keydown", (e) => e.key === "Escape" && this.close());
            this.$content.parentElement.addEventListener("click", (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(this.$content.innerText);
                this.$content.parentElement.classList.add("copied");
                setTimeout(() => this.close(), 250);
            });
        }
        createElement(tag, className, parent, innerText = "") {
            const el = document.createElement(tag);
            el.classList.add(className);
            el.innerText = innerText;
            parent.appendChild(el);
            return el;
        }
        close() {
            if (this.isLocked) return;
            this.isLocked = true;
            this.$dialog.classList.remove("active");
            setTimeout(() => {
                this.$dialog.close();
                this.$content.parentElement.classList.remove("copied");
                this.isLocked = false;
            }, 750);
        }
        open(content) {
            if (this.isLocked) return;
            this.isLocked = true;
            this.$content.innerText = unescape(content);
            this.$dialog.showModal();
            requestAnimationFrame(() => {
                this.$dialog.classList.add("active");
                setTimeout(() => (this.isLocked = false), 250);
            });
        }
    }
    const clipboardDialog = new ClipboardDialog();
    const showClipboard = (event, content) => {
        event.preventDefault();
        clipboardDialog.open(content);
        return false;
    };
    $("#ml-btn").addEventListener("click", (event) => showClipboard(event, "oleg@tsv.one"));
    $("#ds-btn").addEventListener("click", (event) => showClipboard(event, "Hekzory"));
    $("#ya-btn").addEventListener("click", (event) => showClipboard(event, "oleg-tsv@yandex.ru"));
})();
