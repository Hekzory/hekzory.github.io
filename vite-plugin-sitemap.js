import fs from "node:fs/promises";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { siblings, abs, PAGE_DIRS, availableLocales } from "./i18n-paths.js";
import { pageLastMod } from "./page-lastmod.js";

// <lastmod> marks when each page's CONTENT last changed, derived per page from
// its real inputs (composed HTML <load> graph + referenced i18n keys + rendered
// meta keys), git-file-granular. The heavy lifting lives in page-lastmod.js so
// the sitemap, the {{modified}} token, and article:modified_time all agree.

// Discover indexable page entries across both language trees, mirroring
// htmlEntries() in vite.config.js (both scan PAGE_DIRS). The thin shells and
// per-locale article files map 1:1 to clean URLs via cleanUrl(); 404s are
// noindex, so they're excluded.
function pageEntries() {
    const out = [];
    for (const d of PAGE_DIRS) {
        try {
            for (const f of readdirSync(d || ".")) {
                if (!f.endsWith(".html")) continue;
                const rel = d ? `${d}/${f}` : f;
                const name = rel.slice(0, -5);
                if (name === "404" || name.endsWith("/404")) continue;
                out.push(rel);
            }
        } catch {
            /* directory may not exist */
        }
    }
    return out.sort();
}

export default function sitemapPlugin({ outDir = "dist", i18nDir = "i18n" } = {}) {
    let root = process.cwd();
    return {
        name: "vite-plugin-sitemap",
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
                /* meta.json optional; metaPaths just resolves to nulls */
            }

            const exists = (rel) => existsSync(path.resolve(root, rel));

            const body = pageEntries()
                .map((rel) => {
                    const sib = siblings(rel);
                    const loc = abs(sib.clean);
                    const lastmod = pageLastMod(root, rel, { meta, i18nDir, buildTime });

                    // Reciprocal hreflang alternates, but only for locales that
                    // actually ship a page — a single-language post must not
                    // advertise a twin URL that 404s (non-reciprocal hreflang).
                    const have = availableLocales(rel, exists);
                    const alts = [];
                    if (have.en)
                        alts.push(`    <xhtml:link rel="alternate" hreflang="en" href="${abs(sib.enPath)}"/>`);
                    if (have.ru)
                        alts.push(`    <xhtml:link rel="alternate" hreflang="ru" href="${abs(sib.ruPath)}"/>`);
                    // x-default points at the English version when it exists, else
                    // the locale that does (keeps the cluster self-consistent).
                    const xdefault = have.en ? sib.enPath : sib.ruPath;
                    alts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(xdefault)}"/>`);

                    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alts.join("\n")}\n  </url>`;
                })
                .join("\n");
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
            await fs.writeFile(path.resolve(outDir, "sitemap.xml"), xml, "utf-8");
        },
    };
}
