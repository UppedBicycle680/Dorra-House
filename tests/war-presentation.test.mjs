import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANCHES, PLATFORMS, getPlatformsForNation, getResearchCost } from '../war/catalog.mjs';
import { buildResearchTree, getPlatformPresentation, PRESENTATION_NOTICE } from '../war/presentation.mjs';

function viewFor(nationId = 'AU') {
  return {
    match: { status: 'running', gameTime: 3600 },
    player: { nationId, research: ['infantry-company', 'combined-arms-doctrine'], researchQueue: [], importLicenses: [], resources: { cash: 100000, supplies: 100000, electronics: 100000, fuel: 100000, manpower: 100000 } },
    provinces: [{ id: 'own-capital', ownerId: nationId, facilities: { 'intelligence-center': 2, 'army-base': 5, 'air-base': 5, 'naval-base': 5, 'missile-site': 5, 'arms-industry': 5 } }],
    catalog: { platforms: getPlatformsForNation(nationId) },
  };
}
const node = (view, id, options) => buildResearchTree(view, options).nodes.find(item => item.id === id);

test('every authored platform has an original role presentation with exact game values and branch art key', () => {
  assert.equal(PLATFORMS.length, 95);
  for (const platform of PLATFORMS) {
    const info = getPlatformPresentation(platform);
    assert.equal(info.name, platform.name);
    assert.ok(info.roleId && info.roleLabel && info.iconKey && info.summary, platform.id);
    assert.ok(BRANCHES.some(branch => branch.id === info.artKey));
    assert.equal(info.sourceUrl, platform.sourceUrl);
    assert.equal(info.balanceNotice, PRESENTATION_NOTICE);
    for (const stat of info.stats) {
      assert.equal(stat.value, platform.stats[stat.id], `${platform.id}/${stat.id} must not invent or rebalance a value`);
      assert.match(stat.unit, /^game /);
    }
    assert.deepEqual(info.capabilities.map(capability => capability.id), platform.capabilities);
    assert.deepEqual(info.operators, platform.operators);
  }
  assert.equal(getPlatformPresentation('unknown-platform'), null);
});

test('maritime aircraft, unarmed transports, interceptors and nuclear effects retain their actual different roles', () => {
  assert.equal(getPlatformPresentation('p8a-poseidon').roleId, 'maritime-aircraft');
  assert.equal(getPlatformPresentation('ch148-cyclone').roleId, 'asw-helicopter');
  assert.match(getPlatformPresentation('p8a-poseidon').cautions.join(' '), /No land-strike capability/);
  const transport = getPlatformPresentation('nh90-nz');
  assert.equal(transport.roleId, 'transport-aircraft');
  assert.match(transport.cautions.join(' '), /No general strike damage/);
  const interceptor = getPlatformPresentation('aster30');
  assert.equal(interceptor.roleId, 'interceptor');
  assert.match(interceptor.cautions.join(' '), /Defensive use only/);
  assert.match(interceptor.cautions.join(' '), /Single use/);
  const nuclear = PLATFORMS.find(platform => platform.nuclear);
  assert.match(getPlatformPresentation(nuclear).cautions.join(' '), /fallout and collateral damage.*friendly and neutral/);
  assert.equal(getPlatformPresentation('combined-arms-doctrine').buildable, false);
  assert.doesNotMatch(getPlatformPresentation('combined-arms-doctrine').cautions.join(' '), /Protect it with fighters/);
});

test('carrier family presentation never grants a naval variant to an undocumented national fleet', () => {
  const us = getPlatformPresentation('f35', { nationId: 'US' });
  const au = getPlatformPresentation('f35', { nationId: 'AU' });
  assert.equal(us.carrierVariant, 'F-35B/C');
  assert.equal(au.carrierVariant, null);
  assert.match(au.cautions.join(' '), /not documented as a carrier-compatible variant/);
  assert.equal(getPlatformPresentation('rafale', { nationId: 'FR' }).carrierVariant, 'Rafale M');
});

test('national research tree uses only server-eligible programmes, existing tiers and explicit cross-branch prerequisites', () => {
  const view = viewFor(), tree = buildResearchTree(view);
  assert.deepEqual(tree.branches.map(branch => branch.id), BRANCHES.map(branch => branch.id));
  assert.deepEqual(new Set(tree.nodes.map(item => item.id)), new Set(view.catalog.platforms.map(platform => platform.id)));
  assert.equal(tree.nodes.some(item => item.id === 'leclerc'), false);
  for (const branch of tree.branches) for (const tier of branch.tiers) for (const item of tier.nodes) {
    assert.equal(item.branchId, branch.id); assert.equal(item.level, tier.level);
    assert.equal(item.level, item.platform.level);
  }
  const expected = view.catalog.platforms.flatMap(platform => platform.prerequisites.map(from => `${from}->${platform.id}`));
  assert.deepEqual(tree.links.map(link => `${link.from}->${link.to}`).sort(), expected.sort());
  assert.ok(tree.links.some(link => link.from === 'networked-command' && link.to === 'f35' && link.fromBranchId !== link.toBranchId));
  assert.equal(tree.links.some(link => link.from === 'm1a2-abrams' && link.to === 'f35'), false, 'A tier layout must not invent vehicle-upgrade dependencies');
  assert.match(tree.notice, /not real vehicle specifications/);
});

test('completed starting equipment stays complete even when its normal prerequisite or facility has been lost', () => {
  const view = viewFor('FR');
  view.player.research = [{ platformId: 'leclerc' }]; view.provinces[0].facilities = {};
  const item = node(view, 'leclerc');
  assert.equal(item.state, 'complete'); assert.equal(item.complete, true); assert.equal(item.canResearch, false);
  assert.equal(item.facility.ready, false); assert.equal(item.production.facilityReady, false);
  assert.deepEqual(item.blockingReasons, []);
  assert.match(item.accessibleLabel, /Research complete/);
});

