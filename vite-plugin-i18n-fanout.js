import fs from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { localeOf, siblings, abs, availableLocales, SITE_ORIGIN } from "./i18n-paths.js";
import { pageLastMod } from "./page-lastmod.js";
import { loadPosts, postSlug, postHtmlTokens, buildPostJsonLd, indexCards, indexItems } from "./post-data.js";

// Localizes each built page after components are inlined (runs after
// vite-plugin-html-inject's "pre" pass, before the meta plugin). It derives the
// locale from the entry's path (ru/... -> ru, else en), then resolves two token
// families left in the templates/components:
//   {{t.some.dotted.key}}  -> looked up in i18n/<locale>.json
//   {{en_href}} / {{ru_href}} / {{en_active}} / {{ru_active}} / {{base}} / ...
//   {{description}} / {{published}} / {{modified}}  -> computed per page, so inline
//       JSON-LD single-sources from the same meta.json + git lastmod the <meta>
//       tags do (description can't drift; dateModified can't go stale).
// The {{t.*}} form (note the dot) never collides with vite-plugin-html-inject's
// own {=$attr} component-parameter syntax.
export default function i18nFanoutPlugin({ dir = "i18n" } = {}) {
    let root = process.cwd();

    async function loadDict(locale) {
        const raw = await fs.readFile(path.resolve(root, dir, `${locale}.json`), "utf-8");
        return JSON.parse(raw);
    }

    function loadMeta() {
        try {
            return JSON.parse(readFileSync(path.resolve(root, "meta.json"), "utf-8"));
        } catch {
            return {};
        }
    }

    const lookup = (obj, dotted) =>
        dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

    return {
        name: "vite-plugin-i18n-fanout",
        configResolved(config) {
            root = config.root;
        },
        async transformIndexHtml(html, ctx) {
            const rel = path.relative(root, ctx.filename).replace(/\\/g, "/");
            const locale = localeOf(rel);
            const dict = await loadDict(locale);
            const sib = siblings(rel);
            const metaData = loadMeta();
            const posts = loadPosts(root);
            const post = postSlug(rel) ? posts[postSlug(rel)] : null;

            // Only the locales that actually ship a page get a same-locale link;
            // a missing twin (single-language post, or the dropped ru 404) falls
            // back to that locale's home instead of pointing at a URL that 404s.
            const have = availableLocales(rel, (f) => existsSync(path.resolve(root, f)));
            const enHref = have.en ? sib.enPath : "/";
            const ruHref = have.ru ? sib.ruPath : "/ru/";

            const base = locale === "ru" ? "/ru" : "";
            const computed = {
                locale,
                // Prefix for same-locale internal links: "" for en (root), "/ru" for ru.
                // Use as {{base}}/resume -> /resume (en) or /ru/resume (ru); {{base}}/ -> / or /ru/.
                base,
                en_href: enHref,
                ru_href: ruHref,
                // The other locale's counterpart (used by the suggestion banner).
                alt_href: locale === "en" ? ruHref : enHref,
                en_active: locale === "en" ? "active" : "",
                ru_active: locale === "ru" ? "active" : "",
                en_current: locale === "en" ? 'aria-current="page"' : "",
                ru_current: locale === "ru" ? 'aria-current="page"' : "",
                // Absolute helpers, handy for inline JSON-LD in templates.
                origin: SITE_ORIGIN,
                canonical: abs(sib.clean),
            };

            // DATA tokens carry record-derived / generated content (HTML-escaped or
            // JSON-encoded at the source). They're substituted AFTER the unresolved-
            // token guard so a value that legitimately contains "{{...}}" (a post
            // about templating) can't false-trip it.
            const data = {};
            if (post) {
                // <h1>/<time> get HTML-escaped strings; the whole BlogPosting +
                // Breadcrumb JSON-LD is assembled and escaped in post-data, so no
                // record string ever reaches a sink through raw substitution.
                const ht = postHtmlTokens(post, locale);
                data.title = ht.title;
                data.date = ht.date;
                data.published = ht.published;
                const buildTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
                const modified = pageLastMod(root, rel, { meta: metaData, i18nDir: dir, buildTime });
                data.article_ld = buildPostJsonLd({
                    record: post,
                    locale,
                    canonical: computed.canonical,
                    origin: SITE_ORIGIN,
                    base,
                    blogName: lookup(dict, "art.title") ?? "",
                    crumbHome: lookup(dict, "art.crumb_home") ?? "",
                    modified,
                });
            }
            // Articles index: the post cards + their JSON-LD ItemList are generated
            // from the manifest (newest-first), so adding a post needs no edit here.
            if (html.includes("{{article_list}}")) {
                data.article_list = indexCards(posts, locale, base);
                data.article_items = indexItems(posts, locale, SITE_ORIGIN, base);
            }

            // Dictionary tokens first (keys contain dots).
            html = html.replace(/\{\{t\.([\w.]+)\}\}/g, (m, key) => {
                const v = lookup(dict, key);
                if (v == null) {
                    console.warn(`[i18n] missing key "${key}" for locale "${locale}" in ${rel}`);
                    return m;
                }
                return String(v);
            });

            // Structural computed tokens (locale/urls/active states). DATA tokens
            // are deliberately left for the post-guard pass below.
            html = html.replace(/\{\{(\w+)\}\}/g, (m, key) =>
                key in computed ? String(computed[key]) : m
            );

            // Fail loud BEFORE injecting data: any token still here is a genuine
            // miss (typo'd key, missing {=$param}, or a forgotten post field), not
            // record content. Data-token names are expected and excluded.
            const unresolved = (html.match(/\{\{[^}]+\}\}|\{=\$[\w-]+\}/g) || []).filter((tok) => {
                const k = tok.match(/^\{\{(\w+)\}\}$/);
                return !(k && k[1] in data);
            });
            if (unresolved.length) {
                throw new Error(
                    `[i18n] ${rel}: unresolved template token(s) ${[...new Set(unresolved)].join(", ")}. ` +
                        `Check the dictionary key, the computed token name, or the component {=$param}.`
                );
            }

            // Finally inject the data tokens (escaped at the source, so their
            // content is never re-scanned for tokens).
            html = html.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in data ? String(data[key]) : m));

            return html;
        },
    };
}
