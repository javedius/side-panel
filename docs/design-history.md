# Space

## Product
Личная боковая панель Chrome, en. Основная задача — быстро открывать часто и редко используемые сайты.
## Direction
Референс пользователя: тёмная панель Zen. Строгая нейтральная поверхность, сетка до 3×3, приглушённые знаки сайтов, ниже простой список Space. Без маркетинговых блоков. Системная типографика для русских и латинских названий.
## Tokens
Runtime palette owner: ui-settings.js themeTokens (dark/light); theme-bootstrap.js applies tokens before first paint, panel.css consumes CSS variables. Structural tokens remain in panel.css :root. Dark: background #181818, surface #242424, hover #2e2e2e, line #343434, text #ededeb, muted #a5a5a0, accent #d0d0c9, error #ffb4ab. Light: background #f5f5f3, surface #ffffff, hover #e9e9e6, text #252522, muted #64645d, accent #44443e. Radius 10px for tiles, 6px for rows, 12px for shell. Display: system 17px; body: system 13px; utility: system 10–11px.
## Layout
Три равные колонки, 10px промежутки. Верх с любимыми сайтами и подвал закреплены. Пространства и вкладки имеют отдельные области прокрутки с неподвижными заголовками; документ не прокручивается. Диалог ограничен высотой окна и прокручивается самостоятельно.
## Behavior
Общие редактор, сообщения и модель сохранения для сетки и Space. Удаление обратимо. Сайты сохраняются только локально. В любимом используются favicon из встроенного источника Chrome; сторонние сервисы иконок не вызываются. Для прочих списков сохраняются компактные инициалы.
## Accessibility
Нативные ссылки, кнопки, radio и dialog; видимый focus, Escape, возврат фокуса, live status. Reduced motion и forced colors. Название ссылки полностью доступно через accessible name/title.

## Live tab states — 1.1
Сетка и Space остаются постоянными местами, ниже располагается список остальных вкладок текущего окна. Активная вкладка имеет фон --active #363d30 и границу --active-border #6d7b60; --open #b6c9a6 обозначает открытое состояние. Эти значения определены в panel.css :root. Крестик закрывает вкладку и постоянно доступен клавиатуре; сохранённое место остаётся. Цветная точка дублируется доступной подписью. После обновления списка фокус сохраняется по ключу элемента; если элемент закрыт, фокус переходит к первой обычной вкладке или настройкам.

Reconcile drift: добавлены состояния «открыта» и «текущая» в той же палитре; шрифты, радиусы и основные отступы не менялись. Сетка и список Space используют общий siteNode, обычные вкладки — ту же иконку, типографику и сообщения. Сетевые favicon по-прежнему не запрашиваются.


## Overlay — 1.2
По запросу пользователя обычный режим — наложение слева: ширина до 360px, отступы 12px от окна, радиус 20px, лёгкая тень. Runtime owner внешней оболочки — overlay.js styles; внутренний UI остаётся panel.css. Оболочка position:fixed, без изменения размеров/отступов body и html сайта. Iframe с интерфейсом расположен в закрытом Shadow DOM, оболочка использует manual popover для верхнего слоя, если он доступен. Это немодальная панель: фон доступен для взаимодействия и не затемняется. Кнопка × и Escape возвращают фокус на страницу; модальный редактор внутри панели сохраняет собственное поведение. Служебные страницы используют нативный вариант. Внешние 12px/20px относятся только к overlay, не к нативной панели.


## Space actions — 1.2.1
Для каждого сайта Space постоянно видна кнопка ⋯, включая закрытые сайты. Нативный details/summary раскрывает две команды: «Изменить сайт» и «Убрать из Space». Это немодальное раскрытие с обычным Tab-порядком, не ARIA menu. Escape закрывает раскрытие до закрытия overlay, наружное нажатие тоже закрывает его. Цвета, фокус, радиусы и кнопки наследуют panel.css; только команда удаления использует существующий --error. Крестик вкладки сохраняет прежний смысл. Меню открывается вверх, если снизу не хватает места.


## Collapsible Spaces — 1.3
The user chose a plain vertical list of named Spaces (Работа, Личное, Хобби) with expandable site lists. Shared 3×3 favorites remain above it. Each native details summary shows chevron, ellipsized name and count. Separate buttons on the right rename the Space or add a site; a labeled «Создать Space» action sits above the list. Multiple groups can stay expanded. Colors and type inherit existing panel.css tokens; no palette change. Site destination is a platform-native select, intentionally accepting system popup geometry. Space create/rename reuses the existing native-dialog form pattern and status messages. No new icons or network assets.


