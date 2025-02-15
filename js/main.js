(function () {
    const $ = document.querySelector.bind(document);
    const $body = document.body;
    const client = {
        mobile: /android|ios|iphone|ipad|mobile/i.test(navigator.userAgent.toLowerCase()),
        os: (/android|ios|windows|mac/i.exec(navigator.userAgent.toLowerCase()) || ["other"])[0],
        supportsViewportUnits: CSS.supports("height", "100dvh")
    };
    addEventListener("load", () => {
        $body.classList.remove("is-loading");
    });
    if (client.mobile) {
        const setVH = () => {
            const height = client.supportsViewportUnits ? "100svh" : `${window.innerHeight}px`;
            const bgHeight = client.supportsViewportUnits ? "100lvh" : `${window.innerHeight + 250}px`;
            Object.assign(document.documentElement.style, {
                "--viewport-height": height,
                "--background-height": bgHeight,
            });
        };
        !client.supportsViewportUnits && addEventListener("orientationchange", () => setTimeout(setVH, 100));
        addEventListener("load", setVH);
        $body.classList.add("is-touch");
    }
    if (client.os == "android") {
        const adjustHeight = () => $body.style.height = `${Math.max(screen.width, screen.height)}px`;
        ["load", "orientationchange", "touchmove"].forEach((e) => addEventListener(e, adjustHeight));
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
                setTimeout(() => this.close(), 300);
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
            }, 200);
        }
        open(content) {
            if (this.isLocked) return;
            this.isLocked = true;
            this.$content.textContent = decodeURIComponent(content);
            this.$dialog.showModal();
            requestAnimationFrame(() => {
                this.$dialog.classList.add("active");
                setTimeout(() => (this.isLocked = false), 300);
            });
        }
    }
    const clipboardDialog = new ClipboardDialog();
    const showClipboard = (e, content) => {
        e.preventDefault();
        clipboardDialog.open(content);
        return false;
    };
    $("#ml-btn").addEventListener("click", (event) => showClipboard(event, "oleg@tsv.one"));
    $("#ds-btn").addEventListener("click", (event) => showClipboard(event, "Hekzory"));
    $("#ya-btn").addEventListener("click", (event) => showClipboard(event, "oleg-tsv@yandex.ru"));
})();
