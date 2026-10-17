"""Rebuild the production world from pinned, public-domain Natural Earth 5.1.2.

Requires Python 3.11+ and Shapely 2.1.2. Sources stay in ignored work/war-source;
only simplified production geography and a reproducible provenance manifest ship.
Run: python scripts/build-war-world.py
"""
from __future__ import annotations
import hashlib, heapq, json, math, pathlib, subprocess, urllib.request, sys
from collections import defaultdict
import shapely
from shapely.geometry import shape, mapping, Point, LineString, MultiPolygon, Polygon
from shapely.strtree import STRtree
from shapely.ops import nearest_points

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE, OUT = ROOT / 'work/war-source', ROOT / 'assets/war'
VERSION = 'ne-5.1.2-war-1'
BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/'
SOURCES = {
 'ne_10m_admin_0_countries.geojson': '239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255',
 'ne_10m_admin_1_states_provinces.geojson': '22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5',
 'ne_10m_populated_places.geojson': '9b8e3de09048ef00dfc70357dbb9fa324493f214b5e0ae4daf1aa79a8d10116b',
 'ne_10m_ports.geojson': 'c5a5028f5187a5e1b9fe7f0fab99804a8be7482099a2365d404fb7e9dd6b5457',
 'ne_10m_geography_regions_polys.geojson': 'b7b26e50ea917d3696aec87f932def2bf5f890f5770e441d59c162c6f4c92a77',
}
NEARSHORE_RADII = (.025,.05,.1,.2,.4,.8)
NEARSHORE_BEARINGS = 32
NAVAL_TRANSFORM = '2.5 degree ocean graph; source city-centroid ports snap to coastline within 0.5 degrees; otherwise unattached coastal ports try one nearby verified-water waypoint; every segment rejects buffered land; nearest six connected ports; illustrative game abstraction'

def load(filename):
 CACHE.mkdir(parents=True, exist_ok=True)
 target = CACHE / filename
 if not target.exists():
  with urllib.request.urlopen(BASE + filename, timeout=120) as response: target.write_bytes(response.read())
 raw = target.read_bytes()
 if hashlib.sha256(raw).hexdigest() != SOURCES[filename]: raise ValueError('Source hash mismatch: '+filename)
 return json.loads(raw)['features']

def write(relative, value):
 path = OUT / relative
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_text(json.dumps(value, ensure_ascii=False, separators=(',',':'), allow_nan=False), encoding='utf-8')

def clean(geometry):
 geometry = shapely.make_valid(geometry)
 if geometry.geom_type == 'GeometryCollection':
  parts = [p for p in geometry.geoms if p.geom_type in ('Polygon','MultiPolygon')]
  geometry = shapely.union_all(parts)
 return geometry

def rounded(value):
 if isinstance(value, (tuple,list)): return [rounded(v) for v in value]
 return round(value, 4) if isinstance(value,float) else value

def gj(geometry):
 value = mapping(geometry)
 return {'type':value['type'], 'coordinates':rounded(value['coordinates'])}

def simplify(geometries, tolerance):
 # Natural Earth has disputed overlaps, so group shared-border coverage without
 # asking simplification to dissolve or invent political territory.
 try: result = list(shapely.coverage_simplify(geometries, tolerance, simplify_boundary=True))
 except Exception: result = [g.simplify(tolerance, preserve_topology=True) for g in geometries]
 return [g if not s.is_valid or s.is_empty else s for g,s in zip(geometries,result)]

def dist(a,b):
 lat1,lng1,lat2,lng2 = map(math.radians,[a[1],a[0],b[1],b[0]])
 dlat,dlng=lat2-lat1,lng2-lng1
 return 12742*math.asin(min(1,math.sqrt(math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlng/2)**2)))

def platforms_from_js():
 result=subprocess.run(['node','--input-type=module','-e',"import {PLATFORMS} from './war/catalog.mjs'; console.log(JSON.stringify(PLATFORMS));"],cwd=ROOT,capture_output=True,text=True,check=True,encoding='utf-8')
 return json.loads(result.stdout)

