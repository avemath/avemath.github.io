# Grace Mae bustle drawing, vendored

`bustleDrawing.tsx.txt` is an unmodified copy of `src/components/sections/bustleDrawing.tsx` from https://github.com/avemath/gracemaealterations at commit `2f74f40` (renamed to .txt so this site's type check skips it). It draws the gown from the back and the side for one value t, from train down (0) to bustled (1).

`scripts/port-bustle.mjs` compiles it to `src/lib/bustle-drawing.js`, with its JSX turned into calls to the small SVG builder in `src/lib/svg-h.ts` instead of React. Run `node scripts/port-bustle.mjs` after replacing the copy here.

`bustle-text.json` holds the default wording of every `bustle` field in `src/lib/text/specs/tools.json` at the same commit, the words the explorer shows until the Studio overrides them.
