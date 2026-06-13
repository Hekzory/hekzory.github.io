// Shared locale + URL helpers for the bilingual build (i18n fan-out, meta, sitemap).
// English is the default locale and lives at the root (/, /resume, /articles/...);
// Russian lives under /ru/. Keeping the path math in one place guarantees the
// hreflang clusters emitted by the meta plugin and the sitemap can never disagree.

export const SITE_ORIGIN = "https://tsv.one";
export const LOCALES = ["en", "ru"];
export const DEFAULT_LOCALE = "en";

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
