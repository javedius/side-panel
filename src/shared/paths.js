// Extension-root resource paths used by Chrome APIs. Manifest agreement is checked at build time.
(() => {
  globalThis.SpacePaths=Object.freeze({
    panel:'src/panel/index.html',
    search:'src/search/index.html',
    settings:'src/shared/ui-settings.js',
    messages:'src/shared/messages.js',
    i18n:'src/shared/i18n.js',
    paths:'src/shared/paths.js',
    sidebar:'src/content/sidebar.js',
    searchOverlay:'src/content/search-overlay.js',
    mediaHook:'src/content/media-session-hook.js',
    privacy:'src/privacy/index.html'
  });
})();
