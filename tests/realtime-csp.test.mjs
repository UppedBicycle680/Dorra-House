import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SUPABASE_URL} from '../online-config.js';

test('game pages allow only the project HTTPS and secure websocket endpoints while keeping script restrictions',async()=>{
  for(const file of ['index.html','idle-airport.html','football-manager.html','war-simulation.html']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    const policy=source.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    const connect=policy.split(';').map(s=>s.trim()).find(s=>s.startsWith('connect-src '));
    assert.equal(connect,`connect-src 'self' ${SUPABASE_URL} ${SUPABASE_URL.replace('https:','wss:')}`,file);
    assert(policy.includes("script-src 'self';"));assert(policy.includes("object-src 'none';"));
    assert(!policy.includes('unsafe-eval'));
  }
});
