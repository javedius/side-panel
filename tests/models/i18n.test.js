import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../../src/shared/messages.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../../src/shared/i18n.js',import.meta.url),'utf8'));
function setup({browser,system='en-US',document}={}) {
  const context=vm.createContext({chrome:{i18n:{getUILanguage:()=>browser}},navigator:{language:system},document});
  vm.runInContext(source,context);
  return {context,i18n:context.SpaceI18n};
}
test('automatic locale follows Chrome UI language, falls back to the system, then English',()=>{
  for(const browser of ['ru','ru-RU','ru_BY','RU-ru']) assert.equal(setup({browser,system:'en-US'}).i18n.language,'ru');
  assert.equal(setup({system:'ru-RU'}).i18n.language,'ru');
  for(const browser of ['en-GB','de-DE','ja','russian']) assert.equal(setup({browser,system:'ru-RU'}).i18n.language,'en');
});
test('manual language wins and switching back to auto resolves the current browser language',()=>{
  const {i18n}=setup({browser:'ru-RU'});
  i18n.setLanguage('en');assert.equal(i18n.t('Save'),'Save');
  i18n.setLanguage('ru');assert.equal(i18n.t('Save'),'Сохранить');
  i18n.setLanguage('auto');assert.equal(i18n.language,'ru');
  assert.equal(i18n.resolve('en','ru'),'en');assert.equal(i18n.resolve('ru','de'),'ru');
  assert.equal(i18n.resolve('invalid','de'),'en');
});
test('only named placeholders are replaced; names, URLs, and missing messages stay intact',()=>{
  const {i18n}=setup({browser:'ru'}),name='Save <img onerror=bad()> {count}';
  assert.equal(i18n.t('Delete “{name}”?',{name}),'Удалить «'+name+'»?');
  assert.equal(i18n.t('Space · {name}',{name:'Работа / Work'}),'Пространство · Работа / Work');
  assert.equal(i18n.t('New future message'),'New future message');
  assert.equal(i18n.t('constructor'),'constructor');
  assert.equal(i18n.t('Edit {name}'),'Изменить «{name}»');
});
test('content-script language changes never mutate the website document',()=>{
  let touched=0;
  const {i18n}=setup({document:{documentElement:{setAttribute(){touched++;}},querySelectorAll(){touched++;return [];}}});
  i18n.setLanguage('ru');i18n.setLanguage('en');assert.equal(touched,0);
});
test('document translation changes only marked UI; live bindings retain names and dialog intent',()=>{
  const node=(attrs={},textContent='')=>({attrs,textContent,setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];}});
  const save=node({'data-i18n':'Save'}),title=node(),input=node({'data-i18n-placeholder':'Search…'}),user=node({},'Save');
  const nodes=[save,title,input,user],root=node();
  const document={documentElement:root,querySelectorAll(selector){const attr=selector.slice(1,-1);return nodes.filter(n=>Object.hasOwn(n.attrs,attr));}};
  const {i18n}=setup({document});
  i18n.text(title,'Delete “{name}”?',{name:'Личное / Save'});
  i18n.applyDocument('ru');
  assert.equal(root.attrs.lang,'ru');assert.equal(save.textContent,'Сохранить');
  assert.equal(title.textContent,'Удалить «Личное / Save»?');assert.equal(input.attrs.placeholder,'Поиск…');assert.equal(user.textContent,'Save');
  i18n.applyDocument('en');assert.equal(title.textContent,'Delete “Личное / Save”?');assert.equal(user.textContent,'Save');
});
test('reinjecting localization preserves the selected language and all placeholders match',()=>{
  const {context,i18n}=setup();i18n.setLanguage('ru');vm.runInContext(source,context);assert.equal(context.SpaceI18n,i18n);assert.equal(i18n.language,'ru');
  for(const [key,value] of Object.entries(context.SpaceMessages)) {
    const placeholders=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
    assert.deepEqual(placeholders(value),placeholders(key),key);
  }
});
