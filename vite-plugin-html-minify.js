// Minifies every emitted .html asset with html-minifier-terser, using exactly
// the option set vite-plugin-html's `minify: true` used — minification was the
// only thing that plugin was here for. Its other behaviour was dead weight: an
// ejs pass over every template (nothing uses <% %>), and a dev-server
// history-fallback that rewrote EVERY clean URL to index.html (see
// vite-plugin-clean-urls.js for the middleware that replaces it).
//
// Runs in generateBundle (enforce: post), i.e. on the final HTML after every
// transformIndexHtml hook — including the inline JSON-LD collapsing — exactly
// where the old plugin ran, so the output is byte-identical.
import { minify } from "html-minifier-terser";

const OPTIONS = {
    collapseWhitespace: true,
    keepClosingSlash: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
};

export default function htmlMinifyPlugin() {
    return {
        name: "vite-plugin-html-minify",
        apply: "build",
        enforce: "post",
        async generateBundle(_, bundle) {
            for (const item of Object.values(bundle)) {
                if (item.type === "asset" && item.fileName.endsWith(".html")) {
                    item.source = await minify(String(item.source), OPTIONS);
                }
            }
        },
    };
}
