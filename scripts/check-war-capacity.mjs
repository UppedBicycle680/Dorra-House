import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {warDatabase} from '../tests/war-database-helpers.mjs';

// Runs the actual SQL engine against the complete production catalogue locally.
// This measures a repeatable launch envelope; hosted verification remains required.
const db=await warDatabase(),report={worlds:4,humansPerWorld:12,measurements:[],startedAt:new Date().toISOString()};
const nations=['AU','NZ','US','GB','FR','DE','RU','CN','IN','JP','CA','BR'],worlds=[];
async function timed(label,operation){const start=performance.now(),value=await operation();const ms=Math.round(performance.now()-start);report.measurements.push({label,ms});console.log(label+': '+ms+'ms');return value;}
try{
 for(const file of (await readdir('scripts/war-seed')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('scripts/war-seed/'+file,'utf8'));
 report.catalog=(await db.query('select (select count(*) from dorra_private.war_catalog_nations)::int nations,(select count(*) from dorra_private.war_catalog_provinces)::int provinces,(select count(*) from dorra_private.war_catalog_platforms)::int platforms')).rows[0];
 console.log('Loaded complete catalogue: '+JSON.stringify(report.catalog));
 for(let w=0;w<4;w++){
  const actors=[];
  for(let n=0;n<12;n++){const a={id:crypto.randomUUID(),session:crypto.randomUUID(),lease:crypto.randomUUID(),nation:nations[n]};actors.push(a);
   await db.query('insert into auth.users(id) values($1)',[a.id]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[a.session,a.id]);await db.query('insert into dorra_private.profiles(user_id) values($1)',[a.id]);
   await db.query("insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values($1,$2,$3,'{\"balance\":1000,\"progress\":{}}')",[a.id,a.session,a.lease]);
  }
  const command=async(a,action,args={},mid=null)=>(await db.query('select public.dorra_war_command($1,$2,$3,$4,$5,$6::jsonb,$7) r',[a.id,a.session,a.lease,action,mid,JSON.stringify(args),crypto.randomUUID()])).rows[0].r;
  const initial=await timed('World '+(w+1)+' create',()=>command(actors[0],'create',{nationId:'AU',opponentNationId:'NZ',template:'world',opponent:'human',pace:w%2?'persistent':'fast',visibility:'public',name:'Capacity world '+w}));
  const mid=initial.view.match.id;
  await timed('World '+(w+1)+' join 11 humans',async()=>{for(const a of actors.slice(1))await command(a,'join',{nationId:a.nation},mid);});
  await timed('World '+(w+1)+' start',()=>command(actors[0],'start',{},mid));
  worlds.push({mid,actors,command});
 }
 await db.exec("update dorra_private.war_matches set real_anchor=clock_timestamp()-interval '12 seconds',last_dispatch=clock_timestamp(),next_due=clock_timestamp() where status='running'");
 await timed('Four-world dispatcher',()=>db.exec('select dorra_private.war_dispatch()'));
 const bytes=[];
 for(const world of worlds){
  const a=world.actors[0],view=(await world.command(a,'view',{},world.mid)).view;
  const first=(await db.query('select public.dorra_war_projection($1,$2,null,$3::jsonb) r',[a.id,world.mid,JSON.stringify(view)])).rows[0].r;
  const next=(await world.command(a,'view',{},world.mid)).view;
  const delta=(await db.query('select public.dorra_war_projection($1,$2,$3,$4::jsonb) r',[a.id,world.mid,first.view.match.revision,JSON.stringify(next)])).rows[0].r;
  bytes.push({snapshot:Buffer.byteLength(JSON.stringify(first)),delta:Buffer.byteLength(JSON.stringify(delta))});
 }
 report.bandwidth=bytes;report.state=(await db.query("select status,count(*)::int count from dorra_private.war_matches group by status")).rows;
 report.databaseBytes=(await db.query('select pg_database_size(current_database())::bigint bytes')).rows[0].bytes;
 report.scheduler=(await db.query('select error_count,last_error from dorra_private.war_matches where error_count>0')).rows;
 if(report.scheduler.length)throw new Error('The dispatcher encountered a simulation error');
 if(!bytes.every(b=>b.delta<10000))throw new Error('Unchanged projection exceeds its bandwidth budget');
 report.ok=true;console.log('Capacity envelope completed: 4 full worlds / 48 human memberships.');
}catch(error){report.ok=false;report.failure={message:error.message,where:error.where};console.error('Capacity check failed: '+error.message);process.exitCode=1;}
finally{await db.close();await mkdir('work',{recursive:true});await writeFile('work/war-capacity-report.json',JSON.stringify(report,null,2));}
