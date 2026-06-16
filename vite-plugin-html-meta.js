import fs from "fs/promises";
import { existsSync } from "node:fs";
import path from "path";
import { Window } from "happy-dom";
import { siblings, localeOf, abs, availableLocales } from "./i18n-paths.js";
import { resolvePageMeta, pick } from "./meta-resolve.js";
import { pageLastMod } from "./page-lastmod.js";
import { loadPosts, postSlug, postLocaleData } from "./post-data.js";

export default function htmlMetaPlugin(options = {}) {
    const {
        metaFile = "meta.json",
        encoding = "utf-8",
        defaultViewport = "width=device-width,initial-scale=1",
        defaultCharset = "utf-8",
    } = options;

    // Helper function to create or update a meta tag
    const insertMetaTag = (document, name, content, property = false) => {
        let meta = document.head.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute(property ? "property" : "name", name);
            document.head.appendChild(meta);
        }
        meta.setAttribute("content", content);
    };

    // Append an alternate-link (hreflang cluster).
    const insertAlternate = (document, hreflang, href) => {
        const link = document.createElement("link");
        link.setAttribute("rel", "alternate");
        link.setAttribute("hreflang", hreflang);
        link.setAttribute("href", href);
        document.head.appendChild(link);
    };

    let root = process.cwd();

    return {
        name: "vite-plugin-html-meta",
        configResolved(config) {
            root = config.root;
        },
        async transformIndexHtml(html, ctx) {
            const metaData = JSON.parse(await fs.readFile(path.resolve(metaFile), encoding));

            // English is the default locale at the root; Russian lives under /ru/.
            const rel = ctx.filename ? path.relative(root, ctx.filename).replace(/\\/g, "/") : "index.html";
            const locale = localeOf(rel);
            const sib = siblings(rel);
            const url = abs(sib.clean);

            // Effective metadata: locale-resolved globals overlaid with the
            // page-specific override block (shared with the i18n-fanout tokens, so
            // <meta> and inline JSON-LD single-source the same values).
            const { pageName, meta } = resolvePageMeta(metaData, rel, locale);

            // Which locales actually ship a page for this URL. A single-language
            // post (or the dropped ru 404) must not advertise a twin that 404s.
            const have = availableLocales(rel, (f) => existsSync(path.resolve(root, f)));

            // Article posts are driven by their single-source record
            // (articles/<slug>.post.json), not by a meta.json "pages" entry.
            const slug = postSlug(rel);
            const post = slug ? loadPosts(root)[slug] : null;
            const pd = post ? postLocaleData(post, locale) : null;
            const type = pd ? "article" : meta.type || metaData.type;
            const description = pd ? pd.description : meta.description;

            // The OG preview (preview.png) is a screenshot of the home page, so it's
            // only honest there. A post carries its own preview in its record
            // ("image"); any other page can opt in via a meta.json "image". We never
            // fabricate one.
            const isHome = sib.clean === "/" || sib.clean === "/ru/";
            const postImage = post?.image?.src ? post.image : null;
            const showImage = isHome || !!postImage || !!(pageName && metaData.pages?.[pageName]?.image);

            // Resolved card-image fields. A post's come from its record (src made
            // absolute, alt locale-resolved, falling back to the title); every other
            // page uses its page override, then the global default.
            const imageUrl = postImage ? abs(postImage.src) : meta.image || metaData.image;
            const imageType = postImage?.type || meta.imageType || metaData.imageType;
            const imageWidth = postImage?.width || meta.imageWidth || metaData.imageWidth;
            const imageHeight = postImage?.height || meta.imageHeight || metaData.imageHeight;
            const imageAlt = postImage ? pick(postImage.alt, locale) || pd.title : meta.imageAlt || metaData.imageAlt;

            const siteName = metaData.siteName || pick(metaData.title, locale);
            const altLocale = locale === "ru" ? "en" : "ru";
            const ogLocale = metaData.locales?.[locale]?.ogLocale || (locale === "ru" ? "ru_RU" : "en_US");
            const ogLocaleAlt = metaData.locales?.[altLocale]?.ogLocale || (altLocale === "ru" ? "ru_RU" : "en_US");
            const robots = meta.robots;
            const indexable = !(robots && /noindex/i.test(robots));

            const window = new Window();
            const document = window.document;
            document.documentElement.innerHTML = html;

            // Per-locale lang attribute (templates ship a static placeholder value).
            document.documentElement.setAttribute("lang", locale);

            // RDFa prefix declarations for the OGP vocabularies this page emits.
            // Strict validators (e.g. Yandex) don't assume the article:/profile:
            // prefixes, so declare exactly the ones used — og: is always present,
            // the others mirror the conditional article:/profile:* tag blocks below.
            const prefixes = ["og: https://ogp.me/ns#"];
            if (type === "article") prefixes.push("article: https://ogp.me/ns/article#");
            if (type === "profile") prefixes.push("profile: https://ogp.me/ns/profile#");
            document.documentElement.setAttribute("prefix", prefixes.join(" "));

            // <title>/og:title: an article reads its record's title (single-sourced
            // with the <h1> and JSON-LD headline); every other page uses its
            // resolved meta.json title.
            const pageTitle = pd ? `${pd.title} | ${siteName}` : meta.title;

            // Update or set title if none present
            const t = document.head.querySelector("title") || document.createElement("title");
            t.textContent = pageTitle;
            if (!t.parentNode) {
                document.head.insertBefore(t, document.head.firstChild);
            }

            insertMetaTag(document, "viewport", defaultViewport);

            // Ensure charset meta tag is present
            if (!document.head.querySelector("meta[charset]")) {
                const charsetMeta = document.createElement("meta");
                charsetMeta.setAttribute("charset", defaultCharset);
                document.head.insertBefore(charsetMeta, document.head.firstChild);
            }

            // CSP ships as a meta tag because GitHub Pages cannot send custom
            // HTTP headers; frame-ancestors is ignored in meta CSP, so omitted.
            const csp = meta.csp || metaData.csp;
            if (csp) {
                let cspMeta = document.head.querySelector('meta[http-equiv="Content-Security-Policy"]');
                if (!cspMeta) {
                    cspMeta = document.createElement("meta");
                    cspMeta.setAttribute("http-equiv", "Content-Security-Policy");
                    const charsetMeta = document.head.querySelector("meta[charset]");
                    document.head.insertBefore(cspMeta, charsetMeta.nextSibling);
                }
                cspMeta.setAttribute("content", csp);
            }

            // Crawler directives, only when a page opts in (e.g. 404).
            if (robots) {
                insertMetaTag(document, "robots", robots);
            }

            // Basic metatags for proper presentation on the web
            insertMetaTag(document, "description", description);
            insertMetaTag(document, "og:site_name", siteName, true); // Locale-resolved site name
            insertMetaTag(document, "og:title", pageTitle, true);
            insertMetaTag(document, "og:description", description, true);
            insertMetaTag(document, "og:url", url, true);
            // og:image — only on pages that honestly own a preview (see showImage).
            // Refinements emitted only when defined so a card never ships
            // content="undefined"; dimensions/type let scrapers render the card
            // without first fetching the image.
            if (showImage) {
                insertMetaTag(document, "og:image", imageUrl, true);
                if (imageType) insertMetaTag(document, "og:image:type", imageType, true);
                if (imageWidth) insertMetaTag(document, "og:image:width", String(imageWidth), true);
                if (imageHeight) insertMetaTag(document, "og:image:height", String(imageHeight), true);
                if (imageAlt) insertMetaTag(document, "og:image:alt", imageAlt, true);
            }
            insertMetaTag(document, "og:type", type, true);
            // Profile-specific OG tags — emitted only when og:type is "profile"
            // so non-profile pages (e.g. 404) never ship stray profile:* tags.
            if (type === "profile") {
                const firstName = meta.profileFirstName || metaData.profileFirstName;
                const lastName = meta.profileLastName || metaData.profileLastName;
                const username = meta.profileUsername || metaData.profileUsername;
                if (firstName) insertMetaTag(document, "profile:first_name", firstName, true);
                if (lastName) insertMetaTag(document, "profile:last_name", lastName, true);
                if (username) insertMetaTag(document, "profile:username", username, true);
            }
            // Article-specific OG tags — emitted only when og:type is "article" so
            // non-article pages never ship stray article:* tags. published/section/
            // tags come from the post record; modified is the same git "content last
            // changed" date the sitemap <lastmod> and {{modified}} use.
            if (type === "article") {
                const buildTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
                const modified = pageLastMod(root, rel, { meta: metaData, buildTime });
                if (pd.datePublished) insertMetaTag(document, "article:published_time", pd.datePublished, true);
                if (modified) insertMetaTag(document, "article:modified_time", modified, true);
                // Author as the canonical profile URL (matches the JSON-LD #person url).
                insertMetaTag(document, "article:author", abs("/"), true);
                if (pd.section) insertMetaTag(document, "article:section", pd.section, true);
                // article:tag repeats; the name-keyed dedup helper would collapse
                // them, so append each as a fresh element.
                for (const tag of pd.tags || []) {
                    const t = document.createElement("meta");
                    t.setAttribute("property", "article:tag");
                    t.setAttribute("content", tag);
                    document.head.appendChild(t);
                }
            }
            insertMetaTag(document, "og:locale", ogLocale, true);
            // Only advertise the alternate locale when it actually exists.
            if (have[altLocale]) insertMetaTag(document, "og:locale:alternate", ogLocaleAlt, true);
            insertMetaTag(document, "theme-color", meta.themeColor || metaData.themeColor);

            // Color scheme hint (helps UA pick native UI colors)
            insertMetaTag(document, "color-scheme", meta.colorScheme || metaData.colorScheme || "dark");

            // Twitter card (uses same meta values by default)
            insertMetaTag(document, "twitter:card", meta.twitterCard || metaData.twitterCard || "summary_large_image");
            insertMetaTag(document, "twitter:title", pageTitle);
            insertMetaTag(document, "twitter:description", description);
            if (showImage) {
                insertMetaTag(document, "twitter:image", imageUrl);
                if (imageAlt) insertMetaTag(document, "twitter:image:alt", imageAlt);
            }
            // twitter:site requires an @username; only emit when one is configured.
            const twitterSite = meta.twitterSite || metaData.twitterSite;
            if (twitterSite) insertMetaTag(document, "twitter:site", twitterSite);

            // Update or create canonical link (self-referential, derived from path)
            let canonical = document.head.querySelector('link[rel="canonical"]');
            if (!canonical) {
                canonical = document.createElement("link");
                canonical.setAttribute("rel", "canonical");
                document.head.appendChild(canonical);
            }
            canonical.setAttribute("href", url);

            // Reciprocal hreflang cluster — only for locales that actually ship a
            // page (a single-language post lists just its own + x-default). Skipped
            // for noindex pages so we never advertise a page we've asked crawlers to
            // drop. x-default points at English when present, else the locale that is.
            if (indexable) {
                if (have.en) insertAlternate(document, "en", abs(sib.enPath));
                if (have.ru) insertAlternate(document, "ru", abs(sib.ruPath));
                insertAlternate(document, "x-default", abs(have.en ? sib.enPath : sib.ruPath));
            }

            return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
        },
    };
}
