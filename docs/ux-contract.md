# UI contract
Source: user brief and screenshot, 2026-10-21. Greenfield project, no sibling screens.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | site-form / openEditor and space-form / openSpaceEditor in panel.js | user brief | site / space create / edit | tests/panel.test.js |
| Select/Listbox | native site-space / panel-side / launcher-position / panel-theme selects in panel.html | UX contract: platform popup accepted | native | tests/panel.test.js; native browser verification pending |
| Scrollbar | panel.css global baseline | DESIGN.md | spaces-scroll / tabs-scroll / dialog | static + browser pending |
| Toast | notify in panel.js | local product decision | status / undo | manual browser |
| CRUD | write in panel.js | user brief | favorites / space | manual browser |

Native radio selection and native select for choosing a Space; no tables, dates or remote search. Native dialog owns focus trapping and inert background; close restores focus. Adding and editing use the same form. Errors preserve form values. Deletion offers undo for 12 seconds. Favorites capacity is nine. Removal of the extension removes stored data. Tabs permission supports reading the current page and finding existing tabs; no network service; HTTP/HTTPS access is used for the overlay lifecycle (1.4). Local preview uses localStorage. Search/filter state is not applicable.

## Live tabs — user-authorized 1.1 update
Source: user explicitly requested true tab management, 2026-10-21. Permission set remains sidePanel/storage/tabs.

Canonical owner: TabsController in tabs-controller.js. Site-to-tab associations are in storage.session, scoped by window ID; saved sites remain in storage.local. Navigation in a linked tab retains identity. Initial association uses exact normalized URLs, never domain-only heuristics. A browser tab belongs to at most one saved site. Ordinary tabs exclude associated IDs. A closed site keeps its saved slot; clicking reopens its saved URL. A removed or URL-edited site releases its old browser tab into the ordinary list without closing it. Moving/renaming a saved site retains its tab.

Events onCreated/onUpdated/onRemoved/onActivated/onMoved/onAttached/onDetached/onReplaced refresh the list with a short coalescing delay. Refresh results are versioned so older queries cannot overwrite newer results. Repeated opens share one pending operation per site. Query/activation errors do not create fallback duplicates. Errors preserve displayed state and offer Retry for tab loading. Every operation is scoped to the panel's window, including new-tab creation.

Close uses Chrome's native tab close lifecycle (including page beforeunload behavior); recovery is the standard reopen-closed-tab command, not a URL-only fake restore. Closing the last tab may close its window. Site deletion keeps its existing 12-second saved-site undo; it is distinct from closing a tab.

Verification: tests/tabs-controller.test.js exercises the above behavior against an isolated Chrome API model. Real Chrome interaction and visual verification remain pending due to the browser tool's local-file policy. Static auditor does not recognize external addEventListener wiring and flags those controls; inline handlers would violate Chrome's extension CSP, so they are intentionally not introduced.


## Overlay — original 1.2 behavior (visibility model superseded by 1.4)
Source: user requested overlay instead of page reflow. Canonical outer shell is overlay.js; all site/tab actions still use panel.js and TabsController. Background action executes overlay.js only on the clicked tab using activeTab+scripting. No host_permissions or static content scripts. HTTP(S) pages may embed only panel.html via web_accessible_resources; UI runs in the extension iframe. Host page messages cannot invoke tab APIs: the sole message accepted by the content script is a close request whose source must be the exact frame. No tab data is posted to the parent page.

