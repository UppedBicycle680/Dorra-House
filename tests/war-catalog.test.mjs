import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {CATALOG_VERSION,PLATFORMS,BRANCHES,FACILITIES,getPlatformsForNation,facilityCost,getFacilityQuote,getResearchCost} from '../war/catalog.mjs';

const read = async file => JSON.parse(await readFile(new URL(`../assets/war/${file}`,import.meta.url),'utf8'));
const resources=['cash','supplies','fuel','electronics','manpower'];
const statKeys=['attack','defense','range','speed','vision','stealth','radar','airDefense'];

test('war platform catalogue is complete, bounded, sourced and contains no duplicate IDs',()=>{
  assert.ok(PLATFORMS.length>=60);
  assert.equal(new Set(PLATFORMS.map(p=>p.id)).size,PLATFORMS.length);
  assert.equal(BRANCHES.length,8);
  for(const p of PLATFORMS){
    assert.ok(['land','air','sea','missile','support'].includes(p.domain),p.id);
    assert.ok(BRANCHES.some(b=>b.id===p.branch),p.id);
    assert.ok(FACILITIES.some(f=>f.id===p.facility),p.id);
    assert.ok(p.operators.length>0,p.id);
    assert.match(p.sourceUrl,/^https:\/\//);
    assert.equal(p.serviceStatus,'in-service');
    for(const r of resources)assert.ok(Number.isFinite(p.cost[r])&&p.cost[r]>=0,`${p.id}/${r}`);
    for(const key of statKeys)assert.ok(Number.isFinite(p.stats[key])&&p.stats[key]>=0,`${p.id}/${key}`);
    assert.ok(p.researchHours>=0&&p.buildHours>0);
    if(p.operators.includes('*'))assert.equal(p.abstractCapability,true,`${p.id}: universal real-hardware attribution`);
    if(p.nuclear)assert.ok(p.operators.every(id=>['US','GB','FR','RU','CN','IN','PK','KP','IL'].includes(id)));
    assert.ok(Array.isArray(p.carrierOperators));
    for(const id of p.carrierOperators)assert.ok(p.operators.includes(id),`${p.id}: carrier operator must be a documented platform operator`);
  }
});

test('research prerequisite graph has no missing entries or cycles',()=>{
  const byId=new Map(PLATFORMS.map(p=>[p.id,p]));
  function visit(id,path=new Set()){
    assert.ok(byId.has(id),`Missing prerequisite ${id}`);
    assert.equal(path.has(id),false,`Research cycle: ${[...path,id].join(' -> ')}`);
    for(const next of byId.get(id).prerequisites)visit(next,new Set([...path,id]));
  }
  for(const p of PLATFORMS)visit(p.id);
  assert.equal(byId.get('combined-arms-doctrine').buildable,false);
  assert.equal(byId.get('networked-command').buildable,false);
});

test('national hardware availability never grants another nation an exclusive platform',()=>{
  assert.ok(getPlatformsForNation('AU').some(p=>p.id==='boxer-crv'));
  assert.equal(getPlatformsForNation('GB').some(p=>p.id==='boxer-crv'),false);
  assert.ok(getPlatformsForNation('US').some(p=>p.id==='f22'));
  assert.equal(getPlatformsForNation('CN').some(p=>p.id==='f22'),false);
  assert.ok(getPlatformsForNation('CR').some(p=>p.id==='infantry-company'));
  assert.equal(getPlatformsForNation('AU').some(p=>p.nuclear),false);
  assert.deepEqual(PLATFORMS.find(p=>p.id==='f35').carrierOperators,['US','GB','IT']);
  assert.equal(PLATFORMS.find(p=>p.id==='f35').carrierOperators.includes('AU'),false);
  assert.deepEqual(PLATFORMS.find(p=>p.id==='fa18-super-hornet').carrierOperators,['US']);
  assert.deepEqual(PLATFORMS.find(p=>p.id==='rafale').carrierVariants,{FR:'Rafale M'});
  assert.deepEqual(PLATFORMS.find(p=>p.id==='f22').carrierOperators,[]);
});

test('facility upgrades and research quotes agree exactly with authoritative formulas',()=>{
  for(const facility of FACILITIES){
    assert.deepEqual(facility.cost,facilityCost(facility.id,0));
    for(let n=0;n<5;n++)assert.deepEqual(getFacilityQuote(facility.id,n),{facilityId:facility.id,level:n+1,cost:{cash:1500*(n+1),supplies:500*(n+1),fuel:0,electronics:200*(n+1),manpower:100},buildHours:6+6*n});
  }
  assert.throws(()=>facilityCost('army-base',5),RangeError);
  assert.throws(()=>facilityCost('unknown',0),RangeError);
  for(const p of PLATFORMS){
    const expected={cash:Math.max(200,p.cost.cash*.25),electronics:Math.max(100,p.cost.electronics*.5)};
    assert.deepEqual(p.researchCost,expected);assert.deepEqual(getResearchCost(p.id),expected);
  }
});

test('full world preserves all source nations with real admin geometry and reciprocal topology',async()=>{
  const [manifest,world,{nations,regionOwners},staticPlatforms]=await Promise.all([read('manifest.json'),read('world.json'),read('nations.json'),read('platforms.json')]);
  assert.equal(manifest.version,CATALOG_VERSION);
  assert.equal(world.type,'FeatureCollection');
  assert.equal(nations.length,258);
  assert.equal(world.features.length,nations.length);
  assert.equal(manifest.counts.sourceProvinces,4596);
  assert.deepEqual(staticPlatforms.platforms,PLATFORMS);
  assert.equal(new Set(nations.map(n=>n.id)).size,nations.length);
  assert.ok(nations.some(n=>n.id==='NO'&&n.iso3==='NOR'));
  assert.ok(nations.some(n=>n.id==='FR'&&n.iso3==='FRA'));
  assert.ok(nations.some(n=>n.id==='AU'&&n.iso3==='AUS'));
  assert.ok(nations.some(n=>n.id==='NE-IOA'),'Special territories must not alias Australia');
  assert.equal(regionOwners.GF,'FR');assert.equal(regionOwners.GL,'DK');assert.equal(regionOwners.PR,'US');assert.equal(regionOwners.PS,'PS');
  for(const n of nations){assert.equal(regionOwners[n.id],n.sovereignId);if(n.id!==n.sovereignId)assert.equal(n.playable,false);}
  for(const f of world.features)assert.equal(f.properties.countryId,regionOwners[f.id]);
  const nationIds=new Set(nations.map(n=>n.id));
  const provinces=[];
  for(const nation of nations){
    assert.ok(Number.isFinite(nation.economy)&&nation.economy>=0,nation.id);
    assert.ok(Number.isFinite(nation.military)&&nation.military>=1,nation.id);
    const chunk=await read(`provinces/${nation.id}.json`);
    assert.equal(chunk.type,'FeatureCollection');
    assert.equal(chunk.features.length,nation.regionProvinceCount);
    assert.ok(chunk.features.some(f=>f.id===nation.capitalProvinceId));
    assert.deepEqual(nation.arsenal,getPlatformsForNation(nation.sovereignId).map(p=>p.id));
    for(const feature of chunk.features){
      const p=feature.properties;
      assert.equal(feature.id,p.id);
      assert.equal(p.countryId,nation.sovereignId);assert.equal(p.regionId,nation.id);
      assert.ok(feature.geometry&&['Polygon','MultiPolygon'].includes(feature.geometry.type),p.id);
      assert.ok(Number.isFinite(p.lat)&&Math.abs(p.lat)<=90,p.id);
      assert.ok(Number.isFinite(p.lng)&&Math.abs(p.lng)<=180,p.id);
      assert.ok(['mountain','desert','tundra','wetland','urban','plains'].includes(p.terrain));
      if(p.geometryFallback)assert.equal(p.sourceAdminCode,null);
      provinces.push(p);
    }
  }
  assert.equal(provinces.length,manifest.counts.provinces);
  assert.equal(new Set(provinces.map(p=>p.id)).size,provinces.length);
  const byId=new Map(provinces.map(p=>[p.id,p]));
  for(const p of provinces){
    for(const id of p.neighbors){assert.ok(byId.has(id),`${p.id}/${id}`);assert.ok(byId.get(id).neighbors.includes(p.id),`${p.id}/${id}`);assert.notEqual(id,p.id);}
    for(const id of p.seaNeighbors){assert.equal(p.port,true);assert.equal(byId.get(id)?.port,true);assert.ok(byId.get(id).seaNeighbors.includes(p.id));}
  }
  for(const p of PLATFORMS)for(const id of p.operators)assert.ok(id==='*'||nationIds.has(id),`${p.id}/${id}`);
  assert.ok(provinces.some(p=>p.terrain==='mountain'));
  assert.ok(provinces.some(p=>p.terrain==='desert'));
  assert.equal(byId.get('FRA-2000').countryId,'FR','French Guiana remains part of the sourced French footprint');
  for(const n of nations.filter(n=>n.playable)){
    assert.equal(n.provinceIds.length,n.provinceCount);
    for(const id of n.provinceIds)assert.equal(byId.get(id).countryId,n.id);
  }
  const naval=await read('naval-routes.json');
  assert.ok(naval.routes.length>1000);
  for(const route of naval.routes){
    assert.equal(byId.get(route.from)?.port,true);assert.equal(byId.get(route.to)?.port,true);
    assert.ok(route.km>0&&route.coordinates.length>=3);
    for(const [lng,lat]of route.coordinates)assert.ok(Math.abs(lng)<=180&&Math.abs(lat)<=90);
  }
  assert.ok(naval.routes.some(route=>route.coordinates.some((c,i,a)=>i>0&&Math.abs(c[0]-a[i-1][0])>180)),'Pacific water graph must connect across the antimeridian');
});

test('seed chunks are bounded, transactional and only upsert catalogue records',async()=>{
  const directory=new URL('../scripts/war-seed/',import.meta.url);
  const files=(await readdir(directory)).filter(f=>f.endsWith('.sql')).sort();
  assert.ok(files.length>1);
  let rowCount=0;
  for(const file of files){
    const path=new URL(file,directory);assert.ok((await stat(path)).size<=49000,file);
    const sql=await readFile(path,'utf8');
    assert.match(sql,/^begin;\r?\n/);assert.match(sql,/commit;\r?\n$/);
    assert.doesNotMatch(sql,/\b(?:drop|delete|truncate|player_state|auth\.users)\b/i);
    rowCount+=(sql.match(/^insert into dorra_private\.war_catalog_/gm)||[]).length;
  }
  const manifest=await read('manifest.json');
  assert.equal(rowCount,manifest.counts.nations+manifest.counts.provinces+manifest.counts.platforms);
});
