// Runs the real panel module with in-memory DOM/Chrome adapters.
// This checks interaction wiring, not browser layout or native dialog behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const listeners=()=>({callbacks:[],addListener(fn){this.callbacks.push(fn);}});
class Element {
  constructor(tag='div',id='') {
    this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.dataset={};this.attrs={};
    this.events={};this.hidden=false;this.disabled=false;this.value='';this.checked=false;
    this.isConnected=true;this.scrollTop=0;const values={};this.style={values,setProperty(k,v){values[k]=v;}};
    const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)||(this.className||'').split(' ').includes(c)};
  }
  setAttribute(key,value){this.attrs[key]=value;}
  removeAttribute(key){delete this.attrs[key];}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
  append(...items){for(const item of items){item.parentElement=this;item.isConnected=true;this.children.push(item);}}
  replaceChildren(...items){const detach=node=>{node.isConnected=false;node.children.forEach(detach);};this.children.forEach(detach);this.children=[];this.append(...items);}
  closest(selector){if(selector.startsWith('.')&&this.className?.split(' ').includes(selector.slice(1)))return this;return this.parentElement?.closest(selector);}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  click(){this.clicked=true;}
  showPopover(){this.popoverOpen=true;}
  hidePopover(){this.popoverOpen=false;}
  querySelector(selector){
    for(const child of this.children){
      if(selector==='[popover]'?Object.hasOwn(child.attrs,'popover'):child.tagName===selector.toUpperCase())return child;
      const nested=child.querySelector(selector);if(nested)return nested;
    }
  }
  getBoundingClientRect(){return {top:40,bottom:100,left:10,right:220,width:178,height:60};}
  async fire(type,props={}){for(const fn of this.events[type]||[])await fn({preventDefault(){},stopPropagation(){},target:this,...props});}
}
const markup=await readFile(new URL('../../src/panel/index.html',import.meta.url),'utf8');
const ids=new Map([...markup.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)].map(([,tag,id])=>[id,new Element(tag,id)]));
ids.get('panel-menu').className='site-menu';
ids.get('panel-menu').append(ids.get('panel-menu-trigger'),ids.get('panel-menu-actions'));
ids.get('panel-menu-actions').append(ids.get('manage'),ids.get('settings'));
const radio=[new Element('input'),new Element('input')];radio[0].value='favorites';radio[0].checked=true;radio[1].value='space';
const walk=()=>{const out=[];const visit=e=>{out.push(e);e.children.forEach(visit);};ids.forEach(visit);return out;};
const documentEvents={};
globalThis.document={
  activeElement:null,documentElement:new Element('html'),body:new Element('body'),getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),
  addEventListener(type,fn){(documentEvents[type]??=[]).push(fn);},
  querySelectorAll:query=>query==='input[name="section"]'?radio:query==='.site-menu[open]'?walk().filter(e=>e.className==='site-menu'&&e.open):walk().filter(e=>e.dataset.focusKey),
  querySelector:query=>query==='.site-menu[open]'?walk().find(e=>e.className==='site-menu'&&e.open):query==='.tab-link'?walk().find(e=>e.className==='tab-link'):
    query.includes(':checked')?radio.find(r=>r.checked):radio.find(r=>query.includes(`value="${r.value}"`)),
};
const saved={id:'mail',name:'Почта',url:'https://mail.example.com/',section:'favorites'};
const local={sites:[saved]}, session={};
const area=data=>({get:async key=>Object.fromEntries((Array.isArray(key)?key:[key]).map(k=>[k,structuredClone(data[k])])),set:async value=>Object.assign(data,structuredClone(value))});
let tabs=[{id:10,index:0,windowId:1,url:saved.url,title:'Входящие',active:false},{id:20,index:1,windowId:1,url:'https://news.example.com/',title:'Новости',active:true}];
let nextId=30;
globalThis.chrome={
  runtime:{getURL:path=>'chrome-extension://test/'+path},
  storage:{local:area(local),session:area(session),onChanged:listeners()},
  windows:{getCurrent:async()=>({id:1})},
  tabs:{
    query:async options=>tabs.filter(t=>(options.windowId===undefined||t.windowId===options.windowId)&&(!options.active||t.active)).map(t=>({...t})),
    update:async(id,props)=>{const tab=tabs.find(t=>t.id===id);if(!tab)throw Error('missing');if(props.active)tabs.forEach(t=>t.active=false);Object.assign(tab,props);return {...tab};},
    create:async props=>{tabs.forEach(t=>t.active=false);const t={id:nextId++,index:tabs.length,windowId:1,url:'chrome://newtab/',title:'New tab',active:true,...props};tabs.push(t);return {...t};},
    remove:async id=>{tabs=tabs.filter(t=>t.id!==id);if(tabs.length&&!tabs.some(t=>t.active))tabs[0].active=true;},
    ...Object.fromEntries(['onCreated','onUpdated','onRemoved','onActivated','onMoved','onAttached','onDetached','onReplaced'].map(name=>[name,listeners()]))
  }
};
await import('../../src/panel/index.js');
const find=key=>walk().find(e=>e.dataset.focusKey===key);
test('real panel wires live activation, close/reopen, new tab, and saved-site editing',async()=>{
  assert.equal(ids.get('favorites').children.length,2);
  assert.equal(ids.get('tabs').children.length,1);
  assert.equal(find('site-mail').attrs['aria-label'],'Почта, open');
  await find('site-mail').fire('click');
  assert.equal(tabs.length,2);assert.equal(tabs.find(t=>t.id===10).active,true);
  assert.equal(find('site-mail').attrs['aria-current'],'page');
  await find('close-site-mail').fire('click');
  assert.equal(tabs.length,1);assert.equal(local.sites.length,1);
  assert.equal(find('site-mail').attrs['aria-label'],'Почта, open site');
  await find('site-mail').fire('click');
  assert.equal(tabs.length,2);assert.equal(tabs.find(t=>t.id===30).url,saved.url);
  await find('tab-20').fire('click');assert.equal(tabs.find(t=>t.id===20).active,true);
  await find('close-tab-20').fire('click');assert.equal(tabs.some(t=>t.id===20),false);
  await ids.get('manage').fire('click');
  await find('site-mail').fire('click');assert.equal(ids.get('editor').open,true);
  assert.equal(ids.get('url').value,saved.url);
  ids.get('name').value='Рабочая почта';radio[0].checked=false;radio[1].checked=true;
  await ids.get('site-form').fire('submit');
  assert.equal(local.sites[0].section,'space');assert.equal(local.sites[0].name,'Рабочая почта');
  assert.equal(ids.get('spaces').children.length,1);assert.equal(tabs.length,1);
  await ids.get('manage').fire('click');assert.equal(find('site-mail').attrs['aria-current'],'page');
  await ids.get('new-tab').fire('click');assert.equal(tabs.length,2);
});

