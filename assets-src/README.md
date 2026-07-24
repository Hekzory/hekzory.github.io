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
