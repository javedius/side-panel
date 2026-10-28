import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../../src/shared/ui-settings.js';
import {installBackup} from '../../src/backup/dialog.js';
const markup=await readFile(new URL('../../src/panel/index.html',import.meta.url),'utf8');
class Element {
  constructor(){this.events={};this.hidden=false;this.disabled=false;this.value='';this.isConnected=true;}
  setAttribute(key,value){(this.attrs??={})[key]=value;}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
  async fire(type){for(const fn of this.events[type]||[])await fn({preventDefault(){}});}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  click(){this.clicked=true;}
}
const data=()=>({sites:[{id:'fav',name:'Почта',url:'https://mail.test/',section:'favorites'}],spaceConfig:{spaces:[],expandedIds:[]},uiSettings:SpaceUi.normalize({searchEngine:'yandex'})});
function setup() {
  const ids=Object.fromEntries([...markup.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
  const calls={applied:[],notices:[],links:[]};let stored=data(),apply=async value=>{calls.applied.push(structuredClone(value));return {ok:true};};
  globalThis.document={activeElement:ids['panel-menu-trigger'],getElementById:id=>ids[id],createElement:()=>{const link=new Element();calls.links.push(link);return link;}};
  installBackup({readData:async()=>structuredClone(stored),applyData:value=>apply(value),notify:message=>calls.notices.push(message)});
  const choose=async(text,name='copy.json',size=text.length)=>{ids['backup-file'].files=[{name,size,text:async()=>text}];await ids['backup-file'].fire('change');};
  return {ids,calls,choose,setStored:value=>{stored=value;},setApply:fn=>{apply=fn;}};
}
test('file preview requires explicit confirmation, cancellation changes nothing and failures retain a retry',async()=>{
  const f=setup(),e=f.ids;await e['backup-open'].fire('click');
  const copy=JSON.stringify(SpaceBackup.create(data()));await f.choose(copy);
  assert.equal(f.calls.applied.length,0);assert.equal(e['backup-preview'].hidden,false);assert.equal(document.activeElement,e['backup-preview-cancel']);
  await e['backup-preview-cancel'].fire('click');await e['backup-form'].fire('submit');assert.equal(f.calls.applied.length,0);
  await f.choose('broken');assert.ok(e['backup-error'].textContent.includes('JSON'));assert.equal(e['backup-preview'].hidden,true);
  await f.choose(copy,'large.json',SpaceBackup.MAX_BYTES+1);assert.ok(e['backup-error'].textContent.includes('2 MB'));
  await f.choose(copy);f.setApply(async()=>({error:'Хранилище недоступно'}));await e['backup-form'].fire('submit');
  assert.equal(e['backup-dialog'].open,true);assert.equal(e['backup-confirm'].disabled,false);assert.equal(e['backup-error'].textContent,'Хранилище недоступно');
  let release;f.setApply(()=>new Promise(resolve=>{release=resolve;}));const pending=e['backup-form'].fire('submit');
  assert.equal(e['backup-confirm'].disabled,true);await e['backup-dialog'].fire('cancel');assert.equal(e['backup-dialog'].open,true);
  release({ok:true});await pending;assert.equal(e['backup-dialog'].open,false);assert.equal(document.activeElement,e['panel-menu-trigger']);
});
test('export downloads a roundtrippable file and the previous-import snapshot can be previewed',async()=>{
  const f=setup(),e=f.ids,previous=data();previous.sites[0].name='Прежняя почта';
  f.setStored({...data(),backupBeforeImport:SpaceBackup.create(previous)});await e['backup-open'].fire('click');
  assert.equal(e['backup-restore'].hidden,false);await e['backup-restore'].fire('click');assert.equal(f.calls.applied.length,0);
  await e['backup-form'].fire('submit');assert.equal(f.calls.applied[0].sites[0].name,'Прежняя почта');
  await e['backup-open'].fire('click');
  const create=URL.createObjectURL;let blob;
  URL.createObjectURL=value=>{blob=value;return create(value);};
  try {await e['backup-export'].fire('click');} finally {URL.createObjectURL=create;}
  assert.equal(f.calls.links[0].clicked,true);assert.match(f.calls.links[0].download,/^space-backup-.*\.json$/);
  const parsed=SpaceBackup.parse(await blob.text());assert.equal(parsed.sites[0].name,'Почта');assert.equal(parsed.backupBeforeImport,undefined);
});
