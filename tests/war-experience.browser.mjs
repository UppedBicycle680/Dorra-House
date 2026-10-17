import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser-helpers.mjs';
import { campaignDatabase, campaignHarness } from './war-campaign-harness.mjs';

const output = new URL('../work/', import.meta.url);
const nations = JSON.parse(await readFile(new URL('../assets/war/nations.json', import.meta.url), 'utf8')).nations;
const capital = nations.find(nation => nation.id === 'FR').capitalProvinceId;
const actionResponse = (page, action) => page.waitForResponse(response => response.url().endsWith('/dorra-war') && response.request().postDataJSON()?.action === action);

async function branch(h, id) {
  const picker = h.page.locator('#researchBranch');
  if (await picker.isVisible()) await picker.selectOption(id);
  else await h.press(`[data-action="branch"][data-id="${id}"]`);
}

async function scrollDrawerTo(h, selector) {
  await h.page.locator(selector).evaluate(element => {
    const surface = element.closest('.drawer-body');
    const sticky = innerWidth <= 700 ? surface.querySelector('.mobile-research-branch-picker')?.getBoundingClientRect().height || 0 : 0;
    surface.scrollTop += element.getBoundingClientRect().top - surface.getBoundingClientRect().top - sticky;
  });
}

async function start(h) {
  const { page } = h;
  await page.locator('#nationSearch').fill('France');
  await h.press('[data-action="nation"][data-id="FR"]');
  await page.locator('#opponentNation').selectOption('LU');
  await page.locator('#matchName').fill('Command experience verification');
  await h.press('[data-action="create"]');
  await page.waitForSelector('[data-action="start"]');
  await h.press('[data-action="start"]');
  await page.waitForSelector('[data-action="pause"]');
}

async function chooseCapital(h) {
  await h.press('[data-action="tab"][data-id="industry"]');
  const picker = h.page.locator('[data-action="province-picker"]');
  if (await picker.count()) await h.press('[data-action="province-picker"]');
  await h.page.locator('#provinceSearch').fill(capital);
  await h.press(`[data-action="province"][data-id="${capital}"]`);
}

async function closeWalletFromHeaderAndReopen(h) {
  const dismiss = h.page.locator('#dialogDismiss'), bounds = await dismiss.boundingBox(), viewport = h.page.viewportSize();
  assert.equal(await dismiss.getAttribute('aria-label'), 'Dismiss dialog');
  assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, 'The wallet header close control has a touch-sized target');
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height, 'The header close control is visible without scrolling');
  await h.press('#dialogDismiss');
  await h.page.waitForSelector('#commandDialog:not([open])', { state: 'attached' });
  await h.press('[data-action="gold-wallet"]');
  await h.page.waitForFunction(() => document.querySelector('#commandDialog').open && document.querySelector('#dialogTitle').textContent === 'Your Gold wallet');
  assert.equal(await h.page.locator('#commandDialog').evaluate(element => element.scrollTop), 0, 'Reopened wallets still start at their title and balance');
}

