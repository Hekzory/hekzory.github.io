import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Each deployed page is composed at build time, so its real last-modified
// date is the newest commit touching any of its inputs: the page's own HTML
// plus the shared sources every page is built from. Falls back to build time
// when git can't answer honestly (missing, not a repo, shallow clone — where
// every file would claim the tip commit's date).
const SHARED_SOURCES = ["css", "js", "components", "meta.json"];
const DEFAULT_ROUTES = [
    { loc: "https://tsv.one/", sources: ["index.html"] },
    { loc: "https://tsv.one/resume", sources: ["resume.html"] },
];

function git(args) {
    return execFileSync("git", args, { encoding: "utf-8" }).trim();
}

// %cI = committer date, strict ISO 8601 — valid sitemap <lastmod> as-is.
function gitLastMod(sources) {
    try {
        if (git(["rev-parse", "--is-shallow-repository"]) === "true") return null;
        return git(["log", "-1", "--format=%cI", "--", ...sources]) || null;
    } catch {
        return null;
    }
}

export default function sitemapPlugin({ routes = DEFAULT_ROUTES, outDir = "dist" } = {}) {
    return {
        name: "vite-plugin-sitemap",
        apply: "build",
        async closeBundle() {
            const buildTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
            const body = routes
                .map(({ loc, sources }) => {
                    const lastmod = gitLastMod([...sources, ...SHARED_SOURCES]) ?? buildTime;
                    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
                })
                .join("\n");
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
            await fs.writeFile(path.resolve(outDir, "sitemap.xml"), xml, "utf-8");
        },
    };
}