def nearshore_connections(anchor,candidates,nodes,land,water_edge):
 """Bounded detours around a headland; never replace a rejected land crossing.

 The existing coarse ocean graph remains unchanged. Each candidate adds just
 one waypoint with two independently tested water segments. An inland source
 still cannot escape through land, and no river or causeway is invented.
 """
 best={}
 for radius in NEARSHORE_RADII:
  for bearing in range(NEARSHORE_BEARINGS):
   angle=math.tau*bearing/NEARSHORE_BEARINGS
   lng=(anchor[0]+radius*math.cos(angle)/max(.2,math.cos(math.radians(anchor[1]))))
   point=(round((lng+180)%360-180,4),round(anchor[1]+radius*math.sin(angle),4))
   if abs(point[1])>85 or land.covers(Point(point)) or not water_edge(anchor,point):continue
   first=dist(anchor,point)
   for j in candidates:
    destination=(nodes[j]['lng'],nodes[j]['lat'])
    cost=first+dist(point,destination)
    if cost>1800 or not water_edge(point,destination):continue
    value=(cost,point,j)
    if j not in best or value<best[j]:best[j]=value
 return sorted(best.values())[:3]

def build_naval_routes(provinces,country_geoms):
 ids=[p['id'] for p in provinces]
 for p in provinces:p['seaNeighbors']=[]
 # Maritime waypoints are navigation abstractions in verified ocean water, never
 # fictional provinces. Edges intersecting buffered real land are rejected.
 print('Building water navigation graph',flush=True)
 land=shapely.union_all([g.simplify(.04,preserve_topology=True) for g in country_geoms.values()])
 inner_land=land.buffer(-.015)
 shapely.prepare(land);shapely.prepare(inner_land)
 def water_edge(a,b):
  if abs(a[0]-b[0])>180:
   if a[0]<b[0]:a,b=b,a
   endpoint=(b[0]+360,b[1]);fraction=(180-a[0])/(endpoint[0]-a[0]);latitude=a[1]+fraction*(b[1]-a[1])
   return not inner_land.intersects(LineString([a,(180,latitude)])) and not inner_land.intersects(LineString([(-180,latitude),b]))
  return not inner_land.intersects(LineString([a,b]))
 nodes=[];node_lookup={};edges=defaultdict(list)
 for lat_step in range(-30,33):
  lat=lat_step*2.5
  for lng_step in range(-71,72):
   lng=lng_step*2.5
   if not land.covers(Point(lng,lat)):
    node_lookup[(lng,lat)]=len(nodes);nodes.append({'id':f'ocean-{lng}-{lat}','lng':lng,'lat':lat})
 for (lng,lat),i in node_lookup.items():
  for dx,dy in [(2.5,0),(0,2.5),(2.5,2.5),(-2.5,2.5)]:
   next_lng=lng+dx
   if next_lng>177.5:next_lng=-177.5
   j=node_lookup.get((next_lng,lat+dy))
   if j is not None and water_edge((lng,lat),(next_lng,lat+dy)):
    km=round(dist((lng,lat),(next_lng,lat+dy)))
    edges[i].append((j,km));edges[j].append((i,km))
 ocean_count=len(nodes)
 shoreline=land.boundary
 port_node={}
 fallback_count=0;unattached_count=0
 for i,p in enumerate(provinces):
  if not p['port']: continue
  port=p['ports'][0];a=(port['lng'],port['lat'])
  if land.covers(Point(a)):
   shore=nearest_points(Point(a),shoreline)[1]
   if Point(a).distance(shore)<=.5:a=(round(shore.x,4),round(shore.y,4))
  # Source port positions can be city centroids inland. Snap to nearby water;
  # do not create a transcontinental shortcut from that cartographic position.
  candidates=sorted(range(ocean_count),key=lambda j:dist(a,(nodes[j]['lng'],nodes[j]['lat'])))[:50]
  selected=[]
  for j in candidates:
   b=(nodes[j]['lng'],nodes[j]['lat'])
   if dist(a,b)>1800:continue
   if water_edge(a,b):selected.append((j,round(dist(a,b))))
   if len(selected)==3:break
  fallback=[]
  if not selected:
   unattached_count+=1
   fallback=nearshore_connections(a,candidates,nodes,land,water_edge)
   if not fallback:continue
   fallback_count+=1
  n=len(nodes);nodes.append({'id':'port-'+p['id'],'provinceId':p['id'],'lng':a[0],'lat':a[1]});port_node[n]=i
  for j,km in selected:edges[n].append((j,km));edges[j].append((n,km))
  waypoints={}
  for _,point,j in fallback:
   if point not in waypoints:
    waypoint=len(nodes);nodes.append({'id':'nearshore-'+p['id']+'-'+str(len(waypoints)),'lng':point[0],'lat':point[1]});waypoints[point]=waypoint
    km=round(dist(a,point));edges[n].append((waypoint,km));edges[waypoint].append((n,km))
   waypoint=waypoints[point];km=round(dist(point,(nodes[j]['lng'],nodes[j]['lat'])))
   edges[waypoint].append((j,km));edges[j].append((waypoint,km))
 routes=[];route_pairs=set()
 for start,pi in port_node.items():
  queue=[(0,start)];best={start:0};prev={};found=0
  while queue and found<6:
   cost,node=heapq.heappop(queue)
   if cost!=best[node]:continue
   if node in port_node and node!=start:
    pj=port_node[node];found+=1
    provinces[pi]['seaNeighbors'].append(ids[pj])
    pair=(min(pi,pj),max(pi,pj))
    if pair not in route_pairs:
     route_pairs.add(pair)
     path=[node]
     while path[-1]!=start:path.append(prev[path[-1]])
     routes.append({'from':ids[pi],'to':ids[pj],'km':cost,'coordinates':[[nodes[n]['lng'],nodes[n]['lat']] for n in reversed(path)]})
   for other,km in edges[node]:
    value=cost+km
    if value<best.get(other,math.inf):best[other]=value;prev[other]=node;heapq.heappush(queue,(value,other))
 for p in provinces:
  for other in list(p['seaNeighbors']):
   j=ids.index(other)
   if p['id'] not in provinces[j]['seaNeighbors']:provinces[j]['seaNeighbors'].append(p['id'])
 summary={'portProvinces':sum(p['port'] for p in provinces),'directUnattachedPorts':unattached_count,'fallbackAttachedPorts':fallback_count,
  'isolatedPortProvinces':sum(p['port'] and not p['seaNeighbors'] for p in provinces),
  'fallback':{'radiiDegrees':NEARSHORE_RADII,'bearings':NEARSHORE_BEARINGS,'maxWaypointsPerPort':3,'segmentsPerConnection':2}}
 print('Naval connectivity: '+json.dumps(summary),flush=True)
 return routes,summary

