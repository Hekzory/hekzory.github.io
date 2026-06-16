// Shared locale + URL helpers for the bilingual build (i18n fan-out, meta, sitemap).
// English is the default locale and lives at the root (/, /resume, /articles/...);
// Russian lives under /ru/. Keeping the path math in one place guarantees the
// hreflang clusters emitted by the meta plugin and the sitemap can never disagree.

export const SITE_ORIGIN = "https://tsv.one";
export const LOCALES = ["en", "ru"];
export const DEFAULT_LOCALE = "en";

// The directories scanned for *.html build entries, across both language trees.
// Single-sourced here so vite.config.js (build inputs) and vite-plugin-sitemap.js
// (sitemap URLs) can never drift — adding a tree means editing one list.
export const PAGE_DIRS = ["", "articles", "ru", "ru/articles"];

// `relPath` is a build entry's path relative to the project root, posix-style:
// "index.html", "resume.html", "articles/why-this-blog.html",
// "ru/index.html", "ru/articles/why-this-blog.html".

export function localeOf(relPath) {
    const p = relPath.replace(/\\/g, "/");
    return p === "ru" || p.startsWith("ru/") ? "ru" : "en";
}

// Clean, origin-relative URL for an entry: drop .html, fold directory indexes.
// index.html -> "/", resume.html -> "/resume", articles/index.html -> "/articles/",
// ru/index.html -> "/ru/", ru/articles/why-this-blog.html -> "/ru/articles/why-this-blog".
export function cleanUrl(relPath) {
    let p = relPath.replace(/\\/g, "/").replace(/\.html$/, "");
    if (p === "index") return "/";
    if (p.endsWith("/index")) return "/" + p.slice(0, -"index".length); // keep trailing slash
    return "/" + p;
}

// Logical (locale-stripped) path == the English/root form of a clean URL.
export function stripLocale(cleanPath) {
    if (cleanPath === "/ru/") return "/";
    if (cleanPath.startsWith("/ru/")) return "/" + cleanPath.slice("/ru/".length);
    return cleanPath;
}

export function enHref(logical) {
    return logical; // English is unprefixed at the root
}

export function ruHref(logical) {
    return logical === "/" ? "/ru/" : "/ru" + logical;
}

// Inverse of cleanUrl for the English/root tree: a logical clean URL -> the
// source file it builds from. "/" -> "index.html", "/resume" -> "resume.html",
// "/articles/" -> "articles/index.html", "/articles/x" -> "articles/x.html".
export function logicalToFile(logical) {
    if (logical === "/") return "index.html";
    if (logical.endsWith("/")) return logical.slice(1) + "index.html";
    return logical.slice(1) + ".html";
}

// Source file (relative to root) for each locale's counterpart of an entry.
// The ru/ tree mirrors the en tree 1:1, so the ru file is just "ru/" + en file.
export function siblingFiles(relPath) {
    const logical = stripLocale(cleanUrl(relPath));
    const en = logicalToFile(logical);
    return { en, ru: "ru/" + en };
}

// Which locales actually have a built page for this entry, given an existence
// predicate (callers pass one bound to the build root). A single-language
// article has no twin, so its absent locale must be dropped from hreflang /
// og:locale:alternate / sitemap alternates rather than advertised as a 404.
export function availableLocales(relPath, exists) {
    const f = siblingFiles(relPath);
    return { en: exists(f.en), ru: exists(f.ru) };
}

// Full sibling set for a build entry. xdefault points at the English version,
// which doubles as the neutral fallback for unmatched languages.
export function siblings(relPath) {
    const clean = cleanUrl(relPath);
    const locale = localeOf(relPath);
    const logical = stripLocale(clean);
    const enPath = enHref(logical);
    const ruPath = ruHref(logical);
    return { locale, clean, logical, enPath, ruPath, xdefault: enPath };
}

export const abs = (p) => SITE_ORIGIN + p;

// Visible breadcrumb trail for a build entry, as structured data (no markup —
// breadcrumb.js renders it). It's a pure function of the route: the locale-
// stripped clean URL's path segments become the crumbs. The root is "~" and
// links home; each ancestor segment links to its container (trailing slash); the
// final segment is the current page and carries no href. `base` is the in-locale
// link prefix ("" for en, "/ru" for ru) so the links never cross locales.
// "/" -> [~]; "/resume" -> [~, resume]; "/articles/" -> [~, articles];
// "/articles/x" -> [~, articles, x]; "/404" -> [~, 404].
export function crumbTrail(relPath, base = "") {
    const logical = stripLocale(cleanUrl(relPath));
    const segments = logical.split("/").filter(Boolean);
    // Home is just the root crumb, marked current by having no href.
    if (!segments.length) return [{ label: "~" }];
    const trail = [{ label: "~", href: `${base}/` }];
    segments.forEach((seg, i) => {
        const last = i === segments.length - 1;
        const href = last ? undefined : `${base}/${segments.slice(0, i + 1).join("/")}/`;
        trail.push({ label: seg, href });
    });
    return trail;
}
