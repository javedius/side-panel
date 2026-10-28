import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const localeSource=(await readFile(new URL('../../src/shared/messages.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../../src/shared/i18n.js',import.meta.url),'utf8'));
const pathsSource=await readFile(new URL('../../src/shared/paths.js',import.meta.url),'utf8');
const settings=await readFile(new URL('../../src/shared/ui-settings.js',import.meta.url),'utf8');
const searchModel=await readFile(new URL('../../src/search/model.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../../src/background/search.js',import.meta.url),'utf8');
const overlay=await readFile(new URL('../../src/content/search-overlay.js',import.meta.url),'utf8');
const page=(await readFile(new URL('../../src/search/index.js',import.meta.url),'utf8')).replace(/^import .+;$/gm,'');
const markup=await readFile(new URL('../../src/search/index.html',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const event=()=>({handlers:[],addListener(fn){this.handlers.push(fn);},fire(...args){for(const fn of this.handlers)fn(...args);}});
function service() {
  const session={},local={uiSettings:{searchEngine:'yandex'}},views=new Map(),calls={create:[],inject:[],popup:[],focus:[],remove:[],update:[]};
  let id=100,nonce=0;
  const tabs=[{id:1,windowId:7,url:'https://example.com/',active:true},{id:2,windowId:8,url:'https://other.com/',active:true}];
  const area=data=>({get:async key=>Object.fromEntries((Array.isArray(key)?key:[key]).map(k=>[k,structuredClone(data[k])])),set:async values=>Object.assign(data,structuredClone(values)),remove:async key=>{delete data[key];}});
  const api={
    runtime:{id:'ext',getURL:path=>'chrome-extension://ext/'+path,onMessage:event()},commands:{onCommand:event()},
    storage:{session:area(session),local:area(local)},action:{setBadgeText:async()=>{},setTitle:async()=>{}},
    scripting:{executeScript:async info=>calls.inject.push(info)},
    windows:{onRemoved:event(),get:async()=>({left:0,top:0,width:1280,height:800}),
      create:async info=>{calls.popup.push(info);const popup={id:90,tabs:[{id:91,windowId:90,url:info.url,active:true}]};tabs.push(popup.tabs[0]);return popup;},
      update:async(id,props)=>calls.focus.push({id,...props}),remove:async id=>calls.remove.push(id)},
    tabs:{query:async options=>tabs.filter(tab=>(options.windowId===undefined||tab.windowId===options.windowId)&&(!options.active||tab.active)),
      update:async(id,props)=>{const tab=tabs.find(tab=>tab.id===id);if(!tab)throw Error('missing');calls.update.push({id,...props});return Object.assign(tab,props);},
      create:async info=>{calls.create.push(info);const tab={...info,id:id++};tabs.push(tab);return tab;},
      sendMessage:async(id,message)=>{
        if(message.type==='space-quick-search-focus') return {open:views.has(id)};
        if(message.type==='space-quick-search-open') {views.set(id,message);return {open:true};}
        if(message.type==='space-quick-search-close'&&views.get(id)?.token===message.token) views.delete(id);
        return {ok:true};
      }}
  };
  const context=vm.createContext({URL,console,crypto:{randomUUID:()=>`nonce-${++nonce}`}});vm.runInContext(pathsSource,context);vm.runInContext(localeSource,context);vm.runInContext(settings,context);vm.runInContext(searchModel,context);vm.runInContext(worker,context);
  const controller=context.SpaceQuickSearch.install(api,context.SpaceUi,url=>!/^https?:/.test(url||''));
  const record=()=>session['space-quick-search-7'];
  const sender=(tab=tabs[0])=>({id:'ext',url:'chrome-extension://ext/src/search/index.html?token='+record()?.token,tab,frameId:1});
  const request=(message,from=sender())=>new Promise(resolve=>{const keep=api.runtime.onMessage.handlers[0](message,from,resolve);if(keep!==true)resolve(undefined);});
  return {api,controller,session,local,tabs,calls,views,record,sender,request};
}
test('search command opens isolated UI, repeated opening reuses it, and sidebar state is untouched',async()=>{
  const f=service();f.session['space-overlay-window-7']={open:true};
  f.api.commands.onCommand.fire('quick-search',f.tabs[0]);await flush();
  assert.equal(f.calls.inject.length,1);assert.deepEqual(Array.from(f.calls.inject[0].files),['src/shared/paths.js','src/shared/messages.js','src/shared/i18n.js','src/content/search-overlay.js']);assert.equal(f.views.size,1);assert.equal(f.calls.create.length,0);
  const token=f.record().token;await f.controller.open(f.tabs[0]);assert.equal(f.record().token,token);assert.equal(f.calls.inject.length,1);
  assert.deepEqual(f.session['space-overlay-window-7'],{open:true});
});
test('submitting uses the panel provider, encodes the query, and opens exactly one new tab in the source window',async()=>{
  const f=service();await f.controller.open(f.tabs[0]);const original=f.tabs[0].url;
  const text='кот & dog + #1',message={type:'space-quick-search-submit',windowId:7,token:f.record().token,text};
  const results=await Promise.all([f.request(message),f.request(message)]);
  assert.ok(results.every(result=>result.ok));assert.equal(f.calls.create.length,1);assert.equal(f.calls.create[0].windowId,7);
  const url=new URL(f.calls.create[0].url);assert.equal(url.hostname,'yandex.ru');assert.equal(url.searchParams.get('text'),text);
  assert.equal(f.tabs[0].url,original);assert.equal(f.record(),undefined);assert.equal(f.views.size,0);
  assert.equal(JSON.stringify(f.session).includes(text),false,'queries are not saved');
});
test('provider changes apply at submit; empty, stale and foreign requests cannot create tabs',async()=>{
  const f=service();await f.controller.open(f.tabs[0]);
  const message={type:'space-quick-search-submit',windowId:7,token:f.record().token,text:'hello'};
  assert.equal(await f.request(message,{...f.sender(),url:'https://evil.com'}),undefined);
  assert.ok((await f.request({...message,token:'old'})).error);
  assert.ok((await f.request(message,{...f.sender(),tab:f.tabs[1]})).error);
  assert.ok((await f.request({...message,text:'  '})).error);assert.equal(f.calls.create.length,0);
  f.local.uiSettings.searchEngine='duckduckgo';assert.ok((await f.request(message)).ok);
  assert.equal(new URL(f.calls.create[0].url).hostname,'duckduckgo.com');
});
test('tab creation failure preserves query UI for retry and an ambiguous pending session is not resubmitted',async()=>{
  const f=service();await f.controller.open(f.tabs[0]);
  const message={type:'space-quick-search-submit',windowId:7,token:f.record().token,text:'retry'};
  const create=f.api.tabs.create;f.api.tabs.create=async()=>{throw Error('window gone');};
  assert.ok((await f.request(message)).error);assert.equal(f.record().status,'ready');assert.equal(f.views.size,1);
  f.record().status='pending';assert.ok((await f.request(message)).error);assert.equal(f.calls.create.length,0);
  f.record().status='ready';f.api.tabs.create=create;assert.ok((await f.request(message)).ok);assert.equal(f.calls.create.length,1);
});
test('restricted pages use one popup, searches return to the original window, and popup shortcuts do not nest',async()=>{
  const f=service();f.tabs[0].url='chrome://newtab/';await f.controller.open(f.tabs[0]);
  assert.equal(f.calls.inject.length,0);assert.equal(f.calls.popup.length,1);
  const popup=f.tabs.find(tab=>tab.id===91);await f.controller.open(popup);assert.equal(f.calls.popup.length,1);
  await f.controller.open(f.tabs[0]);assert.equal(f.calls.popup.length,1);assert.equal(f.calls.focus.at(-1).id,90);
  const message={type:'space-quick-search-submit',windowId:7,token:f.record().token,text:'new tab'};
  assert.ok((await f.request(message,f.sender(popup))).ok);assert.equal(f.calls.create[0].windowId,7);
  assert.equal(f.calls.focus.at(-1).id,7);assert.deepEqual(f.calls.remove,[90]);
});
test('a blocked injection falls back to the popup; trusted close clears only its own session',async()=>{
  const f=service();f.api.scripting.executeScript=async()=>{throw Error('blocked');};await f.controller.open(f.tabs[0]);
  assert.equal(f.calls.popup.length,1);
  const popup=f.tabs.find(tab=>tab.id===91),token=f.record().token;
  assert.equal((await f.request({type:'space-quick-search-dismiss',windowId:7,token},f.sender())).ok,false);
  assert.equal((await f.request({type:'space-quick-search-dismiss',windowId:7,token},f.sender(popup))).ok,true);
  assert.equal(f.record(),undefined);assert.equal(f.calls.create.length,0);
});
class Element {
  constructor(){this.listeners={};this.children=[];this.value='';this.attrs={};this.classList={add(){}};this.hidden=false;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  setAttribute(key,value){this.attrs[key]=value;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  focus(){this.focused=true;if(this.document)this.document.activeElement=this;}
  async fire(type,extra={}){for(const fn of this.listeners[type]||[])await fn({preventDefault(){},target:this,...extra});}
}
function searchPage({getSettings=async()=>({uiSettings:{searchEngine:'bing'}})}={}) {
  const elements=Object.fromEntries([...markup.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
  const events={},messages=[],closed=[];const storage=event();let reply=async()=>({ok:true});
  const doc={activeElement:null,getElementById:id=>elements[id],body:new Element(),createElement:()=>{const el=new Element();el.document=doc;return el;},addEventListener:(type,fn)=>{events[type]=fn;}};
  for(const el of Object.values(elements))el.document=doc;
  const context=vm.createContext({URL,URLSearchParams,document:doc,
    window:{location:{search:'?token=t&windowId=7'},parent:{postMessage:message=>closed.push(message)}},
    chrome:{storage:{local:{get:getSettings},onChanged:storage},runtime:{getURL:path=>'chrome-extension://ext/'+path,sendMessage:message=>{messages.push(message);return reply(message);}}}});
  vm.runInContext(pathsSource,context);vm.runInContext(localeSource,context);vm.runInContext(settings,context);vm.runInContext(page,context);
  return {elements,events,messages,closed,storage,doc,setReply:fn=>{reply=fn;}};
}
test('search form handles clear, IME, busy duplicates and successful dismissal',async()=>{
  const f=searchPage();await flush();const e=f.elements;
  assert.equal(e['search-submit'].disabled,true);
  e['search-query'].value='hello';await e['search-query'].fire('input');assert.equal(e['search-clear'].hidden,false);
  await e['search-clear'].fire('click');assert.equal(e['search-query'].value,'');assert.equal(e['search-clear'].hidden,true);
  e['search-query'].value='  hello  ';await e['search-query'].fire('input');
  await e['search-query'].fire('compositionstart');await e['quick-search-form'].fire('submit');assert.equal(f.messages.filter(m=>m.type==='space-quick-search-submit').length,0);
  await e['search-query'].fire('compositionend');let release;f.setReply(()=>new Promise(resolve=>{release=resolve;}));
  const pending=e['quick-search-form'].fire('submit');await e['quick-search-form'].fire('submit');assert.equal(f.messages.filter(m=>m.type==='space-quick-search-submit').length,1);
  assert.equal(e['search-submit'].disabled,true);assert.equal(f.messages.find(m=>m.type==='space-quick-search-submit').text,'hello');release({ok:true});await pending;
  assert.equal(f.closed.length,1);
});
test('search failure keeps the input available and Escape closes without sending a query',async()=>{
  const f=searchPage(),e=f.elements;f.setReply(async()=>({error:'Не удалось открыть вкладку.'}));
  e['search-query'].value='keep me';await e['quick-search-form'].fire('submit');
  assert.equal(e['search-query'].value,'keep me');assert.equal(e['search-error'].hidden,false);assert.equal(e['search-submit'].disabled,false);
  const before=f.messages.length;f.events.keydown({key:'Escape',preventDefault(){}});assert.equal(f.messages.length,before);assert.equal(f.closed.length,1);
});
test('search icon follows the selected provider, displays its favicon and recovers from image failure',async()=>{
  const f=searchPage();await flush();const e=f.elements,icon=e['search-provider-icon'],image=e['search-provider-image'];
  assert.equal(icon.attrs['aria-label'],'Search engine: Bing');assert.equal(icon.title,'Bing');
  let url=new URL(image.src);assert.equal(url.origin,'null');assert.equal(url.protocol,'chrome-extension:');
  assert.equal(url.host,'ext');assert.equal(url.pathname,'/_favicon/');assert.equal(url.searchParams.get('pageUrl'),'https://www.bing.com/');
  assert.equal(image.hidden,true);image.naturalWidth=32;await image.fire('load');assert.equal(image.hidden,false);
  f.storage.fire({uiSettings:{newValue:{searchEngine:'yandex'}}},'local');
  assert.equal(icon.title,'Yandex');assert.equal(image.hidden,true);
  assert.equal(new URL(image.src).searchParams.get('pageUrl'),'https://yandex.ru/');
  await image.fire('error');assert.equal(image.hidden,true);assert.equal(e['search-submit'].disabled,true);
  f.storage.fire({uiSettings:{newValue:{searchEngine:'duckduckgo'}}},'local');image.naturalWidth=32;await image.fire('load');
  assert.equal(icon.title,'DuckDuckGo');assert.equal(image.hidden,false);assert.equal(f.messages.length,0);
});
test('provider icon ignores stale hydration and falls back to the default on storage failure',async()=>{
  let release;const f=searchPage({getSettings:()=>new Promise(resolve=>{release=resolve;})});
  f.storage.fire({uiSettings:{newValue:{searchEngine:'yandex'}}},'local');
  release({uiSettings:{searchEngine:'bing'}});await flush();assert.equal(f.elements['search-provider-icon'].title,'Yandex');
  const failed=searchPage({getSettings:async()=>{throw Error('unavailable');}});await flush();
  assert.equal(failed.elements['search-provider-icon'].title,'Google');
  assert.equal(new URL(failed.elements['search-provider-image'].src).searchParams.get('pageUrl'),'https://www.google.com/');
});
function searchOverlay() {
  const events={},messages={},nodes=[],requests=[];let active;
  const previous={isConnected:true,focus(){active=this;}};
  const doc={visibilityState:'visible',get activeElement(){return active||previous;},documentElement:{append:node=>nodes.push(node)},addEventListener:(type,fn)=>{events[type]=fn;},
    createElement:tag=>({tag,open:false,children:[],listeners:{},contentWindow:{},style:{setProperty(){}},setAttribute(){},
      append(node){this.children.push(node);node.parent=this;},contains(node){return node===this||this.children.some(child=>child.contains(node))||this.shadow?.children.some(child=>child===node)||false;},
      attachShadow(){assert.equal(tag,'div','native dialog is not a valid shadow host');return this.shadow={children:[],append(node){this.children.push(node);}};},
      addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;},focus(){active=this;}})};
  const runtime={id:'ext',getManifest:()=>({version:'1'}),getURL:path=>'chrome-extension://ext/'+path,onMessage:event(),sendMessage:async message=>{requests.push(message);}};
  const context=vm.createContext({URL,document:doc,window:{addEventListener:(type,fn)=>{messages[type]=fn;}},chrome:{runtime,storage:{onChanged:event(),local:{get:async()=>({})}}}});
  vm.runInContext(pathsSource,context);vm.runInContext(localeSource,context);vm.runInContext(overlay,context);
  const deliver=(message,sender={id:'ext'})=>{let result;runtime.onMessage.handlers[0](message,sender,response=>{result=response;});return result;};
  return {doc,nodes,requests,events,messages,previous,context,deliver};
}
test('modal overlay isolates its frame, rejects forged close messages and restores prior focus',()=>{
  const f=searchOverlay();assert.equal(f.deliver({type:'space-quick-search-open',token:'t',windowId:7},{id:'other'}),undefined);
  assert.equal(f.deliver({type:'space-quick-search-open',token:'t',windowId:7}).open,true);
  const host=f.nodes[0],frame=host.children[0].shadow.children[0];assert.equal(host.open,true);assert.equal(frame.title,'Quick search — Space');
  f.messages.message({source:{},data:{type:'space-quick-search-close'}});assert.equal(host.open,true);
  f.messages.message({source:frame.contentWindow,data:{type:'space-quick-search-close'}});assert.equal(host.removed,true);assert.equal(f.doc.activeElement,f.previous);
  assert.equal(f.requests.at(-1).type,'space-quick-search-closed');
});
test('overlay pagehide closes the view without searching or changing page styles',()=>{
  const f=searchOverlay();f.deliver({type:'space-quick-search-open',token:'t',windowId:7});f.messages.pagehide();
  assert.equal(f.nodes[0].removed,true);assert.ok(f.requests.every(message=>message.type!=='space-quick-search-submit'));
});

test('direct addresses open in a new tab while ordinary text remains a provider search',async()=>{
  const f=service();await f.controller.open(f.tabs[0]);
  assert.ok((await f.request({type:'space-quick-search-submit',windowId:7,token:f.record().token,text:'github.com/path?q=one'})).ok);
  assert.equal(f.calls.create[0].url,'https://github.com/path?q=one');
  await f.controller.open(f.tabs[0]);
  assert.ok((await f.request({type:'space-quick-search-submit',windowId:7,token:f.record().token,text:'javascript:alert(1)'})).ok);
  assert.equal(new URL(f.calls.create[1].url).host,'yandex.ru');
});
test('unified results deduplicate, switch windows and revalidate saved destinations at activation',async()=>{
  const f=service();f.tabs[1].title='Почта';f.local.sites=[{id:'mail',name:'Почта',url:f.tabs[1].url,section:'favorites'},{id:'doc',name:'Документ',url:'https://docs.test/',section:'space',spaceId:'work'}];
  f.local.spaceConfig={spaces:[{id:'work',name:'Работа'}]};await f.controller.open(f.tabs[0]);
  const base={windowId:7,token:f.record().token};
  const suggestions=await f.request({...base,type:'space-quick-search-suggest',text:'почта'});
  assert.equal(suggestions.matches.length,1);assert.equal(suggestions.matches[0].key,'tab:2');
  assert.ok((await f.request({...base,type:'space-quick-search-submit',selection:'tab:2',text:'почта'})).ok);
  assert.equal(f.calls.create.length,0);assert.equal(f.calls.update[0].id,2);assert.equal(f.calls.focus.at(-1).id,8);
  await f.controller.open(f.tabs[0]);const current={windowId:7,token:f.record().token};
  assert.equal((await f.request({...current,type:'space-quick-search-suggest',text:'Работа'})).matches[0].key,'site:doc');
  f.local.sites.find(site=>site.id==='doc').url='https://docs.test/new';
  assert.ok((await f.request({...current,type:'space-quick-search-submit',selection:'site:doc',text:'Работа',url:'javascript:evil'})).ok);
  assert.equal(f.calls.create[0].url,'https://docs.test/new','activation uses current storage, never a supplied URL');
});
test('stale, foreign and closed result requests cannot navigate or expose private tabs',async()=>{
  const f=service();f.tabs.push({id:4,windowId:9,incognito:true,url:'https://private.test/',title:'Почта'});
  await f.controller.open(f.tabs[0]);const base={windowId:7,token:f.record().token};
  assert.equal(await f.request({...base,type:'space-quick-search-suggest',text:'почта'},{...f.sender(),url:'https://evil.com'}),undefined);
  assert.equal((await f.request({...base,type:'space-quick-search-suggest',text:'почта'})).matches.length,0);
  assert.ok((await f.request({...base,type:'space-quick-search-submit',selection:'tab:4',text:'почта'})).error);
  assert.ok((await f.request({...base,type:'space-quick-search-submit',selection:'tab:999',text:'почта'})).error);
  assert.ok((await f.request({...base,type:'space-quick-search-submit',selection:'site:gone',text:'почта'})).error);
  assert.equal(f.calls.create.length,0);assert.equal(f.record().status,'ready');
});
test('suggestions are keyboard reachable, selection is explicit and stale responses never replace current input',async()=>{
  const f=searchPage(),e=f.elements,releases={};
  f.setReply(message=>message.type==='space-quick-search-suggest'?new Promise(resolve=>{releases[message.text]=resolve;}):Promise.resolve({ok:true}));
  e['search-query'].value='old';await e['search-query'].fire('input');
  e['search-query'].value='new';await e['search-query'].fire('input');
  releases.new({matches:[{key:'tab:7',title:'New tab',url:'https://new.test/',detail:'Open tab'}]});await flush();
  releases.old({matches:[{key:'tab:8',title:'Старая вкладка',url:'https://old.test/',detail:'Open tab'}]});await flush();
  const button=e['search-results'].children[0].children[0];assert.equal(button.children[0].textContent,'New tab');
  f.events.keydown({key:'ArrowDown',preventDefault(){}});assert.equal(f.doc.activeElement,button);
  f.events.keydown({key:'ArrowUp',preventDefault(){}});assert.equal(f.doc.activeElement,e['search-query']);
  await button.fire('click');assert.equal(f.messages.find(message=>message.type==='space-quick-search-submit').selection,'tab:7');
});

test('search localizes provider, result kinds and errors while preserving site titles and query text',async()=>{
  const f=searchPage({getSettings:async()=>({uiSettings:{language:'ru',searchEngine:'yandex'}})});await flush();
  const e=f.elements;
  assert.equal(e['search-provider-icon'].attrs['aria-label'],'Поисковик: Яндекс');
  f.setReply(async message=>message.type==='space-quick-search-suggest'?{matches:[
    {key:'site:work',title:'Save',url:'https://work.test/',detail:'Space · Work'},
    {key:'tab:1',title:'Настройки / Settings',url:'https://tab.test/',detail:'Open tab'}
  ]}:{error:'Could not open the tab. Try again.'});
  e['search-query'].value='мой запрос';await e['search-query'].fire('input');await flush();
  const rows=e['search-results'].children;
  assert.equal(rows[0].children[0].children[0].textContent,'Save');
  assert.equal(rows[0].children[0].children[1].textContent,'Пространство · Work');
  assert.equal(rows[1].children[0].children[1].textContent,'Открытая вкладка');
  assert.match(e['search-matches-status'].textContent,/Совпадений: 2/);
  await e['quick-search-form'].fire('submit');assert.equal(e['search-error'].textContent,'Не удалось открыть вкладку. Попробуй ещё раз.');
  assert.equal(e['search-query'].value,'мой запрос');
  f.storage.fire({uiSettings:{newValue:{language:'en',searchEngine:'google'}}},'local');await flush();
  assert.equal(e['search-provider-icon'].attrs['aria-label'],'Search engine: Google');
  assert.equal(e['search-results'].children[0].children[0].children[1].textContent,'Space · Work');
});
