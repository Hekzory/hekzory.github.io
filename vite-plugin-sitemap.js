import fs from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { siblings, abs, localeOf } from "./i18n-paths.js";

// <lastmod> should mark when a page's CONTENT last changed meaningfully (Google
// only trusts it when it's verifiably accurate), so we derive it per page from
// that page's *real* inputs rather than a single global "shared sources" bucket
// (which bumped every page on any css/i18n/meta tweak). For each page we resolve:
//   - its recursive <load> graph (shell -> template -> components): the HTML
//     files that actually compose it, tracked at git file granularity;
//   - the i18n leaf keys it references (scanned from that expanded graph): the
//     monolithic dict is shared, so we walk its history per-key, not per-file;
//   - the meta.json title/description/type it renders: same per-key treatment.
// Whichever of those changed most recently wins. CSS/JS are <link>/<script>
// references (presentation/behavior, not inlined content), so they're out of
// the graph by construction. Falls back to build time when git can't answer
// honestly (no repo, shallow clone, uncommitted/untracked files).

// Discover indexable page entries across both language trees, mirroring
// htmlEntries() in vite.config.js. The thin shells and per-locale article files
// map 1:1 to clean URLs via cleanUrl(); 404s are noindex, so they're excluded.
function pageEntries() {
    const dirs = ["", "articles", "ru", "ru/articles"];
    const out = [];
    for (const d of dirs) {
        try {
            for (const f of readdirSync(d || ".")) {
                if (!f.endsWith(".html")) continue;
                const rel = d ? `${d}/${f}` : f;
                const name = rel.slice(0, -5);
                if (name === "404" || name.endsWith("/404")) continue;
                out.push(rel);
            }
        } catch {
            /* directory may not exist */
        }
    }
    return out.sort();
}

function git(args) {
    return execFileSync("git", args, { encoding: "utf-8" }).trim();
}

// A shallow clone (or no repo) can't give honest history; cache the verdict.
let shallow = null;
function gitUnusable() {
    if (shallow === null) {
        try {
            shallow = git(["rev-parse", "--is-shallow-repository"]) === "true";
        } catch {
            shallow = true;
        }
    }
    return shallow;
}

// Newest committer date (%cI = strict ISO 8601, valid <lastmod> as-is) touching
// a single tracked path. null for untracked/uncommitted files. Cached per path.
const fileDateCache = new Map();
function fileLastMod(file) {
    if (fileDateCache.has(file)) return fileDateCache.get(file);
    let date = null;
    try {
        if (!gitUnusable()) date = git(["log", "-1", "--format=%cI", "--", file]) || null;
    } catch {
        date = null;
    }
    fileDateCache.set(file, date);
    return date;
}

// Chronological content history of a tracked JSON file (newest commit first):
// [{ date, data }]. Each entry is the parsed file as of that commit, so we can
// later ask "when did THIS subtree last change" without re-touching git. Cached
// per file (the i18n dict / meta.json are reused across every page).
const jsonHistoryCache = new Map();
function jsonHistory(file) {
    if (jsonHistoryCache.has(file)) return jsonHistoryCache.get(file);
    let hist = [];
    try {
        if (!gitUnusable()) {
            const log = git(["log", "--format=%cI%x1f%H", "--", file]);
            if (log) {
                for (const line of log.split("\n")) {
                    const sep = line.indexOf("\x1f");
                    if (sep < 0) continue;
                    const date = line.slice(0, sep);
                    const hash = line.slice(sep + 1);
                    let data = null;
                    try {
                        data = JSON.parse(git(["show", `${hash}:${file}`]));
                    } catch {
                        data = null; // absent or unparseable at that commit
                    }
                    hist.push({ date, data });
                }
            }
        }
    } catch {
        hist = [];
    }
    jsonHistoryCache.set(file, hist);
    return hist;
}

const getIn = (obj, dotted) =>
    dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

// Newest commit date at which the projection of `keyPaths` (a slice of a JSON
// file) actually changed value. Walks newest -> oldest and returns the first
// commit whose projection differs from the next-older one, i.e. the most recent
// commit that touched *these* keys (ignoring unrelated edits to the same file).
function jsonSubtreeLastMod(file, keyPaths) {
    const keys = [...new Set(keyPaths)].filter(Boolean).sort();
    if (keys.length === 0) return null;
    const hist = jsonHistory(file);
    if (hist.length === 0) return null;
    const project = (data) => JSON.stringify(keys.map((k) => getIn(data, k) ?? null));
    for (let i = 0; i < hist.length; i++) {
        const cur = project(hist[i].data);
        const older = i + 1 < hist.length ? project(hist[i + 1].data) : null;
        if (cur !== older) return hist[i].date;
    }
    return hist[hist.length - 1].date;
}