test('Space menu removes the saved site without closing its tab; undo and failures preserve data',async()=>{
  const tabIds=tabs.map(tab=>tab.id);
  const menu=find('menu-mail')?.closest('.site-menu');
  assert.ok(find('menu-mail'),'Space row has a discoverable actions control');
  menu.open=true;await menu.fire('toggle');
  // Background tab refresh must keep an expanded menu open.
  await find('tab-'+tabs.find(tab=>tab.url==='chrome://newtab/').id).fire('click');
  assert.equal(find('menu-mail')?.closest('.site-menu').open,true);
  await find('remove-site-mail').fire('click');
  assert.equal(local.sites.length,0);
  assert.ok(walk().some(el=>el.className==='empty-state'&&el.textContent?.includes('No sites yet')));
  assert.deepEqual(tabs.map(tab=>tab.id),tabIds,'removing a saved site does not close any browser tab');
  assert.ok(find('tab-30'),'formerly associated tab returns to the ordinary list');
  assert.equal(ids.get('undo').hidden,false);
  await ids.get('undo').fire('click');
  assert.equal(local.sites.length,1);assert.equal(local.sites[0].section,'space');
  assert.ok(find('menu-mail'));assert.deepEqual(tabs.map(tab=>tab.id),tabIds);
  const set=chrome.storage.local.set;
  chrome.storage.local.set=async()=>{throw Error('storage failure');};
  try {
    await find('remove-site-mail').fire('click');
    assert.equal(local.sites.length,1);assert.ok(find('site-mail'));
    const error=walk().find(el=>el.attrs.role==='alert'&&el.textContent?.includes('Could not remove'));
    assert.ok(error);assert.equal(error.hidden,false);
  } finally {chrome.storage.local.set=set;}
});

