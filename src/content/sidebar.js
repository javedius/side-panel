// Isolated-world singleton: window visibility is owned by the service worker.
(() => {
  const t=(key,values)=>globalThis.SpaceI18n.t(key,values);
  const key = '__spaceOverlay_' + chrome.runtime.getManifest().version;
  if (globalThis[key]) return;
  globalThis.__spaceOverlayActive?.dispose();
  let host, frame, topLayer, opening = false, disposed = false;
  const ui = globalThis.SpaceUi;
  let uiSettings = ui.normalize(), settingsReadVersion = 0, settingsReady = false, focusWhenReady = false;
  // Clear a shell from an older extension version on already-open pages.
  document.getElementById(`${chrome.runtime.id}-space-overlay`)?.remove();
  document.getElementById(`${chrome.runtime.id}-space-edge`)?.remove();
  let visible = false, previousFocus, revision = -1, closing = false, windowId = null, restoreRequest = 0;
  function updateLauncherVisibility() {
    launcher.style.setProperty('display',!visible&&uiSettings.showLauncher?'grid':'none','important');
    launcher.setAttribute('aria-hidden',String(!uiSettings.showLauncher||visible));
  }
  function mount() {
    host = document.createElement('div');
    host.id = `${chrome.runtime.id}-space-overlay`;
    document.getElementById(host.id)?.remove();
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', t('Space — tab sidebar'));
    // Inline important styles protect the outer shell from website CSS.
    const colors = ui.themeTokens(uiSettings.theme);
    const styles = {
      all: 'initial', position: 'fixed', top: '12px', left: '12px',
      right: 'auto', bottom: 'auto', margin: '0', padding: '0',
      width: 'min(360px, calc(100vw - 24px))', height: 'calc(100dvh - 24px)',
      border: '1px solid ' + colors['--strong-line'], 'border-radius': '12px',
      'box-sizing': 'border-box', overflow: 'hidden', background: colors['--bg'],
      'box-shadow': `0 8px 32px ${colors['--shadow']}`,
      'z-index': '2147483647', display: 'none', visibility: settingsReady ? 'visible' : 'hidden', 'color-scheme': uiSettings.theme
    };
    for (const [name, value] of Object.entries(styles)) host.style.setProperty(name, value, 'important');
    const shadow = host.attachShadow({ mode: 'closed' });
    frame = document.createElement('iframe');
    frame.title = t('Space — sites and tabs');
    frame.src = chrome.runtime.getURL(SpacePaths.panel+'?overlay=1');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;';
    shadow.append(frame);
    // A manual popover enters the top layer without a backdrop or page reflow.
    topLayer = typeof host.showPopover === 'function';
    if (topLayer) host.setAttribute('popover', 'manual');
    applyShellTheme();
    for (const [name, value] of Object.entries(ui.panelStyles(uiSettings))) host.style.setProperty(name, value, 'important');
    document.documentElement.append(host);
  }
  function hide() {
    if (!visible) return;
    visible = false; focusWhenReady = false;
    updateLauncherVisibility();
    launcher.setAttribute('aria-expanded', 'false');
    const hadFocus = document.activeElement === host || document.activeElement === frame;
    if (topLayer) { try { host.hidePopover(); } catch {} }
    host.style.setProperty('display', 'none', 'important');
    if (hadFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function show(focus) {
    if (!host) mount();
    if (!visible) {
      previousFocus = document.activeElement;
      host.style.setProperty('display', 'block', 'important');
      if (topLayer) { try { host.showPopover(); } catch {} }
      visible = true;
      updateLauncherVisibility();
      launcher.setAttribute('aria-expanded', 'true');
    }
    // Automatic restores must not take keyboard focus away from the page.
    if (focus && settingsReady) frame.focus({ preventScroll: true });
    else if (focus) focusWhenReady = true;
  }
  function apply(state, verifiedWindow = false) {
    if (disposed || !state || typeof state.open !== 'boolean' || !Number.isInteger(state.revision) || !Number.isInteger(state.windowId)) return;
    if (windowId !== null && state.windowId !== windowId) {
      if (!verifiedWindow) { restore(); return; }
      revision = -1; closing = false;
    }
    if (state.revision < revision) return;
    windowId = state.windowId;
    revision = state.revision;
    if (!state.open) closing = false;
    if (state.open && !closing && !state.native && uiSettings.panelMode!=='push') show(Boolean(state.focus)); else hide();
  }
  function requestClose() {
    closing = true;
    hide();
    chrome.runtime.sendMessage({ type: 'space-overlay-close' }).then(state => {
      if (state?.error) { closing = false; return; }
      apply(state);
    }).catch(() => { closing = false; });
  }
  async function requestOpen() {
    if (disposed || visible || closing || opening || document.visibilityState !== 'visible') return;
    opening = true;
    launcher.disabled = true;
    launcher.setAttribute('aria-busy', 'true');
    try {
      const state = await chrome.runtime.sendMessage({ type: 'space-overlay-open', native:uiSettings.panelMode==='push' });
      if (state?.error || typeof state?.open !== 'boolean') throw Error('open failed');
      setLauncherLogo();
      launcher.title = t('Open Space');
      launcher.setAttribute('aria-label', t('Open Space'));
      apply({ ...state, focus: true });
    } catch {
      launcher.textContent = '!';
      launcher.style.setProperty('opacity', '0.85', 'important');
      launcher.title = t('Could not open Space. Check site access, then reload the extension and page.');
      launcher.setAttribute('aria-label', launcher.title);
    } finally {
      opening = false;
      launcher.disabled = false;
      launcher.setAttribute('aria-busy', 'false');
    }
  }
  let launcherMark=null;
  function setLauncherLogo() {
    launcher.textContent='';
    launcherMark=document.createElement('span');
    launcherMark.setAttribute('aria-hidden','true');
    for(const [key,value] of Object.entries({display:'block',width:'15px',height:'15px',background:'currentColor',mask:'url("'+ui.logoUrl+'") center / contain no-repeat','pointer-events':'none'}))
      launcherMark.style.setProperty(key,value,'important');
    launcher.append(launcherMark);
  }
  const launcher = document.createElement('button');
  launcher.id = `${chrome.runtime.id}-space-launcher`;
  document.getElementById(launcher.id)?.remove();
  launcher.type = 'button';
  setLauncherLogo();
  launcher.title = t('Open Space');
  launcher.setAttribute('aria-label', t('Open Space'));
  launcher.setAttribute('aria-expanded', 'false');
  const launcherColors = ui.themeTokens(uiSettings.theme);
  const launcherStyle = {
    all: 'initial', position: 'fixed', left: '10px', top: '50%', right: 'auto', bottom: 'auto',
    transform: 'translateY(-50%)', width: '24px', height: '28px', margin: '0', padding: '0',
    border: '1px solid ' + launcherColors['--strong-line'], 'border-radius': '8px',
    'box-sizing': 'border-box', background: launcherColors['--surface'], color: launcherColors['--accent'],
    display: 'grid', 'place-items': 'center', 'font-family': 'system-ui, sans-serif',
    'font-size': '17px', 'line-height': '1',
    'box-shadow': 'none', opacity: '0.25', visibility: 'hidden', cursor: 'pointer',
    'z-index': '2147483646', 'touch-action': 'manipulation'
  };
  for (const [name, value] of Object.entries(launcherStyle)) launcher.style.setProperty(name, value, 'important');
  let launcherHovered = false, launcherFocused = false;
  function updateLauncherEmphasis() {
    launcher.style.setProperty('opacity', launcherFocused ? '1' : launcherHovered ? '0.85' : '0.25', 'important');
    const colors = ui.themeTokens(uiSettings.theme);
    launcher.style.setProperty('background', launcherHovered ? colors['--hover'] : colors['--surface'], 'important');
  }
  launcher.addEventListener('pointerenter', () => { launcherHovered = true; updateLauncherEmphasis(); });
  launcher.addEventListener('pointerleave', () => { launcherHovered = false; updateLauncherEmphasis(); });
  launcher.addEventListener('click', event => { if (event.isTrusted) requestOpen(); });
  launcher.addEventListener('focus', () => {
    launcherFocused = true; updateLauncherEmphasis();
    launcher.style.setProperty('outline', '2px solid ' + ui.themeTokens(uiSettings.theme)['--accent'], 'important');
  });
  launcher.addEventListener('blur', () => {
    launcherFocused = false; updateLauncherEmphasis();
    launcher.style.setProperty('outline', 'none', 'important');
  });
  document.documentElement.append(launcher);
  function applyShellTheme() {
    const colors = ui.themeTokens(uiSettings.theme);
    launcher.style.setProperty('color', colors['--accent'], 'important');
    launcher.style.setProperty('border-color', colors['--strong-line'], 'important');
    launcher.style.setProperty('color-scheme', uiSettings.theme, 'important');
    updateLauncherEmphasis();
    if (launcherFocused) launcher.style.setProperty('outline', '2px solid ' + colors['--accent'], 'important');
    if (host) {
      host.style.setProperty('background', colors['--bg'], 'important');
      host.style.setProperty('border-color', colors['--strong-line'], 'important');
      host.style.setProperty('color-scheme', uiSettings.theme, 'important');
      host.style.setProperty('box-shadow', `0 8px 32px ${colors['--shadow']}`, 'important');
      frame.style.setProperty('background', colors['--bg']);
      frame.style.setProperty('color-scheme', uiSettings.theme);
    }
  }
  function applySettings(value) {
    if(disposed) return;
    uiSettings = ui.normalize(value); settingsReady = true;
    SpaceI18n.setLanguage(uiSettings.language);
    launcher.title=t('Open Space');launcher.setAttribute('aria-label',launcher.title);
    if(host) {host.setAttribute('aria-label',t('Space — tab sidebar'));frame.title=t('Space — sites and tabs');}
    applyShellTheme();
    for (const [name, setting] of Object.entries(ui.launcherStyles(uiSettings))) launcher.style.setProperty(name, setting, 'important');
    if (host) {
      for (const [name, setting] of Object.entries(ui.panelStyles(uiSettings))) host.style.setProperty(name, setting, 'important');
      host.style.setProperty('visibility', 'visible', 'important');
      if (visible && focusWhenReady) { focusWhenReady = false; frame.focus({ preventScroll: true }); }
    }
    if(uiSettings.panelMode==='push') hide();
    updateLauncherVisibility();
    launcher.style.setProperty('visibility', 'visible', 'important');
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.uiSettings) {
      ++settingsReadVersion;
      applySettings(changes.uiSettings.newValue);
    }
  });
  const settingsRequest = settingsReadVersion;
  chrome.storage.local.get('uiSettings').then(saved => {
    if (settingsRequest === settingsReadVersion) applySettings(saved.uiSettings);
  }).catch(() => {
    if (settingsRequest === settingsReadVersion) applySettings(undefined);
  });
  const dispose=()=>{disposed=true;visible=false;host?.remove();launcher.remove();};
  globalThis[key] = { apply, dispose };
  globalThis.__spaceOverlayActive={dispose};
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === chrome.runtime.id && message.type === 'space-overlay-visibility') {
      ++restoreRequest; // A live update supersedes an earlier bootstrap/BFCache query.
      apply(message);
    }
  });
  document.addEventListener('keydown', event => {
    if (visible && event.key === 'Escape' && !document.getElementById(`${chrome.runtime.id}-space-quick-search`)?.open) { event.preventDefault(); requestClose(); }
  });
  window.addEventListener('message', event => {
    if (frame && event.source === frame.contentWindow && event.data?.type === 'space-close-overlay') requestClose();
  });
  // BFCache restores retain this script; re-read current window visibility.
  function restore() {
    const request = ++restoreRequest;
    chrome.runtime.sendMessage({ type: 'space-overlay-state' }).then(state => {
      if (request === restoreRequest) apply(state, true);
    }).catch(() => {});
  }
  window.addEventListener('pageshow', restore);
  restore();
})();
