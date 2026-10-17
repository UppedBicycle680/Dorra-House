import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchBrowser } from './browser-helpers.mjs';
import { campaignDatabase, campaignHarness } from './war-campaign-harness.mjs';
import { targetMapPoint } from './war-map-input.mjs';

const directory = JSON.parse(await readFile(new URL('../assets/war/nations.json', import.meta.url), 'utf8')).nations;
const profile = id => directory.find(nation => nation.id === id);
async function province(id, nation) {
  for (const region of profile(nation).regionIds) {
    const collection = JSON.parse(await readFile(new URL(`../assets/war/provinces/${region}.json`, import.meta.url), 'utf8'));
    const found = collection.features.find(feature => feature.properties.id === id);
    if (found) return found.properties;
  }
  throw Error('Missing public province ' + id);
}
async function selectProvince(h, id) {
  await h.press('[data-action="tab"][data-id="industry"]');
  if (await h.page.locator('[data-action="province-picker"]').count()) await h.press('[data-action="province-picker"]');
  await h.page.locator('#provinceSearch').fill(id);
  await h.press(`[data-action="province"][data-id="${id}"]`);
}

async function selectResearchBranch(h, id) { const picker = h.page.locator('#researchBranch'); if (await picker.isVisible()) await picker.selectOption(id); else await h.press('[data-action="branch"][data-id="' + id + '"]'); }

