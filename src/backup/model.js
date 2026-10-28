// Versioned, whitelisted backup format. Session state and live tabs never enter it.
(() => {
  const MAX_BYTES=2*1024*1024;
  const fail=message=>{throw Error(message);};
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const id=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!['__proto__','constructor','prototype'].includes(value);
  function validateData(data) {
    if(!object(data)||!Array.isArray(data.sites)||!object(data.spaceConfig)||!Array.isArray(data.spaceConfig.spaces)||!object(data.uiSettings)) fail('The file is missing Space sites, spaces, or settings.');
    if(data.sites.length>5000||data.spaceConfig.spaces.length>200) fail('The backup contains too many sites or spaces.');
    const seenSpaces=new Set(),names=new Set();
    const spaces=data.spaceConfig.spaces.map(space=>{
      if(!object(space)||!id(space.id)||seenSpaces.has(space.id)||typeof space.name!=='string'||!space.name.trim()||space.name.trim().length>60||names.has(space.name.trim().toLocaleLowerCase('en'))) fail('The backup contains invalid or duplicate spaces.');
      seenSpaces.add(space.id);names.add(space.name.trim().toLocaleLowerCase('en'));return {id:space.id,name:space.name.trim()};
    });
    const seenSites=new Set();let favorites=0;
    const sites=data.sites.map(site=>{
      if(!object(site)||!id(site.id)||seenSites.has(site.id)||typeof site.name!=='string'||!site.name.trim()||site.name.length>80||typeof site.url!=='string'||site.url.length>8192||!['favorites','space'].includes(site.section)) fail('The backup contains invalid or duplicate sites.');
      let url;try {url=new URL(site.url);}catch {fail('The backup contains an invalid site address.');}
      if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password) fail('Backup site addresses must use HTTP or HTTPS and contain no passwords.');
      if(site.section==='space'&&!seenSpaces.has(site.spaceId)) fail('A site refers to a missing space.');
      if(site.section==='favorites'&&++favorites>9) fail('Favorites can contain up to 9 sites.');
      seenSites.add(site.id);
      const clean={id:site.id,name:site.name.trim(),url:url.href,section:site.section};
      if(site.section==='space') clean.spaceId=site.spaceId;
      if(typeof site.icon==='string'&&site.icon.length<=16) clean.icon=site.icon;
      for(const key of ['bg','color']) if(typeof site[key]==='string'&&/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(site[key])) clean[key]=site[key];
      return clean;
    });
    const value=data.uiSettings;
    for(const [key,allowed] of Object.entries({language:['auto','en','ru'],searchEngine:Object.keys(SpaceUi.searchEngines),panelMode:['overlay','push'],theme:['light','dark'],side:['left','right'],launcherPosition:['top','center','bottom']}))
      if(value[key]!==undefined&&!allowed.includes(value[key])) fail('The backup contains invalid panel settings.');
    if(value.showLauncher!==undefined&&typeof value.showLauncher!=='boolean') fail('The backup contains invalid launcher settings.');
    const expandedIds=data.spaceConfig.expandedIds;
    if(expandedIds!==undefined&&(!Array.isArray(expandedIds)||expandedIds.some(item=>!seenSpaces.has(item)))) fail('The backup contains an invalid space state.');
    const result={sites,spaceConfig:{spaces,expandedIds:[...new Set(expandedIds||spaces.map(space=>space.id))]},uiSettings:SpaceUi.normalize(value)};
    if(new TextEncoder().encode(JSON.stringify(result)).byteLength>MAX_BYTES) fail('The backup exceeds 2 MB.');
    return result;
  }
  function create(data) {
    const result={app:'space-side-panel',version:1,exportedAt:new Date().toISOString(),data:validateData(data)};
    if(new TextEncoder().encode(JSON.stringify(result)).byteLength>MAX_BYTES) fail('The backup exceeds 2 MB.');
    return result;
  }
  function parse(text) {
    if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>MAX_BYTES) fail('The file must be no larger than 2 MB.');
    let value;try {value=JSON.parse(text);}catch {fail('Could not read the JSON file. Choose a Space backup.');}
    if(value?.app!=='space-side-panel'||value.version!==1) fail('This is not a supported Space backup.');
    return validateData(value.data);
  }
  globalThis.SpaceBackup=Object.freeze({MAX_BYTES,validateData,create,parse});
})();
