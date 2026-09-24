// Which URLs to hand IndexNow for this deploy — zero dependencies, run in CI
// between the build and the Pages deploy.
//
//   node scripts/indexnow-urls.js <live-sitemap.xml> <dist/sitemap.xml>
//
// Prints a compact JSON array: every <loc> that is new or whose <lastmod>
// moved since the sitemap currently live, plus every <loc> that disappeared
// (IndexNow wants added, updated AND deleted URLs). <lastmod> is the git-derived
// "content last changed" date (page-lastmod.js), so a deploy that changes no
// page content — a Dependabot bump, a CSS tweak, a CI edit — yields [] and
// nothing is pinged.
//
// No usable baseline (the live sitemap couldn't be fetched, or it doesn't
// parse) means we can't tell what changed, so every URL is submitted: a
// redundant ping is harmless, a missed one isn't.
import { readFileSync } from "node:fs";

// <loc> -> <lastmod> for every <url> entry. Entries without a <lastmod> map to
// null, so they still compare (and a lastmod appearing/vanishing counts).
function entries(file) {
    let xml;
    try {
        xml = readFileSync(file, "utf-8");
    } catch {
        return null;
    }
    const map = new Map();
    for (const [, body] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
        const loc = body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
        if (!loc) continue;
        map.set(loc, body.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1] ?? null);
    }
    return map.size ? map : null;
}

const [livePath, nextPath] = process.argv.slice(2);
if (!livePath || !nextPath) {
    console.error("usage: node scripts/indexnow-urls.js <live-sitemap.xml> <new-sitemap.xml>");
    process.exit(2);
}

const next = entries(nextPath);
if (!next) {
    console.error(`indexnow-urls: ${nextPath} has no <url> entries`);
    process.exit(1);
}
const live = entries(livePath);

const urls = live
    ? [
          ...[...next].filter(([loc, mod]) => !live.has(loc) || live.get(loc) !== mod).map(([loc]) => loc),
          ...[...live.keys()].filter((loc) => !next.has(loc)),
      ]
    : [...next.keys()];

if (!live) console.error("indexnow-urls: no usable live sitemap, submitting every URL");
console.log(JSON.stringify(urls));
