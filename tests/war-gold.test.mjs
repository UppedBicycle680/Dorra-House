import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { warDatabase } from './war-database-helpers.mjs';
import { isolatedAiScenario } from './war-ai-fixtures.mjs';
import { createWarHandler, validateWarBody } from '../supabase/functions/dorra-war/handler.mjs';
import { createAdminHandler } from '../supabase/functions/dorra-admin/handler.mjs';
import { validate as validateAdmin } from '../supabase/functions/dorra-admin/model.mjs';

const sid = 'f8100000-0000-4000-8000-000000000001', lease = 'f8100000-0000-4000-8000-000000000002';
const admin = 'f8100000-0000-4000-8000-000000000003', adminSession = 'f8100000-0000-4000-8000-000000000004';
const other = 'f8100000-0000-4000-8000-000000000005', otherSession = 'f8100000-0000-4000-8000-000000000006';

async function adminFixtures(db) {
  await db.exec(`alter table dorra_private.profiles add column role text not null default 'player',add column owner boolean not null default false,add column username text not null default 'Gold fixture',add column admin_version bigint not null default 1,add column created_at timestamptz not null default now();
    create table dorra_private.admin_grants(user_id uuid,session_id uuid,expires_at timestamptz,code_version text,primary key(user_id,session_id));
    create table dorra_private.gameplay_days(user_id uuid,last_action_at timestamptz);
    create function dorra_private.code_version() returns text language sql as $$select 'fixture-current-code'::text$$;`);
  const adminSource = await readFile(new URL('../supabase/migrations/20261008084152_secure_admin_panel.sql', import.meta.url), 'utf8');
  const audit = adminSource.slice(adminSource.indexOf('create table dorra_private.admin_audit('), adminSource.indexOf('create index admin_audit_created'));
  await db.exec(audit);
  const extract = (source, start) => { const pos = source.indexOf(start); return source.slice(pos, source.indexOf('end $$;', pos) + 7); };
  await db.exec(extract(adminSource, 'create function dorra_private.player_allowed('));
  await db.exec(extract(await readFile(new URL('../supabase/migrations/20261008111349_owner_controls.sql', import.meta.url), 'utf8'), 'create or replace function dorra_private.staff_context('));
  await db.exec(extract(adminSource, 'create function dorra_private.profile_view('));
  // The installed owner-controls migration adds a default argument. PostgreSQL
  // rejects a CREATE OR REPLACE wrapper that silently removes that default.
  const adminRead = extract(adminSource, 'create function public.dorra_admin_read(');
  await db.exec(adminRead.replace('p_operation text,p_args jsonb)', "p_operation text,p_args jsonb default '{}'::jsonb)"));
  const migration = await readFile(new URL('../supabase/migrations/20261017000922_war_gold_wallet_boosts.sql', import.meta.url), 'utf8');
  const start = migration.indexOf('do $gold_admin_projection$');
  await db.exec(migration.slice(start, migration.indexOf('end $gold_admin_projection$;', start) + 'end $gold_admin_projection$;'.length));
  await db.exec(`create function pg_temp.gold_command(actor uuid,session_id uuid,lease_id uuid,intent text,mid uuid,args jsonb,request_id uuid) returns jsonb language plpgsql as $$begin
    return public.dorra_war_command(actor,session_id,lease_id,intent,mid,args,request_id);
    exception when others then return jsonb_build_object('error',sqlerrm);end$$;
    create function pg_temp.gold_admin(actor uuid,session_id uuid,target uuid,amount int,reason text,request_id uuid) returns jsonb language plpgsql as $$begin
    return public.dorra_admin_gold_grant(actor,session_id,target,amount,reason,request_id);
    exception when others then return jsonb_build_object('error',sqlerrm);end$$;`);
}

