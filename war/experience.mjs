import { BRANCHES, FACILITIES, PLATFORMS, getFacilityQuote } from './catalog.mjs';
import { buildResearchTree, getPlatformPresentation } from './presentation.mjs';
import { getArtwork } from './art.mjs';

const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const title = value => String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const number = value => new Intl.NumberFormat('en', { maximumFractionDigits: 1, notation: Math.abs(Number(value)) >= 10000 ? 'compact' : 'standard' }).format(Number(value) || 0);
const icons = { cash: '◈', supplies: '▤', fuel: '◒', electronics: '⌘', manpower: '♙' };
const cost = values => Object.entries(values || {}).filter(([, value]) => value > 0).map(([id, value]) => `<span title="${e(title(id))}"><i aria-hidden="true">${icons[id] || '·'}</i> ${e(number(value))}<span class="sr-only"> ${e(id)}</span></span>`).join('');
const time = seconds => seconds >= 86400 ? `${number(seconds / 86400)}d` : seconds >= 3600 ? `${number(seconds / 3600)}h` : `${Math.ceil(Math.max(0, seconds) / 60)}m`;
const known = (view, id) => (view.player.research || []).some(row => (typeof row === 'string' ? row : row.platformId || row.id) === id);
const source = model => Array.isArray(model.view?.catalog?.platforms) ? model.view.catalog.platforms : PLATFORMS.filter(p => p.operators?.includes('*') || p.operators?.includes(model.view?.player.nationId));
const paths = {
  infantry: '<path d="M4 6h16v12H4zM4 6l16 12M20 6 4 18"/>',
  tank: '<rect x="4" y="12" width="16" height="7" rx="3"/><path d="M8 12V8h8v4m-4-4 9-3M7 16h10"/>',
  artillery: '<circle cx="9" cy="17" r="3"/><path d="m10 14 8-9 3 1-9 11M6 18l-3 2m9-3 5 3"/>',
  aircraft: '<path d="m12 2 2 7 8 5v2l-8-2v5l3 2v1l-5-1-5 1v-1l3-2v-5l-8 2v-2l8-5z"/>',
  naval: '<path d="M3 15h18l-4 5H7zM7 15V9h10v6M12 9V3m0 2h5M3 22l3-1 3 1 3-1 3 1 3-1 3 1"/>',
  missile: '<path d="m8 14 6-10 6-2-1 6-9 8zm4-6 4 4M6 14l-3 5 5-2m3-2 1 6 3-6"/>',
  radar: '<path d="M5 4a12 12 0 0 0 15 15L5 4zm7 8 6-6M9 20l3-8 4 8M6 22h14"/>',
  industry: '<path d="M3 21V10l6 3V8l6 3V3h6v18zM7 17h1m4 0h1m4 0h1"/>',
};
const branchIcons = { infantry: 'infantry', armor: 'tank', 'artillery-air-defense': 'artillery', aviation: 'aircraft', naval: 'naval', missiles: 'missile', 'intelligence-support': 'radar', industry: 'industry' };
export function branchIcon(branch) { return `<svg class="role-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[branchIcons[branch] || 'industry']}</svg>`; }
export function artwork(platform, className = '', decorative = true) {
  const branch = typeof platform === 'string' ? platform : platform?.branch || 'industry';
  const art = getArtwork(platform);
  return `<div class="unit-art art-${e(branch)} art-family-${e(art.key)} ${e(className)}" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${e(art.label)}"`}>${branchIcon(branch)}</div>`;
}
export function goldBalance(gold) { return `<button class="gold-wallet-button" data-action="gold-wallet" aria-label="Gold wallet${gold ? `: ${e(number(gold.balance))} Gold` : ''}" title="Gold wallet"><span class="gold-emblem" aria-hidden="true">G</span><span><small>GOLD</small><strong>${gold ? e(number(gold.balance)) : '—'}</strong></span><span class="gold-more" aria-hidden="true">›</span></button>`; }

export function queueCards(queue, platforms, kind, gameTime = 0, running = true) {
  if (!queue?.length) return `<div class="queue-empty"><span aria-hidden="true">◷</span><span>No ${e(kind.toLowerCase())} in progress.</span></div>`;
  return queue.map(item => {
    const platform = platforms.find(p => p.id === (item.platformId || item.facility));
    const remaining = item.remainingSeconds ?? (Number.isFinite(Number(item.due)) ? Math.max(0, Number(item.due) - gameTime) : null);
    const progress = Number.isFinite(Number(item.progress)) ? Math.max(0, Math.min(100, Number(item.progress) * (Number(item.progress) <= 1 ? 100 : 1))) : null;
    return `<article class="queue-card queue-visual">${artwork(platform?.branch ? platform : 'industry', 'queue-art')}<div class="queue-content"><strong>${e(platform?.name || title(item.facility) || item.name || kind)}</strong><span>${remaining != null ? remaining > 0 ? `${e(time(remaining))} game time remaining` : 'Awaiting next world update' : 'In progress'}${item.provinceId ? ` · ${e(item.provinceId)}` : ''}</span>${progress != null ? `<div class="queue-bar" role="progressbar" aria-label="${e(kind)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></div>` : '<div class="queue-bar indeterminate" aria-hidden="true"><i></i></div>'}</div>${/^\d+$/.test(String(item.id)) ? `<button class="boost-button" data-action="boost-quote" data-id="${e(item.id)}" ${!running || !(remaining > 0) ? 'disabled' : ''} aria-label="Speed up ${e(platform?.name || title(item.facility) || kind)} with Gold"><span aria-hidden="true">ϟ</span> Speed up</button>` : ''}</article>`;
  }).join('');
}

function requirementList(node) {
  const requirements = node.requirements.filter(row => !['resource', 'world', 'slots'].includes(row.kind));
  return `<ul class="research-requirements">${requirements.map(row => `<li class="${row.met ? 'met' : 'unmet'}"><span aria-hidden="true">${row.met ? '✓' : '○'}</span><span>${e(row.label)}${row.kind === 'prerequisite' ? ` <button class="inline-link" data-action="research-node" data-id="${e(row.id)}">Inspect →</button>` : ''}</span></li>`).join('')}</ul>`;
}
function statsHTML(presentation, limit = 6) { return `<dl class="arsenal-stats">${presentation.stats.slice(0, limit).map(stat => `<div><dt>${e(stat.label)}</dt><dd>${e(number(stat.value))}<small>${e(stat.unit.replace(/^game /, ''))}</small></dd></div>`).join('')}</dl>`; }
export function platformDetails(platform, { compact = false } = {}) {
  const presentation = getPlatformPresentation(platform);
  return `<div class="unit-role-label">${branchIcon(platform.branch)} ${e(presentation.roleLabel)}</div>${!compact ? `<p>${e(presentation.summary)}</p>` : ''}${statsHTML(presentation, compact ? 4 : 8)}${!compact ? `<div class="role-counters"><div><h4>Strengths</h4>${presentation.strengths.map(text => `<p>+ ${e(text)}</p>`).join('') || '<p>Use within its assigned role.</p>'}</div><div><h4>Considerations</h4>${presentation.cautions.map(text => `<p>${e(text)}</p>`).join('')}</div></div>` : ''}`;
}
const RESEARCH_FILTERS = [
  { id: 'all', label: 'All' }, { id: 'available', label: 'Ready' },
  { id: 'researching', label: 'In progress' }, { id: 'complete', label: 'Complete' }, { id: 'locked', label: 'Locked' },
];
const researchPriority = { available: 0, researching: 1, complete: 2, locked: 3 };
const branchName = id => BRANCHES.find(branch => branch.id === id)?.name || 'Programme';

export function researchViewModel(model) {
  const tree = buildResearchTree(model.view, { includeUnavailable: Boolean(model.showForeignResearch) });
  const branch = tree.branches.find(row => row.id === model.branch) || tree.branches[0];
  const query = (model.researchSearch || '').trim().toLowerCase();
  const branchNodes = tree.nodes.filter(node => node.branchId === branch?.id && (!query || (node.name + ' ' + node.presentation.roleLabel).toLowerCase().includes(query)));
  const filter = RESEARCH_FILTERS.some(row => row.id === model.researchFilter) ? model.researchFilter : 'all';
  const counts = Object.fromEntries(RESEARCH_FILTERS.map(row => [row.id, row.id === 'all' ? branchNodes.length : branchNodes.filter(node => node.state === row.id).length]));
  const nodes = branchNodes.filter(node => filter === 'all' || node.state === filter)
    .sort((a, b) => a.level - b.level || researchPriority[a.state] - researchPriority[b.state] || a.name.localeCompare(b.name));
  const selected = nodes.find(node => node.id === model.researchId) || nodes.find(node => node.state === 'available') || nodes[0] || null;
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const resolve = id => {
    const node = byId.get(id), platform = node?.platform || PLATFORMS.find(row => row.id === id);
    return { id, name: node?.name || platform?.name || title(id), branchId: node?.branchId || platform?.branch, complete: Boolean(node?.complete), state: node?.state || 'locked' };
  };
  const foundations = [...new Set(nodes.flatMap(node => node.platform.prerequisites || []))]
    .map(resolve).filter(node => node.branchId !== branch?.id);
  const prerequisites = (selected?.platform.prerequisites || []).map(resolve);
  const unlocks = selected ? tree.links.filter(link => link.from === selected.id).map(link => resolve(link.to)) : [];
  return { tree, branch, branchNodes, nodes, selected, filter, counts, levels: [...new Set(nodes.map(node => node.level))], foundations, prerequisites, unlocks };
}

function programmeLink(node, label = '') {
  return '<button class="programme-link ' + (node.complete ? 'met' : '') + '" data-action="research-node" data-id="' + e(node.id) + '">' +
    '<span aria-hidden="true">' + (node.complete ? '✓' : '◇') + '</span><span><strong>' + e(node.name) +
    '</strong><small>' + e(label || branchName(node.branchId)) + '</small></span><span aria-hidden="true">↗</span></button>';
}

function researchNode(node, model, selected) {
  const dependencies = node.requirements.filter(row => row.kind === 'prerequisite');
  const hint = node.complete ? 'Unlocked for your arsenal' : node.queue ? 'Research order already paid' : node.blockingReasons[0] || 'All research requirements met';
  return '<article class="research-node equipment-card state-' + node.state + (selected ? ' selected' : '') + '" data-node-id="' + e(node.id) + '">' +
    '<button class="research-select" data-action="research-node" data-id="' + e(node.id) + '" aria-pressed="' + selected + '" aria-label="Inspect ' + e(node.accessibleLabel) + '">' +
    artwork(node.platform, 'research-art') + '<span class="research-node-copy"><span class="node-state"><i aria-hidden="true">' +
    (node.complete ? '✓' : node.queue ? '◷' : node.canResearch ? '●' : '◇') + '</i>' + e(node.stateLabel) +
    '</span><h3>' + e(node.name) + '</h3><span class="node-role">' + e(node.presentation.roleLabel) + '</span></span></button>' +
    '<div class="node-dependencies">' + (dependencies.length ? dependencies.map(row =>
      '<button data-action="research-node" data-id="' + e(row.id) + '" class="' + (row.met ? 'met' : '') + '" title="Inspect prerequisite ' + e(row.label) +
      '"><span aria-hidden="true">↳</span> ' + e(row.label) + '</button>').join('') : '<span>Foundational programme</span>') +
    '</div><p class="node-readiness">' + e(hint) + '</p><div class="research-node-footer"><span>' +
    (node.complete ? 'Unlocked' : node.queue ? e(time(node.queue.remainingSeconds || 0)) + ' remaining' : e(time(node.durationSeconds)) + ' research') +
    '</span><button class="button small ' + (node.complete ? 'secondary' : '') + '" data-action="research" data-id="' + e(node.id) + '" ' +
    (!node.canResearch || model.busy ? 'disabled' : '') + '>' + (node.complete ? 'Unlocked' : node.queue ? 'Researching' : 'Research') + '</button></div></article>';
}

function researchPath(selected, prerequisites, unlocks) {
  return '<section class="research-path" aria-label="Actual programme dependencies"><h4>Programme path</h4>' +
    '<div class="research-path-stage"><span class="field-label">PREREQUISITES</span>' +
    (prerequisites.length ? prerequisites.map(node => programmeLink(node)).join('') : '<p class="path-foundation">Foundational programme · no prerequisite research.</p>') +
    '</div><span class="research-path-arrow" aria-hidden="true">↓</span><div class="research-path-current" aria-current="true">' +
    branchIcon(selected.branchId) + '<span><small>SELECTED PROGRAMME</small><strong>' + e(selected.name) + '</strong></span></div>' +
    (unlocks.length ? '<span class="research-path-arrow" aria-hidden="true">↓</span><div class="research-path-stage"><span class="field-label">PREREQUISITE FOR</span>' +
      unlocks.map(node => programmeLink(node)).join('') + '<p class="fine-print">Each programme keeps its own access, facility and resource requirements.</p></div>' :
      '<p class="path-foundation">No further catalogue programmes depend on this research.</p>') + '</section>';
}

function researchDossier(data, model) {
  const { selected, prerequisites, unlocks } = data;
  if (!selected) return '<aside class="research-inspector research-inspector-empty" data-research-scroll="dossier" aria-label="Selected research programme"><strong>No programme selected</strong><p>Choose another availability filter or clear the search to inspect your arsenal.</p></aside>';
  const facilityMissing = selected.requirements.some(row => ['facility', 'laboratory'].includes(row.kind) && !row.met);
  const productionNeedsFacility = selected.production.buildable && !selected.facility.ready;
  const outcome = selected.production.buildable ? (selected.complete ? 'Researched for your national arsenal. ' : 'Unlocks this equipment for mobilisation. ') +
    'Production requires ' + selected.facility.name + ' level ' + selected.level + ' in the selected province.' :
    'A command programme that unlocks dependent research. It does not create a formation or automatically upgrade existing vehicles.';
  const investment = selected.complete ? (selected.production.buildable ? '<p>This unlock persists. Mobilise equipment from an owned province.</p>' : '<p>Command research complete. Follow its dependent programmes below.</p>') :
    selected.queue ? '<span class="decision-state researching">◷ Research in progress</span><p>' + e(time(selected.queue.remainingSeconds || 0)) + ' game time remaining · original research cost paid.</p>' :
      '<span class="field-label">RESEARCH INVESTMENT</span><div class="cost-line">' + cost(selected.cost) + '</div><p>◷ ' + e(time(selected.durationSeconds)) + ' game time</p>';
  return '<aside class="research-inspector" data-research-scroll="dossier" aria-label="Selected research programme">' +
    '<button class="mobile-tree-back text-button" data-action="research-tree">← Back to research tree</button><div class="dossier-hero">' +
    artwork(selected.platform, 'inspector-art', false) + '<div class="dossier-identity"><span class="eyebrow">PROGRAMME DOSSIER · TIER ' + selected.level +
    '</span><h3>' + e(selected.name) + '</h3><span class="unit-role-label">' + branchIcon(selected.branchId) + e(selected.presentation.roleLabel) +
    '</span><span class="tag ' + (selected.complete ? 'green' : 'gold') + '">' + e(selected.stateLabel) + '</span></div></div>' +
    '<div class="inspector-content"><p class="programme-summary">' + e(selected.presentation.summary) + '</p><div class="research-decision">' + investment +
    (selected.complete ? selected.production.buildable ? '<button class="button wide" data-action="research-mobilise" data-id="' + e(selected.id) + '">View mobilisation →</button>' : '' :
      '<button class="button wide" data-action="research-start" data-id="' + e(selected.id) + '" ' + (!selected.canResearch || model.busy ? 'disabled' : '') + '>' +
      (selected.queue ? 'Programme in progress' : 'Begin research →') + '</button>') +
    (selected.blockingReasons.length ? '<p class="requirement-note" role="status">' + e(selected.blockingReasons[0]) + '</p>' : '') +
    ((facilityMissing && !selected.complete || productionNeedsFacility) ? '<button class="button secondary wide" data-action="research-facilities">View required facilities →</button>' : '') +
    '</div><p class="research-outcome">' + e(outcome) + '</p>' + researchPath(selected, prerequisites, unlocks) +
    (!selected.complete && !selected.queue ? '<h4>Requirements to begin research</h4>' + requirementList(selected) : '') +
    '<details class="research-rating-details"><summary>Weapon role, ratings & counters</summary>' + platformDetails(selected.platform) + '</details>' +
    '<p class="art-disclosure">Representative role artwork. National names and capabilities use the equipment catalogue; all ratings are game values.</p>' +
    (selected.presentation.sourceUrl ? '<a class="source-link" href="' + e(selected.presentation.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Equipment source ↗</a>' : '') +
    '</div></aside>';
}

export function researchExperience(model) {
  const data = researchViewModel(model), { tree, branch, nodes, selected, filter, counts, levels, foundations } = data;
  const running = ['running', 'active'].includes(model.view.match.status), query = model.researchSearch || '';
  const available = tree.nodes.filter(node => node.canResearch).length;
  const status = tree.slots.free ? tree.slots.free + ' open ' + (tree.slots.free === 1 ? 'slot' : 'slots') + ' · ' + available + ' ready ' + (available === 1 ? 'programme' : 'programmes') : 'Both research slots occupied';
  return '<div class="research-shell"><div class="mobile-research-branch-picker"><div><label class="field-label" for="researchBranch">RESEARCH BRANCH</label><span>' +
    tree.slots.used + ' / 2 projects</span></div><select id="researchBranch">' + tree.branches.map(row =>
      '<option value="' + e(row.id) + '" ' + (branch.id === row.id ? 'selected' : '') + '>' + e(row.name) + ' · ' + row.counts.available + ' ready</option>').join('') +
    '</select></div><section class="research-session" aria-label="Research overview and active projects"><div class="research-overview"><div><span class="eyebrow">NATIONAL ARSENAL</span>' +
    '<p>' + e(status) + '. Choose a programme or follow its prerequisite path.</p></div><div class="research-slot-count"><strong>' + tree.slots.used +
    '<span> / 2</span></strong><small>RESEARCH SLOTS</small></div></div><div class="active-research-grid">' +
    queueCards(model.view.player.researchQueue, source(model), 'Research', model.view.match.gameTime, running) +
    (tree.slots.used < 2 ? '<div class="research-open-slot"><span aria-hidden="true">+</span><div><strong>' + (2 - tree.slots.used) + ' open research ' +
      (tree.slots.used === 1 ? 'slot' : 'slots') + '</strong><small>Research unlocks equipment. Mobilise it separately.</small></div></div>' : '') +
    '</div></section><div class="research-workbench"><nav class="research-branches" aria-label="Research branches">' + tree.branches.map(row =>
      '<button data-action="branch" data-id="' + e(row.id) + '" class="' + (branch.id === row.id ? 'active' : '') + '" aria-pressed="' + (branch.id === row.id) + '">' +
      branchIcon(row.id) + '<span>' + e(row.name) + '<small>' + row.counts.available + ' ready · ' + Object.values(row.counts).reduce((sum, count) => sum + count, 0) +
      (Object.values(row.counts).reduce((sum, count) => sum + count, 0) === 1 ? ' programme' : ' programmes') + '</small></span></button>').join('') +
    '</nav><section class="research-main" data-research-scroll="tree" aria-label="' + e(branch.name) + ' research tree"><div class="research-toolbar"><div><h3>' + e(branch.name) +
    '</h3><p>Facility tiers · actual prerequisite links</p></div><button class="inline-link" data-action="research-foreign" aria-pressed="' + Boolean(model.showForeignResearch) + '">' +
    (model.showForeignResearch ? 'National access only' : 'Show foreign equipment') + '</button></div><label class="sr-only" for="researchSearch">Search this research branch</label>' +
    '<input class="search-field" id="researchSearch" type="search" placeholder="Find a programme or unit role…" value="' + e(query) + '" autocomplete="off">' +
    '<div class="research-state-filters" role="group" aria-label="Programme availability">' + RESEARCH_FILTERS.map(row =>
      '<button data-action="research-filter" data-id="' + row.id + '" class="' + (filter === row.id ? 'active' : '') + '" aria-pressed="' + (filter === row.id) + '">' +
      row.label + '<span>' + counts[row.id] + '</span></button>').join('') + '</div>' +
    (foundations.length ? '<section class="research-foundations" aria-label="Cross-branch prerequisites"><span class="field-label">CONNECTING PROGRAMMES</span><div>' +
      foundations.map(node => programmeLink(node)).join('') + '</div><span class="foundation-direction"><span aria-hidden="true">↓</span> Prerequisites for this branch</span></section>' : '') +
    '<div class="research-tier-board" data-research-board>' + levels.map(level =>
      '<section class="research-tier" aria-label="Tier ' + level + '"><h4><span>TIER ' + level + '</span><small>Facility level ' + level + '</small></h4><div class="research-tier-nodes">' +
      nodes.filter(node => node.level === level).map(node => researchNode(node, model, selected?.id === node.id)).join('') + '</div></section>').join('') +
    (nodes.length ? '' : '<div class="empty-state"><strong>No ' + (filter === 'all' ? 'matching' : e(RESEARCH_FILTERS.find(row => row.id === filter).label.toLowerCase())) +
      ' programmes</strong><p>Choose another availability filter, clear your search, or inspect foreign equipment and its import requirements.</p></div>') +
    '</div><p class="research-tree-note">Links connect actual prerequisite programmes. Tiers describe facilities, not calendar days. Foreign equipment needs an allowed diplomatic import licence.</p></section>' +
    researchDossier(data, model) + '</div></div>';
}

export function arsenalCard(platform, model) {
  const view = model.view, researched = known(view, platform.id), presentation = getPlatformPresentation(platform);
  const province = view.provinces.find(row => row.id === model.provinceId && row.ownerId === view.player.nationId);
  const facilityId = platform.facility || 'army-base', level = Math.max(1, Number(platform.level) || 1);
  const facilityReady = Number(province?.facilities?.[facilityId] || 0) >= level;
  const queued = view.player.productionQueue?.some(row => row.provinceId === model.provinceId);
  const affordable = Object.entries(platform.cost || {}).every(([id, amount]) => Number(view.player.resources[id] || 0) >= amount);
  const running = ['running', 'active'].includes(view.match.status);
  const reason = !running ? 'Launch or resume the operation to mobilise.' : !province ? 'Select an owned province.' : !researched ? 'Research this programme first.' : !facilityReady ? `Requires ${title(facilityId)} level ${level}.` : queued ? 'This province already has a production order.' : !affordable ? 'Insufficient war resources.' : '';
  const status = reason ? !researched ? 'Research required' : !facilityReady ? 'Facility required' : queued ? 'Queue occupied' : !affordable ? 'Resources required' : 'Unavailable' : 'Ready to mobilise';
  return `<article class="equipment-card arsenal-card">${artwork(platform, 'arsenal-art')}<div class="arsenal-card-content"><div class="equipment-top"><div><span class="unit-role-label">${e(presentation.roleLabel)} · TIER ${level}</span><h3>${e(platform.name)}</h3></div><span class="tag ${reason ? 'gold' : 'green'}">${status}</span></div><p>${e(presentation.summary)}</p>${statsHTML(presentation, 4)}<p class="requirement-note">${reason ? e(reason) : `${e(title(facilityId))} · L${level} ready`}</p><div class="equipment-bottom"><div class="cost-line">${cost(platform.cost)}<span>◷ ${e(time(Math.max(.5, Number(platform.buildHours) || .5) * 3600))}</span></div><button class="button small" data-action="produce" data-id="${e(platform.id)}" ${reason || model.busy ? 'disabled' : ''}>Produce</button></div><button class="inline-link" data-action="equipment-details" data-id="${e(platform.id)}">Unit dossier & counters →</button></div></article>`;
}

export function provinceExperience(model) {
  const view = model.view, province = view.provinces.find(row => row.id === model.provinceId), geo = model.provinceFeature?.properties || model.provinceIndex?.get(model.provinceId)?.properties;
  if (!province) return '';
  const owned = province.ownerId === view.player.nationId, running = ['running', 'active'].includes(view.match.status);
  const queue = view.player.buildQueue?.find(row => row.provinceId === province.id);
  const production = (view.player.productionQueue || []).filter(row => row.provinceId === province.id);
  const platforms = source(model).filter(p => p.buildable !== false);
  const query = (model.productionSearch || '').toLowerCase();
  const shown = platforms.filter(p => (!model.productionBranch || p.branch === model.productionBranch) && (!model.productionReady || known(view, p.id) && Number(province.facilities?.[p.facility || 'army-base'] || 0) >= Number(p.level || 1)) && `${p.name} ${getPlatformPresentation(p).roleLabel}`.toLowerCase().includes(query));
  return `<button class="text-button province-back" data-action="province-picker">← All owned provinces</button><div class="province-command-title"><div><span class="eyebrow">${e(province.ownerId)} / ${geo?.capital ? 'CAPITAL REGION' : e(title(geo?.terrain || 'province'))}</span><h3>${e(geo?.name || province.name || province.id)}</h3></div><span class="province-morale"><strong>${province.morale == null ? '—' : `${Math.round(province.morale)}%`}</strong><small>MORALE</small></span></div><p class="province-summary">${geo?.port ? 'Coastal port · ' : ''}${owned ? 'Your command · National mobilisation and infrastructure' : 'Foreign province · Own this territory to build and mobilise'}</p>${owned ? `<nav class="industry-jump-nav" aria-label="Province command sections"><button data-action="industry-section" data-id="mobilisation">Mobilise</button><button data-action="industry-section" data-id="infrastructure">Infrastructure</button><button data-action="industry-section" data-id="queues">Queues <span>${production.length + (queue ? 1 : 0)}</span></button></nav><section id="industry-queues" class="industry-queues"><div class="section-label">PRODUCTION QUEUE</div>${queueCards(production, platforms, 'Production', view.match.gameTime, running)}${queue ? `<div class="section-label">CONSTRUCTION QUEUE</div>${queueCards([queue], FACILITIES, 'Construction', view.match.gameTime, running)}` : ''}</section><section id="industry-mobilisation"><div class="section-label">MOBILISE FORCES <span>${platforms.length} national programmes</span></div><p class="section-intro">Research unlocks the equipment. This province must also have its required facility.</p><div class="production-filters"><label><span class="sr-only">Equipment branch</span><select id="productionBranch"><option value="">All unit families</option>${BRANCHES.filter(b => b.id !== 'industry').map(b => `<option value="${b.id}" ${model.productionBranch === b.id ? 'selected' : ''}>${e(b.name)}</option>`).join('')}</select></label><button class="filter-button ${model.productionReady ? 'active' : ''}" data-action="production-ready" aria-pressed="${Boolean(model.productionReady)}">Ready here</button></div><label class="sr-only" for="productionSearch">Search national equipment</label><input id="productionSearch" class="search-field" type="search" placeholder="Search troops, vehicles, aircraft…" value="${e(model.productionSearch || '')}"><div class="arsenal-grid" id="productionChoices">${shown.map(p => arsenalCard(p, model)).join('') || '<p class="fine-print">No equipment matches these filters. Try all unit families or inspect Research for requirements.</p>'}</div><p class="art-disclosure">Artwork represents unit families. Equipment names, roles and available capabilities are national catalogue entries.</p></section><section id="industry-infrastructure"><div class="section-label">INFRASTRUCTURE</div><div class="infrastructure-grid">${FACILITIES.map(facility => {
    const current = Math.max(0, Number(province.facilities?.[facility.id]) || 0), maxed = current >= (facility.maxLevel || 5), quote = maxed ? null : getFacilityQuote(facility.id, current);
    const thisJob = queue?.facility === facility.id, portMissing = facility.requiresPort && !geo?.port;
    const affordable = !quote || Object.entries(quote.cost).every(([id, amount]) => Number(view.player.resources[id] || 0) >= amount);
    const blocked = !running || maxed || Boolean(queue) || portMissing || !affordable;
    return `<article class="facility-row"><div class="profile-heading"><h3>${e(facility.name)}</h3><span class="tag ${current ? 'green' : ''}">${current ? `Level ${current} / ${facility.maxLevel || 5}` : 'Not built'}</span></div><p>${e(facility.description)}${portMissing ? ' Select a coastal province with a port.' : ''}</p>${queue && !thisJob ? `<p class="requirement-note">Province construction queue occupied by ${e(title(queue.facility))}.</p>` : ''}<div class="equipment-bottom"><div class="cost-line">${quote ? `${cost(quote.cost)}<span>◷ ${e(time(quote.buildHours * 3600))}</span>` : '<span>Maximum level reached</span>'}</div><button class="button small secondary" data-action="build" data-id="${e(facility.id)}" ${blocked || model.busy ? 'disabled' : ''}>${maxed ? 'Maximum level' : thisJob ? 'Constructing' : queue ? 'Queue occupied' : current ? `Upgrade → L${current + 1}` : 'Build'}</button></div></article>`;
  }).join('')}</div></section>` : '<p class="status-note">Construction and production require a province under your control.</p>'}`;
}

export function walletContents(gold) {
  const history = gold?.history || gold?.transactions || [];
  return `<div class="wallet-hero"><span class="gold-emblem" aria-hidden="true">G</span><div><strong>${gold ? e(number(gold.balance)) : '—'}</strong><small>AVAILABLE GOLD</small></div></div><p>Use Gold to finish one research, production, or construction order instantly. War resources still pay the original order cost.</p><div class="wallet-rules"><h3>Earn it. Award it. Use it wisely.</h3><p>Eligible victories award <b>5 Gold</b>, up to <b>10 per Brisbane calendar day</b>. A match must last at least one game day; retiring earns none. Administrators can grant audited awards, including tournament prizes.</p><p>Gold belongs to your account across campaigns. Speed-ups cost <b>10 Gold per remaining game hour</b>, rounded up to the next Gold, with a minimum of 1. You review the server’s quote before spending.</p><p class="fine-print">Gold cannot be purchased or exchanged for money. Speed-ups require a running operation.</p></div><h3 class="wallet-history-title">Recent activity</h3>${history.length ? `<div class="wallet-history">${history.slice(0, 12).map(row => `<div><span><strong>${e(row.reason || row.label || title(row.kind || row.type))}</strong><small>${e(row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '')}</small></span><b class="${Number(row.amount) < 0 ? '' : 'credit'}">${Number(row.amount) > 0 ? '+' : ''}${e(number(row.amount))} G</b></div>`).join('')}</div>` : '<p class="fine-print">Your match rewards, administrator awards and speed-ups will appear here.</p>'}`;
}
