import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const localeSource=(await readFile(new URL('../../src/shared/messages.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../../src/shared/i18n.js',import.meta.url),'utf8'));
const ui=await readFile(new URL('../../src/shared/ui-settings.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('../../src/shared/theme-bootstrap.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(get,browserLanguage='en') {
  const styles={},attrs={};let change;
  const context=vm.createContext({document:{documentElement:{style:{setProperty(k,v){styles[k]=v;}},setAttribute(k,v){attrs[k]=v;}}},
    chrome:{i18n:{getUILanguage:()=>browserLanguage},storage:{local:{get},onChanged:{addListener(fn){change=fn;}}}}});
  vm.runInContext(ui,context);vm.runInContext(localeSource,context);vm.runInContext(bootstrap,context);
  return {styles,attrs,change:(value)=>change({uiSettings:{newValue:value}},'local')};
}
test('saved light theme hydrates before document becomes visible',async()=>{
  let resolve;const f=setup(()=>new Promise(r=>{resolve=r;}));assert.equal(f.styles.visibility,'hidden');
  resolve({uiSettings:{theme:'light'}});await flush();
  assert.equal(f.attrs['data-theme'],'light');assert.equal(f.styles['color-scheme'],'light');assert.equal(f.styles.visibility,'visible');
});
test('live theme change wins over a stale startup reply',async()=>{
  let resolve;const f=setup(()=>new Promise(r=>{resolve=r;}));f.change({theme:'light'});
  resolve({uiSettings:{theme:'dark'}});await flush();assert.equal(f.attrs['data-theme'],'light');
});
test('storage failure keeps default theme usable and reveals the document',async()=>{
  const f=setup(async()=>{throw Error('storage');});await flush();
  assert.equal(f.attrs['data-theme'],'dark');assert.equal(f.styles.visibility,'visible');
});

test('system Russian and saved English override hydrate with the same stale-read protection as theme',async()=>{
  let resolve;
  const f=setup(()=>new Promise(r=>{resolve=r;}),'ru-RU');assert.equal(f.attrs.lang,'ru');assert.equal(f.styles.visibility,'hidden');
  f.change({language:'en',theme:'light'});assert.equal(f.attrs.lang,'en');
  resolve({uiSettings:{language:'ru',theme:'dark'}});await flush();assert.equal(f.attrs.lang,'en');
  const automatic=setup(async()=>({uiSettings:{}}),'ru');await flush();assert.equal(automatic.attrs.lang,'ru');
  const fallback=setup(async()=>({uiSettings:{}}),'de-DE');await flush();assert.equal(fallback.attrs.lang,'en');
});