def write_seed(countries,provinces,platforms):
 seed_dir=ROOT/'scripts/war-seed';seed_dir.mkdir(parents=True,exist_ok=True)
 for old in seed_dir.glob('*.sql'):old.unlink()
 def quote(value):return "'"+value.replace("'","''")+"'"
 def sql_row(table,columns,values):return 'insert into dorra_private.'+table+'('+columns+') values ('+','.join(quote(v) for v in values)+') on conflict(id) do update set '+','.join(c+'=excluded.'+c for c in columns.split(',') if c!='id')+';\n'
 rows=[]
 for c in countries.values():rows.append(sql_row('war_catalog_nations','id,name,data',[c['id'],c['name'],json.dumps(c,ensure_ascii=False,separators=(',',':'))]))
 for p in provinces:rows.append(sql_row('war_catalog_provinces','id,country_id,name,data',[p['id'],p['countryId'],p['name'],json.dumps(p,ensure_ascii=False,separators=(',',':'))]))
 for p in platforms:rows.append(sql_row('war_catalog_platforms','id,name,data',[p['id'],p['name'],json.dumps(p,ensure_ascii=False,separators=(',',':'))]))
 chunk='';number=0
 for row in rows:
  if len((chunk+row).encode('utf-8'))>48000 and chunk:
   number+=1;(seed_dir/f'{number:03}.sql').write_text('begin;\n'+chunk+'commit;\n',encoding='utf-8',newline='\n');chunk=''
  chunk+=row
 if chunk:number+=1;(seed_dir/f'{number:03}.sql').write_text('begin;\n'+chunk+'commit;\n',encoding='utf-8',newline='\n')
 (ROOT/'scripts/seed-war-catalog.sql').write_text('-- Apply numbered scripts/war-seed/*.sql in ascending order after the war schema migration.\n-- Generated with python scripts/build-war-world.py; no player data and no geometry in SQL.\n-- Catalog version: '+VERSION+'\n-- '+str(number)+' transactional chunks, each under 49 KiB.\n',encoding='utf-8')
 return number

