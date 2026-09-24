import fs from "fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "path";
import { siblings, localeOf, abs, availableLocales } from "./i18n-paths.js";
import { resolvePageMeta, pick } from "./meta-resolve.js";
import { pageLastMod } from "./page-lastmod.js";
import { loadPosts, postSlug, postLocaleData } from "./post-data.js";

// Dev server only. Vite's client injects JS-imported CSS as <style> elements
// and keeps an HMR WebSocket open; neither passes the production policy, and a
// blocked <style> fails silently (the terminal drawer just rendered unstyled).
// The client stamps whatever nonce it finds in <meta property="csp-nonce"> on
// everything it injects, so a per-request nonce keeps dev on the production
// policy's shape instead of 'unsafe-inline'. Never reaches the build.
function devCsp(csp, nonce) {
    const directives = new Map();
    for (const d of csp.split(";")) {
        const [name, ...values] = d.trim().split(/\s+/);
        if (name) directives.set(name, values);
    }
    // Extend a directive, seeding a missing one from default-src.
    const allow = (name, ...extra) => {
        const base = directives.get(name) ?? directives.get("default-src") ?? [];
        directives.set(name, [...new Set([...base.filter((v) => v !== "'none'"), ...extra])]);
    };
    allow("style-src", `'nonce-${nonce}'`);
    allow("connect-src", "'self'", "ws:", "wss:");
    return [...directives].map(([name, values]) => [name, ...values].join(" ")).join("; ");
}

