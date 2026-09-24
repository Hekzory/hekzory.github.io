import fs from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { SITE_ORIGIN, abs, LOCALES } from "./i18n-paths.js";
import { pageLastMod } from "./page-lastmod.js";
import { loadPosts, sortedPosts, postLocaleData, buildPostFigure } from "./post-data.js";
import { resolvePageMeta } from "./meta-resolve.js";

// One Atom 1.0 feed per locale — /feed.xml and /ru/feed.xml — generated from the
// same articles/*.post.json records that drive the index, the post pages and the
// sitemap, so a feed can never list a post the site doesn't have (or miss one it
// does). Entries carry the FULL post body, not just the excerpt: a reader that
// pulls the feed gets the article, and the prose is already a self-contained
// HTML partial.
//
// Dates match the pages exactly: <published> is the record's datePublished,
// <updated> is the same git-derived pageLastMod() the sitemap's <lastmod> and
// the BlogPosting dateModified use.

// XML text/attribute escape. Applied to every interpolated value, including the
// post body — Atom content type="html" is entity-escaped markup, which avoids
// CDATA's "]]>" edge case entirely.
const xml = (s) =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const lookup = (obj, dotted) =>
    dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

// A post's prose partial, resolved the way the page build resolves it, then
// absolutised. Feed readers render this HTML on some other origin, so every
// root-relative href/src has to carry the site origin or it points at the
// reader. Mirrors vite-plugin-i18n-fanout's token families.
function renderProse(root, rel, record, locale, dict) {
    let html = readFileSync(path.resolve(root, rel), "utf-8");
    html = html.replace(/\{\{t\.([\w.]+)\}\}/g, (m, key) => {
        const v = lookup(dict, key);
        return v == null ? m : String(v);
    });
    html = html.replace(/\{\{article_figure\}\}/g, buildPostFigure(record, locale));
    html = html.replace(/\{\{base\}\}/g, locale === "ru" ? "/ru" : "");
    // "/foo" -> "https://tsv.one/foo"; protocol-relative "//host" is left alone.
    html = html.replace(/(\s(?:href|src)=")\/(?!\/)/g, `$1${SITE_ORIGIN}/`);
    // Same fail-loud rule the page build uses: a token still standing here means
    // a typo'd key or a new prose token nobody taught the feed about, and it
    // would otherwise ship visibly broken into people's readers.
    const unresolved = html.match(/\{\{[^}]+\}\}/g);
    if (unresolved) {
        throw new Error(
            `[feed] ${rel}: unresolved template token(s) ${[...new Set(unresolved)].join(", ")}`
        );
    }
    return html.trim();
}

export default function feedPlugin({ outDir = "dist", i18nDir = "i18n" } = {}) {
    let root = process.cwd();
    return {
        name: "vite-plugin-feed",
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
                /* meta.json optional; the feed falls back to bare defaults */
            }
            const posts = loadPosts(root);
            const authorEmail = meta.authorEmail;

            for (const locale of LOCALES) {
                // Same resolution as og:site_name in vite-plugin-html-meta.js.
                const author = meta.locales?.[locale]?.siteName || meta.siteName || "";
                const base = locale === "ru" ? "/ru" : "";
                const dict = JSON.parse(
                    readFileSync(path.resolve(root, i18nDir, `${locale}.json`), "utf-8")
                );
                const indexRel = `${locale === "ru" ? "ru/" : ""}articles/index.html`;
                const { meta: indexMeta } = resolvePageMeta(meta, indexRel, locale);

                const entries = [];
                const updatedDates = [];
                for (const record of sortedPosts(posts)) {
                    // A post exists in a locale only if its prose does — the same
                    // rule generateShells() uses, so a single-language post shows
                    // up in exactly one feed instead of 404ing from the other.
                    const proseRel = `${base ? "ru/" : ""}articles/content/${record.slug}.html`;
                    if (!existsSync(path.resolve(root, proseRel))) continue;

                    const d = postLocaleData(record, locale);
                    const url = abs(`${base}/articles/${record.slug}`);
                    const updated = pageLastMod(root, `${base ? "ru/" : ""}articles/${record.slug}.html`, {
                        meta,
                        i18nDir,
                        buildTime,
                    });
                    updatedDates.push(updated);
                    const categories = d.tags
                        .map((t) => `\n    <category term="${xml(t)}"/>`)
                        .join("");
                    entries.push(
                        `  <entry>\n` +
                            `    <title>${xml(d.title)}</title>\n` +
                            `    <id>${xml(url)}</id>\n` +
                            `    <link rel="alternate" type="text/html" href="${xml(url)}"/>\n` +
                            `    <published>${xml(d.datePublished)}</published>\n` +
                            `    <updated>${xml(updated)}</updated>\n` +
                            `    <summary type="text">${xml(d.description)}</summary>` +
                            categories +
                            `\n    <content type="html">${xml(
                                renderProse(root, proseRel, record, locale, dict)
                            )}</content>\n` +
                            `  </entry>`
                    );
                }

                // Feed-level <updated> is the freshest entry; empty feeds fall back
                // to build time so the element is never missing (Atom requires it).
                const latest = updatedDates.length
                    ? updatedDates.reduce((a, b) => (new Date(a) >= new Date(b) ? a : b))
                    : buildTime;

                const self = abs(`${base}/feed.xml`);
                const altLocale = locale === "ru" ? "en" : "ru";
                const altSelf = abs(`${locale === "ru" ? "" : "/ru"}/feed.xml`);

                const doc =
                    `<?xml version="1.0" encoding="utf-8"?>\n` +
                    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${locale}">\n` +
                    `  <title>${xml(indexMeta.title)}</title>\n` +
                    `  <subtitle>${xml(indexMeta.description)}</subtitle>\n` +
                    `  <id>${xml(self)}</id>\n` +
                    `  <link rel="self" type="application/atom+xml" href="${xml(self)}"/>\n` +
                    `  <link rel="alternate" type="text/html" hreflang="${locale}" href="${xml(
                        abs(`${base}/articles/`)
                    )}"/>\n` +
                    `  <link rel="alternate" type="application/atom+xml" hreflang="${altLocale}" href="${xml(
                        altSelf
                    )}"/>\n` +
                    `  <updated>${xml(latest)}</updated>\n` +
                    `  <author>\n` +
                    `    <name>${xml(author)}</name>\n` +
                    `    <uri>${xml(abs("/"))}</uri>\n` +
                    (authorEmail ? `    <email>${xml(authorEmail)}</email>\n` : "") +
                    `  </author>\n` +
                    `  <icon>${xml(abs("/favicon.svg"))}</icon>\n` +
                    `  <logo>${xml(abs("/face.webp"))}</logo>\n` +
                    entries.join("\n") +
                    `\n</feed>\n`;

                const out = path.resolve(outDir, base ? "ru/feed.xml" : "feed.xml");
                await fs.mkdir(path.dirname(out), { recursive: true });
                await fs.writeFile(out, doc, "utf-8");
            }
        },
    };
}
