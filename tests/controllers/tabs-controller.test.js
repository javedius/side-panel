import test from 'node:test';
import assert from 'node:assert/strict';
import { TabsController, normalizeUrl } from '../../src/tabs/controller.js';
const site={id:'google',url:'https://google.com',name:'Google',section:'favorites'};
function setup(initial=[]) {
  let tabs=initial.map(tab=>({windowId:1,index:0,...tab}));
  const data={}; const calls={created:0,updated:[]};
  const api={
    storage:{session:{get:async key=>({[key]:structuredClone(data[key])}),set:async value=>Object.assign(data,structuredClone(value))}},
    tabs:{
      query:async({windowId})=>tabs.filter(t=>t.windowId===windowId).map(t=>({...t})),
      create:async({windowId,url='chrome://newtab/',active=true})=>{
        calls.created++; const tab={id:100+calls.created,index:tabs.length,windowId,url,active};
        tabs.push(tab); return {...tab};
      },
      update:async(id,changes)=>{
        const tab=tabs.find(t=>t.id===id); if(!tab) throw Error('No tab');
        Object.assign(tab,changes);calls.updated.push(id);return tab;
      }
    }
  };
  return {api,calls,data,get tabs(){return tabs;},set tabs(value){tabs=value;}};
}
test('normalizes root URL without dropping document paths or query parameters',()=>{
  assert.equal(normalizeUrl('https://google.com'),'https://google.com/');
  assert.notEqual(normalizeUrl('https://a.com/a?x=1'),normalizeUrl('https://a.com/a?x=2'));
});
test('adopts exact existing tab only in the panel window',async()=>{
  const f=setup([{id:1,url:'https://google.com/',windowId:2},{id:2,url:'https://google.com/'}]);
  const c=new TabsController(f.api,1);await c.init([site]);await c.open(site,()=>[site]);
  assert.equal(c.linked(site).id,2);assert.deepEqual(f.calls.updated,[2]);assert.equal(f.calls.created,0);
});
test('rapid repeated clicks open a single tab',async()=>{
  const f=setup();const c=new TabsController(f.api,1);await c.init([site]);
  await Promise.all([c.open(site,()=>[site]),c.open(site,()=>[site]),c.open(site,()=>[site])]);
  assert.equal(f.calls.created,1);assert.equal(c.linked(site).id,101);
});
test('binding follows navigation and survives panel reload in the browser session',async()=>{
  const f=setup();let c=new TabsController(f.api,1);await c.init([site]);await c.open(site,()=>[site]);
  f.tabs[0].url='https://accounts.google.com/redirect';
  c=new TabsController(f.api,1);await c.init([site]);await c.open(site,()=>[site]);
  assert.equal(f.calls.created,1);assert.equal(c.linked(site).url,'https://accounts.google.com/redirect');
});
test('closed linked tab reopens while saved site stays intact',async()=>{
  const f=setup();const c=new TabsController(f.api,1);await c.init([site]);await c.open(site,()=>[site]);
  f.tabs=[];await c.refresh([site]);assert.equal(c.linked(site),undefined);
  await c.open(site,()=>[site]);assert.equal(f.calls.created,2);assert.equal(site.url,'https://google.com');
});
test('Space and grid use the same binding, rename and move retain live tab',async()=>{
  const f=setup();const c=new TabsController(f.api,1);await c.init([site]);await c.open(site,()=>[site]);
  f.tabs[0].url='https://google.com/search?q=space';
  const moved={...site,name:'Search',section:'space'};await c.refresh([moved]);
  assert.equal(c.linked(moved).id,101);assert.equal(c.ordinary().length,0);
});
test('editing a saved URL releases old tab without closing it, including from another panel',async()=>{
  const f=setup();let c=new TabsController(f.api,1);await c.init([site]);await c.open(site,()=>[site]);
  const edited={...site,url:'https://example.com'};
  c=new TabsController(f.api,1);await c.init([edited]);
  assert.equal(c.linked(edited),undefined);assert.equal(c.ordinary()[0].id,101);
  await c.open(edited,()=>[edited]);assert.equal(f.calls.created,2);assert.equal(f.tabs.length,2);
});
test('removing saved site leaves browser tab in ordinary list',async()=>{
  const f=setup([{id:5,url:site.url}]);const c=new TabsController(f.api,1);await c.init([site]);
  await c.refresh([]);assert.deepEqual(c.ordinary().map(t=>t.id),[5]);assert.equal(f.tabs.length,1);
});
test('duplicate saved URLs do not claim one browser tab twice',async()=>{
  const other={...site,id:'other'};const f=setup([{id:5,url:site.url}]);
  const c=new TabsController(f.api,1);await c.init([site,other]);
  assert.equal(c.linked(site).id,5);assert.equal(c.linked(other),undefined);
  await c.open(other,()=>[site,other]);assert.equal(f.calls.created,1);
});
test('tab detached to another window becomes unlinked here',async()=>{
  const f=setup([{id:5,url:site.url}]);const c=new TabsController(f.api,1);await c.init([site]);
  f.tabs[0].windowId=2;await c.refresh([site]);assert.equal(c.linked(site),undefined);
});
test('query failure preserves associations and does not create a duplicate',async()=>{
  const f=setup([{id:5,url:site.url}]);const c=new TabsController(f.api,1);await c.init([site]);
  f.api.tabs.query=async()=>{throw Error('unavailable');};
  await assert.rejects(c.open(site,()=>[site]));assert.equal(c.linked(site).id,5);assert.equal(f.calls.created,0);
});
test('activation failure on a still-existing tab does not create a duplicate',async()=>{
  const f=setup([{id:5,url:site.url}]);const c=new TabsController(f.api,1);await c.init([site]);
  f.api.tabs.update=async()=>{throw Error('drag in progress');};
  await assert.rejects(c.open(site,()=>[site]));assert.equal(f.calls.created,0);
});
test('outdated query result cannot overwrite newer live tabs',async()=>{
  const f=setup([{id:1,url:site.url}]);const c=new TabsController(f.api,1);await c.init([site]);
  const original=f.api.tabs.query;let resolve;
  f.api.tabs.query=()=>new Promise(r=>{resolve=r;});const old=c.refresh([site]);
  f.api.tabs.query=original;f.tabs=[{id:2,url:site.url,windowId:1,index:0}];await c.refresh([site]);
  resolve([{id:1,url:site.url,windowId:1,index:0}]);await old;assert.equal(c.linked(site).id,2);
});
