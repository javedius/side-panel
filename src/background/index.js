if(typeof importScripts==='function') importScripts('../shared/paths.js','../shared/ui-settings.js','../shared/messages.js','../shared/i18n.js','../search/model.js','../backup/model.js','search.js');
let panelMode='overlay',presentationVersion=0;
async function configurePresentation(value) {
  ++presentationVersion;
  panelMode=SpaceUi.normalize(value).panelMode;
  globalThis.SpaceI18n?.setLanguage(value?.language);
  await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:panelMode==='push'});
  await chrome.action.setTitle({title:SpaceI18n.t('Toggle Space')});
}
const settingsReady=chrome.storage.local.get('uiSettings').then(saved=>presentationVersion===0?configurePresentation(saved.uiSettings):undefined).catch(()=>presentationVersion===0?configurePresentation(undefined):undefined);
async function closeNative(windowId) {
  if(chrome.sidePanel.close) return chrome.sidePanel.close({windowId}).catch(()=>{});
  await chrome.sidePanel.setOptions({enabled:false});
  await chrome.sidePanel.setOptions({enabled:true});
}
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local'||!changes.uiSettings) return;
  configurePresentation(changes.uiSettings.newValue).then(async()=>{
    const tabs=await chrome.tabs.query({active:true});
    await Promise.allSettled(tabs.map(tab=>syncActiveTab(tab.id)));
  }).catch(console.error);
});
chrome.sidePanel.onOpened?.addListener(info=>{
  if(panelMode!=='push') return;
  changeVisibility(info.windowId,()=>true).then(state=>hideInWindow(info.windowId,state)).catch(()=>{});
});
chrome.sidePanel.onClosed?.addListener(info=>{
  if(panelMode!=='push') return;
  changeVisibility(info.windowId,()=>false).then(state=>hideInWindow(info.windowId,state)).catch(()=>{});
});
const visibilityChanges = new Map();
const stateKey = windowId => `space-overlay-window-${windowId}`;

