import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {mediaInPage,MediaController} from '../../src/media/controller.js';
const hook=await readFile(new URL('../../src/content/media-session-hook.js',import.meta.url),'utf8');
function page({live=false,noMedia=false}={}) {
  const registered=new Map();
  const audio={tagName:'AUDIO',currentSrc:'https://example.com/song.mp3',paused:false,ended:false,duration:live?Infinity:180,currentTime:42,
    async play(){this.paused=false;},pause(){this.paused=true;}};
  const session={metadata:{title:'Моя песня',artist:'Исполнитель'},playbackState:'playing',setActionHandler(action,fn){registered.set(action,fn);}};
  const context=vm.createContext({navigator:{mediaSession:session},location:{hostname:'music.example.com'},document:{title:'Музыка',querySelectorAll:()=>noMedia?[]:[audio]}});
  vm.runInContext(hook,context);
  const call=command=>vm.runInContext(`(${mediaInPage.toString()})(${JSON.stringify(command)})`,context);
  return {context,audio,session,registered,call};
}
test('transport controls real media, restart begins the current track, and live streams cannot restart',async()=>{
  const p=page();let state=await p.call('state');
  assert.equal(state.title,'Моя песня');assert.equal(state.paused,false);assert.equal(state.next,false);
  await p.call('toggle');assert.equal(p.audio.paused,true);
  await p.call('toggle');assert.equal(p.audio.paused,false);
  p.audio.pause();await p.call('restart');assert.equal(p.audio.currentTime,0);assert.equal(p.audio.paused,false);
  assert.equal((await page({live:true}).call('state')).restart,false);
  await assert.rejects(p.call('next'),/unavailable/);
  const empty=page({noMedia:true});assert.equal(await empty.call('state'),null);
});
test('hook preserves native registrations, previous/next call the actual site handlers, and null removes a capability',async()=>{
  const p=page({noMedia:true});let previous=0,next=0;
  p.session.setActionHandler('play',()=>{});
  p.session.setActionHandler('nexttrack',()=>{next++;});
  p.session.setActionHandler('previoustrack',()=>{previous++;});
  assert.ok(p.registered.get('nexttrack'));
  assert.equal((await p.call('state')).next,true);
  await p.call('next');await p.call('previous');assert.equal(next,1);assert.equal(previous,1);
  vm.runInContext(hook,p.context);await p.call('next');assert.equal(next,2,'hook is idempotent');
  p.session.setActionHandler('nexttrack',null);assert.equal((await p.call('state')).next,false);
});
function fixture() {
  let tabs=[{id:1,windowId:7,url:'https://one.com',active:true},{id:2,windowId:7,url:'https://two.com',audible:true}];
  const states=new Map([[1,{title:'Paused',paused:true,toggle:true,restart:true}],[2,{title:'Playing',paused:false,toggle:true,next:true}]]);
  const calls=[],updates=[];
  const api={tabs:{query:async()=>tabs,get:async id=>tabs.find(tab=>tab.id===id)},scripting:{executeScript:async details=>{
    calls.push(details);
    const state=states.get(details.target.tabId);
    return state?[{frameId:3,documentId:'doc-'+details.target.tabId,result:state}]:[];
  }}};
  const controller=new MediaController(api,7,state=>updates.push(state));
  return {controller,calls,updates,states,tabs};
}
test('selects playing source, retains paused source, scopes command to exact document and refuses moved tabs',async()=>{
  const f=fixture();await f.controller.refresh();assert.equal(f.controller.source.tabId,2);
  f.states.get(2).paused=true;await f.controller.refresh();assert.equal(f.controller.source.tabId,2);
  await f.controller.command('next');assert.deepEqual(f.calls.at(-1).target,{tabId:2,documentIds:['doc-2']});
  assert.deepEqual(f.calls.at(-1).args,['next']);
  f.tabs[1].windowId=9;const count=f.calls.length;await f.controller.command('next');
  assert.equal(f.calls.length,count);assert.ok(f.updates.at(-1).error);
  f.states.clear();await f.controller.refresh();assert.equal(f.controller.source,null);
});
test('duplicate commands do not dispatch twice and command failures keep recovery controls enabled',async()=>{
  const f=fixture();await f.controller.refresh();let release;
  f.controller.api.scripting.executeScript=()=>new Promise(resolve=>{release=resolve;});
  const a=f.controller.command('next'),b=f.controller.command('next');
  await Promise.resolve();assert.equal(f.controller.busy,true);
  release([{result:{...f.controller.source,paused:true}}]);await Promise.all([a,b]);assert.equal(f.controller.busy,false);
  f.controller.api.scripting.executeScript=async()=>{throw Error('gone');};
  await f.controller.command('next');assert.equal(f.controller.busy,false);assert.ok(f.updates.at(-1).error);
});