## Window continuity — 1.4
User requested keeping the overlay open across tabs. The existing shell, typography and tokens are unchanged. Open/closed state now belongs to each Chrome window, and the shell is restored on ordinary pages. Automatic restore must not steal keyboard focus; explicit toolbar opening focuses the iframe. Closing anywhere in the window hides its other instances. Different windows have independent visibility. This is an intentional behavior change from the original per-page overlay, with no visual redesign.


## Left edge affordance — historical 1.5
A 6px native button sits at the viewport's left edge with transparent background, subtle existing sage on hover and solid sage keyboard focus. After 300ms mouse dwell it opens the existing panel without taking focus. Width and layout are unchanged. Edge geometry and timing live in overlay.js, not panel.css, because it is a website-injected shell. The toolbar remains an alternative. No auto-close on mouse leave is added, preserving window continuity.


## Compact launcher — 1.6
The user replaced edge hover with a small floating icon, then asked for a barely noticeable appearance. Runtime owner is overlay.js launcherStyle. Position: left 10px, vertically centered, fixed. Size: 24×28px with radius 8px and 17px ◧ icon. Existing graphite background, sage foreground, no shadow, 0.25 resting opacity; 0.85 hover and 1.0 keyboard focus with visible outline. The icon hides while the panel is open and reappears on close. No hover activation. This intentionally replaces the invisible full-height sensor; palette and panel styling are unchanged.


## Configurable anchors — 1.7
The header gear now owns panel settings; ✎ remains site-editing mode. Settings reuse the native modal/select language. The user chooses left/right for panel and launcher together; launcher has top/center/bottom alignment. All launcher variants retain 24×28px size, transparency and 10px side inset; corner variants add a 10px top/bottom inset. Center uses 50% with vertical centering. Existing panel 12px margins and visual tokens remain. Canonical placement owner is ui-settings.js; runtime shell consumers are overlay.js. Placement updates after save across open sites, with no startup flash on the opposite side.


## Dark/light palette — 1.8
User requested explicit dark and light choices. Dark remains the default and preserves the reference look. Light uses a soft gray-green background #f6f7f4, white surfaces #ffffff, dark text #242b20, muted text #5e6758, accent #405d31 and active background #e1ebd9. Both palettes define the exact same semantic tokens in ui-settings.js; document, dialogs, menus, forms, live tabs, toasts, scrollbars, outer shell and launcher consume that owner. Brand icon colors remain site-specific.

Reconcile drift: palette values moved from panel.css and shell literals into shared themeTokens to prevent shell/document disagreement. Geometry, fonts and launcher opacity are unchanged. theme-bootstrap.js hides the initial document only until preference hydration completes, preventing a dark flash when light is saved. Native selects and scrollbars receive the chosen color-scheme. Main text, muted text, accent, error and primary-button contrast pairs pass the test's WCAG AA 4.5:1 threshold for both themes.


## Pinned favorites — 1.9 (shared scrollport superseded by 1.10)
Source: user explicitly requested no whole-panel scrolling and stationary favorites. panel.html separates pinned-section from panel-scroll; panel.css constrains the app document to its viewport with a complete min-height:0 flex chain. Header, intro and 3×3 favorites stay outside the scrollport; footer remains fixed in the flex shell. panel-scroll owns list overflow and stable scrollbar gutter, with a localized region name and keyboard focus. Native dialogs retain their independent internal scrolling. On short viewports the intro/footnote yield space, and grid rows compact while keeping every site accessible by its full accessible name. Theme, color, side and launcher behavior do not change.

Site actions use native manual popovers where supported so the internal scrollport does not clip them. Position is clamped to the iframe viewport; a fallback opens within available list bounds. Scrolling closes transient site actions. Normal background renders preserve the list scroll offset and reveal floating actions before restoring keyboard focus.


## Independent lists — 1.10
User clarified that Spaces and tabs should scroll independently. panel-lists is only a bounded flex shell; spaces-scroll and tabs-scroll own overflow separately. Their headings remain outside overflow. Spaces use natural height up to half the list area; tabs receive the rest. Both scroll positions persist through normal background renders. Header/favorites/footer stay pinned. The decorative intro and footer caption were removed to give the lists more usable height; palette, grid content and launcher remain unchanged. Scrollbars stay visible/operable and native wheel inertia is retained; no custom wheel interception or forced smooth scrolling.


