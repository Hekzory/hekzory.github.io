// Collapses whitespace inside non-JS inline <script> blocks — JSON-LD and
// Speculation Rules. html-minifier-terser (via vite-plugin-html) only minifies
// `text/javascript`, so these JSON blobs otherwise ship with the source
// indentation from components/schema.html and components/speculation.html.
// Parsing then re-stringifying is safe (it validates the JSON too) and keeps
// the source files readable while the build emits compact output.
const JSON_SCRIPT_RE =
    /(<script type="(?:application\/ld\+json|speculationrules)">)([\s\S]*?)(<\/script>)/g;

// Escape characters that are valid in JSON but unsafe inside an HTML <script>:
// "<" (0x3c — so an embedded "</script>" can't close the element early) and the
// JS line separators U+2028/U+2029. Applied to the re-stringified JSON so this
// final pass can't reintroduce a raw "<" that an upstream escape removed. The
// JSON stays valid — every \uXXXX escape parses back to its character.
const scriptSafe = (json) =>
    json.replace(/[\s\S]/g, (c) => {
        const n = c.charCodeAt(0);
        return n === 0x3c || n === 0x2028 || n === 0x2029
            ? "\\u" + n.toString(16).padStart(4, "0")
            : c;
    });

export default function minifyInlineJsonPlugin() {
    return {
        name: "vite-plugin-minify-inline-json",
        transformIndexHtml: {
            order: "post",
            handler(html) {
                return html.replace(JSON_SCRIPT_RE, (match, open, body, close) => {
                    try {
                        return open + scriptSafe(JSON.stringify(JSON.parse(body))) + close;
                    } catch {
                        return match; // leave untouched if it isn't valid JSON
                    }
                });
            },
        },
    };
}
