// Dev + preview only: answer Chrome DevTools' "Automatic Workspace Folders"
// probe. With DevTools open on a localhost origin, Chrome loads
// /.well-known/appspecific/com.chrome.devtools.json through the page (so the
// page's CSP applies: hence connect-src 'self' in meta.json) and, given a valid
// descriptor, offers to map DevTools edits onto this folder. Unanswered, every
// DevTools session logs a 404 or a CSP violation in the console. Chrome never
// probes non-localhost origins, so production is untouched.
//
// Chrome mounts only local absolute paths: anything it classifies as a network
// path is rejected with "Can't add file system: <illegal path>" in the console.
// Under WSL a Windows Chrome sees the Linux filesystem exactly that way (a
// \\wsl.localhost\… share), so there we answer with empty settings: still a
// valid, silent response, just no folder mapping.
//
// The uuid keys the folder permission DevTools persists; deriving it from the
// root path keeps it stable across restarts without a cache file.
import { createHash } from "node:crypto";

const WELL_KNOWN = "/.well-known/appspecific/com.chrome.devtools.json";

function descriptor(root) {
    if (process.env.WSL_DISTRO_NAME) return "{}";
    const hex = createHash("sha256").update(root).digest("hex");
    // Shaped like a v4 UUID: fixed version and variant nibbles.
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    return JSON.stringify({ workspace: { root, uuid } });
}

export default function devtoolsJsonPlugin() {
    let body = "";
    const middleware = (req, res, next) => {
        if (req.url?.split("?")[0] !== WELL_KNOWN) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(body);
    };
    return {
        name: "vite-plugin-devtools-json",
        // `vite preview` also runs under command "serve".
        apply: "serve",
        configResolved(config) {
            body = descriptor(config.root);
        },
        configureServer(server) {
            server.middlewares.use(middleware);
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware);
        },
    };
}
