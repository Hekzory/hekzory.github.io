import fs from "fs/promises";
import path from "path";
import { Window } from "happy-dom";

export default function htmlMetaPlugin(options = {}) {
    const {
        metaFile = "meta.json",
        encoding = "utf-8",
        defaultViewport = "width=device-width,initial-scale=1",
        defaultCharset = "utf-8",
    } = options;

    // Helper function to create or update a meta tag
    const insertMetaTag = (document, name, content, property = false) => {
        let meta = document.head.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute(property ? "property" : "name", name);
            document.head.appendChild(meta);
        }
        meta.setAttribute("content", content);
    };

    return {
        name: "vite-plugin-html-meta",
        async transformIndexHtml(html) {
            const meta = JSON.parse(await fs.readFile(path.resolve(metaFile), encoding));

            const window = new Window();
            const document = window.document;
            document.documentElement.innerHTML = html;

            // Update or set title if none present
            const t = document.head.querySelector("title") || document.createElement("title");
            t.textContent = meta.title;
            if (!t.parentNode) {
                document.head.insertBefore(t, document.head.firstChild);
            }

            insertMetaTag(document, "viewport", defaultViewport);

            // Ensure charset meta tag is present
            if (!document.head.querySelector("meta[charset]")) {
                const charsetMeta = document.createElement("meta");
                charsetMeta.setAttribute("charset", defaultCharset);
                document.head.insertBefore(charsetMeta, document.head.firstChild);
            }

            // Basic metatags for proper presentation on the web
            insertMetaTag(document, "description", meta.description);
            insertMetaTag(document, "og:site_name", meta.title, true);
            insertMetaTag(document, "og:title", meta.title, true);
            insertMetaTag(document, "og:description", meta.description, true);
            insertMetaTag(document, "og:url", meta.url, true);
            insertMetaTag(document, "og:image", meta.image, true);
            insertMetaTag(document, "og:type", meta.type, true);
            insertMetaTag(document, "theme-color", meta.themeColor);

            // Update or create canonical link
            let canonical = document.head.querySelector('link[rel="canonical"]');
            if (!canonical) {
                canonical = document.createElement("link");
                canonical.setAttribute("rel", "canonical");
                document.head.appendChild(canonical);
            }
            canonical.setAttribute("href", meta.url);
            return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
        },
    };
}
