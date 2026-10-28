// Shared pure search/navigation rules; input never becomes executable navigation.
(() => {
  function directURL(value) {
    const text=typeof value==='string'?value.trim():'';
    if(!text||text.length>2000||/[\s\\]/u.test(text)) return null;
    const explicit=/^https?:\/\//i.test(text);
    if(!explicit&&text.includes('://')) return null;
    try {
      const url=new URL(explicit?text:'https://'+text.replace(/^\/\//,''));
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password) return null;
      const host=url.hostname.replace(/\.$/,'');
      if(host==='localhost'||/^\[[\da-f:]+\]$/i.test(host)) return url.href;
      if(explicit&&!host.includes('.')&&/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(host)) return url.href;
      if(!host.includes('.')||!host.split('.').every(label=>/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) return null;
      return url.href;
    } catch {return null;}
  }
  const canonical=value=>{try{return new URL(value).href;}catch{return '';}};
  const safeSite=site=>site&&typeof site.id==='string'&&typeof site.name==='string'&&/^https?:\/\//i.test(site.url||'');
  function matches(text,tabs,sites,config,windowId,incognito=false) {
    const query=typeof text==='string'?text.trim().toLocaleLowerCase('en'):'';
    if(!query||query.length>2000) return [];
    const words=query.split(/\s+/u),items=[],seen=new Set();
    const rank=(title,url)=>title.toLocaleLowerCase('en').startsWith(query)?0:canonical(url).toLocaleLowerCase('en').includes(query)?1:2;
    const accepts=(title,url,group='')=>words.every(word=>(title+' '+url+' '+group).toLocaleLowerCase('en').includes(word));
    const live=tabs.filter(tab=>Number.isInteger(tab.id)&&Boolean(tab.incognito)===incognito&&!/^chrome-extension:/i.test(tab.url||''));
    for(const tab of [...live].sort((a,b)=>Number(b.windowId===windowId)-Number(a.windowId===windowId))) {
      const url=tab.pendingUrl||tab.url||'',title=tab.title||url;
      if(!accepts(title,url)) continue;
      const key=canonical(url)||url;if(seen.has(key)) continue;seen.add(key);
      items.push({key:'tab:'+tab.id,title,url,detail:tab.windowId===windowId?'Open tab':'Tab · another window',rank:rank(title,url)});
    }
    for(const site of sites.filter(safeSite)) {
      const group=site.section==='favorites'?'Favorites':(config?.spaces||[]).find(space=>space.id===site.spaceId)?.name||'Space';
      if(!accepts(site.name,site.url,group)||seen.has(canonical(site.url))) continue;
      seen.add(canonical(site.url));
      const opened=live.find(tab=>canonical(tab.pendingUrl||tab.url)===canonical(site.url));
      items.push({key:opened?'tab:'+opened.id:'site:'+site.id,title:site.name,url:site.url,
        detail:opened?(opened.windowId===windowId?'Open tab':'Tab · another window'):site.section==='favorites'?'Favorites':'Space · '+group,rank:rank(site.name,site.url)});
    }
    return items.sort((a,b)=>a.rank-b.rank).slice(0,5).map(({rank,...item})=>item);
  }
  globalThis.SpaceSearch=Object.freeze({directURL,matches,canonical});
})();
