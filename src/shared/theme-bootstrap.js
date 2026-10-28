// Runs in the document head before the stylesheet: hydrate before first paint.
(() => {
  const root = document.documentElement;
  const ui = globalThis.SpaceUi;
  function apply(value) {
    const settings = ui.normalize(value);
    ui.applyTheme(root, settings.theme);
    globalThis.SpaceI18n?.applyDocument(settings.language);
  }
  apply();
  document.addEventListener?.('DOMContentLoaded', () => globalThis.SpaceI18n?.translate(), {once:true});
  if (globalThis.chrome?.storage?.local) {
    root.style.setProperty('visibility', 'hidden');
    let revision = 0;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.uiSettings) {
        ++revision;
        apply(changes.uiSettings.newValue);
        root.style.setProperty('visibility', 'visible');
      }
    });
    const request = revision;
    chrome.storage.local.get('uiSettings').then(saved => {
      if (request === revision) apply(saved.uiSettings);
    }).catch(() => {}).finally(() => root.style.setProperty('visibility', 'visible'));
  } else {
    try { apply(JSON.parse(localStorage.getItem('space-ui-settings'))); }
    catch { /* Default dark theme remains usable without stored preferences. */ }
  }
})();