async function snapshot(h, viewport, label, report) {
  await h.page.evaluate(() => document.fonts.ready);
  const artwork = await h.page.evaluate(async () => {
    const elements = [...document.querySelectorAll('#commandDrawer .unit-art,#selectionPanel .unit-art')];
    const urls = [...new Set(elements.flatMap(element => [...getComputedStyle(element, '::before').backgroundImage.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)/g)].map(match => match[1] || match[2] || match[3])))];
    return { count: elements.length, urls, loaded: await Promise.all(urls.map(url => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image.naturalWidth > 0); image.onerror = () => resolve(false); image.src = url; }))) };
  });
  assert.ok(artwork.count > 0 && artwork.urls.length > 0, 'Representative artwork is present in the rendered panels');
  assert.ok(artwork.loaded.every(Boolean), 'Representative CSS atlas artwork must load');
  const file = new URL(`war-ui-after-${viewport.width}-${label}.png`, output);
  await h.page.screenshot({ path: fileURLToPath(file), fullPage: false });
  const metrics = await h.page.evaluate(() => ({
    overflow: document.body.scrollWidth > innerWidth,
    pageScrollY: scrollY,
    header: document.querySelector('.command-header')?.getBoundingClientRect().toJSON(),
    nav: document.querySelector('#commandNav')?.getBoundingClientRect().toJSON(),
    drawer: document.querySelector('#commandDrawer')?.getBoundingClientRect().toJSON(),
    selection: document.querySelector('#selectionPanel')?.getBoundingClientRect().toJSON(),
    smallControls: [...document.querySelectorAll('#commandDrawer button,#selectionPanel button')].filter(button => {
      const rect = button.getBoundingClientRect();
      return !button.disabled && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight && (rect.height < 44 || rect.width < 44);
    }).map(button => ({ text: button.textContent.trim(), height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width }))
  }));
  report.push({ viewport, label, file: fileURLToPath(file), ...metrics });
  assert.equal(metrics.overflow, false, 'The page must not overflow horizontally');
  assert.equal(metrics.pageScrollY, 0, 'Panel navigation must scroll its own surface without moving the game page');
  assert.equal(metrics.header.top, 0, 'The command header remains at the top of the viewport');
  if (viewport.width <= 700) assert.ok(Math.abs(metrics.nav.bottom - viewport.height) <= 1, 'The mobile command navigation remains attached to the viewport bottom');
}

