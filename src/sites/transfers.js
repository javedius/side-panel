// Ordered saved-site operations shared by drag/drop and menu alternatives.
export function transferSite(sites,config,source,destination,tab) {
  const target=destination?.section;
  if(!['favorites','space'].includes(target)||target==='space'&&!config.spaces.some(space=>space.id===destination.spaceId))
    throw Error('This space has been deleted. Choose another.');
  let site=source?.kind==='site'?sites.find(item=>item.id===source.id):null;
  if(source?.kind==='site'&&!site) throw Error('This site has been deleted. Refresh the panel.');
  if(source?.kind==='tab') {
    if(!tab||tab.id!==source.id||!/^https?:\/\//i.test(tab.url||'')) throw Error('This tab cannot be saved.');
    site=sites.find(item=>item.url===tab.url&&item.section===target&&(target==='favorites'||item.spaceId===destination.spaceId))||
      {id:source.newId,name:(tab.title||new URL(tab.url).hostname).slice(0,80),url:new URL(tab.url).href};
    if(!site.id) throw Error('Could not save the tab.');
  }
  if(!site) throw Error('Choose a site to move.');
  if(destination.beforeId===site.id) return {sites,spaceConfig:config};
  const next=sites.filter(item=>item.id!==site.id);
  if(target==='favorites'&&next.filter(item=>item.section==='favorites').length>=9)
    throw Error('Favorites already has 9 sites. Free up a slot or choose a space.');
  const moved={...site,section:target,spaceId:target==='space'?destination.spaceId:undefined};
  const belongs=item=>item.section===target&&(target==='favorites'||item.spaceId===destination.spaceId);
  let index=next.length;
  if(destination.beforeId) {
    const anchor=next.findIndex(item=>item.id===destination.beforeId&&belongs(item));
    if(anchor<0) throw Error('The site order has changed. Try again.');
    index=anchor+(destination.after?1:0);
  } else {
    for(let i=0;i<next.length;i++) if(belongs(next[i])) index=i+1;
  }
  next.splice(index,0,moved);
  return {sites:next,spaceConfig:target==='space'?{...config,expandedIds:[...new Set([...config.expandedIds,destination.spaceId])]}:config};
}
