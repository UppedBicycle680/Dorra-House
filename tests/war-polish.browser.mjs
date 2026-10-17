import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser-helpers.mjs';
import { campaignDatabase, campaignHarness } from './war-campaign-harness.mjs';
import { targetMapPoint } from './war-map-input.mjs';

const output = new URL('../work/', import.meta.url);
const nations = JSON.parse(await readFile(new URL('../assets/war/nations.json', import.meta.url), 'utf8')).nations;
const regions = JSON.parse(await readFile(new URL('../assets/war/provinces/FR.json', import.meta.url), 'utf8')).features;
const capitalId = nations.find(nation => nation.id === 'FR').capitalProvinceId;
const capital = regions.find(feature => feature.properties.id === capitalId).properties;
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function branch(h, id) {
  if (await h.page.locator('#researchBranch').isVisible()) await h.page.locator('#researchBranch').selectOption(id);
  else await h.press(`[data-action="branch"][data-id="${id}"]`);
}
async function filter(h, id) { await h.press(`[data-action="research-filter"][data-id="${id}"]`); }
async function layers(h) { if (!await h.page.locator('#mapLayersPanel').isVisible()) await h.press('#mapLayersButton'); }
async function start(h) {
  await h.page.locator('#nationSearch').fill('France'); await h.press('[data-action="nation"][data-id="FR"]');
  await h.page.locator('#opponentNation').selectOption('LU'); await h.page.locator('#matchName').fill('Map and arsenal verification');
  await h.press('[data-action="create"]'); await h.page.waitForSelector('[data-action="start"]');
  await h.press('[data-action="start"]'); await h.page.waitForSelector('[data-action="pause"]');
  await h.press('#commandNav [data-action="tab"][data-id="map"]');
}
async function capture(h, label, report) {
  const viewport = h.page.viewportSize(); await frame(h.page);
  const metrics = await h.page.evaluate(() => ({ scrollY, overflow: document.body.scrollWidth > innerWidth,
    header: document.querySelector('.command-header').getBoundingClientRect().toJSON(),
    nav: document.querySelector('#commandNav').getBoundingClientRect().toJSON(),
    navButtons: [...document.querySelectorAll('#commandNav button')].map(button => ({ label: button.textContent.trim(), ...button.getBoundingClientRect().toJSON() })),
    map: { ...document.querySelector('#worldCanvas').dataset },
    mapContainer: { ...document.querySelector('.world-map').getBoundingClientRect().toJSON(), scrollLeft: document.querySelector('.world-map').scrollLeft, scrollTop: document.querySelector('.world-map').scrollTop },
    legend: document.querySelector('#mapLegend').getBoundingClientRect().toJSON(),
    selection: document.querySelector('#selectionPanel').getBoundingClientRect().toJSON(),
    selectedName: document.querySelector('#selectionPanel h3')?.textContent,
    panes: [...document.querySelectorAll('[data-research-scroll]')].map(element => ({ id: element.dataset.researchScroll, top: element.scrollTop, height: element.clientHeight, scrollHeight: element.scrollHeight })) }));
  const file = new URL(`war-polish-after-${viewport.width}x${viewport.height}-${label}.png`, output);
  await h.page.screenshot({ path: fileURLToPath(file) }); report.push({ viewport, label, file: fileURLToPath(file), ...metrics });
  assert.equal(metrics.overflow, false, 'The command shell has no horizontal overflow');
  assert.equal(metrics.scrollY, 0, 'Pane navigation never scrolls the outer page');
  assert.equal(metrics.header.top, 0);
  for (const button of metrics.navButtons) assert.ok(button.height >= 44 && button.width >= 44 && button.top >= 0 && button.bottom <= viewport.height && button.left >= 0 && button.right <= viewport.width, `${button.label} remains a visible touch-sized navigation target`);
  assert.equal(metrics.mapContainer.scrollLeft, 0, 'Map controls do not scroll the map container horizontally');
  assert.equal(metrics.mapContainer.scrollTop, 0, 'Map controls do not scroll the map container vertically');
  if (metrics.legend.width) assert.ok(metrics.legend.left >= 0 && metrics.legend.right <= viewport.width, 'The map legend stays within the viewport');
  if (viewport.width <= 700) assert.ok(Math.abs(metrics.nav.bottom - viewport.height) <= 1);
}
async function selectOwn(h, id) {
  await h.press('[data-action="tab"][data-id="intelligence"]'); await h.press(`[data-action="select-unit"][data-id="${id}"]`); await frame(h.page);
}
async function selectVisiblePatrol(h) {
  const point = await targetMapPoint(h.page, capital, { zoomSteps: 8 });
  await frame(h.page);
  const names = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    const heading = h.page.locator('#selectionPanel h3'), name = await heading.count() ? await heading.textContent() : '(none)'; names.push(name);
    if (/Visible border patrol/.test(name)) return;
    if (h.page.viewportSize().width <= 700) await h.page.touchscreen.tap(point.x, point.y); else await h.page.mouse.click(point.x, point.y);
    await frame(h.page);
  }
  await h.page.screenshot({ path: fileURLToPath(new URL(`war-polish-debug-${h.page.viewportSize().width}-overlap.png`, output)) });
  assert.fail(`Repeated native taps must reach the visible foreign formation in an overlapping stack: ${JSON.stringify({ names, point })}`);
}
async function verifyMap(h, report) {
  const { page, state, db } = h, canvas = page.locator('#worldCanvas');
  await page.waitForFunction(() => Number(document.querySelector('#worldCanvas').dataset.mapArtReady) > 0);
  await capture(h, 'map-overview', report);
  const mutations = () => state.calls.filter(call => !['list', 'view', 'gold-wallet'].includes(call.action)).length;
  const before = mutations(); await layers(h);
  const button = await page.locator('#mapLayersButton').boundingBox(); assert.ok(button.width >= 44 && button.height >= 44);
  for (const mode of ['political', 'relations', 'terrain', 'morale']) {
    await page.locator(`[name="mapMode"][value="${mode}"]`).check(); await frame(page);
    assert.equal(await canvas.getAttribute('data-map-mode'), mode);
    assert.ok((await page.locator('#mapLegend').textContent()).trim().length > 0);
  }
  await page.locator('[name="mapMode"][value="political"]').check();
  await page.locator('#mapCities').setChecked(true); await page.locator('#mapRanges').setChecked(true); await page.locator('#mapRoutes').setChecked(true);
  await page.locator('#mapUnits').setChecked(false); await frame(page); assert.equal(Number(await canvas.getAttribute('data-map-marker-count')), 0);
  await page.locator('#mapUnits').setChecked(true); await frame(page); assert.ok(Number(await canvas.getAttribute('data-map-marker-count')) > 0);
  assert.equal(mutations(), before, 'Map presentation controls send no gameplay mutations');
  await h.press('#mapLayersButton');
  const infantry = state.view.units.find(unit => unit.nationId === 'FR' && unit.platformId === 'infantry-company');
  const engineers = state.view.units.find(unit => unit.nationId === 'FR' && unit.platformId === 'combat-engineers');
  await selectOwn(h, engineers.id);
  await capture(h, 'map-selected-specialist', report);
  await selectOwn(h, infantry.id);
  await page.waitForFunction(() => Number(document.querySelector('#worldCanvas').dataset.mapArtReady) === 2);
  assert.ok(Number(await canvas.getAttribute('data-map-range-count')) > 0);
  await capture(h, 'map-selected-role', report);

  // Isolated local visibility fixtures: the real projection must expose only
  // the contact in owned territory, never the distant reserve at the LU capital.
  const visibleId = randomUUID(), hiddenId = randomUUID(), enemyCapital = nations.find(nation => nation.id === 'LU').capitalProvinceId;
  await db.query("insert into dorra_private.war_units(id,match_id,nation_id,province_id,platform_id,name,domain,strength,health,max_health) values($1,$2,'LU',$3,'infantry-company','Visible border patrol','land',1,100,100),($4,$2,'LU',$5,'infantry-company','Hidden reserve','land',1,100,100)", [visibleId, state.view.match.id, capitalId, hiddenId, enemyCapital]);
  await db.query('update dorra_private.war_matches set revision=revision+1 where id=$1', [state.view.match.id]);
  await h.refresh();
  assert.ok(state.view.units.some(unit => unit.id === visibleId));
  assert.equal(state.view.units.some(unit => unit.id === hiddenId), false);
  await selectVisiblePatrol(h);
  assert.equal(Number(await canvas.getAttribute('data-map-range-count')), 0, 'Foreign selections never expose weapon-range overlays');
  assert.equal(Number(await canvas.getAttribute('data-map-route-count')), 0, 'Foreign selections never expose route overlays');
  await capture(h, 'map-overlap-foreign', report);
  await selectOwn(h, infantry.id);
  const neighbor = (capital.neighbors || []).map(id => regions.find(feature => feature.properties.id === id)?.properties).find(properties => properties && state.view.provinces.some(province => province.id === properties.id && province.ownerId === 'FR'));
  assert.ok(neighbor, 'The source capital has a real owned neighboring province');
  await h.press('[data-action="order-type"][data-id="move"]'); await targetMapPoint(page, neighbor, { zoomSteps: 8 });
  await h.press('[data-action="confirm-order"]'); await page.waitForFunction(() => !document.querySelector('[data-action="confirm-order"]')); await frame(page);
  assert.ok(Number(await canvas.getAttribute('data-map-route-count')) > 0, 'A real accepted own movement order displays its actual route');
  await canvas.focus(); await page.keyboard.press('h'); await layers(h); await h.press('#mapFocusSelection'); await frame(page);
  await capture(h, 'map-own-route', report);
  await selectVisiblePatrol(h);
  assert.equal(Number(await canvas.getAttribute('data-map-range-count')), 0);
  assert.equal(Number(await canvas.getAttribute('data-map-route-count')), 0);
}
async function verifyResearch(h, report) {
  const { page, state } = h;
  await h.press('[data-action="tab"][data-id="research"]');
  assert.equal(await page.locator('#mapLayersPanel').isVisible(), false);
  assert.equal(await page.locator('#researchBranch option').count(), 8);
  for (const id of ['infantry', 'armor', 'artillery-air-defense', 'aviation', 'naval', 'missiles', 'intelligence-support', 'industry']) {
    await branch(h, id); assert.equal(await page.locator(`[data-action="branch"][data-id="${id}"]`).getAttribute('aria-pressed'), 'true');
  }
  await filter(h, 'available');
  assert.ok(await page.locator('.research-node').count() > 0);
  assert.equal(await page.locator('.research-node:not(.state-available)').count(), 0);
  await h.press('[data-action="research"][data-id="combined-arms-doctrine"]');
  await filter(h, 'researching'); assert.equal(await page.locator('.research-node.state-researching').count(), 1);
  await filter(h, 'locked'); assert.ok(await page.locator('[data-node-id="networked-command"]').count() > 0);
  assert.equal(await page.locator('.research-node:not(.state-locked)').count(), 0);
  await filter(h, 'all'); await branch(h, 'armor'); await filter(h, 'complete');
  assert.equal(await page.locator('.research-node:not(.state-complete)').count(), 0);
  await h.press('[data-node-id="leclerc"] .research-select');
  assert.match(await page.locator('.research-outcome').textContent(), /unlock persists|researched for your national arsenal/i);
  assert.match(await page.locator('.research-outcome').textContent(), /facility|Army base/i);
  assert.equal(await page.locator('.research-decision [data-action="research-start"]').count(), 0, 'Completed starter equipment is not offered for research again');
  await capture(h, 'research-completed-dossier', report);
  await h.press('.research-path .programme-link[data-id="combined-arms-doctrine"]');
  assert.match(await page.locator('.research-inspector h3').textContent(), /Combined arms doctrine/i);
  assert.equal(await page.locator('[data-action="research-filter"][data-id="all"]').getAttribute('aria-pressed'), 'true', 'Dependency navigation clears a filter that would hide the linked programme');
  await branch(h, 'intelligence-support'); await h.press('[data-node-id="field-observers"] .research-select');
  const begin = page.locator('.research-decision [data-action="research-start"]'); assert.equal(await begin.isDisabled(), false);
  if (page.viewportSize().width <= 700) {
    const action = await begin.boundingBox(), nav = await page.locator('#commandNav').boundingBox();
    assert.ok(action.y >= 0 && action.y + action.height <= nav.y, 'The phone dossier exposes its ready action without an initial scroll');
  }
  await capture(h, 'research-ready-dossier', report);
  await h.press('.research-decision [data-action="research-start"]'); assert.equal(state.view.player.researchQueue.length, 2);
  await filter(h, 'complete'); assert.ok(await page.locator('.research-node.state-complete').count() > 0);
  await filter(h, 'all');

  if (page.viewportSize().width > 700) {
    await branch(h, 'infantry');
    if (await page.locator('[data-action="research-foreign"]').getAttribute('aria-pressed') !== 'true') await h.press('[data-action="research-foreign"]');
    const tree = page.locator('[data-research-scroll="tree"]'), dossier = page.locator('[data-research-scroll="dossier"]');
    await tree.evaluate(element => element.scrollTop = 0); await dossier.evaluate(element => element.scrollTop = 0);
    const region = await tree.boundingBox(); await page.mouse.move(region.x + region.width / 2, region.y + region.height / 2); await page.mouse.wheel(0, 600); await frame(page);
    assert.ok(await tree.evaluate(element => element.scrollTop > 0));
    assert.equal(await dossier.evaluate(element => element.scrollTop), 0, 'Scrolling the tree leaves its sibling dossier at the same position');
    const bounds = await page.locator('#commandDrawer').boundingBox();
    for (const button of await page.locator('.research-branches [data-action="branch"]').all()) {
      const box = await button.boundingBox(); assert.ok(box.y >= bounds.y && box.y + box.height <= bounds.y + bounds.height, 'All eight desktop branches remain visible while the tree scrolls');
    }
    await capture(h, 'research-independent-scroll', report);
  }
  await filter(h, 'all'); await branch(h, 'armor'); await h.press('[data-node-id="leclerc"] .research-select');
  const produced = state.calls.filter(call => call.action === 'produce').length;
  await h.press('[data-action="research-mobilise"][data-id="leclerc"]');
  assert.equal(await page.locator('#commandDrawer').getAttribute('data-section'), 'industry');
  if (await page.locator('#provinceSearch').count()) {
    await page.locator('#provinceSearch').fill(capitalId); await h.press(`[data-action="province"][data-id="${capitalId}"]`);
  }
  const leclerc = page.locator('[data-action="produce"][data-id="leclerc"]');
  assert.equal(await leclerc.count(), 1); assert.equal(await leclerc.isDisabled(), true, 'Mobilisation still requires the real Army base tier');
  assert.equal(state.calls.filter(call => call.action === 'produce').length, produced, 'Viewing mobilisation never automatically produces equipment');
  await capture(h, 'research-mobilisation-handoff', report);
}

