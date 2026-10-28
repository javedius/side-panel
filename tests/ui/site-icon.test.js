import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/shared/site-icon.js',import.meta.url),'utf8');
function setup(withChrome=true) {
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.events={};this.style={values:{},setProperty(k,v){this.values[k]=v;}};}
    append(...nodes){this.children.push(...nodes);}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(type,fn){this.events[type]=fn;}
  }
  const context=vm.createContext({URL,document:{createElement:tag=>new Node(tag)},
    chrome:withChrome?{runtime:{getURL:path=>'chrome-extension://test/'+path}}:undefined});
  vm.runInContext(source,context);return context.SpaceSiteIcon.create;
}
test('website marks use extension-owned favicon URLs and keep their geometry through load and failure',()=>{
  const create=setup();
  for(const size of [16,20,24]) {
    const url='https://mail.example.com/inbox?a=1&b=2#section';
    const mark=create({name:'Mail',url,icon:'M'},size),[fallback,image]=mark.children;
    const resource=new URL(image.src);
    assert.equal(resource.origin,'null');assert.equal(resource.host,'test');assert.equal(resource.pathname,'/_favicon/');
    assert.equal(resource.searchParams.get('pageUrl'),url);assert.equal(resource.searchParams.get('size'),'64');
    assert.equal(mark.style.values['--site-icon-size'],size+'px');assert.equal(mark.attrs['aria-hidden'],'true');
    assert.equal(image.width,size);assert.equal(image.height,size);assert.equal(image.alt,'');assert.equal(image.hidden,true);
    image.naturalWidth=0;image.events.load();assert.equal(image.hidden,true);
    image.naturalWidth=32;image.events.load();assert.equal(image.hidden,false);assert.equal(fallback.hidden,true);
    image.events.error();assert.equal(image.hidden,true);assert.equal(fallback.hidden,false);
    assert.equal(mark.textContent,undefined);assert.equal(fallback.textContent,undefined);
  }
});
test('invalid/internal URLs and standalone previews use a neutral mark without external requests or initials',()=>{
  for(const create of [setup(),setup(false)]) {
    for(const url of [undefined,'bad url','chrome://newtab/','javascript:alert(1)','data:image/png;base64,AA==']) {
      const mark=create({url,icon:'X',name:'Example'});
      assert.equal(mark.children.length,1);assert.equal(mark.children[0].className,'favicon-fallback');
      assert.equal(mark.textContent,undefined);assert.equal(mark.children[0].textContent,undefined);
    }
  }
  assert.equal(setup(false)({url:'https://example.com'}).children.length,1);
});
test('a navigating tab uses its pending destination for the logo and bounds unsupported icon sizes',()=>{
  const mark=setup()({url:'https://old.example/',pendingUrl:'https://new.example/'},900);
  assert.equal(new URL(mark.children[1].src).searchParams.get('pageUrl'),'https://new.example/');
  assert.equal(mark.children[1].width,20);
});