def normalize_sovereignty(nations,provinces):
 """Use source sovereignty only for dependencies, leases and grouped Countries.

 Indeterminate/disputed areas remain separate scenario IDs. In particular,
 Palestine is not folded into Israel merely because NE groups their SOV_A3.
 """
 source=load('ne_10m_admin_0_countries.geojson')
 by_iso3={n['iso3']:n for n in nations}
 groups=defaultdict(list)
 for feature in source:
  p=feature['properties']
  if p['ADM0_A3'] in by_iso3:groups[p['SOV_A3']].append(p)
 owner={n['id']:n['id'] for n in nations}
 for group in groups.values():
  parent=max(group,key=lambda p:(p['ADMIN']==p['SOVEREIGNT'],p['TYPE'] in ['Sovereign country','Sovereignty'],p.get('POP_EST') or 0))
  parent_id=by_iso3[parent['ADM0_A3']]['id']
  for p in group:
   n=by_iso3[p['ADM0_A3']]
   n['sourceSovereignCode']=p['SOV_A3']
   if p['TYPE'] in ['Dependency','Lease','Country']:owner[n['id']]=parent_id
 aliases={}
 # Some French overseas regions are part of the FRA footprint itself, rather
 # than separate admin0 features. Their source ISO_3166_2/gu_a3 identifies them.
 for feature in load('ne_10m_admin_1_states_provinces.geojson'):
  p=feature['properties'];iso=p.get('iso_3166_2') or '';parent=by_iso3.get(p.get('adm0_a3'))
  suffix=iso.split('-')[-1]
  if parent and p.get('gu_a3') and p.get('gu_a3')!=p.get('adm0_a3') and suffix not in owner and len(suffix)==2 and suffix.isalpha() and suffix.upper()==suffix:
   aliases[suffix]=owner[parent['id']]
 per_region=defaultdict(list);per_owner=defaultdict(list)
 for p in provinces:
  region=p.get('regionId') or p['countryId'];p['regionId']=region;p['countryId']=owner[region]
  per_region[region].append(p);per_owner[p['countryId']].append(p)
 for n in nations:
  region=n['id'];parent=owner[region]
  n['regionId']=region;n['sovereignId']=parent;n['countryId']=parent
  n['regionProvinceCount']=len(per_region[region]);n['regionProvinceIds']=[p['id'] for p in per_region[region]]
  n['playable']=bool(n.get('playable',True) and parent==region)
  owned=per_owner[region] if parent==region else per_region[region]
  n['provinceIds']=[p['id'] for p in owned];n['provinceCount']=len(owned);n['portCount']=sum(p['port'] for p in owned)
  n['regionIds']=sorted([r for r,o in owner.items() if o==region]) if parent==region else [region]
  n['mapAliases']=sorted([r for r,o in aliases.items() if o==region])
 return {**owner,**aliases}

