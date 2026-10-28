// Extension-owned favicon images shared by saved sites, tabs, and search results.
(() => {
  function create(site, size = 20) {
    const pixels = [16, 20, 24].includes(size) ? size : 20;
    const mark = document.createElement('span');
    mark.className = 'site-icon site-favicon';
    mark.style.setProperty('--site-icon-size', pixels + 'px');
    mark.setAttribute('aria-hidden', 'true');
    const fallback = document.createElement('span');
    fallback.className = 'favicon-fallback';
    mark.append(fallback);
    try {
      const page = new URL(site?.pendingUrl || site?.url);
      if (!['http:', 'https:'].includes(page.protocol) || !globalThis.chrome?.runtime?.getURL) return mark;
      const source = new URL(chrome.runtime.getURL('_favicon/'));
      source.searchParams.set('pageUrl', page.href);
      source.searchParams.set('size', '64');
      const image = document.createElement('img');
      image.alt = '';
      image.width = pixels;
      image.height = pixels;
      image.hidden = true;
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('load', () => {
        if (!image.naturalWidth) return;
        image.hidden = false;
        fallback.hidden = true;
      });
      image.addEventListener('error', () => {
        image.hidden = true;
        fallback.hidden = false;
      });
      mark.append(image);
      image.src = source.href;
    } catch { /* Invalid/internal URLs retain the neutral website mark, never initials. */ }
    return mark;
  }
  globalThis.SpaceSiteIcon = Object.freeze({create});
})();
