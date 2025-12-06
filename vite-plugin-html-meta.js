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
        async transformIndexHtml(html, ctx) {
            const metaData = JSON.parse(await fs.readFile(path.resolve(metaFile), encoding));

            // Extract page name from the file path (e.g., "resume" from "/path/to/resume.html")
            const fileName = ctx.filename ? path.basename(ctx.filename, '.html') : 'index';
            const pageName = fileName === 'index' ? null : fileName;

            // Merge page-specific overrides if they exist
            const pageOverrides = pageName && metaData.pages?.[pageName] ? metaData.pages[pageName] : {};
            const meta = { ...metaData, ...pageOverrides };

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
            insertMetaTag(document, "og:site_name", metaData.title, true); // Always use base site name
            insertMetaTag(document, "og:title", meta.title, true);
            insertMetaTag(document, "og:description", meta.description, true);
            insertMetaTag(document, "og:url", meta.url, true);
            insertMetaTag(document, "og:image", meta.image || metaData.image, true);
            insertMetaTag(document, "og:type", meta.type || metaData.type, true);
            insertMetaTag(document, "theme-color", meta.themeColor || metaData.themeColor);

            // Color scheme hint (helps UA pick native UI colors)
            insertMetaTag(document, "color-scheme", meta.colorScheme || metaData.colorScheme || "dark");

            // Twitter card (uses same meta values by default)
            insertMetaTag(document, "twitter:card", meta.twitterCard || metaData.twitterCard || "summary_large_image");
            insertMetaTag(document, "twitter:title", meta.title);
            insertMetaTag(document, "twitter:description", meta.description);
            insertMetaTag(document, "twitter:image", meta.image || metaData.image);
            insertMetaTag(document, "twitter:site", meta.twitterSite || metaData.twitterSite || meta.url);

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