async function fixture(db, f) {
  for (const [id, session] of [[f.host, sid], [admin, adminSession], [other, otherSession]]) {
    if (id !== f.host) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, JSON.stringify({ role: 'admin', owner: true })]);
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [session, id]);
    await db.query("insert into dorra_private.profiles(user_id,role) values($1,$2)", [id, id === admin ? 'admin' : 'player']);
  }
  await db.query("insert into dorra_private.admin_grants values($1,$2,now()+interval '30 minutes','fixture-current-code')", [admin, adminSession]);
  await db.query('insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values($1,$2,$3,$4)', [f.host, sid, lease, JSON.stringify({ balance: 1000, progress: {} })]);
  await db.query('insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values($1,$2,$3,$4)', [other, otherSession, lease, JSON.stringify({ balance: 1000, progress: {} })]);
  await db.query('update dorra_private.war_sides set user_id=$2,is_ai=false,active_ai=false where match_id=$1 and nation_id=$3', [f.mid, f.host, f.a]);
  await db.query('update dorra_private.war_sides set user_id=$2,is_ai=false,active_ai=false where match_id=$1 and nation_id=$3', [f.mid, other, f.b]);
  await db.query("update dorra_private.war_matches set real_anchor=clock_timestamp()+interval '1 hour' where id=$1", [f.mid]);
  for (const id of ['__gold-research', '__gold-research-two']) await db.query("insert into dorra_private.war_catalog_platforms(id,name,data) select $1,'Gold research fixture',data||jsonb_build_object('id',$1::text) from dorra_private.war_catalog_platforms where id='__ai-infantry'", [id]);
  const command = async (action, args = {}, requestId = crypto.randomUUID(), actor = f.host, session = sid, matchId = f.mid) => {
    const r = (await db.query('select pg_temp.gold_command($1,$2,$3,$4,$5,$6,$7) r', [actor, session, lease, action, matchId, JSON.stringify(args), requestId])).rows[0].r;
    if (r.error) throw new Error(r.error); return r;
  };
  const grant = async (amount, requestId = crypto.randomUUID(), target = f.host, reason = 'Tournament fixture award', actor = admin, session = adminSession) => {
    const r = (await db.query('select pg_temp.gold_admin($1,$2,$3,$4,$5,$6) r', [actor, session, target, amount, reason, requestId])).rows[0].r;
    if (r.error) throw new Error(r.error); return r;
  };
  const wallet = () => command('gold-wallet', {}, null, f.host, sid, null);
  const start = async (kind, id = '__gold-research') => {
    await command(kind === 'research' ? 'research' : kind === 'produce' ? 'produce' : 'build', kind === 'build' ? { provinceId: f.pid('AF'), facility: 'army-base' } : { platformId: kind === 'produce' ? '__ai-infantry' : id, ...(kind === 'produce' ? { provinceId: f.pid('AH') } : {}) });
    return (await db.query("select id::text id,due,payload from dorra_private.war_events where match_id=$1 and kind=$2 order by id desc limit 1", [f.mid, kind])).rows[0];
  };
  const quote = async event => (await command('boost-quote', { queueId: event.id })).quote;
  const spend = (q, requestId) => command('boost', { quoteId: q.quoteId, confirmed: true }, requestId);
  return { ...f, command, grant, wallet, start, quote, spend };
}

