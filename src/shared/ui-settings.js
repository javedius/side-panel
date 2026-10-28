// Shared by extension pages and isolated content scripts; no page data is read.
(() => {
  const logoUrl = "data:image/svg+xml," + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect x=\"2.5\" y=\"2.5\" width=\"13\" height=\"13\" rx=\"4\" fill=\"none\" stroke=\"black\" stroke-width=\"2.5\"/><rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"4\" fill=\"black\"/></svg>");
  const searchEngines=Object.freeze({
    google:Object.freeze({label:'Google',url:'https://www.google.com/search',parameter:'q'}),
    yandex:Object.freeze({label:'Yandex',url:'https://yandex.ru/search/',parameter:'text'}),
    bing:Object.freeze({label:'Bing',url:'https://www.bing.com/search',parameter:'q'}),
    duckduckgo:Object.freeze({label:'DuckDuckGo',url:'https://duckduckgo.com/',parameter:'q'})
  });
  function searchURL(engine,text) {
    if(typeof text!=='string'||!text.trim()||text.length>2000) throw Error('Invalid query');
    const provider=searchEngines[Object.hasOwn(searchEngines,engine)?engine:'google'];
    const url=new URL(provider.url);url.searchParams.set(provider.parameter,text.trim());return url.href;
  }
  const normalize = value => ({
    language: ['auto', 'en', 'ru'].includes(value?.language) ? value.language : 'auto',
    searchEngine: Object.hasOwn(searchEngines,value?.searchEngine)?value.searchEngine:'google',
    panelMode: value?.panelMode === 'push' ? 'push' : 'overlay',
    showLauncher: value?.showLauncher !== false,
    theme: value?.theme === 'light' ? 'light' : 'dark',
    side: value?.side === 'right' ? 'right' : 'left',
    launcherPosition: ['top', 'center', 'bottom'].includes(value?.launcherPosition) ? value.launcherPosition : 'center'
  });
  const launcherStyles = value => {
    const settings = normalize(value);
    return {
      left: settings.side === 'left' ? '10px' : 'auto',
      right: settings.side === 'right' ? '10px' : 'auto',
      top: settings.launcherPosition === 'top' ? '10px' : settings.launcherPosition === 'center' ? '50%' : 'auto',
      bottom: settings.launcherPosition === 'bottom' ? '10px' : 'auto',
      transform: settings.launcherPosition === 'center' ? 'translateY(-50%)' : 'none'
    };
  };
  const panelStyles = value => ({
    left: normalize(value).side === 'left' ? '12px' : 'auto',
    right: normalize(value).side === 'right' ? '12px' : 'auto'
  });
  const themes = Object.freeze({
    dark: Object.freeze({
      '--bg':'#181818','--surface':'#242424','--hover':'#2e2e2e','--line':'#343434',
      '--text':'#ededeb','--muted':'#a5a5a0','--accent':'#d0d0c9','--error':'#ffb4ab',
      '--active':'#30302e','--active-border':'#71716a','--open':'#b8b8af',
      '--strong-line':'#464641','--secondary-text':'#c6c6bf','--edit-line':'#77776c',
      '--footer-line':'#2b2b2b','--cta-bg':'#2c2c28','--cta-border':'#45453e',
      '--primary-text':'#1b1b19','--primary-hover':'#e3e3dc','--status-bg':'#363633',
      '--scroll-thumb':'#595955','--scroll-hover':'#797975','--scroll-active':'#999995',
      '--icon-default-bg':'#30302c','--icon-default-text':'#c9c9c0','--shadow':'#0006','--backdrop':'#0009'
    }),
    light: Object.freeze({
      '--bg':'#f5f5f3','--surface':'#ffffff','--hover':'#e9e9e6','--line':'#dadad5',
      '--text':'#252522','--muted':'#64645d','--accent':'#44443e','--error':'#a02f27',
      '--active':'#e8e8e3','--active-border':'#9b9b92','--open':'#626259',
      '--strong-line':'#c2c2bb','--secondary-text':'#55554e','--edit-line':'#8a8a80',
      '--footer-line':'#dadad5','--cta-bg':'#ebebe5','--cta-border':'#c4c4b9',
      '--primary-text':'#ffffff','--primary-hover':'#33332e','--status-bg':'#e8e8e1',
      '--scroll-thumb':'#b2b2a9','--scroll-hover':'#8b8b81','--scroll-active':'#74746b',
      '--icon-default-bg':'#e8e8e3','--icon-default-text':'#56564e','--shadow':'#0002','--backdrop':'#0005'
    })
  });
  const themeTokens = value => themes[value === 'light' ? 'light' : 'dark'];
  function applyTheme(root, value) {
    const theme = value === 'light' ? 'light' : 'dark';
    for (const [name, color] of Object.entries(themeTokens(theme))) root.style.setProperty(name, color);
    root.style.setProperty('color-scheme', theme);
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--space-logo', 'url("'+logoUrl+'")');
  }
  globalThis.SpaceUi = Object.freeze({ searchEngines, searchURL, logoUrl, normalize, launcherStyles, panelStyles, themeTokens, applyTheme });
})();
