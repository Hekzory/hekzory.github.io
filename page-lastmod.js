// Git-based "content last changed" date for a single build entry. Shared by
// vite-plugin-sitemap.js (<lastmod>) and the build's {{modified}} token / the
// meta plugin's article:modified_time, so all three can never disagree.
//
// <lastmod>/dateModified should mark when a page's CONTENT last changed (Google
// only trusts it when verifiably accurate), so we derive it per page from that
// page's *real* inputs rather than a single global "shared sources" bucket. For
// each page we resolve:
//   - its recursive <load> graph (shell -> template -> components -> content):
//     the HTML files that actually compose it, tracked at git file granularity;
//   - the i18n leaf keys it references (scanned from that expanded graph): the
//     monolithic dict is shared, so we walk its history per-key, not per-file;
//   - the meta.json title/description/type it renders: same per-key treatment.
// Whichever changed most recently wins. CSS/JS (<link>/<script> refs) and the
// shared chrome on every page (nav/icons/speculation) are presentation, not page
// content, so they're kept out of the date — CSS/JS by construction, chrome via
// CHROME_FILES below (still walked for the i18n keys it contributes). Falls back
// to a caller-supplied build time when git can't answer honestly (no repo,
// shallow clone, uncommitted/untracked files).

import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { localeOf } from "./i18n-paths.js";
import { pageKey } from "./meta-resolve.js";
import { postSlug, loadPosts } from "./post-data.js";

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

// A self-closing <load .../> tag (the attrs blob in group 1), each attr inside
// it, and the i18n-fanout's {{t.dotted.key}}. We mirror html-inject closely
// enough to thread {=$param} values from a parent into a child's srcs/tokens —
// without that, an article template's content="{=$slug}" load (the prose) would
// never enter the graph, so prose edits wouldn't move <lastmod>/dateModified.
const LOAD_TAG_RE = /<load\b([^>]*?)\/>/gi;
const ATTR_RE = /([\w-]+)\s*=\s*"([^"]*)"/g;
const T_RE = /\{\{t\.([\w.]+)\}\}/g;

// Resolve an entry's recursive <load> graph: the set of HTML source files it
// composes from, plus every i18n leaf key referenced across that composed
// markup. Mirrors how injectHtml expands shells -> templates -> components and
// substitutes {=$attr} params before recursing (so interpolated srcs resolve and
// per-post i18n keys like art.posts.<slug>.title are tracked concretely).
function resolveGraph(root, entryRel) {
    const files = new Set();
    const keys = new Set();
    const visit = (rel, params) => {
        const norm = rel.replace(/^\.?\//, "").replace(/\\/g, "/");
        if (files.has(norm)) return;
        let html;
        try {
            html = readFileSync(path.resolve(root, norm), "utf-8");
        } catch {
            return; // missing partial -> skip (build would surface it anyway)
        }
        files.add(norm);
        // Substitute parent-provided params first (html-inject does this before it
        // recurses), so {=$slug}-interpolated srcs and {{t.art.posts.{=$key}...}}
        // tokens become concrete and followable.
        if (params) {
            for (const [k, v] of Object.entries(params)) html = html.split(`{=$${k}}`).join(v);
        }
        // Collect tokens, then nested loads (with their params), before recursing:
        // each exec loop on a shared /g regex must finish before the next call.
        let m;
        T_RE.lastIndex = 0;
        while ((m = T_RE.exec(html))) keys.add(m[1]);
        const loads = [];
        LOAD_TAG_RE.lastIndex = 0;
        while ((m = LOAD_TAG_RE.exec(html))) {
            const attrs = {};
            let a;
            ATTR_RE.lastIndex = 0;
            while ((a = ATTR_RE.exec(m[1]))) attrs[a[1]] = a[2];
            const src = attrs.src;
            if (!src || src.includes("{=$")) continue; // missing/unresolved src
            delete attrs.src;
            loads.push([src, attrs]);
        }
        for (const [src, attrs] of loads) visit(src, attrs);
    };
    visit(entryRel, null);
    return { files: [...files], keys: [...keys] };
}

// The meta.json keys a STATIC page renders into <title>/description/og. (Article
// posts carry no meta.json entry — their title/description/dates/section/tags
// live in the .post.json record, tracked as a file in pageLastMod — so for a
// post this only tracks the global title/description fallbacks.) pageKey() is the
// shared page-path folding, so it can't drift from the meta plugin's view.
function metaPaths(entryRel, locale, meta) {
    const pageName = pageKey(entryRel);
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

// Shared site furniture that sits in every page's <load> graph (nav bar, icon
// defs, speculation rules). Like CSS/JS, it's chrome, not page content, so a
// tweak to it must not re-date every page's "content last changed". It's still
// walked for the i18n keys it contributes; only its file mtime is dropped.
const CHROME_FILES = new Set([
    "components/waybar.html",
    "components/icons_common.html",
    "components/speculation.html",
]);

// Newest of a page's real inputs (composed HTML files + referenced i18n keys +
// rendered meta keys), or `buildTime` when git can't answer honestly.
export function pageLastMod(root, entryRel, { meta = {}, i18nDir = "i18n", buildTime } = {}) {
    const locale = localeOf(entryRel);
    const { files, keys } = resolveGraph(root, entryRel);
    // An article post's prose + per-post strings live in its content partial and
    // its single-source record; the generated route shell is gitignored (no git
    // date), so the record carries the post's own metadata changes into the date.
    const slug = postSlug(entryRel);
    // The articles index is built from {{article_list}}/{{article_items}} (not a
    // <load> graph the walker sees), so fold every post record's date in — adding
    // or editing a post must freshen the index too.
    const isArticleIndex = /^(?:ru\/)?articles\/index\.html$/.test(entryRel.replace(/\\/g, "/"));
    const postDates = isArticleIndex
        ? Object.keys(loadPosts(root)).map((s) => fileLastMod(`articles/${s}.post.json`))
        : [];
    const candidates = [
        ...files.filter((f) => !CHROME_FILES.has(f)).map(fileLastMod),
        slug ? fileLastMod(`articles/${slug}.post.json`) : null,
        ...postDates,
        jsonSubtreeLastMod(path.posix.join(i18nDir, `${locale}.json`), keys),
        jsonSubtreeLastMod("meta.json", metaPaths(entryRel, locale, meta)),
    ].filter(Boolean);
    if (candidates.length === 0) return buildTime;
    return candidates.reduce((a, b) =>
        new Date(a).getTime() >= new Date(b).getTime() ? a : b
    );
}
