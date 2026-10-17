import test from 'node:test';
import assert from 'node:assert/strict';
import {applySnapshotChanges,snapshotChanges,touches} from '../snapshot-delta.mjs';
import {actionResponse} from '../supabase/functions/dorra-api/delta-response.mjs';
import {validateBody,commandDigest} from '../supabase/functions/dorra-api/protocol.mjs';

test('public snapshot deltas preserve nested changes, nulls, arrays and deletions without mutating their base',()=>{
  const before={balance:1000,progress:{old:true,campaign:null,empire:{venues:[1,2],count:2}},history:[]};
  const after={balance:950,progress:{campaign:{turn:1},empire:{venues:[3],count:2}},history:['purchase']};
  const original=structuredClone(before),changes=snapshotChanges(before,after);
  assert.deepEqual(applySnapshotChanges(before,changes),after);
  assert.deepEqual(before,original);
  assert(changes.some(c=>c.remove&&c.path.join('.')==='progress.old'));
  assert.equal(touches(changes.map(c=>c.path),'progress.empire'),true);
  assert.equal(touches([['balance']],'progress.footballManager'),false);
  assert.equal(touches([[]],'progress'),true);
});
test('delta reconstruction rejects prototype paths, missing parents and malformed updates',()=>{
  for(const path of [['__proto__','polluted'],['progress','constructor','prototype'],['missing','key']])assert.throws(()=>applySnapshotChanges({progress:{}},[{path,value:true}]));
  assert.throws(()=>applySnapshotChanges({},[{path:[],remove:true}]));
  assert.throws(()=>applySnapshotChanges({},[{path:['balance']} ]));
  assert.equal({}.polluted,undefined);
});
test('a small wallet change omits a large unrelated career and never exposes private outcomes',()=>{
  const before={balance:1000,progress:{footballManager:{archive:'career'.repeat(20000)}},history:[]};
  const saved={revision:2,snapshot:before,privateState:{deck:['SECRET']}};
  const committed={revision:3,snapshot:{...before,balance:1100},result:{message:'Granted'}};
  const response=actionResponse(saved,committed,'delta-v1');
  assert(!response.snapshot);assert.equal(response.delta.baseRevision,2);
  assert(JSON.stringify(response).length<300);
  assert(!JSON.stringify(response).includes('SECRET'));
  assert.deepEqual(applySnapshotChanges(before,response.delta.changes),committed.snapshot);
  assert.equal(actionResponse(saved,committed,undefined),committed);
  assert.equal(actionResponse(saved,{...committed,replayed:true},'delta-v1').snapshot,committed.snapshot);
});
test('delta negotiation cannot upload state, change request replay identity or weaken command validation',async()=>{
  const command={scope:'house',action:'casino',leaseId:crypto.randomUUID(),requestId:crypto.randomUUID(),expectedRevision:2,args:{game:'dice',bet:25}};
  assert.equal(validateBody({...command,responseMode:'delta-v1'}).responseMode,'delta-v1');
  assert.equal(await commandDigest(command),await commandDigest({...command,responseMode:'delta-v1'}));
  for(const extra of [{delta:{balance:1e9}},{snapshot:{balance:1e9}},{responseMode:'anything'}])assert.throws(()=>validateBody({...command,...extra}));
});
