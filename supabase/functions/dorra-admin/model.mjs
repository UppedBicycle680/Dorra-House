import {MAX_BALANCE, MAX_FOOTBALL_TOKENS, applyDeveloperMoneyChange, applyDeveloperFootballTokenGrant} from '../dorra-api/shared/game-limits.js';
import {awardXP} from '../dorra-api/house-progression.mjs';
import {shop,macbookFamilies} from '../dorra-api/house-catalog.mjs';
import {MAX_CURRENCY, MAX_DIAMONDS} from '../dorra-api/shared/airport/engine.mjs';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function fail(message, code='INVALID_INPUT', status=400) { throw Object.assign(new Error(message), {code,status}); }
export function object(input, keys) {
  if (!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!keys.includes(key))) fail('Unsupported fields. Refresh and try again.');
  return input;
}
export function text(value, label, max=1000) {
  if(typeof value!=='string' || !value.trim() || value.trim().length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`${label} is required and must contain at most ${max} characters.`);
  return value.trim();
}
export function integer(value,min,max,label='Value') {
  if(!Number.isSafeInteger(value)||value<min||value>max) fail(`${label} must be a whole number between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
  return value;
}
export function validate(input) {
  object(input,['operation','args','requestId','previewId']);
  const reads=['status','unlock','lock','dashboard','players','player','reports','report','activity','staff','preview','commit'];
  if(!reads.includes(input.operation)) fail('Unknown operation.');
  object(input.args||{},['search','status','offset','period','targetId','reportId','kind','code','action','reason','value','amount','direction','sessions','wins','level','airportId','unlockId','enabled','duration','confirmation','title','evidence','resolution','role','flagId']);
  const args=input.args||{};
  if(args.search!==undefined && (typeof args.search!=='string'||args.search.length>80)) fail('Search must contain at most 80 characters.');
  if(args.offset!==undefined) integer(args.offset,0,10000,'Page offset');
  if(args.period!==undefined&&!['24h','7d','30d',...(input.operation==='activity'&&args.targetId?['all']:[])].includes(args.period)) fail('Choose a supported period.');
  for(const id of ['targetId','reportId','flagId']) if(args[id]!==undefined&&!UUID.test(args[id])) fail('Choose a valid record.');
  if(input.operation==='unlock' && (typeof args.code!=='string'||!/^DH-[A-Za-z0-9_-]{43}$/.test(args.code))) fail('The access code is invalid.','INVALID_CODE',403);
  if(input.operation==='preview') {
    if(!UUID.test(args.targetId||'')) fail('Choose a player.');
    text(args.reason,'Reason');
    if(!['money','xp','stats','football-tokens','airport-cash','airport-research','airport-diamonds','level','unlock','warn','suspend','lift','ban','report-create','report-resolve','flag','flag-resolve','staff-role','revoke-access'].includes(args.action)) fail('Choose a supported action.');
  }
  if(input.operation==='commit' && (!UUID.test(input.previewId||'')||!UUID.test(input.requestId||''))) fail('Preview the change before confirming.');
  return {...input,args};
}
export async function sha256(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function constantEqual(a,b) {
  if(typeof a!=='string'||typeof b!=='string') return false;
  let different=a.length^b.length;
  for(let i=0;i<64;i++) different|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return different===0;
}

// This module sees private state only inside the Edge Function. The client gets
// a compact before/after list, never this snapshot or random outcome state.
export function prepareChange(saved,args,actor,now=Date.now()) {
  const snapshot=structuredClone(saved.snapshot), privateState=structuredClone(saved.privateState);
  const action=args.action, changes=[];
  const privileged=['money','xp','stats','football-tokens','airport-cash','airport-research','airport-diamonds','level','unlock','lift','ban'];
  if(privileged.includes(action)&&actor.role!=='admin') fail('This action requires administrator permission.','PERMISSION_DENIED',403);
  if(['staff-role','revoke-access'].includes(action)&&!actor.owner) fail('Only the House owner can manage staff access.','PERMISSION_DENIED',403);
  const change=(label,before,after)=>changes.push({label,before,after});
  const p=snapshot?.progress;
  if(privileged.slice(0,9).includes(action)&&!snapshot) fail('This player has no cloud save. Ask them to enter the House first.','SAVE_REQUIRED',409);
  if(action==='money') {
    integer(args.amount,1,MAX_BALANCE,'Amount');
    if(!['add','remove'].includes(args.direction)) fail('Choose add or remove.');
    const result=applyDeveloperMoneyChange(snapshot.balance,args.amount,args.direction);
    if(!result.ok) fail(result.message);change('Play money',snapshot.balance,result.balance);snapshot.balance=result.balance;
  } else if(action==='xp') {
    integer(args.amount,1,1_000_000,'XP');const before={level:p.level,xp:p.xp};awardXP(snapshot,args.amount);change('House progression',before,{level:p.level,xp:p.xp});
  } else if(action==='level') {
    integer(args.level,1,99,'Level');change('Level',p.level,args.level);p.level=args.level;
    const xp=Math.min(p.xp,200+p.level*100-1);if(xp!==p.xp)change('XP within level',p.xp,xp);p.xp=xp;
  } else if(action==='stats') {
    integer(args.sessions,0,1_000_000,'Rounds');integer(args.wins,0,args.sessions,'Wins');
    change('Rounds',snapshot.stats.sessions,args.sessions);change('Wins',snapshot.stats.wins,args.wins);snapshot.stats.sessions=args.sessions;snapshot.stats.wins=args.wins;
  } else if(action==='football-tokens') {
    if(!p.footballManager?.club) fail('This player must create a football club first.','CAREER_REQUIRED',409);
    integer(args.amount,1,MAX_FOOTBALL_TOKENS,'Tokens');const result=applyDeveloperFootballTokenGrant(p.footballManager.footballTokens,args.amount);
    if(!result.ok)fail(result.message);change('Football tokens',p.footballManager.footballTokens,result.tokens);p.footballManager.footballTokens=result.tokens;
  } else if(action.startsWith('airport-')) {
    const career=privateState.airport;
    if(!career) fail('This player must open an airport career first.','CAREER_REQUIRED',409);
    const key=action==='airport-diamonds'?'diamonds':action==='airport-cash'?'cash':'research';
    const entity=key==='diamonds'?career:career.airports[args.airportId];
    if(!entity) fail('Select an airport owned by this player.','AIRPORT_NOT_OWNED',409);
    const max=key==='diamonds'?MAX_DIAMONDS:MAX_CURRENCY;integer(args.amount,1,max,'Amount');
    if(!Number.isSafeInteger(entity[key])||args.amount>max-entity[key])fail(`That change would exceed the ${key} limit of ${max.toLocaleString()}.`);
    change(key==='diamonds'?'Airport diamonds':`${args.airportId} ${key}`,entity[key],entity[key]+args.amount);entity[key]+=args.amount;career.revision++;
  } else if(action==='unlock') {
    const item=shop.find(item=>item.id===args.unlockId);
    if(!item) fail('Choose a valid boutique unlock.');
    if(item.configurable || macbookFamilies[item.id]) fail('Configured devices must be purchased through the existing game configurator.');
    if(typeof args.enabled!=='boolean') fail('Choose grant or revoke.');
    if(args.enabled && p.level<(item.level||1)) fail(`This unlock requires level ${item.level}. Adjust progression first.`);
    const owned=p.owned.includes(item.id);change(item.name||item.id,owned?'Unlocked':'Locked',args.enabled?'Unlocked':'Locked');
    p.owned=args.enabled?[...new Set([...p.owned,item.id])]:p.owned.filter(id=>id!==item.id);
    if(!args.enabled) {for(const [slot,id]of Object.entries(p.equipped||{}))if(id===item.id)delete p.equipped[slot];}
  } else if(action==='warn') change('Warning','No new warning',args.reason);
  else if(action==='suspend') {
    if(![24,168,720].includes(args.duration))fail('Choose 24 hours, 7 days or 30 days.');
    change('Suspension',saved.profile.suspendedUntil||'None',new Date(now+args.duration*3_600_000).toISOString());
  } else if(action==='lift') change('Suspension',saved.profile.suspendedUntil||'None','None');
  else if(action==='ban') {
    if(args.confirmation!==saved.profile.username)fail('Type the player’s exact username to confirm the permanent ban.');change('Account',saved.profile.banned?'Banned':'Active','Permanently banned');
  } else if(action==='report-create') {
    text(args.title,'Report title',120);text(args.evidence,'Evidence',4000);change('New report',null,args.title);
  } else if(action==='report-resolve') {
    if(!UUID.test(args.reportId||'')) fail('Choose a report.');
    if(!['resolved','dismissed'].includes(args.resolution))fail('Choose resolved or dismissed.');change('Report status','Open',args.resolution);
  } else if(action==='flag') change('Activity flag',null,args.reason);
  else if(action==='flag-resolve') {if(!UUID.test(args.flagId||''))fail('Choose a flag.');change('Activity flag','Open','Resolved');}
  else if(action==='staff-role') {
    if(!['player','moderator','admin'].includes(args.role))fail('Choose a supported staff role.');change('Role',saved.profile.role,args.role);
  } else if(action==='revoke-access') change('Panel grants','Existing grants','Revoked');
  if(saved.profile.owner && ['ban','suspend','staff-role'].includes(action)) fail('Owner status must be managed through trusted Supabase setup.','OWNER_PROTECTED',403);
  return {snapshot,privateState,changes,args,resource:privileged.slice(0,9).includes(action)};
}
export const unlockCatalog=()=>shop.filter(item=>!item.configurable&&!macbookFamilies[item.id]).map(({id,name,level})=>({id,name,level:level||1}));
