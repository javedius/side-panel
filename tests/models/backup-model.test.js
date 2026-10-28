import test from 'node:test';
import assert from 'node:assert/strict';
import '../../src/shared/ui-settings.js';
import '../../src/backup/model.js';
const sample=()=>({sites:[{id:'fav',name:'Google',url:'https://google.com/',section:'favorites',icon:'G',bg:'#eeeeee',color:'#333'},{id:'doc',name:'Документ',url:'https://doc.test/a?b=2',section:'space',spaceId:'work'}],spaceConfig:{spaces:[{id:'work',name:'Работа'}],expandedIds:['work']},uiSettings:SpaceUi.normalize({theme:'light',searchEngine:'yandex',panelMode:'push',showLauncher:false})});
test('backup roundtrip preserves sites, order, groups and all preferences without session data',()=>{
  const data=sample(),copy=SpaceBackup.create({...data,links:{fav:10},queries:['secret']});
  assert.deepEqual(SpaceBackup.parse(JSON.stringify(copy)),data);assert.ok(copy.exportedAt);
  assert.deepEqual(Object.keys(copy.data),['sites','spaceConfig','uiSettings']);
  assert.deepEqual(SpaceBackup.parse(JSON.stringify(SpaceBackup.create({sites:[],spaceConfig:{spaces:[],expandedIds:[]},uiSettings:{}}))).sites,[]);
});
test('import rejects malformed, unsafe, unsupported, orphaned and oversized backups before any write',()=>{
  for(const text of ['not json','{}',JSON.stringify({app:'space-side-panel',version:2,data:sample()}),'a'.repeat(SpaceBackup.MAX_BYTES+1)]) assert.throws(()=>SpaceBackup.parse(text));
  const invalid=[data=>data.sites[0].url='javascript:alert(1)',data=>data.sites[0].url='https://user:pass@example.com',data=>data.sites[1].spaceId='gone',data=>data.sites[1].id='fav',data=>data.sites[0].id='__proto__',data=>data.uiSettings.searchEngine='invalid',data=>data.uiSettings.showLauncher='false',data=>data.spaceConfig.expandedIds=['gone'],data=>data.spaceConfig.spaces.push({id:'two',name:'работа'}),data=>data.sites=Array.from({length:10},(_,i)=>({...data.sites[0],id:String(i)}))];
  for(const change of invalid){const data=sample();change(data);assert.throws(()=>SpaceBackup.create(data));}
});

test('backups preserve explicit language, migrate old files to automatic, and reject unsupported values',()=>{
  for(const language of ['auto','en','ru']) {
    const data=sample();data.uiSettings.language=language;
    assert.equal(SpaceBackup.parse(JSON.stringify(SpaceBackup.create(data))).uiSettings.language,language);
  }
  const legacy=sample();delete legacy.uiSettings.language;
  assert.equal(SpaceBackup.validateData(legacy).uiSettings.language,'auto');
  legacy.uiSettings.language='de';assert.throws(()=>SpaceBackup.validateData(legacy),/panel settings/);
});
