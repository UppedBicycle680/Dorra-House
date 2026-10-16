import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {warDatabase} from './war-database-helpers.mjs';
import {isolatedAiScenario} from './war-ai-fixtures.mjs';

test('persisted health precision remains bounded through long combat and recovery',{timeout:120000},async t=>{
 const db=await warDatabase();
 const health=async id=>(await db.query('select health::text value,scale(health)::int scale from dorra_private.war_units where id=$1',[id])).rows[0];
 try{
  await t.test('migration rounds existing unrestricted health without breaking composite-return functions',()=>isolatedAiScenario(db,{},async f=>{
   const id=await f.unit();
   // Reproduce a pre-migration saved row with excessive fractional precision.
   await db.exec('alter table dorra_private.war_units alter column health type numeric');
   await db.query("update dorra_private.war_units set health='23.123456789123456789123456789123456789'::numeric where id=$1",[id]);
   const directory=new URL('../supabase/migrations/',import.meta.url);
   const name=(await readdir(directory)).find(name=>name.endsWith('_war_health_precision.sql'));
   const sql=await readFile(new URL(name,directory),'utf8');
   // The declaration is already narrowed by the first migration application;
   // simulate its prior declaration before reapplying the upgrade to old data.
   const definition=(await db.query("select pg_get_functiondef('dorra_private.war_combat(uuid,numeric)'::regprocedure) definition")).rows[0].definition;
   await db.exec(definition.replace('new_health numeric(20,6);','new_health numeric;'));
   await db.exec(sql);
   assert.deepEqual(await health(id),{value:'23.123457',scale:6});
   assert.equal((await db.query('select health::text health from dorra_private.war_visible_units($1,$2) where id=$3',[f.mid,f.a,id])).rows[0].health,'23.123457','Functions returning war_units retain their composite result');
  }));

  await t.test('hundreds of real damage and paid repair pulses retain six fractional digits',()=>isolatedAiScenario(db,{},async f=>{
   const a=await f.unit('__ai-infantry','AF',f.a,{strength:.001});
   const b=await f.unit('__ai-infantry','AF',f.b,{strength:.001});
   const damaged=await f.unit('__ai-infantry','AH',f.a,{health:20});
   await f.unit('__ai-engineers','AH');
   let changed=false,repaired=false;
   for(let pulse=0;pulse<240;pulse++){
    await db.query('select dorra_private.war_combat($1,$2)',[f.mid,pulse*3600]);
    for(const id of [a,b,damaged]){
     const current=await health(id);assert.ok(current,'Low-strength formations survive the long precision exercise');
     assert.equal(current.scale,6);assert.ok(current.value.length<=10,'100HP rows cannot acquire kilobytes of fractional digits');
     if(id===a)changed ||= Number(current.value)<100;
     if(id===damaged)repaired ||= Number(current.value)>20;
    }
   }
   assert.ok(changed,'The test exercises actual percentage damage, not repeated assignment of a literal');
   assert.ok(repaired,'The combat pulse also runs the ordinary supply-funded repair path');
   assert.ok((await db.query("select count(*)::int n from dorra_private.war_reports where match_id=$1 and body->>'type'='combat'",[f.mid])).rows[0].n>=400);
   assert.ok((await db.query('select health from dorra_private.war_visible_units($1,$2) where id=$3',[f.mid,f.a,a])).rows.length);
  }));

  await t.test('rounding a sub-micro-HP survivor to zero reports the same destruction that is persisted',()=>isolatedAiScenario(db,{},async f=>{
   const victim=await f.unit('__ai-infantry','AF',f.a,{health:.000001});
   const attacker=await f.unit('__ai-infantry','AF',f.b);
   await db.query("select dorra_private.war_schedule_move($1,$2,$3,'retreat',0)",[f.mid,victim,f.pid('AH')]);
   const arrival=Number((await f.getUnit(victim)).orders.arrival);
   // Choose a legal tiny formation strength whose actual ordinary hit is
   // 0.6micro-HP. The remaining0.4micro-HP must round to zero consistently.
   await db.query(`update dorra_private.war_units set strength=.0000006/(
    dorra_private.war_weapon_power(ap.data,dp.data,'{}')*dorra_private.war_supply($1,$2,$3)
    /greatest(1,(dp.data#>>'{stats,defense}')::numeric/8)*(1.1-80::numeric/500))
    from dorra_private.war_catalog_platforms ap,dorra_private.war_catalog_platforms dp
    where dorra_private.war_units.id=$4 and ap.id='__ai-infantry' and dp.id='__ai-infantry'`,[f.mid,f.b,f.pid('AF'),attacker]);
   await db.query('select dorra_private.war_combat($1,0)',[f.mid]);
   assert.equal(await health(victim),undefined,'Zero-HP formations are removed by the ordinary combat cleanup');
   const report=(await db.query("select body from dorra_private.war_reports where match_id=$1 and body->>'unitId'=$2 and body->>'type'='combat' order by id desc limit 1",[f.mid,victim])).rows[0]?.body;
   assert.equal(report?.destroyed,true,'The report cannot describe a rounded-to-zero formation as still alive');
   assert.ok(await health(attacker),'Simultaneous retaliation does not remove the healthy attacker');
   await f.advance(arrival+1);
   assert.equal((await db.query("select count(*)::int n from dorra_private.war_events where match_id=$1 and kind='arrival' and payload->>'unitId'=$2",[f.mid,victim])).rows[0].n,0,'The queued movement event is safely consumed after its formation dies');
   assert.equal((await db.query("select count(*)::int n from dorra_private.war_reports where match_id=$1 and body->>'type'='arrival' and body->>'unitId'=$2",[f.mid,victim])).rows[0].n,0,'A dead formation cannot arrive or be resurrected by an old event');
  }));
 }finally{await db.close();}
});