## Compact favorites and transport — 1.11
Source: current user request. Three columns are retained, but empty slots/rows are removed: one add tile follows 0–8 sites and no add tile appears at nine. The existing responsive tile heights and pinned layout remain. The footer is a small classic transport deck: quiet track/artist text and previous, restart, play/pause, next controls. Existing surface, line, accent, muted and focus tokens own all player colors; no decorative equalizer or autoplay. Unsupported actions are disabled, with a tooltip; the idle copy directs the user to start music on a website.

The new identity is two overlapping rounded spaces. SVG source is icons/space.svg; ui-settings.js exposes the identical vector as logoUrl for the panel mask and injected launcher, and icons/space-{16,32,48,128}.png are raster exports for Chrome. Launcher dimensions, transparency and placement stay unchanged. Space group headers retain the existing actionButton owner and gain a delete control; confirmation uses the existing native dialog/inline error/status pattern.

Reconcile drift: the earlier always-full 3×3 grid and save-current-tab footer are intentionally superseded by the user's current instructions. Palette and scroll owners do not change. No new runtime token owner is introduced.


## Quiet action rail and aligned lists — 1.12
Source: user's screenshots and request to reduce buttons and uneven nesting. This intentionally replaces the header's separate pencil/gear icons and each row's action cluster. Header retains one ⋯ disclosure plus the overlay close button. Its disclosure contains Edit favorites and Settings. Each Space has one ⋯ disclosure for add/rename/delete; each tab has one for save/close; each saved site has one for edit/remove/close when linked. All use configureMenu/actionMenu in panel.js, extending the existing native details/popover owner. The favorites' compact menu is revealed on pointer hover or keyboard focus and stays visible on touch; the header retains an edit alternative.

List alignment: headings and their scrollers reserve the same native scrollbar gutter, rather than leaving list-only right padding. Row outer edges are equal; section headings, Space names and row icons share an 8px inner inset. Nested space-items have no left/right indent. Tab/site icons are consistently 25px; rows are 48px. Group headers are 42px, with the disclosure chevron on the right before the action rail. Empty counters are omitted. Group bottom borders are removed, and the list section gap is 20px without the previous duplicate tab-section top padding. Empty favorite add is 48px high (36px on short windows). Existing palette and scroll ownership remain unchanged.

Reconcile drift: the earlier separate create/rename/delete/close buttons and nested padding were replaced at the user's request. One shared action-menu primitive now covers all four contexts, including viewport-clamped popovers, inline failures and keyboard focus. No new token palette or data owner.


## Restrained neutral presentation — 1.13
Source: user rejected the 1.12 appearance, preferred the earlier view and explicitly asked for strict minimalism. Visual direction: native utility sidebar, flat neutral rows and quieter hierarchy. Both themes now use neutral graphite/gray, with no green active stripe. Shared palette owner remains ui-settings.js; bootstrap, dialogs and overlay consume it. The logo shape remains, rendered in neutral text color. Tiles use 10px corners, rows 6px, shell 12px and a smaller shadow. Section labels are 11px medium muted; row labels 13px; brand 17px.

The Space chevron returns to the leading icon column (20px), aligning its title with row labels. Every row keeps its full width; empty-group instructions align to that label column. Section headings remain fixed flex rows; they reserve the same stable gutter as their list scrollers so content does not shift as a Space expands. Space/tab/saved-site secondary menus reveal on hover, keyboard focus or open state and stay visible on touch. Header menu and close remain visible. This reduces resting controls while retaining the existing action/confirmation contracts.

The player is a flat footer row without a card border or filled play button. Transport uses consistent 16px monochrome SVG masks rather than OS-dependent Unicode icons; play/pause changes via data-playing. Palette, layout and action refinements are intentional replacements of 1.12; no schema, permissions or playback behavior change.


## Favorite site favicons — 1.14
Source: user explicitly requested real site icons instead of first letters in favorites. favoriteIcon in panel.js owns this variant of the existing site icon: fixed 30px slot / 24px image (responsive max dimensions), no letter or synthetic brand background, original favicon colors. Names, accessible labels, grid capacity and actions stay unchanged. Source is the extension-origin Chrome _favicon endpoint, with the saved HTTP(S) URL encoded through URLSearchParams, size 64. The manifest adds favicon permission; the endpoint is consumed inside panel.html and is not exposed as a web-accessible resource.