function restricted(url) {
  try {
    const parsed = new URL(url);
    return !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.hostname === 'chromewebstore.google.com' ||
      (parsed.hostname === 'chrome.google.com' && parsed.pathname.startsWith('/webstore'));
  } catch { return true; }
}
async function readVisibility(windowId) {
  const key = stateKey(windowId);
  return { ...((await chrome.storage.session.get(key))[key] || { open: false, revision: 0 }), windowId };
}
function changeVisibility(windowId, change) {
  const operation = (visibilityChanges.get(windowId) || Promise.resolve()).catch(() => {}).then(async () => {
    const previous = await readVisibility(windowId);
    const open = change(previous.open);
    if (open === previous.open) return previous;
    const state = { open, revision: previous.revision + 1, windowId };
    await chrome.storage.session.set({ [stateKey(windowId)]: state });
    return state;
  });
  visibilityChanges.set(windowId, operation);
  return operation;
}
async function sendVisibility(tab, state, focus = false, ensureLauncher = false) {
  if (!tab?.id || restricted(tab.url)) return;
  if (state.open && panelMode!=='push' && chrome.sidePanel.close) {
    await chrome.sidePanel.close({ windowId: tab.windowId }).catch(() => {});
  }
  const message = { type: 'space-overlay-visibility', ...state, open:state.open&&tab.active, native:panelMode==='push', focus };
  try { await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }); }
  catch {
    if (!state.open && !ensureLauncher) return;
    // Existing tabs need injection once after an extension update. New pages
    // load the same singleton content script from the manifest.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [SpacePaths.paths, SpacePaths.settings, SpacePaths.messages, SpacePaths.i18n, SpacePaths.sidebar] });
    await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
  }
}
async function hideInWindow(windowId, state) {
  const tabs = await chrome.tabs.query({ windowId });
  await Promise.allSettled(tabs.map(tab => sendVisibility(tab, state)));
}
async function syncActiveTab(tabId) {
  await settingsReady;
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active) return;
  await visibilityChanges.get(tab.windowId)?.catch(() => {});
  await sendVisibility(tab, await readVisibility(tab.windowId), false, true);
}
chrome.action.onClicked.addListener(tab => {
  if(panelMode==='push') return;
  if (!tab.id) return;
  if (restricted(tab.url)) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
    changeVisibility(tab.windowId, () => true).catch(console.error);
    return;
  }
  (async () => {
    await settingsReady;
    if(panelMode==='push') return; // Chrome toggles the native panel under the action gesture.
    const state = await changeVisibility(tab.windowId, open => !open);
    if (state.open) await sendVisibility(tab, state, true);
    else await hideInWindow(tab.windowId, state);
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    await chrome.action.setTitle({ tabId: tab.id, title: SpaceI18n.t('Toggle Space') });
  })().catch(async error => {
    console.error('Space overlay unavailable:', error);
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' }).catch(() => {});
    await chrome.action.setTitle({ tabId: tab.id, title: SpaceI18n.t('Space: check site access, refresh the page, and try again.') }).catch(() => {});
  });
});
chrome.tabs.onActivated.addListener(({ tabId }) => { syncActiveTab(tabId).catch(() => {}); });
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) syncActiveTab(tabId).catch(() => {});
});
chrome.tabs.onAttached.addListener(tabId => { syncActiveTab(tabId).catch(() => {}); });
chrome.windows.onRemoved.addListener(windowId => {
  // Finish pending writes before dropping the closed window's session state.
  (visibilityChanges.get(windowId) || Promise.resolve()).catch(() => {}).then(() =>
    chrome.storage.session.remove(stateKey(windowId))).catch(() => {});
  visibilityChanges.delete(windowId);
});
chrome.runtime.onInstalled.addListener(() => {
  // Create launchers on already-open active pages after installation/update.
  chrome.tabs.query({ active: true }).then(tabs =>
    Promise.allSettled(tabs.map(tab => syncActiveTab(tab.id)))).catch(() => {});
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if(sender.id!==chrome.runtime.id) return;
  if(message.type==='space-backup-import') {
    if(sender.url?.split('?')[0]!==chrome.runtime.getURL(SpacePaths.panel)||!Number.isInteger(message.windowId)||sender.tab&&sender.tab.windowId!==message.windowId) return;
    let data;
    try {data=SpaceBackup.validateData(message.data);} catch(error) {respond({error:error.message});return;}
    const previous=panelMode;
    // Start native opening while the Import confirmation still grants user activation.
    const opening=data.uiSettings.panelMode==='push'?chrome.sidePanel.open({windowId:message.windowId}):Promise.resolve();
    (async()=>{
      try {
        await opening;
        const old=await chrome.storage.local.get(['sites','spaceConfig','uiSettings','lastBackupImport']);
        if(typeof message.operationId==='string'&&old.lastBackupImport===message.operationId) {respond({ok:true});return;}
        const backupBeforeImport=SpaceBackup.create({sites:old.sites||[],spaceConfig:old.spaceConfig||{spaces:[],expandedIds:[]},uiSettings:SpaceUi.normalize(old.uiSettings)});
        await chrome.storage.local.set({...data,backupBeforeImport,...(typeof message.operationId==='string'?{lastBackupImport:message.operationId}:{})});
      } catch {
        if(previous!=='push'&&data.uiSettings.panelMode==='push') await closeNative(message.windowId);
        respond({error:'Could not restore the backup. Your current data is unchanged.'});return;
      }
      // Data is committed. Presentation refresh failure must not suggest retrying an import.
      let warning;
      try {
        await configurePresentation(data.uiSettings);
        if(data.uiSettings.panelMode==='overlay') await closeNative(message.windowId);
        const state=await changeVisibility(message.windowId,()=>true);await hideInWindow(message.windowId,state);
      } catch {warning='Backup restored. Reopen the panel to refresh its appearance.';}
      respond({ok:true,warning});
    })();return true;
  }
  if(message.type==='space-settings-save') {
    const ownPanel=sender.url?.split('?')[0]===chrome.runtime.getURL(SpacePaths.panel);
    if(!ownPanel||!Number.isInteger(message.windowId)||sender.tab&&sender.tab.windowId!==message.windowId) return;
    const next=SpaceUi.normalize(message.settings),previous=panelMode;
    // Must start before any await: Chrome requires the Save click's user activation.
    const opening=next.panelMode==='push'?chrome.sidePanel.open({windowId:message.windowId}):Promise.resolve();
    (async()=>{
      try {
        await opening;
        await chrome.storage.local.set({uiSettings:next});
        await configurePresentation(next);
        if(next.panelMode==='overlay') await closeNative(message.windowId);
        const state=await changeVisibility(message.windowId,()=>true);
        await hideInWindow(message.windowId,state);
        respond({ok:true});
      } catch {
        if(previous!=='push'&&next.panelMode==='push') await closeNative(message.windowId);
        respond({error:'Could not change the panel mode. Try again.'});
      }
    })();
    return true;
  }
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) return;
  const windowId = sender.tab.windowId;
  if (message.type === 'space-overlay-state') {
    (async () => {
      await visibilityChanges.get(windowId)?.catch(() => {});
      const state = await readVisibility(windowId);
      const tab = await chrome.tabs.get(sender.tab.id);
      // Avoid building panel iframes in every background tab at page load.
      respond({ ...state, native:panelMode==='push', open: state.open && tab.active });
    })().catch(() => respond({ open: false, revision: 0, windowId }));
    return true;
  }
  if (message.type === 'space-overlay-open') {
    if(!sender.tab.active||restricted(sender.tab.url)) {respond({error:'This page is unavailable'});return;}
    // Open synchronously from the trusted content-script click; navigation sync never opens it.
    const opening=message.native===true||panelMode==='push'?chrome.sidePanel.open({windowId}):Promise.resolve();
    (async () => {
      await opening;
      await settingsReady;
      const tab = await chrome.tabs.get(sender.tab.id);
      if (!tab.active || restricted(tab.url)) { respond({ error: 'This page is unavailable' }); return; }
      const state = await changeVisibility(tab.windowId, () => true);
      await sendVisibility(tab, state); // The clicked launcher handles keyboard focus after the response.
      respond({...state,native:panelMode==='push'});
    })().catch(() => respond({ error: 'Could not open the panel' }));
    return true;
  }
  if (message.type === 'space-overlay-close') {
    (async () => {
      const state = await changeVisibility(windowId, () => false);
      await hideInWindow(windowId, state);
      respond(state);
    })().catch(() => respond({ error: 'Could not save the panel state' }));
    return true;
  }
});

// Quick search has its own isolated UI and session lifecycle.
globalThis.SpaceQuickSearch?.install(chrome,SpaceUi,restricted);
