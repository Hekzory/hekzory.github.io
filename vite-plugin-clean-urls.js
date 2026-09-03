// Dev-only: mirror GitHub Pages' clean URLs so `vite dev` resolves the same
// links the site ships. /articles/ and /articles/<slug> are what the pages link
// to; in prod GitHub Pages serves /resume from resume.html and 301s a
// directory without its slash to the slashed form.
//
//   /resume, /ru/resume                    -> .../resume.html
//   /articles/<slug>, /ru/articles/<slug>  -> .../<slug>.html
//   /ru, /articles, /ru/articles           -> the slashed directory (index.html)
//
// This used to live under `server.configureServer` in vite.config.js — which
// is not a Vite option, so it never ran; configureServer is a PLUGIN hook.
export default function cleanUrlsPlugin() {
    return {
        name: "vite-plugin-clean-urls",
        apply: "serve",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const [pathname, query = ""] = req.url.split("?");
                const suffix = query ? "?" + query : "";
                if (
                    /^\/(?:ru\/)?resume$/.test(pathname) ||
                    /^\/(?:ru\/)?articles\/[^/.]+$/.test(pathname)
                ) {
                    req.url = pathname + ".html" + suffix;
                } else if (/^\/(?:ru|articles|ru\/articles)$/.test(pathname)) {
                    req.url = pathname + "/" + suffix;
                }
                next();
            });
        },
    };
}