test('research, mobilisation, unit dossiers and Gold remain usable on desktop and narrow phones', { timeout: 240000 }, async t => {
  await mkdir(output, { recursive: true });
  const db = await campaignDatabase(), browser = await launchBrowser(), report = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await t.test(`${viewport.width}px command experience with actual SQL queues`, async () => {
        const h = await campaignHarness(browser, db, viewport), { page, state } = h;
        try {
          // Isolated local account fixture; product accounts are never credited.
          await db.query('insert into dorra_private.war_gold_accounts(user_id,balance,version) values($1,500,1) on conflict(user_id) do update set balance=excluded.balance,version=excluded.version', [state.userId]);
          await start(h);
          assert.match(await page.title(), /Strategic Command/);
          await h.press('[data-action="tab"][data-id="research"]');
          assert.equal(await page.locator('.research-branches [data-action="branch"]').count(), 8);
          for (const branchId of await page.locator('.research-branches [data-action="branch"]').evaluateAll(buttons => buttons.map(button => button.dataset.id))) {
            await branch(h, branchId);
            assert.equal(await page.locator(`[data-action="branch"][data-id="${branchId}"]`).getAttribute('aria-pressed'), 'true');
          }
          await branch(h, 'industry');
          await h.press('[data-action="research"][data-id="combined-arms-doctrine"]');
          assert.equal(state.view.player.researchQueue.length, 1);
          assert.match(await page.locator('.research-slot-count').textContent(), /1\s*\/ 2/);
          assert.equal(await page.locator('[data-action="research"][data-id="combined-arms-doctrine"]').isDisabled(), true);
          await branch(h, 'armor');
          const dependency = page.locator('[data-node-id="leclerc"] .node-dependencies [data-id="combined-arms-doctrine"]');
          assert.equal(await dependency.count(), 1, 'A genuine cross-branch prerequisite is navigable');
          await h.press('[data-node-id="leclerc"] .node-dependencies [data-id="combined-arms-doctrine"]');
          assert.equal(await page.locator('[data-action="branch"][data-id="industry"]').getAttribute('aria-pressed'), 'true');
          assert.match(await page.locator('.research-inspector h3').textContent(), /Combined Arms/i);
          await branch(h, 'armor');
          await snapshot(h, viewport, 'research', report);
          await scrollDrawerTo(h, '[data-research-board]');
          await snapshot(h, viewport, 'research-tree', report);
          await h.press('[data-node-id="leclerc"] .research-select');
          if (viewport.width > 700) await scrollDrawerTo(h, '.research-inspector');
          await snapshot(h, viewport, 'research-dossier', report);
          await scrollDrawerTo(h, '.research-requirements');
          await snapshot(h, viewport, 'research-requirements', report);
          if (viewport.width <= 700) {
            await h.press('[data-action="research-tree"]');
            const tree = await page.locator('[data-node-id="leclerc"] .research-select').boundingBox();
            assert.ok(tree.y >= 0 && tree.y < viewport.height - 64, 'Back to tree reveals the selected programme within the viewport');
          }

          await chooseCapital(h);
          const leclercCard = page.locator('.arsenal-card').filter({ has: page.locator('[data-action="produce"][data-id="leclerc"]') });
          assert.match(await leclercCard.textContent(), /Facility required/);
          assert.equal(await leclercCard.locator('[data-action="produce"]').isDisabled(), true);
          await h.press('[data-action="build"][data-id="army-base"]');
          await h.press('[data-action="produce"][data-id="infantry-company"]');
          assert.equal(state.view.player.buildQueue.length, 1);
          assert.equal(state.view.player.productionQueue.length, 1);
          assert.equal(await page.locator('[data-action="build"][data-id="army-base"]').textContent(), 'Constructing');
          assert.equal(await page.locator('[data-action="build"][data-id="air-base"]').textContent(), 'Queue occupied');
          await page.locator('.drawer-body').evaluate(element => element.scrollTop = 0);
          await snapshot(h, viewport, 'industry', report);
          await page.locator('[data-action="produce"][data-id="infantry-company"]').scrollIntoViewIfNeeded();
          await snapshot(h, viewport, 'production', report);

          await h.press('[data-action="tab"][data-id="intelligence"]');
          const infantry = state.view.units.find(unit => unit.nationId === 'FR' && unit.platformId === 'infantry-company');
          await h.press(`[data-action="select-unit"][data-id="${infantry.id}"]`);
          await snapshot(h, viewport, 'unit', report);
          await h.press('#formationDetails summary');
          await snapshot(h, viewport, 'unit-details', report);
          assert.equal(await page.locator('.formation-details-body').evaluate(element => getComputedStyle(element).maxHeight), 'none', 'Dossier content uses the panel scroll rather than a nested scroll trap');
          await page.locator('.formation-stat-grid').scrollIntoViewIfNeeded();
          assert.ok(await page.locator('.formation-stat-grid dt').count() >= 6);
          await h.press('#selectionPanel [data-action="equipment-details"]');
          await page.waitForSelector('#commandDialog[open]');
          assert.equal(await page.locator('#commandDialog').evaluate(element => element.scrollTop), 0, 'Long unit dossiers open at their title');
          assert.match(await page.locator('#dialogTitle').textContent(), /Infantry company/i);
          await snapshot(h, viewport, 'unit-dossier', report);
          await h.press('#dialogCancel');
          assert.deepEqual(h.pageErrors, []);
          assert.deepEqual(state.errors, []);

          if (viewport.width === 1440) {
            await h.press('[data-action="tab"][data-id="research"]');
            await branch(h, 'intelligence-support');
            await h.press('[data-action="research"][data-id="field-observers"]');
            assert.equal(state.view.player.researchQueue.length, 2);
            assert.match(await page.locator('.research-slot-count').textContent(), /2\s*\/ 2/);
            assert.equal(await page.locator('[data-action="research"][data-id="logistics-column"]').isDisabled(), true, 'Both real research slots are occupied');
            const due = state.view.player.researchQueue.find(item => item.platformId === 'field-observers').due;
            await h.advance(Number(due) - state.view.match.gameTime + 1);
            assert.equal(state.view.player.research.includes('field-observers'), true);
            assert.ok(state.view.player.researchQueue.length < 2);
            assert.equal(await page.locator('[data-action="research"][data-id="logistics-column"]').isDisabled(), false, 'A real completed programme releases its research slot');
            assert.deepEqual(state.errors, []);
          }

          if (viewport.width === 390) {
            await chooseCapital(h);
            const queueId = state.view.player.productionQueue[0].id;
            assert.equal(typeof queueId, 'string');
            let response = actionResponse(page, 'boost-quote');
            await h.press(`[data-action="boost-quote"][data-id="${queueId}"]`);
            const quote = (await (await response).json()).result.quote;
            await page.waitForSelector('#commandDialog[open]');
            assert.match(await page.locator('#dialogBody').textContent(), new RegExp(`${quote.goldCost} Gold`));
            assert.match(await page.locator('#dialogBody').textContent(), /Infantry/i);
            const beforeCancel = state.calls.filter(call => call.action === 'boost').length;
            await page.keyboard.press('Escape');
            assert.equal(state.calls.filter(call => call.action === 'boost').length, beforeCancel);
            response = actionResponse(page, 'boost-quote');
            await h.press(`[data-action="boost-quote"][data-id="${queueId}"]`);
            const confirmedQuote = (await (await response).json()).result.quote;
            await page.waitForSelector('#dialogConfirm');
            await snapshot(h, viewport, 'gold-confirm', report);
            response = actionResponse(page, 'boost');
            await h.press('#dialogConfirm');
            const spent = await (await response).json();
            assert.equal(spent.result.goldSpent, confirmedQuote.goldCost);
            assert.equal(spent.gold.balance, 500 - confirmedQuote.goldCost);
            assert.equal(state.view.player.productionQueue.some(item => item.id === queueId), false);
            assert.equal(state.calls.filter(call => call.action === 'boost').length, beforeCancel + 1);
            await page.waitForSelector('#commandDialog:not([open])', { state: 'attached' });

            const buildId = state.view.player.buildQueue[0].id;
            response = actionResponse(page, 'boost-quote');
            await h.press(`[data-action="boost-quote"][data-id="${buildId}"]`);
            const buildQuote = (await (await response).json()).result.quote;
            assert.equal(buildQuote.kind, 'build');
            await page.waitForSelector('#dialogConfirm');
            response = actionResponse(page, 'boost');
            await h.press('#dialogConfirm');
            const built = await (await response).json();
            assert.equal(built.result.goldSpent, buildQuote.goldCost);
            assert.equal(state.view.provinces.find(province => province.id === capital).facilities['army-base'], 2);
            assert.equal(state.view.player.buildQueue.length, 0);
            await page.waitForSelector('#commandDialog:not([open])', { state: 'attached' });

            // A real completion during the one-minute dialog cannot charge Gold.
            const researchQueue = state.view.player.researchQueue[0];
            await h.press('[data-action="tab"][data-id="research"]');
            response = actionResponse(page, 'boost-quote');
            await h.press(`[data-action="boost-quote"][data-id="${researchQueue.id}"]`);
            await response;
            await page.waitForSelector('#dialogConfirm');
            await h.advance(Math.max(1, Number(researchQueue.due) - state.view.match.gameTime + 1));
            const beforeRace = (await db.query('select balance from dorra_private.war_gold_accounts where user_id=$1', [state.userId])).rows[0].balance;
            response = actionResponse(page, 'boost');
            await h.press('#dialogConfirm');
            const rejected = await response;
            assert.ok(rejected.status() >= 400);
            await page.waitForSelector('#boostDialogError:not([hidden])');
            assert.match(await page.locator('#boostDialogError').textContent(), /not accepted/);
            assert.equal(await page.locator('#dialogConfirm').isDisabled(), true, 'A rejected quote requires fresh review before another confirmation');
            assert.equal((await db.query('select balance from dorra_private.war_gold_accounts where user_id=$1', [state.userId])).rows[0].balance, beforeRace);
            assert.equal(state.view.player.researchQueue.some(item => item.id === researchQueue.id), false);
            await snapshot(h, viewport, 'gold-stale', report);
            await h.press('#dialogCancel');
            await branch(h, 'intelligence-support');
            await h.press('[data-action="research"][data-id="field-observers"]');
            const programmeId = state.view.player.researchQueue.find(item => item.platformId === 'field-observers').id;
            response = actionResponse(page, 'boost-quote');
            await h.press(`[data-action="boost-quote"][data-id="${programmeId}"]`);
            const researchQuote = (await (await response).json()).result.quote;
            assert.equal(researchQuote.kind, 'research');
            await page.waitForSelector('#dialogConfirm');
            response = actionResponse(page, 'boost');
            await h.press('#dialogConfirm');
            const researched = await (await response).json();
            assert.equal(researched.result.goldSpent, researchQuote.goldCost);
            assert.equal(state.view.player.research.includes('field-observers'), true);
            assert.match(await page.locator('[data-action="research"][data-id="field-observers"]').textContent(), /Unlocked/);
            await page.waitForSelector('#commandDialog:not([open])', { state: 'attached' });
            await h.press('[data-action="gold-wallet"]');
            await page.waitForFunction(() => document.querySelector('#commandDialog').open && document.querySelector('#dialogTitle').textContent === 'Your Gold wallet');
            assert.equal(await page.locator('#commandDialog').evaluate(element => element.scrollTop), 0, 'Gold wallets open at their title and balance');
            await closeWalletFromHeaderAndReopen(h);
            assert.match(await page.locator('#dialogBody').textContent(), /cannot be purchased/);
            assert.match(await page.locator('#dialogBody').textContent(), /Recent activity/);
            await snapshot(h, viewport, 'gold-wallet', report);
            await h.press('#dialogCancel');
            assert.deepEqual(h.pageErrors, []);
            assert.equal(state.errors.length, 1, 'Only the intentionally completed-job rejection is expected');
          }
          if (viewport.width === 320) {
            await chooseCapital(h);
            const queueId = state.view.player.productionQueue[0].id;
            let response = actionResponse(page, 'boost-quote');
            await h.press(`[data-action="boost-quote"][data-id="${queueId}"]`);
            await response;
            await page.waitForSelector('#dialogConfirm');
            await snapshot(h, viewport, 'gold-confirm', report);
            assert.equal(await page.locator('#commandDialog').evaluate(element => element.getBoundingClientRect().right <= innerWidth), true);
            await h.press('#dialogCancel');
            await db.query('update dorra_private.war_gold_accounts set balance=0,version=version+1 where user_id=$1', [state.userId]);
            await h.refresh();
            response = actionResponse(page, 'boost-quote');
            await h.press(`[data-action="boost-quote"][data-id="${queueId}"]`);
            await response;
            await page.waitForSelector('#dialogConfirm');
            assert.equal(await page.locator('#dialogConfirm').isDisabled(), true);
            assert.match(await page.locator('#dialogBody').textContent(), /Insufficient Gold/);
            assert.equal(state.calls.filter(call => call.action === 'boost').length, 0);
            await snapshot(h, viewport, 'gold-insufficient', report);
            await h.press('#dialogCancel');
            await h.press('[data-action="gold-wallet"]');
            await page.waitForFunction(() => document.querySelector('#commandDialog').open && document.querySelector('#dialogTitle').textContent === 'Your Gold wallet');
            assert.equal(await page.locator('#commandDialog').evaluate(element => element.scrollTop), 0, 'Gold wallets open at their title and balance');
            await closeWalletFromHeaderAndReopen(h);
            await snapshot(h, viewport, 'gold-wallet', report);
            await h.press('#dialogCancel');
            assert.deepEqual(h.pageErrors, []);
            assert.deepEqual(state.errors, []);
          }
        } finally { await h.context.close(); }
      });
    }
  } finally {
    await browser.close(); await db.close();
    await writeFile(new URL('war-ui-after-report.json', output), JSON.stringify(report, null, 2));
  }
});
