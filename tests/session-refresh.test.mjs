import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionRefresh} from '../supabase/functions/dorra-api/session-refresh.mjs';

const saved = {snapshot:{balance:11000},revision:8,privateState:{secret:'hidden'},recentRequests:[]};
test('a stale refresh returns current balance without private state', () => {
  assert.deepEqual(sessionRefresh(saved,7,100,true),{snapshot:{balance:11000},revision:8,result:{},serverNow:100});
});
test('conditional polling omits the snapshot when the revision is unchanged', () => {
  assert.deepEqual(sessionRefresh(saved,8,100,true),{unchanged:true,revision:8,serverNow:100});
});
test('older clients still receive a snapshot for an unconditional refresh', () => {
  assert.equal(sessionRefresh(saved,8,100).snapshot.balance,11000);
});
