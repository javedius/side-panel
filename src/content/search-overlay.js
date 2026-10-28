// The input lives in an extension iframe, isolated from website key listeners and DOM.
(() => {
  const t=(key,values)=>globalThis.SpaceI18n.t(key,values);
  const key='__spaceQuickSearch_'+chrome.runtime.getManifest().version;
  if(globalThis[key]) return;
  globalThis.__spaceQuickSearchActive?.dispose();
  let host=null,frame=null,previousFocus=null,token=null,windowId=null,disposed=false;
  function hide(restore=true,notify=true) {
    if(!host) return;
    const closingToken=token;
    const ownedFocus=host.contains(document.activeElement);
    try {host.close();} catch {}
    host.remove();host=null;frame=null;token=null;
    if(restore&&ownedFocus&&document.visibilityState!=='hidden'&&previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    if(notify&&closingToken) chrome.runtime.sendMessage({type:'space-quick-search-closed',token:closingToken}).catch(()=>{});
  }
  function localizeShell() {
    if(host) {host.setAttribute('aria-label',t('Quick search'));frame.title=t('Quick search — Space');}
  }
  let localeRevision=0;
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes.uiSettings) {++localeRevision;SpaceI18n.setLanguage(changes.uiSettings.newValue?.language);localizeShell();}
  });
  const localeRequest=localeRevision;
  chrome.storage.local.get('uiSettings').then(saved=>{if(localeRequest===localeRevision){SpaceI18n.setLanguage(saved.uiSettings?.language);localizeShell();}}).catch(()=>{});
  function show(message) {
    if(host?.open&&token===message.token) {frame.focus({preventScroll:true});return;}
    hide(false,false);
    previousFocus=document.activeElement;token=message.token;windowId=message.windowId;
    host=document.createElement('dialog');host.id=chrome.runtime.id+'-space-quick-search';
    host.setAttribute('aria-label',t('Quick search'));
    const styles={all:'initial',display:'block',position:'fixed',inset:'0',margin:'0',padding:'0',border:'0',width:'100vw','max-width':'none',height:'100dvh','max-height':'none',background:'transparent',overflow:'hidden','box-sizing':'border-box'};
    for(const [name,value] of Object.entries(styles)) host.style.setProperty(name,value,'important');
    // Native dialog cannot host a shadow root; a div inside it owns isolation.
    const container=document.createElement('div');
    for(const [name,value] of Object.entries({all:'initial',display:'block',width:'100%',height:'100%'})) container.style.setProperty(name,value,'important');
    host.append(container);
    const shadow=container.attachShadow({mode:'closed'});frame=document.createElement('iframe');
    frame.title=t('Quick search — Space');frame.setAttribute('referrerpolicy','no-referrer');
    const url=new URL(chrome.runtime.getURL(SpacePaths.search));
    url.searchParams.set('token',token);url.searchParams.set('windowId',String(windowId));
    frame.src=url.href;frame.style.cssText='display:block;width:100%;height:100%;border:0;background:transparent';
    shadow.append(frame);
    host.addEventListener('cancel',event=>{event.preventDefault();hide();});
    document.documentElement.append(host);
    try {host.showModal();frame.focus({preventScroll:true});} catch {hide();}
  }
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(disposed||sender.id!==chrome.runtime.id) return;
    if(message.type==='space-quick-search-focus') {
      if(host?.open) frame.focus({preventScroll:true});
      respond({open:Boolean(host?.open)});
    }
    if(message.type==='space-quick-search-open'&&typeof message.token==='string'&&Number.isInteger(message.windowId)) {
      show(message);respond({open:Boolean(host?.open)});
    }
    if(message.type==='space-quick-search-close'&&message.token===token) {hide(true,false);respond({ok:true});}
  });
  window.addEventListener('message',event=>{
    if(frame&&event.source===frame.contentWindow&&event.data?.type==='space-quick-search-close') hide();
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden') hide(false);});
  window.addEventListener('pagehide',()=>hide(false));
  const dispose=()=>{disposed=true;hide(false);};
  globalThis[key]={dispose};globalThis.__spaceQuickSearchActive={dispose};
})();
