import test from 'node:test';
import assert from 'node:assert/strict';
import {saveControls,editSaveField} from '../supabase/functions/dorra-admin/save-controls.mjs';
import {prepareChange,validate} from '../supabase/functions/dorra-admin/model.mjs';
import {createAdminHandler} from '../supabase/functions/dorra-admin/handler.mjs';
import {initializeHouse} from '../supabase/functions/dorra-api/house-progression.mjs';
import {reduceFootball} from '../supabase/functions/dorra-api/football.mjs';
import {reduceCampaign} from '../supabase/functions/dorra-api/campaign.mjs';
import {createCareer} from '../airport/engine.mjs';
import {MAX_BALANCE} from '../game-limits.js';
import {normalizeFootballState} from '../football/football-engine.js';
const id='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',owner={role:'admin',owner:true};
function fixture(){const snapshot={balance:1000,progress:{level:12,xp:1000},stats:{sessions:10,wins:2}};initializeHouse(snapshot);snapshot.progress.level=12;snapshot.progress.xp=1000;return {snapshot,privateState:{secret:{deck:['concealed']}},profile:{username:'Target',owner:false},revision:1};}
test('structured controls cover all six modes without exposing private outcome state',async()=>{
 let saved=fixture();const football=await reduceFootball(saved.snapshot,saved.privateState,'startClub',{args:[{name:'QA Club',siteId:'caboolture',ownerInvestmentAud:0,startupLoanAud:2000000,academyFeeAud:1750,weeklyFirstTeamBudget:5000,playingStyle:'balanced'}]},Date.now());saved={...saved,...football};
 saved={...saved,...await reduceCampaign(saved.snapshot,saved.privateState,'create',{homeCountryId:'AU',scenarioId:'open-world'},Date.now())};saved.privateState.airport=createCareer(Date.now(),37);
 const domains=saveControls(saved);assert.equal(domains.length,6);assert.ok(domains.every(d=>d.available));for(const f of domains.flatMap(d=>d.controls))if(f.type==='number'){assert.ok(Number.isFinite(f.min)&&Number.isFinite(f.max),f.label+' has finite bounds');assert.ok(f.min<=f.max,f.label+' has consistent bounds');}assert.ok(!JSON.stringify(domains).includes('concealed'));
 for(const domain of domains){const field=domain.controls.find(f=>f.type==='number'&&f.min<f.max);const result=editSaveField(saved,{fieldId:field.id,value:field.min});assert.equal(result.changes[0].after,field.min);assert.deepEqual(result.privateState.secret,saved.privateState.secret);assert.throws(()=>editSaveField(saved,{fieldId:field.id,value:field.max+1}),/whole number/);}
 const cash=domains.find(d=>d.domain==='Football').controls.find(f=>f.label==='Club cash');assert.equal(cash.max,MAX_BALANCE);assert.equal(cash.min,-1_000_000_000);assert.equal(editSaveField(saved,{fieldId:cash.id,value:MAX_BALANCE}).changes[0].after,MAX_BALANCE);
 for(const f of domains.find(d=>d.domain==='Football').controls.filter(f=>f.type==='number')){
  const edited=editSaveField(saved,{fieldId:f.id,value:f.max});const normalized=normalizeFootballState({...edited.snapshot.progress.footballManager,seed:saved.privateState.football.seed});
  const next=saveControls({...edited,snapshot:{...edited.snapshot,progress:{...edited.snapshot.progress,footballManager:normalized}}}).find(d=>d.domain==='Football').controls.find(c=>c.id===f.id);
  assert.equal(next?.value,f.max,f.label+' survives game normalization');
 }
 const facility=domains.find(d=>d.domain==='Airport').controls.find(f=>f.id.includes('|buildings|'));assert.ok(facility,'owned, available facilities have structured controls');const edited=editSaveField(saved,{fieldId:facility.id,value:facility.max});assert.equal(edited.changes[0].after,facility.max);assert.equal(edited.privateState.airport.seed,saved.privateState.airport.seed);
 assert.throws(()=>editSaveField(saved,{fieldId:'privateState.secret.deck',value:0}),/available/);
 const absent=saveControls(fixture());assert.equal(absent.find(d=>d.domain==='Football').available,false);assert.equal(absent.find(d=>d.domain==='Airport').available,false);
});
test('owner save changes are bounded, stable, consistent and audit dependent XP changes',()=>{
 const saved=fixture(),level=saveControls(saved)[0].controls.find(f=>f.label==='Level');
 const result=prepareChange(saved,{action:'save-field',fieldId:level.id,value:1},owner);assert.equal(result.snapshot.progress.xp,299);assert.equal(result.changes.length,2);assert.equal(saved.snapshot.progress.level,12);
 const wins=saveControls(saved)[0].controls.find(f=>f.label==='Wins');assert.throws(()=>editSaveField(saved,{fieldId:wins.id,value:11}),/whole number/);
 for(const action of ['save-field','password-set','announcement'])assert.throws(()=>prepareChange(saved,{action},{role:'admin',owner:false}),e=>e.code==='PERMISSION_DENIED');
 assert.throws(()=>validate({operation:'preview',args:{action:'save-field',targetId:id,reason:'Fix',fieldId:level.id}}),/revision/);
 assert.throws(()=>validate({operation:'commit',previewId:id,requestId:session,newPassword:'short'}),/12–128/);
});
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const request=input=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${encode({})}.${encode({session_id:session})}.verified`},body:JSON.stringify(input)});
test('password changes persist only a keyed retry binding, replay without updating Auth twice, and fail safely',async()=>{
 for(const replayed of [false,true]){const calls=[],updates=[];const handle=createAdminHandler({getUser:async()=>({id}),passwordBinding:async()=> 'a'.repeat(64),setPassword:async(...args)=>{updates.push(args);return true;},rpc:async(name,args)=>{calls.push({name,args});return {data:name.endsWith('begin')?{replayed,result:{ok:true},jobId:id,claim:session,targetId:id}:{ok:true}};}});
 const input={operation:'commit',previewId:id,requestId:session,newPassword:'Chosen password 123!'};const response=await handle(request(input));assert.equal(response.status,200);assert.equal(updates.length,replayed?0:1);assert.ok(!JSON.stringify(calls).includes(input.newPassword));assert.ok(!JSON.stringify(await response.json()).includes(input.newPassword));}
 const handle=createAdminHandler({getUser:async()=>({id}),passwordBinding:async()=> 'b'.repeat(64),setPassword:async()=>false,rpc:async name=>({data:name.endsWith('begin')?{jobId:id,claim:session,targetId:id}:{ok:false}})});
 const response=await handle(request({operation:'commit',previewId:id,requestId:session,newPassword:'Chosen password 123!'}));assert.equal(response.status,503);assert.equal((await response.json()).code,'PASSWORD_FAILED');
});
test('save controls reject a stale revision before creating a preview',async()=>{
 const calls=[],handle=createAdminHandler({getUser:async()=>({id}),rpc:async name=>{calls.push(name);return {data:name.endsWith('status')?owner:fixture()};}});
 const response=await handle(request({operation:'preview',args:{action:'save-field',targetId:id,reason:'Fix',fieldId:'House|balance',saveRevision:0,value:100}}));assert.equal(response.status,409);assert.ok(!calls.includes('dorra_admin_preview'));
});
