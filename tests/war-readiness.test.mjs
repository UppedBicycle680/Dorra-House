import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {warDatabase} from './war-database-helpers.mjs';

test('operational readiness remains owner-only in views, deltas and private hints',{timeout:120000},async()=>{
 const db=await warDatabase();
 try{
  await db.exec(await readFile(new URL('../supabase/tests/war-readiness.sql',import.meta.url),'utf8'));
 }finally{await db.close();}
});
