// Minifies every emitted .html asset with html-minifier-next, the maintained
// fork of html-minifier-terser (no release since 2023). Runs in generateBundle
// (enforce: post), i.e. on the final HTML after every transformIndexHtml hook.
//
// The options are spelled out instead of taken from a preset, so a dependency
// bump can't quietly change what ships. Measured on this site's 11 pages
// against the old html-minifier-terser set: -1.6% gzipped, almost all of it
// from minifySVG (the inline icon sprites) and removeOptionalTags. Rendering
// is unchanged: same DOM and text, and icons pixel-identical at 3x DPR.
//
// Deliberately left off:
// - removeAttributeQuotes: another -0.2% gzipped, but scripts/check-dist.js and
//   naive meta/OG scrapers read quoted attributes, and an unquoted
//   `content=https://tsv.one/>` looks self-closing to anything that isn't a
//   spec parser.
// - minifyCSS / minifyJS: the CSP allows no inline styles or scripts, so there
//   is nothing for them to do.
// - removeEmptyElements / collapseInlineTagWhitespace: they change what renders
//   (icon-only elements, spaces between inline elements).
// JSON <script> blocks (JSON-LD, speculation rules) need no option: they are
// always re-serialised compactly, with "<" escaped.
//
// Before minifying, each page's icon sprites lose the <symbol>s it never
// <use>s. The sprite components are shared (icons_index.html ships all nine
// contact/tile icons to the resume and the 404 too), so this is what keeps a
// page from carrying Steam and Discord paths it doesn't draw: -784 B gzip on
// /resume, -1.3 KB on /404. Only static markup is considered: neither main.js
// nor terminal.js creates <use> elements, and scripts/check-dist.js fails the
// build if a <use href="#id"> on any page no longer resolves.
import { minify } from "html-minifier-next";

const OPTIONS = {
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeDefaultTypeAttributes: true,
    removeOptionalTags: true,
    useShortDoctype: true,
    // Vite escapes the attribute values of injected tags (every ' in the CSP
    // becomes &#39;); decode entities back wherever that's safe, and keep
    // double quotes, escaping any " inside as &quot;.
    decodeEntities: true,
    quoteCharacter: '"',
    minifySVG: {
        plugins: [
            {
                name: "preset-default",
                params: {
                    overrides: {
                        // html-minifier-next's own inline-SVG overrides (a config
                        // with `plugins` replaces them): ids, <style> rules and
                        // hidden sprites are used from outside the <svg>.
                        cleanupIds: false,
                        inlineStyles: false,
                        minifyStyles: { usage: false },
                        removeHiddenElems: false,
                        removeUnknownsAndDefaults: { keepRoleAttr: true },
                        // Exact path rewrites only. These four approximate curves
                        // within a tolerance; convertToQ visibly nudged the Steam
                        // icon's outline, and without them gzip is even smaller.
                        // SVGO can't see page CSS: it drops a closing `z` where
                        // the fill doesn't need it, so an icon stroked from CSS
                        // would need this revisited.
                        convertPathData: {
                            convertToQ: false,
                            straightCurves: false,
                            makeArcs: false,
                            smartArcRounding: false,
                        },
                    },
                },
            },
        ],
    },
};

// Drop every <symbol> no <use href="#id"> on the page points at, then any
// sprite <svg> left without symbols. Symbols are matched whole (they never
// nest), and a url(#id) paint server defined inside a kept symbol (the logo
// gradient) goes along with it.
function pruneSprites(html) {
    const used = new Set(Array.from(html.matchAll(/<use\b[^>]*\bhref="#([\w-]+)"/g), (m) => m[1]));
    return html
        .replace(/<symbol\b[^>]*\bid="([\w-]+)"[^>]*>[\s\S]*?<\/symbol>/g, (symbol, id) => (used.has(id) ? symbol : ""))
        .replace(/<svg\b[^>]*\bclass="d-n-d"[^>]*>\s*<\/svg>/g, "");
}

export default function htmlMinifyPlugin() {
    return {
        name: "vite-plugin-html-minify",
        apply: "build",
        enforce: "post",
        async generateBundle(_, bundle) {
            for (const item of Object.values(bundle)) {
                if (item.type === "asset" && item.fileName.endsWith(".html")) {
                    item.source = await minify(pruneSprites(String(item.source)), OPTIONS);
                }
            }
        },
    };
}
