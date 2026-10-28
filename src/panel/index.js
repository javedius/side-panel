import '../shared/messages.js';
import '../shared/i18n.js';
import {installSettings} from './settings.js';
import {createMenus} from './menus.js';
import {createDragAndDrop} from './drag-drop.js';
import '../shared/paths.js';
import '../shared/ui-settings.js';
import { normalizeSpaceConfig, assignSitesToSpaces, validateSpaceName } from '../spaces/model.js';
import { MediaController } from '../media/controller.js';
import { TabsController } from '../tabs/controller.js';
import { transferSite } from '../sites/transfers.js';
import { installBackup } from '../backup/dialog.js';
const t=(key,values)=>globalThis.SpaceI18n.t(key,values);
const $ = (id) => document.getElementById(id);
const extension = Boolean(globalThis.chrome?.storage?.local);
const overlayMode=Boolean(globalThis.window && window.parent!==window && new URLSearchParams(window.location.search).has('overlay'));
function closeOverlay() { window.parent.postMessage({type:'space-close-overlay'},'*'); }
document.getElementById('close-overlay').addEventListener('click',closeOverlay);
if(overlayMode) {
  $('close-overlay').hidden=false;
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!$('editor').open&&!$('space-editor').open&&!$('space-delete-dialog').open&&!$('settings-dialog').open&&!$('backup-dialog').open&&!document.querySelector('.site-menu[open]')) {event.preventDefault();closeOverlay();}
  });
}
const defaults = [
  ['Google','https://google.com','G','#dce7fb','#3264bf'],
  ['Mail','https://mail.google.com','M','#eee0de','#bc4d42'],
  ['YouTube','https://youtube.com','▶','#f13748','#fff'],
  ['Yandex','https://ya.ru','Y','#ebe7de','#b44838'],
  ['ChatGPT','https://chatgpt.com','◉','#d2ded6','#304b40'],
  ['GitHub','https://github.com','⌘','#dbd7e7','#514467'],
  ['Ozon','https://ozon.ru','O','#2964ec','#fff'],
  ['Figma','https://figma.com','F','#e5d1c5','#8f4837'],
  ['Music','https://music.yandex.ru','♪','#eadb9d','#5b4d14']
].map(([name,url,icon,bg,color])=>({id:crypto.randomUUID(),name,url,icon,bg,color,section:'favorites'}));
let sites=[], editing=false, editId=null, opener=null, removed=null, timer;
let controller=null, tabRefreshTimer;
let spaceConfig=normalizeSpaceConfig(), editingSpaceId=null, spaceOpener=null;
let spaceChanges=Promise.resolve(), deletingSpaceId=null, deleteOpener=null, pendingSiteEditor=null;
let mediaController=null,mediaState=null;
let uiSettings=SpaceUi.normalize();
let transferring=false;
const menus=createMenus({notify});
const {actionMenu,closeSiteMenus,configureMenu}=menus;
const dragAndDrop=createDragAndDrop({closeSiteMenus,moveItem,notify,isBusy:()=>transferring,onDragEnd:()=>render()});
const {bindDrag,bindDrop}=dragAndDrop;
const dialog=$('editor');
async function readUiSettings() {
  if(extension) return (await chrome.storage.local.get('uiSettings')).uiSettings;
  const value=localStorage.getItem('space-ui-settings'); return value?JSON.parse(value):undefined;
}
installSettings({extension,getSettings:()=>uiSettings,setSettings:value=>{uiSettings=value;applyAppearance();render();},getController:()=>controller,closeSiteMenus,notify});
$('backup-open').addEventListener('click',()=>closeSiteMenus(true));
function readBackupData() {
  if(extension) return chrome.storage.local.get(['sites','spaceConfig','uiSettings','backupBeforeImport']).then(saved=>({...saved,sites:saved.sites||[],spaceConfig:normalizeSpaceConfig(saved.spaceConfig),uiSettings:SpaceUi.normalize(saved.uiSettings)}));
  return Promise.resolve({sites,spaceConfig,uiSettings,backupBeforeImport:JSON.parse(localStorage.getItem('space-backup-before-import')||'null')});
}
function applyBackupData(data,operationId) {
  const operation=extension?chrome.runtime.sendMessage({type:'space-backup-import',windowId:controller.windowId,data,operationId}):Promise.resolve().then(()=>{
    const previous=SpaceBackup.create({sites,spaceConfig,uiSettings});
    localStorage.setItem('space-backup-before-import',JSON.stringify(previous));
    localStorage.setItem('space-sites',JSON.stringify(data.sites));localStorage.setItem('space-config',JSON.stringify(data.spaceConfig));localStorage.setItem('space-ui-settings',JSON.stringify(data.uiSettings));
    return {ok:true};
  });
  return operation.then(async result=>{
    if(!result?.ok) return {error:result?.error||t('Could not restore the backup. Try again.')};
    let committed=data;
    try {committed=await readBackupData();}catch{/* Data was committed; render the validated snapshot if rereading fails. */}
    sites=committed.sites;spaceConfig=committed.spaceConfig;uiSettings=committed.uiSettings;removed=null;
    applyAppearance();render();
    if(controller){try{await controller.refresh(sites);}catch{scheduleRefresh();}}render();
    return result;
  });
}
installBackup({readData:readBackupData,applyData:applyBackupData,notify});
async function read(){if(extension)return (await chrome.storage.local.get('sites')).sites;const value=localStorage.getItem('space-sites');return value?JSON.parse(value):undefined;}
async function write(next) {
  next=assignSitesToSpaces(next,spaceConfig);
  const invalid=sites.filter(old=>!next.some(site=>site.id===old.id&&site.url===old.url)).map(site=>site.id);
  if(extension) await chrome.storage.local.set({sites:next});
  else localStorage.setItem('space-sites',JSON.stringify(next));
  sites=next;
  if(controller) {
    try { await controller.forget(invalid); await controller.refresh(sites); }
    catch { notify(t('Site saved. Refresh the panel to see tabs.')); }
  }
  render();
}
async function readSpaceConfig() {
  if(extension) return (await chrome.storage.local.get('spaceConfig')).spaceConfig;
  const value=localStorage.getItem('space-config'); return value?JSON.parse(value):undefined;
}
function changeSpaceConfig(change) {
  const operation=spaceChanges.catch(()=>{}).then(async()=>{
    const base=normalizeSpaceConfig(await readSpaceConfig());
    const next=change(base);
    if(JSON.stringify(base)===JSON.stringify(next)) return;
    if(extension) await chrome.storage.local.set({spaceConfig:next});
    else localStorage.setItem('space-config',JSON.stringify(next));
    spaceConfig=next; render();
  });
  spaceChanges=operation; return operation;
}
function openSpaceEditor(id=null) {
  closeSiteMenus(); spaceOpener=document.activeElement; editingSpaceId=id;
  const space=spaceConfig.spaces.find(item=>item.id===id);
  SpaceI18n.text($('space-dialog-title'),space?'Rename space':'Create space');
  SpaceI18n.text($('space-save'),space?'Save':'Create');
  $('space-name').value=space?.name||''; $('space-error').textContent='';
  $('space-name').removeAttribute('aria-invalid');
  $('space-editor').showModal(); $('space-name').focus();
}
function closeSpaceEditor() {
  $('space-editor').close();
  if(spaceOpener?.isConnected) spaceOpener.focus(); else $('create-space').focus();
}
document.getElementById('create-space').addEventListener('click',()=>openSpaceEditor());
document.getElementById('space-cancel').addEventListener('click',()=>{pendingSiteEditor=null;closeSpaceEditor();});
$('space-editor').addEventListener('cancel',event=>{event.preventDefault();if(!$('space-save').disabled) {pendingSiteEditor=null;closeSpaceEditor();}});
document.getElementById('space-form').addEventListener('submit',async event=>{
  event.preventDefault(); if($('space-save').disabled) return;
  const name=$('space-name').value.trim();
  const error=validateSpaceName(name,spaceConfig.spaces,editingSpaceId);
  if(error) {$('space-error').textContent=t(error);$('space-name').setAttribute('aria-invalid','true');$('space-name').focus();return;}
  $('space-name').removeAttribute('aria-invalid'); $('space-save').disabled=true;
  const targetId=editingSpaceId;
  const id=targetId||crypto.randomUUID();
  $('space-cancel').disabled=true;
  try {
    await changeSpaceConfig(base=>{
      const conflict=validateSpaceName(name,base.spaces,targetId);
      if(conflict) throw Error(conflict);
      if(targetId&&!base.spaces.some(space=>space.id===targetId)) throw Error('This space no longer exists.');
      return {...base,spaces:targetId?base.spaces.map(space=>space.id===id?{...space,name}:space):[...base.spaces,{id,name}],
        expandedIds:targetId?base.expandedIds:[...base.expandedIds,id]};
    });
    closeSpaceEditor(); notify(targetId?t('Space renamed'):t('Space created'));
    if(pendingSiteEditor) {const request=pendingSiteEditor;pendingSiteEditor=null;openEditor(request.section,request.site,id);}
  } catch(error) {$('space-error').textContent=(error.message?.startsWith('A space ')||error.message?.startsWith('This space '))?t(error.message):t('Could not save the space. Try again.');}
  finally {$('space-save').disabled=false;$('space-cancel').disabled=false;}
});
function renderSpaceOptions() {
  const selected=$('site-space').value;
  $('site-space').replaceChildren(...spaceConfig.spaces.map(space=>{
    const option=document.createElement('option'); option.value=space.id; option.textContent=space.name; return option;
  }));
  $('site-space').value=spaceConfig.spaces.some(space=>space.id===selected)?selected:spaceConfig.spaces[0]?.id||'';
  $('site-space').disabled=document.querySelector('input[name="section"]:checked')?.value!=='space';
}
for(const radio of document.querySelectorAll('input[name="section"]')) radio.addEventListener('change',()=>{
  $('site-space').disabled=document.querySelector('input[name="section"]:checked')?.value!=='space';
});
function spaceNode(space) {
  const members=sites.filter(site=>site.section==='space'&&site.spaceId===space.id);
  const wrapper=document.createElement('div'); wrapper.className='space-group';
  const details=document.createElement('details'); details.className='space-disclosure';
  details.dataset.spaceId=space.id; details.open=spaceConfig.expandedIds.includes(space.id);
  const summary=document.createElement('summary'); summary.dataset.focusKey='space-'+space.id;
  summary.title=space.name;
  const name=document.createElement('span'); name.className='space-group-name'; name.textContent=space.name;
  const count=document.createElement('span'); count.className='space-group-count'; count.textContent=members.length?String(members.length):'';
  summary.append(name,count);
  const items=document.createElement('div'); items.className='space-items';
  items.append(...members.map(site=>siteNode(site,false)));
  if(!members.length) items.append(emptyState(t('No sites yet. Add a site from the ⋯ menu.')));
  details.append(summary,items);
  details.addEventListener('toggle',async()=>{
    if(!details.isConnected||spaceConfig.expandedIds.includes(space.id)===details.open) return;
    const opened=details.open;
    if(!opened) closeSiteMenus();
    try {await changeSpaceConfig(base=>({...base,expandedIds:opened?[...new Set([...base.expandedIds,space.id])]:base.expandedIds.filter(id=>id!==space.id)}));}
    catch {render();notify(t('Could not save the space state. Try again.'));}
  });
  const menu=actionMenu('space:'+space.id,t('Actions for space {name}',{name:space.name}), [
    {label:t('Add site'),key:'add-to-space-'+space.id,dialog:true,run:()=>openEditor('space',null,space.id)},
    {label:t('Rename'),key:'rename-space-'+space.id,dialog:true,run:()=>openSpaceEditor(space.id)},
    {label:t('Delete space'),key:'delete-space-'+space.id,danger:true,dialog:true,run:()=>openSpaceDelete(space.id)}
  ]);
  const actions=document.createElement('div');actions.className='space-group-actions';actions.append(menu);
  wrapper.append(details,actions);bindDrop(wrapper,()=>({section:'space',spaceId:space.id}));return wrapper;
}
function notify(message,undo=false){clearTimeout(timer);$('status-text').textContent=message;$('undo').hidden=!undo;$('status').hidden=false;timer=setTimeout(()=>{$('status').hidden=true;},undo?12000:4000);}
function icon(site){const el=document.createElement('span');el.className='site-icon';el.textContent=site.icon||new URL(site.url).hostname.replace(/^www\./,'')[0].toUpperCase();el.style.setProperty('--icon-bg',site.bg||'var(--icon-default-bg)');el.style.setProperty('--icon-color',site.color||'var(--icon-default-text)');el.setAttribute('aria-hidden','true');return el;}
function favoriteIcon(site) {
  const el=document.createElement('span');el.className='site-icon favorite-favicon';el.setAttribute('aria-hidden','true');
  const fallback=document.createElement('span');fallback.className='favicon-fallback';el.append(fallback);
  try {
    const page=new URL(site.url);
    if(!['http:','https:'].includes(page.protocol)||!globalThis.chrome?.runtime?.getURL) return el;
    const source=new URL(chrome.runtime.getURL('_favicon/'));
    source.searchParams.set('pageUrl',page.href);source.searchParams.set('size','64');
    const img=document.createElement('img');img.alt='';img.width=24;img.height=24;
    img.hidden=true;img.decoding='async';img.referrerPolicy='no-referrer';
    img.addEventListener('load',()=>{img.hidden=false;fallback.hidden=true;});
    img.addEventListener('error',()=>{img.hidden=true;fallback.hidden=false;});
    el.append(img);img.src=source.href;
  } catch { /* Invalid/preview URLs retain the neutral website mark. */ }
  return el;
}
function host(url) {
  try { return new URL(url).hostname || url; } catch { return url || t('New tab'); }
}
async function removeSavedSite(id) {
  const index=sites.findIndex(site=>site.id===id);
  if(index<0) return;
  const site=sites[index];
  await write(sites.filter(item=>item.id!==id));
  removed={site,index};
  menus.openKey=null;
  notify(site.section==='space'?t('Site removed from the space'):t('Site removed from favorites'),true);
}
function siteMenu(site) {
  const tab=controller?.linked(site);
  const commands=[
    {label:t('Edit site'),key:'edit-site-'+site.id,dialog:true,run:()=>openEditor(site.section,site)},
    {label:site.section==='space'?t('Remove from space'):t('Remove from favorites'),key:'remove-site-'+site.id,danger:true,
      run:()=>removeSavedSite(site.id),error:t('Could not remove the site. Try again.')}
  ];
  if(tab) commands.push({label:t('Close tab'),key:'close-site-'+site.id,run:()=>closeTab(tab)});
  const siblings=sites.filter(item=>item.section===site.section&&(site.section==='favorites'||item.spaceId===site.spaceId));
  const index=siblings.findIndex(item=>item.id===site.id);
  if(index>0) commands.push({label:t('Move up'),key:'move-up-'+site.id,run:()=>moveItem({kind:'site',id:site.id},{section:site.section,spaceId:site.spaceId,beforeId:siblings[index-1].id})});
  if(index<siblings.length-1) commands.push({label:t('Move down'),key:'move-down-'+site.id,run:()=>moveItem({kind:'site',id:site.id},{section:site.section,spaceId:site.spaceId,beforeId:siblings[index+1].id,after:true})});
  // Saved-site IDs retain the existing focus/open-state keys across updates.
  const menu=actionMenu(site.id,t('Actions for site {name}',{name:site.name}),commands);
  menu.dataset.siteId=site.id;return menu;
}
configureMenu($('panel-menu'),'panel',$('panel-menu-trigger'),$('panel-menu-actions'));
async function moveItem(source,destination) {
  if(transferring) throw Error(t('Wait for the move to finish.'));
  transferring=true;
  try {
    let tab;
    if(source.kind==='tab') {
      tab=(await chrome.tabs.query({windowId:controller.windowId})).find(item=>item.id===source.id);
      source={...source,newId:crypto.randomUUID()};
    }
    await mutateSpaceData((config,current)=>transferSite(current,config,source,destination,tab));
    notify(source.kind==='tab'?t('Tab saved'):t('Site moved'));
  } finally {transferring=false;}
}
bindDrop($('favorites'),()=>({section:'favorites'}));
for(const id of ['spaces-scroll','tabs-scroll']) document.getElementById(id).addEventListener('scroll',()=>closeSiteMenus());
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.querySelector('.site-menu[open]')) {
    event.preventDefault(); closeSiteMenus(true);
  }
});
document.addEventListener('click',event=>{
  if(!event.target.closest('.site-menu')) closeSiteMenus();
});
function rememberFocus(draw) {
  const offsets=['spaces-scroll','tabs-scroll'].map(id=>({node:$(id),top:$(id).scrollTop}));
  const focused=document.activeElement?.dataset.focusKey;
  for(const menu of document.querySelectorAll('.site-menu[open]')) {try {menu.querySelector('[popover]')?.hidePopover();} catch {}}
  draw();
  for(const menu of document.querySelectorAll('.site-menu[open]')) menu.showActions?.();
  for(const {node,top} of offsets) node.scrollTop=top;
  if(focused) {
    const target=Array.from(document.querySelectorAll('[data-focus-key]'))
      .find(node=>node.dataset.focusKey===focused);
    target?.closest?.('.site-menu')?.showActions?.();
    (target||document.querySelector('.tab-link')||$('panel-menu-trigger')).focus({preventScroll:true});
  }
}
async function refreshTabs() {
  if(!controller) return;
  try {
    await controller.refresh(sites);
    $('tabs-error').hidden=true;
    render();
  } catch { $('tabs-error').hidden=false; }
  finally { $('tabs').setAttribute('aria-busy','false'); }
}
function scheduleRefresh() {
  clearTimeout(tabRefreshTimer);
  tabRefreshTimer=setTimeout(refreshTabs,60);
}
async function closeTab(tab) {
  await chrome.tabs.remove(tab.id);
  notify(t('Tab closed. Reopen: {shortcut}',{shortcut:/Mac/.test(navigator.platform)?'⌘⇧T':'Ctrl+Shift+T'}));
  await refreshTabs();
}
function siteNode(site,tile) {
  const tab=controller?.linked(site);
  const wrapper=document.createElement('div');
  wrapper.className=tile?'tile-wrap':'site-row-wrap';
  if(tab) wrapper.classList.add('is-open');
  if(tab?.active) wrapper.classList.add('is-active');
  const el=document.createElement(editing||extension?'button':'a');
  el.className=tile?'tile':'space-row'; el.dataset.focusKey='site-'+site.id;
  if(el.tagName==='BUTTON') el.type='button';
  else {el.href=site.url; el.target='_blank'; el.rel='noopener';}
  el.setAttribute('aria-label',editing?t('Edit {name}',{name:site.name}):
    site.name+(tab?.active?t(', current tab'):tab?t(', open'):t(', open site')));
  if(tab?.active) el.setAttribute('aria-current','page');
  el.title=site.name+' · '+(tab?.url||site.url);
  el.append(tile?favoriteIcon(site):icon(site));
  const copy=document.createElement('span'); copy.className=tile?'site-name':'site-copy';
  if(tile) copy.textContent=site.name;
  else {
    const name=document.createElement('strong'); name.textContent=site.name;
    const detail=document.createElement('small');
    detail.textContent=tab?.active?t('Current tab'):tab?(tab.title||host(tab.url)):host(site.url);
    copy.append(name,detail);
  }
  el.append(copy);
  bindDrag(el,{kind:'site',id:site.id});
  bindDrop(wrapper,()=>({section:site.section,spaceId:site.spaceId,beforeId:site.id}));
  if(tab) {
    const state=document.createElement('span'); state.className='open-dot';
    state.setAttribute('aria-hidden','true'); el.append(state);
  }
  if(editing&&!tile) {
    const mark=document.createElement('span'); mark.className='edit-mark'; mark.textContent=t('Edit'); el.append(mark);
  }
  el.addEventListener('click',async(event)=>{
    if(editing){event.preventDefault();openEditor(site.section,site);return;}
    if(!controller) return;
    event.preventDefault(); el.disabled=true;
    try { await controller.open(site,()=>sites); await refreshTabs(); }
    catch { notify(t('Could not open the site. Try again.')); }
    finally { el.disabled=false; }
  });
  wrapper.append(el);
  if(!editing) wrapper.append(siteMenu(site));
  return wrapper;
}
function renderTabs() {
  if(!extension) {
    $('tabs').replaceChildren(emptyState(t('Your open tabs appear here when Space runs in Chrome.')));
    $('new-tab').disabled=true; $('tabs').setAttribute('aria-busy','false'); return;
  }
  if(!controller) return;
  const tabs=controller.ordinary();
  $('tab-count').textContent=tabs.length||'';
  $('tabs').replaceChildren(...tabs.map(tab=>{
    const row=document.createElement('div'); row.className='tab-row';
    if(tab.active) row.classList.add('is-active');
    const button=document.createElement('button'); button.type='button'; button.className='tab-link';
    button.dataset.focusKey='tab-'+tab.id;
    const name=tab.title||host(tab.url);
    button.title=name+' · '+(tab.url||'');
    button.setAttribute('aria-label',name+(tab.active?t(', current tab'):''));
    if(tab.active) button.setAttribute('aria-current','page');
    button.append(icon({name,url:tab.url||'https://example.com',icon:host(tab.url)[0]?.toUpperCase()||'◧'}));
    const label=document.createElement('span'); label.className='tab-name'; label.textContent=name;
    button.append(label);
    if(/^https?:/.test(tab.url||'')) bindDrag(button,{kind:'tab',id:tab.id});
    if(tab.audible) {
      const audio=document.createElement('span'); audio.className='audio-indicator';
      audio.textContent='♪'; audio.setAttribute('aria-label',t('Playing audio')); button.append(audio);
    }
    button.addEventListener('click',async()=>{
      try {await chrome.tabs.update(tab.id,{active:true});await refreshTabs();}
      catch {notify(t('This tab is closed or unavailable.'));scheduleRefresh();}
    });
    const commands=[];
    if(/^https?:/.test(tab.url||'')) commands.push({label:t('Save to a space'),key:'save-tab-'+tab.id,dialog:true,run:()=>{
      openEditor('space',{name,url:tab.url});editId=null;$('remove').hidden=true;
      SpaceI18n.text($('dialog-title'),'Save tab');
    }});
    commands.push({label:t('Close tab'),key:'close-tab-'+tab.id,run:()=>closeTab(tab)});
    row.append(button,actionMenu('tab:'+tab.id,t('Actions for tab {name}',{name}),commands,'tabs-scroll'));return row;
  }));
  if(!tabs.length) $('tabs').append(emptyState(t('Other open tabs appear here. Saved sites stay in Favorites and Spaces.')));
}
function emptyState(text) {
  const p=document.createElement('p'); p.className='empty-state'; p.textContent=text; return p;
}
function render() {
  // Replacing a dragged DOM node cancels the browser's native drag operation.
  if(dragAndDrop.isDragging) return;
  rememberFocus(()=>{
    document.body.classList.toggle('editing',editing);
    $('manage').textContent=editing?t('Finish editing'):t('Edit favorites');
    $('manage').setAttribute('aria-label',editing?t('Finish editing'):t('Edit sites'));
    $('manage').title=editing?t('Done'):t('Edit sites');
    $('manage').setAttribute('aria-pressed',String(editing));
    const menuKeys=new Set(['panel',...sites.map(site=>site.id),...spaceConfig.spaces.map(space=>'space:'+space.id),...(controller?.ordinary()||[]).map(tab=>'tab:'+tab.id)]);
    if(!menuKeys.has(menus.openKey)||(editing&&menus.openKey!=='panel')) menus.openKey=null;
    const favorites=sites.filter(s=>s.section==='favorites');
    $('favorites').classList.toggle('is-empty',!favorites.length);
    $('favorites').replaceChildren(...favorites.map(s=>siteNode(s,true)));
    if(favorites.length<9) {
      const add=document.createElement('button'); add.className='tile empty-tile';
      add.dataset.focusKey='add-favorite';
      add.setAttribute('aria-label',t('Add a site to favorites')); add.textContent='+';
      add.addEventListener('click',()=>openEditor('favorites')); $('favorites').append(add);
    }
    $('spaces').replaceChildren(...spaceConfig.spaces.map(spaceNode));
    if(!spaceConfig.spaces.length) $('spaces').append(emptyState(t('Create a space for work, personal projects, or hobbies.')));
    renderSpaceOptions();
    renderTabs();
  });
}
function openEditor(section, site = null, spaceId = null) {
  if (section === 'space' && !spaceConfig.spaces.length) {
    pendingSiteEditor = { section, site };
    openSpaceEditor();
    notify(t('Create a space to save this site.'));
    return;
  }
  opener = document.activeElement;
  editId = site?.id || null;
  SpaceI18n.text($('dialog-title'),site?.id?'Edit site':'Add site');
  $('name').value = site?.name || '';
  $('url').value = site?.url || '';
  $('remove').hidden = !site?.id;
  $('form-error').textContent = '';
  $('url').removeAttribute('aria-invalid');
  $('site-space').value = site?.spaceId || spaceId || spaceConfig.spaces[0]?.id || '';
  $('site-space').disabled = section !== 'space';
  document.querySelector(`input[name="section"][value="${section}"]`).checked = true;
  dialog.showModal();
  $('name').focus();
}
function close() {
  dialog.close();
  if (opener?.isConnected) opener.focus();
  else $('panel-menu-trigger').focus();
}
$('cancel').addEventListener('click', close);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  close();
});
$('manage').addEventListener('click', () => {
  closeSiteMenus(true);
  editing = !editing;
  render();
});
$('site-form').addEventListener('submit', async event => {
  event.preventDefault();
  let url;
  try {
    const raw = $('url').value.trim();
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : 'https://' + raw);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw Error();
  } catch {
    $('form-error').textContent = t('Enter a site address, such as example.com');
    $('url').setAttribute('aria-invalid', 'true');
    $('url').focus();
    return;
  }
  $('url').removeAttribute('aria-invalid');
  const section = document.querySelector('input[name="section"]:checked').value;
  if (section === 'favorites' && sites.filter(site => site.section === 'favorites' && site.id !== editId).length >= 9) {
    $('form-error').textContent = t('All 9 slots are taken. Choose a space or move a favorite to one.');
    return;
  }
  if (section === 'space' && !spaceConfig.spaces.some(space => space.id === $('site-space').value)) {
    $('form-error').textContent = t('Create a space for this site first.');
    return;
  }
  const old = sites.find(site => site.id === editId);
  const next = {
    ...old,
    id: editId || crypto.randomUUID(),
    name: $('name').value.trim() || url.hostname,
    url: url.href,
    section,
    spaceId: section === 'space' ? $('site-space').value : undefined,
  };
  $('save').disabled = true;
  try {
    await write(old ? sites.map(site => site.id === editId ? next : site) : [...sites, next]);
    if (section === 'space' && !spaceConfig.expandedIds.includes(next.spaceId)) {
      try {
        await changeSpaceConfig(base => ({ ...base, expandedIds: [...new Set([...base.expandedIds, next.spaceId])] }));
      } catch {
        spaceConfig = { ...spaceConfig, expandedIds: [...spaceConfig.expandedIds, next.spaceId] };
        render();
      }
    }
    close();
    notify(t('Site saved'));
  } catch {
    $('form-error').textContent = t('Could not save. Try again.');
  } finally {
    $('save').disabled = false;
  }
});
document.getElementById('remove').addEventListener('click',async()=>{
  $('remove').disabled=true;
  try { await removeSavedSite(editId); close(); }
  catch { $('form-error').textContent=t('Could not delete. Try again.'); }
  finally { $('remove').disabled=false; }
});
document.getElementById('undo').addEventListener('click',async()=>{
  if(!removed) return;
  $('undo').disabled=true;
  try {
    if(removed.kind==='space') {
      const backup=removed;
      await mutateSpaceData((config,current)=>{
        if(config.spaces.some(space=>space.id===backup.space.id)) throw Error('already restored');
        const nextSpaces=[...config.spaces];nextSpaces.splice(Math.min(backup.index,nextSpaces.length),0,backup.space);
        return {spaceConfig:{spaces:nextSpaces,expandedIds:backup.expanded?[...config.expandedIds,backup.space.id]:config.expandedIds},
          sites:[...current,...backup.sites.filter(site=>!current.some(item=>item.id===site.id))]};
      });
      removed=null;notify(t('Space restored'));
    } else {
      const next=[...sites],site={...removed.site};
      if(site.section==='favorites'&&next.filter(s=>s.section==='favorites').length>=9) {
        if(!spaceConfig.spaces.length) throw Error('no destination');
        site.section='space';
      }
      next.splice(removed.index,0,site);await write(next);removed=null;notify(t('Site restored'));
    }
  } catch {notify(t('Could not restore. Try again.'),true);}
  finally {$('undo').disabled=false;}
});
document.getElementById('new-tab').addEventListener('click',async()=>{
  if(!controller) return;
  try { await chrome.tabs.create({windowId:controller.windowId}); await refreshTabs(); }
  catch { notify(t('Could not open a new tab.')); }
});
document.getElementById('retry-tabs').addEventListener('click',async()=>{
  if(!controller) await startTabs(); else await refreshTabs();
});
async function startTabs() {
  try {
    const window=await chrome.windows.getCurrent();
    controller=new TabsController(chrome,window.id);
    await controller.init(sites);
    $('tabs-error').hidden=true;
    render();
  } catch { $('tabs-error').hidden=false; }
  finally { $('tabs').setAttribute('aria-busy','false'); }
}
try {
  uiSettings=SpaceUi.normalize(await readUiSettings().catch(()=>undefined));
  applyAppearance();
  const saved=await read(); const previousConfig=await readSpaceConfig();
  spaceConfig=normalizeSpaceConfig(previousConfig);
  sites=assignSitesToSpaces(Array.isArray(saved)?saved:defaults,spaceConfig);
  if(saved===undefined||JSON.stringify(saved)!==JSON.stringify(sites)||JSON.stringify(previousConfig)!==JSON.stringify(spaceConfig)) {
    if(extension) await chrome.storage.local.set({sites,spaceConfig});
    else {localStorage.setItem('space-sites',JSON.stringify(sites));localStorage.setItem('space-config',JSON.stringify(spaceConfig));}
  }
  render();
  if(extension) {
    const onTab=()=>{
      // Tab event signatures differ; refreshing is cheap and always window-scoped.
      scheduleRefresh();
    };
    for(const event of ['onCreated','onUpdated','onRemoved','onActivated','onMoved','onAttached','onDetached','onReplaced'])
      chrome.tabs[event].addListener(onTab);
    await startTabs();
    if(chrome.scripting&&controller) startMedia();
  }
} catch { sites=[];render();notify(t('Could not load sites. Reopen the panel.')); }
if(extension)chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local') return;
  if(changes.uiSettings) {uiSettings=SpaceUi.normalize(changes.uiSettings.newValue);applyAppearance();render();}
  if(changes.spaceConfig) spaceConfig=normalizeSpaceConfig(changes.spaceConfig.newValue);
  if(changes.sites) sites=changes.sites.newValue||[];
  if(changes.spaceConfig||changes.sites) {sites=assignSitesToSpaces(sites,spaceConfig);render();scheduleRefresh();}
});

