# Space design context

## Product

Chrome sidebar for favorite sites, named spaces, open tabs, and quick search. Product UI supports English and Russian, defaulting to Chrome’s interface language; unsupported languages fall back to English. The language selector lives in Appearance settings. Current store materials and the public policy remain English. User-provided site titles and space names keep their original language. The primary job is fast, quiet navigation among frequently and occasionally used sites.

## Direction

Strict, minimal, neutral utility interface. Preserve the user's Zen-inspired sidebar/grid and compact floating search. Favor stable alignment and restrained hierarchy; keep secondary actions inside the shared ⋯ menus. Use no decorative cards, marketing copy, or new controls inside routine product flows.

## Tokens

`src/shared/ui-settings.js` owns frozen light/dark palette tokens and normalizes preferences. `src/shared/theme-bootstrap.js` applies them before first paint. Panel, search, and website shells consume the same tokens. `src/shared/messages.js` and `i18n.js` own interface translation, safe named placeholders, and document language. Content scripts only translate their own shells; they never change the host website language or text.

- Dark: background #181818, surface #242424, hover #2e2e2e, text #ededeb, muted #a5a5a0, accent #d0d0c9.
- Light: background #f5f5f3, surface #ffffff, hover #e9e9e6, text #252522, muted #64645d, accent #44443e.
- Typography: system sans-serif, compact utility labels, readable titles. No remotely loaded fonts.
- Existing overlapping-space mark is the identity. Favorites, saved sites in spaces, live tabs, and quick-search results use the shared `src/shared/site-icon.js`/`site-icon.css` component and Chrome favicon cache. Keep each icon footprint stable while loading; missing/invalid/internal-page icons use a neutral globe, never initials. The selected search provider also uses its Chrome favicon. The store icon uses the same mark on a graphite tile with transparent outer padding.

Geometry belongs to each maintained stylesheet; do not copy styling into feature modules or introduce alternate palettes.

## Layout

`src/panel/styles.css` owns the sidebar's three-column favorite grid, compact rows, pinned favorites/footer, and independently scrolling Spaces/Tabs. There is one add tile after saved favorites, up to nine favorites total. No extra empty grid cells or whole-panel scrolling.

`src/search/styles.css` owns the compact floating search: up to 480px wide, rounded surface, top edge at 25dvh, horizontally centered. The text field has no separate rectangular border; its visible keyboard focus belongs to the surface. Up to five native result buttons appear only after nonempty input. The surface scrolls within the remaining viewport height. Search backdrop is the existing theme backdrop mixed at 35% opacity. The small restricted-page popup uses its own centered geometry.

`src/content/sidebar.js` owns the website shell. Overlay mode does not alter website layout. Native panel mode uses Chrome's viewport allocation; Chrome controls that mode's side.

## Behavior

Canonical owners and current file responsibilities are listed in `docs/architecture.md`; behavioral contracts are retained in `docs/ux-contract.md`.

- Settings, menu/popover behavior, and drag/drop are separate feature controllers under `src/panel/`.
- Search IDs, destinations, privacy mode, and session nonce are revalidated by the worker before navigation.
- Native result buttons provide Arrow/Tab/Enter interaction without a custom ARIA combobox.
- Site transfers persist only after validation; native dragging and menu/editor alternatives use the same data rules.
- Backup validation precedes preview/confirmation; previous data is retained for recovery. Live tabs are not part of a backup.
- Storage keys, IDs, site ordering, permissions, and backup format remain compatible with existing installations.

## Accessibility

Native buttons, links, inputs, selects, disclosures, and dialogs. Localized accessible labels, visible focus, Escape and focus restoration, busy/disabled states, inline errors and live status. Native modal background isolation is retained. Search composition handling and stale-response protection remain required. Support reduced motion, forced colors, bounded dialogs, and visible tokenized scrollbars.

## Publication materials

`store/` contains active English copy, promotional artwork, editable SVG, review notes, and the real-screenshot plan. `store/screenshots/global/` holds three labeled interface illustrations with example data; README embeds them. Their source/provenance is maintained under `store/screenshots/`, separate from actual Chrome capture evidence. `src/privacy/` is the single policy source for both the installed page and public hosting. The build copies it into the publication kit.

Promotional images are explicitly schematic illustrations, not browser screenshots. Do not claim store readiness while real screenshots and a hosted privacy URL are missing. Artwork palette follows the existing neutral brand. No invented publisher/contact details.

## Verification

Use `npm run verify`: source syntax, manifest/dependency/path/preload/translation-coverage checks, tests, and archive validation. `src/shared/paths.js` owns Chrome API resource paths; its agreement with the manifest is enforced by `scripts/project.py`.

Real Chrome automation was previously denied; do not substitute adapters or promotional drawings for actual UI verification. Generated audit evidence is in `reports/`. Earlier design decisions, screenshots context, and version history are preserved in `docs/design-history.md`.
