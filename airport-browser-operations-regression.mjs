// Real online UI, Auth SDK, command protocol and airport reducer. Transport and
// database commits are isolated in memory; no player data or live API is used.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {reduceAirport} from './supabase/functions/dorra-api/airport.mjs';
import {validateBody,commandDigest} from './supabase/functions/dorra-api/protocol.mjs';
import {encodeResult,decodeResult} from './supabase/functions/dorra-api/response-codec.mjs';
import {SUPABASE_URL,API_URL} from './online-config.js';
import {createCareer, projectCareer, settleCareer, renewPresence, applyCommand} from './airport/engine.mjs';
import {AIRPORTS, AIRCRAFT, RUNWAY_LENGTHS} from './airport/catalog.mjs';
import {bayFor, aircraftFitsBay} from './airport/brisbane-bays.mjs';

const {chromium} = createRequire(import.meta.url)('playwright');
const mode = process.env.DORRA_QA_MODE || 'all';
assert.ok(['all','ui','maps','lifecycle'].includes(mode), 'DORRA_QA_MODE must be all, ui, maps or lifecycle');
const mapIds = process.env.DORRA_QA_AIRPORTS?.split(',');
const mapAirports = mapIds ? AIRPORTS.filter(meta => mapIds.includes(meta.id)) : AIRPORTS;
assert.ok(!mapIds || mapAirports.length === mapIds.length, 'Unknown DORRA_QA_AIRPORTS selection');
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(process.env.DORRA_QA_OUTPUT || path.join(root, 'output/playwright/airport-operations'));
let clock = Date.now(), browser, page, harness, latest;
let cloudSave, dropNextResponse=false, sessionReplaced=false;
const received=[];
const errors = [];
await fs.mkdir(output, {recursive:true});

