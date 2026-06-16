// Single source of truth for articles. One `articles/<slug>.post.json` record
// (bilingual) per post drives everything: the build entry shells, the index
// list + its JSON-LD, each post's <title>/og/article meta, the inline
// BlogPosting JSON-LD, and the git "content last changed" date. Adding a post is
// three files — the record plus articles/content/<slug>.html and its ru/ twin —
// with no value duplicated anywhere. Shared by vite.config (shell generation),
// the i18n-fanout, the meta plugin, and page-lastmod.

import { readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { pick } from "./meta-resolve.js";

// Slugs become filesystem paths, URL segments, an HTML attribute, and JSON-LD
// strings, so we constrain them at load time — one guard covers every sink.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// HTML text / double-quoted-attribute escape for record strings.
const esc = (s) =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// Make an already-stringified JSON blob safe to sit inside a <script> element:
// escape "<" (0x3c, so "</script>" can't close it early) and the two JS line
// separators (0x2028/0x2029). All stay valid JSON — the \uXXXX escapes parse
// back. Codepoints are compared numerically so no literal control char appears
// in this source.
const scriptSafe = (json) =>
    json.replace(/[\s\S]/g, (c) => {
        const n = c.charCodeAt(0);
        return n === 0x3c || n === 0x2028 || n === 0x2029
            ? "\\u" + n.toString(16).padStart(4, "0")
            : c;
    });

// All posts as { slug: record }, read fresh from articles/*.post.json. The
// records are tiny and few, so we don't cache (keeps `vite dev` honest when a
// record is edited). slug defaults to the filename if the record omits it, and
// is validated so it can never break a path, attribute, URL, or JSON-LD string.
export function loadPosts(root) {
    const dir = path.resolve(root, "articles");
    const out = {};
    let files = [];
    try {
        files = readdirSync(dir).filter((f) => f.endsWith(".post.json"));
    } catch {
        return out;
    }
    for (const f of files) {
        const fallback = f.slice(0, -".post.json".length);
        let rec;
        try {
            rec = JSON.parse(readFileSync(path.join(dir, f), "utf-8"));
        } catch (e) {
            throw new Error(`[posts] ${f}: ${e.message}`);
        }
        rec.slug = rec.slug || fallback;
        if (!SLUG_RE.test(rec.slug)) {
            throw new Error(`[posts] ${f}: invalid slug "${rec.slug}" (use lowercase letters, digits, and hyphens)`);
        }
        out[rec.slug] = rec;
    }
    return out;
}

// Slug for an article *post* entry path ("articles/<slug>.html" or its ru twin),
// else null (the index and every non-article page resolve to null).
export function postSlug(rel) {
    const m = rel.replace(/\\/g, "/").match(/^(?:ru\/)?articles\/([^/]+)\.html$/);
    if (!m || m[1] === "index") return null;
    return m[1];
}

// The record's per-locale fields flattened for one locale.
export function postLocaleData(record, locale) {
    const loc = record[locale] || record.en || {};
    return {
        title: loc.title ?? "",
        excerpt: loc.excerpt ?? "",
        description: loc.description ?? "",
        section: pick(record.section, locale) ?? "",
        tags: pick(record.tags, locale) ?? [],
        datePublished: record.datePublished ?? null,
    };
}

// HTML-escaped post tokens for the article template's text/attribute sinks
// (<h1>{{title}}</h1>, <time datetime="{{published}}">{{date}}</time>), so a
// record string can't inject markup. The JSON-LD path is handled separately by
// buildPostJsonLd (JSON-encoded), never by raw token substitution.
export function postHtmlTokens(record, locale) {
    const d = postLocaleData(record, locale);
    return {
        title: esc(d.title),
        date: esc(displayDate(d.datePublished, locale)),
        published: esc(d.datePublished ?? ""),
    };
}

// The in-body <figure> for a post, built from the record's optional `image`
// (single-sourced with the og:image + JSON-LD ImageObject). Emitted where the
// prose drops the {{article_figure}} token, so the author controls placement;
// "" for a post without an image. alt/caption are locale-resolved; src/alt/
// caption are HTML-escaped, and width/height (from the record) curb upscaling and
// reserve space (no layout shift). loading=lazy since figures sit below the fold.
export function buildPostFigure(record, locale) {
    const img = record.image;
    if (!img || !img.src) return "";
    const alt = pick(img.alt, locale) ?? "";
    const caption = pick(img.caption, locale);
    const dim = (k) => (img[k] ? ` ${k}="${esc(img[k])}"` : "");
    return (
        `<figure class="article-figure">` +
        `<img src="${esc(img.src)}"${dim("width")}${dim("height")} alt="${esc(alt)}" loading="lazy" decoding="async" />` +
        (caption ? `<figcaption>${esc(caption)}</figcaption>` : "") +
        `</figure>`
    );
}

// Human display date derived from datePublished, so the calendar date lives in
// exactly one place. We read the YYYY-MM-DD off the ISO string and format it in
// UTC, so the build machine's timezone can never shift the day.
function displayDate(iso, locale) {
    if (!iso) return "";
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });
    // ru-RU yields a trailing " г." — drop it to match the site's house style.
    return fmt.format(date).replace(/\s*г\.$/, "");
}

