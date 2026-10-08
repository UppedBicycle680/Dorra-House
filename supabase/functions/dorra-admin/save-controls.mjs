import {MAX_BALANCE,MAX_FOOTBALL_TOKENS} from '../dorra-api/shared/game-limits.js';
import {EMPIRE_VENUES,EMPIRE_STAFF_ROLES,EMPIRE_FOCUSES,STORY_MISSIONS,STORY_CHARACTERS} from '../dorra-api/shared/progression-engine.js';
import {MAX_CURRENCY,MAX_DIAMONDS,projectCareer} from '../dorra-api/shared/airport/engine.mjs';

const read=(root,path)=>path.reduce((value,key)=>value?.[key],root);
const write=(root,path,value)=>{let item=root;for(const key of path.slice(0,-1)){if(!item[key]||typeof item[key]!=='object')throw new Error('This save field is unavailable.');item=item[key];}item[path.at(-1)]=value;};
const domains=['House','Estate','Story','Football','Airport','Strategic Command'];
// Opaque field IDs select server-authored scalar controls, never client paths.
function fields(saved){
 const controls=[],s=saved.snapshot,p=s?.progress,c=saved.privateState?.airport;
 if(!s||!p)return controls;
 const add=(domain,label,root,path,type,limits={})=>{const value=read(saved[root],path);if(value===undefined||value===null)return;controls.push({id:domain+'|'+path.join('|'),domain,label,type,value,...limits,root,path});};
 const num=(domain,label,root,path,min,max)=>add(domain,label,root,path,'number',{min,max});
 const choice=(domain,label,root,path,options)=>add(domain,label,root,path,'choice',{options});
 num('House','Play money','snapshot',['balance'],0,MAX_BALANCE);
 num('House','Level','snapshot',['progress','level'],1,99);
 num('House','XP within current level','snapshot',['progress','xp'],0,200+p.level*100-1);
 num('House','Rounds','snapshot',['stats','sessions'],s.stats.wins,1_000_000);
 num('House','Wins','snapshot',['stats','wins'],0,s.stats.sessions);
 add('House','Display name','snapshot',['progress','profile','name'],'text',{maxLength:24});
 if(p.empire){
  num('Estate','Pending income','snapshot',['progress','empire','pending'],0,1_000_000_000);
  num('Estate','Reputation','snapshot',['progress','empire','reputation'],1,100);
  num('Estate','Guest satisfaction','snapshot',['progress','empire','satisfaction'],1,100);
  for(const venue of EMPIRE_VENUES){const entry=p.empire.venues?.[venue.id];if(!entry?.level)continue;
   num('Estate',venue.name+' level','snapshot',['progress','empire','venues',venue.id,'level'],entry.level,venue.levels.length);
   if(entry.manager)choice('Estate',venue.name+' focus','snapshot',['progress','empire','venues',venue.id,'focus'],EMPIRE_FOCUSES.map(f=>({value:f.id,label:f.name||f.id})));
   for(const role of EMPIRE_STAFF_ROLES)num('Estate',venue.name+' · '+(role.name||role.id),'snapshot',['progress','empire','venues',venue.id,'staff',role.id],0,25);
  }
 }
 if(p.story){num('Story','Completed chapters','snapshot',['progress','story','index'],0,STORY_MISSIONS.length);
  for(const person of STORY_CHARACTERS)num('Story',person.name+' relationship','snapshot',['progress','story','relationships',person.id],0,8);
  num('Story','Story rounds','snapshot',['progress','story','metrics','rounds'],p.story.metrics?.wins||0,1_000_000);
  num('Story','Story wins','snapshot',['progress','story','metrics','wins'],0,p.story.metrics?.rounds||0);
 }
 const f=p.footballManager;
 if(f?.club){num('Football','Football tokens','snapshot',['progress','footballManager','footballTokens'],0,MAX_FOOTBALL_TOKENS);
  add('Football','Club name','snapshot',['progress','footballManager','club','name'],'text',{maxLength:48});
  num('Football','Club reputation','snapshot',['progress','footballManager','club','reputation'],1,100);
  num('Football','Governance','snapshot',['progress','footballManager','club','governance'],0,100);
  num('Football','Club cash','snapshot',['progress','footballManager','finance','cash'],0,9_000_000_000_000);
  num('Football','Weekly first-team budget','snapshot',['progress','footballManager','finance','weeklyFirstTeamBudget'],0,9_000_000_000_000);
  for(const squad of ['first','u23','academy'])for(const key of ['morale','fatigue','familiarity'])num('Football',squad+' '+key,'snapshot',['progress','footballManager',squad,key],0,100);
  for(const squad of ['first','u23','academy'])for(const player of f.squads?.[squad]?.players||[])for(const [key,min,max]of [['rating',1,99],['potential',player.rating,99],['morale',0,100],['fatigue',0,100],['injuryWeeks',0,80]])num('Football',squad+' · '+player.name+' · '+key,'snapshot',['progress','footballManager','squads',squad,'players',f.squads[squad].players.indexOf(player),key],min,key==='rating'?Math.min(max,player.potential):max);
 }
 if(c){num('Airport','Diamonds','privateState',['airport','diamonds'],0,MAX_DIAMONDS);
  choice('Airport','Selected airport','privateState',['airport','selectedAirportId'],Object.keys(c.airports).map(id=>({value:id,label:id})));
  for(const [id,airport]of Object.entries(c.airports)){num('Airport',id+' cash','privateState',['airport','airports',id,'cash'],0,MAX_CURRENCY);num('Airport',id+' research','privateState',['airport','airports',id,'research'],0,MAX_CURRENCY);
   const projection=projectCareer({...c,selectedAirportId:id},Date.now(),{compact:true}).airports.find(a=>a.id===id);
   for(const building of projection?.buildings||[])if(building.level>0&&building.quote.available)num('Airport',id+' · '+building.name,'privateState',['airport','airports',id,'buildings',building.key],building.level,building.maxLevel);
  }
 }
 const campaign=p.campaign;
 if(campaign?.homeCountryId){
  for(const [key,max]of [['treasury',1e9],['researchPoints',1e7],['intel',30],['command',campaign.commandMax]])num('Strategic Command',key,'snapshot',['progress','campaign',key],0,max);
  for(const [id,value]of Object.entries(campaign.readiness||{}))if(typeof value==='number')num('Strategic Command',id+' readiness','snapshot',['progress','campaign','readiness',id],5,100);
 }
 return controls;
}
export function saveControls(saved){const list=fields(saved);return domains.map(domain=>({domain,available:list.some(f=>f.domain===domain),controls:list.filter(f=>f.domain===domain).map(({path,root,...field})=>field)}));}
export function editSaveField(saved,args){
 const field=fields(saved).find(f=>f.id===args.fieldId);if(!field)throw new Error('Choose an available save control.');
 const value=args.value;
 if(field.type==='number'&&(!Number.isSafeInteger(value)||value<field.min||value>field.max))throw new Error(`${field.label} must be a whole number from ${field.min} to ${field.max}.`);
 if(field.type==='choice'&&!field.options.some(o=>o.value===value))throw new Error('Choose an available option.');
 if(field.type==='text'&&(typeof value!=='string'||!value.trim()||value.length>field.maxLength||/[\u0000-\u001f]/.test(value)))throw new Error(`${field.label} must contain 1–${field.maxLength} characters.`);
 const result={snapshot:structuredClone(saved.snapshot),privateState:structuredClone(saved.privateState)};
 write(result[field.root],field.path,field.type==='text'?value.trim():value);
 const p=result.snapshot.progress;
 if(field.domain==='House'&&field.path.at(-1)==='level')p.xp=Math.min(p.xp,200+p.level*100-1);

 if(field.domain==='Story'&&field.path.at(-1)==='index'){
  p.story.completedIds=STORY_MISSIONS.slice(0,p.story.index).map(m=>m.id);
  const ids=new Set(p.story.completedIds);
  p.story.choices=Object.fromEntries(Object.entries(p.story.choices||{}).filter(([id])=>ids.has(id)));
  p.story.dialogueSeen=(p.story.dialogueSeen||[]).filter(id=>ids.has(id.split(':')[0]));
 }
 if(field.domain==='Airport')result.privateState.airport.revision++;
 if(field.domain==='House'&&field.path[0]==='balance'&&p.campaign){p.campaign.capitalUsd=result.snapshot.balance;p.campaign.finance={...p.campaign.finance,sharedBankLinked:true};}
 const changes=[{label:field.domain+' · '+field.label,before:field.value,after:read(result[field.root],field.path)}];
 if(field.domain==='House'&&field.path.at(-1)==='level'&&p.xp!==saved.snapshot.progress.xp)changes.push({label:'XP within level',before:saved.snapshot.progress.xp,after:p.xp});
 if(field.domain==='Story'&&field.path.at(-1)==='index'){
  changes.push({label:'Completed chapter IDs',before:(saved.snapshot.progress.story.completedIds||[]).join(', '),after:p.story.completedIds.join(', ')});
  changes.push({label:'Retained chapter choices',before:Object.keys(saved.snapshot.progress.story.choices||{}).length,after:Object.keys(p.story.choices||{}).length});
  changes.push({label:'Retained dialogue acknowledgements',before:(saved.snapshot.progress.story.dialogueSeen||[]).length,after:p.story.dialogueSeen.length});
 }
 return {...result,changes};
}