test('Gold authority keeps account balances, completion, rewards and staff grants atomic and private', { timeout: 120000 }, async t => {
  const db = await warDatabase();
  await adminFixtures(db);
  const scenario = run => isolatedAiScenario(db, {}, async f => run(await fixture(db, f)));
  try {
    await t.test('zero starting Gold, account-only wallet, no purchases and current session checks', () => scenario(async f => {
      const first = await f.wallet(); assert.equal(first.gold.balance, 0); assert.equal(first.gold.purchasesAvailable, false); assert.deepEqual(first.gold.history, []);
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_accounts')).rows[0].n, 0, 'Reading never grants or invents Gold');
      await assert.rejects(f.command('gold-wallet', { userId: other }, null, f.host, sid, null), /INVALID_ARGUMENTS/);
      await db.query('update dorra_private.player_state set lease_id=$2 where user_id=$1', [f.host, crypto.randomUUID()]);
      await assert.rejects(f.wallet(), /SESSION_REPLACED/);
    }));

    await t.test('ordinary responses keep Gold compact while explicit owner wallet caps history at thirty and preserves map deltas', () => scenario(async f => {
      const privateReason = 'Private tournament award ' + 'x'.repeat(970);
      for (let n = 0; n < 31; n++) await f.grant(10, crypto.randomUUID(), f.host, privateReason);
      const wallet = (await f.wallet()).gold;
      assert.equal(wallet.history.length, 30); assert.equal(wallet.balance, 310); assert.equal(wallet.version, 31);
      const assertSummary = response => {
        assert.deepEqual(Object.keys(response.gold).sort(), ['balance', 'goldPerGameHour', 'pricingVersion', 'purchasesAvailable', 'version']);
        assert.ok(JSON.stringify(response.gold).length < 200, 'Polling has a fixed small payload independent of ledger reasons');
        assert.equal(JSON.stringify(response).includes(privateReason), false);
      };
      assertSummary(await f.command('list', {}, null, f.host, sid, null));
      const view = await f.command('view'); assertSummary(view);
      const core = (await db.query("select dorra_private.war_command_without_gold($1,$2,$3,'view',$4,'{}',null) r", [f.host, sid, lease, f.mid])).rows[0].r;
      // The pre-existing deadline is derived from clock_timestamp on each read.
      assert.ok(Math.abs(Date.parse(core.view.match.deadline) - Date.parse(view.view.match.deadline)) < 1000);
      core.view.match.deadline = view.view.match.deadline;
      assert.deepEqual(view.view, core.view, 'Gold never changes the existing filtered player view');

      const token = Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ session_id: sid })).toString('base64url') + '.verified';
      const handler = createWarHandler({ getUser: async () => ({ id: f.host }),
        rpc: async (name, args) => ({ data: (await db.query('select public.dorra_war_command($1,$2,$3,$4,$5,$6,$7) r', Object.values(args))).rows[0].r }),
        project: async (actor, mid, base, nextView) => (await db.query('select public.dorra_war_projection($1,$2,$3,$4::jsonb) r', [actor, mid, base, JSON.stringify(nextView)])).rows[0].r
      });
      const poll = async baseRevision => {
        const response = await handler(new Request('https://example.test', { method: 'POST', headers: { Origin: 'https://uppedbicycle680.github.io', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolVersion: 1, action: 'view', matchId: f.mid, leaseId: lease, args: {}, ...(baseRevision == null ? {} : { baseRevision }) }) }));
        assert.equal(response.status, 200); return response.json();
      };
      const first = await poll(), second = await poll(first.view.match.revision);
      assertSummary(second); assert.ok(second.delta); assert.equal(second.view, undefined);
      assert.deepEqual(second.delta.provinces.upsert, []); assert.deepEqual(second.delta.units.upsert, []);
      assert.ok(JSON.stringify(second).length < 3000, 'An unchanged map poll stays a small projection delta');

      const event = await f.start('research'), requestId = crypto.randomUUID();
      const quoted = await f.command('boost-quote', { queueId: event.id }, requestId); assertSummary(quoted);
      assertSummary(await f.command('boost-quote', { queueId: event.id }, requestId));
      const spendId = crypto.randomUUID(); assertSummary(await f.spend(quoted.quote, spendId));
      assertSummary(await f.spend(quoted.quote, spendId));
      assert.equal((await f.wallet()).gold.history.length, 30);
    }));

    await t.test('hourly maintenance prunes at most one thousand expired quotes without touching live quotes or permanent receipts', () => scenario(async f => {
      await f.grant(10);
      await db.query(`insert into dorra_private.war_gold_quotes(user_id,request_id,digest,match_id,queue_id,kind,nation_id,event_due,event_payload,gold_cost,label,remaining_seconds,expires_at)
        select $1,gen_random_uuid(),'expired',$2,1,'research','A',21600,'{}',60,'Expired fixture',21600,clock_timestamp()-interval '1 day' from generate_series(1,1105)`, [f.host, f.mid]);
      const live = (await db.query(`insert into dorra_private.war_gold_quotes(user_id,request_id,digest,match_id,queue_id,kind,nation_id,event_due,event_payload,gold_cost,label,remaining_seconds)
        values($1,gen_random_uuid(),'live',$2,1,'research','A',21600,'{}',60,'Live fixture',21600) returning id`, [f.host, f.mid])).rows[0].id;
      await db.exec('select dorra_private.war_maintenance()');
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_quotes')).rows[0].n, 106);
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_quotes where id=$1', [live])).rows[0].n, 1);
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_ledger')).rows[0].n, 1);
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_intents')).rows[0].n, 1);
      assert.equal((await f.wallet()).gold.balance, 10);
      await db.exec('select dorra_private.war_maintenance()');
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_quotes')).rows[0].n, 1);
    }));

    for (const kind of ['research', 'produce', 'build']) await t.test(`${kind} completes exactly one normal paid queue item and never repeats after receipt-cache cleanup`, () => scenario(async f => {
      await f.grant(500); const event = await f.start(kind), q = await f.quote(event);
      assert.equal(q.kind, kind); assert.equal(q.queueId, event.id); assert.equal(typeof q.queueId, 'string'); assert.ok(q.goldCost > 0);
      const before = (await f.side()).resources, balance = (await f.wallet()).gold.balance, requestId = crypto.randomUUID();
      const result = await f.spend(q, requestId); assert.equal(result.result.goldSpent, q.goldCost); assert.equal(result.gold.balance, balance - q.goldCost);
      assert.deepEqual((await f.side()).resources, before, 'Gold skips time; it cannot refund or bypass the original resource charge');
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_events where id=$1', [event.id])).rows[0].n, 0);
      const reports = async () => Number((await db.query("select count(*)::int n from dorra_private.war_reports where match_id=$1 and body->>'type'=$2", [f.mid, kind + '-complete'])).rows[0].n);
      assert.equal(await reports(), 1);
      if (kind === 'research') assert.ok((await f.side()).research.includes('__gold-research'));
      if (kind === 'produce') assert.equal((await db.query("select count(*)::int n from dorra_private.war_units where match_id=$1 and platform_id='__ai-infantry'", [f.mid])).rows[0].n, 1);
      if (kind === 'build') assert.equal((await db.query("select facilities->>'army-base' level from dorra_private.war_provinces where match_id=$1 and province_id=$2", [f.mid, f.pid('AF')])).rows[0].level, '1');
      await db.query('delete from dorra_private.war_requests where user_id=$1', [f.host]);
      await db.query('delete from dorra_private.war_gold_quotes where id=$1', [q.quoteId]);
      const replay = await f.spend(q, requestId); assert.equal(replay.replayed, true); assert.equal(replay.result.receiptId, result.result.receiptId);
      await f.advance(Number(event.due) + 1); assert.equal(await reports(), 1, 'Normal cron cannot complete an accelerated item a second time');
      assert.equal((await f.wallet()).gold.balance, result.gold.balance);
    }));

    await t.test('quotes use fractional game hours and confirmation never costs more as time elapses', () => scenario(async f => {
      await f.grant(100); const event = await f.start('research');
      await db.query('update dorra_private.war_events set due=1800 where id=$1', [event.id]); const q = await f.quote(event); assert.equal(q.goldCost, 5);
      await db.query("update dorra_private.war_matches set game_anchor=900 where id=$1", [f.mid]);
      const result = await f.spend(q); assert.equal(result.result.goldSpent, 3); assert.equal(result.gold.balance, 97);
    }));

    await t.test('queue IDs remain lossless beyond JavaScript safe integers from database view through exact completion', () => scenario(async f => {
      await f.grant(100);
      const id = '9007199254740993';
      await db.query("insert into dorra_private.war_events(id,match_id,kind,due,payload) overriding system value values($1,$2,'research',1800,jsonb_build_object('nationId','A','platformId','__gold-research'))", [id, f.mid]);
      const view = (await f.command('view')).view;
      assert.equal(view.player.researchQueue[0].id, id);
      const q = await f.quote({ id }); assert.equal(q.queueId, id);
      assert.equal((await f.spend(q)).result.queueId, id);
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_events where id=$1', [id])).rows[0].n, 0);
    }));

    await t.test('simultaneously submitted spends cannot overdraw one account or double-complete a quote', () => scenario(async f => {
      await f.grant(60); const a = await f.quote(await f.start('research')), b = await f.quote(await f.start('research', '__gold-research-two'));
      const outcomes = await Promise.allSettled([f.spend(a), f.spend(b)]);
      assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1); assert.match(outcomes.find(r => r.status === 'rejected').reason.message, /INSUFFICIENT_GOLD/);
      assert.equal((await f.wallet()).gold.balance, 0);
      assert.equal((await db.query("select count(*)::int n from dorra_private.war_gold_ledger where kind='boost'")).rows[0].n, 1);
      assert.equal((await db.query("select count(*)::int n from dorra_private.war_events where match_id=$1 and kind='research'", [f.mid])).rows[0].n, 1);
    }));

    await t.test('foreign events, quotes, missing confirmation and forged prices never spend', () => scenario(async f => {
      await f.grant(100); const event = await f.start('research'), q = await f.quote(event);
      await assert.rejects(f.command('boost', { quoteId: q.quoteId, confirmed: true }, crypto.randomUUID(), other, otherSession), /BOOST_QUOTE_UNAVAILABLE/);
      await assert.rejects(f.command('boost', { quoteId: q.quoteId, confirmed: false }), /BOOST_CONFIRM_REQUIRED/);
      await assert.rejects(f.command('boost', { quoteId: q.quoteId, confirmed: true, goldCost: 0 }), /BOOST_CONFIRM_REQUIRED/);
      const foreign = (await db.query("insert into dorra_private.war_events(match_id,kind,due,payload) values($1,'research',21600,jsonb_build_object('nationId','B','platformId','__ai-armor')) returning id::text id", [f.mid])).rows[0];
      await assert.rejects(f.quote(foreign), /BOOST_QUEUE_UNAVAILABLE/);
      assert.equal((await f.wallet()).gold.balance, 100);
    }));

    await t.test('expired, naturally completed, captured and stopped-world queues reject without charging', () => scenario(async f => {
      await f.grant(500); const event = await f.start('research'), q = await f.quote(event);
      await db.query("update dorra_private.war_gold_quotes set expires_at=clock_timestamp()-interval '1 second' where id=$1", [q.quoteId]);
      await assert.rejects(f.spend(q), /BOOST_QUOTE_EXPIRED/);
      const newer = await f.quote(event); await db.query("update dorra_private.war_matches set status='paused' where id=$1", [f.mid]); await assert.rejects(f.spend(newer), /MATCH_NOT_RUNNING/);
      await db.query("update dorra_private.war_matches set status='running' where id=$1", [f.mid]);
      await f.advance(Number(event.due) + 1); await assert.rejects(f.spend(newer), /BOOST_QUEUE_UNAVAILABLE/);
      const build = await f.start('build'), construction = await f.quote(build);
      await db.query("update dorra_private.war_provinces set nation_id='B' where match_id=$1 and province_id=$2", [f.mid, f.pid('AF')]);
      await assert.rejects(f.spend(construction), /BOOST_QUEUE_UNAVAILABLE/);
      assert.equal((await f.wallet()).gold.balance, 500);
    }));

    await t.test('request reuse is denied permanently and wallet history contains only its owner', () => scenario(async f => {
      await f.grant(100); await f.grant(77, crypto.randomUUID(), other, 'Other private award');
      const event = await f.start('research'), requestId = crypto.randomUUID(); const q = (await f.command('boost-quote', { queueId: event.id }, requestId)).quote;
      await assert.rejects(f.command('boost', { quoteId: q.quoteId, confirmed: true }, requestId), /REQUEST_REUSED/);
      const own = (await f.wallet()).gold; assert.equal(own.balance, 100); assert.equal(own.history.length, 1); assert.equal(own.history[0].amount, 100);
      assert.equal(JSON.stringify(own).includes('Other private award'), false); assert.equal(JSON.stringify(own).includes(other), false);
    }));

    await t.test('eligible victories award five Gold independently of full House caps, with ten per Brisbane day and permanent replay', () => scenario(async f => {
      await db.query("update dorra_private.war_matches set status='finished',winner='A',game_anchor=86400,real_anchor=null where id=$1", [f.mid]);
      const day = (await db.query("select (clock_timestamp() at time zone 'Australia/Brisbane')::date::text as reward_date")).rows[0].reward_date;
      // Existing normal House receipt exhausts its own daily cap independently.
      await db.query('insert into dorra_private.war_rewards(user_id,match_id,amount,reward_day) values($1,$2,1000,$3)', [other, f.mid, day]);
      await db.query("insert into dorra_private.war_rewards(user_id,match_id,amount,reward_day) values($1,$2,1000,$3)", [f.host, f.mid, day]);
      // Exercise the normal claim on three separate legitimate finished worlds.
      const rewards = [];
      for (let n = 0; n < 3; n++) {
        const mid = crypto.randomUUID();
        await db.query("insert into dorra_private.war_matches(id,name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds,winner,game_anchor) values($1,'Gold victory',$2,'finished','duel','ai','persistent','invite',4,2592000,'A',86400)", [mid, f.host]);
        await db.query("insert into dorra_private.war_sides(match_id,nation_id,user_id) values($1,'A',$2)", [mid, f.host]);
        const requestId = crypto.randomUUID(); const result = await f.command('reward', {}, requestId, f.host, sid, mid); rewards.push(result.result.goldAward);
        assert.equal(result.result.amount, 0, 'House cash cap cannot prevent the independent Gold settlement');
        await db.query('delete from dorra_private.war_requests where user_id=$1', [f.host]);
        const replay = await f.command('reward', {}, requestId, f.host, sid, mid); assert.equal(replay.replayed, true); assert.equal(replay.result.goldAward, result.result.goldAward);
      }
      assert.deepEqual(rewards, [5, 5, 0]); assert.equal((await f.wallet()).gold.balance, 10);
      assert.equal((await f.wallet()).gold.version, 3, 'A zero-award receipt also invalidates cached history; permanent replay does not');
      assert.equal((await db.query("select count(*)::int n from dorra_private.war_gold_ledger where kind='victory-reward'")).rows[0].n, 3);
      assert.equal(Number((await db.query("select snapshot->>'balance' balance from dorra_private.player_state where user_id=$1", [f.host])).rows[0].balance), 1000);
    }));

    await t.test('an identical reward receipt becoming visible after the facade lookup is a replay instead of a duplicate-key failure', () => scenario(async f => {
      await db.query("update dorra_private.war_matches set status='finished',winner='A',game_anchor=86400,real_anchor=null where id=$1", [f.mid]);
      // PGlite serializes client calls. Reproduce the precise contested window
      // deterministically: the delegated locked core finishes the same accepted
      // intent before the outer facade reaches its final permanent INSERT.
      await db.exec(`do $copy$ begin execute replace(pg_get_functiondef('dorra_private.war_command_without_gold(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure),
        'FUNCTION dorra_private.war_command_without_gold(','FUNCTION pg_temp.gold_interleaving_core(');end $copy$;
        create or replace function dorra_private.war_command_without_gold(p_user_id uuid,p_auth_session_id uuid,p_lease_id uuid,p_action text,p_match_id uuid default null,p_args jsonb default '{}',p_request_id uuid default null)
        returns jsonb language plpgsql security invoker set search_path='' as $$declare result jsonb;award integer;begin
          result:=pg_temp.gold_interleaving_core(p_user_id,p_auth_session_id,p_lease_id,p_action,p_match_id,p_args,p_request_id);
          if p_action='reward' then
            award:=dorra_private.war_gold_reward(p_user_id,p_match_id,p_request_id);
            result:=jsonb_set(result,'{result,goldAward}',to_jsonb(award));
            insert into dorra_private.war_gold_intents(actor_id,request_id,digest,result) values(p_user_id,p_request_id,
              md5(jsonb_build_object('action',p_action,'match',p_match_id,'args',p_args)::text),result-'view'-'gold'-'serverNow');
          end if;return result;end $$;`);
      const requestId = crypto.randomUUID(), result = await f.command('reward', {}, requestId);
      assert.equal(result.replayed, true); assert.equal(result.result.goldAward, 5); assert.equal(result.gold.balance, 5);
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_intents where actor_id=$1 and request_id=$2', [f.host, requestId])).rows[0].n, 1);
      assert.equal((await db.query("select count(*)::int n from dorra_private.war_gold_ledger where user_id=$1 and kind='victory-reward'", [f.host])).rows[0].n, 1);
      const again = await f.command('reward', {}, requestId); assert.deepEqual(again.result, result.result); assert.equal(again.gold.version, 1);
    }));

    await t.test('losses, too-short or retired games cannot award victory Gold', () => scenario(async f => {
      await db.query("update dorra_private.war_matches set status='finished',winner='B',game_anchor=86400,real_anchor=null where id=$1", [f.mid]);
      const loss = await f.command('reward'); assert.equal(loss.result.goldAward, 0); assert.equal(loss.gold.balance, 0);
      for (const [elapsed, retired] of [[86399, false], [86400, true]]) {
        const mid = crypto.randomUUID();
        await db.query("insert into dorra_private.war_matches(id,name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds,winner,game_anchor) values($1,'Ineligible victory',$2,'finished','duel','ai','persistent','invite',4,2592000,'A',$3)", [mid, f.host, elapsed]);
        await db.query("insert into dorra_private.war_sides(match_id,nation_id,user_id,retired) values($1,'A',$2,$3)", [mid, f.host, retired]);
        await assert.rejects(f.command('reward', {}, crypto.randomUUID(), f.host, sid, mid), /REWARD_INELIGIBLE/);
      }
      assert.equal((await f.wallet()).gold.balance, 0);
    }));

    await t.test('old House reward replays do not retroactively create Gold', () => scenario(async f => {
      await db.query("update dorra_private.war_matches set status='finished',winner='A',game_anchor=86400,real_anchor=null where id=$1", [f.mid]);
      const requestId = crypto.randomUUID();
      await db.query("insert into dorra_private.war_rewards(user_id,match_id,amount,reward_day,created_at) values($1,$2,1000,(clock_timestamp() at time zone 'Australia/Brisbane')::date,now()-interval '1 day')", [f.host, f.mid]);
      await db.query("insert into dorra_private.war_requests(user_id,request_id,digest,match_id,result) values($1,$2,md5(jsonb_build_object('action','reward','match',$3::uuid,'args','{}'::jsonb)::text),$3,'{\"result\":{\"type\":\"reward\",\"amount\":1000}}')", [f.host, requestId, f.mid]);
      const result = await f.command('reward', {}, requestId); assert.equal(result.replayed, true); assert.equal(result.result.goldAward, 0); assert.equal(result.gold.balance, 0);
    }));

    await t.test('Gold staff awards use actual protected role/session/grant, immutable receipts and audit without a House save', () => scenario(async f => {
      await db.query('delete from dorra_private.player_state where user_id=$1', [other]);
      const requestId = crypto.randomUUID(), result = await f.grant(45, requestId, other);
      assert.equal(result.goldBalance, 45); assert.equal((await f.grant(45, requestId, other)).replayed, true);
      await assert.rejects(f.grant(45, requestId, f.host), /REQUEST_REUSED/);
      assert.equal((await db.query('select count(*)::int n from dorra_private.admin_audit where request_id=$1', [requestId])).rows[0].n, 1);
      const projected = (await db.query('select dorra_private.profile_view($1,true) p', [other])).rows[0].p; assert.equal(projected.goldBalance, 45);
      assert.equal((await db.query('select dorra_private.profile_view($1,false) p', [other])).rows[0].p.goldBalance, null, 'The existing resource mask also protects account Gold');
      const adminRows = (await db.query("select public.dorra_admin_read($1,$2,'players','{}') p", [admin, adminSession])).rows[0].p.rows;
      assert.equal(adminRows.find(row => row.userId === other).goldBalance, 45, 'Approved administrators receive batched list balances');
      const defaultRows = (await db.query("select public.dorra_admin_read($1,$2,'players') p", [admin, adminSession])).rows[0].p.rows;
      assert.deepEqual(defaultRows, adminRows, 'The installed admin RPC default remains callable after the Gold wrapper');
      await assert.rejects(f.grant(1, crypto.randomUUID(), f.host, 'Forged metadata', other, otherSession), /STAFF_REQUIRED/);
      await db.query("update dorra_private.profiles set role='moderator' where user_id=$1", [admin]); await assert.rejects(f.grant(1), /PERMISSION_DENIED/);
      const modRows = (await db.query("select public.dorra_admin_read($1,$2,'players','{}') p", [admin, adminSession])).rows[0].p.rows;
      assert.equal(modRows.find(row => row.userId === other).goldBalance, null, 'A moderator raw staff response cannot expose account balances');
      await db.query("update dorra_private.profiles set role='admin' where user_id=$1", [admin]);
      await db.query("update dorra_private.admin_grants set expires_at=now()-interval '1 second' where user_id=$1", [admin]); await assert.rejects(f.grant(1), /ACCESS_EXPIRED/);
      await db.query("update dorra_private.admin_grants set expires_at=now()+interval '1 minute',code_version='old-code' where user_id=$1", [admin]); await assert.rejects(f.grant(1), /ACCESS_EXPIRED/);
      await db.query("delete from auth.sessions where id=$1", [adminSession]); await assert.rejects(f.grant(1), /AUTH_SESSION_ENDED/);
    }));

    await t.test('Gold tables and internal helpers remain inaccessible to browser database roles', async () => {
      await db.exec('set role authenticated');
      try {
        for (const table of ['war_gold_accounts', 'war_gold_ledger', 'war_gold_intents', 'war_gold_quotes']) await assert.rejects(db.query('select * from dorra_private.' + table), /permission denied/);
        await assert.rejects(db.query('select dorra_private.war_gold_view($1)', [other]), /permission denied/);
        await assert.rejects(db.query('select dorra_private.war_gold_history_view($1)', [other]), /permission denied/);
        await assert.rejects(db.query('select public.dorra_admin_gold_grant($1,$2,$3,5,$4,$5)', [admin, adminSession, other, 'Not permitted', crypto.randomUUID()]), /permission denied/);
      } finally { await db.exec('reset role'); }
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_ledger')).rows[0].n, 0, 'Rollback fixtures leave no production-looking financial receipts');
    });
  } finally { await db.close(); }
});