// Posts newest-first, for listings (ISO dates sort lexically); slug breaks ties
// so equal-date posts have a stable, filesystem-independent order.
function sortedPosts(posts) {
    return Object.values(posts).sort(
        (a, b) =>
            (b.datePublished || "").localeCompare(a.datePublished || "") ||
            a.slug.localeCompare(b.slug)
    );
}

// The <li> cards for the articles index, fully resolved + escaped for one locale.
export function indexCards(posts, locale, base) {
    return sortedPosts(posts)
        .map((rec) => {
            const d = postLocaleData(rec, locale);
            return (
                `<li><a class="tile article-card" href="${base}/articles/${rec.slug}">` +
                `<span class="article-card-meta"><time datetime="${esc(rec.datePublished)}">${esc(
                    displayDate(rec.datePublished, locale)
                )}</time></span>` +
                `<h2 class="article-card-title">${esc(d.title)}</h2>` +
                `<p class="article-card-excerpt">${esc(d.excerpt)}</p></a></li>`
            );
        })
        .join("");
}

// The JSON-LD ItemList entries for the articles index (newest-first). Each item
// is JSON-encoded then script-safed, so a title can never break the JSON or the
// surrounding <script> element. (slug is validated, so the url is safe.)
export function indexItems(posts, locale, origin, base) {
    return sortedPosts(posts)
        .map((rec, i) =>
            scriptSafe(
                JSON.stringify({
                    "@type": "ListItem",
                    position: i + 1,
                    url: `${origin}${base}/articles/${rec.slug}`,
                    name: postLocaleData(rec, locale).title,
                })
            )
        )
        .join(", ");
}

// The complete inline JSON-LD (@graph: BlogPosting + BreadcrumbList) for a post,
// assembled as objects and JSON-encoded so every record string is escaped by
// construction — nothing reaches the page through raw token substitution.
export function buildPostJsonLd({ record, locale, canonical, origin, base, blogName, crumbHome, modified }) {
    const d = postLocaleData(record, locale);
    const person = { "@type": "Person", "@id": `${origin}/#person`, name: "Oleg Tsvetkov" };
    // Optional article image as an ImageObject (absolute url), single-sourced with
    // the og:image and the in-body <figure> from the same record.image.
    const imageObj = record.image?.src
        ? {
              "@type": "ImageObject",
              url: `${origin}${record.image.src}`,
              ...(record.image.width ? { width: record.image.width } : {}),
              ...(record.image.height ? { height: record.image.height } : {}),
          }
        : null;
    const graph = [
        {
            "@type": "BlogPosting",
            "@id": `${canonical}#article`,
            url: canonical,
            headline: d.title,
            description: d.description,
            ...(imageObj ? { image: imageObj } : {}),
            datePublished: d.datePublished,
            dateModified: modified,
            inLanguage: locale,
            author: { ...person, url: `${origin}/` },
            publisher: person,
            isPartOf: {
                "@type": "Blog",
                "@id": `${origin}${base}/articles/#blog`,
                name: blogName,
                url: `${origin}${base}/articles/`,
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        },
        {
            "@type": "BreadcrumbList",
            "@id": `${canonical}#breadcrumb`,
            itemListElement: [
                { "@type": "ListItem", position: 1, name: crumbHome, item: `${origin}${base}/` },
                { "@type": "ListItem", position: 2, name: blogName, item: `${origin}${base}/articles/` },
                { "@type": "ListItem", position: 3, name: d.title },
            ],
        },
    ];
    return scriptSafe(JSON.stringify({ "@context": "https://schema.org", "@graph": graph }));
}

// One-line route shell for an article post. Vite's MPA needs an HTML entry per
// route, and html-inject needs the prose path as a {=$content} param, so we
// generate these from the manifest rather than hand-authoring them (they're
// gitignored). slug feeds the waybar window title.
const shell = (slug, content) =>
    `<load src="templates/article-post.html" slug="${slug}" content="${content}" />\n`;

// Regenerate the per-post route shells from the manifest, pruning any stale ones
// (a deleted record) so the route list always mirrors articles/*.post.json. A
// locale's shell is written only when its prose partial exists, which makes a
// single-language post buildable (the absent locale drops out of hreflang/og/
// sitemap downstream); a record with no prose at all fails loud, naming itself.
// The index shells (articles/index.html, ru/articles/index.html) are real source
// and preserved. Called from vite.config before entries are scanned.
export function generateShells(root) {
    const posts = loadPosts(root);
    for (const dir of ["articles", "ru/articles"]) {
        const abs = path.resolve(root, dir);
        let existing = [];
        try {
            existing = readdirSync(abs);
        } catch {
            continue;
        }
        for (const f of existing) {
            if (f.endsWith(".html") && f !== "index.html") rmSync(path.join(abs, f));
        }
    }
    for (const slug of Object.keys(posts)) {
        const hasEn = existsSync(path.resolve(root, `articles/content/${slug}.html`));
        const hasRu = existsSync(path.resolve(root, `ru/articles/content/${slug}.html`));
        if (!hasEn && !hasRu) {
            throw new Error(`[posts] ${slug}: no prose found (expected articles/content/${slug}.html and/or its ru/ twin)`);
        }
        if (hasEn) writeFileSync(path.resolve(root, `articles/${slug}.html`), shell(slug, `articles/content/${slug}`));
        if (hasRu) writeFileSync(path.resolve(root, `ru/articles/${slug}.html`), shell(slug, `ru/articles/content/${slug}`));
    }
    return Object.keys(posts);
}
