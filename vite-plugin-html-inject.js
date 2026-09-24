// <load src="components/x.html" key="value" />: each entry's template,
// components and article prose, inlined recursively before any other
// transformIndexHtml hook runs. It replaces the vite-plugin-html-inject package,
// keeping only the syntax this site uses, and page-lastmod.js walks pages with
// the same expandLoads(), so the files and {=$key} values that decide a page's
// <lastmod> are exactly the ones it was built from.
//
// Every attribute is double-quoted and becomes a param: each {=$key} in the
// included file is replaced by its value before that file's own <load>s are
// expanded (so a param can name a nested src); an unknown {=$key} is left as
// is. src is relative to the project root. A missing file, a <load> without
// src or an include cycle fails the build.
import { readFileSync } from "node:fs";
import path from "node:path";

const LOAD_RE = /<load((?:\s+[\w-]+="[^"]*")+)\s*\/>/gi;
const ATTR_RE = /([\w-]+)="([^"]*)"/g;
const PARAM_RE = /\{=\$([\w-]+)\}/g;

// Expands every <load> in `html`. onFile(file, markup) sees each included file
// (root-relative, "/"-separated) with its params substituted, before its own
// <load>s are expanded.
export function expandLoads(root, html, onFile = () => {}, parents = []) {
    return html.replace(LOAD_RE, (tag, attrs) => {
        const params = new Map(Array.from(attrs.matchAll(ATTR_RE), ([, key, value]) => [key, value]));
        const src = params.get("src");
        if (!src) throw new Error(`${tag}: no src`);
        const file = path.posix.normalize(`/${src}`).slice(1);
        if (parents.includes(file)) throw new Error(`<load> cycle: ${[...parents, file].join(" -> ")}`);
        const markup = readFileSync(path.join(root, file), "utf-8")
            .replace(PARAM_RE, (param, key) => params.get(key) ?? param);
        onFile(file, markup);
        return expandLoads(root, markup, onFile, [...parents, file]);
    });
}

export default function injectHtmlPlugin() {
    let root = process.cwd();
    const included = new Set(); // absolute paths of every included file so far
    return {
        name: "vite-plugin-html-inject",
        configResolved(config) {
            root = config.root;
        },
        transformIndexHtml: {
            order: "pre",
            handler: (html) => expandLoads(root, html, (file) => included.add(path.posix.join(root, file))),
        },
        // Dev: an edited partial reloads every open page. Vite's own reload for an
        // .html change only targets the page at that path, which no page has.
        hotUpdate({ file }) {
            if (included.has(file)) this.environment.hot.send({ type: "full-reload", path: "*" });
        },
    };
}