test('Gold transport forwards only fixed authenticated intentions and never accepts client credits or prices', async () => {
  const body = { protocolVersion: 1, action: 'boost-quote', matchId: crypto.randomUUID(), leaseId: lease, requestId: crypto.randomUUID(), args: { queueId: '9007199254740993' } };
  assert.equal(validateWarBody(body).args.queueId, '9007199254740993');
  for (const queueId of [1, '0', '-1', '9223372036854775808', 'not-a-queue']) assert.throws(() => validateWarBody({ ...body, args: { queueId } }));
  assert.throws(() => validateWarBody({ ...body, action: 'boost', args: { quoteId: crypto.randomUUID(), confirmed: true, goldCost: 0 } }));
  assert.throws(() => validateWarBody({ ...body, action: 'credit-gold', args: { amount: 1000 } }));
  assert.throws(() => validateAdmin({ operation: 'gold-grant', args: { targetId: other, amount: 100001, reason: 'Too much' }, requestId: crypto.randomUUID() }));
  assert.throws(() => validateAdmin({ operation: 'gold-grant', args: { targetId: other, amount: 5, reason: '' }, requestId: crypto.randomUUID() }));
  const token = Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ session_id: sid })).toString('base64url') + '.verified';
  const requests = [], rpc = async (name, args) => { requests.push({ name, args }); return { data: { gold: { balance: 0 }, quote: { goldCost: 5 } } }; };
  const request = input => new Request('https://example.test', { method: 'POST', headers: { Origin: 'https://uppedbicycle680.github.io', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const response = await createWarHandler({ getUser: async () => ({ id: other }), rpc })(request(body)); assert.equal(response.status, 200);
  assert.equal(requests[0].args.p_user_id, other); assert.equal(requests[0].args.p_auth_session_id, sid); assert.equal(requests[0].args.p_args.queueId, '9007199254740993');
  const adminResponse = await createAdminHandler({ getUser: async () => ({ id: admin, user_metadata: { role: 'player' } }), rpc })(request({ operation: 'gold-grant', requestId: body.requestId, args: { targetId: other, amount: 5, reason: 'Tournament result' } }));
  assert.equal(adminResponse.status, 200); assert.equal(requests[1].name, 'dorra_admin_gold_grant'); assert.equal(requests[1].args.p_actor, admin);
});

test('hosted Gold fixture exercises service RPCs with the complete catalogue and rolls back every account and financial receipt', { timeout: 120000 }, async () => {
  const db = await warDatabase();
  try {
    await adminFixtures(db);
    // Mirror only the pre-existing Supabase/House baseline permissions omitted
    // by warDatabase's small Auth stubs. Gold migration ACLs stay untouched.
    await db.exec(`grant usage on schema auth,dorra_private to service_role;
      grant select on auth.users,auth.sessions to service_role;
      grant select,insert,update on dorra_private.profiles,dorra_private.player_state,dorra_private.admin_grants to service_role;
      grant select,insert on dorra_private.admin_audit to service_role;`);
    const directory = new URL('../scripts/war-seed/', import.meta.url);
    for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, directory), 'utf8'));
    const results = await db.exec(await readFile(new URL('../supabase/tests/war-gold-hosted.sql', import.meta.url), 'utf8'));
    const report = results.flatMap(result => result.rows || []).find(row => row.war_gold_hosted_report)?.war_gold_hosted_report;
    assert.equal(report?.passed, true); assert.equal(report.fixtureAccounts, 3); assert.equal(report.checks.length, 7);
    assert.ok(report.durationMs < 20000); assert.ok(report.catalogue.platforms >= 95);
    for (const table of ['war_gold_accounts', 'war_gold_ledger', 'war_gold_intents', 'war_gold_quotes', 'war_matches']) assert.equal((await db.query('select count(*)::int n from dorra_private.' + table)).rows[0].n, 0, table + ' must roll back');
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 0);
  } finally { await db.close(); }
});
