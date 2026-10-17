import { PLATFORMS } from './catalog.mjs';
import { getPlatformPresentation } from './presentation.mjs';

// Shared by Canvas counters and DOM dossiers. All panels are representative
// role illustrations; catalogue names and capabilities remain authoritative.
const base = './assets/war/art/role-atlas.png';
const specialists = './assets/war/art/role-specialists.png';
const baseKeys = ['infantry', 'armor', 'artillery-air-defense', 'aviation', 'naval', 'missiles', 'intelligence-support', 'industry'];
const specialistKeys = ['mechanized', 'rocket-artillery', 'air-defence', 'attack-helicopter', 'drone', 'maritime-aircraft', 'transport-aircraft', 'aew', 'submarine', 'destroyer', 'carrier', 'bomber', 'engineers', 'logistics', 'electronic-warfare', 'asw-helicopter'];
const panels = new Map([
  ...baseKeys.map((key, index) => [key, Object.freeze({ key, src: base, column: index % 4, row: Math.floor(index / 4), columns: 4, rows: 2 })]),
  ...specialistKeys.map((key, index) => [key, Object.freeze({ key, src: specialists, column: index % 4, row: Math.floor(index / 4), columns: 4, rows: 4 })]),
]);
const rolePanels = Object.freeze({
  infantry: 'infantry', mechanized: 'mechanized', 'protected-mobility': 'mechanized', armour: 'armor',
  artillery: 'artillery-air-defense', 'rocket-artillery': 'rocket-artillery', 'air-defence': 'air-defence', interceptor: 'air-defence',
  fighter: 'aviation', multirole: 'aviation', strike: 'aviation', bomber: 'bomber', 'attack-helicopter': 'attack-helicopter',
  'maritime-aircraft': 'maritime-aircraft', 'asw-helicopter': 'asw-helicopter', 'transport-aircraft': 'transport-aircraft',
  'armed-drone': 'drone', 'isr-drone': 'drone', aew: 'aew',
  carrier: 'carrier', submarine: 'submarine', destroyer: 'destroyer', frigate: 'naval', corvette: 'naval', naval: 'naval',
  nuclear: 'missiles', 'cruise-missile': 'missiles', 'anti-ship-missile': 'missiles',
  engineers: 'engineers', logistics: 'logistics', radar: 'intelligence-support', 'electronic-warfare': 'electronic-warfare', command: 'industry',
});
const catalogue = new Map(PLATFORMS.map(platform => [platform.id, platform]));
const presentation = new Map(PLATFORMS.map(platform => [platform.id, getPlatformPresentation(platform)]));

export function getArtwork(subject) {
  const platform = typeof subject === 'string' ? catalogue.get(subject) : subject;
  if (!platform) return { ...(panels.get(subject) || panels.get('industry')), label: 'Representative military role artwork' };
  const detail = catalogue.get(platform.id) === platform ? presentation.get(platform.id) : getPlatformPresentation(platform);
  return { ...(panels.get(rolePanels[detail.roleId]) || panels.get(platform.branch) || panels.get('industry')), label: `Representative ${detail.roleLabel.toLowerCase()} artwork` };
}

export const ARTWORK_PANELS = Object.freeze([...panels.values()]);
