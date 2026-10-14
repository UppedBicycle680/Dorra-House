import test from 'node:test';
import assert from 'node:assert/strict';
import {baseURL,supabaseHost,responseHeaders,launchBrowser,serveSource} from './browser-helpers.mjs';
import {sessionRefresh} from '../supabase/functions/dorra-api/session-refresh.mjs';
import {validateBody} from '../supabase/functions/dorra-api/protocol.mjs';

test('private realtime hints fetch authority, ignore supplied money and fall back after disconnect',{timeout:60000},async()=>{
  const browser=await launchBrowser(),id=crypto.randomUUID();
  const user={id,aud:'authenticated',role:'authenticated',email:'sync@example.test',app_metadata:{},user_metadata:{}};
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const session={user,access_token:`${encode({})}.${encode({sub:id,exp:Math.floor(Date.now()/1000)+3600})}.fixture`,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer'};
  const saved={snapshot:{balance:1000,progress:{profile:{name:'SyncTest'}},history:[]},revision:1};
  const context=await browser.newContext();
  await context.addInitScript(session=>localStorage.setItem('dorra-online-auth',JSON.stringify(session)),session);
  let socket,joined;let reads=0;
  await context.routeWebSocket(`wss://${supabaseHost}/realtime/**`,ws=>{
    socket=ws;
    ws.onMessage(raw=>{
      const [joinRef,ref,topic,event,payload]=JSON.parse(raw);
      if(event==='phx_join'){
        joined={joinRef,topic,payload};
        ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:[]}}]));
      }else if(event==='heartbeat'||event==='phx_leave')ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]));
    });
  });
  const harness='<html><body><output id="balance"></output><script type="module">import {createVaultClient} from "./vault-client.js";window.vault=await createVaultClient();document.querySelector("#balance").textContent=String(vault.snapshot.balance);vault.subscribe(snapshot=>document.querySelector("#balance").textContent=String(snapshot.balance));window.ready=true;</script></body></html>';
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.hostname!==supabaseHost)return serveSource(route,harness);
    const body=route.request().postDataJSON();
    let value;
    if(url.pathname.endsWith('/dorra-admin'))value={messages:[],serverNow:new Date().toISOString()};
    else {
      validateBody(body);
      if(body.action==='acquire')value={snapshot:saved.snapshot,revision:saved.revision,serverNow:Date.now()};
      else {assert.equal(body.action,'refresh');reads++;value=sessionRefresh(saved,body.expectedRevision,Date.now(),body.args.ifChanged===true);}
    }
    await route.fulfill({status:200,headers:responseHeaders,body:JSON.stringify(value)});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  try{
    await page.goto(baseURL+'__vault-harness.html');await page.waitForFunction(()=>window.ready);
    await page.waitForFunction(async()=>{const {supabase}=await import('./auth-client.js');return supabase.getChannels().some(c=>c.state==='joined');});
    assert.equal(joined.topic,`realtime:dorra-save:${id}`);
    assert.equal(joined.payload.config.private,true);
    const emit=payload=>socket.send(JSON.stringify([joined.joinRef,null,joined.topic,'broadcast',{type:'broadcast',event:'save-changed',payload}]));
    saved.snapshot.balance=11000;saved.revision++;
    emit({revision:saved.revision,balance:9e15,snapshot:{balance:9e15}});
    await page.waitForFunction(()=>document.querySelector('#balance').textContent==='11000');
    assert.equal(await page.evaluate(()=>vault.snapshot.balance),11000,'Broadcast payloads are never authoritative');
    const before=reads;emit({revision:'999999',balance:9e15});
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
    assert.equal(reads,before,'Invalid revision hints cannot trigger a read');
    socket.close();saved.snapshot.balance=12000;saved.revision++;
    await page.clock.fastForward(15000);
    await page.waitForFunction(()=>document.querySelector('#balance').textContent==='12000');
    await page.evaluate(()=>vault.close());
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