// Group deletion writes configuration and saved sites together. Live browser tabs are untouched.
function mutateSpaceData(change) {
  const operation=spaceChanges.catch(()=>{}).then(async()=>{
    const config=normalizeSpaceConfig(await readSpaceConfig());
    const current=await read()||[];
    const next=change(config,current);
    if(extension) await chrome.storage.local.set(next);
    else {
      localStorage.setItem('space-sites',JSON.stringify(next.sites));
      localStorage.setItem('space-config',JSON.stringify(next.spaceConfig));
    }
    sites=next.sites;spaceConfig=next.spaceConfig;
    if(controller) {try {await controller.refresh(sites);} catch {scheduleRefresh();}}
    render();
  });
  spaceChanges=operation;return operation;
}
function openSpaceDelete(id) {
  closeSiteMenus();deletingSpaceId=id;deleteOpener=document.activeElement;
  const space=spaceConfig.spaces.find(item=>item.id===id);
  if(!space) return;
  const count=sites.filter(site=>site.section==='space'&&site.spaceId===id).length;
  SpaceI18n.text($('space-delete-title'),'Delete “{name}”?',{name:space.name});
  SpaceI18n.text($('space-delete-description'),'This space and its {count} saved sites will be removed. Open tabs will stay open. You can undo this after deleting.',{count});
  $('space-delete-error').textContent='';$('space-delete-dialog').showModal();$('space-delete-cancel').focus();
}
function closeSpaceDelete() {
  $('space-delete-dialog').close();deletingSpaceId=null;
  if(deleteOpener?.isConnected) deleteOpener.focus();else $('create-space').focus();
}
$('space-delete-cancel').addEventListener('click',closeSpaceDelete);
$('space-delete-dialog').addEventListener('cancel',event=>{event.preventDefault();if(!$('space-delete-confirm').disabled) closeSpaceDelete();});
$('space-delete-form').addEventListener('submit',async event=>{
  event.preventDefault();if($('space-delete-confirm').disabled) return;
  const id=deletingSpaceId;let backup;
  $('space-delete-confirm').disabled=true;$('space-delete-cancel').disabled=true;
  try {
    await mutateSpaceData((config,current)=>{
      const index=config.spaces.findIndex(space=>space.id===id);
      if(index<0) throw Error('missing space');
      backup={kind:'space',space:config.spaces[index],index,expanded:config.expandedIds.includes(id),
        sites:current.filter(site=>site.section==='space'&&site.spaceId===id)};
      return {spaceConfig:{spaces:config.spaces.filter(space=>space.id!==id),expandedIds:config.expandedIds.filter(item=>item!==id)},
        sites:current.filter(site=>site.section!=='space'||site.spaceId!==id)};
    });
    removed=backup;closeSpaceDelete();notify(t('Space deleted'),true);$('create-space').focus();
  } catch {$('space-delete-error').textContent=t('Could not delete the space. Try again.');}
  finally {$('space-delete-confirm').disabled=false;$('space-delete-cancel').disabled=false;}
});
function applyAppearance() {
  SpaceUi.applyTheme(document.documentElement,uiSettings.theme);
  SpaceI18n.applyDocument(uiSettings.language);
  renderMedia(mediaState);
}
function renderMedia(state) {
  mediaState=state;
  const source=state?.source;
  $('track-title').textContent=source?.title||t('Media in your tabs');
  $('track-title').title=source?.title||t('Media in your tabs');
  $('track-detail').textContent=(state?.error?t(state.error):'')||source?.artist||(source?(source.paused?t('Paused'):t('Now playing')):t('Start playback on a site'));
  for(const [id,capability] of [['media-previous','previous'],['media-restart','restart'],['media-toggle','toggle'],['media-next','next']]) {
    const allowed=Boolean(source?.[capability]);
    $(id).disabled=!allowed||state?.busy;
    $(id).title=allowed?({'media-previous':t('Previous track'),'media-restart':t('Restart'),'media-toggle':t('Play'),'media-next':t('Next track')})[id]:t('Unavailable for this player');
  }
  const label=source&&!source.paused?t('Pause'):t('Play');
  $('media-toggle').dataset.playing=String(Boolean(source&&!source.paused));
  $('media-toggle').setAttribute('aria-label',label);
  $('media-toggle').title=source?.toggle?label:t('Start playback on a site');
}
function startMedia() {
  mediaController=new MediaController(chrome,controller?.windowId,renderMedia);
  for(const [id,command] of [['media-previous','previous'],['media-restart','restart'],['media-toggle','toggle'],['media-next','next']])
    $(id).addEventListener('click',()=>mediaController.command(command));
  const refresh=()=>mediaController.refresh();
  chrome.tabs.onUpdated.addListener(refresh);chrome.tabs.onRemoved.addListener(refresh);
  mediaController.refresh();
  const interval=setInterval(()=>{if(document.visibilityState!=='hidden') refresh();},2500);
  window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
}