def catalog_only():
 nations=json.loads((OUT/'nations.json').read_text(encoding='utf-8'))
 platforms=platforms_from_js()
 provinces=[f['properties'] for country in nations['nations'] for f in json.loads((OUT/'provinces'/(country['id']+'.json')).read_text(encoding='utf-8'))['features']]
 owners=normalize_sovereignty(nations['nations'],provinces);nations['regionOwners']=owners
 for country in nations['nations']:
  country['arsenal']=[p['id'] for p in platforms if country['sovereignId'] in p['operators'] or '*' in p['operators']]
  named=[p for p in platforms if country['id'] in p['operators'] and not p.get('abstractCapability')]
  country['catalogCoverage']='curated-primary-source-platforms' if named else 'baseline-capabilities-only'
 province_by_id={p['id']:p for p in provinces}
 for country in nations['nations']:
  path=OUT/'provinces'/(country['id']+'.json');chunk=json.loads(path.read_text(encoding='utf-8'))
  for feature in chunk['features']:feature['properties']=province_by_id[feature['id']]
  write('provinces/'+country['id']+'.json',chunk)
 world=json.loads((OUT/'world.json').read_text(encoding='utf-8'));by_id={n['id']:n for n in nations['nations']}
 for feature in world['features']:
  feature['properties'].update({'regionId':feature['id'],'countryId':owners[feature['id']],'sovereignId':owners[feature['id']],'playable':by_id[feature['id']]['playable']})
 write('world.json',world)
 write('nations.json',nations);write('platforms.json',{'version':VERSION,'platforms':platforms})
 manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'));manifest['counts']['platforms']=len(platforms);manifest['counts']['playableNations']=sum(n['playable'] for n in nations['nations']);manifest['sovereignty']={'method':'Natural Earth SOV_A3 primary source parent for Dependency/Lease/nonprimary Country only; Indeterminate and Disputed scenario areas retained','regionOwners':owners};write('manifest.json',manifest)
 count=write_seed({c['id']:c for c in nations['nations']},provinces,platforms)
 print(f'Updated {len(platforms)} platform records and {count} transactional SQL chunks',flush=True)

def naval_only():
 """Refresh maritime edges without changing geometry, borders or national data."""
 nations=json.loads((OUT/'nations.json').read_text(encoding='utf-8'))
 chunks={n['id']:json.loads((OUT/'provinces'/(n['id']+'.json')).read_text(encoding='utf-8')) for n in nations['nations']}
 provinces=[f['properties'] for chunk in chunks.values() for f in chunk['features']]
 before={p['id']:list(p['seaNeighbors']) for p in provinces}
 admin0=load('ne_10m_admin_0_countries.geojson');admin1=load('ne_10m_admin_1_states_provinces.geojson')
 rank={f['properties']['adm1_code']:i for i,f in enumerate(admin1)}
 country_rank={f['properties']['ADM0_A3']:i for i,f in enumerate(admin0)}
 nation_by_id={n['id']:n for n in nations['nations']}
 def original_order(p):
  return rank.get(p['id'],len(admin1)+country_rank[nation_by_id[p.get('regionId',p['countryId'])]['iso3']])
 country_geoms={str(i):clean(shape(f['geometry'])) for i,f in enumerate(admin0)}
 routes,summary=build_naval_routes(sorted(provinces,key=original_order),country_geoms)
 changed=[]
 for p in provinces:
  p['seaNeighbors']=sorted(set(p['seaNeighbors']))
  if p['seaNeighbors']!=before[p['id']]:changed.append(p['id'])
 for code,chunk in chunks.items():
  if any(f['id'] in changed for f in chunk['features']):write('provinces/'+code+'.json',chunk)
 write('naval-routes.json',{'version':VERSION,'notice':'Game routing graph over Natural Earth land masks; not navigational advice.','routes':routes})
 manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'));manifest['transforms']['naval']=NAVAL_TRANSFORM
 manifest['navalConnectivity']=summary;manifest['counts']['navalRoutes']=len(routes);write('manifest.json',manifest)
 platforms=json.loads((OUT/'platforms.json').read_text(encoding='utf-8'))['platforms']
 count=write_seed({n['id']:n for n in nations['nations']},provinces,platforms)
 print(f'Changed only maritime neighbors in {len(changed)} provinces; {count} SQL seed chunks',flush=True)

