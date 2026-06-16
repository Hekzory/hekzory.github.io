// Single source of truth for the waybar's visible breadcrumb. The trail itself
// is pure route data (i18n-paths' crumbTrail); here we render it to the list of
// crumbs the waybar component drops in via {{breadcrumb}}. Ancestor crumbs are
// links; the current page is a plain <span aria-current="page">. The " / "
// separators are drawn by CSS (.crumbs li + li::before), so the markup carries
// none — keeping it a clean, semantic <ol>.
import { crumbTrail } from "./i18n-paths.js";

// Minimal HTML-escape for crumb labels. They're route segments and the literal
// "~", but a post slug is author-supplied (the prose filename), so we never let
// one reach the markup unescaped.
const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Render the <li> list for {{breadcrumb}}; the component supplies the <ol> wrapper.
export function buildBreadcrumb(relPath, base = "") {
    return crumbTrail(relPath, base)
        .map(({ label, href }) =>
            href
                ? `<li><a href="${esc(href)}">${esc(label)}</a></li>`
                : `<li><span aria-current="page">${esc(label)}</span></li>`
        )
        .join("");
}
