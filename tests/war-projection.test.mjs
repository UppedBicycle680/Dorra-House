import test from 'node:test';
import assert from 'node:assert/strict';
import {applyWarDelta} from '../war/projection.mjs';
const initial=()=>({match:{id:'m',revision:1},player:{resources:{cash:100}},units:[{id:'a',health:100},{id:'b',health:50}],provinces:[{id:'p',ownerId:'AU'}]});
const delta=()=>({matchId:'m',baseRevision:1,revision:2,fields:{player:{resources:{cash:90}}},units:{upsert:[{id:'a',health:75},{id:'c',health:100}],remove:['b']},provinces:{upsert:[{id:'p',ownerId:'NZ'}],remove:[]}});
test('filtered deltas update and remove only the changed entities without mutating their base',()=>{
 const view=initial(),before=structuredClone(view),next=applyWarDelta(view,delta());
 assert.deepEqual(view,before);assert.equal(next.match.revision,2);assert.equal(next.player.resources.cash,90);
 assert.deepEqual(next.units,[{id:'a',health:75},{id:'c',health:100}]);assert.equal(next.provinces[0].ownerId,'NZ');
});
test('projection rejects another match, stale bases and unsupported top-level paths',()=>{
 for(const change of [{matchId:'other'},{baseRevision:0},{revision:0},{fields:JSON.parse('{"__proto__":{"admin":true}}')}])assert.throws(()=>applyWarDelta(initial(),{...delta(),...change}),/WAR_PROJECTION_MISMATCH/);
 assert.equal({}.admin,undefined);
});
test('global world state is never needed to reconstruct visible changes',()=>{
 const patch=delta();const next=applyWarDelta(initial(),patch);assert.ok(!JSON.stringify(next).includes('seed'));
 assert.deepEqual(next.units.map(u=>u.id),['a','c']);
});