test('creates and renames collapsible spaces, preserves sites, and moves sites between spaces',async()=>{
  assert.equal(local.spaceConfig.spaces.length,1);
  const originalSpace=local.spaceConfig.spaces[0].id;
  assert.equal(local.sites[0].spaceId,originalSpace,'old saved sites migrate to the first Space');
  await ids.get('create-space').fire('click');
  assert.equal(ids.get('space-editor').open,true);
  ids.get('space-name').value='Работа';
  await ids.get('space-form').fire('submit');
  assert.equal(local.spaceConfig.spaces.length,2);
  const work=local.spaceConfig.spaces.find(space=>space.name==='Работа');
  assert.ok(work);assert.equal(ids.get('spaces').children.length,2);
  assert.ok(local.spaceConfig.expandedIds.includes(work.id));
  await find('add-to-space-'+work.id).fire('click');
  assert.equal(ids.get('site-space').value,work.id);
  ids.get('name').value='Документы';ids.get('url').value='https://docs.example.com/';
  await ids.get('site-form').fire('submit');
  assert.equal(local.sites.find(site=>site.name==='Документы').spaceId,work.id);
  await find('rename-space-'+work.id).fire('click');
  ids.get('space-name').value='Рабочие проекты';
  await ids.get('space-form').fire('submit');
  assert.equal(local.spaceConfig.spaces.find(space=>space.id===work.id).name,'Рабочие проекты');
  assert.equal(local.sites.find(site=>site.name==='Документы').spaceId,work.id);
  const workDetails=walk().find(el=>el.className==='space-disclosure'&&el.dataset.spaceId===work.id);
  workDetails.open=false;await workDetails.fire('toggle');
  assert.equal(local.spaceConfig.expandedIds.includes(work.id),false);
  assert.equal(local.spaceConfig.expandedIds.includes(originalSpace),true,'other spaces stay expanded');
  await find('edit-site-mail').fire('click');
  ids.get('site-space').value=work.id;
  await ids.get('site-form').fire('submit');
  assert.equal(local.sites.find(site=>site.id==='mail').spaceId,work.id);
  assert.ok(find('close-site-mail'),'moving to another Space keeps the live-tab association');
  await ids.get('create-space').fire('click');ids.get('space-name').value='  рабочие ПРОЕКТЫ  ';
  await ids.get('space-form').fire('submit');
  assert.ok(ids.get('space-error').textContent.includes('already exists'));assert.equal(local.spaceConfig.spaces.length,2);
  ids.get('space-name').value='';await ids.get('space-form').fire('submit');
  assert.ok(ids.get('space-error').textContent.includes('Enter'));
  const set=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw Error('storage');};
  try {
    ids.get('space-name').value='Хобби';await ids.get('space-form').fire('submit');
    assert.ok(ids.get('space-error').textContent.includes('Could not'));assert.equal(local.spaceConfig.spaces.length,2);
    assert.equal(ids.get('space-editor').open,true);
  } finally {chrome.storage.local.set=set;}
  await ids.get('space-form').fire('submit');
  assert.equal(local.spaceConfig.spaces.length,3,'retry after storage failure works');
  assert.ok(local.spaceConfig.spaces.some(space=>space.name==='Хобби'));
});

test('settings save/reopen, cancel and storage failure preserve sites and user preferences',async()=>{
  const sitesBefore=structuredClone(local.sites),spacesBefore=structuredClone(local.spaceConfig);
  await ids.get('settings').fire('click');assert.equal(ids.get('settings-dialog').open,true);
  assert.equal(ids.get('panel-side').value,'left');assert.equal(ids.get('launcher-position').value,'center');
  ids.get('panel-side').value='right';ids.get('launcher-position').value='bottom';
  await ids.get('settings-form').fire('submit');assert.equal(ids.get('settings-dialog').open,false);
  assert.deepEqual(local.uiSettings,{language:'auto',searchEngine:'google',panelMode:'overlay',showLauncher:true,theme:'dark',side:'right',launcherPosition:'bottom'});
  await ids.get('settings').fire('click');assert.equal(ids.get('panel-side').value,'right');assert.equal(ids.get('launcher-position').value,'bottom');
  ids.get('panel-side').value='left';await ids.get('settings-cancel').fire('click');
  assert.equal(local.uiSettings.side,'right');
  await ids.get('settings').fire('click');ids.get('launcher-position').value='top';
  const set=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw Error('storage unavailable');};
  try {
    await ids.get('settings-form').fire('submit');assert.equal(ids.get('settings-dialog').open,true);
    assert.equal(ids.get('launcher-position').value,'top');assert.ok(ids.get('settings-error').textContent.includes('Could not'));
    assert.equal(local.uiSettings.launcherPosition,'bottom');
  } finally {chrome.storage.local.set=set;}
  await ids.get('settings-form').fire('submit');assert.equal(local.uiSettings.launcherPosition,'top');
  assert.deepEqual(local.sites,sitesBefore);assert.deepEqual(local.spaceConfig,spacesBefore);
  for(const callback of chrome.storage.onChanged.callbacks) callback({uiSettings:{newValue:{side:'left',launcherPosition:'center'}}},'local');
  await ids.get('settings').fire('click');assert.equal(ids.get('panel-side').value,'left');assert.equal(ids.get('launcher-position').value,'center');
  await ids.get('settings-dialog').fire('cancel');assert.equal(ids.get('settings-dialog').open,false);
});

test('light/dark theme saves and restores without resetting placement or site data',async()=>{
  const sitesBefore=structuredClone(local.sites);await ids.get('settings').fire('click');
  ids.get('panel-side').value='right';ids.get('launcher-position').value='bottom';ids.get('panel-theme').value='light';
  await ids.get('settings-form').fire('submit');
  assert.deepEqual(local.uiSettings,{language:'auto',searchEngine:'google',panelMode:'overlay',showLauncher:true,theme:'light',side:'right',launcherPosition:'bottom'});
  assert.equal(document.documentElement.attrs['data-theme'],'light');
  await ids.get('settings').fire('click');assert.equal(ids.get('panel-theme').value,'light');
  ids.get('panel-theme').value='dark';await ids.get('settings-cancel').fire('click');assert.equal(local.uiSettings.theme,'light');
  for(const callback of chrome.storage.onChanged.callbacks) callback({uiSettings:{newValue:{theme:'dark',side:'right',launcherPosition:'bottom'}}},'local');
  assert.equal(document.documentElement.attrs['data-theme'],'dark');assert.deepEqual(local.sites,sitesBefore);
});