function expandedCareer(now, capacity = false) {
  const career = createCareer(now, 72), base = career.airports.redcliffe;
  for (const meta of AIRPORTS) {
    const airport = structuredClone(base);
    airport.id = meta.id; airport.seed += meta.order * 101;
    airport.cash = 10_000_000; airport.research = 10_000;
    airport.buildings = {runwaySurface:5,runwayLength:RUNWAY_LENGTHS.indexOf(meta.maxRunwayLength)+1,
      taxiway:5,handling:5,terminal:5,tower:5,researchLab:5,cargo:5};
    airport.researchCompleted = ['turnaround','passenger-service','jet-operations','widebody-operations','super-operations','research-network'];
    const count = capacity && (meta.id === 'granite-plains' || meta.id === 'brisbane') ? meta.gatePlots : Math.min(meta.gatePlots, 3);
    airport.gates = Array.from({length:count}, (_, index) => {
      const plotId = `plot-${index+1}`, size = Math.min(meta.maxSize, bayFor(meta.id, plotId)?.maxSize ?? meta.maxSize);
      const aircraft = AIRCRAFT.filter(a => a.size <= size && a.runwayLength <= meta.maxRunwayLength && aircraftFitsBay(meta.id, plotId, a.id)).at(-1);
      return {...structuredClone(base.gates[0]),id:`gate-${index+1}`,plotId,size,rngState:100+index,currentAircraftId:aircraft?.id || 'c172'};
    });
    career.airports[meta.id] = airport;
  }
  return career;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/renderer-harness.html') {
      response.writeHead(200, {'Content-Type':'text/html'});
      response.end('<!doctype html><html><body style="margin:0;background:#b9e4e4"><canvas id="airportCanvas" style="display:block;width:100vw;height:100vh" tabindex="0"></canvas></body></html>');
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'idle-airport.html';
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) || relative.startsWith('.') || relative.startsWith('output/')) throw new Error('Not found');
    const mime = {'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json',
      '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
    response.writeHead(200, {'Content-Type':mime[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store'});
    response.end(await fs.readFile(target));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function pollUi(advance = 0) {
  clock += advance;
  const response = page.waitForResponse(r => r.url()===API_URL && r.request().postDataJSON()?.action==='load' && r.status()===200);
  await Promise.all([response,page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))]);
  await page.waitForFunction(() => /saved/i.test(document.querySelector('#airportSaveStatus').textContent));
  await page.waitForFunction(() => !document.querySelector('#airportApp').getAttribute('aria-busy') || document.querySelector('#airportApp').getAttribute('aria-busy') === 'false');
  // UI rendering follows the worker reply; use two animation frames, not a
  // fixed sleep, so assertions observe the committed response.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function clickCommand(locator, type, keyboard = false) {
  const response = page.waitForResponse(r => r.url()===API_URL && r.request().postDataJSON()?.args?.command?.type === type && r.status()===200);
  const action = keyboard ? (async () => {await locator.focus();await page.keyboard.press('Enter');})() : locator.click();
  const [result] = await Promise.all([response,action]);
  assert.equal(result.status(), 200, await result.text());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function screenshot(name) { await page.screenshot({path:path.join(output, `${name}.png`)}); }
const airportLoads=()=>received.filter(body=>body.scope==='airport'&&body.action==='load');
async function waitForCloudSave() {
  // A MutationObserver also works while the browser clock is paused. Browser
  // frame polling would wait forever without a manually advanced animation.
  await page.evaluate(() => new Promise(resolve => {
    const saved=()=>document.documentElement.dataset.saveState==='saved'&&/saved/i.test(document.querySelector('#airportSaveStatus').textContent);
    if(saved()){resolve();return;}
    const observer=new MutationObserver(()=>{if(saved()){observer.disconnect();resolve();}});
    observer.observe(document.documentElement,{subtree:true,attributes:true,childList:true,characterData:true});
  }));
}
async function setVisibility(hidden) {
  const response=page.waitForResponse(r=>r.url()===API_URL&&r.request().postDataJSON()?.action==='load'&&r.status()===200);
  await Promise.all([response,page.evaluate(hidden=>{
    if(hidden){Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});}
    else {delete document.hidden;delete document.visibilityState;}
    document.dispatchEvent(new Event('visibilitychange'));
  },hidden)]);
  await waitForCloudSave();
}
async function advanceUntilLoad(milliseconds) {
  const response=page.waitForResponse(r=>r.url()===API_URL&&r.request().postDataJSON()?.action==='load'&&r.status()===200);
  await Promise.all([response,page.clock.runFor(milliseconds)]);
  await waitForCloudSave();
}

try {
  browser = await chromium.launch({headless:true,executablePath:process.env.DORRA_CHROMIUM_PATH});
  if (process.env.DORRA_QA_DEBUG) browser.on('disconnected',() => console.error('Browser disconnected at',Date.now()));
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const sessionId=randomUUID(),userId=randomUUID(),encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const user={id:userId,aud:'authenticated',role:'authenticated',email:'airport@example.test',user_metadata:{username:'AirportQA'},app_metadata:{provider:'email',providers:['email']},created_at:new Date().toISOString()};
  const auth={access_token:`${encoded({alg:'HS256',typ:'JWT'})}.${encoded({sub:userId,session_id:sessionId,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.${encoded('test-signature')}`,
    token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'mock-refresh',user};
  cloudSave={snapshot:{balance:1000,history:[],progress:{profile:{name:'AirportQA'},owned:[]}},privateState:{airport:expandedCareer(clock)},revision:1,leaseId:null,recentRequests:[]};
  await context.addInitScript(auth=>localStorage.setItem('dorra-online-auth',JSON.stringify(auth)),auth);
  page = await context.newPage();
  if(mode!=='maps')await page.clock.install({time:clock});
  if (process.env.DORRA_QA_DEBUG) {
    context.on('close', () => console.error('Test context closed at',Date.now()));
    page.on('close', () => console.error('Test page closed at',Date.now()));
    page.on('crash', () => console.error('Test page crashed at',Date.now()));
  }
  page.on('pageerror', error => {errors.push(error.message);console.error('UI error:',error.message);});
  await context.route(`https://${new URL(SUPABASE_URL).hostname}/**`, async route => {
    const request=route.request(),url=new URL(request.url());
    const headers={'content-type':'application/json','access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version','access-control-allow-methods':'GET,POST,OPTIONS'};
    const reply=(value,status=200)=>route.fulfill({status,headers,body:JSON.stringify(value)});
    try {
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
      if(url.pathname==='/auth/v1/user')return reply(user);
      if(url.pathname==='/auth/v1/token')return reply(auth);
      if(url.pathname==='/functions/v1/dorra-admin')return reply({messages:[],serverNow:new Date(clock).toISOString()});
      assert.equal(request.url(),API_URL);
      assert.equal(request.headers().authorization,`Bearer ${auth.access_token}`);
      const body=validateBody(request.postDataJSON());received.push(body);
      if(body.scope==='session'&&body.action==='acquire'){
        cloudSave.leaseId=body.leaseId;cloudSave.revision++;
        return reply({snapshot:cloudSave.snapshot,revision:cloudSave.revision,serverNow:clock});
      }
      if(sessionReplaced)return reply({error:'Another device started a gameplay session.',code:'SESSION_REPLACED'},409);
      assert.equal(body.leaseId,cloudSave.leaseId);assert.equal(body.scope,'airport');
      const digest=await commandDigest(body),cached=cloudSave.recentRequests.find(r=>r.id===body.requestId);
      if(cached){
        assert.equal(cached.digest,digest);latest=await decodeResult(cached.result);
        return reply({snapshot:cloudSave.snapshot,revision:cloudSave.revision,result:latest,replayed:true,serverNow:clock});
      }
      assert.equal(body.expectedRevision,cloudSave.revision);
      const result=await reduceAirport(structuredClone(cloudSave.snapshot),structuredClone(cloudSave.privateState),body.action,body.args,clock);
      const cachedResult=await encodeResult(result.result);
      cloudSave={...cloudSave,snapshot:result.snapshot,privateState:result.privateState,revision:cloudSave.revision+1,
        recentRequests:[...cloudSave.recentRequests,{id:body.requestId,digest,result:cachedResult}].slice(-8)};
      latest=result.result;
      if(dropNextResponse&&body.action==='command'&&body.args.command?.type==='hire-atc'){dropNextResponse=false;return route.abort('failed');}
      return reply({snapshot:cloudSave.snapshot,revision:cloudSave.revision,result:latest,serverNow:clock});
    } catch (error) {
      return reply({error:error.message,code:error.code},error.status||400);
    }
  });
  if (mode !== 'maps') {
    await page.goto(`${origin}/idle-airport.html`);
    await page.locator('#airportDashboard').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-action="visit-airport"]').count(), 7);
    if(mode!=='lifecycle'){
    await page.locator('[data-action="visit-airport"][data-airport-id="redcliffe"]').click();
    await page.locator('#airportHud').waitFor({state:'visible'});
    await pollUi(1);
    await page.locator('#landNext:not([disabled])').waitFor();
    await screenshot('redcliffe-controls');

    await page.locator('.flight-desk-links [data-action="contracts"]').click();
    assert.equal(await page.locator('#airportHud').evaluate(element => element.inert), true);
    assert.equal(await page.locator('[data-action="accept-contract"][data-timed="false"]').count(), 3);
    await clickCommand(page.locator('[data-action="accept-contract"][data-timed="false"]').first(), 'accept-contract');
    assert.ok(latest.view.selectedAirport.operations.contract);
    await page.keyboard.press('Escape');

    await clickCommand(page.locator('#landNext'), 'land-flight', true);
    let flight = latest.view.selectedAirport.operations.flights.find(f => f.phase === 'arriving');
    assert.ok(flight);
    await pollUi(flight.phaseEndsAt - clock);
    await page.locator('.flight-desk-links [data-action="operations"]').click();
    await clickCommand(page.locator('[data-action="prioritise-flight"]:not([disabled])').first(), 'prioritise-flight');
    flight = latest.view.selectedAirport.operations.flights.find(f => f.prioritised);
    assert.ok(flight);
    await screenshot('express-service');
    await page.locator(`[data-action="inspect-flight"][data-flight-id="${flight.id}"]`).focus();
    await page.keyboard.press('Enter');
    await page.locator('#buildInspector').waitFor({state:'visible'});
    assert.equal(await page.locator('#buildInspector [data-action="close-inspector"]').evaluate(element => element === document.activeElement), true);
    await pollUi();
    assert.equal(await page.locator('#buildInspector [data-action="close-inspector"]').evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#airportCanvas').evaluate(element => element === document.activeElement), true);
    await pollUi(flight.phaseEndsAt - clock);
    flight = latest.view.selectedAirport.operations.flights.find(f => f.id === flight.id);
    await pollUi(flight.phaseEndsAt - clock);
    await clickCommand(page.locator('#takeoffNext'), 'takeoff-flight');
    flight = latest.view.selectedAirport.operations.flights.find(f => f.phase === 'departing');
    await page.locator('.flight-desk-links [data-action="operations"]').click();
    await page.locator(`[data-action="inspect-flight"][data-flight-id="${flight.id}"]`).focus();
    await page.keyboard.press('Enter');
    await page.locator('#buildInspector').waitFor({state:'visible'});
    await pollUi(flight.phaseEndsAt - clock);
    assert.equal(latest.view.selectedAirport.operations.completedFlights, 1);
    assert.equal(await page.locator('#buildInspector').isVisible(),false);
    assert.equal(await page.locator('#airportCanvas').evaluate(element=>element===document.activeElement),true,'Completing an inspected flight must return keyboard focus to the map');

    await page.locator('.flight-desk-links [data-action="routes"]').click();
    const strategy = page.locator('[data-route-strategy]').first();
    await strategy.selectOption('premium');
    await clickCommand(page.locator('[data-action="apply-service"]:not([disabled])').first(), 'apply-service');
    assert.ok(latest.view.selectedAirport.gates.some(g => g.serviceStrategy === 'premium'));
    await screenshot('routes');
    await page.keyboard.press('Escape');

    await page.locator('.flight-desk-links [data-action="operations"]').click();
    const cashBeforeAtc=cloudSave.privateState.airport.airports.redcliffe.cash;
    const atcCost=latest.view.selectedAirport.operations.atc.cost;
    dropNextResponse=true;
    await clickCommand(page.locator('[data-action="hire-atc"]'), 'hire-atc');
    assert.ok(latest.view.selectedAirport.operations.atc.owned);
    const hires=received.filter(body=>body.action==='command'&&body.args.command?.type==='hire-atc');
    assert.equal(hires.length,2,'The lost ATC response must be retried exactly once');
    assert.equal(hires[0].requestId,hires[1].requestId,'Transport retry must reuse the original request identity');
    assert.equal(hires[0].expectedRevision,hires[1].expectedRevision,'Replay must use the original transaction envelope');
    assert.equal(cloudSave.privateState.airport.airports.redcliffe.cash,cashBeforeAtc-atcCost,'ATC replay must charge only once');
    await clickCommand(page.locator('[data-action="set-atc"]'), 'set-atc');
    assert.equal(latest.view.selectedAirport.operations.atc.enabled, false);
    await page.keyboard.press('Escape');

    // Keep the server lease renewed while advancing active play deterministically.
    for (let n = 0; n < 100 && !latest.view.selectedAirport.operations.incident; n++) await pollUi(10_000);
    assert.ok(latest.view.selectedAirport.operations.incident, 'An incident should appear after10–15 active minutes');
    await page.locator('#incidentBanner').waitFor({state:'visible'});
    await screenshot('incident');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#incidentBanner [data-action="respond-incident"]').isEnabled(), true);
    await screenshot('incident-reduced-motion');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await clickCommand(page.locator('#incidentBanner [data-action="respond-incident"]'), 'respond-incident');
    const incident = latest.view.selectedAirport.operations.incident;
    assert.ok(incident.responding);
    await pollUi(incident.resolvesAt - clock);
    assert.equal(latest.view.selectedAirport.operations.incident, null);

    await page.setViewportSize({width:1024,height:768});
    await screenshot('controls-1024');
    await page.setViewportSize({width:390,height:844});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'Mobile controls should not create horizontal overflow');
    await screenshot('controls-mobile');
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-action="dashboard"]').first().click();
    await page.locator('#airportDashboard').waitFor({state:'visible'});
    await pollUi();

    for (const meta of AIRPORTS) {
      console.log(`Checking airport controls: ${meta.id}`);
      const visit = page.locator(`[data-action="visit-airport"][data-airport-id="${meta.id}"]`);
      if (latest.view.selectedAirportId !== meta.id) await clickCommand(visit, 'select-airport');
      else await visit.click();
      await pollUi(1);
      assert.equal(latest.view.selectedAirport.id, meta.id);
      await page.locator('.flight-desk-links [data-action="operations"]').click();
      await screenshot(`${meta.id}-operations`);
      await page.keyboard.press('Escape');
      await page.locator('[data-action="dashboard"]').first().click();
      await pollUi();
    }
    }
    // Test browser-wall-clock polling separately from the authoritative game
    // clock. Advancing timers must not invent flight income or active play.
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    await setVisibility(false);
    let loadCount=airportLoads().length;
    await page.clock.runFor(29_900);
    assert.equal(airportLoads().length,loadCount,'Dashboard must not use the five-second airport cadence');
    await advanceUntilLoad(200);
    assert.equal(airportLoads().length,loadCount+1,'Dashboard must refresh at30 seconds');
    assert.equal(airportLoads().at(-1).args.presenceAirportId,null,'Dashboard refresh must clear active-airport presence');

    await page.clock.resume();
    const activeAirportId=latest.view.selectedAirportId;
    await page.locator(`[data-action="visit-airport"][data-airport-id="${activeAirportId}"]`).click();
    await page.locator('#airportHud').waitFor({state:'visible'});
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    await setVisibility(false);
    loadCount=airportLoads().length;
    await page.clock.runFor(4_900);
    assert.equal(airportLoads().length,loadCount,'Active polling must wait for the five-second lease renewal');
    await advanceUntilLoad(200);
    assert.equal(airportLoads().length,loadCount+1,'Visible airport must renew every five seconds');
    assert.equal(airportLoads().at(-1).args.presenceAirportId,activeAirportId);
    await setVisibility(true);
    assert.equal(airportLoads().at(-1).args.presenceAirportId,null,'Hiding the tab must send one immediate presence clear');
    loadCount=airportLoads().length;
    await page.clock.runFor(31_000);
    assert.equal(airportLoads().length,loadCount,'Hidden tabs must pause airport polling after clearing presence');
    await setVisibility(false);
    assert.equal(airportLoads().at(-1).args.presenceAirportId,activeAirportId,'Returning to the visible airport must restore presence');
    await page.clock.resume();

    await page.locator('.flight-desk-links [data-action="operations"]').click();
    sessionReplaced=true;
    const revoked=page.waitForResponse(r=>r.url()===API_URL&&r.status()===409);
    await Promise.all([revoked,page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))]);
    await page.locator('#airportFatal').waitFor({state:'visible'});
    assert.equal(await page.locator('#airportDialog').isVisible(),false,'Session revocation must dismiss the airport modal');
    assert.equal(await page.locator('#airportCanvas').evaluate(element=>element.inert),true);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.sessionState),'ended');
    const requestsAfterRevocation=received.length;
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    await page.clock.runFor(35_000);
    await page.evaluate(()=>document.querySelector('#landNext').dispatchEvent(new MouseEvent('click',{bubbles:true})));
    assert.equal(received.length,requestsAfterRevocation,'Revoked sessions must stop polls and queued controls');
    await page.clock.resume();
    // Preserve the shell's session notice, then verify the airport return link
    // can leave a failed save without retrying its revoked transaction.
    assert.equal(await page.locator('dialog.online-session-notice').isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog.online-session-notice').isVisible(),false,'Escape must dismiss the shell session notice before the airport return link is clicked');
    await page.route(`${origin}/index.html`,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Dorra House test return</title>'}));
    await Promise.all([page.waitForURL(`${origin}/index.html`,{waitUntil:'commit'}),page.locator('#airportFatal [data-return-house]').click({timeout:3_000})]);
    assert.equal(received.length,requestsAfterRevocation,'Returning from the fatal screen must not retry cloud writes');
    console.log(mode==='lifecycle'?'Cloud UI presence cadence, hidden-tab pause, session fail-stop and recovery controls passed.':'Interactive controls, incidents, keyboard clearance, responsive UI, presence cadence, ATC replay and session fail-stop passed.');
  }

  const report = [];
  if (mode !== 'ui'&&mode!=='lifecycle') {
    let lastView;
    harness = await context.newPage();
    harness.on('pageerror', error => {errors.push(error.message);console.error('Map error:',error.message);});
    await harness.goto(`${origin}/renderer-harness.html`);
    await harness.evaluate(async () => {
      const {createAirportRenderer} = await import('./airport/renderer.mjs');
      window.renderer = createAirportRenderer(document.querySelector('canvas'), {
        presentationTime:() => window.presentationAt,
        onSelect:value => {window.selection = value;}
      });
    });
    for (const meta of mapAirports) {
      console.log(`Checking airport map: ${meta.id}`);
      let career = expandedCareer(clock, true);
      career.selectedAirportId = meta.id;
      // Each map fixture needs only this airport. Projecting all built airports
      // again on every iteration obscures the renderer's own performance.
      career.airports = {[meta.id]:career.airports[meta.id]};
      career = renewPresence(career, meta.id, clock);
      career = settleCareer(career, clock + 1).career;
      let at = clock + 1, view = {...projectCareer(career, at),serverNow:at};
      let land = view.selectedAirport.operations.flights.find(f => f.canLand);
      // Crowded Brisbane bays search in bounded batches. Renew the same
      // server-timestamped presence lease while those safe probes continue.
      for (let probe = 0; !land && probe < 30; probe++) {
        at += 5_000;
        career = renewPresence(settleCareer(career, at).career, meta.id, at);
        view = {...projectCareer(career, at),serverNow:at};
        land = view.selectedAirport.operations.flights.find(f => f.canLand);
      }
      assert.ok(land, `Missing interactive route at ${meta.id}`);
      career = applyCommand(career, {type:'land-flight',airportId:meta.id,flightId:land.id}, at);
      // A confirmed arrival halfway through its route is visible on the map.
      const movingAt = at + Math.floor(land.timings.arrivalMs / 2);
      view = {...projectCareer(career, movingAt),serverNow:movingAt};
      lastView = view;
      // Sample moving phases with a controlled presentation clock so picking
      // assertions do not race browser transport and slow screenshot capture.
      await harness.evaluate(view => {window.presentationAt=view.serverNow;window.selection=null;window.renderer.setView(view.selectedAirport, view);}, view);
      await harness.waitForFunction(id => window.renderer.getSceneSnapshot().flights.some(f => f.flightId === id), land.id);
      let scene = await harness.evaluate(() => window.renderer.getSceneSnapshot());
      const interactive = scene.flights.find(f => f.flightId === land.id);
      assert.ok(interactive);
      assert.equal(scene.flights.filter(f => f.gateId === interactive.gateId || f.id === interactive.gateId).length, 1);
      if (meta.id === 'brisbane') assert.ok(scene.flights.filter(f => !f.flightId).every(f => f.routePreview && f.phase === 'servicing'), 'Preview routes must remain parked while interactive traffic controls the runway');
      await harness.evaluate(() => {window.presentationAt += 1_000;});
      await harness.waitForFunction(({id,progress}) => window.renderer.getSceneSnapshot().flights.find(f => f.flightId === id)?.phaseProgress > progress, {id:land.id,progress:interactive.phaseProgress});
      scene = await harness.evaluate(() => window.renderer.getSceneSnapshot());
      const moved = scene.flights.find(f => f.flightId === land.id);
      assert.ok(moved.phaseProgress > interactive.phaseProgress, 'Confirmed arrival progress should advance with the presentation clock');
      const hit = scene.hits.find(h => h.kind === 'flight' && h.id === land.id);
      assert.ok(hit);
      const points = hit.points || hit.polygons[0], x = points.reduce((sum,p) => sum+p.x,0)/points.length, y = points.reduce((sum,p) => sum+p.y,0)/points.length;
      assert.ok(x > 0 && x < 1440 && y > 0 && y < 1000, `Flight target is outside the viewport at ${meta.id}: ${x}, ${y}`);
      await harness.mouse.click(x,y);
      assert.equal((await harness.evaluate(() => window.selection))?.id, land.id, `Moving flight selection at ${meta.id} (${x}, ${y})`);
      await harness.screenshot({path:path.join(output, `${meta.id}-map.png`)});
      const before = scene.stats;
      await harness.waitForFunction(count => window.renderer.getSceneSnapshot().stats.renderedFrames >= count + 10, before.renderedFrames);
      const after = await harness.evaluate(() => window.renderer.getSceneSnapshot().stats);
      report.push({airport:meta.id,gates:view.selectedAirport.gates.length,flights:scene.flights.length,
        warmMeanRenderMs:(after.totalRenderMs-before.totalRenderMs)/(after.renderedFrames-before.renderedFrames)});
      console.log(JSON.stringify(report.at(-1)));
    }
    await harness.emulateMedia({reducedMotion:'reduce'});
    await harness.waitForFunction(() => window.renderer.getSceneSnapshot().flights.some(f => f.flightId && f.phase === 'taxi-in'));
    const stationary = await harness.evaluate(() => {
      const f = window.renderer.getSceneSnapshot().flights.find(f => f.flightId && f.operationPhase === 'arriving');
      return {id:f.flightId,x:f.x,y:f.y,altitude:f.altitude,progress:f.phaseProgress,frames:window.renderer.getSceneSnapshot().stats.renderedFrames};
    });
    await harness.evaluate(() => {window.presentationAt += 1_500;});
    await harness.waitForFunction(({id,progress}) => window.renderer.getSceneSnapshot().flights.find(f => f.flightId === id)?.phaseProgress > progress, stationary);
    await harness.waitForFunction(count => window.renderer.getSceneSnapshot().stats.renderedFrames >= count + 6, stationary.frames);
    const later = await harness.evaluate(id => window.renderer.getSceneSnapshot().flights.find(f => f.flightId === id), stationary.id);
    assert.deepEqual([later.x,later.y,later.altitude], [stationary.x,stationary.y,stationary.altitude]);
    const reducedView = structuredClone(lastView), affected = reducedView.selectedAirport.operations.flights[0];
    reducedView.selectedAirport.operations.incident = {id:'test-fire',type:'fire',title:'Ground equipment fire',
      gateId:affected.gateId,plotId:affected.plotId,startedAt:reducedView.serverNow,responseMs:60_000,
      responding:true,responseStartedAt:reducedView.serverNow,resolvesAt:reducedView.serverNow+60_000};
    await harness.evaluate(view => {window.presentationAt=view.serverNow+4_000;window.renderer.setView(view.selectedAirport,view);}, reducedView);
    await harness.waitForFunction(() => window.renderer.getSceneSnapshot().incident?.reducedMotion === true);
    const staticIncident = await harness.evaluate(() => window.renderer.getSceneSnapshot().incident);
    assert.ok(staticIncident.progress > 0 && staticIncident.progress < 1);
    assert.ok(staticIncident.position.every(Number.isFinite) && staticIncident.responseSite.every(Number.isFinite));
    await harness.screenshot({path:path.join(output,'reduced-motion.png')});
    await harness.evaluate(() => window.renderer.dispose());
    await harness.close();
  }
  assert.deepEqual(errors, [], 'Browser must not produce uncaught errors');
  await fs.writeFile(path.join(output,`report-${mode}.json`), JSON.stringify({checks:'passed',mode,airports:report,errors},null,2));
  console.log(JSON.stringify({checks:'passed',mode,airports:report,output},null,2));
} catch (error) {
  console.error('Browser regression failed:',error.message);
  if(page&&!page.isClosed())console.error('Last UI state:',await page.evaluate(()=>({url:location.href,toast:document.querySelector('#airportToast')?.textContent,fatal:document.querySelector('#airportFatalCopy')?.textContent,save:document.querySelector('#airportSaveStatus')?.textContent,sessionNoticeOpen:document.querySelector('dialog.online-session-notice')?.open})).catch(()=>null));
  if (errors.length) console.error('Uncaught browser errors:',errors);
  if (harness && !harness.isClosed()) console.error('Last map scene:', await harness.evaluate(() => {
    const scene = window.renderer?.getSceneSnapshot();
    return {airport:scene?.layoutId,flights:scene?.flights.map(f => f.flightId || f.id),stats:scene?.stats};
  }).catch(() => null));
  throw error;
} finally {
  if (process.env.DORRA_QA_DEBUG) console.error('Closing test browser in cleanup at',Date.now());
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
