import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpaceConfig, assignSitesToSpaces, validateSpaceName } from '../../src/spaces/model.js';
test('legacy site migration is idempotent and keeps saved IDs, addresses and favorite grid intact',()=>{
  const original=[{id:'a',url:'https://a.com/',section:'space'},{id:'b',url:'https://b.com/',section:'favorites'}];
  const config=normalizeSpaceConfig();const next=assignSitesToSpaces(original,config);
  assert.deepEqual(next[0],{...original[0],spaceId:'default'});assert.equal(next[1],original[1]);
  assert.deepEqual(assignSitesToSpaces(next,config),next);assert.equal(original[0].spaceId,undefined);
});
test('configuration preserves names and independently collapsed spaces on reload',()=>{
  const config={spaces:[{id:'work',name:'Работа'},{id:'hobby',name:'Хобби'}],expandedIds:['hobby']};
  assert.deepEqual(normalizeSpaceConfig(JSON.parse(JSON.stringify(config))),config);
  assert.deepEqual(normalizeSpaceConfig({...config,expandedIds:[]}).expandedIds,[]);
  const site={id:'a',url:'https://a.com/',section:'space',spaceId:'work'};
  assert.equal(assignSitesToSpaces([site],config)[0],site);
});
test('invalid config recovers a default Space and orphaned sites stay visible',()=>{
  const config=normalizeSpaceConfig({spaces:[null,{id:'bad',name:''}],expandedIds:['missing']});
  assert.equal(config.spaces.length,1);
  assert.equal(assignSitesToSpaces([{section:'space',spaceId:'missing'}],config)[0].spaceId,config.spaces[0].id);
});
test('name validation trims, rejects blank/long/duplicate names and permits own unchanged name',()=>{
  const spaces=[{id:'a',name:'Работа'}];
  assert.ok(validateSpaceName('  ',spaces));assert.ok(validateSpaceName('a'.repeat(61),spaces));
  assert.ok(validateSpaceName('  РАБОТА ',spaces));assert.equal(validateSpaceName('Работа',spaces,'a'),'');
  assert.equal(validateSpaceName('Личное',spaces),'');
});
test('an intentionally empty group list stays empty across reloads',()=>{
  assert.deepEqual(normalizeSpaceConfig({spaces:[],expandedIds:[]}),{spaces:[],expandedIds:[]});
  assert.deepEqual(normalizeSpaceConfig({spaces:[]}),{spaces:[],expandedIds:[]});
});
