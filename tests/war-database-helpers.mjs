import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
export async function warDatabase() {
 const db=new PGlite();
 // Supabase-owned services are stubbed; the match engine is the actual PostgreSQL migration.
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema realtime;create schema cron;create schema dorra_private;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
 create table dorra_private.profiles(user_id uuid primary key,disabled boolean default false,banned boolean default false,suspended_until timestamptz);
 create table dorra_private.player_state(user_id uuid primary key,auth_session_id uuid,lease_id uuid,snapshot jsonb,private_state jsonb default '{}',revision bigint default 1,rate_window timestamptz,rate_count int default 0,updated_at timestamptz);
 create table realtime.messages(extension text,topic text);
 create function realtime.topic() returns text language sql as $$select ''::text$$;
 create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 const migrations=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(name=>/^\d+_war_.*\.sql$/.test(name)).sort();
 for(const name of migrations){
  let sql=await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
  sql=sql.replace(/create extension if not exists pg_cron[^;]*;/ig,'');
  await db.exec(sql);
 }
 return db;
}