test('a queued programme shows its actual due time without fabricating progress or remaining game time', () => {
  const view = viewFor(); view.player.researchQueue = [{ id: 'q1', platformId: 'networked-command', due: 9000 }];
  const item = node(view, 'networked-command');
  assert.equal(item.state, 'researching'); assert.equal(item.canResearch, false);
  assert.equal(item.queue.remainingSeconds, 5400); assert.equal(item.queue.progress, null);
  assert.equal(buildResearchTree(view).slots.free, 1);
  view.match.gameTime = 10000;
  assert.equal(node(view, 'networked-command').queue.remainingSeconds, 0, 'An overdue item awaits server settlement; it cannot become locally complete');
  assert.equal(node(view, 'networked-command').state, 'researching');
});

test('research requirements combine own laboratory, own platform facility, real prerequisites, resources, slots and world status', () => {
  const view = viewFor();
  const ready = node(view, 'bushmaster');
  assert.equal(ready.state, 'available'); assert.equal(ready.canResearch, true);
  assert.equal(ready.eligibility.kind, 'national');
  assert.deepEqual(ready.cost, getResearchCost('bushmaster'));
  assert.equal(ready.durationSeconds, 3600, 'The SQL minimum is1gamehour even when catalogue researchHours is0.5');
  assert.equal(ready.production.durationSeconds, PLATFORMS.find(platform => platform.id === 'bushmaster').buildHours * 3600);

  view.provinces[0].facilities = {};
  view.provinces.push({ id: 'enemy-lab', ownerId: 'NZ', facilities: { 'intelligence-center': 5, 'army-base': 5 } });
  let locked = node(view, 'bushmaster');
  assert.equal(locked.state, 'locked');
  assert.equal(locked.requirements.find(requirement => requirement.kind === 'laboratory').met, false);
  assert.equal(locked.facility.ready, false, 'Foreign facilities never satisfy own research requirements');
  view.provinces[0].facilities = { 'intelligence-center': 1, 'army-base': 1 };
  view.player.resources.cash = 0; view.player.researchQueue = [{ platformId: 'one' }, { platformId: 'two' }]; view.match.status = 'paused';
  locked = node(view, 'bushmaster');
  for (const kind of ['resource', 'slots', 'world']) assert.ok(locked.requirements.some(requirement => requirement.kind === kind && !requirement.met));
  assert.match(locked.accessibleLabel, /Requires 200 cash/);
  view.player.research = [];
  assert.equal(node(view, 'm1a2-abrams').requirements.find(requirement => requirement.id === 'combined-arms-doctrine').met, false);
});

test('unavailable equipment explains imports but never bypasses the authoritative filtered catalogue', () => {
  const view = viewFor(), foreign = PLATFORMS.find(platform => platform.id === 'f16');
  assert.ok(foreign.exportable);
  let item = node(view, 'f16', { includeUnavailable: true });
  assert.equal(item.state, 'locked'); assert.equal(item.eligibility.kind, 'import-required');
  assert.match(item.eligibility.detail, /diplomatic import licence/);
  view.player.importLicenses = ['US'];
  item = node(view, 'f16', { includeUnavailable: true });
  assert.equal(item.eligibility.eligible, false, 'A local licence alone cannot manufacture a server-approved platform');
  view.catalog.platforms = [...view.catalog.platforms, foreign];
  item = node(view, 'f16');
  assert.equal(item.eligibility.eligible, true); assert.equal(item.eligibility.kind, 'licensed');
  assert.ok(item.eligibility.donorNationIds.includes('US'));
  assert.equal(node(view, 'f22', { includeUnavailable: true }).eligibility.eligible, false);
  assert.match(node(view, 'f22', { includeUnavailable: true }).eligibility.detail, /not available for diplomatic export/);
  const nuclear = PLATFORMS.find(platform => platform.nuclear && !platform.operators.includes('AU'));
  item = node(view, nuclear.id, { includeUnavailable: true });
  assert.equal(item.state, 'locked'); assert.equal(item.eligibility.exportable, false);
  assert.match(item.eligibility.detail, /cannot be imported/);
});

test('empty server catalogue and missing view fail closed, while branch selection retains true dependency metadata', () => {
  const view = viewFor(); view.catalog.platforms = [];
  assert.deepEqual(buildResearchTree(view).nodes, []);
  assert.equal(node(view, 'bushmaster', { includeUnavailable: true }).eligibility.eligible, false);
  assert.match(node(view, 'bushmaster', { includeUnavailable: true }).eligibility.detail, /current server-approved/);
  assert.deepEqual(buildResearchTree(null).nodes, []);
  const selected = buildResearchTree(viewFor(), { branchId: 'aviation' });
  assert.deepEqual(selected.branches.map(branch => branch.id), ['aviation']);
  assert.ok(selected.links.some(link => link.fromBranchId === 'industry' && link.toBranchId === 'aviation'));
});

test('presentation calculations do not mutate catalogue records, server snapshot or queues', () => {
  const view = viewFor(); view.player.researchQueue = [{ platformId: 'networked-command', due: 9000, progress: 25 }];
  const before = structuredClone(view), catalogue = JSON.stringify(PLATFORMS);
  const tree = buildResearchTree(view, { includeUnavailable: true });
  assert.equal(tree.nodes.find(item => item.id === 'networked-command').queue.progress, .25);
  assert.deepEqual(view, before); assert.equal(JSON.stringify(PLATFORMS), catalogue);
});