test('scrolling lower lists dismisses floating site actions while retaining the saved sites',async()=>{
  const menu=find('menu-mail')?.closest('.site-menu');menu.open=true;await menu.fire('toggle');
  const popup=menu.querySelector('[popover]');assert.equal(popup.popoverOpen,true);
  assert.ok(Number.isFinite(parseFloat(popup.style.values['--menu-top'])));
  const sitesBefore=structuredClone(local.sites);
  await ids.get('spaces-scroll').fire('scroll');
  assert.equal(menu.open,false);assert.equal(popup.popoverOpen,false);
  assert.deepEqual(local.sites,sitesBefore);assert.equal(ids.get('favorites').children.length,1);
});

test('Space and tab scrolling stay independent across refreshes and close transient menus',async()=>{
  const spaces=ids.get('spaces-scroll'),tabList=ids.get('tabs-scroll');
  spaces.scrollTop=110;tabList.scrollTop=240;
  await spaces.fire('scroll');assert.equal(tabList.scrollTop,240);
  const menu=find('menu-mail')?.closest('.site-menu');menu.open=true;await menu.fire('toggle');
  await tabList.fire('scroll');assert.equal(menu.open,false);assert.equal(spaces.scrollTop,110);
  // Trigger a full panel refresh through its existing edit-mode action.
  await ids.get('manage').fire('click');
  assert.equal(spaces.scrollTop,110);assert.equal(tabList.scrollTop,240);
  await ids.get('manage').fire('click');
});

test('Space deletion confirms, survives failure, keeps live tabs, and supports undo including the last group',async()=>{
  const group=local.spaceConfig.spaces.find(space=>space.name==='Рабочие проекты');
  const before=structuredClone(local.sites),tabIds=tabs.map(tab=>tab.id);
  await find('delete-space-'+group.id).fire('click');
  assert.equal(ids.get('space-delete-dialog').open,true);
  assert.ok(ids.get('space-delete-description').textContent.includes('Open tabs will stay open'));
  assert.equal(document.activeElement,ids.get('space-delete-cancel'));
  await ids.get('space-delete-cancel').fire('click');assert.deepEqual(local.sites,before);
  await find('delete-space-'+group.id).fire('click');
  const set=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw Error('storage');};
  try {
    await ids.get('space-delete-form').fire('submit');
    assert.equal(ids.get('space-delete-dialog').open,true);assert.deepEqual(local.sites,before);
    assert.ok(ids.get('space-delete-error').textContent.includes('Could not'));
  } finally {chrome.storage.local.set=set;}
  await ids.get('space-delete-form').fire('submit');
  assert.equal(local.spaceConfig.spaces.some(space=>space.id===group.id),false);
  assert.equal(local.sites.some(site=>site.spaceId===group.id),false);
  assert.deepEqual(tabs.map(tab=>tab.id),tabIds);
  await ids.get('undo').fire('click');
  assert.ok(local.spaceConfig.spaces.some(space=>space.id===group.id));
  assert.equal(local.sites.length,before.length);
  for(const space of [...local.spaceConfig.spaces]) {
    await find('delete-space-'+space.id).fire('click');await ids.get('space-delete-form').fire('submit');
  }
  assert.deepEqual(local.spaceConfig,{spaces:[],expandedIds:[]});
  assert.equal(local.sites.length,0);assert.deepEqual(tabs.map(tab=>tab.id),tabIds);
  await ids.get('undo').fire('click');assert.equal(local.spaceConfig.spaces.length,1);
});

test('favorite grid renders only saved sites followed by one add button, up to nine sites',async()=>{
  const before=structuredClone(local.sites);
  for(const count of [0,1,5,6,8,9]) {
    const next=Array.from({length:count},(_,i)=>({id:'favorite-'+i,name:'Сайт '+i,url:`https://site${i}.example.com/`,section:'favorites'}));
    local.sites=next;
    for(const callback of chrome.storage.onChanged.callbacks) callback({sites:{newValue:next}},'local');
    const cells=ids.get('favorites').children;
    assert.equal(cells.length,Math.min(count+1,9));
    assert.equal(cells.filter(cell=>cell.className==='tile empty-tile').length,count<9?1:0);
    if(count<9) assert.equal(cells.at(-1).dataset.focusKey,'add-favorite');
  }
  local.sites=before;
  for(const callback of chrome.storage.onChanged.callbacks) callback({sites:{newValue:before}},'local');
});

