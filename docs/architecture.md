# Architecture and project organization

Version 1.21.0 · October 27, 2026.

## Entry points

- `manifest.json` stays at the original root to preserve the unpacked installation location.
- `src/background/index.js` is the classic service worker. Its `importScripts` calls are relative to the worker directory.
- `src/panel/index.html` is the native panel and overlay iframe UI.
- `src/search/index.html` is the extension-owned search UI.
- `src/content/*` are isolated-world website UI scripts, except the explicitly declared MAIN-world media-session hook.

Chrome APIs need extension-root resource paths, unlike ES imports and HTML links. `src/shared/paths.js` owns those URLs. The manifest necessarily repeats some paths; `scripts/project.py` verifies agreement and preload order.

## Responsibility boundaries

| Area | Owner |
|---|---|
| Window visibility, native/overlay routing, trusted imports | `src/background/index.js` |
| Search session validation, suggestions, tab activation | `src/background/search.js` |
| Sidebar data/render orchestration | `src/panel/index.js` |
| Settings form, shortcuts, Save lifecycle | `src/panel/settings.js` |
| Shared action disclosures, popovers, errors | `src/panel/menus.js` |
| Internal native drag/drop and drop indicators | `src/panel/drag-drop.js` |
| Transfer validation, capacity, stable ordering | `src/sites/transfers.js` |
| Space configuration/name validation | `src/spaces/model.js` |
| Search UI / pure matching and URL recognition | `src/search/index.js` / `src/search/model.js` |
| Backup schema / preview and import dialog | `src/backup/model.js` / `src/backup/dialog.js` |
| Chrome tab associations | `src/tabs/controller.js` |
| Playback capabilities and controls | `src/media/controller.js` |
| Theme tokens / localization / resource paths / hydration | `src/shared/` |

Pure models have no DOM or Chrome API effects. UI feature controllers receive the callbacks they need instead of owning copies of saved data. The panel retains storage/render coordination; the worker retains privileged navigation/import decisions. Existing synchronous user-activation boundaries are preserved.

Classic shared scripts deliberately expose frozen `SpaceUi`, `SpacePaths`, `SpaceMessages`, `SpaceI18n`, `SpaceSearch`, and `SpaceBackup` objects because both content scripts and the classic worker consume them. ES modules are used within extension UI pages. No new framework or runtime dependency was introduced.

## Tests and release artifacts

- `tests/models/`: normalization, validation, matching, ordering, and backup format.
- `tests/controllers/`: tab and playback API adapters.
- `tests/ui/`: actual UI/worker modules exercised with in-memory DOM/Chrome adapters.
- `scripts/check.mjs`: syntax checks, followed by the project validator.
- `scripts/project.py`: shared manifest, dependency, resource-path, translation-coverage/placeholder and preload checks.
- `scripts/test.mjs`: cross-platform test discovery.
- `scripts/package-extension.py`: uses the same validator, creates fresh ZIPs/metadata/hashes, and checks archive contents.

`src/privacy/` is the single editable policy source. Packaging copies it into the store handoff. Generated listing JSON and hashes are in `release/`, not mixed into store source files. Older 1.19.1 packages are preserved under `release/archive/1.19.1/`. Generated audit reports are under `reports/`.

## Compatibility and language

Storage keys, saved IDs/order, window/session keys, permissions, and JSON backup schema version remain unchanged. Existing user content stays in its original language. Panel/search messages, labels, accessible names, and errors use shared English/Russian localization. `uiSettings.language` is `auto` by default or an explicit `en`/`ru` override, preserved by backup schema v1. Chrome metadata uses `_locales/en` and `_locales/ru`; document interfaces support the manual override. Canonical model/worker errors remain English and are translated at the UI boundary. Privacy text and active store materials remain English.

Before the move, all 110 tests passed. The original folder was snapshotted to `/tmp/space-before-organization-2026-10-27.tar.gz`. Historical docs retain their original names/paths as evidence; this document and the root README define the current layout.

Real Chrome automation for this installation remains unavailable under the previously recorded denial. No alternate access route was used; physical hotkey, native drag, and real screenshot verification remain distinct from automated adapter tests.
