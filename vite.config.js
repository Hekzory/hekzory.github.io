import { defineConfig } from "vite";
import { resolve } from "path";
import { readdirSync } from "node:fs";
// import { compression, defineAlgorithm } from "vite-plugin-compression2";
import { createHtmlPlugin } from "vite-plugin-html";
import htmlMetaPlugin from "./vite-plugin-html-meta";
import sitemapPlugin from "./vite-plugin-sitemap";
import minifyInlineJsonPlugin from "./vite-plugin-minify-inline-json";
import injectHtml from "vite-plugin-html-inject";
// import zlib from "node:zlib";

// Every articles/*.html is a build entry — drop a file in there and it ships,
// no edits here. Vite keys output off each entry's path relative to root, so
// articles/foo.html -> dist/articles/foo.html regardless of the input key.
function articleInputs() {
    const dir = resolve(__dirname, "articles");
    try {
        return Object.fromEntries(
            readdirSync(dir)
                .filter((f) => f.endsWith(".html"))
                .map((f) => [`articles/${f.slice(0, -5)}`, resolve(dir, f)])
        );
    } catch {
        return {};
    }
}

export default defineConfig({
    appType: "mpa",
    plugins: [
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
                if (pathname === '/resume') {
                    req.url = '/resume.html';
                } else if (/^\/articles\/[^/.]+$/.test(pathname)) {
                    req.url = pathname + '.html' + (query && '?' + query);
                }
                next();
            });
        }
    },
    build: {
        modulePreload: { polyfill: false },
        rolldownOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                resume: resolve(__dirname, "resume.html"),
                notfoundpage: resolve(__dirname, "404.html"),
                ...articleInputs(),
            },
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