test('one disclosure per group and tab contains all secondary actions; header actions live in one menu',async()=>{
  const space=local.spaceConfig.spaces[0];
  const groupMenu=find('menu-space:'+space.id).closest('.site-menu');
  assert.equal(groupMenu.querySelector('summary').attrs['aria-label'],`Actions for space ${space.name}`);
  assert.ok(find('add-to-space-'+space.id).closest('.site-menu'));
  assert.ok(find('rename-space-'+space.id).closest('.site-menu'));
  assert.ok(find('delete-space-'+space.id).closest('.site-menu'));
  const group=ids.get('spaces').children.find(el=>el.className==='space-group');
  assert.equal(group.children.length,2,'group has a disclosure plus one action-menu wrapper');
  assert.equal(group.children[1].children.length,1);
  const row=ids.get('tabs').children.find(el=>el.className==='tab-row');
  assert.equal(row.children.length,2,'tab has a link plus one action menu');
  assert.equal(row.children[1].className,'site-menu');
  assert.equal(ids.get('manage').closest('.site-menu'),ids.get('panel-menu'));
  assert.equal(ids.get('settings').closest('.site-menu'),ids.get('panel-menu'));
});

test('shared menus are exclusive, Escape restores their trigger, and opening a dialog closes the popover',async()=>{
  const space=local.spaceConfig.spaces[0];
  const groupMenu=find('menu-space:'+space.id).closest('.site-menu');
  groupMenu.open=true;await groupMenu.fire('toggle');
  assert.equal(groupMenu.querySelector('[popover]').popoverOpen,true);
  const tabMenu=ids.get('tabs').children.find(el=>el.className==='tab-row').children[1];
  tabMenu.open=true;await tabMenu.fire('toggle');
  assert.equal(groupMenu.open,false);assert.equal(groupMenu.querySelector('[popover]').popoverOpen,false);
  assert.equal(tabMenu.open,true);
  for(const callback of documentEvents.keydown||[]) callback({key:'Escape',preventDefault(){}});
  assert.equal(tabMenu.open,false);assert.equal(document.activeElement,tabMenu.querySelector('summary'));
  groupMenu.open=true;await groupMenu.fire('toggle');
  await find('rename-space-'+space.id).fire('click');
  assert.equal(groupMenu.open,false);assert.equal(groupMenu.querySelector('[popover]').popoverOpen,false);
  assert.equal(ids.get('space-editor').open,true);
  await ids.get('space-cancel').fire('click');assert.equal(document.activeElement,groupMenu.querySelector('summary'));
  const panelMenu=ids.get('panel-menu');panelMenu.open=true;await panelMenu.fire('toggle');
  await ids.get('settings').fire('click');assert.equal(panelMenu.open,false);
  await ids.get('settings-cancel').fire('click');assert.equal(document.activeElement,ids.get('panel-menu-trigger'));
});


test('favorites show Chrome favicon images, keep accessible site names, and recover to a neutral icon on image failure',async()=>{
  const before=structuredClone(local.sites);
  const favorite={id:'favicon-test',name:'Моя почта',url:'https://mail.example.com/inbox?view=all&tag=1',section:'favorites',icon:'M',bg:'#ff0000'};
  local.sites=[favorite];
  for(const callback of chrome.storage.onChanged.callbacks) callback({sites:{newValue:local.sites}},'local');
  const button=find('site-favicon-test'),mark=button.children[0],fallback=mark.children[0],img=mark.querySelector('img');
  assert.equal(mark.className,'site-icon site-favicon');assert.equal(mark.textContent,undefined);
  assert.ok(button.attrs['aria-label'].startsWith('Моя почта'));assert.equal(img.alt,'');
  const source=new URL(img.src);assert.equal(source.origin,'null');assert.equal(source.protocol,'chrome-extension:');
  assert.equal(source.hostname,'test');assert.equal(source.pathname,'/_favicon/');
  assert.equal(source.searchParams.get('pageUrl'),favorite.url);assert.equal(source.searchParams.get('size'),'64');
  assert.equal(img.hidden,true);assert.notEqual(fallback.hidden,true);
  img.naturalWidth=32;await img.fire('load');assert.equal(img.hidden,false);assert.equal(fallback.hidden,true);
  await img.fire('error');assert.equal(img.hidden,true);assert.equal(fallback.hidden,false);
  assert.equal(fallback.textContent,undefined,'fallback is a website icon, never the first letter');
  local.sites=before;
  for(const callback of chrome.storage.onChanged.callbacks) callback({sites:{newValue:before}},'local');
});


