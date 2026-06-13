// Effective per-page metadata resolution, shared by vite-plugin-html-meta.js
// (renders <title>/description/og/article tags) and vite-plugin-i18n-fanout.js
// (exposes {{description}}/{{published}} tokens so inline JSON-LD single-sources
// from the same meta.json the <meta> tags do — they can't drift apart).

// Page key = path relative to root, minus .html, with directory indexes folded
// to the directory ("resume", "articles" from articles/index.html, "ru" from
// ru/index.html, "ru/articles/why-this-blog"). Root index -> null (globals only).
export function pageKey(relPath) {
    let pageName = relPath.replace(/\\/g, "/").replace(/\.html$/, "");
    if (pageName.endsWith("/index")) pageName = pageName.slice(0, -"/index".length);
    if (pageName === "index") pageName = null;
    return pageName;
}

// Resolve a possibly locale-nested value ({ en, ru }) for the current locale,
// falling back to the English value for any unmatched language.
export const pick = (v, locale) =>
    v && typeof v === "object" && !Array.isArray(v) ? v[locale] ?? v.en : v;

// Locale-resolved globals overlaid with the page-specific override block —
// exactly the `meta` object the meta plugin renders from. `meta.title` /
// `meta.description` are already locale-resolved strings; page overrides (which
// are plain, non-locale-nested) win.
export function resolvePageMeta(metaData, relPath, locale) {
    const pageName = pageKey(relPath);
    const overrides = pageName && metaData.pages?.[pageName] ? metaData.pages[pageName] : {};
    const meta = {
        ...metaData,
        title: pick(metaData.title, locale),
        description: pick(metaData.description, locale),
        ...overrides,
    };
    return { pageName, meta };
}
