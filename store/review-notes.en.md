# Chrome Web Store review notes

Version 1.22.0 · verified against the source on October 27, 2026.

## Single purpose

Space helps users organize saved sites and open tabs and navigate quickly through a sidebar and search. Favorites, named spaces, site ordering, settings, and portable backups support that purpose.

## Permission justifications

| Permission | Justification |
|---|---|
| sidePanel | Enables the native Chrome sidebar mode, in which Chrome makes room for the extension beside the website. |
| storage | Saves site URLs/names/order, spaces, settings, and the recovery snapshot before an import locally. Session storage holds tab associations and panel state. |
| tabs | Reads open tab titles, URLs, and identifiers to display the tab list, match searches, and activate an existing tab. Creates and closes tabs following user actions. Does not request Chrome browsing history. |
| scripting | Injects packaged local sidebar/search scripts on ordinary sites and accesses audio/video elements and Media Session for the sidebar's playback controls. No remote executable code is downloaded. |
| favicon | Displays saved-site and selected-search-provider icons through Chrome's built-in favicon endpoint. |
| http://*/* and https://*/* | The floating sidebar, site button, quick search, and media controls operate on the user's chosen HTTP(S) sites, rather than one predefined domain. Internal browser pages are restricted; Chrome Web Store pages are excluded from declarative content scripts. |

## Remote code

All JavaScript is included in the ZIP. The extension has no remote JavaScript, eval, WebAssembly, downloaded executable modules, advertising SDK, or analytics SDK. Opening search results or user-selected sites is ordinary navigation.

## Data practices

Disclose actual local processing as well as any transmission. These are the implementation facts to map to the current dashboard categories:

- Open tab/window titles, URLs, and IDs are read locally for listing, matching, and switching. This is not access to the full browser history.
- Saved-site names/URLs, space assignments/order, settings, and the recovery snapshot are stored locally.
- Query text is processed locally for matches. Explicit web search confirmation opens a provider URL containing that query. Query text is not persisted by Space.
- Playback controls read media titles, artists, state, and available commands. They do not record audio or video.
- A user-selected JSON backup is read and validated locally; export downloads a JSON file. No general filesystem access is requested.
- Data is not sent to a developer-operated server or used for advertising or analytics. The extension does not read passwords, cookies, or payment details, and has no registration or cloud synchronization.

Do not state that no user data is processed: titles, URLs, saved-site data, and media state are used. The dashboard declaration and publicly hosted policy must match these facts. Provide a public HTTPS policy URL; an extension-local path is insufficient.

## Review steps

1. On an ordinary website, open Space using its toolbar icon. Save a site in Favorites and create a named space.
2. Drag a saved site into the space. The browser tab stays open. Move up/down and Edit site provide alternatives to dragging.
3. Press Command+K on Mac or Alt+K on Windows/Linux. Type part of an open/saved site's title. Use Arrow keys or Tab, then Enter to choose a result. Enter in the input runs a provider search or opens an HTTP(S) address in a new tab.
4. In Panel settings, change the theme or panel mode. The Keyboard section displays assigned shortcuts and opens Chrome's shortcut settings.
5. Panel menu → Backup: download a JSON file, choose it for import, inspect the preview, and confirm replacement. Open tabs remain unchanged. Previous data can be restored from the same dialog.
6. While media plays on a supported site, try the available footer controls. Support for individual commands depends on the site.

No test account or password is required. The interface supports English and Russian and defaults to Chrome’s UI language, with English fallback. Override it in Panel settings → Appearance → Language. Saved user-provided names remain in their original language.
