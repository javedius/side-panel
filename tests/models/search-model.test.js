import test from 'node:test';
import assert from 'node:assert/strict';
import '../../src/search/model.js';
const {directURL,matches}=SpaceSearch;
test('address recognition distinguishes domains, paths, ports and Unicode from words and executable schemes',()=>{
  for(const [text,url] of [['github.com','https://github.com/'],['example.com/docs?q=a#top','https://example.com/docs?q=a#top'],['http://example.com/a','http://example.com/a'],['localhost:3000','https://localhost:3000/'],['[::1]:8080','https://[::1]:8080/'],['пример.рф','https://xn--e1afmkfd.xn--p1ai/']]) assert.equal(directURL(text),url);
  for(const text of ['обычный запрос','как работает github.com','javascript:alert(1)','data:text/html,test','file:///tmp/test','user@example.com','https://user:pass@example.com','https://example.com\\@evil.com','https://','', 'a'.repeat(2001)]) assert.equal(directURL(text),null,text);
});
test('matches cover titles, URLs and Space names, reuse open tabs and keep five safe scoped results',()=>{
  const tabs=[{id:1,windowId:1,url:'https://mail.test/',title:'Входящие'}, {id:2,windowId:2,url:'https://work.test/',title:'Рабочая почта'}, {id:3,windowId:1,url:'https://secret.test/',title:'Почта',incognito:true}];
  const sites=[{id:'mail',name:'Почта',url:'https://mail.test/',section:'favorites'},{id:'docs',name:'Документы',url:'https://docs.test/',section:'space',spaceId:'work'}];
  const config={spaces:[{id:'work',name:'Работа'}]};
  assert.equal(matches('ПОчта',tabs,sites,config,1).find(item=>item.title==='Почта').key,'tab:1');
  assert.equal(matches('Работа',tabs,sites,config,1).find(item=>item.key==='site:docs').detail,'Space · Работа');
  assert.equal(matches('secret',tabs,sites,config,1).length,0);
  assert.equal(matches('почта',tabs,sites,config,1).some(item=>item.key==='tab:3'),false);
  assert.equal(matches('',tabs,sites,config,1).length,0);
  const many=Array.from({length:12},(_,i)=>({id:i,windowId:1,url:`https://test${i}.com/`,title:'Пример '+i}));
  assert.equal(matches('пример',many,[],config,1).length,5);
  assert.equal(matches('docs.test',[],sites,config,1)[0].key,'site:docs');
});
