// Collapses whitespace inside non-JS inline <script> blocks — JSON-LD and
// Speculation Rules. html-minifier-terser (via vite-plugin-html) only minifies
// `text/javascript`, so these JSON blobs otherwise ship with the source
// indentation from components/schema.html and components/speculation.html.
// Parsing then re-stringifying is safe (it validates the JSON too) and keeps
// the source files readable while the build emits compact output.
const JSON_SCRIPT_RE =
    /(<script type="(?:application\/ld\+json|speculationrules)">)([\s\S]*?)(<\/script>)/g;

export default function minifyInlineJsonPlugin() {
    return {
        name: "vite-plugin-minify-inline-json",
        transformIndexHtml: {
            order: "post",
            handler(html) {
                return html.replace(JSON_SCRIPT_RE, (match, open, body, close) => {
                    try {
                        return open + JSON.stringify(JSON.parse(body)) + close;
                    } catch {
                        return match; // leave untouched if it isn't valid JSON
                    }
                });
            },
        },
    };
}
