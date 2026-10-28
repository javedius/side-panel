import test from 'node:test';
import assert from 'node:assert/strict';
import {transferSite} from '../../src/sites/transfers.js';
const config={spaces:[{id:'work',name:'Работа'},{id:'home',name:'Личное'}],expandedIds:[]};
const site=(id,section='favorites',spaceId)=>({id,name:id,url:`https://${id}.com/`,section,...(spaceId?{spaceId}:{})});
test('site moves preserve metadata, exact order, other groups and expand the destination',()=>{
  const items=[site('a'),site('b'),site('c','space','work'),site('d','space','work')];
  const result=transferSite(items,config,{kind:'site',id:'b'},{section:'favorites',beforeId:'a'});
  assert.deepEqual(result.sites.map(item=>item.id),['b','a','c','d']);assert.equal(items[0].id,'a');
  const moved=transferSite(result.sites,config,{kind:'site',id:'b'},{section:'space',spaceId:'work',beforeId:'c',after:true});
  assert.deepEqual(moved.sites.filter(item=>item.section==='space').map(item=>item.id),['c','b','d']);
  assert.equal(moved.sites.find(item=>item.id==='b').spaceId,'work');assert.deepEqual(moved.spaceConfig.expandedIds,['work']);
  const home=transferSite(moved.sites,moved.spaceConfig,{kind:'site',id:'b'},{section:'space',spaceId:'home'});
  assert.equal(home.sites.filter(item=>item.spaceId==='work').length,2);
});
test('full favorites allow reordering but reject additions without deleting existing sites',()=>{
  const items=[...Array.from({length:9},(_,i)=>site('s'+i)),site('extra','space','work')],snapshot=structuredClone(items);
  assert.throws(()=>transferSite(items,config,{kind:'site',id:'extra'},{section:'favorites'}),/9/);
  assert.deepEqual(items,snapshot);
  const reordered=transferSite(items,config,{kind:'site',id:'s0'},{section:'favorites',beforeId:'s8',after:true});
  assert.equal(reordered.sites.filter(item=>item.section==='favorites').at(-1).id,'s0');
});
test('saving a live tab does not mutate it, avoids duplicates in the target and rejects stale targets',()=>{
  const tab={id:5,title:'Документ',url:'https://doc.com/'};
  const first=transferSite([],config,{kind:'tab',id:5,newId:'saved'},{section:'space',spaceId:'work'},tab);
  assert.equal(first.sites[0].name,'Документ');assert.equal(tab.id,5);
  assert.equal(transferSite(first.sites,config,{kind:'tab',id:5,newId:'another'},{section:'space',spaceId:'work'},tab).sites.length,1);
  assert.throws(()=>transferSite([],config,{kind:'tab',id:5,newId:'x'},{section:'space',spaceId:'gone'},tab),/deleted/);
  assert.throws(()=>transferSite([],config,{kind:'tab',id:5,newId:'x'},{section:'favorites'},{...tab,url:'chrome://extensions/'}),/cannot/);
  assert.throws(()=>transferSite([],config,{kind:'site',id:'gone'},{section:'favorites'}),/deleted/);
});
