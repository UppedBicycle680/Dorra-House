import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeResult,decodeResult} from '../supabase/functions/dorra-api/response-codec.mjs';
test('small outcome replay retains its original shape', async () => {
  const result = {round:{cards:['AH','KS']},payout:500};
  assert.deepEqual(await decodeResult(await encodeResult(result)),result);
});
test('large projection replay restores complete data instead of a refresh marker', async () => {
  const result = {view:{terminals:Array.from({length:4000},(_,id)=>({id,status:'active',passengers:1200}))},receipt:{amountCash:1000}};
  const encoded=await encodeResult(result);
  assert.equal(encoded.dorraReplayEncoding,'gzip-base64-v1');
  assert.ok(JSON.stringify(encoded).length<32768);
  assert.deepEqual(await decodeResult(encoded),result);
});
test('incompressible oversized results are rejected before database commit', async () => {
  const bytes=crypto.getRandomValues(new Uint8Array(60000));
  const parts=Array.from({length:8},()=>Array.from(crypto.getRandomValues(bytes),b=>String.fromCharCode(b)).join(''));
  await assert.rejects(encodeResult({parts}),error=>error.code==='RESULT_SIZE_LIMIT');
});
