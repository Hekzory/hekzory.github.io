(function () {
    const on = addEventListener,
        off = removeEventListener,
        $ = (q) => document.querySelector(q),
        $$ = (q) => document.querySelectorAll(q),
        $body = document.body,
        $inner = $(".inner");
    const client = (function () {
        const o = {
                browser: "other",
                browserVersion: 0,
                os: "other",
                osVersion: 0,
                mobile: false,
                canUse: null,
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
        const _canUse = document.createElement("div");
        o.canUse = (property, value) => {
            const style = _canUse.style;
            if (!(property in style)) return false;
            if (value !== undefined) {
                style[property] = value;
                if (style[property] === "") return false;
            }
            return true;
        };
        o.flags.lsdUnits = o.canUse("width", "100dvw");
        return o;
    })();
    let loaderTimeout = setTimeout(() => $body.classList.add("with-loader"), 500);
    const loadHandler = () =>
        setTimeout(() => {
            clearTimeout(loaderTimeout);
            $body.classList.remove("is-loading");
            $body.classList.add("is-playing");
            setTimeout(() => {
                $body.classList.remove("is-playing");
                $body.classList.add("is-ready");
            }, 5e3);
        }, 100);
    on("load", loadHandler);
    if (client.mobile) {
        (function () {
            if (client.flags.lsdUnits) {
                document.documentElement.style.setProperty("--viewport-height", "100svh");
                document.documentElement.style.setProperty("--background-height", "100lvh");
            } else {
                var f = function () {
                    document.documentElement.style.setProperty("--viewport-height", window.innerHeight + "px");
                    document.documentElement.style.setProperty("--background-height", window.innerHeight + 250 + "px");
                };
                on("load", f);
                on("orientationchange", function () {
                    setTimeout(f, 100);
                });
            }
            $body.classList.add("is-touch");
        })();
    }
    if (client.os == "android") {
        (function () {
            const f = () => {
                document.body.style.height = Math.max(screen.width, screen.height) + "px";
            };
            on("load", f);
            on("orientationchange", f);
            on("touchmove", f);
        })();
    } else if (client.os == "ios" && client.osVersion <= 11) {
        (function () {
            document.body.style.webkitTransform = "scale(1.0)";
            const iosFocusFixHandler = (event) => {
                if (event.type === "focus") {
                    document.body.classList.add("ios-focus-fix");
                    document.body.style.height = "calc(100% + 60px)";
                } else {
                    document.body.classList.remove("ios-focus-fix");
                    document.body.style.height = "";
                }
            };
            on("focus", iosFocusFixHandler, true);
            on("blur", iosFocusFixHandler, true);
        })();
    }
    (function () {
        let dialog = null;
        class ClipboardDialog {
            constructor() {
                this.isLocked = false;
                this.$dialog = this.createElement("dialog", "clipboard", document.body);
                this.$content = this.createElement(
                    "p",
                    "content",
                    this.createElement("div", "wrapper", this.$dialog),
                    "-",
                );
                this.createElement("div", "close", this.$dialog).addEventListener("click", () => this.close());
                this.addEventListeners();
            }
            createElement(tag, className, parent, innerText = "") {
                const el = document.createElement(tag);
                el.classList.add(className);
                el.innerText = innerText;
                parent.appendChild(el);
                return el;
            }
            addEventListeners() {
                this.$dialog.addEventListener("click", () => this.close());
                this.$dialog.addEventListener("keydown", (e) => e.key === "Escape" && this.close());
                this.$content.parentElement.addEventListener("click", (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(this.$content.innerText);
                    this.$content.parentElement.classList.add("copied");
                    setTimeout(() => this.close(), 250);
                });
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
        window._clipboard = (event, content) => {
            event.preventDefault();
            if (!dialog) dialog = new ClipboardDialog();
            dialog.open(content);
            return false;
        };

        const emailButton = $("#ml-btn");
        const discordButton = $("#ds-btn");
        const yandexButton = $("#ya-btn");

        emailButton.addEventListener("click", (event) => _clipboard(event, 'oleg@tsv.one'));
        discordButton.addEventListener("click", (event) => _clipboard(event, 'Hekzory'));
        yandexButton.addEventListener("click", (event) => _clipboard(event, 'oleg-tsv@yandex.ru'));
    })();
})();
