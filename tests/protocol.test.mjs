import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBody,commandDigest} from '../supabase/functions/dorra-api/protocol.mjs';
const leaseId=crypto.randomUUID(),requestId=crypto.randomUUID();
const action={scope:'house',action:'casino',leaseId,requestId,expectedRevision:1,args:{game:'bj',move:'start',bet:25}};
test('commands require a current lease, request id and revision',()=>{assert.equal(validateBody(action),action);for(const field of ['leaseId','requestId','expectedRevision'])assert.throws(()=>validateBody({...action,[field]:undefined}));assert.throws(()=>validateBody({...action,args:[]}));});
test('snapshot uploads, arbitrary scopes and prototype payloads are rejected',()=>{assert.throws(()=>validateBody({...action,snapshot:{balance:1e9}}));assert.throws(()=>validateBody({...action,scope:'admin'}));assert.throws(()=>validateBody({...action,args:JSON.parse('{"__proto__":{"balance":100000}}')}));assert.throws(()=>validateBody({...action,args:{text:'x'.repeat(1001)}}));});
test('request hashes bind intent and ignore transport revision retries',async()=>{assert.equal(await commandDigest(action),await commandDigest({...action,expectedRevision:2}));assert.notEqual(await commandDigest(action),await commandDigest({...action,args:{...action.args,bet:50}}));});
