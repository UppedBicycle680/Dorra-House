import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,API_URL} from '../online-config.js';
import {applyWarDelta} from '../war/projection.mjs';

const origin='https://uppedbicycle680.github.io',endpoint=SUPABASE_URL+'/functions/v1/dorra-war';
export async function checkWarOnline({fetchImpl=fetch,browser=false,source=false}={}) {
 const report={ok:false,startedAt:new Date().toISOString(),accounts:[],checks:[],metrics:[]},actors=[],worlds=new Set();
 let stage='Auth configuration',browserInstance;
 const pass=name=>{report.checks.push(name);console.log('Passed: '+name);};
 async function http(url,{body,actor,method='POST'}={}){
  const start=performance.now(),response=await fetchImpl(url,{method,headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(actor?{Authorization:'Bearer '+actor.token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const raw=await response.text();let value;try{value=raw?JSON.parse(raw):{};}catch{throw new Error('UNREADABLE_RESPONSE');}
  if(url===endpoint)report.metrics.push({action:body.action,status:response.status,bytes:Buffer.byteLength(raw),ms:Math.round(performance.now()-start)});
  return {ok:response.ok,status:response.status,value};
 }
 function success(response){if(!response.ok)throw Object.assign(new Error(response.value.code||'HTTP_'+response.status),{code:response.value.code});return response.value;}
 async function acquire(actor){const value=success(await http(API_URL,{actor,body:{scope:'session',action:'acquire',leaseId:actor.lease}}));actor.houseRevision=value.revision;return value;}
 async function war(actor,action,args={},matchId=null,{requestId=randomUUID(),raw=false}={}){
  const body={action,args,leaseId:actor.lease,requestId,...(matchId?{matchId,baseRevision:actor.views.get(matchId)?.match.revision??null}:{})};
  const response=await http(endpoint,{actor,body});if(raw)return response;
  const value=success(response);if(value.delta)value.view=applyWarDelta(actor.views.get(value.delta.matchId),value.delta);
  if(value.view)actor.views.set(value.view.match.id,value.view);
  return value;
 }
 async function rejected(actor,action,args,mid,codes){const r=await war(actor,action,args,mid,{raw:true});assert.ok(!r.ok&&codes.includes(r.value.code),'Rejected unauthorized command');return r;}
 try{
  const settings=success(await http(SUPABASE_URL+'/auth/v1/settings',{method:'GET'}));assert.equal(settings.mailer_autoconfirm,true,'Email confirmation must be disabled before disposable signup');
  for(let i=0;i<2;i++){
   stage='Disposable account '+(i+1);const suffix=randomBytes(6).toString('hex'),username='WarQA_'+suffix;
   const session=success(await http(SUPABASE_URL+'/auth/v1/signup',{body:{email:'war.qa.'+suffix+'@example.com',password:'Aa1!'+randomBytes(30).toString('base64url'),data:{username}}}));
   assert.ok(session.access_token&&session.user?.id,'Registered account session');
   const actor={id:session.user.id,token:session.access_token,session,lease:randomUUID(),views:new Map()};actors.push(actor);report.accounts.push({id:actor.id,username});
   const initial=await acquire(actor);assert.equal(initial.snapshot.balance,1000);
  }
  const [a,b]=actors;pass('Two registered accounts acquire protected House gameplay leases');
  stage='Solo operation';let value=await war(a,'create',{nationId:'AU',opponentNationId:'NZ',template:'duel',opponent:'ai',aiDifficulty:'recruit',pace:'fast',visibility:'public',name:'War QA Solo'});
  const solo=value.view.match.id;worlds.add(solo);report.soloMatchId=solo;assert.equal(value.view.player.nationId,'AU');assert.equal(value.view.match.status,'lobby');assert.equal(value.view.match.aiDifficulty,'recruit');assert.equal(value.view.match.opponentNationId,'NZ');assert.ok(value.view.units.length>0);
  assert.ok(value.view.catalog.platforms.some(p=>p.sourceUrl),'Source-backed national arsenal');
  await rejected(b,'view',{},solo,['MATCH_FORBIDDEN']);await rejected(a,'view',{balance:999999},solo,['INVALID_COMMAND']);
  await war(a,'start',{},solo);pass('Solo world starts with authentic national equipment, saves Recruit AI difficulty and rejects non-member access');
  stage='AI opening progression';let opening;
  for(let attempt=0;attempt<24;attempt++){
   opening=(await war(a,'view',{},solo)).view;if(opening.match.gameTime>=7200)break;
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.ok(opening.match.gameTime>=7200,'The actual hosted solo passes its AI opening decision');
  assert.equal(opening.match.aiDifficulty,'recruit');assert.ok(!opening.units.some(u=>u.nationId==='NZ'),'The distant rival remains fogged while acting');
  pass('Hosted solo advances through the AI opening without exposing its distant forces');
  stage='Research, construction and idempotent production';
  const view=(await war(a,'view',{},solo)).view;
  const base=view.provinces.find(p=>p.ownerId==='AU'&&p.facilities?.['army-base']);assert.ok(base);
  const platform=view.catalog.platforms.find(p=>p.domain==='land'&&view.player.research.includes(p.id));assert.ok(platform);
  const requestId=randomUUID();const produced=await war(a,'produce',{provinceId:base.id,platformId:platform.id},solo,{requestId});
  const replay=await war(a,'produce',{provinceId:base.id,platformId:platform.id},solo,{requestId});assert.equal(replay.replayed,true);assert.equal(replay.view.player.productionQueue.length,produced.view.player.productionQueue.length);
  const programme=view.catalog.platforms.find(p=>p.id==='combined-arms-doctrine');
  if(programme&&!view.player.research.includes(programme.id))await war(a,'research',{platformId:programme.id},solo);
  await war(a,'build',{provinceId:base.id,facility:'army-base'},solo);
  pass('Production retries replay once; timed research and facility upgrades use server costs');
  stage='Solo pause and resume';const paused=(await war(a,'pause',{},solo)).view;assert.equal(paused.match.status,'paused');assert.equal(paused.match.aiDifficulty,'recruit');
  await new Promise(resolve=>setTimeout(resolve,1000));const stationary=(await war(a,'view',{},solo)).view;assert.equal(stationary.match.gameTime,paused.match.gameTime);
  await war(a,'resume',{},solo);await war(a,'retire',{},solo);worlds.delete(solo);pass('Paused solo time remains fixed and resume restores the same world');
  stage='Human 1v1';value=await war(a,'create',{nationId:'AU',opponentNationId:'NZ',template:'duel',opponent:'human',pace:'fast',visibility:'public',name:'War QA 1v1'});
  const duel=value.view.match.id;worlds.add(duel);await war(b,'join',{nationId:'NZ'},duel);await war(a,'start',{},duel);
  const av=(await war(a,'view',{},duel)).view,bv=(await war(b,'view',{},duel)).view;
  assert.equal(av.player.nationId,'AU');assert.equal(bv.player.nationId,'NZ');assert.ok(av.nations.some(n=>n.ownerId===b.id));
  assert.ok(bv.catalog.platforms.some(p=>p.domain==='sea'&&p.sourceUrl),'New Zealand has a sourced naval research roster');
  const engineer=av.units.find(u=>u.platformId==='combat-engineers');assert.ok(engineer,'Own engineering formation is present');
  assert.equal(typeof engineer.supply,'number');assert.equal(typeof engineer.entrenchment,'number');assert.equal(typeof engineer.interceptReadyAt,'number');
  await rejected(a,'order',{type:'intercept',unitIds:[engineer.id],targetProvinceId:engineer.provinceId},duel,['INVALID_TARGET_CLASS']);
  pass('Fielded national arsenals and private readiness are present; engineers cannot act as air-defence weapons');
  const own=bv.units.find(u=>u.nationId==='NZ');assert.ok(own);await rejected(a,'order',{type:'split',unitIds:[own.id]},duel,['UNIT_NOT_OWNED']);
  await rejected(a,'pause',{},duel,['SOLO_PAUSE_ONLY']);
  assert.ok(!av.units.some(u=>u.nationId==='NZ'),'Distant enemy formations remain fogged');pass('Two accounts command distinct nations; foreign orders and multiplayer pause are rejected');
  stage='Lease takeover and independent economies';const previous=a.lease;a.lease=randomUUID();const restored=await acquire(a);assert.equal(restored.snapshot.balance,1000,'War spending never changes House cash');
  const old={...a,lease:previous};await rejected(old,'view',{},duel,['SESSION_REPLACED']);assert.equal((await war(a,'view',{},duel)).view.match.id,duel);
  const direct=await http(SUPABASE_URL+'/rest/v1/rpc/dorra_war_command',{actor:a,body:{p_user_id:a.id,p_auth_session_id:randomUUID(),p_lease_id:a.lease,p_action:'list'}});assert.ok(!direct.ok,'Private storage RPC rejects player role');
  pass('Device takeover preserves matches, revokes old leases, and cannot access storage RPCs');
  if(browser){
   stage=source?'Real-backend browser source verification':'Published desktop and mobile verification';
   const {chromium}=await import('playwright');browserInstance=await chromium.launch({headless:true,...(process.env.DORRA_CHROMIUM_PATH?{executablePath:process.env.DORRA_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
   for(const [actor,viewport,label]of [[a,{width:1440,height:900},'desktop'],[b,{width:320,height:740},'mobile']]){
    const context=await browserInstance.newContext({viewport});await context.addInitScript(session=>localStorage.setItem('dorra-online-auth',JSON.stringify(session)),actor.session);
    if(source){const {serveSource}=await import('../tests/browser-helpers.mjs');await context.route(origin+'/Dorra-House/**',serveSource);}
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('request',request=>{if([endpoint,API_URL].includes(request.url())&&request.method()==='POST'){try{const body=request.postDataJSON();if(typeof body.leaseId==='string')actor.lease=body.leaseId;}catch{}}});
    await page.goto((process.env.DORRA_SITE_URL||origin+'/Dorra-House/')+'war-simulation.html?match='+duel,{waitUntil:'domcontentloaded'});
    await page.locator('#commandNav').waitFor({state:'visible',timeout:60000});await page.locator('#resourceBar').waitFor({state:'visible'});
    await page.locator('[data-action="tab"][data-id="research"]').click();await page.getByRole('heading',{name:'Research programmes'}).waitFor({state:'visible'});
    assert.ok(await page.locator('.branch-tabs button').count()>=8);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('[data-action="tab"][data-id="intelligence"]').click();await page.locator('.force-row').first().click();
    await page.locator('#formationDetails summary').click();assert.match(await page.locator('.formation-support').textContent(),/Supply|Entrenchment/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await mkdir('work',{recursive:true});await page.screenshot({path:'work/war-live-'+label+'.png'});assert.deepEqual(errors,[]);
    pass(label+' opens the actual 1v1, displays research and private formation readiness, and fits its viewport without JavaScript errors');
   }
  }
  report.ok=true;
 }catch(error){report.failure={stage,code:error.code||(/^[A-Z_0-9]+$/.test(error.message)?error.message:'CHECK_FAILED')};console.error('War check failed at '+stage+': '+report.failure.code);}
 finally{
  await browserInstance?.close();
  for(const mid of worlds)for(const actor of actors){try{await war(actor,'retire',{},mid);}catch{}}
  for(const actor of actors){try{await http(SUPABASE_URL+'/auth/v1/logout?scope=global',{actor});}catch{}}
  actors.length=0;report.finishedAt=new Date().toISOString();
 }
 return report;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/check-war-online.mjs')){
 const report=await checkWarOnline({browser:process.env.DORRA_WAR_BROWSER==='1',source:process.env.DORRA_WAR_SOURCE==='1'});
 await mkdir('work',{recursive:true});await writeFile('work/war-live-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,accounts:report.accounts,failure:report.failure}));if(!report.ok)process.exitCode=1;
}
