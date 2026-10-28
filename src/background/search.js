// Browser command/session owner. Matching is local; navigation requires explicit activation.
(() => {
  function install(api,ui,isRestricted) {
    const openings=new Map(),submissions=new Map(),suggestions=new Map();
    const key=id=>`space-quick-search-${id}`;
    const read=async id=>(await api.storage.session.get(key(id)))[key(id)];
    const write=record=>api.storage.session.set({[key(record.windowId)]:record});
    const remove=async record=>{if((await read(record.windowId))?.token===record.token) {await api.storage.session.remove(key(record.windowId));suggestions.delete(record.token);}};
    const ownUI=sender=>sender.id===api.runtime.id&&sender.url?.split('?')[0]===api.runtime.getURL(SpacePaths.search);
    async function validate(message,sender) {
      if(!ownUI(sender)||!Number.isInteger(message.windowId)||typeof message.token!=='string') return null;
      const record=await read(message.windowId);
      if(!record||record.token!==message.token) return null;
      const allowed=record.popupTabId??record.tabId;
      return sender.tab?.id===allowed?record:null;
    }
    async function closeView(record) {
      if(record.popupWindowId) await api.windows.remove(record.popupWindowId).catch(()=>{});
      else await api.tabs.sendMessage(record.tabId,{type:'space-quick-search-close',token:record.token},{frameId:0}).catch(()=>{});
    }
    async function open(tab) {
      if(!tab?.id||!Number.isInteger(tab.windowId)) return;
      // Invoking the shortcut in the fallback's own window must not spawn another window.
      if(tab.url?.startsWith(api.runtime.getURL(SpacePaths.search))) return;
      if(openings.has(tab.windowId)) return openings.get(tab.windowId);
      const operation=(async()=>{
        const previous=await read(tab.windowId);
        if(previous?.popupWindowId) {
          try {await api.windows.update(previous.popupWindowId,{focused:true});return;} catch {await remove(previous);}
        }
        if(!isRestricted(tab.url)&&previous?.tabId===tab.id&&previous.status==='ready') {
          try {if((await api.tabs.sendMessage(tab.id,{type:'space-quick-search-focus'},{frameId:0}))?.open) return;} catch {}
        }
        if(previous) {await closeView(previous);await remove(previous);}
        const record={windowId:tab.windowId,tabId:tab.id,incognito:Boolean(tab.incognito),token:crypto.randomUUID(),status:'ready'};
        await write(record);
        const message={type:'space-quick-search-open',token:record.token,windowId:record.windowId};
        try {
          if(!isRestricted(tab.url)) {
            try {
              await api.scripting.executeScript({target:{tabId:tab.id},files:[SpacePaths.paths,SpacePaths.messages,SpacePaths.i18n,SpacePaths.searchOverlay]});
              const shown=await api.tabs.sendMessage(tab.id,message,{frameId:0});
              if(shown?.open) return;
            } catch { /* A denied injection uses the same restricted-page fallback. */ }
          }
          // Chrome pages cannot host injected UI. Keep a compact extension-owned fallback.
          const bounds=await api.windows.get(tab.windowId);
          const url=new URL(api.runtime.getURL(SpacePaths.search));
          url.searchParams.set('token',record.token);url.searchParams.set('windowId',String(record.windowId));url.searchParams.set('popup','1');
          const width=Math.min(520,bounds.width||520),height=144;
          const popup=await api.windows.create({url:url.href,type:'popup',width,height,
            left:Math.round((bounds.left||0)+Math.max(0,((bounds.width||width)-width)/2)),
            top:Math.round((bounds.top||0)+Math.max(0,((bounds.height||height)-height)/3)),focused:true});
          if(!popup.tabs?.[0]?.id) {await api.windows.remove(popup.id).catch(()=>{});throw Error('No search tab');}
          await write({...record,popupWindowId:popup.id,popupTabId:popup.tabs[0].id});
        } catch {
          await remove(record);
          await api.action.setBadgeText({tabId:tab.id,text:'!'}).catch(()=>{});
          await api.action.setTitle({tabId:tab.id,title:SpaceI18n.t('Could not open search. Refresh the page and try again.')}).catch(()=>{});
        }
      })().finally(()=>openings.delete(tab.windowId));
      openings.set(tab.windowId,operation);return operation;
    }
    function submit(message,sender) {
      if(submissions.has(message.token)) return submissions.get(message.token);
      const operation=(async()=>{
        const record=await validate(message,sender);
        if(!record) return {error:'This search window has expired. Open it again.'};
        if(record.status!=='ready') return {error:'Search was already submitted. Open search again.'};
        let url,target;
        try {
          if(message.selection!==undefined) {
            const tabs=await api.tabs.query({});
            const live=tabs.filter(tab=>Boolean(tab.incognito)===Boolean(record.incognito)&&!/^chrome-extension:/i.test(tab.url||''));
            if(typeof message.selection!=='string') throw Error('Choose a result again.');
            if(message.selection.startsWith('tab:')) {
              target=live.find(tab=>'tab:'+tab.id===message.selection);
              if(!target) throw Error('This tab has closed. Choose another result.');
            } else if(message.selection.startsWith('site:')) {
              const saved=(await api.storage.local.get('sites')).sites||[];
              const site=saved.find(site=>'site:'+site.id===message.selection);
              if(!site||!/^https?:\/\//i.test(site.url||'')) throw Error('This site has been deleted. Choose another result.');
              url=new URL(site.url).href;
              target=live.find(tab=>SpaceSearch.canonical(tab.pendingUrl||tab.url)===url);
            } else throw Error('Choose a result again.');
          } else {
            const settings=(await api.storage.local.get('uiSettings')).uiSettings;
            // Validating through searchURL also bounds raw input length and rejects blank input.
            url=ui.searchURL(ui.normalize(settings).searchEngine,message.text);
            url=SpaceSearch.directURL(message.text)||url;
          }
        } catch(error) {return {error:message.selection!==undefined?error.message:'Enter a search query.'};}
        await write({...record,status:'pending'});
        let result;
        try {
          result=target?await api.tabs.update(target.id,{active:true}):await api.tabs.create({windowId:record.windowId,url,active:true});
          if(target) await api.windows.update(target.windowId,{focused:true});
        }
        catch {
          if((await read(record.windowId))?.token===record.token) await write(record);
          return {error:'Could not open the tab. Try again.'};
        }
        await remove(record);
        if(record.popupWindowId&&!target) await api.windows.update(record.windowId,{focused:true}).catch(()=>{});
        await closeView(record);
        return {ok:true,tabId:result.id};
      })().catch(()=>({error:'Could not search. Try again.'})).finally(()=>submissions.delete(message.token));
      submissions.set(message.token,operation);return operation;
    }
    api.commands.onCommand.addListener((command,tab)=>{
      if(command!=='quick-search') return;
      (async()=>{
        const active=tab?.id?tab:(await api.tabs.query({active:true,lastFocusedWindow:true}))[0];
        await open(active);
      })().catch(()=>{});
    });
    api.runtime.onMessage.addListener((message,sender,respond)=>{
      if(sender.id!==api.runtime.id) return;
      if(message.type==='space-quick-search-suggest') {
        if(!ownUI(sender)) return;
        (async()=>{
          const record=await validate(message,sender);
          if(!record||record.status!=='ready') return {error:'Open search again.'};
          if(typeof message.text!=='string'||message.text.length>2000) return {matches:[]};
          const revision=(suggestions.get(record.token)||0)+1;suggestions.set(record.token,revision);
          let matches=[];
          if(message.text.trim()) {
            const [tabs,data]=await Promise.all([api.tabs.query({}),api.storage.local.get(['sites','spaceConfig'])]);
            matches=SpaceSearch.matches(message.text,tabs,data.sites||[],data.spaceConfig,record.windowId,Boolean(record.incognito));
          }
          if(record.popupWindowId&&suggestions.get(record.token)===revision) {
            const bounds=await api.windows.get(record.windowId);
            await api.windows.update(record.popupWindowId,{height:Math.min(bounds.height||420,matches.length?144+matches.length*48:144)}).catch(()=>{});
          }
          return {matches};
        })().then(respond).catch(()=>respond({error:'Could not load matches. You can still press Enter to search.'}));return true;
      }
      if(message.type==='space-quick-search-submit') {
        if(!ownUI(sender)) return;
        submit(message,sender).then(respond);return true;
      }
      if(message.type==='space-quick-search-dismiss') {
        (async()=>{
          const record=await validate(message,sender);
          if(record) {await remove(record);await closeView(record);}
          respond({ok:Boolean(record)});
        })().catch(()=>respond({ok:false}));return true;
      }
      if(message.type==='space-quick-search-closed'&&sender.frameId===0&&sender.tab) {
        (async()=>{
          const record=await read(sender.tab.windowId);
          if(record?.token===message.token&&record.tabId===sender.tab.id&&!record.popupWindowId) await remove(record);
          respond({ok:true});
        })().catch(()=>respond({ok:false}));return true;
      }
    });
    api.windows.onRemoved?.addListener(id=>{read(id).then(async record=>{if(record){await remove(record);await closeView(record);}}).catch(()=>{});});
    return {open};
  }
  globalThis.SpaceQuickSearch={install};
})();
