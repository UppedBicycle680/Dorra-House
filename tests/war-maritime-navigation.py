"""Verify the generator and all shipped water polylines against pinned land.

Run after the documented Shapely installation:
 python tests/war-maritime-navigation.py
Raw Natural Earth sources are read through the generator's hash validator.
"""
import importlib.util,json,pathlib,shapely
from shapely.geometry import shape,box,LineString

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('war_world',ROOT/'scripts/build-war-world.py')
world=importlib.util.module_from_spec(spec);spec.loader.exec_module(world)

def synthetic_connections(land,anchor,destination):
 return world.nearshore_connections(anchor,[0],[{'lng':destination[0],'lat':destination[1]}],land,lambda a,b:not land.intersects(LineString([a,b])))

headland=box(.05,-.2,.15,.2)
paths=synthetic_connections(headland,(0,0),(.3,0))
assert paths,'A bounded water detour around a headland should attach an otherwise blocked port'
for _,waypoint,_ in paths:
 assert not headland.intersects(LineString([(0,0),waypoint]))
 assert not headland.intersects(LineString([waypoint,(.3,0)]))
assert not synthetic_connections(box(.05,-2,.15,2),(0,0),(.3,0)),'A long land barrier must not become a fictional passage'
assert not synthetic_connections(box(-1,-1,1,1),(0,0),(2,0)),'An inland port cannot escape through land'

land=shapely.union_all([world.clean(shape(f['geometry'])).simplify(.04,preserve_topology=True) for f in world.load('ne_10m_admin_0_countries.geojson')])
interior=land.buffer(-.015);shapely.prepare(interior)
routes=json.loads((ROOT/'assets/war/naval-routes.json').read_text(encoding='utf-8'))['routes']
checked=0
for route in routes:
 for a,b in zip(route['coordinates'],route['coordinates'][1:]):
  if abs(a[0]-b[0])>180:
   if a[0]<b[0]:a,b=b,a
   endpoint=(b[0]+360,b[1]);fraction=(180-a[0])/(endpoint[0]-a[0]);latitude=a[1]+fraction*(b[1]-a[1])
   segments=[LineString([a,(180,latitude)]),LineString([(-180,latitude),b])]
  else:segments=[LineString([a,b])]
  assert all(not interior.intersects(segment) for segment in segments),f"Land crossing: {route['from']} to {route['to']}: {a}/{b}"
  checked+=1
print(json.dumps({'ok':True,'routes':len(routes),'waterSegments':checked,'sourceRelease':'v5.1.2','syntheticBarrierCases':3}))
