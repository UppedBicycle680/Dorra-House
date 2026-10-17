import test from 'node:test';
import assert from 'node:assert/strict';
import { FACILITIES, getPlatformsForNation } from '../war/catalog.mjs';
import { artwork, queueCards, researchExperience, researchViewModel } from '../war/experience.mjs';

function modelFor(nationId = 'US') {
  return {
    branch: 'aviation', researchFilter: 'all',
    view: {
      match: { status: 'running', gameTime: 3600 },
      player: { nationId, resources: { cash: 100000, supplies: 100000, fuel: 100000, electronics: 100000, manpower: 100000 }, research: ['combined-arms-doctrine', 'f16'], researchQueue: [{ id: '42', platformId: 'mq9-reaper', due: 18000 }], importLicenses: [] },
      provinces: [{ id: 'capital', ownerId: nationId, facilities: { 'army-base': 3, 'air-base': 3, 'naval-base': 3, 'missile-site': 3, 'arms-industry': 3, 'intelligence-center': 1 } }],
      catalog: { platforms: getPlatformsForNation(nationId) },
    },
  };
}

test('availability filters count actual research states and never hide a ready programme behind a locked peer at the same tier', () => {
  const model = modelFor(), all = researchViewModel(model);
  assert.deepEqual(all.counts, { all: 8, available: 3, researching: 1, complete: 1, locked: 3 });
  for (const state of ['available', 'researching', 'complete', 'locked']) {
    const filtered = researchViewModel({ ...model, researchFilter: state });
    assert.equal(filtered.nodes.length, all.counts[state]);
    assert.ok(filtered.nodes.every(node => node.state === state));
    assert.equal(filtered.counts.all, all.nodes.length);
    assert.ok(filtered.selected && filtered.nodes.some(node => node.id === filtered.selected.id));
  }
  assert.deepEqual(all.levels, [2, 3, 4, 5]);
  const tierTwo = all.nodes.filter(node => node.level === 2);
  assert.deepEqual(tierTwo.map(node => node.state), ['available', 'researching', 'complete']);
  assert.equal(researchViewModel({ ...model, researchFilter: 'invented-state' }).filter, 'all');
});

test('programme paths use exact cross-branch prerequisites and actual dependent national catalogue records', () => {
  const model = { ...modelFor(), branch: 'industry', researchId: 'combined-arms-doctrine' };
  const data = researchViewModel(model);
  assert.equal(data.selected.id, 'combined-arms-doctrine');
  assert.deepEqual(data.prerequisites, []);
  const expected = model.view.catalog.platforms.filter(platform => platform.prerequisites.includes(data.selected.id)).map(platform => platform.id).sort();
  assert.deepEqual(data.unlocks.map(node => node.id).sort(), expected);
  const aircraft = researchViewModel({ ...model, branch: 'aviation', researchId: 'f35' });
  assert.deepEqual(aircraft.prerequisites.map(node => [node.id, node.branchId]), [['networked-command', 'industry']]);
  assert.ok(aircraft.foundations.some(node => node.id === 'combined-arms-doctrine' && node.complete));
  assert.ok(aircraft.foundations.some(node => node.id === 'networked-command' && !node.complete));
  const html = researchExperience(model);
  assert.match(html, /aria-label="Actual programme dependencies"/);
  assert.match(html, /PREREQUISITE FOR/);
  assert.match(html, /data-action="research-node" data-id="fa18-super-hornet"/);
  assert.doesNotMatch(html, /data-action="research-node" data-id="leclerc"/);
});

test('starter-unlocked equipment remains complete even when current research gates are unmet, with mobilisation explained separately', () => {
  const model = modelFor('FR');
  model.branch = 'armor'; model.view.player.research = ['leclerc']; model.view.player.researchQueue = [];
  model.view.provinces[0].facilities = { 'army-base': 1 };
  const data = researchViewModel(model);
  assert.equal(data.selected.id, 'leclerc');
  assert.equal(data.selected.complete, true);
  assert.equal(data.selected.canResearch, false);
  assert.equal(data.selected.facility.ready, false);
  const html = researchExperience(model);
  assert.match(html, /This unlock persists/);
  assert.match(html, /Production requires Army base level 3 in the selected province/);
  assert.match(html, /data-action="research-facilities"/);
  assert.doesNotMatch(html, /Requirements to begin research/);
  assert.match(html, /data-action="research-mobilise" data-id="leclerc">View mobilisation/);
  assert.doesNotMatch(html, /data-action="research-start" data-id="leclerc"/);
});

test('research search and empty server catalogues fail closed without changing the filtered snapshot or creating foreign access', () => {
  const model = modelFor(), before = structuredClone(model);
  const filtered = researchViewModel({ ...model, researchSearch: 'lightning', researchFilter: 'locked' });
  assert.deepEqual(filtered.nodes.map(node => node.id), ['f35']);
  assert.deepEqual(model, before);
  model.view.catalog.platforms = [];
  assert.deepEqual(researchViewModel(model).nodes, []);
  assert.equal(researchViewModel(model).selected, null);
  assert.match(researchExperience(model), /No matching programmes/);
  assert.match(researchExperience(model), /No programme selected/);
  const foreign = researchViewModel({ ...model, showForeignResearch: true });
  assert.ok(foreign.nodes.length > 0 && foreign.nodes.every(node => !node.canResearch));
  assert.equal((researchExperience(model).match(/<option value=/g) || []).length, 8, 'All eight native mobile branch choices remain available');
});

test('role artwork keeps legacy branch fallback, uses specialist roles and leaves facility queues on industry art', () => {
  const helicopter = getPlatformsForNation('US').find(platform => platform.id === 'ah64-apache');
  const html = artwork(helicopter, 'test-art', false);
  assert.match(html, /art-aviation art-family-attack-helicopter/);
  assert.match(html, /aria-label="Representative attack helicopter artwork"/);
  assert.doesNotMatch(html, /Representative Representative/);
  const queue = queueCards([{ id: '44', facility: 'army-base', due: 7200 }], FACILITIES, 'Construction', 0);
  assert.match(queue, /art-industry art-family-industry/);
  assert.doesNotMatch(queue, /art-family-infantry/);
});
