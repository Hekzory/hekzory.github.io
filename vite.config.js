import { defineConfig } from "vite";
import { resolve } from "path";
import { readdirSync } from "node:fs";
import { PAGE_DIRS } from "./i18n-paths.js";
import { generateShells } from "./post-data.js";
// import { compression, defineAlgorithm } from "vite-plugin-compression2";
import { createHtmlPlugin } from "vite-plugin-html";
import htmlMetaPlugin from "./vite-plugin-html-meta";
import sitemapPlugin from "./vite-plugin-sitemap";
import minifyInlineJsonPlugin from "./vite-plugin-minify-inline-json";
import i18nFanoutPlugin from "./vite-plugin-i18n-fanout";
import injectHtml from "vite-plugin-html-inject";
// import zlib from "node:zlib";

// Collect every *.html build entry across both language trees. Static pages are
// real files; article posts come from articles/*.post.json, whose route shells
// generateShells() writes just below before the scan. Vite keys output off each
// entry's path relative to root, so the shells at index.html / ru/index.html /
// articles/<slug>.html emit to the right URLs automatically. templates/ and
// components/ hold <load> partials (not entries), so they're never scanned here.
function htmlEntries() {
    // Regenerate the per-post route shells from articles/*.post.json first, so
    // the scan below picks them up exactly like hand-written entries.
    generateShells(__dirname);
    const entries = {};
    for (const relDir of PAGE_DIRS) {
        const absDir = relDir ? resolve(__dirname, relDir) : __dirname;
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
        injectHtml(),
        createHtmlPlugin({
            minify: true,
        }),
        minifyInlineJsonPlugin(),
        // Disabled: GitHub Pages never serves precompressed .br/.gz files,
        // so this only bloated the artifact. Re-enable (plus the two imports
        // above) if the site moves to a host that picks them up.
        // compression({
        //     algorithms: [
        //         defineAlgorithm('brotliCompress', {
        //             params: {
        //                 [zlib.constants.BROTLI_PARAM_QUALITY]: 12
        //             }
        //         }),
        //         defineAlgorithm('gzip', { level: 9 })],
        //     exclude: [/\.(br)$/, /\.(gz)$/],
        // }),
    ],
    json: {
        stringify: true,
    },
    server: {
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // Mirror GitHub Pages' clean URLs in dev. /articles/ and
                // /articles/<slug> are what the site links to; the slash-less
                // /articles is 301'd to /articles/ by GitHub Pages in prod.
                const [pathname, query = ''] = req.url.split('?');
                const suffix = query ? '?' + query : '';
                // Clean extensionless URLs -> real files, for both language trees:
                // /resume, /ru/resume               -> .../resume.html
                // /articles/<slug>, /ru/articles/<slug> -> .../<slug>.html
                // Directory roots (/, /ru/, /articles/, /ru/articles/) are served
                // from their index.html by Vite. /articles is 301'd to /articles/
                // by GitHub Pages in prod.
                if (
                    /^\/(?:ru\/)?resume$/.test(pathname) ||
                    /^\/(?:ru\/)?articles\/[^/.]+$/.test(pathname)
                ) {
                    req.url = pathname + '.html' + suffix;
                } else if (pathname === '/ru') {
                    req.url = '/ru/' + suffix;
                }
                next();
            });
        }
    },
    build: {
        modulePreload: { polyfill: false },
        rolldownOptions: {
            input: htmlEntries(),
        },
        target: "baseline-widely-available",
        minify: "terser",
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                passes: 5,
                ecma: 2023,
                module: true,
                toplevel: true,
                keep_fargs: false,
                booleans_as_integers: true,
                unsafe_arrows: true,
                unsafe_comps: true,
                unsafe_math: true,
            },
            mangle: {
                toplevel: true,
                module: true,
            },
            format: {
                comments: false,
                ecma: 2023,
            },
        },
    },
});