// <title> text. The one piece of markup written by hand: Vite escapes the
// attribute values of the tags it injects.
const escapeText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function htmlMetaPlugin(options = {}) {
    const {
        metaFile = "meta.json",
        encoding = "utf-8",
        defaultViewport = "width=device-width,initial-scale=1",
        defaultCharset = "utf-8",
    } = options;

    let root = process.cwd();
    let isDev = false;

    return {
        name: "vite-plugin-html-meta",
        configResolved(config) {
            root = config.root;
            isDev = config.command === "serve";
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

            // Per-locale override (locales.ru.siteName: the name in Cyrillic, which
            // is what Russian-language search matches), else the global one.
            const siteName =
                metaData.locales?.[locale]?.siteName || metaData.siteName || pick(metaData.title, locale);
            const altLocale = locale === "ru" ? "en" : "ru";
            const ogLocale = metaData.locales?.[locale]?.ogLocale || (locale === "ru" ? "ru_RU" : "en_US");
            const ogLocaleAlt = metaData.locales?.[altLocale]?.ogLocale || (altLocale === "ru" ? "ru_RU" : "en_US");
            const robots = meta.robots;
            const indexable = !(robots && /noindex/i.test(robots));

            // The templates are the project's own: their <head> has placeholders
            // for <html lang>, <title> and the viewport, rewritten in place below
            // (not fixed in the templates: for static pages the template is
            // content, so editing it would move their sitemap <lastmod>), and no
            // other meta. Everything else is a tag descriptor that Vite serialises
            // and injects: "head-prepend" right after <head>, "head" right before
            // </head> (i.e. after the entry's script and stylesheet).
            const tags = [];
            const add = (tag, attrs, injectTo = "head") => tags.push({ tag, attrs, injectTo });
            const name = (key, content) => add("meta", { name: key, content });
            const property = (key, content) => add("meta", { property: key, content });

            // RDFa prefix declarations for the OGP vocabularies this page emits.
            // Strict validators (e.g. Yandex) don't assume the article:/profile:
            // prefixes, so declare exactly the ones used — og: is always present,
            // the others mirror the conditional article:/profile:* tag blocks below.
            const prefixes = ["og: https://ogp.me/ns#"];
            if (type === "article") prefixes.push("article: https://ogp.me/ns/article#");
            if (type === "profile") prefixes.push("profile: https://ogp.me/ns/profile#");

            // <title>/og:title: an article reads its record's title (single-sourced
            // with the <h1> and JSON-LD headline); every other page uses its
            // resolved meta.json title.
            const pageTitle = pd ? `${pd.title} | ${siteName}` : meta.title;

            // Per-locale lang plus the prefix list (any other <html> attribute is
            // kept), the title and the viewport. Function replacements, so a "$"
            // in a title is never read as a replacement pattern.
            html = html
                .replace(/<html\b([^>]*)>/i, (_, attrs) =>
                    `<html${attrs.replace(/\s+(?:lang|prefix)="[^"]*"/gi, "")} lang="${locale}" prefix="${prefixes.join(" ")}">`
                )
                .replace(/<title>[^<]*<\/title>/i, () => `<title>${escapeText(pageTitle)}</title>`)
                .replace(/<meta name="viewport"[^>]*>/i, () => `<meta name="viewport" content="${defaultViewport}">`);

            // First in <head>, in this order: the charset, then the two policies,
            // which only govern what comes after them. Both ship as meta tags
            // because GitHub Pages cannot send custom HTTP headers (frame-ancestors
            // is ignored in meta CSP, so it's omitted); both overridable via
            // meta.json.
            add("meta", { charset: defaultCharset }, "head-prepend");
            const referrer = meta.referrer || metaData.referrer;
            if (referrer) add("meta", { name: "referrer", content: referrer }, "head-prepend");
            let csp = meta.csp || metaData.csp;
            if (csp && isDev) {
                const nonce = randomBytes(16).toString("base64");
                csp = devCsp(csp, nonce);
                add("meta", { property: "csp-nonce", nonce });
            }
            if (csp) add("meta", { "http-equiv": "Content-Security-Policy", content: csp }, "head-prepend");

            // Crawler directives, only when a page opts in (e.g. 404).
            if (robots) name("robots", robots);

            // Basic metatags for proper presentation on the web
            name("description", description);
            property("og:site_name", siteName); // Locale-resolved site name
            property("og:title", pageTitle);
            property("og:description", description);
            property("og:url", url);
            // og:image — only on pages that honestly own a preview (see showImage).
            // Refinements emitted only when defined so a card never ships
            // content="undefined"; dimensions/type let scrapers render the card
            // without first fetching the image.
            if (showImage) {
                property("og:image", imageUrl);
                if (imageType) property("og:image:type", imageType);
                if (imageWidth) property("og:image:width", imageWidth);
                if (imageHeight) property("og:image:height", imageHeight);
                if (imageAlt) property("og:image:alt", imageAlt);
            }
            property("og:type", type);
            // Profile-specific OG tags — emitted only when og:type is "profile"
            // so non-profile pages (e.g. 404) never ship stray profile:* tags.
            if (type === "profile") {
                const firstName = meta.profileFirstName || metaData.profileFirstName;
                const lastName = meta.profileLastName || metaData.profileLastName;
                const username = meta.profileUsername || metaData.profileUsername;
                if (firstName) property("profile:first_name", firstName);
                if (lastName) property("profile:last_name", lastName);
                if (username) property("profile:username", username);
            }
            // Article-specific OG tags — emitted only when og:type is "article" so
            // non-article pages never ship stray article:* tags. published/section/
            // tags come from the post record; modified is the same git "content last
            // changed" date the sitemap <lastmod> and {{modified}} use.
            if (type === "article") {
                const buildTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
                const modified = pageLastMod(root, rel, { meta: metaData, buildTime });
                if (pd.datePublished) property("article:published_time", pd.datePublished);
                if (modified) property("article:modified_time", modified);
                // Author as the canonical profile URL (matches the JSON-LD #person url).
                property("article:author", abs("/"));
                if (pd.section) property("article:section", pd.section);
                for (const tag of pd.tags || []) property("article:tag", tag);
            }
            property("og:locale", ogLocale);
            // Only advertise the alternate locale when it actually exists.
            if (have[altLocale]) property("og:locale:alternate", ogLocaleAlt);
            name("theme-color", meta.themeColor || metaData.themeColor);

            // Color scheme hint (helps UA pick native UI colors)
            name("color-scheme", meta.colorScheme || metaData.colorScheme || "dark");

            // Twitter card (uses same meta values by default)
            name("twitter:card", meta.twitterCard || metaData.twitterCard || "summary_large_image");
            name("twitter:title", pageTitle);
            name("twitter:description", description);
            if (showImage) {
                name("twitter:image", imageUrl);
                if (imageAlt) name("twitter:image:alt", imageAlt);
            }
            // twitter:site requires an @username; only emit when one is configured.
            const twitterSite = meta.twitterSite || metaData.twitterSite;
            if (twitterSite) name("twitter:site", twitterSite);

            // Canonical link (self-referential, derived from path)
            add("link", { rel: "canonical", href: url });

            // Reciprocal hreflang cluster — only for locales that actually ship a
            // page (a single-language post lists just its own + x-default). Skipped
            // for noindex pages so we never advertise a page we've asked crawlers to
            // drop. x-default points at English when present, else the locale that is.
            if (indexable) {
                const alternate = (hreflang, href) => add("link", { rel: "alternate", hreflang, href });
                if (have.en) alternate("en", abs(sib.enPath));
                if (have.ru) alternate("ru", abs(sib.ruPath));
                alternate("x-default", abs(have.en ? sib.enPath : sib.ruPath));
            }

            return { html, tags };
        },
    };
}
