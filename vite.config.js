import { defineConfig } from "vite";
import { resolve } from "path";
import { readdirSync } from "node:fs";
import { PAGE_DIRS } from "./i18n-paths.js";
import { generateShells } from "./post-data.js";
import htmlMetaPlugin from "./vite-plugin-html-meta.js";
import sitemapPlugin from "./vite-plugin-sitemap.js";
import feedPlugin from "./vite-plugin-feed.js";
import i18nFanoutPlugin from "./vite-plugin-i18n-fanout.js";
import htmlMinifyPlugin from "./vite-plugin-html-minify.js";
import cleanUrlsPlugin from "./vite-plugin-clean-urls.js";
import devtoolsJsonPlugin from "./vite-plugin-devtools-json.js";
import injectHtml from "vite-plugin-html-inject";

// Collect every *.html build entry across both language trees. Static pages are
// real files; article posts come from articles/*.post.json, whose route shells
// generateShells() writes just below before the scan. Vite keys output off each
// entry's path relative to root, so the shells at index.html / ru/index.html /
// articles/<slug>.html emit to the right URLs automatically. templates/ and
// components/ hold <load> partials (not entries), so they're never scanned here.
function htmlEntries() {
    // Regenerate the per-post route shells from articles/*.post.json first, so
    // the scan below picks them up exactly like hand-written entries.
    generateShells(import.meta.dirname);
    const entries = {};
    for (const relDir of PAGE_DIRS) {
        const absDir = relDir ? resolve(import.meta.dirname, relDir) : import.meta.dirname;
        try {
            for (const f of readdirSync(absDir)) {
                if (!f.endsWith(".html")) continue;
                const rel = relDir ? `${relDir}/${f}` : f;
                entries[rel.slice(0, -5)] = resolve(absDir, f);
            }
        } catch {
            /* directory may not exist yet */
        }
    }
    return entries;
}

export default defineConfig({
    appType: "mpa",
    plugins: [
        // Runs after injectHtml's "pre" pass (components inlined) and before the
        // meta plugin: fills {{t.*}} dictionary tokens + computed locale tokens.
        i18nFanoutPlugin(),
        htmlMetaPlugin(),
        sitemapPlugin(),
        feedPlugin(),
        injectHtml(),
        // Final HTML minification (generateBundle, after every transform above);
        // it also compacts the inline JSON-LD and speculation rules.
        htmlMinifyPlugin(),
        // Dev server only: GitHub Pages-style clean URLs.
        cleanUrlsPlugin(),
        // Dev + preview only: Chrome DevTools workspace probe (silences its console noise).
        devtoolsJsonPlugin(),
        // No precompression: GitHub Pages never serves .br/.gz files.
    ],
    json: {
        stringify: true,
    },
    build: {
        modulePreload: { polyfill: false },
        rolldownOptions: {
            input: htmlEntries(),
        },
        target: "baseline-widely-available",
        // JS minifier: Vite 8's default (Oxc). Measured against the previous
        // terser passes:5 setup on this codebase: main.js +11 B, terminal.js
        // −59 B gzip — parity, minus a 2.4 MB dependency and a slower build.
    },
});
