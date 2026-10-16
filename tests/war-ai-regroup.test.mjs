import test from 'node:test';
import assert from 'node:assert/strict';
import {warDatabase} from './war-database-helpers.mjs';
import {isolatedAiScenario} from './war-ai-fixtures.mjs';

const rich={cash:60000,supplies:30000,fuel:30000,electronics:20000,manpower:30000};

test('solo AI regroups casualties through the ordinary repair and production rules',{timeout:120000},async t=>{
 const db=await warDatabase();
 try{
  await t.test('a battered soft-capped army repairs for72hours and resumes offense without exposing its capital',()=>isolatedAiScenario(db,{resources:rich},async f=>{
   const garrison=await f.unit();const wounded=[];
   for(let i=0;i<7;i++)wounded.push(await f.unit('__ai-infantry','AH',f.a,{health:20}));
   await db.query("insert into dorra_private.war_events(match_id,kind,due) values($1,'combat',3600)",[f.mid]);
   const before=await f.side();await f.decide();
   assert.ok((await Promise.all(wounded.map(f.getUnit))).every(u=>Object.keys(u.orders).length===0),'Safe casualties must not shuttle between rear provinces');
   let jobs=(await f.events()).filter(e=>e.kind==='produce');
   assert.deepEqual(jobs.map(e=>e.payload.platformId),['__ai-engineers'],'One legally researched recovery team may exceed the8-formation planning target');
   const after=await f.side();
   for(const [resource,cost] of Object.entries({cash:800,supplies:300,fuel:100,electronics:100,manpower:100}))assert.equal(Number(before.resources[resource])-Number(after.resources[resource]),cost,'Recovery production must pay its exact normal '+resource+' cost');
   await f.decide();
   assert.equal((await f.events()).filter(e=>e.kind==='produce').length,1,'A queued recovery team closes the exception immediately');
   let recovered=false,offense=false,guarded=true,produced=0;
   for(let hour=1;hour<=72;hour++){
    await f.advance(hour*3600);
    const state=(await db.query('select status from dorra_private.war_matches where id=$1',[f.mid])).rows[0];
    const troops=await Promise.all(wounded.map(f.getUnit));
    recovered ||= troops.some(u=>u&&Number(u.health)>=75);
    offense ||= troops.some(u=>u&&u.orders.type==='attack');
    const guard=await f.getUnit(garrison);guarded &&= !!guard&&guard.province_id===f.pid('AH')&&Object.keys(guard.orders).length===0;
    produced=Math.max(produced,(await db.query("select count(*)::int n from dorra_private.war_units where match_id=$1 and nation_id=$2 and platform_id='__ai-engineers'",[f.mid,f.a])).rows[0].n);
    if(state.status!=='running')break;
    if(hour%6===0)await f.decide(f.a,hour*3600);
   }
   assert.ok(recovered,'Existing paid2HP/hour field repair must bring wounded troops back to usable strength');
   assert.ok(offense,'Recovered non-reserve troops must eventually resume a legal offensive order');
   assert.ok(guarded,'The original fit capital garrison must remain available throughout recovery');
   assert.equal(produced,1,'The exception must not repeatedly add recovery teams above the planning cap');
   assert.ok((await db.query('select count(*)::int n from dorra_private.war_units where match_id=$1 and nation_id=$2',[f.mid,f.a])).rows[0].n<=9);
  }));

  await t.test('field repair retains its shared rate and supply cost while recovery orders remain stable',()=>isolatedAiScenario(db,{resources:rich},async f=>{
   await f.unit();const wounded=await f.unit('__ai-infantry','AH',f.a,{health:20});await f.unit('__ai-engineers');
   await db.query('select dorra_private.war_accrue($1,$2,0)',[f.mid,f.a]);
   const supplies=Number((await f.side()).resources.supplies);
   await db.query('select dorra_private.war_field_support($1)',[f.mid]);
   assert.equal(Number((await f.getUnit(wounded)).health),22,'AI repair uses the same2HP pulse as every formation');
   assert.equal(supplies-Number((await f.side()).resources.supplies),2,'The common repair pulse consumes supplies');
   await f.decide();const unit=await f.getUnit(wounded);
   assert.deepEqual(unit.orders,{});assert.equal(unit.generation,0);
   assert.equal((await f.events()).filter(e=>e.kind==='arrival'&&e.payload.unitId===wounded).length,0);
  }));

  await t.test('a repair team travels to uncovered own casualties during a truce and stays to provide actual repairs',()=>isolatedAiScenario(db,{resources:rich},async f=>{
   await f.unit();const wounded=await f.unit('__ai-infantry','AH',f.a,{health:50});const engineer=await f.unit('__ai-engineers','AP');
   await db.query("update dorra_private.war_relations set relation='ceasefire' where match_id=$1",[f.mid]);
   await f.decide();const enRoute=await f.getUnit(engineer);
   assert.equal(enRoute.orders.type,'move');assert.equal(enRoute.orders.targetProvinceId,f.pid('AH'));
   assert.deepEqual((await f.getUnit(wounded)).orders,{},'A casualty waits for its inbound recovery team instead of crossing it on the road');
   await f.advance(Number(enRoute.orders.arrival)+1);await f.decide(f.a,21600);
   assert.equal((await f.getUnit(engineer)).province_id,f.pid('AH'));
   assert.deepEqual((await f.getUnit(engineer)).orders,{},'Repair support must not leave active casualty care for an empty front');
   assert.equal((await db.query('select relation from dorra_private.war_relations where match_id=$1',[f.mid])).rows[0].relation,'ceasefire','Recovery must not re-declare war');
  }));

  await t.test('the recovery exception cannot bypass hard capacity, research, money, national eligibility or fog',()=>isolatedAiScenario(db,{resources:rich,researched:false},async f=>{
   await f.unit();for(let i=0;i<7;i++)await f.unit('__ai-infantry','AH',f.a,{health:20});
   await db.query("insert into dorra_private.war_catalog_platforms(id,name,data) select '__ai-foreign-repair','Unavailable foreign recovery team',data||'{\"operators\":[\"ZZ\"],\"exportable\":false}'::jsonb from dorra_private.war_catalog_platforms where id='__ai-engineers'");
   await db.query('update dorra_private.war_sides set research=\'["__ai-infantry","__ai-foreign-repair"]\'::jsonb where match_id=$1 and nation_id=$2',[f.mid,f.a]);
   await f.decide();
   assert.equal((await f.events()).filter(e=>e.kind==='produce').length,0,'Neither unresearched native hardware nor a researched foreign operator trap may enter production');
   assert.ok((await f.events()).some(e=>e.kind==='research'&&e.payload.platformId==='__ai-engineers'),'The missing normal recovery capability is researched first');
   await db.query('update dorra_private.war_sides set research=research||\'["__ai-engineers"]\'::jsonb,resources=\'{"cash":1000,"supplies":300,"fuel":200,"electronics":100,"manpower":200}\'::jsonb where match_id=$1 and nation_id=$2',[f.mid,f.a]);
   await f.decide();assert.equal((await f.events()).filter(e=>e.kind==='produce').length,0,'Ordinary reserves and actual prices still apply');
   await db.query('update dorra_private.war_sides set resources=$3 where match_id=$1 and nation_id=$2',[f.mid,f.a,JSON.stringify(rich)]);
   for(let i=0;i<72;i++)await f.unit('__ai-infantry','AH',f.a,{health:20});
   await f.decide();assert.equal((await f.events()).filter(e=>e.kind==='produce').length,0,'The80-formation human hard cap is absolute');
   const hidden=await f.unit('__ai-armor','BX',f.b,{strength:100});
   assert.equal((await db.query('select exists(select 1 from dorra_private.war_visible_units($1,$2) where id=$3) v',[f.mid,f.a,hidden])).rows[0].v,false);
   assert.equal((await db.query('select dorra_private.war_ai_recovery_safe($1,$2,$3,0,$4::uuid[]) safe',[f.mid,f.a,f.pid('AH'),[]])).rows[0].safe,true,'An unobserved remote enemy cannot invalidate a known safe rear site');
   await db.exec('set local role authenticated');
   await assert.rejects(db.query('select dorra_private.war_ai_recovery_safe($1,$2,$3,0,$4::uuid[])',[f.mid,f.a,f.pid('AH'),[]]),/permission denied/);
  }));
 }finally{await db.close();}
});
