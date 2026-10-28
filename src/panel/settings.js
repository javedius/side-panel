import '../shared/messages.js';
import '../shared/i18n.js';
const t=(key,values)=>globalThis.SpaceI18n.t(key,values);
export function installSettings({ extension, getSettings, setSettings, getController, closeSiteMenus, notify }) {
  const $ = id => document.getElementById(id);
  let settingsOpener = null;
  function openSettings() {
    closeSiteMenus(); settingsOpener=document.activeElement;
    $('language').value=getSettings().language;
    $('panel-theme').value=getSettings().theme;
    $('search-engine').value=getSettings().searchEngine;
    $('panel-mode').value=getSettings().panelMode;
    updateModeHint();
    $('show-launcher').checked=getSettings().showLauncher;
    $('launcher-position').disabled=!getSettings().showLauncher;
    $('panel-side').value=getSettings().side; $('launcher-position').value=getSettings().launcherPosition;
    $('settings-error').textContent=''; $('settings-dialog').showModal(); $('language').focus();refreshShortcut();
  }
  let shortcutRead=0;
  async function refreshShortcut() {
    const request=++shortcutRead;
    for(const id of ['panel-shortcut','search-shortcut']) {$(id).textContent='…';$(id).title='';}
    $('shortcut-hint').hidden=true;$('configure-shortcut').disabled=!extension;
    if(!extension||!chrome.commands?.getAll) {
      $('panel-shortcut').textContent='—';$('search-shortcut').textContent='—';return;
    }
    try {
      const commands=await chrome.commands.getAll();
      if(request!==shortcutRead||!$('settings-dialog').open) return;
      let unassigned=false;
      for(const [id,name] of [['panel-shortcut','_execute_action'],['search-shortcut','quick-search']]) {
        const shortcut=commands.find(command=>command.name===name)?.shortcut||'';
        $(id).textContent=shortcut||t('Not assigned');$(id).title=shortcut||t('Not assigned');
        if(!shortcut) unassigned=true;
      }
      if(unassigned) {$('shortcut-hint').textContent=t('Assign missing shortcuts in Chrome extension settings.');$('shortcut-hint').hidden=false;}
    } catch {
      if(request!==shortcutRead||!$('settings-dialog').open) return;
      $('panel-shortcut').textContent='—';$('search-shortcut').textContent='—';$('shortcut-hint').textContent=t('Could not read the shortcut.');$('shortcut-hint').hidden=false;
    }
  }
  $('configure-shortcut').addEventListener('click',async()=>{
    if(!extension||$('configure-shortcut').disabled) return;
    $('configure-shortcut').disabled=true;
    try {await chrome.tabs.create({url:'chrome://extensions/shortcuts',...(getController()?{windowId:getController().windowId}:{})});}
    catch {$('shortcut-hint').textContent=t('Could not open keyboard shortcut settings. Try again.');$('shortcut-hint').hidden=false;}
    finally {$('configure-shortcut').disabled=false;}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden'&&$('settings-dialog').open) refreshShortcut();});
  if(globalThis.window) window.addEventListener('focus',()=>{if($('settings-dialog').open) refreshShortcut();});
  function closeSettings() {
    $('settings-dialog').close();
    if(settingsOpener?.isConnected) settingsOpener.focus(); else $('panel-menu-trigger').focus();
  }
  function updateModeHint() {
    const native=$('panel-mode').value==='push';
    $('panel-side').disabled=native;$('native-panel-hint').hidden=!native;
  }
  $('panel-mode').addEventListener('change',updateModeHint);
  document.getElementById('settings').addEventListener('click',()=>{closeSiteMenus(true);openSettings();});
  $('show-launcher').addEventListener('change',()=>{$('launcher-position').disabled=!$('show-launcher').checked;});
  document.getElementById('settings-cancel').addEventListener('click',closeSettings);
  $('settings-dialog').addEventListener('cancel',event=>{event.preventDefault();if(!$('settings-save').disabled) closeSettings();});
  document.getElementById('settings-form').addEventListener('submit',async event=>{
    event.preventDefault(); if($('settings-save').disabled) return;
    const next=SpaceUi.normalize({language:$('language').value,searchEngine:$('search-engine').value,panelMode:$('panel-mode').value,showLauncher:$('show-launcher').checked,theme:$('panel-theme').value,side:$('panel-side').value,launcherPosition:$('launcher-position').value});
    $('settings-save').disabled=true; $('settings-cancel').disabled=true;
    try {
      if(extension&&next.panelMode!==getSettings().panelMode&&chrome.runtime?.sendMessage&&getController()) {
        const result=await chrome.runtime.sendMessage({type:'space-settings-save',settings:next,windowId:getController().windowId});
        if(!result?.ok) throw Error(result?.error||t('Could not change the panel mode.'));
      } else if(extension) await chrome.storage.local.set({uiSettings:next});
      else localStorage.setItem('space-ui-settings',JSON.stringify(next));
      setSettings(next); closeSettings(); notify(t('Settings saved'));
    } catch {$('settings-error').textContent=t('Could not save settings. Try again.');}
    finally {$('settings-save').disabled=false;$('settings-cancel').disabled=false;}
  });
}