During image loading, invalid URL, unavailable runtime or image error, a neutral globe mask occupies the same slot. Broken images never flash; alt is empty because the parent button already names the site. Error does not affect opening/editing. The grayscale hover treatment of synthetic icons is intentionally bypassed for this favorite variant. No saved-site schema or external favicon provider is added.


## Panel presentation and launcher visibility — historical 1.15 (push mechanism superseded by 1.16)
Source: user requested a setting choosing overlay or moving page content, then a separate website-launcher visibility control. Native settings select panel-mode (Поверх сайта / Сдвигать сайт) and a labeled native show-launcher checkbox extend the existing settings form. Existing side/theme/vertical placement choices remain. Defaults for legacy preferences: panelMode=overlay, showLauncher=true. Hidden launcher disables only its position select; toolbar opening stays available. No visual redesign.

Canonical geometry owner: SpaceUi.layoutMetrics in ui-settings.js, consumed by overlay.js. Push mode reserves up to 384px on the chosen side (360px panel plus 24px clearance), leaving at least 320px for the page. At 640–703px viewport width the panel reduces proportionally; below 640px the existing overlay variant is used. The settings hint explains the narrow-window fallback and toolbar access.

Push mode adjusts body box width/margins through captured inline properties; closing/switching to overlay/pagehide/disposal restores the originals, while unrelated host style changes are preserved. No wrapper or reparenting of site content. Overlay mode retains the existing no-layout-mutation contract. These are app-owned page layout changes, so fixed-position elements and viewport-unit layouts on arbitrary third-party sites can differ from a browser-native viewport resize; native Chrome fallback is unchanged.


## Native push presentation — 1.16
Source: user reported that page push did not work and asked to remove pixel-inset descriptions from settings. The old body-width/margin implementation has been removed. panelMode=push now uses Chrome's native side panel so Chrome allocates the webpage viewport, including the site's fixed-position layout. panelMode=overlay keeps the app-owned floating shell. No new visual changes or permissions.

Side ownership is explicit: overlay uses the existing side setting; push uses Chrome's configured side. The select is disabled for push and a short native-panel-hint explains why. Position labels are simply Сверху / По центру / Снизу. Launcher visibility/position and themes remain saved. No narrow-window overlay fallback or app-owned push width remains.

Canonical native routing owner is background.js: declarative browser action behavior for push, explicit synchronous sidePanel.open from trusted launcher/Save gestures, native open/close event synchronization where available, and guarded own-panel settings messages. Settings transition opens native before asynchronous persistence and rolls back opening on save failure. Overlay restoration closes the native panel before displaying the floating shell. Existing scripts dispose the old implementation on reinjection to restore body styles left by 1.15.


## Settings sections — 1.16.1
User requested headings and grouping. The existing settings form now uses three native fieldset/legend groups: Внешний вид (theme), Панель (mode/side), Кнопка на сайте (visibility/position). Separation uses 22px spacing, no cards or divider lines. Group legends use existing text color, 13px/600; field labels remain 12px muted. Hints stay in their owning group. Dialog initially focuses the first theme control. Native form/select behavior, IDs and persistence remain unchanged.


## Keyboard toggle — 1.17
Source: user requested a keyboard shortcut for opening/closing the sidebar, suggesting Cmd+J on Mac and a Windows equivalent. Manifest commands._execute_action binds Command+J on macOS and Alt+J on Windows/default. Reusing Chrome's action command delegates to the existing overlay action or native action behavior; no page-level key interception or second toggle handler. Windows Ctrl+J is already Chrome Downloads, so Alt+J is chosen.

The settings form gains a Клавиатура fieldset matching existing sections. A compact native kbd badge displays the actual chrome.commands.getAll assignment rather than assuming the manifest suggestion was accepted. Unassigned/error states are explicit; Изменить сочетание opens chrome://extensions/shortcuts. Refresh on reopening/returning focus reflects user remaps; late responses cannot overwrite a newer query. Colors/type/spacing reuse existing tokens, with a small 4px outlined key badge. No new permissions.


