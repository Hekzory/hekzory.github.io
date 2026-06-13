import fs from "fs/promises";
import path from "path";
import { Window } from "happy-dom";
import { siblings, localeOf, abs } from "./i18n-paths.js";

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

    // Resolve a possibly locale-nested value ({ en, ru }) for the current locale.
    const pick = (v, locale) =>
        v && typeof v === "object" && !Array.isArray(v) ? v[locale] ?? v.en : v;

    let root = process.cwd();

    return {
        name: "vite-plugin-html-meta",
        configResolved(config) {
            root = config.root;
        },
        async transformIndexHtml(html, ctx) {
            const metaData = JSON.parse(await fs.readFile(path.resolve(metaFile), encoding));

            // Page key = path relative to root, minus .html, with directory
            // indexes folded to the directory (e.g. "resume", "articles" from
            // articles/index.html, "ru" from ru/index.html, "ru/articles/why-this-blog").
            // Root index -> null (uses locale-resolved global defaults).
            const rel = ctx.filename ? path.relative(root, ctx.filename).replace(/\\/g, "/") : "index.html";
            let pageName = rel.replace(/\.html$/, "");
            if (pageName.endsWith("/index")) pageName = pageName.slice(0, -"/index".length);
            if (pageName === "index") pageName = null;

            // English is the default locale at the root; Russian lives under /ru/.
            const locale = localeOf(rel);
            const sib = siblings(rel);
            const url = abs(sib.clean);

            // Merge locale-resolved globals + page-specific overrides.
            const pageOverrides = pageName && metaData.pages?.[pageName] ? metaData.pages[pageName] : {};
            const meta = {
                ...metaData,
                title: pick(metaData.title, locale),
                description: pick(metaData.description, locale),
                ...pageOverrides,
            };

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

            // Update or set title if none present
            const t = document.head.querySelector("title") || document.createElement("title");
            t.textContent = meta.title;
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
            insertMetaTag(document, "description", meta.description);
            insertMetaTag(document, "og:site_name", siteName, true); // Locale-resolved site name
            insertMetaTag(document, "og:title", meta.title, true);
            insertMetaTag(document, "og:description", meta.description, true);
            insertMetaTag(document, "og:url", url, true);
            insertMetaTag(document, "og:image", meta.image || metaData.image, true);
            // Optional og:image refinements — emitted only when defined so a card
            // never ships content="undefined". Dimensions/type let scrapers render
            // the card without first fetching the image.
            const imageType = meta.imageType || metaData.imageType;
            const imageWidth = meta.imageWidth || metaData.imageWidth;
            const imageHeight = meta.imageHeight || metaData.imageHeight;
            const imageAlt = meta.imageAlt || metaData.imageAlt;
            if (imageType) insertMetaTag(document, "og:image:type", imageType, true);
            if (imageWidth) insertMetaTag(document, "og:image:width", imageWidth, true);
            if (imageHeight) insertMetaTag(document, "og:image:height", imageHeight, true);
            if (imageAlt) insertMetaTag(document, "og:image:alt", imageAlt, true);
            insertMetaTag(document, "og:type", meta.type || metaData.type, true);
            // Profile-specific OG tags — emitted only when og:type is "profile"
            // so non-profile pages (e.g. 404) never ship stray profile:* tags.
            if ((meta.type || metaData.type) === "profile") {
                const firstName = meta.profileFirstName || metaData.profileFirstName;
                const lastName = meta.profileLastName || metaData.profileLastName;
                const username = meta.profileUsername || metaData.profileUsername;
                if (firstName) insertMetaTag(document, "profile:first_name", firstName, true);
                if (lastName) insertMetaTag(document, "profile:last_name", lastName, true);
                if (username) insertMetaTag(document, "profile:username", username, true);
            }
            insertMetaTag(document, "og:locale", ogLocale, true);
            insertMetaTag(document, "og:locale:alternate", ogLocaleAlt, true);
            insertMetaTag(document, "theme-color", meta.themeColor || metaData.themeColor);

            // Color scheme hint (helps UA pick native UI colors)
            insertMetaTag(document, "color-scheme", meta.colorScheme || metaData.colorScheme || "dark");

            // Twitter card (uses same meta values by default)
            insertMetaTag(document, "twitter:card", meta.twitterCard || metaData.twitterCard || "summary_large_image");
            insertMetaTag(document, "twitter:title", meta.title);
            insertMetaTag(document, "twitter:description", meta.description);
            insertMetaTag(document, "twitter:image", meta.image || metaData.image);
            if (imageAlt) insertMetaTag(document, "twitter:image:alt", imageAlt);
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

            // Reciprocal hreflang cluster. x-default points at the English version,
            // which doubles as the neutral fallback. Skipped for noindex pages so
            // we never advertise a page we've asked crawlers to drop.
            if (indexable) {
                insertAlternate(document, "en", abs(sib.enPath));
                insertAlternate(document, "ru", abs(sib.ruPath));
                insertAlternate(document, "x-default", abs(sib.xdefault));
            }

            return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
        },
    };
}
