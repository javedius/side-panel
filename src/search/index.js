import '../shared/messages.js';
import '../shared/i18n.js';
import '../shared/site-icon.js';
const t=(key,values)=>globalThis.SpaceI18n.t(key,values);
const $=id=>document.getElementById(id);
const params=new URLSearchParams(window.location.search),token=params.get('token'),windowId=Number(params.get('windowId'));
const popup=params.has('popup');
if(popup) document.body.classList.add('popup');
let busy=false,composing=false,closed=false;
const form=$('quick-search-form'),input=$('search-query');
let matchRevision=0,matchItems=[],matchButtons=[];
const results=$('search-results'),matchStatus=$('search-matches-status');
function clearMatches() {
  ++matchRevision;matchItems=[];matchButtons=[];results.replaceChildren();results.hidden=true;matchStatus.textContent='';
}
async function findMatches() {
  const revision=++matchRevision,text=input.value.trim();
  if(composing||closed||busy) return;
  if(!text) clearMatches();
  try {
    const response=await chrome.runtime.sendMessage({type:'space-quick-search-suggest',token,windowId,text});
    if(revision!==matchRevision||composing||closed||busy) return;
    matchItems=Array.isArray(response?.matches)?response.matches.slice(0,5):[];matchButtons=[];
    results.replaceChildren();
    for(const item of matchItems) {
      const row=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.className='search-result';button.title=item.title+' · '+item.url;
      const name=document.createElement('span');name.className='result-title';name.textContent=item.title;
      const detail=document.createElement('small');detail.textContent=item.detail.startsWith('Space · ')?t('Space · {name}',{name:item.detail.slice(8)}):t(item.detail);
      button.append(name,detail,SpaceSiteIcon.create(item,16));row.append(button);results.append(row);matchButtons.push(button);
      button.addEventListener('click',()=>submit(item.key));
    }
    results.hidden=!matchItems.length;
    matchStatus.textContent=response?.error?t(response.error):(matchItems.length?t('{count} matches. Press Arrow Down to choose.',{count:matchItems.length}):'');
  } catch {if(revision===matchRevision) {results.hidden=true;matchStatus.textContent=t('Matches are unavailable. Press Enter to search.');}}
}
const providerIcon=$('search-provider-icon'),providerImage=$('search-provider-image');
let providerRevision=0;
function updateProvider(value) {
  const engine=SpaceUi.searchEngines[SpaceUi.normalize(value).searchEngine];
  providerIcon.setAttribute('aria-label',t('Search engine: {name}',{name:t(engine.label)}));providerIcon.title=t(engine.label);
  const source=new URL(chrome.runtime.getURL('_favicon/'));
  source.searchParams.set('pageUrl',new URL(engine.url).origin+'/');source.searchParams.set('size','32');
  providerImage.hidden=true;providerImage.src=source.href;
}
providerImage.addEventListener('load',()=>{providerImage.hidden=!providerImage.naturalWidth;});
providerImage.addEventListener('error',()=>{providerImage.hidden=true;});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.uiSettings){++providerRevision;SpaceI18n.applyDocument(changes.uiSettings.newValue?.language);updateProvider(changes.uiSettings.newValue);if(input.value.trim()) findMatches();}
  if(area==='local'&&(changes.sites||changes.spaceConfig)&&input.value.trim()) findMatches();
});
const providerRequest=providerRevision;
chrome.storage.local.get('uiSettings').then(saved=>{if(providerRequest===providerRevision) {SpaceI18n.applyDocument(saved.uiSettings?.language);updateProvider(saved.uiSettings);}})
  .catch(()=>{if(providerRequest===providerRevision) updateProvider(undefined);});
function update() {
  $('search-clear').hidden=!input.value;
  $('search-clear').disabled=busy;$('search-submit').disabled=busy||!input.value.trim();
  input.readOnly=busy;form.setAttribute('aria-busy',String(busy));
}
function close() {
  closed=true;
  if(popup) chrome.runtime.sendMessage({type:'space-quick-search-dismiss',token,windowId}).then(result=>{if(!result?.ok) {closed=false;$('search-error').textContent=t('Could not close search.');$('search-error').hidden=false;}}).catch(()=>{closed=false;});
  else window.parent.postMessage({type:'space-quick-search-close'},'*');
}
input.addEventListener('input',()=>{$('search-error').hidden=true;clearMatches();update();findMatches();});
input.addEventListener('compositionstart',()=>{composing=true;clearMatches();});input.addEventListener('compositionend',()=>{composing=false;update();findMatches();});
$('search-clear').addEventListener('click',()=>{if(busy) return;input.value='';$('search-error').hidden=true;clearMatches();update();findMatches();input.focus();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!event.isComposing&&!composing) {event.preventDefault();close();}
  if(event.key==='Enter'&&(event.isComposing||composing)) event.preventDefault();
  if(!busy&&!composing&&!event.isComposing&&['ArrowDown','ArrowUp'].includes(event.key)&&matchButtons.length) {
    const index=matchButtons.indexOf(document.activeElement);
    if(document.activeElement===input||index>=0) {
      event.preventDefault();
      const next=document.activeElement===input?(event.key==='ArrowDown'?0:matchButtons.length-1):index+(event.key==='ArrowDown'?1:-1);
      const target=matchButtons[next]||input;target.focus();target.scrollIntoView?.({block:'nearest'});
    }
  }
});
document.body.addEventListener('click',event=>{if(event.target===document.body) close();});
async function submit(selection) {
  if(busy||composing||closed) return;
  const text=input.value.trim();
  if(!text){$('search-error').textContent=t('Enter a search query.');$('search-error').hidden=false;input.focus();return;}
  busy=true;++matchRevision;update();for(const button of matchButtons) button.disabled=true;$('search-error').hidden=true;
  try {
    const result=await chrome.runtime.sendMessage({type:'space-quick-search-submit',token,windowId,text,...(selection?{selection}:{})});
    if(!result?.ok) throw Error(result?.error||t('Could not search. Try again.'));
    close();
  } catch(error) {if(!closed){$('search-error').textContent=t(error.message);$('search-error').hidden=false;input.focus();}}
  finally {busy=false;update();for(const button of matchButtons) button.disabled=false;}
}
form.addEventListener('submit',event=>{event.preventDefault();return submit();});
update();input.focus();