## Quick search — 1.18
Source: user requested a Spotlight-like search on Command+K with results in a new tab, then explicitly chose the panel's own search-engine setting. Existing neutral utility direction is retained: centered 600px-max search surface, existing theme tokens, 12px radius, understated title/provider and keyboard hints, one 21px input. Native select in the Поиск settings fieldset owns Google/Яндекс/Bing/DuckDuckGo choice. Клавиатура displays the actual second command assignment. No new typeface, decorative asset or palette owner.

Layer owner: quick-search-overlay.js uses a full-viewport native modal dialog above the sidebar; a div within the dialog hosts closed Shadow DOM (dialog itself cannot host a shadow root). Its extension-origin iframe owns input, surface and dimming. The website is inert while open and cannot read the extension document's input. Focus returns to the invoking page element on dismissal; navigation/hidden document closes without focus restoration. The regular sidebar remains independent. Restricted/denied pages use a compact extension popup window; results still target the original window.

Empty disables submit; nonempty exposes clear; pending makes input read-only and prevents duplicate submit; failure retains text and offers retry through the same submit action. Escape, close and outside click dismiss. IME composition never submits prematurely. Surface scrolls within viewport bounds, with reduced-motion/forced-color variants. No autocomplete/history/suggestions or stored queries. Runtime geometry is specified but actual rendered Chrome appearance is unverified under the existing browser-control denial.


## Compact rounded quick search — 1.18.1
Source: user screenshot and explicit request to fix spacing, remove excess and increase rounding. This intentionally supersedes the 1.18 search presentation only: 560px maximum width, 24px corner radius (20px on narrow screens), 16px vertical / 24px horizontal inset, a 52px search row and 20px input. The title remains available to assistive technology but is visually hidden. Separate close/header and keyboard-help row are removed; provider is only its name, aligned with the input by the shared icon-size + gap calculation. Clear remains available for nonempty text; submit is a 36px circular button with a consistent SVG arrow.

The input has no individual rectangular outline. Keyboard focus on input is visibly indicated by the search surface border/ring; buttons retain their own focus outlines. The forced-colors variant uses Highlight. All colors still come from SpaceUi themeTokens; geometry belongs to quick-search.css. Popup consumes the same surface and retains native window closing. Escape and backdrop dismissal remain. Existing sidebar/settings visuals and search routing are unchanged. Screenshot is before-change evidence; actual after-change browser rendering remains unverified under the earlier browser-access denial.


## Search row and lighter backdrop — 1.18.2
Source: user requested removing the search caption and reducing dimming. The provider footer is removed, leaving the existing single search row and conditional inline error. Search iframe dimming in quick-search.css now mixes the canonical --backdrop token at 35% with transparency, in both themes. Other dialog backdrops and the native dialog layer are unchanged; popup retains its opaque --bg override. Provider selection remains in panel settings and the worker reads it on submit. The removed footer no longer needs UI storage reads/listeners.


## Zen-inspired compact search — 1.18.3
Source: user explicitly asked for smaller and more laconic search, referring to Zen Browser. Inspected official URL-bar documentation and its official bookmark-popup-single-toolbar screenshot in IAB: https://docs.zen-browser.app/user-manual/urlbar and https://docs.zen-browser.app/_next/static/media/bookmark-popup-single-toolbar.9f1dd38a.png. Reference is the restrained floating input row; no claim of a pixel-perfect clone, no suggestion/history feature added.

The search surface now has 480px max width and 54px nominal empty height (36px row + 8px vertical insets + borders), versus 560px / 86px previously. Radius 16px retains rounded proportions; input is 16px, magnifier/submit glyph 16px, gap 10px. Submit becomes a small neutral 28px ghost action rather than a filled circular button; clear remains 24px. The short placeholder is Поиск…. Border/shadow are lighter in weight, input focus remains explicit through the outer ring. Narrow widths keep the same density with smaller side insets/gap. All colors still consume SpaceUi tokens; backdrop remains the 1.18.2 lighter variant. Restricted-page popup reduces to 520×144 outer bounds and uses the same overflow-safe search surface.


## Search provider favicon — 1.18.4
Source: user requested the active search engine's icon instead of a magnifier. The fixed 16px leading slot now renders the real favicon via the existing Chrome extension-origin _favicon source, size 32, using only the selected provider's fixed HTTPS root. Original icon colors are preserved, as with favorites; a neutral globe occupies the same slot while loading/on failure, never a letter or broken image. Provider name is available through the slot's accessible name and title, without restoring the removed caption.

