// Post-build sanity check for dist/ — zero dependencies, runs in CI before the
// Pages deploy and locally via `pnpm run check`.
//
// What it verifies, per built page:
//   - <html lang>, <title>, <link rel="canonical"> are present;
//   - every <script type="application/ld+json"> and type="speculationrules"
//     block is valid JSON (a broken one silently disables structured data);
//   - every same-site href/src (root-relative or https://tsv.one/...) resolves
//     to a file in dist/, using GitHub Pages' clean-URL rules — so a typo'd
//     link, a missing hreflang twin or a renamed asset fails the build.
// Plus: every sitemap <loc>/<xhtml:link>, and every feed <link href>/<id>,
// resolves the same way.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const DIST = path.resolve(process.argv[2] || "dist");
const ORIGIN = "https://tsv.one";
const problems = [];

function walk(dir, out = []) {
    for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

// A site URL -> the dist file GitHub Pages would serve for it. Directory URLs
// serve their index.html; extensionless URLs serve <name>.html; anything with
// an extension is a plain file.
function resolveUrl(url) {
    let p = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
    p = p.split("#")[0].split("?")[0];
    if (!p.startsWith("/")) return null; // not same-site
    if (p.endsWith("/")) p += "index.html";
    else if (!path.posix.basename(p).includes(".")) p += ".html";
    return path.join(DIST, decodeURIComponent(p));
}

function checkUrl(url, where) {
    if (/^(mailto:|tel:|data:|#)/.test(url)) return;
    if (/^https?:\/\//.test(url) && !url.startsWith(ORIGIN)) return; // external
    const file = resolveUrl(url);
    if (file === null) return;
    if (!existsSync(file)) problems.push(`${where}: link "${url}" -> missing ${path.relative(DIST, file)}`);
}

const files = walk(DIST);

for (const file of files.filter((f) => f.endsWith(".html"))) {
    const rel = path.relative(DIST, file);
    const html = readFileSync(file, "utf-8");

    if (!/<html[^>]*\slang="[a-z]{2}"/.test(html)) problems.push(`${rel}: missing <html lang>`);
    if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: missing <title>`);
    if (!/<link rel="canonical" href="https:\/\/tsv\.one\//.test(html)) problems.push(`${rel}: missing canonical`);

    for (const m of html.matchAll(/<script type="(application\/ld\+json|speculationrules)">([\s\S]*?)<\/script>/g)) {
        try {
            JSON.parse(m[2]);
        } catch (e) {
            problems.push(`${rel}: invalid ${m[1]} JSON (${e.message})`);
        }
    }

    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) checkUrl(m[1], rel);
    // srcset candidates ("/a.webp 200w, /b.webp 300w")
    for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
        for (const c of m[1].split(",")) checkUrl(c.trim().split(/\s+/)[0], rel);
    }
}

for (const file of files.filter((f) => f.endsWith(".xml"))) {
    const rel = path.relative(DIST, file);
    const xml = readFileSync(file, "utf-8");
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) checkUrl(m[1], rel);
    for (const m of xml.matchAll(/<id>([^<]+)<\/id>/g)) checkUrl(m[1], rel);
    for (const m of xml.matchAll(/<(?:xhtml:)?link[^>]*\shref="([^"]+)"/g)) checkUrl(m[1].replace(/&amp;/g, "&"), rel);
}

if (problems.length) {
    console.error(`check-dist: ${problems.length} problem(s)\n  ` + problems.join("\n  "));
    process.exit(1);
}
console.log(`check-dist: ${files.length} files OK`);
