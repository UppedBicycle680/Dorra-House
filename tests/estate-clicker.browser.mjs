import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPABASE_PUBLISHABLE_KEY} from '../online-config.js';
import {validateBody,commandDigest} from '../supabase/functions/dorra-api/protocol.mjs';
import {initializeHouse} from '../supabase/functions/dorra-api/house-progression.mjs';
import {reduceHouse} from '../supabase/functions/dorra-api/house.mjs';
import {encodeResult,decodeResult} from '../supabase/functions/dorra-api/response-codec.mjs';
import {baseURL,supabaseHost,responseHeaders,launchBrowser,serveSource} from './browser-helpers.mjs';

// Exercise the published page's real Auth SDK, controller, protocol and reducer.
// Transport and the atomic database commit are simulated; no accounts are made
// and no request leaves this browser's route handler.
test('online Estate supports service, upgrades, managers, reloads, failed saves and narrow screens', {timeout:120_000},async()=>{
  const browser=await launchBrowser();
  const userId=crypto.randomUUID(),sessionId=crypto.randomUUID();
  const user={id:userId,aud:'authenticated',role:'authenticated',email:'estate@example.test',user_metadata:{username:'EstateTest'},app_metadata:{provider:'email',providers:['email']},created_at:new Date().toISOString()};
  const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt=Math.floor(Date.now()/1_000)+3_600;
  const token=`${encoded({alg:'HS256',typ:'JWT'})}.${encoded({sub:userId,session_id:sessionId,role:'authenticated',aud:'authenticated',exp:expiresAt})}.${encoded('fixture-signature')}`;
  const auth={access_token:token,token_type:'bearer',expires_in:3_600,expires_at:expiresAt,refresh_token:'fixture-refresh',user};
  let serverNow=Date.now(),failNext=null;
  let saved={snapshot:initializeHouse({balance:5_000,progress:{level:1,xp:0,profile:{name:'EstateTest'},arrival:{complete:true,path:'owner'}}},serverNow),privateState:{privateSentinel:'never-publish'},revision:1,leaseId:null,recentRequests:[]};
  const requests=[],commits=[],runtimeErrors=[],consoleErrors=[];
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(session=>localStorage.setItem('dorra-online-auth',JSON.stringify(session)),auth);
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname!==supabaseHost)return serveSource(route);
    const reply=async(value,status=200)=>{
      assert.ok(!Object.hasOwn(value,'privateState'));
      assert.ok(!JSON.stringify(value).includes('never-publish'));
      await route.fulfill({status,headers:responseHeaders,body:JSON.stringify(value)});
    };
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:responseHeaders,body:''});
    if(url.pathname.startsWith('/auth/v1/')){
      if(url.pathname==='/auth/v1/user')return reply(user);
      if(url.pathname==='/auth/v1/token')return reply(auth);
      throw new Error('Unexpected Auth request '+url.pathname);
    }
    if(url.pathname==='/functions/v1/dorra-admin'){
      const input=request.postDataJSON();
      if(input.operation==='pulse')return reply({messages:[],serverNow:new Date(serverNow).toISOString()});
      if(input.operation==='status')return reply({owner:false,role:'player'});
      throw new Error('Unexpected admin request');
    }
    assert.equal(url.pathname,'/functions/v1/dorra-api');
    assert.equal(request.headers().authorization,'Bearer '+token);
    assert.equal(request.headers().apikey,SUPABASE_PUBLISHABLE_KEY);
    const body=validateBody(request.postDataJSON());
    requests.push(body);
    if(body.scope==='session'&&body.action==='acquire'){
      saved.leaseId=body.leaseId;
      saved.revision++;
      return reply({snapshot:saved.snapshot,revision:saved.revision,username:'EstateTest',serverNow});
    }
    assert.equal(body.leaseId,saved.leaseId);
    const digest=await commandDigest(body);
    const replay=saved.recentRequests.find(item=>item.id===body.requestId);
    if(replay){
      assert.equal(replay.digest,digest);
      return reply({snapshot:saved.snapshot,revision:saved.revision,result:await decodeResult(replay.result),serverNow,replayed:true});
    }
    assert.equal(body.expectedRevision,saved.revision,'the page must use the last committed revision');
    if(body.action===failNext){failNext=null;return reply({error:'Cloud save paused for this test. Retry your action.',code:'STORAGE_ERROR'},503)}
    try{
      const output=await reduceHouse(structuredClone(saved.snapshot),structuredClone(saved.privateState),body.action,body.args,serverNow);
      const result=await encodeResult(output.result);
      saved={...saved,snapshot:output.snapshot,privateState:output.privateState,revision:saved.revision+1,recentRequests:[...saved.recentRequests,{id:body.requestId,digest,result}].slice(-8)};
      commits.push({action:body.action,result:output.result,balance:saved.snapshot.balance});
      return reply({snapshot:saved.snapshot,revision:saved.revision,result:await decodeResult(result),serverNow});
    }catch(error){return reply({error:error.message,code:error.code||'ACTION_REJECTED'},error.status||400)}
  });
  const page=await context.newPage();
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  const waitWallet=amount=>page.waitForFunction(expected=>document.querySelector('[data-estate-wallet]')?.textContent==='$'+expected.toLocaleString(),amount);
  const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.saveState==='saved');
  const action=async(selector,name)=>{
    const count=commits.length;
    await page.locator(selector).click();
    await page.waitForFunction(()=>document.documentElement.dataset.saveState==='saved');
    assert.equal(commits.length,count+1,name+' should commit once');
    assert.equal(commits.at(-1).action,name);
    await waitWallet(saved.snapshot.balance);
  };
  try{
    await page.goto(baseURL+'index.html');
    await page.locator('#lobby').waitFor({state:'visible'});
    assert.match(await page.title(),/Dorra/i);
    assert.equal(page.url(),baseURL+'index.html');
    await page.locator('#lobby [data-home-estate="empire"]').click();
    await page.locator('[data-estate-open="terrace"]').waitFor({state:'visible'});
    await waitWallet(5_000);
    await action('[data-estate-open="terrace"]','estate-clicker-open');
    assert.equal(saved.snapshot.balance,4_750);
    assert.equal(await page.locator('[data-estate-serve="terrace"]').isEnabled(),true);
    await action('[data-estate-serve="terrace"]','estate-clicker-serve');
    assert.equal(saved.snapshot.balance,4_762);
    assert.equal(await page.locator('[data-estate-upgrade="terrace"]').isEnabled(),true,'an affordable upgrade must re-enable after serving');
    assert.equal(await page.locator('[data-estate-goal="first-service"]').isEnabled(),true,'a newly earned milestone must be claimable immediately');
    await action('[data-estate-goal="first-service"]','estate-clicker-goal');
    assert.equal(saved.snapshot.balance,4_837);
    await action('[data-estate-upgrade="terrace"]','estate-clicker-upgrade');
    assert.equal(saved.snapshot.balance,3_937);
    assert.equal(await page.locator('[data-estate-manager="terrace"]').isEnabled(),true,'the Level 2 upgrade must immediately enable hiring');
    await action('[data-estate-manager="terrace"]','estate-clicker-manager');
    assert.equal(saved.snapshot.balance,2_737);
    assert.match(await page.locator('[data-estate-income]').textContent(),/\$216/);
    await page.waitForFunction(()=>document.querySelector('[data-estate-bank]')?.textContent!=='$0');
    assert.equal(saved.snapshot.balance,2_737,'the live forecast cannot credit the account wallet');
    serverNow+=60_000;
    await action('[data-estate-claim]','estate-clicker-claim');
    assert.equal(commits.at(-1).result.amount,216);
    assert.equal(saved.snapshot.balance,2_953);
    assert.equal(await page.locator('[data-estate-upgrade="terrace"]').isEnabled(),true);
    assert.equal(await page.locator('[data-estate-serve="terrace"]').isEnabled(),true);

    await page.reload();
    await page.locator('#lobby').waitFor({state:'visible'});
    await page.locator('#lobby [data-home-estate="empire"]').click();
    await waitWallet(2_953);
    assert.match(await page.locator('.estate-service-card>header').textContent(),/Level 2/);
    assert.match(await page.locator('.estate-on-duty').textContent(),/Hired/);
    await page.locator('[data-estate-view="milestones"]').first().click();
    assert.equal(await page.locator('[data-estate-goal="first-service"]').isDisabled(),true);
    assert.equal(await page.locator('[data-estate-goal="first-service"]').textContent(),'Claimed');
    await page.locator('[data-estate-view="estate"]').click();

    // A rejected cloud action must leave both the receipt and server state alone.
    const balanceBefore=saved.snapshot.balance,servedBefore=saved.snapshot.progress.empire.clicker.served;
    failNext='estate-clicker-serve';
    await page.locator('[data-estate-serve="terrace"]').click();
    await page.waitForFunction(()=>document.documentElement.dataset.saveState==='error');
    await page.locator('.estate-cloud-status.error').waitFor({state:'visible'});
    await waitWallet(balanceBefore);
    assert.equal(saved.snapshot.balance,balanceBefore);
    assert.equal(saved.snapshot.progress.empire.clicker.served,servedBefore);
    assert.equal(await page.locator('[data-estate-serve="terrace"]').isEnabled(),true,'a failed save must allow a retry');
    serverNow+=1_000;
    await page.waitForTimeout(425);
    await action('[data-estate-serve="terrace"]','estate-clicker-serve');
    assert.equal(saved.snapshot.balance,balanceBefore+18);
    assert.equal(saved.snapshot.progress.empire.clicker.served,servedBefore+1);
    await ready();

    if(process.env.DORRA_ESTATE_SCREENSHOT){
      await page.waitForFunction(()=>!document.querySelector('#toast')?.classList.contains('show'));
      await page.screenshot({path:process.env.DORRA_ESTATE_SCREENSHOT,fullPage:true});
    }
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      for(const view of ['estate','managers','milestones']){
        await page.locator('[data-estate-view="'+view+'"]').first().click();
        const geometry=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
        assert.ok(geometry.scroll<=geometry.width+1&&geometry.body<=geometry.width+1,`${view} must fit ${width}px: ${JSON.stringify(geometry)}`);
        const controls=await page.locator('.estate-nav button').evaluateAll(buttons=>buttons.map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})));
        assert.ok(controls.every(control=>control.width>=44&&control.height>=44),'mobile navigation needs usable touch targets');
        if(view==='estate'){
          await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
          const priority=await page.locator('[data-estate-serve="terrace"]').evaluate(button=>{const rect=button.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,height:innerHeight}});
          assert.ok(priority.top>=0&&priority.bottom<=priority.height,`serving must be fully available without scrolling at ${width}px: ${JSON.stringify(priority)}`);
          if(process.env.DORRA_ESTATE_SCREENSHOT)console.log(`Estate service at ${width}px: ${priority.top.toFixed(1)}–${priority.bottom.toFixed(1)} of ${priority.height}px.`);
          const houseLinks=page.locator('.estate-sidebar .progression-tabs');
          assert.equal(await houseLinks.locator('button:not(#empireTab),a').count(),4,'all House destinations must remain available');
          assert.equal(await page.locator('[data-online-signout]').isVisible(),true);
          assert.equal(await page.locator('[data-online-signout]').isEnabled(),true);
        }
        if(width===390&&view==='estate'&&process.env.DORRA_ESTATE_MOBILE_SCREENSHOT)await page.screenshot({path:process.env.DORRA_ESTATE_MOBILE_SCREENSHOT,fullPage:true});
      }
    }
    assert.deepEqual(runtimeErrors,[]);
    assert.ok(consoleErrors.every(message=>/503/.test(message)),'only the intentionally rejected save may produce a console error: '+consoleErrors.join('; '));
    for(const request of requests.filter(body=>body.action.startsWith('estate-clicker-'))){
      assert.deepEqual(Object.keys(request.args),request.action.endsWith('-claim')?[]:[request.action.endsWith('-goal')?'goalId':'venueId']);
      assert.ok(!Object.hasOwn(request,'snapshot')&&!Object.hasOwn(request,'balance'));
    }
  }finally{await browser.close()}
});