test('map layers, overlapping formations and research decisions work on desktop and phones', { timeout: 360000 }, async t => {
  await mkdir(output, { recursive: true }); const db = await campaignDatabase(), browser = await launchBrowser(), report = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }].filter(viewport => !process.env.DORRA_POLISH_WIDTH || viewport.width === Number(process.env.DORRA_POLISH_WIDTH))) {
      await t.test(`${viewport.width}px map and arsenal controls with real filtered SQL views`, async () => {
        const h = await campaignHarness(browser, db, viewport);
        h.page.setDefaultTimeout(10000);
        try {
          await start(h); await verifyMap(h, report); await verifyResearch(h, report);
          const resize = viewport.width === 1440 ? { width: 1024, height: 768 } : viewport.width === 390 ? { width: 844, height: 390 } : null;
          if (resize) {
            await h.page.setViewportSize(resize); await h.press('[data-action="tab"][data-id="research"]'); await branch(h, 'armor'); await h.press('[data-node-id="leclerc"] .research-select');
            const pane = h.page.locator('[data-research-scroll="dossier"]'); assert.ok(await pane.evaluate(element => element.clientHeight) >= (resize.height > 600 ? 280 : 150), 'The landscape dossier leaves room for a meaningful decision, not a one-button-height sliver');
            await h.page.locator('[data-action="research-mobilise"][data-id="leclerc"]').scrollIntoViewIfNeeded();
            const paneBounds = await pane.boundingBox(), actionBounds = await h.page.locator('[data-action="research-mobilise"][data-id="leclerc"]').boundingBox();
            assert.ok(actionBounds.height >= 44 && actionBounds.y >= paneBounds.y && actionBounds.y + actionBounds.height <= paneBounds.y + paneBounds.height, 'The complete mobilisation action is reachable wholly inside its dossier pane');
            await capture(h, 'research-resized', report);
          }
          assert.deepEqual(h.pageErrors, []); assert.deepEqual(h.state.errors, []);
        } catch (error) {
          console.error(JSON.stringify({ viewport, sqlErrors: h.state.errors, lastCalls: h.state.calls.slice(-3).map(({ action, args }) => ({ action, args })), panel: await h.page.locator('#selectionPanel').textContent().catch(() => '') }));
          throw error;
        } finally { await h.context.close(); }
      });
    }
  } finally { await browser.close(); await db.close(); await writeFile(new URL('war-polish-after-report.json', output), JSON.stringify(report, null, 2)); }
});
