export const DEFAULT_SPACE_ID = 'default';
export function normalizeSpaceConfig(value) {
  const seen = new Set();
  const spaces = (Array.isArray(value?.spaces) ? value.spaces : []).filter(space => {
    if (!space || typeof space.id !== 'string' || !space.id || seen.has(space.id) ||
        typeof space.name !== 'string' || !space.name.trim()) return false;
    seen.add(space.id); return true;
  }).map(space => ({ id: space.id, name: space.name.trim().slice(0, 60) }));
  if (!spaces.length && !(Array.isArray(value?.spaces) && value.spaces.length === 0)) spaces.push({ id: DEFAULT_SPACE_ID, name: 'Space' });
  const expandedIds = Array.isArray(value?.expandedIds)
    ? value.expandedIds.filter(id => spaces.some(space => space.id === id))
    : spaces.length ? [spaces[0].id] : [];
  return { spaces, expandedIds: [...new Set(expandedIds)] };
}
export function assignSitesToSpaces(sites, config) {
  return sites.map(site => site.section === 'space' && !config.spaces.some(space => space.id === site.spaceId)
    ? { ...site, spaceId: config.spaces[0]?.id } : site);
}
export function validateSpaceName(value, spaces, exceptId = null) {
  const name = value.trim();
  if (!name) return 'Enter a space name.';
  if (name.length > 60) return 'The name must be 60 characters or fewer.';
  if (spaces.some(space => space.id !== exceptId && space.name.toLocaleLowerCase('en') === name.toLocaleLowerCase('en')))
    return 'A space with this name already exists. Choose another.';
  return '';
}
