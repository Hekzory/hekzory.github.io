import fs from "node:fs/promises";
import path from "node:path";
import { localeOf, siblings, abs, SITE_ORIGIN } from "./i18n-paths.js";

// Localizes each built page after components are inlined (runs after
// vite-plugin-html-inject's "pre" pass, before the meta plugin). It derives the
// locale from the entry's path (ru/... -> ru, else en), then resolves two token
// families left in the templates/components:
//   {{t.some.dotted.key}}  -> looked up in i18n/<locale>.json
//   {{en_href}} / {{ru_href}} / {{en_active}} / {{ru_active}}
//   {{en_current}} / {{ru_current}} / {{locale}}  -> computed per page
// The {{t.*}} form (note the dot) never collides with vite-plugin-html-inject's
// own {=$attr} component-parameter syntax.
export default function i18nFanoutPlugin({ dir = "i18n" } = {}) {
    let root = process.cwd();

    async function loadDict(locale) {
        const raw = await fs.readFile(path.resolve(root, dir, `${locale}.json`), "utf-8");
        return JSON.parse(raw);
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

            const computed = {
                locale,
                // Prefix for same-locale internal links: "" for en (root), "/ru" for ru.
                // Use as {{base}}/resume -> /resume (en) or /ru/resume (ru); {{base}}/ -> / or /ru/.
                base: locale === "ru" ? "/ru" : "",
                en_href: sib.enPath,
                ru_href: sib.ruPath,
                // The other locale's counterpart (used by the suggestion banner).
                alt_href: locale === "en" ? sib.ruPath : sib.enPath,
                en_active: locale === "en" ? "active" : "",
                ru_active: locale === "ru" ? "active" : "",
                en_current: locale === "en" ? 'aria-current="page"' : "",
                ru_current: locale === "ru" ? 'aria-current="page"' : "",
                // Absolute helpers, handy for inline JSON-LD in templates.
                origin: SITE_ORIGIN,
                canonical: abs(sib.clean),
            };

            // Dictionary tokens first (keys contain dots).
            html = html.replace(/\{\{t\.([\w.]+)\}\}/g, (m, key) => {
                const v = lookup(dict, key);
                if (v == null) {
                    console.warn(`[i18n] missing key "${key}" for locale "${locale}" in ${rel}`);
                    return m;
                }
                return String(v);
            });

            // Computed single-word tokens ({{t.*}} already gone, dots excluded here).
            html = html.replace(/\{\{(\w+)\}\}/g, (m, key) =>
                key in computed ? String(computed[key]) : m
            );

            return html;
        },
    };
}