test('desktop and native-touch solo campaigns complete through real gateway, PostgreSQL combat, victory and reward', { timeout: 240000 }, async t => {
  const db = await campaignDatabase(), browser = await launchBrowser();
  try {
    for (const run of [{ nation: 'FR', viewport: { width: 1440, height: 900 }, label: 'desktop', reserve: true }, { nation: 'BE', viewport: { width: 320, height: 740 }, label: 'touch-320', reserve: false }]) await t.test(run.label, async () => {
      const h = await campaignHarness(browser, db, run.viewport), { page, state } = h;
      const capital = profile(run.nation).capitalProvinceId, enemyCapital = profile('LU').capitalProvinceId;
      const target = await province(enemyCapital, 'LU');
      try {
        await page.locator('#nationSearch').fill(profile(run.nation).name);
        await h.press(`[data-action="nation"][data-id="${run.nation}"]`);
        await page.locator('#opponentNation').selectOption('LU'); await page.locator('#aiDifficulty').selectOption('recruit');
        await page.locator('#matchName').fill('Local full campaign ' + run.label);
        await h.press('[data-action="create"]'); await page.waitForSelector('[data-action="start"]');
        assert.equal(state.view.player.nationId, run.nation);
        assert.equal(state.view.match.aiDifficulty, 'recruit');
        await h.press('[data-action="start"]'); await page.waitForSelector('[data-action="pause"]');

        await h.press('[data-action="tab"][data-id="research"]'); await selectResearchBranch(h, 'industry');
        await h.press('[data-action="research"][data-id="combined-arms-doctrine"]');
        await page.waitForFunction(() => document.querySelectorAll('.queue-card').length > 0);
        if (run.nation === 'FR') {
          await h.press('[data-action="tab"][data-id="industry"]');
          assert.equal(await page.locator('.province-list button').count(), 30);
          await h.press('[data-action="province-page"][data-id="1"]');
          assert.match(await page.locator('.province-pages>span').textContent(), /Page 2 of/);
          await page.locator('#provinceSearch').fill('no-such-owned-province');
          assert.equal(await page.locator('.province-list button').count(), 0);
          await page.locator('#provinceSearch').fill(capital);
          assert.equal(await page.locator('.province-list button').count(), 1, 'Search reaches the real French capital beyond the former first sixty rows');
        }
        await selectProvince(h, capital);
        assert.equal(await page.locator('.province-command-title h3').textContent(), (await province(capital, run.nation)).name);
        await h.press('[data-action="build"][data-id="army-base"]');
        await h.press('[data-action="produce"][data-id="infantry-company"]');
        await h.press('[data-action="tab"][data-id="diplomacy"]');
        await h.press('[data-action="diplomacy"][data-nation="LU"][data-id="peace"]'); await h.press('#dialogConfirm');
        await page.waitForSelector('.pending-diplomacy');
        await h.advance(86400);
        assert.ok(state.view.player.research.includes('combined-arms-doctrine'));
        assert.equal(state.view.provinces.find(province => province.id === capital).facilities['army-base'], 2);
        assert.ok(state.view.units.filter(unit => unit.nationId === run.nation).length >= 3, 'Paid production creates an additional real formation');
        assert.equal(state.view.diplomacy.find(row => row.nationId === 'LU').relation, 'war');

        if (run.nation === 'FR') {
          // Develop and pay for actual national fire support and armour rather
          // than sending an unsupported baseline assault into the capital.
          await selectProvince(h, capital); await h.press('[data-action="build"][data-id="army-base"]');
          await h.press('[data-action="tab"][data-id="research"]'); await selectResearchBranch(h, 'artillery-air-defense');
          await h.press('[data-action="research"][data-id="caesar"]'); await h.advance(6 * 3600);
          await selectProvince(h, capital); await h.press('[data-action="produce"][data-id="caesar"]');
          await h.advance(15 * 3600);
          if (!state.view.player.research.includes('leclerc')) {
            await h.press('[data-action="tab"][data-id="research"]'); await selectResearchBranch(h, 'armor');
            await h.press('[data-action="research"][data-id="leclerc"]'); await h.advance(6 * 3600);
          }
          await selectProvince(h, capital); await h.press('[data-action="produce"][data-id="leclerc"]'); await h.advance(4 * 3600);
          assert.ok(state.view.units.some(unit => unit.platformId === 'caesar') && state.view.units.some(unit => unit.platformId === 'leclerc'));
        }

        const formations = state.view.units.filter(unit => unit.nationId === run.nation && unit.domain === 'land' && !unit.order?.type && (!run.reserve || unit.platformId !== 'combat-engineers'));
        for (const unit of formations) {
          await h.press('[data-action="tab"][data-id="intelligence"]'); await h.press(`[data-action="select-unit"][data-id="${unit.id}"]`);
          await h.press('[data-action="order-type"][data-id="attack"]');
          await targetMapPoint(page, target);
          await page.waitForSelector('[data-action="confirm-order"]');
          assert.equal(await page.locator('[data-action="confirm-order"]').isDisabled(), false);
          await h.press('[data-action="confirm-order"]'); await page.waitForFunction(() => !document.querySelector('[data-action="confirm-order"]'));
          assert.equal(state.calls.filter(call => call.action === 'order').at(-1).args.targetProvinceId, enemyCapital);
        }
        for (let turn = 0; turn < 130 && state.view.match.status !== 'finished'; turn++) await h.advance(21600);
        assert.equal(state.view.match.status, 'finished', 'Ordinary combat, capital occupation or the normal deadline must finish the campaign');
        assert.ok(state.view.match.gameTime <= 30 * 86400 + 3600, 'The campaign respects its production deadline; the harness never sets a winner');
        assert.ok([run.nation, 'LU'].includes(state.view.victory.winner));
        const reportKinds = (await db.query("select body->>'type' kind,count(*)::int count from dorra_private.war_reports where match_id=$1 group by body->>'type'", [state.view.match.id])).rows;
        for (const kind of ['arrival', 'combat', 'research-complete']) assert.ok(reportKinds.some(row => row.kind === kind && row.count > 0), `The completed campaign must actually execute ${kind} events`);
        if (state.view.victory.won && state.view.match.gameTime < 30 * 86400) assert.equal(state.view.provinces.find(province => province.id === enemyCapital).ownerId, run.nation);
        if (state.view.match.gameTime === 30 * 86400) assert.equal([...state.view.nations].sort((a, b) => b.score - a.score)[0].id, state.view.victory.winner, 'The normal deadline selects the actual victory-point leader');
        await page.waitForSelector('[data-action="reward"]');
        assert.equal(await page.locator('[data-action="reward"]').isDisabled(), false);
        await h.press('[data-action="reward"]');
        await page.waitForFunction(() => document.querySelector('[data-action="reward"]')?.textContent.includes('settled'));
        const savedBalance = async () => Number((await db.query("select snapshot->>'balance' balance from dorra_private.player_state where user_id=$1", [state.userId])).rows[0].balance);
        const expectedBalance = state.view.victory.won ? 2000 : 1250;
        assert.equal(await savedBalance(), expectedBalance, 'Only the actual finished-match reward changes the House wallet');
        await page.reload(); await page.waitForSelector('#commandNav:not([hidden])');
        await h.press('[data-action="tab"][data-id="operation"]');
        assert.match(await page.locator('[data-action="reward"]').textContent(), /Rewards settled/);
        assert.equal(await page.locator('[data-action="reward"]').isDisabled(), true);
        assert.equal(await savedBalance(), expectedBalance, 'Reloading a completed campaign cannot settle its reward twice');
        assert.equal(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: path.join(os.tmpdir(), `dorra-war-campaign-${run.label}.png`) });
        assert.deepEqual(h.pageErrors, []); assert.deepEqual(state.errors, []);
        assert.ok(state.projections > 10, 'The playthrough uses the real filtered projection/delta transport throughout');
        t.diagnostic(`${run.label}: winner ${state.view.victory.winner}, ${state.view.match.gameTime.toFixed(0)} game seconds, ${state.calls.length} gateway requests, ${state.clockAdvances.length} explicit local clock advances`);
      } catch (error) {
        await page.screenshot({ path: path.join(os.tmpdir(), `dorra-war-campaign-${run.label}-failure.png`) });
        t.diagnostic(JSON.stringify({ label: run.label, match: state.view?.match, errors: state.errors, calls: state.calls.slice(-4).map(call => ({ action: call.action, args: call.args })) }));
        throw error;
      } finally { await h.context.close(); }
    });
  } finally { await browser.close(); await db.close(); }
});
