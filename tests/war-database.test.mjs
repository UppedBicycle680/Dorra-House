import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {warDatabase} from './war-database-helpers.mjs';

test('authoritative SQL transactions enforce combat, research, imports, visibility, sessions and rewards',{timeout:120000},async()=>{
 const db=await warDatabase();
 try{
  // Production catalogue rows must coexist with the isolated fixture. This
  // catches research/arsenal ordering assumptions hidden by a blank database.
  const seedDirectory=new URL('../scripts/war-seed/',import.meta.url);
  for(const name of (await readdir(seedDirectory)).filter(name=>name.endsWith('.sql')).sort()){
   await db.exec(await readFile(new URL(name,seedDirectory),'utf8'));
  }
  await db.exec(await readFile(new URL('../supabase/tests/war-authority.sql',import.meta.url),'utf8'));
  const {rows}=await db.query('select count(*)::integer n from dorra_private.war_matches');
  assert.equal(rows[0].n,0,'all test accounts, worlds and outcomes roll back');
 }finally{await db.close();}
});

test('runtime quotas, national starters, invitation discovery and retention preserve permanent rewards',{timeout:120000},async()=>{
 const db=await warDatabase();
 try{await db.exec(await readFile(new URL('../supabase/tests/war-runtime-limits.sql',import.meta.url),'utf8'));}
 finally{await db.close();}
});

test('surviving armies prevent premature elimination and transport landings require ports',{timeout:120000},async()=>{
 const db=await warDatabase();
 try{await db.exec(await readFile(new URL('../supabase/tests/war-survival.sql',import.meta.url),'utf8'));}
 finally{await db.close();}
});

test('projection cache emits small visible entity changes and rejects direct client access',{timeout:120000},async()=>{
 const db=await warDatabase(),uid=crypto.randomUUID(),mid=crypto.randomUUID();
 try{
  await db.query('insert into auth.users(id) values($1)',[uid]);
  await db.query("insert into dorra_private.war_matches(id,name,host_id,template,opponent,pace,visibility,speed,limit_seconds) values($1,'Projection fixture',$2,'world','ai','fast','public',360,2592000)",[mid,uid]);
  await db.query('insert into dorra_private.war_sides(match_id,nation_id,user_id) values($1,$2,$3)',[mid,'AU',uid]);
  const view={match:{id:mid,revision:12345,gameTime:100},player:{userId:uid,nationId:'AU',resources:{cash:100}},units:[{id:'u',health:100}],provinces:Array.from({length:4603},(_,i)=>({id:'p'+i,ownerId:'AU',morale:80})),reports:[]};
  const project=async(v,base=null)=>(await db.query('select public.dorra_war_projection($1,$2,$3,$4::jsonb) r',[uid,mid,base,JSON.stringify(v)])).rows[0].r;
  const first=await project(view);assert.equal(first.view.match.revision,1,'global revision is masked');
  const changed=structuredClone(view);changed.match.gameTime=101;changed.provinces[50].ownerId='NZ';changed.units=[];
  const next=await project(changed,1);assert.equal(next.delta.revision,2);assert.deepEqual(next.delta.provinces.upsert,[changed.provinces[50]]);assert.deepEqual(next.delta.units.remove,['u']);
  assert.ok(JSON.stringify(next).length<2000,'one captured province never resends the full world');
  assert.ok(JSON.stringify(next).length<JSON.stringify(first).length/50);
  const missed=await project(changed,0);assert.ok(missed.view,'a lost base recovers through a full filtered snapshot');
  const later=structuredClone(changed);later.match.revision++;later.player.research=['completed-programme'];later.nations=[{id:'AU',ownerId:uid},{id:'NZ',ownerId:'new-player'}];
  const latest=await project(later,2);assert.equal(latest.delta.revision,3,'a later mutation advances the viewer version even at the same world time');
  const delayed=await project(changed,3);assert.ok(delayed.view,'an older source snapshot recovers through the current projection');
  assert.equal(delayed.view.match.revision,3,'a delayed response must not mint a newer version for stale state');
  assert.deepEqual(delayed.view.player.research,['completed-programme']);
  assert.equal(delayed.view.nations[1].ownerId,'new-player','same-time stale lobby data cannot erase a joined commander');
  await assert.rejects(project({...view,player:{userId:crypto.randomUUID()}},2),/INVALID_PROJECTION/);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from dorra_private.war_projection_cache'),/permission denied/);
  await assert.rejects(db.query('select public.dorra_war_projection($1,$2,null,$3::jsonb)',[uid,mid,JSON.stringify(view)]),/permission denied/);
 }finally{await db.close();}
});