SpaceUi.searchEngines and normalize remain the canonical provider owners. quick-search.js reads uiSettings and updates the icon live, ignoring stale hydration and defaulting to Google after storage failure. Input, buttons, row geometry and backdrop remain unchanged. Chrome favicon permission is already present; no new permissions or third-party favicon service. Actual favicon rendering in Chrome remains unverified under the prior access restriction.


## Search vertical placement — 1.18.5
Source: user explicitly requested search at 25% from the top instead of centered. quick-search.css owns --search-top: max(16px, 25dvh) on the iframe body, top-aligns the surface and preserves horizontal centering. Surface top edge is the quarter-viewport anchor; max-height uses the remaining height beneath it so errors scroll within the viewport. The compact restricted-page popup keeps centered content with its own height bound. No other presentation or behavior changes.


## Unified search, direct navigation, transfers and backup — 1.19
Source: user explicitly accepted all four proposed improvements. Keep the 1.18.5 compact surface at 25dvh, provider favicon, neutral themes and subdued backdrop. SpaceUi remains palette/provider owner. The only search expansion is a native list of up to five real buttons after nonempty input. Rows reuse neutral hover, visible focus, compact title and secondary source text; long names truncate with full title available. Empty input shows no suggestions, tips, footer or history. The surface retains one bounded scrollbar below its quarter-viewport anchor. Restricted-page popup grows only while matches are present and shrinks on clear.

Interaction owner: search-model.js supplies URL recognition and local matching; quick-search-background.js validates the session, resolves current tab/site IDs and owns activation; quick-search.js owns the ephemeral input, request revision and native result-list focus. This is a native list of actionable buttons with Arrow/Tab focus support, not a custom ARIA combobox/listbox. No hidden selection is committed by Enter in the input. Query text may be sent to the extension worker for local matching before Enter, never to an external suggestion service and never persisted. Current-window matches are preferred within rank; results can activate another allowed window. Private and ordinary tabs are separated.

Transfer owner: site-transfers.js calculates order/destination/capacity; panel.js owns native internal drag/drop and existing serialized local writes. Targets get a dashed inset highlight and insertion edge, no layout movement; source fades while dragging. Updates do not replace dragged DOM nodes. Group drop works collapsed and expands only after a successful move. The same model backs up/down commands. Existing site editor and tab save menu remain alternative destination controls. No new resting controls.

Backup owner: backup-model.js owns version/shape/limits/whitelisting; backup-ui.js owns the existing native dialog variant; background.js commits validated data with a pre-import recovery snapshot and handles native/overlay presentation under confirmation activation. Entry is one item in panel ⋯. Existing dialog title, close, semantic buttons, inline errors, first safe focus and scroll styling are reused. File name wraps, action pair wraps at narrow widths; preview shows counts and replacement consequence. Import is explicit and defaults focus to Отмена; pending disables duplicate/cancel actions. Export uses one downloaded JSON file. Colors and controls reuse the established tokens; no new permissions, visual library or external service.


## Chrome Web Store identity — 1.19.1
Source: user requested publication styling and packaging. The name remains Space; the listing title now names the sidebar and quick search, with a 102-character summary. The existing overlapping-spaces mark remains the identity. Store icon is a front-facing graphite 96px rounded tile within a 128px transparent canvas, with a light version of that same mark. The extension's 128px icon matches the store asset; 16/32/48px toolbar resources and in-panel mark remain their existing variants.

Marketing artwork is owned by scripts/render-store-assets.py and editable store/source SVGs: 440×280 small tile, 1400×560 marquee, opaque RGB PNG. The graphite/neutral palette derives from the existing SpaceUi aesthetic; system Arial rendering provides Cyrillic. The banner shows a schematic sidebar/grid and floating search as illustration. It is not a captured browser interface; no file is labelled as an actual store screenshot. store/assets/preview.jpg is only a review sheet. Images were opened and visually inspected; PNG sizes, modes, alpha padding and SVG syntax verified.

The settings form adds a final privacy fieldset using existing spacing/type/link primitives, linking to store/privacy/index.html. This standalone policy page has its own document stylesheet for public hosting and uses the same light neutral palette, system type, visible link focus and narrow-screen layout. It has no script or external asset requests. The public-hosted copy and packaged in-extension copy share the same files. Publication materials explicitly distinguish locally processed tab/site/media data from external search navigation and avoid claiming that no data is handled. No permission or data-schema change.
