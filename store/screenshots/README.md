# Global screenshot artwork

Three English interface illustrations in the Chrome Web Store image dimensions: **1280×800, RGB PNG, no alpha**. All three appear in the repository README.

| Preview | PNG |
|---|---|
| Favorites, spaces, and tabs in the dark theme | [01-sidebar.png](global/01-sidebar.png) |
| Quick search across open tabs and saved sites | [02-quick-search.png](global/02-quick-search.png) |
| Light theme | [03-light-theme.png](global/03-light-theme.png) |

## Provenance

These are **code-rendered interface illustrations with example data**, not screenshots captured from a running Chrome installation. Each image says “Interface illustration · Example data”. They depict existing features; they are not evidence of live extension behavior, hotkey assignment, or store acceptance.

The renderer reads both palettes from `src/shared/ui-settings.js` and produces search matches through the actual `src/search/model.js` rules. Sidebar geometry follows `src/panel/styles.css`; search geometry follows `src/search/styles.css`. Example site/space/tab data is in `source/examples.json`. No private browser data is used or modified. `previews.json` records the extension version, source hashes, dimensions and capture type. Site icons come from the websites' public favicon URLs recorded in `source/icons/sources.json`; those marks belong to their respective owners.

Editable SVG versions are in `source/`. They are illustration sources, not application UI or browser test results.

## Regenerate

Install Pillow in your own Python environment, then run from the project root:

```sh
python3 scripts/render-screenshots.py
```

Node.js is also required to read runtime palettes and matching rules. Pre-rendered files are committed, so the normal check/test/package workflow does not require Pillow or fonts. The renderer uses local Arial when available, otherwise DejaVu Sans.

## Actual browser captures

Chrome access was denied when capture was attempted. No alternative browser adapter, profile reader, or headless session was used to bypass that denial. Actual current-version captures remain outstanding. For those, open Space with example sites on an ordinary page and capture its sidebar, quick search, and light theme. Use an English interface, rectangular 1280×800 or 640×400 images, and no private account content.

See [Chrome's screenshot guidance](https://developer.chrome.com/docs/webstore/best-listing#screenshots). Accurate core features, current appearance, and readable imagery matter; these files do not assert that Google has reviewed or approved them.