test('settings persist layout and launcher visibility; cancel and failure preserve the applied choices',async()=>{
  const before=structuredClone(local.sites);
  await ids.get('settings').fire('click');
  assert.equal(ids.get('panel-mode').value,'overlay');assert.equal(ids.get('show-launcher').checked,true);
  ids.get('panel-mode').value='push';ids.get('show-launcher').checked=false;
  await ids.get('show-launcher').fire('change');assert.equal(ids.get('launcher-position').disabled,true);
  await ids.get('settings-form').fire('submit');
  assert.equal(local.uiSettings.panelMode,'push');assert.equal(local.uiSettings.showLauncher,false);
  await ids.get('settings').fire('click');assert.equal(ids.get('panel-mode').value,'push');assert.equal(ids.get('show-launcher').checked,false);
  ids.get('panel-mode').value='overlay';ids.get('show-launcher').checked=true;
  await ids.get('settings-cancel').fire('click');assert.equal(local.uiSettings.panelMode,'push');assert.equal(local.uiSettings.showLauncher,false);
  await ids.get('settings').fire('click');ids.get('panel-mode').value='overlay';ids.get('show-launcher').checked=true;
  const set=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw Error('storage');};
  try {await ids.get('settings-form').fire('submit');assert.equal(local.uiSettings.panelMode,'push');assert.equal(ids.get('settings-dialog').open,true);}
  finally {chrome.storage.local.set=set;}
  await ids.get('settings-form').fire('submit');assert.equal(local.uiSettings.panelMode,'overlay');assert.equal(local.uiSettings.showLauncher,true);
  assert.deepEqual(local.sites,before);
});


test('changing presentation routes Save to the worker and exposes Chrome-owned side selection',async()=>{
  const previous=chrome.runtime.sendMessage,calls=[];
  chrome.runtime.sendMessage=async message=>{
    calls.push(message);await chrome.storage.local.set({uiSettings:message.settings});return {ok:true};
  };
  try {
    await ids.get('settings').fire('click');ids.get('panel-mode').value='push';await ids.get('panel-mode').fire('change');
    assert.equal(ids.get('panel-side').disabled,true);assert.equal(ids.get('native-panel-hint').hidden,false);
    await ids.get('settings-form').fire('submit');assert.equal(calls[0].type,'space-settings-save');assert.equal(calls[0].windowId,1);
    assert.equal(local.uiSettings.panelMode,'push');
    await ids.get('settings').fire('click');ids.get('panel-mode').value='overlay';await ids.get('panel-mode').fire('change');
    assert.equal(ids.get('panel-side').disabled,false);assert.equal(ids.get('native-panel-hint').hidden,true);
    chrome.runtime.sendMessage=async()=>({error:'cannot open'});
    await ids.get('settings-form').fire('submit');assert.equal(ids.get('settings-dialog').open,true);assert.equal(local.uiSettings.panelMode,'push');
    assert.ok(ids.get('settings-error').textContent.includes('Could not'));
    await ids.get('settings-cancel').fire('click');
    assert.equal(markup.includes('отступ'),false,'position labels do not expose pixel spacing');
  } finally {chrome.runtime.sendMessage=previous;}
});

test('keyboard settings show the actual assigned shortcut and allow remapping without changing saved sites',async()=>{
  const previous=chrome.commands,before=structuredClone(local.sites);
  chrome.commands={getAll:async()=>[{name:'_execute_action',shortcut:'Command+J'},{name:'quick-search',shortcut:'Command+K'}]};
  try {
    await ids.get('settings').fire('click');await new Promise(resolve=>setImmediate(resolve));
    assert.equal(ids.get('panel-shortcut').textContent,'Command+J');assert.equal(ids.get('shortcut-hint').hidden,true);
    assert.equal(ids.get('search-shortcut').textContent,'Command+K');
    chrome.commands.getAll=async()=>[{name:'_execute_action',shortcut:'Alt+K'},{name:'quick-search',shortcut:'Command+K'}];
    for(const callback of documentEvents.visibilitychange||[]) callback();
    await new Promise(resolve=>setImmediate(resolve));assert.equal(ids.get('panel-shortcut').textContent,'Alt+K');
    chrome.commands.getAll=async()=>[{name:'_execute_action',shortcut:''}];
    for(const callback of documentEvents.visibilitychange||[]) callback();
    await new Promise(resolve=>setImmediate(resolve));assert.equal(ids.get('panel-shortcut').textContent,'Not assigned');assert.equal(ids.get('shortcut-hint').hidden,false);
    await ids.get('configure-shortcut').fire('click');assert.equal(tabs.at(-1).url,'chrome://extensions/shortcuts');assert.equal(tabs.at(-1).windowId,1);
    assert.deepEqual(local.sites,before);
    chrome.commands.getAll=async()=>{throw Error('unavailable');};
    for(const callback of documentEvents.visibilitychange||[]) callback();
    await new Promise(resolve=>setImmediate(resolve));assert.equal(ids.get('panel-shortcut').textContent,'—');
    assert.ok(ids.get('shortcut-hint').textContent.includes('Could not'));
    await ids.get('settings-cancel').fire('click');
  } finally {chrome.commands=previous;}
});

