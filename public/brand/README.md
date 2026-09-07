# ClipCore brand assets

The SVGs are the source of truth. Every PNG here is generated from them by
`scripts/build-brand.mjs`, so raster and vector can never drift — re-run it
after any change to the mark rather than editing a PNG.

```bash
node scripts/build-brand.mjs
```

## The mark

Two crop marks bracketing a solid core — extract the core from the frame, which
is what the product does. One colour, three shapes, no gradients. Drawn on a
24-unit grid with a 2.25 stroke so it lands on the pixel grid at 16, 24, 32 and 48px.

## Which file to use

| Use | File |
| :--- | :--- |
| Anywhere vector works | `mark-dark.svg` / `logo-dark.svg` |
| Dark backgrounds | `*-dark-*` |
| Light backgrounds | `*-light-*` |
| Social profile picture | `app-icon-512.png` |
| iOS home screen | `app-icon-180.png` |
| Android / PWA | `app-icon-192.png`, `app-icon-512.png` |
| App store listing | `app-icon-1024.png` |
| Browser favicon | `favicon.ico` (16/32/48 packed) |
| Email signature, docs | `logo-dark-280.png` / `logo-light-280.png` |
| Press, print | `logo-*-1120.png`, or the SVG |

Mark and wordmark PNGs have transparent backgrounds. App icons are on a solid
`#0B0B0C` tile, because iOS and Android composite their own shape mask and a
transparent icon renders as a black square.

## Colours

| | Hex | Use |
| :--- | :--- | :--- |
| Mark on dark | `#E8E8E6` | Default |
| Mark on light | `#0B0B0C` | Light backgrounds, print |
| Icon tile | `#0B0B0C` | App icon background |
| Accent | `#5E6AD2` | Interface only — never in the logo |

## Rules

- **Don't recolour the mark** beyond the two colourways above. It is one colour
  by design; a gradient version defeats the point.
- **Don't add effects.** No shadows, glows, or bevels.
- **Clear space:** keep at least the height of the inner core square free on all
  sides.
- **Minimum size:** 16px for the mark, 100px wide for the wordmark. Below that
  use the mark alone.
- **Don't rebuild the wordmark by hand.** Regenerate it from the script.

## One caveat on the wordmark PNGs

The wordmark SVG uses live text (Inter, falling back to Helvetica/Arial), so the
PNGs were rasterised with whatever font this machine had. That is fine for web
and internal use. Before sending the wordmark to a printer or an external
agency, convert the text to outlines so it renders identically everywhere — or
just send them the SVG and let them handle it.
