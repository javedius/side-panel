import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const localeSource=(await readFile(new URL('../../src/shared/messages.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../../src/shared/i18n.js',import.meta.url),'utf8'));
const pathsSource=await readFile(new URL('../../src/shared/paths.js',import.meta.url),'utf8');
const settingsSource=await readFile(new URL('../../src/shared/ui-settings.js',import.meta.url),'utf8');
const source=await readFile(new URL('../../src/content/sidebar.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../../src/background/index.js',import.meta.url),'utf8');
const backupSource=await readFile(new URL('../../src/backup/model.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const event=()=>({handlers:[],addListener(fn){this.handlers.push(fn);},fire(...args){for(const fn of this.handlers)fn(...args);}});
function pageStyle() {
  const values=new Map([['margin',{value:'0',priority:''}],['width',{value:'100%',priority:''}]]);
  const style={
    getPropertyValue:name=>values.get(name)?.value||'',getPropertyPriority:name=>values.get(name)?.priority||'',
    setProperty(name,value,priority=''){values.set(name,{value,priority});},removeProperty(name){values.delete(name);}
  };
  for(const name of ['width','margin']) Object.defineProperty(style,name,{get:()=>style.getPropertyValue(name)});
  Object.defineProperty(style,'cssText',{get:()=>JSON.stringify([...values]),set:text=>{values.clear();for(const [key,value] of JSON.parse(text))values.set(key,value);}});
  return style;
}
function environment(topLayer=true,initial={open:false,revision:0,windowId:1},initialSettings=undefined) {
  const events={},messages={},nodes=[],launchers=[],requests=[];const runtimeMessages=event();
  let state=initial,settings=initialSettings;const storageChange=event();
  const storage={local:{get:async()=>({uiSettings:settings})},onChanged:storageChange};
  const previous={isConnected:true,focused:0,focus(){this.focused++;doc.activeElement=this;}};
  const doc={activeElement:previous,visibilityState:'visible',body:{style:pageStyle(),getBoundingClientRect:()=>({width:1280})},getElementById:()=>null,
    documentElement:{append(node){if(node.tag==='button')launchers.push(node);else nodes.push(node);}},
    addEventListener(type,fn){events[type]=fn;},
    createElement(tag){
      const values={};const el={tag,attrs:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},
        emit(type,props={}){this.listeners[type]?.({isTrusted:true,pointerType:'mouse',buttons:0,...props});},style:{values,setProperty(k,v){values[k]=v;}},
        remove(){this.removed=true;},children:[],append(node){this.children.push(node);},setAttribute(k,v){this.attrs[k]=v;},focus(){doc.activeElement=this;},contentWindow:{},
        attachShadow(){this.shadow={children:[],append(node){this.children.push(node);}};return this.shadow;}};
      if(topLayer){el.showPopover=()=>{el.open=true;};el.hidePopover=()=>{el.open=false;};}
      return el;
    }};
  const runtime={id:'test',getManifest:()=>({version:'1.8.0'}),getURL:path=>'chrome-extension://test/'+path,onMessage:runtimeMessages,
    sendMessage:async message=>{requests.push(message);if(message.type==='space-overlay-close')state={...state,open:false,revision:state.revision+1};
      if(message.type==='space-overlay-open')state={...state,open:true,revision:state.revision+1};return {...state};}};
  const context=vm.createContext({
    document:doc,window:{innerWidth:1280,addEventListener(type,fn){messages[type]=fn;}},
    getComputedStyle:node=>({boxSizing:node.style.getPropertyValue('box-sizing')||'content-box',getPropertyValue:name=>{
      const value=node.style.getPropertyValue(name);
      if(name==='width'&&value==='100%') return context.window.innerWidth+'px';
      if(name==='margin-left'||name==='margin-right') return value||node.style.margin||'0px';
      return value||'0px';
    }}),chrome:{runtime,storage}});
  vm.runInContext(pathsSource,context);vm.runInContext(localeSource,context);vm.runInContext(settingsSource,context);
  return {context,doc,nodes,launchers,events,messages,previous,requests,runtime,storage,
    setSettings(next){settings=next;storageChange.fire({uiSettings:{newValue:next}},'local');},
    resize(width){context.window.innerWidth=width;messages.resize?.();},
    setState(next){state=next;},deliver(next,sender={id:'test'}){runtimeMessages.fire({type:'space-overlay-visibility',...next},sender);},
    run(){vm.runInContext(source,context);}};
}
for(const topLayer of [true,false]) {
  test(`window visibility shows/hides one overlay without page reflow; top layer ${topLayer}`,async()=>{
    const f=environment(topLayer);f.run();await flush();assert.equal(f.nodes.length,0,'closed window creates no iframe');
    f.deliver({open:true,revision:1,windowId:1,focus:true});const host=f.nodes[0],frame=host.shadow.children[0];
    assert.equal(host.style.values.position,'fixed');assert.equal(host.style.values.display,'block');
    assert.equal(frame.src,'chrome-extension://test/src/panel/index.html?overlay=1');
    assert.equal(f.doc.body.style.width,'100%');assert.equal(f.doc.body.style.margin,'0');
    f.run();assert.equal(f.nodes.length,1);assert.equal(host.style.values.display,'block','reinjection does not toggle it closed');
    f.deliver({open:false,revision:2,windowId:1});assert.equal(host.style.values.display,'none');assert.equal(f.previous.focused,1);
    f.deliver({open:true,revision:3,windowId:1,focus:true});
    f.events.keydown({key:'Escape',preventDefault(){}});await flush();assert.equal(host.style.values.display,'none');
    assert.ok(f.requests.some(message=>message.type==='space-overlay-close'));
  });
}
test('automatic navigation restore does not steal focus; stale messages cannot reopen a closed panel',async()=>{
  const f=environment(true,{open:true,revision:4,windowId:1});f.run();await flush();
  assert.equal(f.doc.activeElement,f.previous);const host=f.nodes[0];
  f.deliver({open:false,revision:6,windowId:1});f.deliver({open:true,revision:5,windowId:1});
  assert.equal(host.style.values.display,'none');
});
test('page messages cannot close the panel, and other extensions cannot control visibility',async()=>{
  const f=environment(true,{open:true,revision:1,windowId:1});f.run();await flush();const host=f.nodes[0],frame=host.shadow.children[0];
  f.messages.message({source:{},data:{type:'space-close-overlay'}});assert.equal(host.style.values.display,'block');
  f.deliver({open:false,revision:2,windowId:1},{id:'foreign'});assert.equal(host.style.values.display,'block');
  f.messages.message({source:frame.contentWindow,data:{type:'space-close-overlay'}});await flush();assert.equal(host.style.values.display,'none');
});
test('BFCache restore rereads current state and moved tabs adopt destination window state',async()=>{
  const f=environment(true,{open:true,revision:50,windowId:1});f.run();await flush();const host=f.nodes[0];
  f.setState({open:false,revision:0,windowId:2});f.deliver({open:false,revision:0,windowId:2});await flush();
  assert.equal(host.style.values.display,'none','new window revisions are independent');
  f.setState({open:true,revision:1,windowId:2});f.messages.pageshow();await flush();
  assert.equal(host.style.values.display,'block');
});
function workerEnvironment(stored={},settings={}) {
  const calls={injections:[],native:[],closed:[],behavior:[],messages:[]};const receivers=new Set();
  const tabs=[{id:1,windowId:1,url:'https://a.com',active:true},{id:2,windowId:1,url:'https://b.com',active:false},{id:3,windowId:2,url:'https://c.com',active:true}];
  const onClicked=event(),onActivated=event(),onUpdated=event(),onAttached=event(),onRemoved=event(),onMessage=event(),onInstalled=event();
  const storageChanged=event(),opened=event(),closed=event(),local={uiSettings:settings};
  const chrome={runtime:{id:'test',getURL:path=>'chrome-extension://test/'+path,onMessage,onInstalled},
    storage:{local:{get:async key=>Object.fromEntries((Array.isArray(key)?key:[key]).map(k=>[k,structuredClone(local[k])])),set:async value=>{Object.assign(local,structuredClone(value));storageChanged.fire({uiSettings:{newValue:local.uiSettings}},'local');}},onChanged:storageChanged,session:{get:async key=>({[key]:structuredClone(stored[key])}),set:async value=>Object.assign(stored,structuredClone(value)),remove:async key=>{delete stored[key];}}},
    action:{onClicked,setBadgeText:async()=>{},setTitle:async()=>{}},
    sidePanel:{setPanelBehavior:async value=>calls.behavior.push(value),open:async value=>calls.native.push(value),close:async value=>{calls.closed.push(value);closed.fire(value);},onOpened:opened,onClosed:closed},
    scripting:{executeScript:async value=>{calls.injections.push(value);receivers.add(value.target.tabId);}},
    tabs:{onActivated,onUpdated,onAttached,
      get:async id=>({...tabs.find(tab=>tab.id===id)}),query:async options=>tabs.filter(t=>(options.windowId===undefined||t.windowId===options.windowId)&&(!options.active||t.active)).map(t=>({...t})),
      sendMessage:async(id,message)=>{if(!receivers.has(id))throw Error('No receiver');calls.messages.push({id,...message});}},
    windows:{onRemoved}};
  const context=vm.createContext({URL,TextEncoder,console,chrome});vm.runInContext(pathsSource,context);vm.runInContext(localeSource,context);vm.runInContext(settingsSource,context);vm.runInContext(backupSource,context);vm.runInContext(worker,context);
  return {calls,tabs,stored,chrome,receivers,local,opened,closed,
    settings(next){local.uiSettings=next;storageChanged.fire({uiSettings:{newValue:next}},'local');},
    click(id){onClicked.fire(tabs.find(tab=>tab.id===id));},
    activate(id){const tab=tabs.find(t=>t.id===id);tabs.filter(t=>t.windowId===tab.windowId).forEach(t=>t.active=t.id===id);onActivated.fire({tabId:id,windowId:tab.windowId});},
    request(message,sender){return new Promise(resolve=>{const keep=onMessage.handlers[0](message,sender,resolve);if(keep!==true)resolve(undefined);});}};
}
test('opening follows activation into existing tabs, and reload reinjects into the active page',async()=>{
  const f=workerEnvironment();f.click(1);await flush();
  assert.equal(f.stored['space-overlay-window-1'].open,true);
  f.activate(2);await flush();assert.deepEqual(f.calls.injections.map(c=>c.target.tabId),[1,2]);
  assert.equal(f.calls.messages.at(-1).open,true);assert.equal(f.calls.messages.at(-1).focus,false);
  f.receivers.delete(2);f.chrome.tabs.onUpdated.fire(2,{status:'complete'},f.tabs[1]);await flush();
  assert.equal(f.calls.injections.at(-1).target.tabId,2);
});
test('close from one page hides all tabs and stays closed on future switches',async()=>{
  const f=workerEnvironment();f.click(1);await flush();f.activate(2);await flush();
  const state=await f.request({type:'space-overlay-close'},{id:'test',tab:f.tabs[1],frameId:0});
  assert.equal(state.open,false);
  const closeMessages=f.calls.messages.filter(m=>m.revision===state.revision);
  assert.deepEqual(closeMessages.map(m=>m.id).sort(),[1,2]);assert.ok(closeMessages.every(m=>!m.open));
  const count=f.calls.injections.length;f.activate(1);await flush();assert.equal(f.calls.injections.length,count);
  assert.equal(f.calls.messages.at(-1).open,false);
});
test('other windows stay closed and a restarted worker restores session state',async()=>{
  const f=workerEnvironment();f.click(1);await flush();f.activate(3);await flush();
  assert.equal(f.calls.messages.find(message=>message.id===3)?.open,false,'closed windows get a launcher, not an open panel');
  const restarted=workerEnvironment(f.stored);restarted.activate(2);await flush();
  assert.equal(restarted.calls.messages.at(-1).open,true);
});
test('rapid toolbar toggles serialize and session cleanup removes a closed window',async()=>{
  const f=workerEnvironment();f.click(1);f.click(1);await flush();
  assert.equal(f.stored['space-overlay-window-1'].open,false);assert.equal(f.stored['space-overlay-window-1'].revision,2);
  f.chrome.windows.onRemoved.fire(1);await flush();assert.equal(f.stored['space-overlay-window-1'],undefined);
});
test('restricted pages use native fallback; untrusted or subframe state requests are ignored',async()=>{
  const f=workerEnvironment();f.tabs[0].url='chrome://settings/';f.click(1);await flush();
  assert.equal(f.calls.injections.length,0);assert.equal(f.calls.native.length,1);
  assert.equal(await f.request({type:'space-overlay-close'},{id:'foreign',tab:f.tabs[0],frameId:0}),undefined);
  assert.equal(await f.request({type:'space-overlay-close'},{id:'test',tab:f.tabs[0],frameId:1}),undefined);
  assert.equal(f.stored['space-overlay-window-1'].open,true);
});
test('page bootstrap reports open only for active pages, without changing window intent',async()=>{
  const f=workerEnvironment();f.click(1);await flush();
  const inactive=await f.request({type:'space-overlay-state'},{id:'test',tab:f.tabs[1],frameId:0});
  assert.equal(inactive.open,false);assert.equal(f.stored['space-overlay-window-1'].open,true);
  f.activate(2);await flush();
  const active=await f.request({type:'space-overlay-state'},{id:'test',tab:f.tabs[1],frameId:0});assert.equal(active.open,true);
});
test('late inactive-page bootstrap cannot hide a panel restored by tab activation',async()=>{
  const f=environment();let resolve;
  f.runtime.sendMessage=()=>new Promise(r=>{resolve=r;});f.run();
  f.deliver({open:true,revision:1,windowId:1});const host=f.nodes[0];
  resolve({open:false,revision:1,windowId:1});await flush();
  assert.equal(host.style.values.display,'block');
});

test('visible launcher is 10px from the left and vertically centered; hover alone never opens',async()=>{
  const f=environment();f.run();await flush();const button=f.launchers[0];
  assert.equal(button.style.values.left,'10px');assert.equal(button.style.values.top,'50%');
  assert.equal(button.style.values.transform,'translateY(-50%)');assert.equal(button.style.values.display,'grid');
  assert.equal(button.style.values.width,'24px');assert.equal(button.style.values.height,'28px');assert.equal(button.style.values.opacity,'0.25');
  assert.equal(button.attrs['aria-label'],'Open Space');assert.equal(button.textContent,'');assert.ok(button.children.at(-1).style.values.mask.includes('image/svg+xml'));
  button.emit('pointerenter');await flush();assert.equal(f.nodes.length,0);assert.equal(button.style.values.opacity,'0.85');
  button.emit('pointerleave');assert.equal(button.style.values.opacity,'0.25');
  button.emit('click');await flush();assert.equal(f.nodes[0].style.values.display,'block');
  assert.equal(button.style.values.display,'none','launcher yields its place to the open panel');
  f.events.keydown({key:'Escape',preventDefault(){}});await flush();assert.equal(button.style.values.display,'grid');
  assert.equal(button.attrs['aria-expanded'],'false');
});
test('launcher provides keyboard focus feedback and ignores page-generated clicks',async()=>{
  const f=environment();f.run();await flush();const button=f.launchers[0];
  button.emit('focus');assert.equal(button.style.values.outline,'2px solid '+f.context.SpaceUi.themeTokens('dark')['--accent']);assert.equal(button.style.values.opacity,'1');
  button.emit('blur');assert.equal(button.style.values.outline,'none');
  button.emit('click',{isTrusted:false});await flush();assert.equal(f.nodes.length,0);
});
test('failed launcher open remains available with a recovery hint and permits retry',async()=>{
  const f=environment();f.run();await flush();const button=f.launchers[0],send=f.runtime.sendMessage;
  f.runtime.sendMessage=async()=>{throw Error('worker unavailable');};
  button.emit('click');await flush();assert.equal(button.textContent,'!');assert.equal(button.disabled,false);
  assert.equal(button.style.values.display,'grid');assert.ok(button.title.includes('Could not open'));
  f.runtime.sendMessage=send;button.emit('click');await flush();
  assert.equal(f.nodes[0].style.values.display,'block');assert.equal(button.textContent,'');assert.ok(button.children.at(-1).style.values.mask.includes('image/svg+xml'));
});
test('repeated launcher clicks share one pending request and explicit opening focuses the panel',async()=>{
  const f=environment();f.run();await flush();const button=f.launchers[0];let resolve,calls=0;
  f.runtime.sendMessage=()=>{calls++;return new Promise(r=>{resolve=r;});};
  button.emit('click');button.emit('click');assert.equal(calls,1);assert.equal(button.disabled,true);
  resolve({open:true,revision:1,windowId:1});await flush();assert.equal(button.disabled,false);
  assert.equal(f.doc.activeElement,f.nodes[0].shadow.children[0]);
});
test('closed active tabs get launchers after update and when activated without opening the panel',async()=>{
  const f=workerEnvironment();f.chrome.runtime.onInstalled.fire({reason:'update'});await flush();
  assert.deepEqual(f.calls.injections.map(call=>call.target.tabId).sort(),[1,3]);
  assert.ok(f.calls.messages.every(message=>message.open===false));
  f.activate(2);await flush();assert.equal(f.calls.injections.at(-1).target.tabId,2);
  assert.equal(f.calls.messages.at(-1).open,false);
});
test('launcher open is idempotent, persists window intent, and rejects background-page requests',async()=>{
  const f=workerEnvironment();const sender={id:'test',tab:f.tabs[0],frameId:0};
  const first=await f.request({type:'space-overlay-open'},sender);
  const second=await f.request({type:'space-overlay-open'},sender);
  assert.equal(first.open,true);assert.equal(second.open,true);assert.equal(second.revision,first.revision);
  const other=await f.request({type:'space-overlay-open'},{id:'test',tab:f.tabs[1],frameId:0});assert.ok(other.error);
  f.activate(2);await flush();assert.equal(f.calls.messages.at(-1).open,true);
});

for(const side of ['left','right']) for(const position of ['top','center','bottom']) {
  test(`restores ${side}/${position} geometry and applies it to the open panel`,async()=>{
    const f=environment(true,undefined,{side,launcherPosition:position});f.run();await flush();
    const button=f.launchers[0];assert.equal(button.style.values[side],'10px');
    assert.equal(button.style.values[side==='left'?'right':'left'],'auto');
    assert.equal(button.style.values.top,position==='top'?'10px':position==='center'?'50%':'auto');
    assert.equal(button.style.values.bottom,position==='bottom'?'10px':'auto');
    assert.equal(button.style.values.transform,position==='center'?'translateY(-50%)':'none');
    assert.equal(button.style.values.visibility,'visible');
    f.deliver({open:true,revision:1,windowId:1});
    assert.equal(f.nodes[0].style.values[side],'12px');assert.equal(f.nodes[0].style.values[side==='left'?'right':'left'],'auto');
  });
}
test('settings update moves an already-open panel and its hidden launcher without closing or stealing focus',async()=>{
  const f=environment(true,{open:true,revision:1,windowId:1});f.run();await flush();const host=f.nodes[0];
  f.setSettings({side:'right',launcherPosition:'bottom'});
  assert.equal(host.style.values.right,'12px');assert.equal(host.style.values.left,'auto');assert.equal(host.style.values.display,'block');
  assert.equal(f.launchers[0].style.values.right,'10px');assert.equal(f.launchers[0].style.values.bottom,'10px');
  assert.equal(f.doc.activeElement,f.previous);
});
test('new settings event wins over an older startup read',async()=>{
  const f=environment();let resolve;f.storage.local.get=()=>new Promise(r=>{resolve=r;});f.run();
  assert.equal(f.launchers[0].style.values.visibility,'hidden');
  f.setSettings({side:'right',launcherPosition:'top'});
  resolve({uiSettings:{side:'left',launcherPosition:'center'}});await flush();
  assert.equal(f.launchers[0].style.values.right,'10px');assert.equal(f.launchers[0].style.values.top,'10px');
});
test('restored open panel waits for its saved side before becoming visible',async()=>{
  const f=environment();let resolve;f.storage.local.get=()=>new Promise(r=>{resolve=r;});f.run();
  f.deliver({open:true,revision:1,windowId:1,focus:true});const host=f.nodes[0];
  assert.equal(host.style.values.visibility,'hidden');assert.equal(f.doc.activeElement,f.previous);
  resolve({uiSettings:{side:'right',launcherPosition:'bottom'}});await flush();
  assert.equal(host.style.values.right,'12px');assert.equal(host.style.values.visibility,'visible');
  assert.equal(f.doc.activeElement,host.shadow.children[0]);
});

test('live light/dark updates theme the launcher, shell and iframe without resetting placement or visibility',async()=>{
  const f=environment(true,{open:true,revision:1,windowId:1},{theme:'dark',side:'right',launcherPosition:'bottom'});f.run();await flush();
  const host=f.nodes[0],frame=host.shadow.children[0],button=f.launchers[0];
  f.setSettings({theme:'light',side:'right',launcherPosition:'bottom'});
  assert.equal(host.style.values.background,f.context.SpaceUi.themeTokens('light')['--bg']);assert.equal(frame.style.values['color-scheme'],'light');
  assert.equal(button.style.values.color,f.context.SpaceUi.themeTokens('light')['--accent']);assert.equal(button.style.values.right,'10px');assert.equal(button.style.values.bottom,'10px');
  assert.equal(host.style.values.display,'block');assert.equal(f.doc.activeElement,f.previous);
  f.setSettings({theme:'dark',side:'right',launcherPosition:'bottom'});
  assert.equal(host.style.values.background,f.context.SpaceUi.themeTokens('dark')['--bg']);assert.equal(frame.style.values['color-scheme'],'dark');
});


test('hidden launcher stays hidden across panel visibility changes and can be reenabled without opening',async()=>{
  const f=environment(true,{open:false,revision:0,windowId:1},{showLauncher:false});f.run();await flush();
  const button=f.launchers[0];assert.equal(button.style.values.display,'none');
  f.deliver({open:true,revision:1,windowId:1,focus:true});assert.equal(f.nodes[0].style.values.display,'block');
  f.deliver({open:false,revision:2,windowId:1});assert.equal(button.style.values.display,'none');
  f.setSettings({showLauncher:true});assert.equal(button.style.values.display,'grid');assert.equal(button.attrs['aria-hidden'],'false');
  assert.equal(f.nodes[0].style.values.display,'none');
});

test('native presentation never mutates page styles or mounts an overlay, and switches from overlay cleanly',async()=>{
  const f=environment(true,{open:true,native:true,revision:1,windowId:1},{panelMode:'push'});const original=f.doc.body.style.cssText;
  f.run();await flush();assert.equal(f.nodes.length,0);assert.equal(f.doc.body.style.cssText,original);
  f.setSettings({panelMode:'overlay'});f.deliver({open:true,native:false,revision:2,windowId:1});
  assert.equal(f.nodes[0].style.values.display,'block');
  f.setSettings({panelMode:'push'});assert.equal(f.nodes[0].style.values.display,'none');
  f.deliver({open:true,native:true,revision:3,windowId:1});assert.equal(f.nodes[0].style.values.display,'none');
  assert.equal(f.doc.body.style.cssText,original);
});

test('native mode configures the browser action and launcher opening invokes Chrome synchronously',async()=>{
  const f=workerEnvironment({}, {panelMode:'push'});await flush();
  assert.equal(f.calls.behavior.at(-1).openPanelOnActionClick,true);
  const result=f.request({type:'space-overlay-open',native:true},{id:'test',tab:f.tabs[0],frameId:0});
  assert.equal(f.calls.native.length,1,'native open starts before any await');
  const state=await result;assert.equal(state.native,true);assert.equal(state.open,true);
  assert.equal(f.calls.closed.length,0,'navigation sync must not close native push mode');
  f.activate(2);await flush();assert.equal(f.calls.native.length,1,'no gesture-free native opening');
  assert.equal(f.calls.messages.at(-1).native,true);
  f.closed.fire({windowId:1});await flush();assert.equal(f.stored['space-overlay-window-1'].open,false);
  f.opened.fire({windowId:1});await flush();assert.equal(f.stored['space-overlay-window-1'].open,true);
});

test('native settings save validates sender, uses Save activation and rolls back open on storage failure',async()=>{
  const f=workerEnvironment();await flush();
  const message={type:'space-settings-save',settings:{panelMode:'push'},windowId:1};
  const sender={id:'test',url:'chrome-extension://test/src/panel/index.html?overlay=1',tab:f.tabs[0],frameId:2};
  assert.equal(await f.request(message,{...sender,url:'https://example.com'}),undefined);
  assert.equal(await f.request({...message,windowId:2},sender),undefined);
  const result=f.request(message,sender);assert.equal(f.calls.native.length,1);
  assert.equal((await result).ok,true);assert.equal(f.local.uiSettings.panelMode,'push');
  assert.equal(f.calls.behavior.at(-1).openPanelOnActionClick,true);
  const overlay=await f.request({...message,settings:{panelMode:'overlay'}},sender);
  assert.equal(overlay.ok,true);assert.equal(f.calls.behavior.at(-1).openPanelOnActionClick,false);assert.ok(f.calls.closed.length);
  const previous=structuredClone(f.local.uiSettings);f.chrome.storage.local.set=async()=>{throw Error('storage');};
  const failed=await f.request(message,sender);assert.ok(failed.error);assert.deepEqual(f.local.uiSettings,previous);
});

test('native open failure does not persist presentation settings',async()=>{
  const f=workerEnvironment();await flush();f.chrome.sidePanel.open=async()=>{throw Error('activation');};
  const result=await f.request({type:'space-settings-save',settings:{panelMode:'push'},windowId:1},{id:'test',url:'chrome-extension://test/src/panel/index.html',frameId:1,tab:f.tabs[0]});
  assert.ok(result.error);assert.notEqual(f.local.uiSettings.panelMode,'push');
});

test('backup imports validate sender and data, preserve a recovery copy and never close live tabs',async()=>{
  const f=workerEnvironment();await flush();
  f.local.sites=[{id:'old',name:'Старый',url:'https://old.test/',section:'favorites'}];f.local.spaceConfig={spaces:[],expandedIds:[]};
  const old=structuredClone(f.local),tabs=structuredClone(f.tabs);
  const data={sites:[{id:'new',name:'Новый',url:'https://new.test/',section:'favorites'}],spaceConfig:{spaces:[],expandedIds:[]},uiSettings:{panelMode:'push',searchEngine:'bing'}};
  const message={type:'space-backup-import',windowId:1,data,operationId:'import-one'},sender={id:'test',url:'chrome-extension://test/src/panel/index.html',tab:f.tabs[0],frameId:1};
  assert.equal(await f.request(message,{...sender,url:'https://evil.com'}),undefined);
  assert.ok((await f.request({...message,data:{...data,sites:[{...data.sites[0],url:'javascript:bad'}]}},sender)).error);assert.deepEqual(f.local,old);
  const pending=f.request(message,sender);assert.equal(f.calls.native.length,1,'native open starts under the confirmation gesture');
  assert.equal((await pending).ok,true);assert.equal(f.local.sites[0].id,'new');assert.deepEqual(f.local.backupBeforeImport.data.sites,old.sites);assert.deepEqual(f.tabs,tabs);
  assert.equal((await f.request(message,sender)).ok,true);assert.deepEqual(f.local.backupBeforeImport.data.sites,old.sites,'retrying one import does not overwrite its recovery snapshot');
  const after=structuredClone(f.local);f.chrome.storage.local.set=async()=>{throw Error('storage');};
  assert.ok((await f.request({...message,operationId:'import-two'},sender)).error);assert.deepEqual(f.local,after);
});
test('failed native opening leaves backup data untouched and does not create a recovery copy',async()=>{
  const f=workerEnvironment();await flush();const before=structuredClone(f.local);f.chrome.sidePanel.open=async()=>{throw Error('activation');};
  const result=await f.request({type:'space-backup-import',windowId:1,data:{sites:[],spaceConfig:{spaces:[],expandedIds:[]},uiSettings:{panelMode:'push'}}},{id:'test',url:'chrome-extension://test/src/panel/index.html',tab:f.tabs[0]});
  assert.ok(result.error);assert.deepEqual(f.local,before);
});

test('site button and iframe labels follow language settings without changing the website language',async()=>{
  const f=environment(true,{open:true,revision:1,windowId:1},{language:'ru'});f.run();await flush();
  assert.equal(f.launchers[0].title,'Открыть Space');assert.equal(f.nodes[0].shadow.children[0].title,'Space — сайты и вкладки');
  f.setSettings({language:'en'});assert.equal(f.launchers[0].title,'Open Space');assert.equal(f.nodes[0].shadow.children[0].title,'Space — sites and tabs');
  assert.equal(f.doc.documentElement.lang,undefined);
});
