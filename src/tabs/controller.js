// Live tab associations are session-only; saved sites remain in storage.local.
export function normalizeUrl(value) {
  try { return new URL(value).href; } catch { return value || ''; }
}

export class TabsController {
  constructor(api, windowId) {
    this.api = api;
    this.windowId = windowId;
    this.key = `space-links-${windowId}`;
    this.links = {};
    this.urls = {};
    this.tabs = [];
    this.opening = new Map();
    this.revision = 0;
    this.persisting = Promise.resolve();
  }

  async init(sites) {
    const saved = (await this.api.storage.session.get(this.key))[this.key];
    this.links = saved?.links || {};
    this.urls = saved?.urls || {};
    await this.refresh(sites);
  }

  persist() {
    const snapshot = { links: { ...this.links }, urls: { ...this.urls } };
    this.persisting = this.persisting.catch(() => {}).then(() =>
      this.api.storage.session.set({ [this.key]: snapshot }));
    return this.persisting;
  }

  async refresh(sites) {
    const revision = ++this.revision;
    const tabs = await this.api.tabs.query({ windowId: this.windowId });
    if (revision !== this.revision) return;
    this.tabs = tabs.sort((a, b) => a.index - b.index);
    const live = new Set(tabs.map(tab => tab.id));
    const ids = new Set(sites.map(site => site.id));
    const claimed = new Set();
    for (const [id, tabId] of Object.entries(this.links)) {
      if (!ids.has(id) || !live.has(tabId) || claimed.has(tabId) ||
          this.urls[id] !== normalizeUrl(sites.find(site => site.id === id)?.url)) {
        delete this.links[id]; delete this.urls[id];
      }
      else claimed.add(tabId);
    }
    // On a fresh browser session adopt exact URLs only, never arbitrary pages
    // on the same domain (mail accounts and separate documents can differ).
    for (const site of sites) {
      if (this.links[site.id] !== undefined) continue;
      const match = tabs.find(tab => !claimed.has(tab.id) &&
        normalizeUrl(tab.pendingUrl || tab.url) === normalizeUrl(site.url));
      if (match) {
        this.links[site.id] = match.id; this.urls[site.id] = normalizeUrl(site.url);
        claimed.add(match.id);
      }
    }
    await this.persist();
  }

  linked(site) { return this.tabs.find(tab => tab.id === this.links[site.id]); }
  ordinary() {
    const linkedIds = new Set(Object.values(this.links));
    return this.tabs.filter(tab => !linkedIds.has(tab.id));
  }

  open(site, getSites) {
    if (this.opening.has(site.id)) return this.opening.get(site.id);
    const task = this.openOnce(site, getSites).finally(() => this.opening.delete(site.id));
    this.opening.set(site.id, task);
    return task;
  }

  async openOnce(site, getSites) {
    await this.refresh(getSites());
    const existing = this.linked(site);
    if (existing) {
      try { await this.api.tabs.update(existing.id, { active: true }); return; }
      catch (error) {
        // Reopen only if the tab actually disappeared, not on arbitrary failure.
        const live = await this.api.tabs.query({ windowId: this.windowId });
        if (live.some(tab => tab.id === existing.id)) throw error;
        delete this.links[site.id];
      }
    }
    const tab = await this.api.tabs.create({ windowId: this.windowId, url: site.url, active: true });
    this.links[site.id] = tab.id;
    this.urls[site.id] = normalizeUrl(site.url);
    // Invalidate queries started before the new tab was associated.
    ++this.revision;
    this.tabs = [...this.tabs.filter(item => item.id !== tab.id), tab];
    await this.persist();
  }

  async forget(ids) {
    for (const id of ids) { delete this.links[id]; delete this.urls[id]; }
    ++this.revision;
    await this.persist();
  }
}
