import fs from "node:fs/promises";
import path from "node:path";

// Pages to list in the sitemap. <lastmod> is the build time: every deploy
// regenerates these static pages, so build time is an honest, always-fresh
// signal. It needs no git history (not guaranteed in CI / host build envs)
// and is fully deterministic, unlike per-file git dates.
const DEFAULT_ROUTES = ["https://tsv.one/", "https://tsv.one/resume"];

export default function sitemapPlugin({ routes = DEFAULT_ROUTES, outDir = "dist" } = {}) {
    return {
        name: "vite-plugin-sitemap",
        apply: "build",
        async closeBundle() {
            const lastmod = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
            const body = routes
                .map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
                .join("\n");
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
            await fs.writeFile(path.resolve(outDir, "sitemap.xml"), xml, "utf-8");
        },
    };
}