test('panel search provider persists across reopening and survives cancel and failed saves',async()=>{
  const sitesBefore=structuredClone(local.sites),spacesBefore=structuredClone(local.spaceConfig);
  await ids.get('settings').fire('click');assert.equal(ids.get('search-engine').value,'google');
  ids.get('search-engine').value='yandex';await ids.get('settings-form').fire('submit');
  assert.equal(local.uiSettings.searchEngine,'yandex');
  await ids.get('settings').fire('click');assert.equal(ids.get('search-engine').value,'yandex');
  ids.get('search-engine').value='bing';await ids.get('settings-cancel').fire('click');assert.equal(local.uiSettings.searchEngine,'yandex');
  await ids.get('settings').fire('click');assert.equal(ids.get('search-engine').value,'yandex');ids.get('search-engine').value='duckduckgo';
  const set=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw Error('storage unavailable');};
  try {
    await ids.get('settings-form').fire('submit');assert.equal(ids.get('settings-dialog').open,true);
    assert.equal(ids.get('search-engine').value,'duckduckgo');assert.equal(local.uiSettings.searchEngine,'yandex');
    assert.equal(ids.get('settings-error').hidden,false);
  } finally {chrome.storage.local.set=set;}
  await ids.get('settings-form').fire('submit');assert.equal(local.uiSettings.searchEngine,'duckduckgo');
  assert.deepEqual(local.sites,sitesBefore);assert.deepEqual(local.spaceConfig,spacesBefore);
});

test('dragging sites reorders, moves across Spaces and saves live tabs with rollback on failure',async()=>{
  const before={sites:structuredClone(local.sites),spaceConfig:structuredClone(local.spaceConfig)};
  const a={id:'drag-a',name:'A',url:'https://a.test/',section:'favorites'},b={id:'drag-b',name:'B',url:'https://b.test/',section:'favorites'};
  local.sites=[a,b];local.spaceConfig={spaces:[{id:'drop-work',name:'Работа'}],expandedIds:[]};
  const sync=()=>{for(const fn of chrome.storage.onChanged.callbacks)fn({sites:{newValue:local.sites},spaceConfig:{newValue:local.spaceConfig}},'local');};sync();
  const payload={};const dataTransfer={setData:(key,value)=>{payload[key]=value;},getData:key=>payload[key]};
  try {
    const sourceB=find('site-drag-b');await sourceB.fire('dragstart',{dataTransfer});sync();assert.equal(find('site-drag-b'),sourceB,'background updates do not replace the dragged element');
    await find('site-drag-a').parentElement.fire('drop',{dataTransfer,clientX:0,clientY:0});
    assert.deepEqual(local.sites.map(site=>site.id),['drag-b','drag-a']);
    await find('move-down-drag-b').fire('click');assert.deepEqual(local.sites.map(site=>site.id),['drag-a','drag-b']);
    const set=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw Error('storage');};
    try {
      await find('site-drag-a').fire('dragstart',{dataTransfer});await find('space-drop-work').parentElement.parentElement.fire('drop',{dataTransfer});
      assert.equal(local.sites[0].section,'favorites');
    } finally {chrome.storage.local.set=set;}
    await find('site-drag-a').fire('dragstart',{dataTransfer});await find('space-drop-work').parentElement.parentElement.fire('drop',{dataTransfer});
    assert.equal(local.sites.find(site=>site.id==='drag-a').spaceId,'drop-work');assert.ok(local.spaceConfig.expandedIds.includes('drop-work'));
    const live=tabs.find(tab=>/^https?:/.test(tab.url)&&find('tab-'+tab.id));assert.ok(live);
    const tabIds=tabs.map(tab=>tab.id);
    await find('tab-'+live.id).fire('dragstart',{dataTransfer});await ids.get('favorites').fire('drop',{dataTransfer});
    assert.ok(local.sites.some(site=>site.section==='favorites'&&site.url===live.url));assert.deepEqual(tabs.map(tab=>tab.id),tabIds);
    const snapshot=structuredClone(local.sites),source=find('site-drag-a');await source.fire('dragstart',{dataTransfer});payload['application/x-space-item']='{"token":"foreign"}';
    await ids.get('favorites').fire('drop',{dataTransfer});assert.deepEqual(local.sites,snapshot);await source.fire('dragend');
  } finally {local.sites=before.sites;local.spaceConfig=before.spaceConfig;sync();}
});

test('panel import wires the trusted worker, restores all datasets and keeps real tabs',async()=>{
  const original={sites:structuredClone(local.sites),spaceConfig:structuredClone(local.spaceConfig),uiSettings:structuredClone(local.uiSettings)},send=chrome.runtime.sendMessage;
  const data={sites:[{id:'imported',name:'Импорт',url:'https://import.test/',section:'favorites'}],spaceConfig:{spaces:[],expandedIds:[]},uiSettings:SpaceUi.normalize({theme:'light',searchEngine:'bing'})};
  let calls=0;
  chrome.runtime.sendMessage=async message=>{assert.equal(message.type,'space-backup-import');assert.equal(message.windowId,1);++calls;await chrome.storage.local.set(message.data);return {ok:true};};
  const tabIds=tabs.map(tab=>tab.id);
  try {
    await ids.get('backup-open').fire('click');const text=JSON.stringify(SpaceBackup.create(data));
    ids.get('backup-file').files=[{name:'copy.json',size:text.length,text:async()=>text}];await ids.get('backup-file').fire('change');
    assert.equal(calls,0);await ids.get('backup-form').fire('submit');assert.equal(calls,1);
    assert.equal(local.sites[0].id,'imported');assert.ok(find('site-imported'));assert.equal(document.documentElement.attrs['data-theme'],'light');assert.deepEqual(tabs.map(tab=>tab.id),tabIds);
  } finally {
    chrome.runtime.sendMessage=send;Object.assign(local,original);
    for(const fn of chrome.storage.onChanged.callbacks)fn({sites:{newValue:local.sites},spaceConfig:{newValue:local.spaceConfig},uiSettings:{newValue:local.uiSettings}},'local');
  }
});

