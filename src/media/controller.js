// Self-contained: Chrome serializes this function into the selected page/frame.
export async function mediaInPage(command = 'state') {
  const handlers = globalThis.__spaceMediaSessionV1;
  const has = action => typeof handlers?.get?.(action) === 'function';
  const media = [...document.querySelectorAll('audio,video')]
    .filter(item => item.currentSrc || item.src || item.readyState > 0)
    .sort((a,b) => Number(!b.paused && !b.ended) - Number(!a.paused && !a.ended) || Number(b.tagName === 'AUDIO') - Number(a.tagName === 'AUDIO'))[0];
  const session = navigator.mediaSession;
  // Existing tabs may predate the hook. YouTube exposes real, visible playlist controls.
  const youtube = /(^|\.)youtube\.com$/.test(location.hostname);
  const button = selector => {
    const node = youtube ? document.querySelector(selector) : null;
    return node && !node.disabled && node.getAttribute('aria-disabled') !== 'true' && node.getClientRects().length ? node : null;
  };
  const previous = button('.ytp-prev-button');
  const next = button('.ytp-next-button');
  if (!media && !(session?.metadata && (has('play') || has('pause')))) return null;
  const paused = media ? media.paused || media.ended : session.playbackState !== 'playing';
  if (command !== 'state') {
    if (command === 'previous' || command === 'next') {
      const action = command === 'previous' ? 'previoustrack' : 'nexttrack';
      if (has(action)) await handlers.get(action)({action});
      else if (command === 'previous' ? previous : next) (command === 'previous' ? previous : next).click();
      else throw Error('Track skipping is unavailable on this site.');
    } else if (command === 'restart') {
      if (media && Number.isFinite(media.duration) && media.duration > 0) {
        media.currentTime = 0;
        await media.play();
      } else if (has('seekto')) {
        await handlers.get('seekto')({action:'seekto', seekTime:0, fastSeek:false});
        if (has('play')) await handlers.get('play')({action:'play'});
      } else throw Error('This live stream cannot be restarted.');
    } else if (command === 'toggle') {
      const action = paused ? 'play' : 'pause';
      if (has(action)) await handlers.get(action)({action});
      else if (media) { if (paused) await media.play(); else media.pause(); }
      else throw Error('Open the site to start playback.');
    } else throw Error('Unknown playback command.');
  }
  return {
    title: String(session?.metadata?.title || document.title || 'Media').slice(0,300),
    artist: String(session?.metadata?.artist || location.hostname).slice(0,200),
    paused: media ? media.paused || media.ended : session?.playbackState !== 'playing',
    toggle: Boolean(media || has('play') || has('pause')),
    restart: Boolean(media && Number.isFinite(media.duration) && media.duration > 0 || has('seekto')),
    previous: Boolean(has('previoustrack') || previous),
    next: Boolean(has('nexttrack') || next)
  };
}

export class MediaController {
  constructor(api, windowId, onChange) {
    this.api=api;this.windowId=windowId;this.onChange=onChange;
    this.source=null;this.busy=false;this.refreshing=null;this.revision=0;this.discoveredAt=0;this.knownTabs=new Set();
  }
  async inspect(tab) {
    try {
      const results=await this.api.scripting.executeScript({target:{tabId:tab.id,allFrames:true},world:'MAIN',func:mediaInPage,args:['state']});
      return results.filter(item=>item.result).map(item=>({...item.result,tabId:tab.id,frameId:item.frameId,documentId:item.documentId}));
    } catch {return [];}
  }
  refresh() {
    if(this.refreshing || this.busy) return this.refreshing;
    const revision=++this.revision;
    this.refreshing=(async()=>{
      try {
        const tabs=(await this.api.tabs.query({windowId:this.windowId})).filter(tab=>/^https?:/.test(tab.url||''));
        // Discover all sources, including paused music. Prefer playing sources and keep
        // the selected paused source stable when the user changes browser tabs.
        const discover=Date.now()-this.discoveredAt>15000;
        const candidates=discover?tabs:tabs.filter(tab=>tab.audible||tab.active||this.knownTabs.has(tab.id));
        const batches=[];
        for(let index=0;index<candidates.length;index+=8)
          batches.push(...await Promise.all(candidates.slice(index,index+8).map(tab=>this.inspect(tab))));
        if(discover) this.discoveredAt=Date.now();
        const sources=batches.flat();
        this.knownTabs=new Set(sources.map(source=>source.tabId));
        const same=item=>item.tabId===this.source?.tabId && item.frameId===this.source?.frameId;
        const selected=sources.find(item=>same(item)&&!item.paused)||sources.find(item=>!item.paused)||sources.find(same)||sources[0]||null;
        if(revision===this.revision && !this.busy) {this.source=selected;this.onChange({source:selected});}
      } catch {if(revision===this.revision) this.onChange({source:this.source,error:'Could not connect. Reopen the panel.'});}
    })().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
  async command(command) {
    if(this.busy || !this.source || !this.source[command]) return;
    this.busy=true;++this.revision;this.onChange({source:this.source,busy:true});
    const source=this.source;
    try {
      const tab=await this.api.tabs.get(source.tabId);
      if(tab.windowId!==this.windowId) throw Error('The tab has moved to another window.');
      const target=source.documentId?{tabId:source.tabId,documentIds:[source.documentId]}:{tabId:source.tabId,frameIds:[source.frameId]};
      let timeout;
      let results;
      try {
        results=await Promise.race([
          this.api.scripting.executeScript({target,world:'MAIN',func:mediaInPage,args:[command]}),
          new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('timeout')),8000);})
        ]);
      } finally {clearTimeout(timeout);}
      if(!results[0]?.result) throw Error('This media source is no longer available.');
      this.source={...source,...results[0].result};this.onChange({source:this.source});
    } catch {this.onChange({source:this.source,error:'Could not complete the action. Open the media tab.'});}
    finally {this.busy=false;}
  }
}
