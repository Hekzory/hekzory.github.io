# assets-src

Image **masters**. Nothing here is published — `public/` is what Vite copies into
`dist/`, this directory is not. Keep masters here and commit only the derived,
web-sized files into `public/`.

## profile.png

788×788 RGB master for the avatar. The three responsive variants the pages
actually serve are derived from it, and always from *this* file — never from a
smaller webp, which compounds compression artifacts:

```sh
for n in 200 300 400; do
    magick assets-src/profile.png -filter Lanczos -resize ${n}x${n} -strip /tmp/p$n.png
    cwebp -q 80 -sharp_yuv -m 6 /tmp/p$n.png -o public/profile-$n.webp
done
```

`public/face.webp` (788×788) is the same master at full size, referenced only by
the JSON-LD `ImageObject` on the home and resume pages — crawlers fetch it,
visitors never do.

## martianmono.woff2

The font master: Martian Mono SemiExpanded Regular (a **static** instance, no
`wght` axis, typo metrics 1000/200, advance 700/1000 em) exactly as the site
shipped it before subsetting. `css/martianmono.woff2` is cut from it and must
stay metric-identical: the fallback `@font-face` overrides in `css/style.css`
are computed from these numbers.

The subset keeps full Latin-1 (accented Western letters, `«» © ° × ÷ ½`),
Russian Cyrillic (`А–я`, `Ёё`), the combining marks Russian text actually uses
(stress acute, grave, breve and diaeresis for decomposed `й`/`ё`), dashes,
quotes (`“” „ ‘’`), `… • † ‰ ‹›`, `€ ₽ № ™`, arrows `← ↑ → ↓` and `− ≈ ≠`.
Layout features: `ccmp locl mark mkmk calt` (+ kern/liga/clig/rlig if
present). `calt` matters: it centers the colon between digits (the `07:16`
clock). Dropped: Latin Extended-A/B and Additional (Central/Eastern European,
Vietnamese), non-Russian Cyrillic (Ukrainian/Belarusian `Є І Ї Ў Ґ`,
Chuvash/Bashkir) and `₴`, super/subscripts beyond `¹²³`, fractions, and the
opt-in features (`aalt case cv01 cv02 frac numr dnom ordn sinf subs sups`).
Characters outside the subset still render, via the metric-matched fallback.

```sh
pyftsubset assets-src/martianmono.woff2 \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0300-0301,U+0306,U+0308,U+0401,U+0410-044F,U+0451,U+2002-2003,U+2011,U+2013-2014,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+2030,U+2039-203A,U+20AC,U+20BD,U+2116,U+2122,U+2190-2193,U+2212,U+2248,U+2260" \
  --layout-features="ccmp,locl,mark,mkmk,calt,kern,liga,clig,rlig" \
  --flavor=woff2 --output-file=css/martianmono.woff2
```

`pnpm run check` fails if any letter on a built page is missing from the subset
(it would otherwise silently render in the fallback face), so a post that needs
more (say, Polish `ł`) tells you to add its range here and re-run the command.