// Matches vite-plugin-html-inject's <load src="..."> (root-relative src, may
// carry extra attributes and span lines) and the i18n-fanout's {{t.dotted.key}}.
const LOAD_RE = /<load\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>/gi;
const T_RE = /\{\{t\.([\w.]+)\}\}/g;

// Resolve an entry's recursive <load> graph: the set of HTML source files it
// composes from, plus every i18n leaf key referenced across that composed
// markup. Mirrors how injectHtml expands shells -> templates -> components.
function resolveGraph(root, entryRel) {
    const files = new Set();
    const keys = new Set();
    const visit = (rel) => {
        const norm = rel.replace(/^\.?\//, "").replace(/\\/g, "/");
        if (files.has(norm)) return;
        let html;
        try {
            html = readFileSync(path.resolve(root, norm), "utf-8");
        } catch {
            return; // missing partial -> skip (build would surface it anyway)
        }
        files.add(norm);
        // Collect tokens, then nested srcs, before recursing: LOAD_RE/T_RE are
        // shared /g regexes, so each exec loop must finish before the next call.
        let m;
        T_RE.lastIndex = 0;
        while ((m = T_RE.exec(html))) keys.add(m[1]);
        const srcs = [];
        LOAD_RE.lastIndex = 0;
        while ((m = LOAD_RE.exec(html))) srcs.push(m[1]);
        for (const s of srcs) visit(s);
    };
    visit(entryRel);
    return { files: [...files], keys: [...keys] };
}

// The meta.json keys a page actually renders into <title>/description/og, keyed
// off the page path the same way vite-plugin-html-meta derives its page key.
function metaPaths(entryRel, locale, meta) {
    let pageName = entryRel.replace(/\.html$/, "");
    if (pageName.endsWith("/index")) pageName = pageName.slice(0, -"/index".length);
    if (pageName === "index") pageName = null;
    const ov = pageName ? meta?.pages?.[pageName] : null;
    const paths = [];
    // Title/description: track the *effective* source (page override, else the
    // locale-resolved global) so a global edit only bumps pages that fall back.
    paths.push(ov && ov.title != null ? `pages.${pageName}.title` : `title.${locale}`);
    paths.push(
        ov && ov.description != null ? `pages.${pageName}.description` : `description.${locale}`
    );
    if (pageName) {
        paths.push(`pages.${pageName}.type`);
        paths.push(`pages.${pageName}.robots`);
    }
    paths.push("siteName"); // og:site_name, shown on every page
    return paths;
}

export default function sitemapPlugin({ outDir = "dist", i18nDir = "i18n" } = {}) {
    let root = process.cwd();
    return {
        name: "vite-plugin-sitemap",
        apply: "build",
        configResolved(config) {
            root = config.root;
        },
        async closeBundle() {
            const buildTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
            let meta = {};
            try {
                meta = JSON.parse(readFileSync(path.resolve(root, "meta.json"), "utf-8"));
            } catch {
                /* meta.json optional; metaPaths just resolves to nulls */
            }

            const body = pageEntries()
                .map((rel) => {
                    const sib = siblings(rel);
                    const loc = abs(sib.clean);
                    const locale = localeOf(rel);

                    // Real per-page inputs: composed HTML files (git file-level)
                    // + referenced i18n keys + rendered meta keys (both per-key).
                    const { files, keys } = resolveGraph(root, rel);
                    const candidates = [
                        ...files.map(fileLastMod),
                        jsonSubtreeLastMod(path.posix.join(i18nDir, `${locale}.json`), keys),
                        jsonSubtreeLastMod("meta.json", metaPaths(rel, locale, meta)),
                    ].filter(Boolean);
                    const lastmod = candidates.length
                        ? candidates.reduce((a, b) =>
                              new Date(a).getTime() >= new Date(b).getTime() ? a : b
                          )
                        : buildTime;

                    // Reciprocal hreflang alternates per the sitemap i18n format.
                    const alts = [
                        `    <xhtml:link rel="alternate" hreflang="en" href="${abs(sib.enPath)}"/>`,
                        `    <xhtml:link rel="alternate" hreflang="ru" href="${abs(sib.ruPath)}"/>`,
                        `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(sib.xdefault)}"/>`,
                    ].join("\n");
                    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alts}\n  </url>`;
                })
                .join("\n");
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
            await fs.writeFile(path.resolve(outDir, "sitemap.xml"), xml, "utf-8");
        },
    };
}
