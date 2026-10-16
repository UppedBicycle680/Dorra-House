import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {warDatabase} from './war-database-helpers.mjs';
import {PLATFORMS} from '../war/catalog.mjs';

const data=async name=>JSON.parse(await readFile(new URL('../assets/war/'+name,import.meta.url),'utf8'));

test('every reciprocal maritime neighbour pair retains exactly one public water polyline',async()=>{
 const [nations,naval,manifest]=await Promise.all(['nations.json','naval-routes.json','manifest.json'].map(data));
 const chunks=await Promise.all(nations.nations.map(n=>data('provinces/'+n.id+'.json')));
 const pair=(a,b)=>[a,b].sort().join('/');
 const routes=new Set(naval.routes.map(r=>pair(r.from,r.to)));
 assert.equal(routes.size,naval.routes.length,'Opposite discovery directions must not duplicate a route');
 const edges=new Set(chunks.flatMap(c=>c.features.flatMap(f=>f.properties.seaNeighbors.map(other=>pair(f.id,other)))));
 assert.deepEqual([...routes].sort(),[...edges].sort(),'One-sided nearest-port discoveries still need a polyline after reciprocal adjacency is added');
 assert.equal(manifest.counts.navalRoutes,naval.routes.length);
});

test('pinned Singapore geography supports a real port-to-port Malaysia duel route',{timeout:120000},async()=>{
 const [sg,my,nations,naval,manifest]=await Promise.all(['provinces/SG.json','provinces/MY.json','nations.json','naval-routes.json','manifest.json'].map(data));
 const provinces=[...sg.features,...my.features].map(f=>f.properties),byId=new Map(provinces.map(p=>[p.id,p]));
 const origin=byId.get('SGP-4872');assert.equal(origin.port,true);
 const destinations=origin.seaNeighbors.filter(id=>byId.get(id)?.countryId==='MY');
 assert.ok(destinations.length,'Singapore must reach a Malaysian port without passing through a third country absent from the duel');
 for(const id of destinations){assert.equal(byId.get(id).port,true);assert.ok(byId.get(id).seaNeighbors.includes(origin.id));}
 assert.ok(naval.routes.some(r=>(r.from===origin.id&&destinations.includes(r.to))||(r.to===origin.id&&destinations.includes(r.from))),'The playable maritime link retains its tested water polyline');
 assert.equal(manifest.sourceRelease,'v5.1.2');assert.equal(manifest.navalConnectivity.fallback.segmentsPerConnection,2);
 const db=await warDatabase(),uid='f7100000-0000-4000-8000-000000000001',mid='f7100000-0000-4000-8000-000000000002',unit='f7100000-0000-4000-8000-000000000003';
 try{
  await db.query('insert into auth.users(id) values($1)',[uid]);
  await db.query("insert into dorra_private.war_matches(id,name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds) values($1,'Singapore maritime regression',$2,'running','duel','ai','fast','invite',360,2592000)",[mid,uid]);
  for(const nid of ['SG','MY']){
   const n=nations.nations.find(n=>n.id===nid);await db.query('insert into dorra_private.war_catalog_nations(id,name,data) values($1,$2,$3)',[nid,n.name,JSON.stringify(n)]);
   await db.query('insert into dorra_private.war_sides(match_id,nation_id) values($1,$2)',[mid,nid]);
  }
  for(const p of provinces){
   await db.query('insert into dorra_private.war_catalog_provinces(id,country_id,name,data) values($1,$2,$3,$4)',[p.id,p.countryId,p.name,JSON.stringify(p)]);
   await db.query('insert into dorra_private.war_provinces(match_id,province_id,nation_id) values($1,$2,$3)',[mid,p.id,p.countryId]);
  }
  const infantry=PLATFORMS.find(p=>p.id==='infantry-company');
  await db.query('insert into dorra_private.war_catalog_platforms(id,name,data) values($1,$2,$3)',[infantry.id,infantry.name,JSON.stringify(infantry)]);
  await db.query("insert into dorra_private.war_relations(match_id,a,b,relation) values($1,'MY','SG','war')",[mid]);
  await db.query("insert into dorra_private.war_units(id,match_id,nation_id,province_id,platform_id,name,domain) values($1,$2,'SG',$3,$4,'Singapore landing force','land')",[unit,mid,origin.id,infantry.id]);
  await db.query("select dorra_private.war_schedule_move($1,$2,$3,'embark',0)",[mid,unit,destinations[0]]);
  const orders=(await db.query('select orders from dorra_private.war_units where id=$1',[unit])).rows[0].orders;
  assert.equal(orders.type,'embark');assert.equal(orders.targetProvinceId,destinations[0]);
  assert.ok(orders.path.every(id=>byId.has(id)),'The authoritative route cannot rely on an Indonesian or Thai transit province');
  assert.ok(Number(orders.arrival)>0);assert.ok(Number((await db.query("select resources->>'fuel' fuel from dorra_private.war_sides where match_id=$1 and nation_id='SG'",[mid])).rows[0].fuel)<3500,'The legal landing still pays ordinary movement fuel');
 }finally{await db.close();}
});
