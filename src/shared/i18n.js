// Shared by extension documents, the worker, and isolated content scripts.
(() => {
  if (globalThis.SpaceI18n) return;
  const messages = globalThis.SpaceMessages;
  const bindings = new WeakMap();
  const attributes = ['aria-label', 'title', 'placeholder'];
  function systemLanguage() {
    try {
      const language = globalThis.chrome?.i18n?.getUILanguage();
      if (language) return language;
    } catch { /* Browser UI language can be absent in a standalone preview. */ }
    return globalThis.navigator?.language || globalThis.navigator?.languages?.[0] || 'en';
  }
  function resolve(preference = 'auto', system = systemLanguage()) {
    if (preference === 'en' || preference === 'ru') return preference;
    return /^ru(?:[-_]|$)/i.test(system) ? 'ru' : 'en';
  }
  let language = resolve();
  function t(key, values = {}) {
    const template = language === 'ru' && Object.hasOwn(messages, key) ? messages[key] : key;
    return String(template).replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(values, name) ? String(values[name]) : token);
  }
  function text(node, key, values = {}) {
    bindings.set(node, {key, values});
    node.setAttribute('data-i18n', key);
    node.textContent = t(key, values);
  }
  function translate(root = globalThis.document) {
    if (!root?.querySelectorAll) return;
    for (const node of root.querySelectorAll('[data-i18n]')) {
      const binding = bindings.get(node);
      const key = binding?.key ?? node.getAttribute?.('data-i18n');
      if (key) node.textContent = t(key, binding?.values);
    }
    for (const attribute of attributes) {
      for (const node of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
        const key = node.getAttribute?.(`data-i18n-${attribute}`);
        if (key) node.setAttribute(attribute, t(key));
      }
    }
  }
  function setLanguage(preference) {
    language = resolve(preference);
    return language;
  }
  function applyDocument(preference) {
    setLanguage(preference);
    globalThis.document?.documentElement?.setAttribute('lang', language);
    translate();
    return language;
  }
  globalThis.SpaceI18n = Object.freeze({t, text, translate, setLanguage, applyDocument, resolve, systemLanguage, get language() {return language;}});
})();
