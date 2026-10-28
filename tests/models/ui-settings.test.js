import test from 'node:test';
import assert from 'node:assert/strict';
import '../../src/shared/ui-settings.js';
const {normalize}=globalThis.SpaceUi;
test('absent or invalid settings retain previous left-center default',()=>{
  assert.deepEqual(normalize(),{language:'auto',searchEngine:'google',panelMode:'overlay',showLauncher:true,theme:'dark',side:'left',launcherPosition:'center'});
  assert.deepEqual(normalize({side:'bad',launcherPosition:'bad'}),normalize());
});
test('valid settings survive persistence and invalid fields fall back independently',()=>{
  const settings={language:'auto',searchEngine:'google',panelMode:'overlay',showLauncher:true,theme:'light',side:'right',launcherPosition:'bottom'};
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(settings))),settings);
  assert.deepEqual(normalize({side:'right',launcherPosition:'bad'}),{language:'auto',searchEngine:'google',panelMode:'overlay',showLauncher:true,theme:'dark',side:'right',launcherPosition:'center'});
});

test('theme fallback preserves prior positioning preferences',()=>{
  assert.deepEqual(normalize({side:'right',launcherPosition:'top'}),{language:'auto',searchEngine:'google',panelMode:'overlay',showLauncher:true,theme:'dark',side:'right',launcherPosition:'top'});
  assert.equal(normalize({theme:'invalid'}).theme,'dark');
});
test('both theme palettes have matching tokens and accessible content contrast',()=>{
  const {themeTokens}=SpaceUi;
  const luminance=hex=>{
    const rgb=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  };
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  assert.deepEqual(Object.keys(themeTokens('dark')),Object.keys(themeTokens('light')));
  for(const theme of ['dark','light']) {
    const tokens=themeTokens(theme);
    for(const [foreground,background] of [['--text','--bg'],['--text','--active'],['--muted','--surface'],['--accent','--bg'],['--error','--surface'],['--primary-text','--accent']])
      assert.ok(contrast(tokens[foreground],tokens[background])>=4.5,theme+' '+foreground+' / '+background);
  }
});


test('presentation and launcher choices migrate old settings',()=>{
  assert.equal(normalize({theme:'light'}).panelMode,'overlay');assert.equal(normalize().showLauncher,true);
  assert.equal(normalize({language:'auto',searchEngine:'google',panelMode:'push',showLauncher:false}).panelMode,'push');
  assert.equal(normalize({showLauncher:false}).showLauncher,false);
  assert.equal(normalize({language:'auto',searchEngine:'google',panelMode:'invalid',showLauncher:'false'}).showLauncher,true);

});


test('search providers encode queries as text and fall back safely for legacy settings',()=>{
  assert.equal(normalize().searchEngine,'google');assert.equal(normalize({searchEngine:'yandex'}).searchEngine,'yandex');
  assert.equal(normalize({searchEngine:'__proto__'}).searchEngine,'google');
  const text='кот & dog #1 + https://example.com/?a=2';
  for(const [id,provider] of Object.entries(SpaceUi.searchEngines)) {
    const url=new URL(SpaceUi.searchURL(id,text));assert.equal(url.searchParams.get(provider.parameter),text);assert.equal(url.protocol,'https:');
  }
  assert.throws(()=>SpaceUi.searchURL('google','  '));assert.throws(()=>SpaceUi.searchURL('google','a'.repeat(2001)));
});

test('language preferences migrate to automatic and support explicit English/Russian overrides',()=>{
  for(const language of ['auto','en','ru']) assert.equal(normalize({language}).language,language);
  for(const language of [undefined,null,'de','RU','__proto__']) assert.equal(normalize({language}).language,'auto');
});