test('a fresh profile can export normalized default settings before ever saving preferences',async()=>{
  const previous=local.uiSettings,create=URL.createObjectURL;let blob;
  local.uiSettings=undefined;URL.createObjectURL=value=>{blob=value;return create(value);};
  try {
    await ids.get('backup-open').fire('click');await ids.get('backup-export').fire('click');
    assert.ok(blob);assert.deepEqual(SpaceBackup.parse(await blob.text()).uiSettings,SpaceUi.normalize());
    await ids.get('backup-close').fire('click');
  } finally {local.uiSettings=previous;URL.createObjectURL=create;}
});

test('saving a language updates panel actions/player/errors and leaves all saved names intact',async()=>{
  const original=structuredClone(local),before=structuredClone({sites:local.sites,spaceConfig:local.spaceConfig});
  try {
    await ids.get('settings').fire('click');assert.equal(ids.get('language').value,'auto');
    ids.get('language').value='ru';await ids.get('settings-form').fire('submit');
    assert.equal(local.uiSettings.language,'ru');assert.equal(document.documentElement.attrs.lang,'ru');
    assert.equal(ids.get('status-text').textContent,'Настройки сохранены');
    assert.equal(ids.get('track-title').textContent,'Музыка во вкладках');
    assert.equal(find('rename-space-'+local.spaceConfig.spaces[0].id).textContent,'Переименовать');
    await ids.get('create-space').fire('click');await ids.get('space-form').fire('submit');
    assert.equal(ids.get('space-error').textContent,'Введите название пространства.');
    await ids.get('space-cancel').fire('click');
    await ids.get('settings').fire('click');assert.equal(ids.get('language').value,'ru');
    ids.get('language').value='en';await ids.get('settings-cancel').fire('click');assert.equal(local.uiSettings.language,'ru');
    assert.deepEqual({sites:local.sites,spaceConfig:local.spaceConfig},before);
    for(const callback of chrome.storage.onChanged.callbacks)callback({uiSettings:{newValue:{...local.uiSettings,language:'en'}}},'local');
    assert.equal(document.documentElement.attrs.lang,'en');assert.equal(ids.get('track-title').textContent,'Media in your tabs');
  } finally {
    Object.assign(local,original);
    for(const callback of chrome.storage.onChanged.callbacks)callback({uiSettings:{newValue:local.uiSettings}},'local');
  }
});

test('space sites and ordinary browser tabs use logos; internal tabs retain neutral marks without letters',async()=>{
  const before=structuredClone({sites:local.sites,spaceConfig:local.spaceConfig,tabs});
  const refresh=async()=>{
    for(const callback of chrome.storage.onChanged.callbacks)callback({sites:{newValue:local.sites},spaceConfig:{newValue:local.spaceConfig}},'local');
    await ids.get('retry-tabs').fire('click');
  };
  try {
    local.spaceConfig={spaces:[{id:'icons-work',name:'Work'}],expandedIds:['icons-work']};
    local.sites=[{id:'icons-site',name:'Docs',url:'https://docs.test/',section:'space',spaceId:'icons-work',icon:'D'}];
    tabs=[{id:901,index:0,windowId:1,url:'https://news.test/',title:'News',active:true},
      {id:902,index:1,windowId:1,url:'chrome://newtab/',title:'New tab',active:false}];
    await refresh();
    for(const [key,url] of [['site-icons-site','https://docs.test/'],['tab-901','https://news.test/']]) {
      const mark=find(key).children[0],image=mark.querySelector('img');
      assert.equal(mark.className,'site-icon site-favicon');assert.equal(mark.textContent,undefined);
      assert.equal(new URL(image.src).searchParams.get('pageUrl'),url);assert.equal(image.width,20);
      image.naturalWidth=32;await image.fire('load');assert.equal(image.hidden,false);
      await image.fire('error');assert.equal(mark.children[0].hidden,false);
    }
    const internal=find('tab-902').children[0];assert.equal(internal.children.length,1);
    assert.equal(internal.children[0].className,'favicon-fallback');assert.equal(internal.textContent,undefined);
  } finally {local.sites=before.sites;local.spaceConfig=before.spaceConfig;tabs=before.tabs;await refresh();}
});
