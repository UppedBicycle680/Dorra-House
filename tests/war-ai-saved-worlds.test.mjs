import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {warDatabase} from './war-database-helpers.mjs';
import {isolatedAiScenario} from './war-ai-fixtures.mjs';

test('saved solo worlds repair only a missing configured rival relation', {timeout:120000}, async t => {
 const db=await warDatabase();
 const migrations=new URL('../supabase/migrations/',import.meta.url);
 const name=(await readdir(migrations)).find(name=>name.endsWith('_war_saved_world_rival_relations.sql'));
 assert.ok(name,'the compatibility migration is retained in source');
 const repair=await readFile(new URL(name,migrations),'utf8');
 const prepare=async(f,status='running')=>{
  await db.query("update dorra_private.war_matches set template='world',status=$2,revision=17,notify_dirty=false where id=$1",[f.mid,status]);
  await db.query('update dorra_private.war_sides set user_id=$2,is_ai=false,active_ai=false,enemy_nation_id=null where match_id=$1 and nation_id=$3',[f.mid,f.host,f.b]);
  await db.query('insert into dorra_private.war_observers(match_id,user_id) values($1,$2)',[f.mid,f.host]);
  await db.query('delete from dorra_private.war_relations where match_id=$1',[f.mid]);
 };
 const relation=async f=>(await db.query('select a,b,relation,proposal,proposed_by from dorra_private.war_relations where match_id=$1 order by a,b',[f.mid])).rows;
 const project=async(f,view,base=null)=>(await db.query('select public.dorra_war_projection($1,$2,$3,$4) result',[f.host,f.mid,base,JSON.stringify(view)])).rows[0].result;
 try {
  for(const status of ['running','paused']) await t.test(`${status} legacy world establishes its opening war and refreshes cached diplomacy`,()=>isolatedAiScenario(db,{},async f=>{
   await prepare(f,status);
   await db.query('update dorra_private.war_matches set real_anchor=clock_timestamp()+interval \'1 hour\' where id=$1',[f.mid]);
   const before=(await db.query('select dorra_private.war_view($1,$2) view',[f.mid,f.host])).rows[0].view;
   const cached=await project(f,before);
   assert.deepEqual(before.diplomacy,[],'this is an already-started old world with no relation');
   await db.exec(repair);
   assert.deepEqual(await relation(f),[{a:f.a,b:f.b,relation:'war',proposal:null,proposed_by:null}]);
   const match=(await db.query('select revision,notify_dirty,status from dorra_private.war_matches where id=$1',[f.mid])).rows[0];
   assert.equal(Number(match.revision),18,'the new diplomacy must have a newer authoritative source revision');
   assert.equal(match.status,status,'repair must not resume or pause the match');
   assert.equal(match.notify_dirty,false,'the normal filtered notifier consumes the dirty flag even while paused');
   assert.equal(Number((await db.query('select revision from dorra_private.war_observers where match_id=$1',[f.mid])).rows[0].revision),1);
   const after=(await db.query('select dorra_private.war_view($1,$2) view',[f.mid,f.host])).rows[0].view;
   const delta=await project(f,after,cached.view.match.revision);
   assert.equal(delta.delta.fields.diplomacy[0].relation,'war');
   const delayed=await project(f,before,delta.delta.revision);
   assert.equal(delayed.view.diplomacy[0].relation,'war','a delayed pre-repair response must not erase the repaired relation');
   await db.exec(repair);
   assert.equal(Number((await db.query('select revision from dorra_private.war_matches where id=$1',[f.mid])).rows[0].revision),18,'rerunning the migration must not mutate an already repaired world');
  }));

  for(const state of ['peace','ceasefire','alliance','war']) await t.test(`explicit ${state} and pending diplomacy remain intact`,()=>isolatedAiScenario(db,{},async f=>{
   await prepare(f,'paused');
   await db.query('insert into dorra_private.war_relations(match_id,a,b,relation,proposal,proposed_by) values($1,$2,$3,$4,\'peace\',$3)',[f.mid,f.a,f.b,state]);
   const before=await relation(f);await db.exec(repair);
   assert.deepEqual(await relation(f),before);
   assert.equal(Number((await db.query('select revision from dorra_private.war_matches where id=$1',[f.mid])).rows[0].revision),17,'an explicit diplomatic decision must not be dirtied or revised');
  }));

  for(const scenario of ['lobby','finished','human','duel','inactive-rival','retired-rival','retired-commander','missing-commander','unconfigured-rival']) await t.test(`${scenario} is outside the saved-world repair`,()=>isolatedAiScenario(db,{},async f=>{
   await prepare(f);
   if(['lobby','finished'].includes(scenario)) await db.query('update dorra_private.war_matches set status=$2 where id=$1',[f.mid,scenario]);
   if(scenario==='human') await db.query("update dorra_private.war_matches set opponent='human' where id=$1",[f.mid]);
   if(scenario==='duel') await db.query("update dorra_private.war_matches set template='duel' where id=$1",[f.mid]);
   if(scenario==='inactive-rival') await db.query('update dorra_private.war_sides set active_ai=false where match_id=$1 and nation_id=$2',[f.mid,f.a]);
   if(scenario==='retired-rival') await db.query('update dorra_private.war_sides set retired=true where match_id=$1 and nation_id=$2',[f.mid,f.a]);
   if(scenario==='retired-commander') await db.query('update dorra_private.war_sides set retired=true where match_id=$1 and nation_id=$2',[f.mid,f.b]);
   if(scenario==='missing-commander') await db.query('update dorra_private.war_sides set user_id=null where match_id=$1 and nation_id=$2',[f.mid,f.b]);
   if(scenario==='unconfigured-rival') await db.query('update dorra_private.war_sides set enemy_nation_id=null where match_id=$1 and nation_id=$2',[f.mid,f.a]);
   await db.exec(repair);
   assert.deepEqual(await relation(f),[]);
   assert.equal(Number((await db.query('select revision from dorra_private.war_matches where id=$1',[f.mid])).rows[0].revision),17);
  }));
 }finally{await db.close();}
});
