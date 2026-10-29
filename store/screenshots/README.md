# Global screenshot artwork

Three English interface illustrations in the Chrome Web Store image dimensions: **1280×800, RGB PNG, no alpha**. All three appear in the repository README.

| Preview | PNG |
|---|---|
| Favorites, spaces, and tabs in the light theme | [01-sidebar.png](global/01-sidebar.png) |
| Quick search across open tabs and saved sites | [02-quick-search.png](global/02-quick-search.png) |
| Themes, panel modes, and languages | [03-themes.png](global/03-themes.png) |

## Provenance

These are **code-rendered interface illustrations with example data**, not screenshots captured from a running Chrome installation. Each image says “Interface illustration · Example data”. They depict existing features; they are not evidence of live extension behavior, hotkey assignment, or store acceptance.

The renderer reads both palettes from `src/shared/ui-settings.js` and produces search matches through the actual `src/search/model.js` rules. Sidebar geometry follows `src/panel/styles.css`; search geometry follows `src/search/styles.css`. Example site/space/tab data is in `source/examples.json`. No private browser data is used or modified. `previews.json` records the extension version, source hashes, dimensions and capture type. Site icons come from the websites' public favicon URLs recorded in `source/icons/sources.json`; those marks belong to their respective owners.

The gallery art direction follows the [user-provided ZIZIYI Space reference](https://chromewebstore.google.com/detail/ziziyi-space-chat-with-we/lilckelmopbcffmglfmfhelaajhjpcff?hl=en-US): warm paper background, editorial serif headline with orange emphasis, three pastel feature labels, and a large illustrative browser window. All visible extension UI, logos, copy, and features belong to this Space project or the named example websites. The competitor's screenshot pixels, product claims, and brand assets are not included. The neutral application theme is unchanged.

Editable SVG versions are in `source/`. They are illustration sources, not application UI or browser test results.

## Regenerate

Install Pillow in your own Python environment, then run from the project root:

```sh
python3 scripts/render-screenshots.py
```

Node.js is also required to read runtime palettes and matching rules. Pre-rendered files are committed, so the normal check/test/package workflow does not require Pillow or fonts. The renderer uses local Arial plus Times New Roman or Georgia; DejaVu Sans/Serif are the Linux fallbacks.

## Actual browser captures

Chrome access was denied when capture was attempted. No alternative browser adapter, profile reader, or headless session was used to bypass that denial. Actual current-version captures remain outstanding. For those, open Space with example sites on an ordinary page and capture its sidebar, quick search, and light theme. Use an English interface, rectangular 1280×800 or 640×400 images, and no private account content.

See [Chrome's screenshot guidance](https://developer.chrome.com/docs/webstore/best-listing#screenshots). Accurate core features, current appearance, and readable imagery matter; these files do not assert that Google has reviewed or approved them.