Toolbar toggles the existing instance; × and Escape close. Escape in an open site editor closes that dialog first. Previous page focus is restored on close. The overlay is nonmodal, with no body lock, backdrop interception, or page layout mutation. Opening is per page and is lost on navigation; automatic cross-page reinjection is intentionally not performed without persistent host access. Restricted pages (including chrome:// and the web store) open the existing native side panel synchronously under the user gesture. An injection error displays ! on the toolbar and a recovery hint in its title. Chrome 116+ is required for native fallback open(). Existing local saved sites and session links remain intact.

Tests/overlay.test.js exercises isolated-world toggle, iframe source checking, Escape, fixed positioning, unchanged page styles, toolbar injection scope and restricted-page fallback with in-memory APIs. Browser visual checks remain pending.


## Space removal — 1.2.1
Source: user screenshot showed that closing the tab did not remove a saved Space site. Each Space row now has a visible actions disclosure regardless of live tab state. Canonical removal owner is removeSavedSite in panel.js, shared by the editor and the Space action. Removal affects the saved site only; its live tab becomes ordinary and stays open. Existing 12-second undo restores the site; storage errors preserve the saved data and show an inline error in the disclosure. Menus keep their open state across tab refreshes, close on outside click/Escape, and restore focus on Escape. Menu Escape takes precedence over overlay Escape. No bookmarks behavior or permissions changed.

Verification: tests/panel.test.js runs removal, reclassification of the open tab, undo, expanded-state retention after a tab refresh, and storage failure in addition to the prior activation/editing flows. Native menu layout/keyboard rendering remains pending in Chrome.


## Multiple collapsible Spaces — 1.3
Source: user requested create/rename for work/personal/hobby categories and explicitly chose a list of expandable Spaces instead of a switcher. Each Space has a stable ID, name and independently persisted expanded state in spaceConfig (storage.local). Native details/summary is the canonical disclosure. Buttons for rename and add-site are siblings of summary, avoiding nested interactive controls. Multiple Spaces may be expanded. No active-Space filtering, browser tab hiding or auto-closing. The favorite 3×3 grid stays shared.

Canonical config/migration owner: spaces-model.js; config mutations serialize through changeSpaceConfig in panel.js and reread the current stored config before writing. Legacy Space sites receive the first Space ID without changing saved site IDs/URLs or tab bindings. Space rename changes only the name. The site editor uses a labeled native select for move/add destinations; platform popup geometry and keyboard behavior are accepted. Newly created Spaces expand; a destination expands after adding/moving a site. Names are trimmed, limited to 60 characters, and unique ignoring Russian case. Empty/duplicate names show associated inline validation. Storage failures preserve user input and allow retry. Deletion of entire Spaces is outside this request.

Verification: tests/spaces-model.test.js covers idempotent legacy migration and reload/config repair; tests/panel.test.js executes create, rename, add, move, independent collapse persistence, name validation and storage error/retry. Native dropdown/disclosure rendering remains pending in Chrome. Permission list unchanged.


## Persistent window overlay — 1.4
Source: user requested that the overlay remain available when switching tabs. This explicitly supersedes the per-page activation-only model of 1.2. manifest.json grants HTTP/HTTPS host access and registers the isolated overlay.js singleton on top-level ordinary pages. The redundant activeTab permission is removed. Content scripts do not read page content or form values. The manifest excludes the Chrome Web Store; browser restricted pages remain unsupported for overlay.

Canonical visibility owner is background.js, stored per window in storage.session with a monotonically increasing revision. Toolbar action toggles window intent. Navigation/bootstrap, tab activation/attachment and completed loading restore it without taking page focus. Escape/× request closing via the content script, which immediately hides its frame; the worker persists closed state and broadcasts it to all injected tabs in that window. Other windows remain independent. Closed-window state is removed. BFCache pages reread state. Background tabs do not build iframes at initial load. Existing tabs can receive one programmatic injection after extension update.

Messages are accepted only from this extension; worker requests require a top-frame tab sender. The page-to-content boundary still accepts only a close request from the exact iframe, never tab data or arbitrary commands. Visibility replies are versioned; late bootstrap replies are invalidated by live updates. Tab moves revalidate destination window state rather than comparing revisions across windows. Automatic restoration is idempotent and never toggles an already visible panel closed.

The native fallback can still be opened by an explicit toolbar click on a restricted page. Automatic native opening is not attempted because Chrome requires a user gesture. On returning to an ordinary page, the overlay resumes. Brief loading delay/recreation on navigation is expected; an overlay cannot remain physically above Chrome's privileged pages. Saved sites and Space config are unaffected.

Verification: tests/overlay.test.js executes state persistence across worker restart, window isolation, activation/reload, close broadcast, rapid toggles, stale replies, BFCache, moved-window revisions, message source checks and focus behavior using in-memory APIs. Actual Chrome navigation/compositing and permission-grant flow remain unverified in this environment.


## Edge hover — historical 1.5 (replaced by launcher in 1.6)
Source: user asked to open the panel by hovering over the browser edge. Scope is the left edge of the webpage viewport, not Chrome toolbar/window chrome. Canonical trigger is the fixed 6px edge button in overlay.js; styling is inline-important to isolate it from host CSS. It is a native button with localized name, visible focus treatment and immediate click/keyboard activation. A trusted mouse pointerenter with no pressed buttons schedules 300ms dwell. Pointerleave/down, pagehide, blur, hidden document or panel opening/closing cancel pending dwell. Touch, drag and synthetic events do not auto-open.

The new top-frame-only space-overlay-open message opens window intent idempotently; it does not toggle or steal focus. The worker rejects inactive and restricted sender tabs. Leaving the edge does not automatically close the panel, preserving the requested window continuity. Closing requires a fresh pointer entry before another hover opening. Singleton keys are versioned with getManifest().version so old page instances are replaced after extension updates. Permissions are unchanged from 1.4.

Tests cover hover delay and cancellation, drag/touch/synthetic input, page lifecycle, immediate click, closing/re-entry, focus preservation, idempotent open and inactive-sender rejection. Actual mouse hit testing and placement on live Chrome pages remain unverified here.


## Floating launcher — 1.6
Source: user reported that hover opening did not work, requested an icon on every website at left-center with a 10px inset, then requested a smaller and barely visible button. This replaces hover activation entirely. overlay.js owns the fixed native launcher: left 10px, top 50%, translateY(-50%), 24×28px, 25% opacity at rest, 85% on pointer hover and full opacity plus outline for keyboard focus. Explicit trusted click/keyboard activation opens Space and focuses its iframe. Launcher yields to the open panel and reappears on close; no automatic open from hover, no new permissions.

Opening errors leave the launcher available with ! and a localized recovery title. Repeated clicks share a pending operation. Old edge/overlay elements are removed on versioned initialization. Background sync ensures the content singleton is injected into closed active tabs too, so a launcher can appear without opening the panel. onInstalled initializes already-open active tabs; other existing tabs initialize when activated. Restricted browser pages remain excluded. User sites and Space config are unchanged.

Tests cover requested position, compact dimensions/emphasis, absence of hover opening, click/Escape, failure/retry, duplicate click suppression, explicit focus, update/activation injection while closed and window continuity. Live Chrome visual/hit testing remains pending.


## Side and launcher preferences — 1.7
Source: user requested panel left/right and launcher top/center/bottom with 10px offsets. Canonical owner is ui-settings.js (SpaceUi normalize/launcherStyles/panelStyles), loaded before overlay.js in both manifest and programmatic injection and imported by panel.js. uiSettings stores {side, launcherPosition} in storage.local independently of saved sites, Space groups and session visibility. Defaults preserve left/center. The launcher follows the chosen panel side. Top/bottom use 10px horizontal and vertical insets, center uses 10px horizontal and 50% vertical with translateY(-50%). Overlay retains 12px margins on the selected side. Opposing anchors are explicitly reset to auto.

The new header gear opens a native modal settings form with labeled native selects; platform popup behavior is intentionally accepted. Edit-sites action uses ✎. Save persists first, then closes/announces; failure preserves values inline and allows retry. Cancel/Escape do not save; focus returns to the settings action. Settings Escape precedes outer overlay Escape. Live storage changes update all initialized page shells and open panels without changing visibility or keyboard focus. Startup waits for preference hydration before showing launcher/shell to avoid a flash on the wrong side; newer change events beat earlier reads. No new permissions or saved-site migration. Chrome native fallback side remains browser-owned.

Verification: tests cover six combinations, normalization and serialization, live positioning, stale startup reads, wrong-side flash prevention, save/reopen/cancel, external changes, storage failure/retry and no mutation of sites/spaces. Real Chrome select popup/visual checks remain pending.


## Dark/light theme — 1.8
Source: user requested dark or light panel color. uiSettings adds theme: dark|light, defaulting to dark for existing or invalid preferences without resetting placement. Settings form uses the existing labeled native Select owner and explicit Save/Cancel behavior. Shared palette owner: SpaceUi.themeTokens/applyTheme in ui-settings.js. theme-bootstrap.js runs in the head before CSS, applies saved color-scheme and CSS tokens, subscribes to live changes, ignores stale hydration reads and reveals the default palette if storage fails. panel.js applies successful saves and external preference changes; injected overlay.js consumes the same theme for shell, iframe placeholder and launcher. Default icon colors use theme CSS variables; site-specific colors remain fixed.

Existing side/position, sites, Spaces and window visibility are preserved. No new permissions. Tests cover stored light startup without a dark flash, live changes/stale reads, storage failure recovery, save/reopen/cancel, legacy normalization, shell/launcher/iframe parity and semantic text contrast. Actual Chrome visual and native select inspection remains pending.


## Scroll ownership — 1.9
Source: user explicitly requested the whole panel not scroll and favorites stay stationary. The application is now a viewport-height shell. html/body/main are bounded only for this panel document, not the host website. The pinned-section owns header/intro/favorites; panel-scroll alone scrolls Space groups and normal tabs. The footer remains outside the scrollport. Dialog forms keep independent overflow:auto and viewport max-height. A focusable labeled region enables keyboard scrolling. Responsive compact variants preserve lower-list space on short windows. Palette and saved data are unchanged.

rememberFocus preserves panel-scroll.scrollTop across background renders. Site menus float in native manual popovers to escape overflow clipping; they clamp to the iframe viewport and close on list scroll/Escape/outside click. Restored menu focus reveals its popover first. The non-popover fallback uses scrollport bounds. Verification: all existing workflows plus the panel integration test for floating site action open/close on lower-list scrolling pass; actual fixed geometry, wheel/keyboard behavior, short viewport/zoom and native popup placement still require Chrome visual verification.


## Independent list scrolling — 1.10
Source: user's explicit reply selected separate Space and tab scrolling. This supersedes the shared lower-list scrollport in 1.9. panel-lists has no scroll; spaces-scroll and tabs-scroll are independently focusable, named native scroll regions. Space headers/create action and tab header/new-tab action stay outside their respective scrollports. Spaces are naturally sized up to half of available height; tabs fill the remainder. Fixed favorites/footer and dialog scrolling are preserved. scroll-padding, stable gutter and overscroll containment apply to each list. rememberFocus snapshots/restores both offsets. Either list scrolling closes transient site actions; popup fallback uses Space scrollport bounds. No custom wheel handlers or artificial smooth scrolling are added. Decorative intro/caption were removed to release vertical space.

Verification: panel integration test covers separate stored offsets, update preservation and menu dismissal from either list. Structural markup checks verify each list is in its own region and favorites/footer/section headings are outside. Live Chrome wheel/trackpad/native scrollbar geometry and small/zoomed viewport inspection remain pending.


## Version 1.11 — deletion, compact favorites, media
- Source: user's current four-part request; PRD update 1.11.
- Space deletion: group header × → named native modal with saved-site count and consequence → Cancel receives initial focus → explicit Delete → single storage.local.set({sites,spaceConfig}) → list; storage failure retains dialog and data, enables retry. Browser tabs remain open. Shared status offers Restore for 12 seconds; restored sites merge by ID rather than replacing newly added sites. Deleting the last Space persists an empty list. Saving a tab with no Space first opens Create Space and then returns to the pending site editor.
- Favorites: shared siteNode renders saved sites only, followed by one add button when below nine; no placeholder cells.
- Player owner: media-controller.js; page-side Media Session callback capture: media-session-hook.js at document_start in MAIN. Four controls: previous, restart current, play/pause, next. No automatic playback or automatic retry of a command. Source preference: currently playing, then retained paused source, then first available. Scope is current Chrome window; commands target the discovered frame/document and recheck its window. Metadata stays local and is rendered as text. Unsupported actions are disabled. Seek-to-zero is unavailable on non-seekable live streams. Empty/error/busy states keep the footer footprint. Duplicate clicks are suppressed; an 8-second command timeout releases controls with recovery copy.
- Existing tabs need a page reload to capture Media Session callbacks. Ordinary audio/video playback works directly; YouTube has a fallback to its visible previous/next controls. Playlist navigation is available when the website supplies it, not synthesized from unrelated browser tabs.
- Canonical owners unchanged for dialog, actionButton, status, focus, themes and native selects. Native OS select geometry remains intentional.


## Version 1.12 — consolidated actions and alignment
Source: user screenshots/request to reduce controls and flatten list nesting. Canonical menu owner: configureMenu/actionMenu in panel.js, extracted from the saved-site disclosure. Panel actions retain Settings and Edit favorites; overlay × remains directly accessible. Space actions (add/rename/delete), ordinary-tab actions (save/close), and saved-site actions (edit/remove/linked-tab close) each have one native details/summary ⋯. Restricted browser tabs expose Close only. Group disclosure and action menu remain siblings; no nested interactive targets.

One menu may stay open. Native manual popovers clamp to the viewport and remain outside overflow clipping; fallback uses the owning list bounds. Outside click, list scroll and Escape close them; Escape restores the trigger. Dialog actions close the popup and focus the trigger before opening, so cancel restores a visible target. Background updates preserve menu identity/focus and both scroll positions, hide old popovers before replacing DOM, and reposition the new one. Async action failure retains its menu with an inline error; destructive Space deletion still uses its named confirmation and Undo. Favorite menus support pointer hover, keyboard focus and touch, plus the existing global edit alternative.

Runtime geometry lives in panel.css: headings/list scrollports reserve matching native gutters; no group-content indentation or divider borders. Header controls remain outside the scrollports. Data and permissions are unchanged.


## Version 1.13 — strict visual direction
Source: user's feedback rejecting 1.12 and requesting strict minimalism. Shared data/actions, independent scroll regions and confirmations remain. Chevron returns to the left; heading and list gutters stay matched and stable to preserve alignment during expansion. Action menus stay keyboard focusable and appear on focus-within/hover/open, with persistent visibility on no-hover devices. Header actions remain visible. Neutral theme tokens continue to come from SpaceUi; row active state is a simple background. Player commands retain accessible labels/disabled states while their visual icons use monochrome masks; data-playing changes the toggle icon.


## Version 1.14 — real icons in favorites
Source: user's explicit icon request. Favorite icon owner is favoriteIcon in panel.js; other list icons remain under icon. Chrome favicon permission enables extension-origin _favicon lookup for saved HTTP(S) URLs. No arbitrary remote favIconUrl or external provider request is introduced. Stable image footprint, empty decorative alt and retained site accessible name; load reveals image, error leaves a neutral globe. No first-letter fallback in favorites. This supersedes earlier no-favicon statements for the favorite grid only. Chrome endpoint reference: https://developer.chrome.com/docs/extensions/how-to/ui/favicons.


## Version 1.15 — presentation mode and launcher toggle
Source: user's explicit overlay/push setting request and subsequent launcher visibility request. uiSettings adds panelMode:overlay|push and showLauncher:boolean. Shared normalization defaults old/invalid fields to overlay/true, preserving previous values of side/theme/position. Settings save persists all fields together; cancel/failure leaves the applied settings unchanged. Position choice is disabled while the launcher is hidden but retained. Native select and native checkbox ownership are intentional.

Overlay scope stays top-frame HTTP(S) pages. Native fallback on restricted Chrome pages remains browser-owned. Opening by toolbar is independent of launcher visibility. Open/closed window continuity, focus behavior and saved-site data are unchanged. Changes to presentation/launcher apply immediately to initialized sites. Startup hides the launcher until settings hydrate.

layoutMetrics is the shared geometry owner. Push reserve is min(384, viewportWidth-320), only at viewportWidth>=640; shell width is reserve-24. Narrow windows use overlay. overlay.js captures body inline properties (including priorities and cssText), measures original computed width without its own offsets and applies border-box width/margins for the selected side. Repeated updates do not accumulate. Closing, overlay switch, pagehide and disposal restore exact cssText when untouched; otherwise restore only still-owned properties to preserve site edits. Resize recomputes dimensions; body replacement is detected; BFCache reopening reapplies the selected mode. Programmatic style properties avoid blocked inline stylesheet insertion (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src). Third-party fixed-position/viewport-sized content may need overlay mode; no claim of native viewport resizing.


## Version 1.16 — native push fix and shorter copy
Source: user reported non-working push and requested removing numeric inset descriptions. This supersedes all 1.15 body mutation, layoutMetrics and narrow-window fallback rules. No code modifies document body width/margins anymore. Push uses chrome.sidePanel, overlay uses overlay.js. Side in push belongs to Chrome settings; overlay side preference is retained and its selector is disabled with an explanation in push. Position option labels contain no px/inset values.

background.js loads canonical SpaceUi normalization, caches presentation with stale-startup protection and sets openPanelOnActionClick for native push. A launcher request starts native open synchronously before awaits, using the trusted content gesture. Native presentation is explicitly marked in visibility messages/responses; content never mounts an overlay for it. Activation/navigation synchronize visibility only and never call native open without a gesture. Native onOpened/onClosed synchronize window intent when Chrome supports these events. Global native panel persists between tabs under Chrome's own lifecycle.

Mode-changing Save sends space-settings-save directly to the worker before awaiting. Only an own panel.html sender with a valid window is accepted; iframe sender window must match. The worker starts native open from Save activation, persists normalized settings after successful open, switches action behavior and hides stale overlays. Failed opening does not persist the new mode. Failed persistence rolls back newly opened native mode. Switching to overlay closes native first, then restores overlay on active tabs. Legacy Chrome without sidePanel.close uses enabled false/true as a close fallback. Relevant API contract: https://developer.chrome.com/docs/extensions/reference/api/sidePanel.


## Version 1.17 — browser keyboard action
Source: user requested sidebar open/close hotkey. Canonical owner is manifest commands._execute_action (Mac Command+J, Windows/default Alt+J), which invokes the existing browser action. It intentionally has no commands.onCommand handler: the reserved action command is handled by Chrome. Existing window-scoped overlay toggling and native setPanelBehavior toggling remain their own owners. Keyboard works while Chrome has focus, independently of the floating launcher setting.

Keyboard settings read the actual assigned shortcut using commands.getAll, support unassigned/error states, preserve user remaps, and open Chrome's shortcut manager through tabs.create in the panel's window. Focus/visibility refresh ignores stale queries and responses after the dialog closes. No page keydown handlers intercept input shortcuts. Chrome may leave conflicting suggestions unassigned; the UI never claims an inactive key works. API reference: https://developer.chrome.com/docs/extensions/reference/api/commands. Windows Ctrl+J conflict verified in https://support.google.com/chrome/answer/157179.


## Version 1.18 — panel-owned quick search
Source: user's Spotlight-like search request and clarification that provider belongs to panel settings. SpaceUi owns searchEngine normalization (default google) and four fixed HTTPS provider templates; settings save/cancel/failure follows the existing atomic uiSettings form contract. Provider is read again on submit, so the current saved choice is authoritative. No Chrome search permission/API or default-provider dependency.

Manifest commands.quick-search suggests Command+K on Mac and Alt+K elsewhere. quick-search-background.js owns opening, session validation and tabs.create; quick-search-overlay.js owns page dialog lifecycle; quick-search.js owns extension input state. One view per original window, duplicate opens focus it. Native modal dialog surrounds a valid div shadow host and extension iframe, keeping query events in the extension document. Only explicit Enter/form submit sends query text. Fixed HTTPS URLSearchParams encoding prevents user input from becoming a navigation scheme. Query is never persisted; storage.session holds only source window/tab, nonce, status and fallback view IDs.

Submission validates own extension page sender, current nonce and source/fallback tab. Per-nonce in-flight coalescing plus persisted pending status prevent duplicate tab creation. Success opens one active new tab in the source window and closes the view; failed tab creation restores retry readiness. An ambiguous pending session after worker loss requires reopening rather than blindly creating another tab. Empty/overlong/invalid requests fail without navigation. Engine label updates from saved settings; stale initial reads are ignored. Clear, IME composition, busy/read-only, inline failure, Escape/close/outside dismissal and focus restoration are explicit states. Visibility/navigation cleanup never searches. Existing sidebar state is not modified.

Chrome pages or denied injection use a centered extension-owned popup window. Repeated opening focuses the same popup; invoking within that popup does not nest another. A completed search focuses the original window and closes the popup. Window removal clears its own session. No external request occurs before submit. Native modal and cross-origin iframe details reference https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow; only div hosts the shadow root.


## Version 1.18.1 — quick search simplification
User requested spacing cleanup, fewer visible elements and rounder corners. Search retains the same input/clear/submit state owner and extension isolation. Accessible search title/label remain; visual title, keyboard tips and separate search-close action are removed. Escape or backdrop click dismisses the overlay; the restricted-page popup also has native window controls. The X within a populated input only clears text. Provider display is the selected provider name. Full-surface keyboard input focus replaces the field outline, with independent button focus outlines. No search/provider/session behavior change.


1.18.2: provider caption removed by user request. Search UI no longer reads/listens to settings for a visible provider label; worker provider resolution at submit remains authoritative. Search backdrop is lighter; input/clear/submit/Escape/backdrop dismissal contracts remain unchanged.


1.18.3: user requested smaller Zen-like presentation. Search remains the same form and session lifecycle, with a smaller ghost submit action, concise placeholder and compact responsive geometry. Restricted-page popup bounds are smaller; inline errors remain scroll-accessible inside the existing bounded surface. Clear, IME, Enter, duplicate prevention, Escape and backdrop dismissal remain unchanged.


1.18.4: active provider is communicated through its favicon and accessible name/title in the existing leading slot. UI settings read/listener return solely for this indicator, with stale-read protection and default normalization; query text is never part of the icon URL. Fixed root URL is passed to Chrome's own favicon endpoint, sharing the established favorites approach. Loading/error uses a stable neutral globe; failure never blocks input/submit. The worker still resolves the current saved provider when submitting.


## Version 1.19 — search, transfers, portable backup
Source: user's explicit confirmation of the four proposed features on 2026-10-25.

| Capability | Owner | Observable contract | Evidence |
|---|---|---|---|
| Local search/navigation | search-model.js + quick-search-background.js | Five matches; saved sites and allowed open tabs; IDs revalidated at activation; raw Enter opens address or provider query in new tab | tests/search-model.test.js, tests/quick-search.test.js |
| Search result controls | quick-search.js native button list | Real buttons, Arrow/Tab focus and Enter/click activation; input has no implicit selected entity | tests/quick-search.test.js |
| Site reorder/move/save | site-transfers.js + panel.js | Capacity nine, order preserved, collapsed destination expands, commit before render, tab remains live, menu/editor alternatives | tests/site-transfers.test.js, tests/panel.test.js |
| Backup file format | backup-model.js | Versioned JSON; HTTP(S) URLs; unique IDs; valid destinations/settings; up to 2 MiB / 5,000 sites / 200 groups; no sessions, tabs, queries or nested recovery copies | tests/backup-model.test.js |
| Backup dialog/import | backup-ui.js + trusted background import handler | Preview → safe initial focus → explicit replacement; one recoverable prior snapshot; all three datasets together; live tabs untouched | tests/backup-ui.test.js, tests/overlay.test.js, tests/panel.test.js |

Search: case-insensitive multiword matching covers titles, URLs and Space names. Duplicate exact URLs collapse; matching saved aliases can resolve to an already-open tab. Other-window results name that fact and focus the destination window. Incognito is matched only with the invoking tab's privacy mode. Blank input hides results; composition suppresses matching/submission; revision ignores superseded responses. Clear cancels the current result revision immediately and keeps input focus. Match-loading failure does not block ordinary address/web submission. On activation the worker fetches current tabs/sites and accepts a key, never a supplied destination URL. Closed/removed results fail in place. Existing nonce/pending/deduplication and one-result-navigation contract remain.

URL recognition permits HTTP(S), hostnames/domains with optional port/path/query/hash, localhost/IP and Unicode domains. A bare domain uses HTTPS. Whitespace, credential-bearing URLs and unsupported schemes do not become direct navigation. Unknown text follows the existing selected search engine. No arbitrary code or browser/extension URL is navigated from raw text.

Drag/drop: only panel-created payloads with the current drag token and item ID are accepted. Favorite targets use horizontal before/after positions; Space rows use vertical positions; the grid/group background appends. A tab is re-read in the panel's window before saving. Existing saved-site attributes and other group order are preserved. A tab already saved in the same destination is reused instead of duplicated. Full-grid, vanished-tab/Space/site and persistence failures leave data intact. Live tab IDs are never removed. Background renders are deferred during a native drag; completion/cancellation releases that deferral. Up/down menu actions use the same transfer model; editor/save actions provide destination alternatives.

Backup: JSON is parsed as data and explicitly whitelisted before any writes; URLs, IDs, duplicate/invalid names, group references, counts, settings and encoded file size are validated. Export reads current storage and supplies normalized defaults for a fresh profile. Import has no side effect until the user confirms replacement. Pending blocks duplicate actions and closure; failed reading/validation/storage/native opening retains current data and enables retry. A stable operation ID prevents retrying the same import from replacing its recovery snapshot. The worker accepts only own panel.html and matching window; native panel open starts synchronously from confirmation. Validated sites/config/settings and recovery snapshot are set together. A presentation-refresh failure after commit returns success with a refresh hint rather than requesting another import. UI rereads committed data; prior imported operation metadata is not exported. Previous data is available through the backup dialog and follows the same preview/confirmation flow. Opening/deleting/moving browser tabs is not part of import.


1.19.1: store-preparation metadata and identity update. Native privacy link in settings opens the bundled read-only policy in a new tab; its source is also supplied for public HTTPS hosting. The policy describes current sites/settings/recovery data, session links, local matching, explicit external searches, media state, backup files and permission reasons. No collection/consent mechanism, new permission or runtime behavior is added by the publishing package. scripts/package-extension.py owns release allowlisting, metadata/image dependency validation, source ZIP, separate artwork handoff, hashes and explicit outstanding real-screenshot/public-policy-URL requirements. Promotional illustrations are never reported as actual screenshots or proof of live Chrome behavior.


## Current layout and English UI — 1.20.0

Source: user requested a full folder/code reorganization, then explicitly chose English for both the store and entire extension interface on October 27, 2026. Current entry points and ownership are in `architecture.md`; older entries retain the paths/names used when written.

Runtime code is grouped under `src/`, icons under `assets/icons/`, tests under models/controllers/ui, and developer documentation under `docs/`. Root manifest location, extension storage keys, saved IDs/order, permissions, and backup schema are unchanged. Settings, menus, and native drag/drop now have separate injected-dependency controllers. Chrome API resource URLs are centralized and validated against the manifest and module graph. The fresh-page quick-search injection loads the paths prelude explicitly.

The active interface, document languages, errors, hints, accessible names, provider labels, default site labels, privacy page, manifest metadata, store copy, and promotional graphics are English. Existing user-owned titles/names are never rewritten. Unicode case-insensitive matching and validation remain covered by multilingual fixtures. Validation messages retain their semantic error handling after translation.

Privacy is maintained once in `src/privacy/`. Store listing JSON/hashes and current archives are generated into `release/`; version 1.19.1 archives and earlier Russian store documents are retained as historical records, not shipped as current materials. Current actual screenshots/public policy URL remain pending. No new data collection or permission is introduced.


## Language — 1.21.0

English/Russian UI follows Chrome's interface language by default, with browser/system language fallback for standalone previews and English for unsupported locales. Appearance settings offers System default / English / Русский. Save persists `uiSettings.language`; Cancel and failed writes preserve the previous language. Theme, placement, engine, sites, names, ordering, and open tabs do not change when language changes. Existing preferences and old backups migrate to `auto`; explicit choices roundtrip in schema-v1 backups. Static copy, accessible labels, dynamic menus, validation/worker errors, search-result kind labels, and player controls share translations. Site/space/track titles and queries remain user content. A language change refreshes open extension documents and website shells; content scripts never translate website DOM or change its language. Metadata uses Chrome's localized manifest catalogs; store materials/public policy stay English.


## Website logos — 1.22.0

All website representations in Favorites, Spaces, Tabs, and quick-search results use the shared Chrome favicon component. Letter/initial marks are not shown, including for legacy saved sites. The component reserves its 16/20/24px footprint while loading and falls back to a neutral website globe on missing image, invalid URL, internal page, or absent browser API. Search labels, keyboard interaction, tab activation, and site names do not change on icon load/failure. Existing icon metadata is retained in saved data for backup compatibility. Documentation illustrations use actual example-site logos in every website row.