def main():
 admin0,admin1,cities,ports,regions = [load(n) for n in SOURCES]
 countries, code_map, country_geoms = {}, {}, {}
 iso_groups=defaultdict(list)
 for feature in admin0:iso_groups[feature['properties']['ISO_A2_EH']].append(feature['properties'])
 iso_primary={code:max(group,key=lambda p:p.get('POP_EST') or 0)['ADM0_A3'] for code,group in iso_groups.items()}
 for feature in admin0:
  p=feature['properties']; code=p['ISO_A2_EH'] if p['ISO_A2_EH']!='-99' and iso_primary[p['ISO_A2_EH']]==p['ADM0_A3'] else 'NE-'+p['ADM0_A3']
  if code in countries: raise ValueError('Duplicate nation '+code)
  g=clean(shape(feature['geometry'])); country_geoms[code]=g
  pop=max(0,p.get('POP_EST') or 0); gdp=max(0,p.get('GDP_MD') or 0)
  countries[code]={'id':code,'name':p.get('NAME_EN') or p['ADMIN'],'iso3':p['ADM0_A3'],'lat':p['LABEL_Y'],'lng':p['LABEL_X'],
   'capitalProvinceId':None,'economy':round(gdp/1000,3),'gdpYear':p.get('GDP_YEAR'),'population':round(pop),'populationYear':p.get('POP_YEAR'),
   'military':1,'nuclear':code in ['US','GB','FR','RU','CN','IN','PK','KP','IL'],'arsenal':[],
   'continent':p.get('CONTINENT'),'region':p.get('SUBREGION'),'sovereignty':p.get('TYPE'),'sovereign':p.get('SOVEREIGNT'),
   'playable':pop>=1000 and code!='AQ','provinceCount':0,'portCount':0,'sourceUrl':'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/',
   'economyMetadata':{'unit':'USD billion','basis':'Natural Earth GDP_MD historical cartographic estimate','year':p.get('GDP_YEAR')},
   'militaryMetadata':{'unit':'game strength index','basis':'Authored scenario balance; not a factual ranking or force count'},
   'nuclearStatus': 'undeclared' if code=='IL' else 'declared' if code in ['US','GB','FR','RU','CN','IN','PK','KP'] else 'none'}
  for field in ['ADM0_A3','ISO_A3','ISO_A3_EH','SOV_A3']:
   value=p.get(field)
   if value and value!='-99' and (field!='SOV_A3' or value not in code_map): code_map[value]=code
  code_map[code]=code
 # Sovereign codes must resolve to their own country, not an overseas dependency.
 for code,p in countries.items(): code_map[p['iso3']]=code
 provinces=[]; geoms=[]; by_country=defaultdict(list)
 for feature in admin1:
  p=feature['properties']; code=code_map.get(p.get('adm0_a3')) or code_map.get(p.get('iso_a2'))
  if code not in countries: continue
  g=clean(shape(feature['geometry']))
  if g.is_empty: continue
  point=g.representative_point()
  data={'id':p['adm1_code'],'countryId':code,'name':p.get('name_en') or p.get('name') or p['adm1_code'],
   'lat':round(point.y,4),'lng':round(point.x,4),'city':False,'capital':False,'port':False,'coastal':False,
   'terrain':'plains','neighbors':[],'seaNeighbors':[],'cities':[],'ports':[],'sourceAdminCode':p['adm1_code']}
  by_country[code].append(len(provinces));provinces.append(data);geoms.append(g)
 for code,country in countries.items():
  if by_country[code]: continue
  g=country_geoms[code]; point=g.representative_point()
  data={'id':'ne0-'+code,'countryId':code,'name':country['name'],'lat':round(point.y,4),'lng':round(point.x,4),
   'city':False,'capital':False,'port':False,'coastal':False,'terrain':'plains','neighbors':[],'seaNeighbors':[],
   'cities':[],'ports':[],'sourceAdminCode':None,'geometryFallback':'Natural Earth admin0; source has no admin1'}
  by_country[code].append(len(provinces));provinces.append(data);geoms.append(g)
 ids=[p['id'] for p in provinces]
 if len(ids)!=len(set(ids)): raise ValueError('Duplicate province IDs')
 print(f'World: {len(countries)} countries, {len(provinces)} real administrative areas',flush=True)
 tree=STRtree(geoms)
 # Shared boundaries are computed from unsimplified source polygons. Point-only
 # contact is not a passable land border. No nearest-neighbor land shortcuts.
 for i,g in enumerate(geoms):
  for j in tree.query(g, predicate='intersects'):
   j=int(j)
   if j<=i: continue
   if g.boundary.intersection(geoms[j].boundary).length > .0001:
    provinces[i]['neighbors'].append(ids[j]);provinces[j]['neighbors'].append(ids[i])
 print('Land topology complete',flush=True)
 def locate(point, code=None, max_distance=.25):
  possible=by_country.get(code,[]) if code else [int(i) for i in tree.query(point.buffer(max_distance))]
  contained=[i for i in possible if geoms[i].covers(point)]
  if contained:return min(contained,key=lambda i:geoms[i].area)
  if possible:
   near=min(possible,key=lambda i:geoms[i].distance(point))
   if geoms[near].distance(point)<=max_distance:return near
  return None
 for feature in sorted(cities,key=lambda f:-(f['properties'].get('POP_MAX') or 0)):
  p=feature['properties']; point=shape(feature['geometry']);code=code_map.get(p.get('ADM0_A3')) or code_map.get(p.get('ISO_A2'))
  i=locate(point,code)
  if i is None:continue
  province=provinces[i]
  if len(province['cities'])<4:
   province['cities'].append({'name':p['NAME'],'lat':round(point.y,4),'lng':round(point.x,4),'population':max(0,p.get('POP_MAX') or 0),'capital':bool(p.get('ADM0CAP'))})
  province['city']=True
  if p.get('ADM0CAP')==1:
   province['capital']=True
   if countries[province['countryId']]['capitalProvinceId'] is None:
    countries[province['countryId']]['capitalProvinceId']=province['id']
    countries[province['countryId']]['capitalName']=p['NAME']
 terrain_map={'Range/mtn':'mountain','Plateau':'mountain','Desert':'desert','Tundra':'tundra','Wetlands':'wetland'}
 terrain_features=[f for f in regions if f['properties']['FEATURECLA'] in terrain_map]
 terrain_geoms=[clean(shape(f['geometry'])) for f in terrain_features]
 terrain_tree=STRtree(terrain_geoms)
 for i,g in enumerate(geoms):
  overlaps=[]
  for ti in terrain_tree.query(g,predicate='intersects'):
   ti=int(ti);area=g.intersection(terrain_geoms[ti]).area
   if area>.2*g.area:overlaps.append((area,ti))
  if overlaps:
   ti=max(overlaps)[1];provinces[i]['terrain']=terrain_map[terrain_features[ti]['properties']['FEATURECLA']]
   provinces[i]['terrainReference']=terrain_features[ti]['properties']['NAME']
  elif g.area<.08 and provinces[i]['city']:provinces[i]['terrain']='urban'
 for feature in ports:
  p=feature['properties'];point=shape(feature['geometry']);i=locate(point,max_distance=.35)
  if i is None: continue
  provinces[i]['port']=True;provinces[i]['coastal']=True
  if len(provinces[i]['ports'])<4:provinces[i]['ports'].append({'id':'ne-port-'+str(p['ne_id']),'name':p['name'],'lat':round(point.y,4),'lng':round(point.x,4)})
 for code,country in countries.items():
  indices=by_country[code]
  if not country['capitalProvinceId']:
   # A single source admin area (or historical source without a capital point)
   # gets an explicit scenario seat, without pretending it is an official capital.
   best=max(indices,key=lambda i:sum(x['population'] for x in provinces[i]['cities']))
   provinces[best]['capital']=True;country['capitalProvinceId']=provinces[best]['id'];country['capitalName']=provinces[best]['cities'][0]['name'] if provinces[best]['cities'] else country['name'];country['capitalFallback']=True
  country['provinceCount']=len(indices);country['portCount']=sum(provinces[i]['port'] for i in indices)
 routes,naval_stats=build_naval_routes(provinces,country_geoms)
 # The catalog is authored independently; import pure JS to keep one definition
 # for browser, server bundle, world metadata and SQL seeding.
 catalog_path=ROOT/'war/catalog.mjs'
 platforms=[]
 if catalog_path.exists():
  platforms=platforms_from_js()
 for code,country in countries.items():
  country['arsenal']=[p['id'] for p in platforms if code in p['operators'] or '*' in p['operators']]
  named=[p for p in platforms if code in p['operators'] and not p.get('abstractCapability')]
  country['military']=min(100,max(1,round(5+len(named)*3+math.log10(max(1,country['economy']))*6)))
  country['catalogCoverage']='curated-primary-source-platforms' if named else 'baseline-capabilities-only'
  country['arsenalNotice']='Research unlocks only the documented operator roster. Baseline formations and all combat/economic values are game abstractions, not a current inventory.'
  country['provinceIds']=[ids[i] for i in by_country[code]]
 print('Simplifying source geometry',flush=True)
 simple=simplify(geoms,.018)
 for previous in (OUT/'provinces').glob('*.json'):
  if previous.stem not in countries:previous.unlink()
 for code,indices in by_country.items():
  features=[]
  for i in indices:
   p=provinces[i];p['neighbors']=sorted(set(p['neighbors']));p['seaNeighbors']=sorted(set(p['seaNeighbors']))
   features.append({'type':'Feature','id':p['id'],'properties':p,'geometry':gj(simple[i])})
  write('provinces/'+code+'.json',{'type':'FeatureCollection','version':VERSION,'features':features})
 country_simple=simplify(list(country_geoms.values()),.035)
 world=[{'type':'Feature','id':c,'properties':{k:v for k,v in countries[c].items() if k in ['id','name','iso3','continent','region','playable','population']},'geometry':gj(g)} for c,g in zip(country_geoms,country_simple)]
 write('world.json',{'type':'FeatureCollection','version':VERSION,'features':world})
 write('nations.json',{'version':VERSION,'nations':sorted(countries.values(),key=lambda p:p['name'])})
 write('naval-routes.json',{'version':VERSION,'notice':'Game routing graph over Natural Earth land masks; not navigational advice.','routes':routes})
 write('platforms.json',{'version':VERSION,'platforms':platforms})
 manifest={'version':VERSION,'license':'Public domain (Natural Earth)','resolution':'1:10 million source; not 10 metre imagery',
  'sourceRelease':'v5.1.2','sources':[{'url':BASE+n,'sha256':h} for n,h in SOURCES.items()],
  'transforms':{'engine':'Shapely '+shapely.__version__,'countryToleranceDegrees':.035,'provinceToleranceDegrees':.018,'coordinateDecimals':4,
   'neighbors':'positive-length shared source boundaries','cities':'Natural Earth populated places','ports':'Natural Earth ports, nearest polygon within 0.35 degrees',
   'terrain':'Natural Earth geography region overlap >20% for mountain/plateau/desert/tundra/wetland; tiny city areas urban, remaining plains; coarse game abstraction',
   'naval':NAVAL_TRANSFORM,
   'economy':'Historical Natural Earth GDP_MD, USD millions, divided by 1000; year preserved, not claimed current GDP',
   'military':'Authored game index based on curated platform coverage and logarithmic economy; not factual force ranking'},
  'navalConnectivity':naval_stats,
  'counts':{'nations':len(countries),'playableNations':sum(c['playable'] for c in countries.values()),'provinces':len(provinces),'sourceProvinces':len(admin1),'sourceCities':len(cities),'sourcePorts':len(ports),'portProvinces':sum(p['port'] for p in provinces),'navalRoutes':len(routes),'platforms':len(platforms)},
  'files':{'world':'world.json','nations':'nations.json','platforms':'platforms.json','navalRoutes':'naval-routes.json','provinces':'provinces/{countryId}.json'}}
 write('manifest.json',manifest)
 number=write_seed(countries,provinces,platforms)
 print(json.dumps(manifest['counts'])+f'; {number} SQL seed chunks',flush=True)
 catalog_only()

if __name__=='__main__':
 if '--catalog-only' in sys.argv:catalog_only()
 elif '--naval-only' in sys.argv:naval_only()
 else:main()
