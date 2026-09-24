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
// resolves the same way. And every letter/digit/mark in the visible text of
// every page is in the subset web font (see assets-src/README.md): a missing
// one wouldn't break the page, it would quietly render in the fallback face.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
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

// Codepoints a WOFF2 font maps to a real glyph, read straight from its cmap.
// WOFF2 is one brotli stream of all tables in directory order; cmap is never
// transformed, so only the directory has to be walked to find its slice.
function woff2Codepoints(file) {
    const buf = readFileSync(file);
    if (buf.toString("latin1", 0, 4) !== "wOF2") throw new Error("not a WOFF2 file");
    const numTables = buf.readUInt16BE(12);
    const compressedSize = buf.readUInt32BE(20);
    let pos = 48;
    const base128 = () => {
        let v = 0;
        for (let i = 0; i < 5; i++) {
            const b = buf[pos++];
            v = v * 128 + (b & 0x7f);
            if (!(b & 0x80)) return v;
        }
        throw new Error("bad UIntBase128");
    };
    const tables = [];
    for (let i = 0; i < numTables; i++) {
        const flags = buf[pos++];
        const tagIndex = flags & 0x3f;
        const version = flags >> 6;
        let tag = null;
        if (tagIndex === 63) {
            tag = buf.toString("latin1", pos, pos + 4);
            pos += 4;
        }
        const origLength = base128();
        // glyf (10) / loca (11): version 0 is the transformed form; every other
        // table is transformed only for a non-zero version.
        const transformed = tagIndex === 10 || tagIndex === 11 ? version === 0 : version !== 0;
        const length = transformed ? base128() : origLength;
        tables.push({ isCmap: tagIndex === 0 || tag === "cmap", length });
    }
    const data = brotliDecompressSync(buf.subarray(pos, pos + compressedSize));
    let off = 0;
    let cmap = null;
    for (const t of tables) {
        if (t.isCmap) cmap = data.subarray(off, off + t.length);
        off += t.length;
    }
    if (!cmap) throw new Error("no cmap table");

    const out = new Set();
    const subtables = [];
    for (let i = 0, n = cmap.readUInt16BE(2); i < n; i++) {
        const rec = 4 + i * 8;
        const platform = cmap.readUInt16BE(rec);
        const encoding = cmap.readUInt16BE(rec + 2);
        if (platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) {
            subtables.push(cmap.readUInt32BE(rec + 4));
        }
    }
    for (const at of subtables) {
        const format = cmap.readUInt16BE(at);
        if (format === 4) {
            const segs = cmap.readUInt16BE(at + 6) / 2;
            const ends = at + 14;
            const starts = ends + segs * 2 + 2;
            const deltas = starts + segs * 2;
            const rangeOffsets = deltas + segs * 2;
            for (let s = 0; s < segs; s++) {
                const end = cmap.readUInt16BE(ends + s * 2);
                const start = cmap.readUInt16BE(starts + s * 2);
                const delta = cmap.readInt16BE(deltas + s * 2);
                const ro = cmap.readUInt16BE(rangeOffsets + s * 2);
                for (let c = start; c <= end && c !== 0xffff; c++) {
                    let gid;
                    if (ro === 0) gid = (c + delta) & 0xffff;
                    else {
                        const g = cmap.readUInt16BE(rangeOffsets + s * 2 + ro + (c - start) * 2);
                        gid = g === 0 ? 0 : (g + delta) & 0xffff;
                    }
                    if (gid) out.add(c);
                }
            }
        } else if (format === 12) {
            for (let g = 0, n = cmap.readUInt32BE(at + 12); g < n; g++) {
                const grp = at + 16 + g * 12;
                const start = cmap.readUInt32BE(grp);
                const end = cmap.readUInt32BE(grp + 4);
                const startGlyph = cmap.readUInt32BE(grp + 8);
                for (let c = start; c <= end; c++) if (startGlyph + (c - start)) out.add(c);
            }
        }
    }
    return out;
}

// The text a page actually renders in its body font: the document minus
// <title>, scripts, styles and inline SVG, tags stripped, entities decoded.
// (<title> and attributes like alt/aria-label are drawn by the browser UI, not
// the page.) Not split on <body>: its start tag is optional and the minifier
// may drop it, which would silently skip this check.
function visibleText(html) {
    return html
        .replace(/<(title|script|style|svg)\b[\s\S]*?<\/\1>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&(nbsp|amp|lt|gt|quot|apos);/g, (_, e) => ({ nbsp: "\u00a0", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[e]);
}

const files = walk(DIST);

const fontFile = files.find((f) => /[\\/]martianmono-[\w-]+\.woff2$/.test(f));
let fontCmap = null;
if (!fontFile) problems.push("web font assets/martianmono-*.woff2 not found in dist/");
else {
    try {
        fontCmap = woff2Codepoints(fontFile);
    } catch (e) {
        problems.push(`${path.relative(DIST, fontFile)}: can't read cmap (${e.message})`);
    }
}
// Symbols outside the subset (box drawing, ▶, emoji) are expected to fall back;
// they're listed once at the end rather than failing the check.
const fallbackSymbols = new Set();

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

    if (fontCmap) {
        const missing = new Set();
        for (const ch of visibleText(html)) {
            if (fontCmap.has(ch.codePointAt(0)) || /\s/u.test(ch)) continue;
            if (/[\p{L}\p{M}\p{N}]/u.test(ch)) missing.add(ch);
            else fallbackSymbols.add(ch);
        }
        if (missing.size) {
            const list = [...missing].map((c) => `${c} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`);
            problems.push(`${rel}: letter(s) not in the web font subset (add them, see assets-src/README.md): ${list.join(", ")}`);
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
if (fallbackSymbols.size) {
    console.log(`check-dist: note: symbols drawn by the fallback font (not in the subset): ${[...fallbackSymbols].join(" ")}`);
}
