import test from 'node:test';
import assert from 'node:assert/strict';
import {warDatabase} from './war-database-helpers.mjs';

test('batched notifications preserve individual fog rules and owner-only readiness',{timeout:120000},async()=>{
 const db=await warDatabase(),mid=crypto.randomUUID(),actors={A:crypto.randomUUID(),B:crypto.randomUUID(),C:crypto.randomUUID()};
 try{
  for(const uid of Object.values(actors))await db.query('insert into auth.users(id) values($1)',[uid]);
  await db.query("insert into dorra_private.war_matches(id,name,host_id,template,opponent,pace,visibility,speed,limit_seconds) values($1,'Batch fog fixture',$2,'world','human','fast','public',360,2592000)",[mid,actors.A]);
  for(const[nation,uid]of Object.entries(actors)){
   await db.query('insert into dorra_private.war_sides(match_id,nation_id,user_id) values($1,$2,$3)',[mid,nation,uid]);
   await db.query('insert into dorra_private.war_observers(match_id,user_id) values($1,$2)',[mid,uid]);
  }
  for(const[id,owner,lat,lng]of [['A','A',0,0],['B','B',0,.5],['C','B',0,1.2],['D','C',10,20],['E','B',0,.85]]){
   await db.query('insert into dorra_private.war_catalog_provinces(id,country_id,name,data) values($1,$2,$1,$3)',[id,owner,JSON.stringify({lat,lng,neighbors:[]})]);
   await db.query('insert into dorra_private.war_provinces(match_id,province_id,nation_id) values($1,$2,$3)',[mid,id,owner]);
  }
  for(const[id,domain,caps,stats]of [
   ['infantry','land',[],{vision:20,radar:0}],['sensor','support',[],{vision:90,radar:100}],
   ['sub','sea',['submarine'],{vision:20,stealth:85}],['sonar','sea',['sonar'],{vision:100,radar:0}],
   ['stealth','air',[],{vision:10,stealth:85}],['jammer','air',['electronic-attack'],{vision:10,range:250}]
  ])await db.query('insert into dorra_private.war_catalog_platforms(id,name,data) values($1,$1,$2)',[id,JSON.stringify({domain,capabilities:caps,stats})]);
  const unit=async(nation,province,platform,health=100)=>{
   const id=crypto.randomUUID();await db.query('insert into dorra_private.war_units(id,match_id,nation_id,province_id,platform_id,name,domain,health) select $1,$2,$3,$4,id,id,data->>\'domain\',$6 from dorra_private.war_catalog_platforms where id=$5',[id,mid,nation,province,platform,health]);return id;
  };
  const parity=async()=>{
   const expected=(await db.query('select o.user_id,u.id unit_id from dorra_private.war_observers o join dorra_private.war_sides s on s.match_id=o.match_id and s.user_id=o.user_id cross join lateral dorra_private.war_visible_units(o.match_id,s.nation_id) u where o.match_id=$1 order by o.user_id,u.id',[mid])).rows;
   const actual=(await db.query('select * from dorra_private.war_observer_visibility($1) order by user_id,unit_id',[mid])).rows;
   assert.deepEqual(actual,expected);
  };
  const revisions=async()=>Object.fromEntries((await db.query('select user_id,revision from dorra_private.war_observers where match_id=$1',[mid])).rows.map(x=>[x.user_id,Number(x.revision)]));
  const own=await unit('A','A','infantry');await unit('A','A','sensor');
  await unit('B','B','infantry');await unit('B','B','sub');await unit('B','C','stealth');
  await unit('B','A','sub');await unit('B','A','infantry',0);await unit('C','D','infantry');
  const hidden=await unit('B','D','infantry');await unit('B','E','infantry');
  await parity();
  await unit('A','A','sonar');await parity();
  await db.query("update dorra_private.war_provinces set facilities='{\"radar\":3}' where match_id=$1 and province_id='A'",[mid]);await parity();
  await unit('B','B','jammer');await parity();
  await db.query("update dorra_private.war_sides set research='[\"networked-command\"]' where match_id=$1 and nation_id='A'",[mid]);await parity();
  await db.query("insert into dorra_private.war_relations(match_id,a,b,relation) values($1,'A','C','alliance')",[mid]);await parity();
  await db.query('select dorra_private.war_notify($1)',[mid]);const before=await revisions();
  await db.query('update dorra_private.war_units set health=90 where id=$1',[hidden]);
  await db.query('select dorra_private.war_notify($1)',[mid]);const changed=await revisions();
  assert.equal(changed[actors.A],before[actors.A],'unseen changes never generate an observer hint');
  assert.ok(changed[actors.B]>before[actors.B],'the changed formation owner receives a hint');
  await db.query('update dorra_private.war_units set entrenchment=10 where id=$1',[own]);
  await db.query('select dorra_private.war_notify($1)',[mid]);const readiness=await revisions();
  assert.ok(readiness[actors.A]>changed[actors.A],'own readiness participates in the private fingerprint');
  assert.equal(readiness[actors.B],changed[actors.B],'visible foreign readiness remains private');
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from dorra_private.war_observer_visibility($1)',[mid]),/permission denied/);
 }finally{await db.close();}
});
