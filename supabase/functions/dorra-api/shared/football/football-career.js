/*
 * Deterministic career and living-world systems for the football manager.
 *
 * This module deliberately has no DOM, clock, storage, or network dependencies.
 * Every public state operation normalizes and copies its input, which keeps the
 * subsystem safe to call from save migrations, the simulation engine, workers,
 * and UI previews.
 */

export const FOOTBALL_CAREER_SCHEMA_VERSION=7;
export const FOOTBALL_CAREER_SEASON_WEEKS=40;
export const FOOTBALL_CAREER_SAVE_BUDGET_BYTES=500_000;
export const FOOTBALL_CAREER_LIMITS=Object.freeze({
 inbox:50,
 players:80,
 playerHistory:6,
 playerForm:8,
 transferOffers:18,
 loans:20,
 scoutingAssignments:12,
 scoutingReports:24,
 opponentReports:10,
 shortlist:32,
 aiClubs:36,
 aiEvents:4,
 matches:100,
 matchReports:7,
 seasons:18,
 trophies:24,
 rivalries:12,
 matchdayReports:12,
 cupMatches:8,
 friendlies:10,
 registrations:32,
 socialGroups:8,
 mentoringGroups:10,
 promises:32,
 reactions:30,
 contractNegotiations:18,
 negotiationHistory:8
});

const MAX_MONEY=9_000_000_000_000_000;
const MIN_SEASON=2020,MAX_SEASON=2200;
const PLAYER_STAT_KEYS=Object.freeze(['appearances','starts','minutes','goals','assists','cleanSheets','yellowCards','redCards','playerOfMatch']);
const COMPETITION_TYPES=Object.freeze(['preseason','league','cup','assessment','playoff','friendly']);
const PHASES=Object.freeze(['preseason','competitive','postseason','offseason']);
const PLAYER_STATUSES=Object.freeze(['active','injured','suspended','loaned','released','transferred','retired']);
const TRANSFER_STATUSES=Object.freeze(['not-listed','transfer-listed','loan-listed','available']);
const OFFER_STATUSES=Object.freeze(['pending','accepted','rejected','withdrawn','expired']);
const LOAN_STATUSES=Object.freeze(['active','completed','recalled','cancelled']);
const SCOUTING_TYPES=Object.freeze(['player','region','opponent']);
const SCOUTING_STATUSES=Object.freeze(['active','completed','cancelled']);
const SCOUTING_FOCUSES=Object.freeze(['all','gk','df','mf','fw','youth']);
const RIVALRY_TYPES=Object.freeze(['rivalry','local-derby','historic','promotion-race']);
const PLAYING_STYLES=Object.freeze(['balanced','possession','high-press','direct','low-block','counterattack']);
const FORMATIONS=Object.freeze(['4-3-3','4-4-2','4-2-3-1','3-5-2','5-3-2']);
const VALID_VALUES=Object.freeze(['community','youth','ambition','entertainment','sustainability']);
const WEATHER_CONDITIONS=Object.freeze(['clear','partly-cloudy','overcast','showers','heavy-rain','hot','windy']);
const CUP_STATUSES=Object.freeze(['not-entered','active','eliminated','won']);
const FRIENDLY_STATUSES=Object.freeze(['scheduled','played','cancelled']);
const TERMINAL_PLAYER_STATUSES=Object.freeze(['released','transferred','retired']);
const SQUAD_ROLES=Object.freeze(['star','important','rotation','prospect','fringe']);
const PROMISE_TYPES=Object.freeze(['playing-time','squad-role','development','new-contract','transfer','captaincy','silverware','other']);
const PROMISE_STATUSES=Object.freeze(['active','fulfilled','broken','cancelled']);
const REACTION_TYPES=Object.freeze(['delighted','positive','neutral','concerned','unhappy','angry']);
const REHAB_PLANS=Object.freeze(['conservative','standard','intensive']);
const REHAB_STATUSES=Object.freeze(['not-required','diagnosis','rehabilitation','return-to-training','complete']);
const INJURY_SEVERITIES=Object.freeze(['minor','moderate','serious','major']);
const NEGOTIATION_STATUSES=Object.freeze(['awaiting-club','countered','agreed','rejected','walked-away','withdrawn','expired']);
const AGENT_STYLES=Object.freeze(['collaborative','pragmatic','hardline','opportunistic']);
export const FOOTBALL_DEVELOPMENT_FOCUSES=Object.freeze(['balanced','technical','physical','tactical','positioning','goalkeeping','finishing','playmaking','defending']);

const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const asObject=value=>isObject(value)?value:{};
const asArray=value=>Array.isArray(value)?value:[];
const hasOwn=(value,key)=>Object.prototype.hasOwnProperty.call(asObject(value),key);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max,fallback=min)=>Math.min(max,Math.max(min,finite(value,fallback)));
const integer=(value,min,max,fallback=min)=>Math.round(clamp(value,min,max,fallback));
const money=(value,fallback=0,min=-1_000_000_000)=>{
 const parsed=Number(value),safeFallback=Number.isFinite(Number(fallback))?Number(fallback):0;
 return Math.round(clamp(Number.isFinite(parsed)?parsed:safeFallback,min,MAX_MONEY,safeFallback));
};
const bool=(value,fallback=false)=>typeof value==='boolean'?value:fallback;
const text=(value,max=100,fallback='')=>{
 const result=String(value??'').replace(/[<>\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
 return result||fallback;
};
const id=(value,max=80,fallback='')=>text(value,max,fallback).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,max)||fallback;
const enumValue=(value,values,fallback)=>values.includes(value)?value:fallback;
const unique=list=>[...new Set(list)];
const last=(list,limit)=>list.length>limit?list.slice(list.length-limit):list;
const round=(value,places=1)=>Number(finite(value).toFixed(places));
const emptyStats=()=>({appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,playerOfMatch:0,averageRating:0});

function hashString(value){
 let hash=2166136261;
 for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
 return hash>>>0;
}

function seededRandom(seed){
 let value=hashString(seed)||0x6d2b79f5;
 return ()=>{
  value+=0x6d2b79f5;
  let result=value;
  result=Math.imul(result^result>>>15,result|1);
  result^=result+Math.imul(result^result>>>7,result|61);
  return ((result^result>>>14)>>>0)/4294967296;
 };
}

function makeId(prefix,state,token=''){
 const root=`${prefix}-${hashString(`${state.seed}|${state.season}|${state.week}|${token}`).toString(36)}`;
 const used=new Set([
  ...state.inbox.map(item=>item.id),...state.transferOffers.map(item=>item.id),...state.loans.map(item=>item.id),
  ...state.scouting.assignments.map(item=>item.id),...state.scouting.reports.map(item=>item.id),...state.scouting.opponentReports.map(item=>item.id)
 ]);
 if(!used.has(root))return root;
 let suffix=2;
 while(used.has(`${root}-${suffix}`))suffix+=1;
 return `${root}-${suffix}`;
}

const absoluteWeek=(season,week)=>(integer(season,MIN_SEASON,MAX_SEASON,2026)-MIN_SEASON)*FOOTBALL_CAREER_SEASON_WEEKS+integer(week,1,FOOTBALL_CAREER_SEASON_WEEKS,1);
const weekFromAbsolute=value=>({season:MIN_SEASON+Math.floor((Math.max(1,value)-1)/FOOTBALL_CAREER_SEASON_WEEKS),week:(Math.max(1,value)-1)%FOOTBALL_CAREER_SEASON_WEEKS+1});
const addWeeks=(season,week,amount)=>weekFromAbsolute(absoluteWeek(season,week)+integer(amount,0,400,0));

function phaseForWeek(week){
 if(week<=4)return 'preseason';
 if(week<=30)return 'competitive';
 if(week===31)return 'postseason';
 return 'offseason';
}

function calendarEventsForWeek(week){
 const events=[];
 if(week===1)events.push({id:'players-return',type:'preseason',label:'Players return'});
 if(week===2)events.push({id:'friendly-window',type:'friendly',label:'Pre-season friendlies'});
 if([7,12,18,25,29].includes(week))events.push({id:`cup-round-${week}`,type:'cup',label:week===29?'Cup final':'Cup round'});
 if(week===5)events.push({id:'league-opener',type:'league',label:'League season begins'});
 if([9,21,33].includes(week))events.push({id:`academy-break-${week}`,type:'academy',label:'Academy school-break training / optional tournament window'});
 if([12,24,36].includes(week))events.push({id:`academy-return-${week}`,type:'academy',label:'Academy weekend league resumes'});
 if(week===30)events.push({id:'league-finale',type:'league',label:'League season concludes'});
 if(week===31)events.push({id:'season-review',type:'assessment',label:'Board and competition review'});
 if(week===32)events.push({id:'offseason-opens',type:'assessment',label:'Off-season begins'});
 if(week===40)events.push({id:'season-rollover',type:'assessment',label:'Season rollover'});
 return events;
}

export function buildSeasonCalendar(season=2026,options={}){
 const safeSeason=integer(season,MIN_SEASON,MAX_SEASON,2026),source=asObject(options);
 const cupName=text(source.cupName,60,'Queensland Cup');
 const weeks=Array.from({length:FOOTBALL_CAREER_SEASON_WEEKS},(_,index)=>{
  const week=index+1,phase=phaseForWeek(week),registrationOpen=week<=8||(week>=23&&week<=26);
  const events=calendarEventsForWeek(week).map(event=>event.type==='cup'?{...event,label:event.label.replace('Cup',cupName)}:event);
  return {week,phase,registrationOpen,events};
 });
 return {season:safeSeason,totalWeeks:FOOTBALL_CAREER_SEASON_WEEKS,cupName,weeks};
}

export function getCalendarWeek(seasonOrState=2026,week=1,options={}){
 const source=isObject(seasonOrState)?seasonOrState:null;
 const safeSeason=source?integer(source.season,MIN_SEASON,MAX_SEASON,2026):integer(seasonOrState,MIN_SEASON,MAX_SEASON,2026);
 const safeWeek=source?integer(source.week,1,FOOTBALL_CAREER_SEASON_WEEKS,1):integer(week,1,FOOTBALL_CAREER_SEASON_WEEKS,1);
 return buildSeasonCalendar(safeSeason,source?.calendar||options).weeks[safeWeek-1];
}

export function isRegistrationOpen(seasonOrState=2026,week=1){return getCalendarWeek(seasonOrState,week).registrationOpen}

function normalizeAction(raw,index=0){
 const source=asObject(raw),actionId=id(source.id,40,`action-${index+1}`);
 return {
  id:actionId,
  label:text(source.label,50,`Option ${index+1}`),
  tone:enumValue(source.tone,['positive','neutral','cautious','negative'],'neutral'),
  effects:{confidence:round(clamp(asObject(source.effects).confidence,-20,20,0)),supporterTrust:round(clamp(asObject(source.effects).supporterTrust,-20,20,0))}
 };
}

function normalizeInboxItem(raw,index=0,season=2026,week=1){
 const source=asObject(raw),actions=asArray(source.actions).slice(0,4).map(normalizeAction);
 return {
  id:id(source.id,80,`message-${season}-${week}-${index+1}`),
  relatedId:id(source.relatedId||source.entityId,80,''),
  kind:enumValue(source.kind,['welcome','board','supporters','contract','transfer','loan','scouting','calendar','matchday','player','competition','system'],'system'),
  title:text(source.title,90,'Club update'),
  body:text(source.body,360,'No additional details.'),
  priority:enumValue(source.priority,['low','normal','high','urgent'],'normal'),
  createdSeason:integer(source.createdSeason,MIN_SEASON,MAX_SEASON,season),
  createdWeek:integer(source.createdWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),
  expiresSeason:source.expiresSeason==null?null:integer(source.expiresSeason,MIN_SEASON,MAX_SEASON,season),
  expiresWeek:source.expiresWeek==null?null:integer(source.expiresWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),
  read:bool(source.read),resolved:bool(source.resolved),resolution:id(source.resolution,40,''),
  actions
 };
}

function defaultExpectations(){
 return [
  {id:'league-progress',label:'Meet the league target',metric:'leaguePosition',target:8,direction:'max',weight:45},
  {id:'financial-control',label:'Keep the club solvent',metric:'cashBalance',target:0,direction:'min',weight:35},
  {id:'youth-pathway',label:'Give academy players a pathway',metric:'youthMinutes',target:900,direction:'min',weight:20}
 ];
}

function normalizeExpectation(raw,index=0){
 const source=asObject(raw),fallback=defaultExpectations()[index]||defaultExpectations()[0];
 return {
  id:id(source.id,60,fallback.id),label:text(source.label,100,fallback.label),metric:id(source.metric,60,fallback.metric),
  target:round(clamp(source.target,-1_000_000_000,1_000_000_000,fallback.target),2),
  direction:enumValue(source.direction,['min','max'],fallback.direction),weight:integer(source.weight,1,100,fallback.weight),
  progress:round(clamp(source.progress,0,100,50)),status:enumValue(source.status,['achieved','on-track','at-risk','failed'],'on-track')
 };
}

function normalizeStats(raw){
 const source=asObject(raw),result=emptyStats();
 for(const key of PLAYER_STAT_KEYS)result[key]=integer(source[key],0,1_000_000,0);
 result.averageRating=round(clamp(source.averageRating,0,10,0),2);
 return result;
}

function inferredValue(player,season){
 const rating=clamp(player.rating,1,100,50),potential=clamp(player.potential,rating,100,rating),age=integer(player.age,15,50,24);
 const ageFactor=age<=20?1.15:age<=24?1.08:age<=29?1:Math.max(.22,1-(age-29)*.085),potentialFactor=1+(potential-rating)/70;
 const raw=20_000*Math.exp((rating-50)*.11+Math.max(0,rating-60)**2*.002)*potentialFactor*ageFactor,step=raw<100_000?1_000:raw<1_000_000?5_000:25_000;
 return Math.max(1_000,Math.round(raw/step)*step);
}

function personalityLabel(profile){
 if(profile.leadership>=78&&profile.professionalism>=68)return 'Model leader';
 if(profile.professionalism>=82&&profile.consistency>=68)return 'Model professional';
 if(profile.ambition>=80&&profile.loyalty<48)return 'Driven';
 if(profile.loyalty>=80&&profile.temperament>=55)return 'Loyal';
 if(profile.temperament<32)return 'Volatile';
 if(profile.consistency>=80)return 'Reliable';
 if(profile.ambition<38&&profile.professionalism<48)return 'Laid-back';
 return 'Balanced';
}

function normalizePersonality(raw,playerId='',playerName=''){
 const source=asObject(raw),random=seededRandom(`personality|${playerId}|${playerName}`),generated=()=>integer(28+random()*58,1,100,55);
 const profile={ambition:integer(source.ambition,1,100,generated()),professionalism:integer(source.professionalism,1,100,generated()),loyalty:integer(source.loyalty,1,100,generated()),consistency:integer(source.consistency,1,100,generated()),temperament:integer(source.temperament,1,100,generated()),leadership:integer(source.leadership,1,100,generated())};
 return {...profile,label:personalityLabel(profile)};
}

function normalizeInjury(raw,playerId='',season=2026,week=1){
 if(!isObject(raw))return null;
 const source=asObject(raw),weeksTotal=integer(source.weeksTotal??source.durationWeeks,1,80,1),weeksRemaining=integer(source.weeksRemaining,0,weeksTotal,weeksTotal),returnAt=addWeeks(season,week,weeksRemaining);
 return {
  id:id(source.id,80,`injury-${hashString(`${playerId}|${source.type}|${source.bodyArea}|${source.occurredSeason||season}|${source.occurredWeek||week}`).toString(36)}`),
  type:text(source.type,60,'Knock'),bodyArea:text(source.bodyArea,40,'General'),severity:enumValue(source.severity,INJURY_SEVERITIES,weeksTotal<=2?'minor':weeksTotal<=5?'moderate':weeksTotal<=10?'serious':'major'),
  occurredSeason:integer(source.occurredSeason,MIN_SEASON,MAX_SEASON,season),occurredWeek:integer(source.occurredWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),weeksTotal,weeksRemaining,
  returnSeason:integer(source.returnSeason,MIN_SEASON,MAX_SEASON,returnAt.season),returnWeek:integer(source.returnWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,returnAt.week),recurrenceRisk:integer(source.recurrenceRisk,0,100,10),rehabPlan:enumValue(source.rehabPlan,REHAB_PLANS,'standard'),rehabStatus:enumValue(source.rehabStatus,REHAB_STATUSES,weeksRemaining?'rehabilitation':'complete'),notes:text(source.notes,180,'')
 };
}

function normalizeMedical(raw,playerId='',season=2026,week=1,legacyStatus='active'){
 const source=asObject(raw),legacyInjury=legacyStatus==='injured'&&!isObject(source.injury)?{type:'Undisclosed injury',bodyArea:'General',weeksTotal:1,weeksRemaining:1,occurredSeason:season,occurredWeek:week}:null;
 const injury=normalizeInjury(source.injury||legacyInjury,playerId,season,week),lastSource=asObject(source.lastInjury);
 return {
  fitness:integer(source.fitness,0,100,injury?Math.max(20,100-injury.weeksRemaining*8):100),matchSharpness:integer(source.matchSharpness,0,100,70),injury,
  lastInjury:isObject(source.lastInjury)?{type:text(lastSource.type,60,'Injury'),bodyArea:text(lastSource.bodyArea,40,'General'),resolvedSeason:integer(lastSource.resolvedSeason,MIN_SEASON,MAX_SEASON,season),resolvedWeek:integer(lastSource.resolvedWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),recurrenceRisk:integer(lastSource.recurrenceRisk,0,100,10)}:null
 };
}

function normalizeDiscipline(raw,season=2026,week=1,legacyStatus='active'){
 const source=asObject(raw),yellowCards=integer(source.yellowCards,0,99,0),nextThreshold=integer(source.nextThreshold,1,30,yellowCards<5?5:yellowCards<10?10:15),legacySuspension=legacyStatus==='suspended'?1:0;
 return {season:integer(source.season,MIN_SEASON,MAX_SEASON,season),yellowCards,nextThreshold,suspensionMatchesRemaining:integer(source.suspensionMatchesRemaining??source.matchesRemaining,0,12,legacySuspension),reason:text(source.reason,100,''),lastCardSeason:source.lastCardSeason==null?null:integer(source.lastCardSeason,MIN_SEASON,MAX_SEASON,season),lastCardWeek:source.lastCardWeek==null?null:integer(source.lastCardWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week)};
}

function availabilityFor(player){
 const terminal=TERMINAL_PLAYER_STATUSES.includes(player.status)||player.ownership==='former',injury=player.medical?.injury,suspension=player.discipline?.suspensionMatchesRemaining||0,loaned=player.status==='loaned';
 const status=terminal?player.status:loaned?'loaned':injury?'injured':suspension?'suspended':'available';
 return {available:status==='available',status,reason:injury?`${injury.type} (${injury.weeksRemaining} week${injury.weeksRemaining===1?'':'s'})`:suspension?`${player.discipline.reason||'Suspension'} (${suspension} match${suspension===1?'':'es'})`:status==='available'?'Available':status,estimatedReturnSeason:injury?injury.returnSeason:null,estimatedReturnWeek:injury?injury.returnWeek:null};
}

function normalizePlayer(raw,index=0,season=2026,week=1){
 const source=asObject(raw),playerId=id(source.id||source.playerId,80,`player-${index+1}`);
 const playerName=text(source.name||source.playerName,80,`Player ${index+1}`);
 const age=integer(source.age,15,50,integer(season-finite(source.birthYear,season-24),15,50,24));
 const rating=integer(source.rating??source.overall,1,100,50),potential=integer(source.potential,rating,100,Math.min(100,rating+8));
 const positions=unique((asArray(source.positions).length?source.positions:[source.position||source.primaryPosition||'MF']).map(value=>text(value,12,'MF').toUpperCase()).filter(Boolean)).slice(0,4);
 const contractSource=asObject(source.contract),careerStats=normalizeStats(source.careerStats),seasonStats=normalizeStats(source.seasonStats);
 const contractWeeks=integer(source.contractWeeks,0,400,40);
 const expires=addWeeks(season,1,contractWeeks);
 const rawStatus=enumValue(source.status,PLAYER_STATUSES,'active'),medicalInput=isObject(source.medical)?source.medical:(finite(source.injuryWeeks)>0?{injury:{type:'Injury',bodyArea:'General',weeksTotal:source.injuryWeeks,weeksRemaining:source.injuryWeeks}}:{}),shell={rating,potential,age},personalityProfile=normalizePersonality(source.personalityProfile||source.personalityAttributes||(isObject(source.personality)?source.personality:{}),playerId,playerName),medical=normalizeMedical(medicalInput,playerId,season,week,rawStatus),discipline=normalizeDiscipline(isObject(source.discipline)?source.discipline:{yellowCards:seasonStats.yellowCards},season,week,rawStatus);
 const status=TERMINAL_PLAYER_STATUSES.includes(rawStatus)||rawStatus==='loaned'?rawStatus:medical.injury?'injured':discipline.suspensionMatchesRemaining?'suspended':'active';
 const availabilityStatus=status==='active'?'available':status;
 const availabilityReason=medical.injury?medical.injury.type:(discipline.suspensionMatchesRemaining?discipline.reason:availabilityStatus);
 const history=last(asArray(source.history).map((entry,entryIndex)=>{
  const item=asObject(entry);return {season:integer(item.season,MIN_SEASON,MAX_SEASON,season-entryIndex-1),club:text(item.club,80,''),competition:text(item.competition,70,'League'),stats:normalizeStats(item.stats)};
 }),FOOTBALL_CAREER_LIMITS.playerHistory),hasSeasonActivity=PLAYER_STAT_KEYS.some(key=>seasonStats[key]>0),legacyDepartureFallback=hasSeasonActivity?season:(history.at(-1)?.season??season);
 return {
  id:playerId,name:playerName,birthYear:integer(source.birthYear,1970,season-15,season-age),age,
  nationality:text(source.nationality,40,'Australia'),homegrown:bool(source.homegrown,true),positions,primaryPosition:positions[0]||'MF',
  preferredFoot:enumValue(String(source.preferredFoot||'right').toLowerCase(),['left','right','both'],'right'),
  traits:unique(asArray(source.traits).map(value=>text(value,40,'')).filter(Boolean)).slice(0,5),personality:text(isObject(source.personality)?source.personality.label:source.personality,40,personalityProfile.label),personalityProfile,
  rating,potential,status,medical,discipline,
  availability:{available:status==='active',status:availabilityStatus,reason:text(availabilityReason,100,availabilityStatus),estimatedReturnSeason:medical.injury?medical.injury.returnSeason:null,estimatedReturnWeek:medical.injury?medical.injury.returnWeek:null},transferStatus:enumValue(source.transferStatus,TRANSFER_STATUSES,'not-listed'),
  morale:integer(source.morale,0,100,65),development:round(clamp(source.development,-10,10,0),2),developmentFocus:enumValue(source.developmentFocus,FOOTBALL_DEVELOPMENT_FOCUSES,'balanced'),
  contract:{
   weeklyWage:money(contractSource.weeklyWage??source.weeklyWage??source.wage,0,0),
   expiresSeason:integer(contractSource.expiresSeason,MIN_SEASON,MAX_SEASON,expires.season),
   expiresWeek:integer(contractSource.expiresWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,expires.week),
   squadRole:enumValue(contractSource.squadRole,SQUAD_ROLES,'rotation'),
   signedSeason:integer(contractSource.signedSeason,MIN_SEASON,season,season),clauses:unique(asArray(contractSource.clauses).map(value=>text(value,60,'')).filter(Boolean)).slice(0,5),
   signingBonus:money(contractSource.signingBonus,0,0),releaseClause:money(contractSource.releaseClause,0,0),promotionBonus:money(contractSource.promotionBonus,0,0),appearanceBonus:money(contractSource.appearanceBonus,0,0),agentName:text(contractSource.agentName,60,''),promiseIds:last(unique(asArray(contractSource.promiseIds).map(value=>id(value,80,'')).filter(Boolean)),8)
  },
  ownership:enumValue(source.ownership,['owned','on-loan','former'],TERMINAL_PLAYER_STATUSES.includes(status)?'former':'owned'),departureSeason:TERMINAL_PLAYER_STATUSES.includes(status)||source.ownership==='former'?integer(source.departureSeason,MIN_SEASON,MAX_SEASON,legacyDepartureFallback):null,
  marketValue:money(source.marketValue,inferredValue(shell,season),0),seasonStats,careerStats,
  form:last(asArray(source.form).map(value=>round(clamp(value,0,10,0),2)),FOOTBALL_CAREER_LIMITS.playerForm),
  history
 };
}

function normalizePromise(raw,index=0,season=2026,week=1){
 const source=asObject(raw),dueDefault=addWeeks(season,week,integer(source.targetWeeks,1,80,12));
 return {id:id(source.id,80,`promise-${season}-${week}-${index+1}`),playerId:id(source.playerId,80,''),type:enumValue(source.type,PROMISE_TYPES,'other'),detail:text(source.detail||source.description,180,'Commitment made to the player'),target:round(clamp(source.target,0,1_000_000,1),2),targetRole:enumValue(source.targetRole,SQUAD_ROLES,''),progress:round(clamp(source.progress,0,1_000_000,0),2),status:enumValue(source.status,PROMISE_STATUSES,'active'),source:enumValue(source.source,['manager','contract','negotiation','system'],'manager'),createdSeason:integer(source.createdSeason,MIN_SEASON,MAX_SEASON,season),createdWeek:integer(source.createdWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),dueSeason:integer(source.dueSeason,MIN_SEASON,MAX_SEASON,dueDefault.season),dueWeek:integer(source.dueWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,dueDefault.week),resolvedSeason:source.resolvedSeason==null?null:integer(source.resolvedSeason,MIN_SEASON,MAX_SEASON,season),resolvedWeek:source.resolvedWeek==null?null:integer(source.resolvedWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),moraleImpact:integer(source.moraleImpact,1,20,6),resolutionNote:text(source.resolutionNote,160,'')};
}

function normalizeReaction(raw,index=0,season=2026,week=1){
 const source=asObject(raw);
 return {id:id(source.id,80,`reaction-${season}-${week}-${index+1}`),playerId:id(source.playerId,80,''),type:enumValue(source.type,REACTION_TYPES,'neutral'),intensity:integer(source.intensity,1,10,4),reason:text(source.reason,180,'Squad update'),season:integer(source.season,MIN_SEASON,MAX_SEASON,season),week:integer(source.week,1,FOOTBALL_CAREER_SEASON_WEEKS,week),read:bool(source.read)};
}

function hierarchyForPlayers(players){
 const roleWeight={star:12,important:8,rotation:4,prospect:0,fringe:-3},eligible=players.filter(player=>!TERMINAL_PLAYER_STATUSES.includes(player.status)&&player.ownership!=='former');
 return eligible.map(player=>({playerId:player.id,score:round(player.rating*.45+player.personalityProfile.leadership*.3+player.personalityProfile.professionalism*.12+player.age*.35+(roleWeight[player.contract.squadRole]||0),2)})).sort((a,b)=>b.score-a.score||a.playerId.localeCompare(b.playerId)).map((entry,index)=>({...entry,tier:index<2?'leader':index<Math.max(5,Math.ceil(eligible.length*.25))?'core':index<Math.max(12,Math.ceil(eligible.length*.75))?'team':'fringe',influence:integer(92-index*(70/Math.max(1,eligible.length-1)),15,100,50)}));
}

function defaultSocialGroups(players,hierarchy){
 const tierById=new Map(hierarchy.map(item=>[item.playerId,item.tier])),groups=[{id:'senior-core',name:'Senior core',playerIds:[]},{id:'emerging-group',name:'Emerging players',playerIds:[]},{id:'first-team-group',name:'First-team group',playerIds:[]}];
 for(const player of players.filter(item=>!TERMINAL_PLAYER_STATUSES.includes(item.status)&&item.ownership!=='former')){
  const target=player.age<=22?groups[1]:tierById.get(player.id)==='leader'||player.age>=29?groups[0]:groups[2];target.playerIds.push(player.id);
 }
 return groups.filter(group=>group.playerIds.length).map(group=>({...group,cohesion:68}));
}

function normalizeSquadDynamics(raw,players=[],seed='football-career',season=2026,week=1){
 const source=asObject(raw),eligible=players.filter(player=>!TERMINAL_PLAYER_STATUSES.includes(player.status)&&player.ownership!=='former'),validIds=new Set(eligible.map(player=>player.id)),hierarchy=hierarchyForPlayers(players),providedGroups=asArray(source.socialGroups).slice(0,FOOTBALL_CAREER_LIMITS.socialGroups).map((rawGroup,index)=>{const group=asObject(rawGroup);return {id:id(group.id,60,`social-${index+1}`),name:text(group.name,70,`Squad group ${index+1}`),playerIds:last(unique(asArray(group.playerIds).map(value=>id(value,80,'')).filter(value=>validIds.has(value))),20),cohesion:integer(group.cohesion,0,100,65)}}).filter(group=>group.playerIds.length),socialGroups=providedGroups.length?providedGroups:defaultSocialGroups(players,hierarchy);
 const mentoringGroups=asArray(source.mentoringGroups).slice(0,FOOTBALL_CAREER_LIMITS.mentoringGroups).map((rawGroup,index)=>{const group=asObject(rawGroup),mentorId=id(group.mentorId,80,'');return {id:id(group.id,60,`mentoring-${index+1}`),name:text(group.name,70,`Mentoring group ${index+1}`),mentorId,menteeIds:last(unique(asArray(group.menteeIds||group.memberIds).map(value=>id(value,80,'')).filter(value=>validIds.has(value)&&value!==mentorId)),6),focus:enumValue(group.focus,['professionalism','leadership','consistency','development'],'professionalism'),cohesion:integer(group.cohesion,0,100,60),startedSeason:integer(group.startedSeason,MIN_SEASON,MAX_SEASON,season),startedWeek:integer(group.startedWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week)}}).filter(group=>validIds.has(group.mentorId)&&group.menteeIds.length);
 const promises=last(asArray(source.promises).map((item,index)=>normalizePromise(item,index,season,week)).filter(item=>validIds.has(item.playerId)),FOOTBALL_CAREER_LIMITS.promises),reactions=last(asArray(source.reactions).map((item,index)=>normalizeReaction(item,index,season,week)).filter(item=>validIds.has(item.playerId)),FOOTBALL_CAREER_LIMITS.reactions);
 const leaderIds=hierarchy.map(item=>item.playerId),captainId=validIds.has(id(source.captainId,80,''))?id(source.captainId,80,''):(leaderIds[0]||''),viceCaptainId=validIds.has(id(source.viceCaptainId,80,''))&&id(source.viceCaptainId,80,'')!==captainId?id(source.viceCaptainId,80,''):(leaderIds.find(playerId=>playerId!==captainId)||'');
 return {captainId,viceCaptainId,hierarchy,socialGroups,mentoringGroups,promises,reactions,cohesion:integer(source.cohesion,0,100,68),atmosphere:integer(source.atmosphere,0,100,68),lastRefreshKey:text(source.lastRefreshKey,30,''),seed:text(source.seed,100,`${seed}|squad`)};
}

function normalizeNegotiationPromise(raw,index=0){
 const source=asObject(raw);
 return {type:enumValue(source.type,PROMISE_TYPES,'other'),detail:text(source.detail||source.description,160,'Contract commitment'),target:round(clamp(source.target,0,1_000_000,1),2),targetRole:enumValue(source.targetRole,SQUAD_ROLES,''),targetWeeks:integer(source.targetWeeks,1,80,16),moraleImpact:integer(source.moraleImpact,1,20,6)};
}

function normalizeContractTerms(raw={},fallback={}){
 const source=asObject(raw),base=asObject(fallback);
 return {weeklyWage:money(source.weeklyWage,base.weeklyWage||0,0),seasons:integer(source.seasons,1,5,base.seasons||2),squadRole:enumValue(source.squadRole,SQUAD_ROLES,enumValue(base.squadRole,SQUAD_ROLES,'rotation')),signingBonus:money(source.signingBonus,base.signingBonus||0,0),releaseClause:money(source.releaseClause,base.releaseClause||0,0),promotionBonus:money(source.promotionBonus,base.promotionBonus||0,0),appearanceBonus:money(source.appearanceBonus,base.appearanceBonus||0,0),promises:asArray(source.promises).slice(0,4).map(normalizeNegotiationPromise)};
}

function agentForPlayer(player,seed='football-career'){
 const random=seededRandom(`${seed}|agent|${player.id}`),first=['Alex','Jordan','Morgan','Taylor','Sam','Casey'],lastNames=['Bennett','Clarke','Hayes','Morgan','Patel','Reid'],style=AGENT_STYLES[Math.floor(random()*AGENT_STYLES.length)];
 return {name:`${first[Math.floor(random()*first.length)]} ${lastNames[Math.floor(random()*lastNames.length)]}`,style,patience:integer(2+random()*3,2,5,3),relationship:integer(42+random()*25,0,100,55),aggression:integer(style==='hardline'?75+random()*20:style==='opportunistic'?62+random()*25:35+random()*30,0,100,55)};
}

function normalizeNegotiationHistory(raw,index=0,season=2026,week=1){
 const source=asObject(raw);
 return {round:integer(source.round,0,8,index),by:enumValue(source.by,['club','player','agent','system'],'system'),outcome:enumValue(source.outcome,['opened','offered','countered','accepted','rejected','withdrawn','expired'],'opened'),season:integer(source.season,MIN_SEASON,MAX_SEASON,season),week:integer(source.week,1,FOOTBALL_CAREER_SEASON_WEEKS,week),terms:source.terms?normalizeContractTerms(source.terms):null,note:text(source.note,160,'')};
}

function normalizeContractNegotiation(raw,index=0,players=[],seed='football-career',season=2026,week=1){
 const source=asObject(raw),playerId=id(source.playerId,80,''),player=players.find(item=>item.id===playerId),agent=asObject(source.agent),fallbackAgent=player?agentForPlayer(player,seed):{name:'Player representative',style:'pragmatic',patience:3,relationship:50,aggression:50},expiry=addWeeks(season,week,3);
 return {id:id(source.id,80,`contract-talk-${season}-${week}-${index+1}`),playerId,status:enumValue(source.status,NEGOTIATION_STATUSES,'awaiting-club'),round:integer(source.round,0,8,0),agent:{name:text(agent.name,60,fallbackAgent.name),style:enumValue(agent.style,AGENT_STYLES,fallbackAgent.style),patience:integer(agent.patience,1,6,fallbackAgent.patience),relationship:integer(agent.relationship,0,100,fallbackAgent.relationship),aggression:integer(agent.aggression,0,100,fallbackAgent.aggression)},demand:normalizeContractTerms(source.demand,{weeklyWage:player?.contract.weeklyWage||0,squadRole:player?.contract.squadRole||'rotation'}),offer:source.offer?normalizeContractTerms(source.offer):null,history:last(asArray(source.history).map((item,historyIndex)=>normalizeNegotiationHistory(item,historyIndex,season,week)),FOOTBALL_CAREER_LIMITS.negotiationHistory),createdSeason:integer(source.createdSeason,MIN_SEASON,MAX_SEASON,season),createdWeek:integer(source.createdWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),expiresSeason:integer(source.expiresSeason,MIN_SEASON,MAX_SEASON,expiry.season),expiresWeek:integer(source.expiresWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,expiry.week),resolution:text(source.resolution,180,'')};
}

function normalizeOffer(raw,index=0,season=2026,week=1){
 const source=asObject(raw),expires=addWeeks(season,week,2);
 return {
  id:id(source.id,80,`offer-${season}-${week}-${index+1}`),playerId:id(source.playerId,80,''),clubId:id(source.clubId,80,'unknown-club'),clubName:text(source.clubName,80,'Interested club'),
  type:enumValue(source.type,['permanent','loan'],'permanent'),amount:money(source.amount,0,0),loanFee:money(source.loanFee,0,0),wageContribution:integer(source.wageContribution,0,100,0),
  optionalFee:money(source.optionalFee,0,0),status:enumValue(source.status,OFFER_STATUSES,'pending'),createdSeason:integer(source.createdSeason,MIN_SEASON,MAX_SEASON,season),
  createdWeek:integer(source.createdWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),expiresSeason:integer(source.expiresSeason,MIN_SEASON,MAX_SEASON,expires.season),expiresWeek:integer(source.expiresWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,expires.week),
  negotiationRound:integer(source.negotiationRound,0,3,0)
 };
}

function normalizeLoan(raw,index=0,season=2026,week=1){
 const source=asObject(raw),end=addWeeks(season,week,20);
 return {
  id:id(source.id,80,`loan-${season}-${week}-${index+1}`),playerId:id(source.playerId,80,''),clubId:id(source.clubId,80,'unknown-club'),clubName:text(source.clubName,80,'Loan club'),
  direction:enumValue(source.direction,['in','out'],'out'),startSeason:integer(source.startSeason,MIN_SEASON,MAX_SEASON,season),startWeek:integer(source.startWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),
  endSeason:integer(source.endSeason,MIN_SEASON,MAX_SEASON,end.season),endWeek:integer(source.endWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,end.week),wageContribution:integer(source.wageContribution,0,100,50),
  fee:money(source.fee,0,0),appearances:integer(source.appearances,0,500,0),development:round(clamp(source.development,-10,15,0),2),status:enumValue(source.status,LOAN_STATUSES,'active')
 };
}

function normalizeScoutingAssignment(raw,index=0,season=2026,week=1){
 const source=asObject(raw),due=addWeeks(season,week,2),candidate=asObject(source.candidate);
 return {
  id:id(source.id,80,`assignment-${season}-${week}-${index+1}`),type:enumValue(source.type,SCOUTING_TYPES,'player'),focus:enumValue(String(source.focus||'all').toLowerCase(),SCOUTING_FOCUSES,'all'),targetId:id(source.targetId||candidate.id,80,''),targetName:text(source.targetName||candidate.name,80,'Scouting target'),
  region:text(source.region,60,'Queensland'),startedSeason:integer(source.startedSeason,MIN_SEASON,MAX_SEASON,season),startedWeek:integer(source.startedWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),
  dueSeason:integer(source.dueSeason,MIN_SEASON,MAX_SEASON,due.season),dueWeek:integer(source.dueWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,due.week),scoutQuality:integer(source.scoutQuality,1,100,50),
  budget:money(source.budget,0,0),status:enumValue(source.status,SCOUTING_STATUSES,'active'),
  candidate:{id:id(candidate.id||source.targetId,80,''),name:text(candidate.name||source.targetName,80,'Scouting target'),position:text(candidate.position,12,'MF').toUpperCase(),age:integer(candidate.age,15,45,24),rating:integer(candidate.rating,1,100,50),potential:integer(candidate.potential,1,100,60),marketValue:money(candidate.marketValue,0,0),traits:unique(asArray(candidate.traits).map(value=>text(value,40,'')).filter(Boolean)).slice(0,5)}
 };
}

function normalizeScoutingReport(raw,index=0,season=2026,week=1){
 const source=asObject(raw),rating=asArray(source.ratingRange),potential=asArray(source.potentialRange);
 return {
  id:id(source.id,80,`report-${season}-${week}-${index+1}`),assignmentId:id(source.assignmentId,80,''),targetId:id(source.targetId,80,''),targetName:text(source.targetName,80,'Scouting target'),position:text(source.position,12,'MF').toUpperCase(),age:integer(source.age,15,45,24),
  completedSeason:integer(source.completedSeason,MIN_SEASON,MAX_SEASON,season),completedWeek:integer(source.completedWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),confidence:integer(source.confidence,1,100,50),
  ratingRange:[integer(rating[0],1,100,40),integer(rating[1],1,100,60)].sort((a,b)=>a-b),potentialRange:[integer(potential[0],1,100,50),integer(potential[1],1,100,70)].sort((a,b)=>a-b),
  valueRange:asArray(source.valueRange).slice(0,2).map(value=>money(value,0,0)).sort((a,b)=>a-b),
  strengths:unique(asArray(source.strengths).map(value=>text(value,60,'')).filter(Boolean)).slice(0,4),weaknesses:unique(asArray(source.weaknesses).map(value=>text(value,60,'')).filter(Boolean)).slice(0,4),
  recommendation:enumValue(source.recommendation,['avoid','monitor','shortlist','priority'],'monitor'),summary:text(source.summary,300,'Further observation recommended.')
 };
}

function normalizeOpponentReport(raw,index=0,season=2026,week=1){
 const source=asObject(raw),strength=asArray(source.strengthRange);
 return {
  id:id(source.id,80,`opponent-report-${season}-${week}-${index+1}`),clubId:id(source.clubId,80,''),clubName:text(source.clubName,80,'Opponent'),season:integer(source.season,MIN_SEASON,MAX_SEASON,season),week:integer(source.week,1,FOOTBALL_CAREER_SEASON_WEEKS,week),
  confidence:integer(source.confidence,1,100,60),formation:enumValue(source.formation,FORMATIONS,'4-3-3'),style:enumValue(source.style,PLAYING_STYLES,'balanced'),strengthRange:[integer(strength[0],1,100,45),integer(strength[1],1,100,65)].sort((a,b)=>a-b),
  threats:unique(asArray(source.threats).map(value=>text(value,70,'')).filter(Boolean)).slice(0,4),weaknesses:unique(asArray(source.weaknesses).map(value=>text(value,70,'')).filter(Boolean)).slice(0,4),summary:text(source.summary,300,'Expect a balanced contest.')
 };
}

function normalizeShortlistItem(raw,index=0,season=2026,week=1){
 const source=asObject(raw),playerId=id(source.playerId||source.targetId||source.id,80,`shortlist-${index+1}`);
 return {playerId,name:text(source.name||source.targetName,80,`Scouting target ${index+1}`),position:text(source.position,12,'MF').toUpperCase(),priority:enumValue(source.priority,['low','normal','high'],'normal'),addedSeason:integer(source.addedSeason,MIN_SEASON,MAX_SEASON,season),addedWeek:integer(source.addedWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week),reportId:id(source.reportId,80,''),notes:text(source.notes,160,'')};
}

function normalizeRivalry(raw,index=0){
 const source=asObject(raw);
 return {
  clubId:id(source.clubId,80,`rival-${index+1}`),clubName:text(source.clubName,80,`Rival ${index+1}`),type:enumValue(source.type,RIVALRY_TYPES,'rivalry'),intensity:integer(source.intensity,1,100,50),distanceKm:round(clamp(source.distanceKm,0,5000,0)),
  played:integer(source.played,0,10_000,0),wins:integer(source.wins,0,10_000,0),draws:integer(source.draws,0,10_000,0),losses:integer(source.losses,0,10_000,0),goalsFor:integer(source.goalsFor,0,100_000,0),goalsAgainst:integer(source.goalsAgainst,0,100_000,0),
  lastResult:text(source.lastResult,40,''),story:text(source.story,180,'A rivalry waiting for its next chapter.')
 };
}

function normalizeAIClub(raw,index=0,seed='football-career',season=2026){
 const source=asObject(raw),clubId=id(source.id||source.clubId,80,`ai-club-${index+1}`),random=seededRandom(`${seed}|ai|${clubId}`);
 const strength=integer(source.strength,20,95,45+random()*25),reputation=integer(source.reputation,1,100,Math.max(20,strength-5+random()*10));
 const stats=asObject(source.seasonStats);
 return {
  id:clubId,name:text(source.name||source.clubName,80,`Club ${index+1}`),divisionId:id(source.divisionId,60,'fqpl-6'),reputation,strength,
  finances:money(source.finances,Math.round(80_000+random()*420_000)),facilities:integer(source.facilities,1,100,30+random()*35),youth:integer(source.youth,1,100,25+random()*40),scouting:integer(source.scouting,1,100,25+random()*45),
  supporterTrust:integer(source.supporterTrust,0,100,50+random()*25),style:enumValue(source.style,PLAYING_STYLES,PLAYING_STYLES[Math.floor(random()*PLAYING_STYLES.length)]),formation:enumValue(source.formation,FORMATIONS,FORMATIONS[Math.floor(random()*FORMATIONS.length)]),
  manager:{name:text(asObject(source.manager).name,80,`Manager ${index+1}`),ability:integer(asObject(source.manager).ability,1,100,35+random()*45),security:integer(asObject(source.manager).security,0,100,55+random()*35)},
  ambition:integer(source.ambition,1,100,35+random()*50),risk:integer(source.risk,1,100,25+random()*55),trajectory:round(clamp(source.trajectory,-10,10,0),2),
  seasonStats:{played:integer(stats.played,0,100,0),wins:integer(stats.wins,0,100,0),draws:integer(stats.draws,0,100,0),losses:integer(stats.losses,0,100,0),goalsFor:integer(stats.goalsFor,0,500,0),goalsAgainst:integer(stats.goalsAgainst,0,500,0),points:integer(stats.points,0,300,0)},
  form:last(asArray(source.form).map(value=>enumValue(value,['W','D','L'],'D')),6),lastSeasonRank:integer(source.lastSeasonRank,1,30,12),
  events:last(asArray(source.events).map(event=>({season:integer(asObject(event).season,MIN_SEASON,MAX_SEASON,season),week:integer(asObject(event).week,1,40,1),type:id(asObject(event).type,40,'update'),text:text(asObject(event).text,140,'Club update')})),FOOTBALL_CAREER_LIMITS.aiEvents)
 };
}

const MATCH_REPORT_STAT_KEYS=Object.freeze(['possession','shots','shotsOnTarget','xG','corners','fouls','yellowCards','redCards']);

function normalizeArchivedMatchReport(raw,matchId='',season=2026,week=1){
 const source=asObject(raw),statsSource=asObject(source.stats||source.statistics),tacticsSource=asObject(source.tactics),matchdaySource=asObject(source.matchday),playerOfMatchSource=typeof source.playerOfMatch==='string'?{name:source.playerOfMatch}:asObject(source.playerOfMatch);
 const incidents=asArray(source.incidents||source.events||source.timeline).slice(0,20).map((incident,index)=>{const item=asObject(incident),teamId=id(item.teamId,80,''),playerId=id(item.playerId,80,''),playerName=text(item.playerName,48,''),assistPlayerId=id(item.assistPlayerId,80,''),assistPlayerName=text(item.assistPlayerName,48,'');return {type:enumValue(item.type,['kickoff','goal','card','injury','full-time','commentary'],'commentary'),minute:integer(item.minute,0,120,index),text:text(item.text||item.message,150,'Match update'),...(teamId?{teamId}:{}),...(playerId?{playerId}:{}),...(playerName?{playerName}:{}),...(assistPlayerId?{assistPlayerId}:{}),...(assistPlayerName?{assistPlayerName}:{})};});
 const stats={};for(const key of MATCH_REPORT_STAT_KEYS){const pair=asObject(statsSource[key]);if(!Object.keys(pair).length)continue;const maximum=key==='possession'?100:key==='xG'?50:500;stats[key]={home:round(clamp(pair.home,0,maximum,0),2),away:round(clamp(pair.away,0,maximum,0),2)}}
 const tactic=value=>{const item=asObject(value);if(!Object.keys(item).length)return null;return {formation:enumValue(item.formation,FORMATIONS,'4-3-3'),styleId:enumValue(item.styleId||item.style,PLAYING_STYLES,'balanced')}};
 const homeTactics=tactic(tacticsSource.home),awayTactics=tactic(tacticsSource.away),tactics=homeTactics||awayTactics?{...(homeTactics?{home:homeTactics}:{}),...(awayTactics?{away:awayTactics}:{}),...(tacticsSource.insight||tacticsSource.summary?{insight:text(tacticsSource.insight||tacticsSource.summary,240,'')}: {})}:{};
 const weatherSource=asObject(matchdaySource.weather),matchday=Object.keys(matchdaySource).length?{attendance:integer(matchdaySource.attendance,0,500_000,0),capacity:integer(matchdaySource.capacity,0,500_000,0),weather:{condition:enumValue(weatherSource.condition,WEATHER_CONDITIONS,'clear'),temperature:round(clamp(weatherSource.temperature,-5,50,24)),rainChance:integer(weatherSource.rainChance,0,100,10),windKph:integer(weatherSource.windKph,0,150,8)},pitchConditionBefore:integer(matchdaySource.pitchConditionBefore,0,100,80),pitchConditionAfter:integer(matchdaySource.pitchConditionAfter,0,100,75),netRevenue:money(matchdaySource.netRevenue??matchdaySource.netRevenueAud,0)}:null,playerOfMatchName=text(playerOfMatchSource.name,48,''),playerOfMatchId=id(playerOfMatchSource.playerId||playerOfMatchSource.id,80,''),playerOfMatchTeamId=id(playerOfMatchSource.teamId,80,''),playerOfMatch=playerOfMatchName?{name:playerOfMatchName,rating:round(clamp(playerOfMatchSource.rating,0,10,0),2),...(playerOfMatchId?{playerId:playerOfMatchId}:{}),...(playerOfMatchTeamId?{teamId:playerOfMatchTeamId}:{})}:null;
 if(!incidents.length&&!Object.keys(stats).length&&!Object.keys(tactics).length&&!matchday&&!playerOfMatch)return null;
 return {fixtureId:text(source.fixtureId||source.id,180,''),incidents,stats,tactics,matchday,playerOfMatch};
}

function stripMatchReport(match){if(!isObject(match)||!hasOwn(match,'report'))return match;const compact={...match};delete compact.report;return compact}

function normalizeMatch(raw,index=0,season=2026,week=1){
 const source=asObject(raw),matchId=id(source.id,80,`match-${season}-${week}-${index+1}`),matchSeason=integer(source.season,MIN_SEASON,MAX_SEASON,season),matchWeek=integer(source.week,1,40,week),report=normalizeArchivedMatchReport(source.report,matchId,matchSeason,matchWeek);
 return {id:matchId,season:matchSeason,week:matchWeek,competition:text(source.competition,70,'League'),competitionType:enumValue(source.competitionType,COMPETITION_TYPES,'league'),opponentId:id(source.opponentId,80,''),opponentName:text(source.opponentName,80,'Opponent'),venue:enumValue(source.venue,['home','away','neutral'],'home'),goalsFor:integer(source.goalsFor,0,50,0),goalsAgainst:integer(source.goalsAgainst,0,50,0),attendance:integer(source.attendance,0,500_000,0),netRevenue:money(source.netRevenue,0),result:enumValue(source.result,['W','D','L'],finite(source.goalsFor)>finite(source.goalsAgainst)?'W':finite(source.goalsFor)<finite(source.goalsAgainst)?'L':'D'),...(report?{report}:{})};
}

function normalizeHistory(raw,season=2026,week=1){
 const source=asObject(raw),records=asObject(source.records),normalizedMatches=last(asArray(source.matches).map((entry,index)=>normalizeMatch(entry,index,season,week)),FOOTBALL_CAREER_LIMITS.matches),reportStart=Math.max(0,normalizedMatches.length-FOOTBALL_CAREER_LIMITS.matchReports),matches=normalizedMatches.map((match,index)=>index<reportStart?stripMatchReport(match):match);
 const normalizeMatchRecord=value=>isObject(value)?stripMatchReport(normalizeMatch(value,0,season,week)):null;
 return {
  seasons:last(asArray(source.seasons).map((entry,index)=>{const item=asObject(entry);return {season:integer(item.season,MIN_SEASON,MAX_SEASON,season-index-1),divisionId:id(item.divisionId,60,''),leaguePosition:integer(item.leaguePosition,1,30,12),played:integer(item.played,0,100,0),wins:integer(item.wins,0,100,0),draws:integer(item.draws,0,100,0),losses:integer(item.losses,0,100,0),goalsFor:integer(item.goalsFor,0,500,0),goalsAgainst:integer(item.goalsAgainst,0,500,0),points:integer(item.points,0,300,0),cupResult:text(item.cupResult,70,'Not entered'),academyRating:text(item.academyRating,60,''),cashBalance:money(item.cashBalance,0),summary:text(item.summary,300,'')};}),FOOTBALL_CAREER_LIMITS.seasons),
  trophies:last(asArray(source.trophies).map((entry,index)=>{const item=asObject(entry);return {id:id(item.id,80,`trophy-${index+1}`),season:integer(item.season,MIN_SEASON,MAX_SEASON,season),name:text(item.name,90,'Trophy'),competition:text(item.competition,80,'Competition'),level:text(item.level,50,'Senior')};}),FOOTBALL_CAREER_LIMITS.trophies),
  matches,
  records:{
   biggestWin:normalizeMatchRecord(records.biggestWin),biggestLoss:normalizeMatchRecord(records.biggestLoss),highestAttendance:normalizeMatchRecord(records.highestAttendance),
   recordTransferFeeReceived:money(records.recordTransferFeeReceived,0,0),recordTransferFeePaid:money(records.recordTransferFeePaid,0,0),
   topScorer:{playerId:id(asObject(records.topScorer).playerId,80,''),name:text(asObject(records.topScorer).name,80,''),goals:integer(asObject(records.topScorer).goals,0,100_000,0)},
   currentWinningRun:integer(records.currentWinningRun,0,1_000,0),longestWinningRun:integer(records.longestWinningRun,0,1_000,0),currentUnbeatenRun:integer(records.currentUnbeatenRun,0,1_000,0),longestUnbeatenRun:integer(records.longestUnbeatenRun,0,1_000,0)
  }
 };
}

function normalizeMatchdayPlan(raw){
 const source=asObject(raw);
 return {ticketPrice:money(source.ticketPrice,22,0),hospitalityPrice:money(source.hospitalityPrice,95,0),concessionSpend:round(clamp(source.concessionSpend,0,100,14),2),staffing:integer(source.staffing,1,5,3),security:integer(source.security,1,5,3),pitchPrep:integer(source.pitchPrep,1,5,3),transportSubsidy:money(source.transportSubsidy,0,0),promotionSpend:money(source.promotionSpend,0,0)};
}

function normalizeMatchdayReport(raw,index=0,season=2026,week=1){
 const source=asObject(raw),weather=asObject(source.weather);
 return {id:id(source.id,80,`matchday-${season}-${week}-${index+1}`),fixtureId:id(source.fixtureId,80,''),season:integer(source.season,MIN_SEASON,MAX_SEASON,season),week:integer(source.week,1,40,week),competition:text(source.competition,70,'League'),venue:enumValue(source.venue,['home','away','neutral'],'home'),opponentId:id(source.opponentId,80,''),opponentName:text(source.opponentName,80,'Opponent'),attendance:integer(source.attendance,0,500_000,0),capacity:integer(source.capacity,100,500_000,5_000),weather:{condition:enumValue(weather.condition,WEATHER_CONDITIONS,'clear'),temperature:round(clamp(weather.temperature,-5,50,24)),rainChance:integer(weather.rainChance,0,100,10),windKph:integer(weather.windKph,0,150,8)},pitchConditionBefore:integer(source.pitchConditionBefore,0,100,80),pitchConditionAfter:integer(source.pitchConditionAfter,0,100,75),ticketRevenue:money(source.ticketRevenue,0,0),hospitalityRevenue:money(source.hospitalityRevenue,0,0),concessionRevenue:money(source.concessionRevenue,0,0),travelCost:money(source.travelCost,0,0),operatingCost:money(source.operatingCost,0,0),netRevenue:money(source.netRevenue,0),satisfaction:integer(source.satisfaction,0,100,60)};
}

function normalizeCupMatch(raw,index=0,season=2026,week=1){
 const source=asObject(raw),goalsFor=integer(source.goalsFor,0,50,0),goalsAgainst=integer(source.goalsAgainst,0,50,0);
 return {id:id(source.id||source.fixtureId,80,`cup-match-${season}-${index+1}`),roundNumber:integer(source.roundNumber,1,10,index+1),roundName:text(source.roundName,60,`Round ${index+1}`),season:integer(source.season,MIN_SEASON,MAX_SEASON,season),week:integer(source.week,1,FOOTBALL_CAREER_SEASON_WEEKS,week),opponentId:id(source.opponentId,80,''),opponentName:text(source.opponentName,80,'Cup opponent'),venue:enumValue(source.venue,['home','away','neutral'],'neutral'),goalsFor,goalsAgainst,penaltiesWon:bool(source.penaltiesWon),advanced:bool(source.advanced,goalsFor>goalsAgainst||(goalsFor===goalsAgainst&&bool(source.penaltiesWon)))};
}

function normalizeCup(raw,season=2026,week=1,cupName='Queensland Cup'){
 const source=asObject(raw),matches=last(asArray(source.matches).map((match,index)=>normalizeCupMatch(match,index,season,week)),FOOTBALL_CAREER_LIMITS.cupMatches);
 return {id:id(source.id,60,'queensland-cup'),name:text(source.name,70,cupName),season:integer(source.season,MIN_SEASON,MAX_SEASON,season),status:enumValue(source.status,CUP_STATUSES,'not-entered'),roundNumber:integer(source.roundNumber,0,10,0),roundName:text(source.roundName,60,'Not entered'),nextRoundWeek:source.nextRoundWeek==null?null:integer(source.nextRoundWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,7),entryFee:money(source.entryFee,0,0),prizeMoney:money(source.prizeMoney,0,0),matches};
}

function normalizeFriendly(raw,index=0,season=2026,week=1){
 const source=asObject(raw),goalsFor=source.goalsFor==null?null:integer(source.goalsFor,0,50,0),goalsAgainst=source.goalsAgainst==null?null:integer(source.goalsAgainst,0,50,0);
 return {id:id(source.id||source.fixtureId,80,`friendly-${season}-${week}-${index+1}`),season:integer(source.season,MIN_SEASON,MAX_SEASON,season),week:integer(source.week,1,FOOTBALL_CAREER_SEASON_WEEKS,week),opponentId:id(source.opponentId,80,''),opponentName:text(source.opponentName,80,'Friendly opponent'),venue:enumValue(source.venue,['home','away','neutral'],'home'),status:enumValue(source.status,FRIENDLY_STATUSES,'scheduled'),goalsFor,goalsAgainst,attendance:integer(source.attendance,0,500_000,0),notes:text(source.notes,140,'')};
}

function normalizeCompetitions(raw,season=2026,week=1,cupName='Queensland Cup'){
 const source=asObject(raw),registration=asObject(source.registration);
 return {
  registration:{season:integer(registration.season,MIN_SEASON,MAX_SEASON,season),registeredPlayerIds:last(unique(asArray(registration.registeredPlayerIds).map(value=>id(value,80,'')).filter(Boolean)),FOOTBALL_CAREER_LIMITS.registrations),maxSeniorPlayers:integer(registration.maxSeniorPlayers,11,FOOTBALL_CAREER_LIMITS.registrations,25),homegrownMinimum:integer(registration.homegrownMinimum,0,12,3),lastChangedSeason:integer(registration.lastChangedSeason,MIN_SEASON,MAX_SEASON,season),lastChangedWeek:integer(registration.lastChangedWeek,1,FOOTBALL_CAREER_SEASON_WEEKS,week)},
  cup:normalizeCup(source.cup,season,week,cupName),
  friendlies:last(asArray(source.friendlies).map((fixture,index)=>normalizeFriendly(fixture,index,season,week)),FOOTBALL_CAREER_LIMITS.friendlies)
 };
}

function initialInbox(season,week){
 return [{id:`welcome-${season}`,kind:'welcome',title:'Your club, your decisions',body:'The weekly hub collects board expectations, player matters, scouting updates, competition dates and matchday decisions.',priority:'high',createdSeason:season,createdWeek:week,read:false,resolved:false,resolution:'',actions:[],expiresSeason:null,expiresWeek:null}];
}

export function normalizeCareerWorld(input={},context={}){
 const source=asObject(input),ctx=asObject(context),season=integer(ctx.season??source.season,MIN_SEASON,MAX_SEASON,2026),week=integer(ctx.week??source.week,1,FOOTBALL_CAREER_SEASON_WEEKS,1);
 const seed=text(ctx.seed??source.seed,120,'football-career'),boardSource=asObject(source.board),identitySource=asObject(source.identity),scoutingSource=asObject(source.scouting),matchdaySource=asObject(source.matchday),squadSource=asObject(source.squadDynamics);
 const calendar=buildSeasonCalendar(season,{cupName:asObject(source.calendar).cupName||ctx.cupName});
 let players=last(asArray(source.players).map((player,index)=>normalizePlayer(player,index,season,week)),FOOTBALL_CAREER_LIMITS.players);
 if(hasOwn(ctx,'players')&&Array.isArray(ctx.players)){
  const previous=new Map(players.map(player=>[player.id,player]));
  players=last(ctx.players.map((player,index)=>{
   const incoming=asObject(player),playerId=id(incoming.id||incoming.playerId,80,''),prior=asObject(previous.get(playerId));
   const contract={...asObject(prior.contract),...asObject(incoming.contract)},medical={...asObject(prior.medical),...asObject(incoming.medical)},discipline={...asObject(prior.discipline),...asObject(incoming.discipline)},personalityProfile={...asObject(prior.personalityProfile),...asObject(incoming.personalityProfile||incoming.personalityAttributes)};
   if(hasOwn(incoming,'weeklyWage'))contract.weeklyWage=incoming.weeklyWage;
   else if(hasOwn(incoming,'wage'))contract.weeklyWage=incoming.wage;
   return normalizePlayer({...prior,...incoming,contract,medical,discipline,personalityProfile,seasonStats:isObject(prior.seasonStats)?prior.seasonStats:incoming.seasonStats,careerStats:isObject(prior.careerStats)?prior.careerStats:incoming.careerStats,form:Array.isArray(prior.form)?prior.form:incoming.form,history:Array.isArray(prior.history)?prior.history:incoming.history},index,season,week);
  }),FOOTBALL_CAREER_LIMITS.players);
 }
 const expectations=asArray(boardSource.expectations).length?asArray(boardSource.expectations).slice(0,8).map(normalizeExpectation):defaultExpectations().map(normalizeExpectation);
 const competitions=normalizeCompetitions(source.competitions,season,week,calendar.cupName),eligiblePlayerIds=new Set(players.filter(player=>!TERMINAL_PLAYER_STATUSES.includes(player.status)&&player.status!=='loaned').map(player=>player.id));
 competitions.registration.registeredPlayerIds=competitions.registration.registeredPlayerIds.filter(playerId=>eligiblePlayerIds.has(playerId));
 const squadDynamics=normalizeSquadDynamics(squadSource,players,seed,season,week),contractNegotiations=last(asArray(source.contractNegotiations).map((item,index)=>normalizeContractNegotiation(item,index,players,seed,season,week)).filter(item=>players.some(player=>player.id===item.playerId)),FOOTBALL_CAREER_LIMITS.contractNegotiations);
 return {
  schemaVersion:FOOTBALL_CAREER_SCHEMA_VERSION,seed,clubId:id(ctx.clubId??source.clubId,80,'player-club'),season,week,phase:phaseForWeek(week),lastTickKey:text(source.lastTickKey,30,''),
  calendar:{season,totalWeeks:FOOTBALL_CAREER_SEASON_WEEKS,cupName:calendar.cupName,current:calendar.weeks[week-1]},
  inbox:last(asArray(source.inbox).map((item,index)=>normalizeInboxItem(item,index,season,week)),FOOTBALL_CAREER_LIMITS.inbox),
  board:{expectations,confidence:round(clamp(boardSource.confidence,0,100,60)),supporterTrust:round(clamp(boardSource.supporterTrust,0,100,60)),lastReviewSeason:integer(boardSource.lastReviewSeason,MIN_SEASON,MAX_SEASON,season),lastReviewWeek:integer(boardSource.lastReviewWeek,1,40,1),lastReviewKey:text(boardSource.lastReviewKey,30,'')},
  identity:{nickname:text(identitySource.nickname,50,''),motto:text(identitySource.motto,100,''),values:unique(asArray(identitySource.values).map(value=>enumValue(value,VALID_VALUES,'community'))).slice(0,3),rivalries:last(asArray(identitySource.rivalries).map(normalizeRivalry),FOOTBALL_CAREER_LIMITS.rivalries)},
  players,squadDynamics,contractNegotiations,transferOffers:last(asArray(source.transferOffers).map((offer,index)=>normalizeOffer(offer,index,season,week)),FOOTBALL_CAREER_LIMITS.transferOffers),loans:last(asArray(source.loans).map((loan,index)=>normalizeLoan(loan,index,season,week)),FOOTBALL_CAREER_LIMITS.loans),
  scouting:{assignments:last(asArray(scoutingSource.assignments).map((item,index)=>normalizeScoutingAssignment(item,index,season,week)),FOOTBALL_CAREER_LIMITS.scoutingAssignments),reports:last(asArray(scoutingSource.reports).map((item,index)=>normalizeScoutingReport(item,index,season,week)),FOOTBALL_CAREER_LIMITS.scoutingReports),opponentReports:last(asArray(scoutingSource.opponentReports).map((item,index)=>normalizeOpponentReport(item,index,season,week)),FOOTBALL_CAREER_LIMITS.opponentReports),shortlist:last(asArray(scoutingSource.shortlist).map((item,index)=>normalizeShortlistItem(item,index,season,week)),FOOTBALL_CAREER_LIMITS.shortlist)},
  aiClubs:last(asArray(source.aiClubs).map((club,index)=>normalizeAIClub(club,index,seed,season)),FOOTBALL_CAREER_LIMITS.aiClubs),history:normalizeHistory(source.history,season,week),competitions,
  matchday:{plan:normalizeMatchdayPlan(matchdaySource.plan),reports:last(asArray(matchdaySource.reports).map((report,index)=>normalizeMatchdayReport(report,index,season,week)),FOOTBALL_CAREER_LIMITS.matchdayReports),pitchCondition:integer(matchdaySource.pitchCondition,0,100,82)}
 };
}

export function createCareerWorld(options={}){
 const source=asObject(options),season=integer(source.season,MIN_SEASON,MAX_SEASON,2026),week=integer(source.week,1,40,1);
 const raw={...source,inbox:asArray(source.inbox).length?source.inbox:initialInbox(season,week)};
 return normalizeCareerWorld(raw,source);
}

export function getCompetitionHub(input){
 const state=normalizeCareerWorld(input),registration=state.competitions.registration,registered=new Set(registration.registeredPlayerIds),registeredPlayers=state.players.filter(player=>registered.has(player.id)),eligiblePlayers=state.players.filter(player=>player.status==='active'&&player.ownership!=='former'&&!state.loans.some(loan=>loan.playerId===player.id&&loan.direction==='out'&&loan.status==='active'));
 const homegrownCount=registeredPlayers.filter(player=>player.homegrown).length;
 return {calendar:state.calendar.current,registration:{...registration,windowOpen:isRegistrationOpen(state),registeredCount:registeredPlayers.length,homegrownCount,valid:registeredPlayers.length>=11&&registeredPlayers.length<=registration.maxSeniorPlayers&&homegrownCount>=registration.homegrownMinimum,eligiblePlayerIds:eligiblePlayers.map(player=>player.id)},cup:state.competitions.cup,friendlies:[...state.competitions.friendlies].sort((a,b)=>absoluteWeek(a.season,a.week)-absoluteWeek(b.season,b.week))};
}

export function registerPlayerForCompetition(input,playerId){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),registration=state.competitions.registration,player=state.players.find(item=>item.id===target);
 if(!isRegistrationOpen(state)||!player||player.status!=='active'||player.ownership==='former'||registration.registeredPlayerIds.includes(target)||registration.registeredPlayerIds.length>=registration.maxSeniorPlayers)return state;
 state.competitions.registration={...registration,registeredPlayerIds:[...registration.registeredPlayerIds,target],lastChangedSeason:state.season,lastChangedWeek:state.week};
 return state;
}

export function unregisterPlayerFromCompetition(input,playerId){
 const state=normalizeCareerWorld(input),target=id(playerId,80,''),registration=state.competitions.registration;
 if(!isRegistrationOpen(state)||!registration.registeredPlayerIds.includes(target))return state;
 state.competitions.registration={...registration,registeredPlayerIds:registration.registeredPlayerIds.filter(item=>item!==target),lastChangedSeason:state.season,lastChangedWeek:state.week};
 return state;
}

function nextCupWeek(state,afterWeek=state.week){
 return buildSeasonCalendar(state.season,{cupName:state.calendar.cupName}).weeks.find(item=>item.week>=afterWeek&&item.events.some(event=>event.type==='cup'))?.week??null;
}

const cupRoundName=roundNumber=>['Not entered','Qualifying round','Round of 16','Quarter-final','Semi-final','Final'][integer(roundNumber,0,5,0)]||`Round ${roundNumber}`;

export function enterCup(input,options={}){
 let state=normalizeCareerWorld(input),source=asObject(options),cup=state.competitions.cup;
 if(cup.season===state.season&&cup.status!=='not-entered')return state;
 cup=normalizeCup({...cup,...source,season:state.season,status:'active',roundNumber:1,roundName:cupRoundName(1),nextRoundWeek:nextCupWeek(state),matches:[],prizeMoney:0},state.season,state.week,state.calendar.cupName);
 state.competitions.cup=cup;
 return withInbox(state,{kind:'competition',title:`Entered ${cup.name}`,body:`The cup run begins in the ${cup.roundName}${cup.nextRoundWeek?` in week ${cup.nextRoundWeek}`:''}.`,priority:'high',relatedId:cup.id});
}

export function recordCupResult(input,result={}){
 let state=normalizeCareerWorld(input),source=asObject(result),cup=state.competitions.cup;
 if(cup.status!=='active'||cup.season!==state.season)return state;
 const resultId=id(source.id||source.fixtureId,80,'')||`cup-${hashString(`${state.seed}|${state.season}|${state.week}|${cup.roundNumber}|${source.opponentId}`).toString(36)}`;
 if(cup.matches.some(match=>match.id===resultId))return state;
 const match=normalizeCupMatch({...source,id:resultId,roundNumber:cup.roundNumber,roundName:cup.roundName,season:state.season,week:source.week??state.week},cup.matches.length,state.season,state.week),isFinal=bool(source.isFinal,cup.roundNumber>=5),prize=money(source.prizeMoney,0,0);
 cup={...cup,matches:last([...cup.matches,match],FOOTBALL_CAREER_LIMITS.cupMatches),prizeMoney:money(cup.prizeMoney+prize,cup.prizeMoney,0)};
 state.competitions.cup=cup;
 state=recordClubMatch(state,{id:`career-${resultId}`,season:state.season,week:match.week,competition:cup.name,competitionType:'cup',opponentId:match.opponentId,opponentName:match.opponentName,venue:match.venue,goalsFor:match.goalsFor,goalsAgainst:match.goalsAgainst,attendance:source.attendance,netRevenue:source.netRevenue,report:source.report});
 if(!match.advanced){state.competitions.cup={...state.competitions.cup,status:'eliminated',nextRoundWeek:null};return withInbox(state,{kind:'competition',title:`Eliminated from ${cup.name}`,body:`The cup run ended in the ${cup.roundName}.`,priority:'high',relatedId:cup.id})}
 if(isFinal){state.competitions.cup={...state.competitions.cup,status:'won',roundName:'Winners',nextRoundWeek:null};return addClubTrophy(state,{id:`${cup.id}-${state.season}`,season:state.season,name:cup.name,competition:cup.name,level:'Senior'})}
 const roundNumber=Math.min(5,cup.roundNumber+1);state.competitions.cup={...state.competitions.cup,roundNumber,roundName:cupRoundName(roundNumber),nextRoundWeek:nextCupWeek(state,Math.min(FOOTBALL_CAREER_SEASON_WEEKS,state.week+1))};
 return withInbox(state,{kind:'competition',title:`Through in ${cup.name}`,body:`The club advanced to the ${state.competitions.cup.roundName}.`,priority:'high',relatedId:cup.id});
}

export function scheduleFriendly(input,fixture={}){
 const state=normalizeCareerWorld(input),source=asObject(fixture),fixtureSeason=integer(source.season,MIN_SEASON,MAX_SEASON,state.season),fixtureWeek=integer(source.week,1,FOOTBALL_CAREER_SEASON_WEEKS,state.week),opponentId=id(source.opponentId,80,'');
 if(!opponentId||(!bool(source.force)&&!['preseason','offseason'].includes(phaseForWeek(fixtureWeek))))return state;
 const fixtureId=id(source.id||source.fixtureId,80,'')||`friendly-${hashString(`${state.seed}|${fixtureSeason}|${fixtureWeek}|${opponentId}|${source.venue}`).toString(36)}`;
 if(state.competitions.friendlies.some(item=>item.id===fixtureId))return state;
 state.competitions.friendlies=last([...state.competitions.friendlies,normalizeFriendly({...source,id:fixtureId,season:fixtureSeason,week:fixtureWeek,status:'scheduled'},state.competitions.friendlies.length,fixtureSeason,fixtureWeek)],FOOTBALL_CAREER_LIMITS.friendlies);
 return state;
}

export function cancelFriendly(input,fixtureId){
 const state=normalizeCareerWorld(input),target=id(fixtureId,80,'');
 state.competitions.friendlies=state.competitions.friendlies.map(fixture=>fixture.id===target&&fixture.status==='scheduled'?{...fixture,status:'cancelled'}:fixture);
 return state;
}

export function recordFriendlyResult(input,fixtureId,result={}){
 let state=normalizeCareerWorld(input),target=id(fixtureId,80,''),source=asObject(result),fixture=state.competitions.friendlies.find(item=>item.id===target&&item.status==='scheduled');
 if(!fixture)return state;
 const goalsFor=integer(source.goalsFor,0,50,0),goalsAgainst=integer(source.goalsAgainst,0,50,0);
 state.competitions.friendlies=state.competitions.friendlies.map(item=>item.id===target?{...item,status:'played',goalsFor,goalsAgainst,attendance:integer(source.attendance,0,500_000,0),notes:text(source.notes,140,item.notes)}:item);
 return recordClubMatch(state,{id:`career-${target}`,season:fixture.season,week:fixture.week,competition:'Friendly',competitionType:'friendly',opponentId:fixture.opponentId,opponentName:fixture.opponentName,venue:fixture.venue,goalsFor,goalsAgainst,attendance:source.attendance,netRevenue:source.netRevenue,report:source.report});
}

function withInbox(state,item){
 const next=normalizeCareerWorld(state),normalized=normalizeInboxItem({...item,id:item.id||makeId('message',next,`${item.kind}|${item.title}|${next.inbox.length}`),createdSeason:item.createdSeason??next.season,createdWeek:item.createdWeek??next.week},next.inbox.length,next.season,next.week);
 const duplicate=next.inbox.some(entry=>entry.id===normalized.id);
 if(!duplicate)next.inbox=last([...next.inbox,normalized],FOOTBALL_CAREER_LIMITS.inbox);
 return next;
}

export function addInboxItem(input,item={}){return withInbox(input,asObject(item))}

export function markInboxRead(input,messageId,read=true){
 const state=normalizeCareerWorld(input),target=id(messageId,80,'');
 state.inbox=state.inbox.map(item=>item.id===target?{...item,read:bool(read,true)}:item);
 return state;
}

export function resolveInboxDecision(input,messageId,actionId){
 let state=normalizeCareerWorld(input),target=id(messageId,80,''),choice=id(actionId,40,'');
 const message=state.inbox.find(item=>item.id===target&&!item.resolved),action=message?.actions.find(entry=>entry.id===choice);
 if(!message||!action)return state;
 if(message.kind==='transfer'&&message.relatedId&&['accept','reject','negotiate'].includes(choice))return respondToTransferOffer(state,message.relatedId,choice);
 const effects=action.effects;
 state.inbox=state.inbox.map(item=>{
  if(item.id!==target)return item;
  return {...item,read:true,resolved:true,resolution:action.id};
 });
 state.board.confidence=round(clamp(state.board.confidence+effects.confidence,0,100,state.board.confidence));
 state.board.supporterTrust=round(clamp(state.board.supporterTrust+effects.supporterTrust,0,100,state.board.supporterTrust));
 return state;
}

export function getDecisionHub(input){
 const state=normalizeCareerWorld(input),now=absoluteWeek(state.season,state.week);
 const active=state.inbox.filter(item=>!item.resolved&&(item.expiresSeason==null||absoluteWeek(item.expiresSeason,item.expiresWeek)>=now));
 const items=[...active].reverse(),recent=[...state.inbox].reverse().slice(0,12);
 return {items,messages:items,urgent:active.filter(item=>item.priority==='urgent'),decisions:active.filter(item=>item.actions.length),unread:active.filter(item=>!item.read),recent,counts:{urgent:active.filter(item=>item.priority==='urgent').length,decisions:active.filter(item=>item.actions.length).length,unread:active.filter(item=>!item.read).length}};
}

export function setBoardExpectations(input,expectations=[]){
 const state=normalizeCareerWorld(input),items=asArray(expectations).slice(0,8);
 if(items.length)state.board.expectations=items.map(normalizeExpectation);
 return state;
}

function expectationProgress(expectation,value){
 if(expectation.direction==='min'){
  if(value>=expectation.target)return 100;
  if(expectation.target<=0)return value>=expectation.target?100:0;
  return clamp(value/expectation.target*100,0,100,0);
 }
 if(value<=expectation.target)return 100;
 if(expectation.target<=0)return value<=expectation.target?100:0;
 return clamp(expectation.target/value*100,0,100,0);
}

export function reviewBoardPerformance(input,metrics={}){
 let state=normalizeCareerWorld(input),source=asObject(metrics),weighted=0,totalWeight=0;
 const reviewKey=`${state.season}-${state.week}`;
 if(state.board.lastReviewKey===reviewKey)return state;
 const metricValues=new Map(Object.entries(source).map(([key,value])=>[id(key,60,''),value]));
 state.board.expectations=state.board.expectations.map(expectation=>{
  if(!metricValues.has(expectation.metric)||!Number.isFinite(Number(metricValues.get(expectation.metric))))return expectation;
  const value=Number(metricValues.get(expectation.metric)),progress=round(expectationProgress(expectation,value));
  weighted+=progress*expectation.weight;totalWeight+=expectation.weight;
  return {...expectation,progress,status:progress>=100?'achieved':progress>=65?'on-track':progress>=35?'at-risk':'failed'};
 });
 if(!totalWeight)return state;
 const score=weighted/totalWeight;
 state.board.confidence=round(clamp(state.board.confidence*.7+score*.3,0,100,50));
 state.board.lastReviewSeason=state.season;state.board.lastReviewWeek=state.week;state.board.lastReviewKey=reviewKey;
 state=withInbox(state,{id:`board-review-${state.season}-${state.week}`,kind:'board',title:'Board confidence review',body:`Overall performance against the club plan is ${Math.round(score)}%. Board confidence is now ${Math.round(state.board.confidence)}%.`,priority:score<35?'urgent':score<65?'high':'normal'});
 return state;
}

export function applyClubSentimentEvent(input,event={}){
 const state=normalizeCareerWorld(input),source=asObject(event),type=id(source.type,50,'update');
 const defaults={win:[1,1],loss:[-1,-1],'derby-win':[4,6],'derby-loss':[-4,-5],trophy:[8,10],promotion:[10,12],relegation:[-12,-14],'community-event':[1,4],'price-rise':[0,-3],'star-sale':[-1,-4],'academy-debut':[1,3],'financial-crisis':[-8,-6]};
 const [confidence,supporters]=defaults[type]||[0,0];
 state.board.confidence=round(clamp(state.board.confidence+clamp(source.confidence,-25,25,confidence),0,100,state.board.confidence));
 state.board.supporterTrust=round(clamp(state.board.supporterTrust+clamp(source.supporterTrust,-25,25,supporters),0,100,state.board.supporterTrust));
 return state;
}

export function syncCareerPlayers(input,players=[]){return normalizeCareerWorld(input,{players:asArray(players)})}

export function recordPlayerAppearance(input,playerId,performance={}){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),source=asObject(performance);
 state.players=state.players.map(player=>{
  if(player.id!==target)return player;
  const seasonStats={...player.seasonStats},careerStats={...player.careerStats},previousAppearances=seasonStats.appearances,rating=round(clamp(source.rating,0,10,6),2);
  for(const key of PLAYER_STAT_KEYS){
   const amount=key==='appearances'?(source.appeared===false?0:1):key==='starts'?(bool(source.started)?1:0):key==='minutes'?integer(source.minutes,0,130,bool(source.started)?90:0):integer(source[key],0,20,0);
   seasonStats[key]+=amount;careerStats[key]+=amount;
  }
  if(source.appeared!==false){
   seasonStats.averageRating=round((seasonStats.averageRating*previousAppearances+rating)/(previousAppearances+1),2);
   const careerPrevious=Math.max(0,careerStats.appearances-1);careerStats.averageRating=round((careerStats.averageRating*careerPrevious+rating)/(careerPrevious+1),2);
  }
  const marketDelta=(rating-6.3)*.006+(integer(source.goals,0,20,0)+integer(source.assists,0,20,0))*.002;
 return {...player,seasonStats,careerStats,form:source.appeared===false?player.form:last([...player.form,rating],FOOTBALL_CAREER_LIMITS.playerForm),morale:integer(player.morale+(rating>=7?2:rating<5.8?-2:0),0,100,player.morale),marketValue:money(player.marketValue*(1+marketDelta),player.marketValue,0)};
 });
 const yellowCards=integer(source.yellowCards,0,5,0),redCards=integer(source.redCards,0,2,0);if(yellowCards||redCards)state=recordPlayerDiscipline(state,target,{yellowCards,redCards,redSuspensionMatches:source.redSuspensionMatches,reason:source.disciplineReason});
 const updated=state.players.find(player=>player.id===target);
 if(updated&&updated.careerStats.goals>state.history.records.topScorer.goals)state.history.records.topScorer={playerId:updated.id,name:updated.name,goals:updated.careerStats.goals};
 return state;
}

export function setPlayerDevelopmentFocus(input,playerId,focus='balanced'){
 const state=normalizeCareerWorld(input),target=id(playerId,80,''),safeFocus=String(focus||'');
 if(!FOOTBALL_DEVELOPMENT_FOCUSES.includes(safeFocus))return state;
 state.players=state.players.map(player=>player.id===target&&!TERMINAL_PLAYER_STATUSES.includes(player.status)?{...player,developmentFocus:safeFocus}:player);
 return state;
}

export function getSquadDynamics(input){return normalizeCareerWorld(input).squadDynamics}

export function refreshSquadDynamics(input){
 const state=normalizeCareerWorld(input),eligible=state.players.filter(player=>!TERMINAL_PLAYER_STATUSES.includes(player.status)&&player.ownership!=='former'),averageMorale=eligible.length?eligible.reduce((sum,player)=>sum+player.morale,0)/eligible.length:60,activePromises=state.squadDynamics.promises.filter(item=>item.status==='active'),now=absoluteWeek(state.season,state.week),brokenPromises=state.squadDynamics.promises.filter(item=>item.status==='broken'&&item.resolvedSeason!=null&&now-absoluteWeek(item.resolvedSeason,item.resolvedWeek)<=12).length,mentoringBoost=Math.min(8,state.squadDynamics.mentoringGroups.length*1.5),captain=eligible.find(player=>player.id===state.squadDynamics.captainId),leadershipBoost=captain?(captain.personalityProfile.leadership-50)/10:0;
 state.squadDynamics=normalizeSquadDynamics({...state.squadDynamics,cohesion:integer(state.squadDynamics.cohesion*.72+averageMorale*.2+mentoringBoost-brokenPromises*.8,0,100,65),atmosphere:integer(averageMorale+leadershipBoost-activePromises.length*.15-brokenPromises*2,0,100,65),lastRefreshKey:`${state.season}-${state.week}`},state.players,state.seed,state.season,state.week);
 return state;
}

export function setCaptaincy(input,captainId,viceCaptainId=''){
 let state=normalizeCareerWorld(input),captain=id(captainId,80,''),vice=id(viceCaptainId,80,''),validIds=new Set(state.players.filter(player=>!TERMINAL_PLAYER_STATUSES.includes(player.status)&&player.ownership!=='former').map(player=>player.id));
 if(!validIds.has(captain)||captain===vice||vice&&!validIds.has(vice))return state;
 const previous=state.squadDynamics.captainId;state.squadDynamics={...state.squadDynamics,captainId:captain,viceCaptainId:vice};
 if(previous&&previous!==captain)state=recordPlayerReaction(state,previous,{type:'concerned',intensity:5,reason:'Removed from the captaincy'});
 state=recordPlayerReaction(state,captain,{type:'delighted',intensity:6,reason:'Appointed club captain'});
 return refreshSquadDynamics(state);
}

export function createMentoringGroup(input,details={}){
 const state=normalizeCareerWorld(input),source=asObject(details),mentorId=id(source.mentorId,80,''),validIds=new Set(state.players.filter(player=>!TERMINAL_PLAYER_STATUSES.includes(player.status)&&player.ownership!=='former').map(player=>player.id)),menteeIds=last(unique(asArray(source.menteeIds||source.memberIds).map(value=>id(value,80,'')).filter(value=>validIds.has(value)&&value!==mentorId)),6);
 if(!validIds.has(mentorId)||!menteeIds.length||state.squadDynamics.mentoringGroups.length>=FOOTBALL_CAREER_LIMITS.mentoringGroups)return state;
 const group={id:id(source.id,60,`mentoring-${hashString(`${state.seed}|${mentorId}|${menteeIds.join('|')}`).toString(36)}`),name:text(source.name,70,`Mentoring group: ${state.players.find(player=>player.id===mentorId)?.name||'Senior player'}`),mentorId,menteeIds,focus:enumValue(source.focus,['professionalism','leadership','consistency','development'],'professionalism'),cohesion:integer(source.cohesion,0,100,60),startedSeason:state.season,startedWeek:state.week};
 if(state.squadDynamics.mentoringGroups.some(item=>item.id===group.id))return state;
 state.squadDynamics.mentoringGroups=[...state.squadDynamics.mentoringGroups,group];return refreshSquadDynamics(state);
}

export function removeMentoringGroup(input,groupId){
 const state=normalizeCareerWorld(input),target=id(groupId,60,'');state.squadDynamics.mentoringGroups=state.squadDynamics.mentoringGroups.filter(group=>group.id!==target);return refreshSquadDynamics(state);
}

export function recordPlayerReaction(input,playerId,reaction={}){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),player=state.players.find(item=>item.id===target&& !TERMINAL_PLAYER_STATUSES.includes(item.status));
 if(!player)return state;
 const source=asObject(reaction),item=normalizeReaction({...source,id:source.id||`reaction-${hashString(`${state.seed}|${state.season}|${state.week}|${target}|${source.type}|${source.reason}`).toString(36)}`,playerId:target,season:state.season,week:state.week},state.squadDynamics.reactions.length,state.season,state.week),direction={delighted:1,positive:1,neutral:0,concerned:-1,unhappy:-1,angry:-1}[enumValue(source.type,REACTION_TYPES,'neutral')]||0,delta=direction*item.intensity;
 state.squadDynamics.reactions=last([...state.squadDynamics.reactions.filter(existing=>existing.id!==item.id),item],FOOTBALL_CAREER_LIMITS.reactions);state.players=state.players.map(entry=>entry.id===target?{...entry,morale:integer(entry.morale+delta,0,100,entry.morale)}:entry);
 if(item.intensity>=7&&['unhappy','angry'].includes(item.type))state=withInbox(state,{id:`reaction-message-${item.id}`,kind:'player',title:`${player.name} is ${item.type}`,body:item.reason,priority:item.type==='angry'?'urgent':'high',relatedId:target});
 return state;
}

export function createPlayerPromise(input,playerId,details={}){
 const state=normalizeCareerWorld(input),target=id(playerId,80,''),source=asObject(details);
 if(!state.players.some(player=>player.id===target&&!TERMINAL_PLAYER_STATUSES.includes(player.status))||state.squadDynamics.promises.length>=FOOTBALL_CAREER_LIMITS.promises)return state;
 const promise=normalizePromise({...source,id:source.id||`promise-${hashString(`${state.seed}|${state.season}|${state.week}|${target}|${source.type}|${state.squadDynamics.promises.length}`).toString(36)}`,playerId:target,createdSeason:state.season,createdWeek:state.week},state.squadDynamics.promises.length,state.season,state.week);
 if(state.squadDynamics.promises.some(item=>item.id===promise.id))return state;
 state.squadDynamics.promises=last([...state.squadDynamics.promises,promise],FOOTBALL_CAREER_LIMITS.promises);return state;
}

export function updatePlayerPromiseProgress(input,promiseId,progress=0){
 const state=normalizeCareerWorld(input),target=id(promiseId,80,'');state.squadDynamics.promises=state.squadDynamics.promises.map(item=>item.id===target&&item.status==='active'?{...item,progress:round(clamp(progress,0,1_000_000,item.progress),2)}:item);return state;
}

export function resolvePlayerPromise(input,promiseId,outcome='fulfilled',reason=''){
 let state=normalizeCareerWorld(input),target=id(promiseId,80,''),safeOutcome=enumValue(outcome,['fulfilled','broken','cancelled'],'fulfilled'),promise=state.squadDynamics.promises.find(item=>item.id===target&&item.status==='active');
 if(!promise)return state;
 state.squadDynamics.promises=state.squadDynamics.promises.map(item=>item.id===target?{...item,status:safeOutcome,resolvedSeason:state.season,resolvedWeek:state.week,resolutionNote:text(reason,160,'')}:item);
 if(safeOutcome==='fulfilled')state=recordPlayerReaction(state,promise.playerId,{type:'positive',intensity:Math.max(2,Math.ceil(promise.moraleImpact/2)),reason:`Promise kept: ${promise.detail}`});
 if(safeOutcome==='broken')state=recordPlayerReaction(state,promise.playerId,{type:promise.moraleImpact>=9?'angry':'unhappy',intensity:promise.moraleImpact,reason:`Promise broken: ${promise.detail}`});
 return withInbox(state,{id:`promise-resolution-${promise.id}`,kind:'player',title:`Player promise ${safeOutcome}`,body:`${state.players.find(player=>player.id===promise.playerId)?.name||'The player'}: ${promise.detail}${reason?` - ${text(reason,100,'')}`:''}.`,priority:safeOutcome==='broken'?'high':'normal',relatedId:promise.playerId});
}

export function getPlayerAvailability(input,playerId){
 const state=normalizeCareerWorld(input),player=state.players.find(item=>item.id===id(playerId,80,''));return player?availabilityFor(player):null;
}

export function isPlayerAvailable(input,playerId){return Boolean(getPlayerAvailability(input,playerId)?.available)}

export function reportPlayerInjury(input,playerId,details={}){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),source=asObject(details),player=state.players.find(item=>item.id===target&&!TERMINAL_PLAYER_STATUSES.includes(item.status));
 if(!player||player.ownership==='former')return state;
 const defaults={minor:2,moderate:4,serious:8,major:16},severity=enumValue(source.severity,INJURY_SEVERITIES,'moderate'),previous=player.medical.lastInjury,sameArea=previous&&text(source.bodyArea,40,'General')===previous.bodyArea,baseWeeks=integer(source.weeksTotal??source.durationWeeks,1,80,defaults[severity]),weeksTotal=integer(baseWeeks+(sameArea?Math.ceil(baseWeeks*.25):0),1,80,baseWeeks),recurrenceRisk=integer(source.recurrenceRisk,0,100,(sameArea?previous.recurrenceRisk+14:10)+(source.rehabPlan==='intensive'?10:0)),injury=normalizeInjury({...source,severity,weeksTotal,weeksRemaining:weeksTotal,recurrenceRisk,occurredSeason:state.season,occurredWeek:state.week},target,state.season,state.week);
 state.players=state.players.map(item=>item.id===target?{...item,status:item.status==='loaned'?'loaned':'injured',medical:{...item.medical,fitness:integer(item.medical.fitness-weeksTotal*4,0,100,item.medical.fitness),injury},availability:{available:false,status:'injured',reason:injury.type,estimatedReturnSeason:injury.returnSeason,estimatedReturnWeek:injury.returnWeek}}:item);
 return withInbox(state,{id:`injury-message-${injury.id}`,kind:'player',title:`Injury: ${player.name}`,body:`${player.name} suffered ${injury.type} (${injury.bodyArea}) and is expected to miss about ${injury.weeksRemaining} week${injury.weeksRemaining===1?'':'s'}. Recurrence risk is ${injury.recurrenceRisk}%.`,priority:weeksTotal>=8?'urgent':'high',relatedId:target});
}

export function setPlayerRehabilitation(input,playerId,plan='standard'){
 const state=normalizeCareerWorld(input),target=id(playerId,80,''),safePlan=enumValue(plan,REHAB_PLANS,'standard');state.players=state.players.map(player=>player.id===target&&player.medical.injury?{...player,medical:{...player.medical,injury:{...player.medical.injury,rehabPlan:safePlan,rehabStatus:'rehabilitation',recurrenceRisk:integer(player.medical.injury.recurrenceRisk+(safePlan==='intensive'?8:safePlan==='conservative'?-5:0),0,100,player.medical.injury.recurrenceRisk)}}}:player);return state;
}

export function recordPlayerDiscipline(input,playerId,incident={}){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),source=asObject(incident),player=state.players.find(item=>item.id===target&&!TERMINAL_PLAYER_STATUSES.includes(item.status));
 if(!player)return state;
 const yellowCards=integer(source.yellowCards,0,5,0),redCards=integer(source.redCards,0,2,0),discipline=player.discipline.season===state.season?{...player.discipline}:{...player.discipline,season:state.season,yellowCards:0,nextThreshold:5},total=discipline.yellowCards+yellowCards,crossed=yellowCards>0&&total>=discipline.nextThreshold,suspension=discipline.suspensionMatchesRemaining+(crossed?1:0)+(redCards?integer(source.redSuspensionMatches,1,4,1):0),nextThreshold=crossed?Math.min(30,discipline.nextThreshold+5):discipline.nextThreshold,reason=text(source.reason,100,redCards?'Red-card suspension':crossed?'Yellow-card accumulation':discipline.reason);
 const updated={...discipline,yellowCards:total,nextThreshold,suspensionMatchesRemaining:suspension,reason,lastCardSeason:yellowCards||redCards?state.season:discipline.lastCardSeason,lastCardWeek:yellowCards||redCards?state.week:discipline.lastCardWeek};state.players=state.players.map(item=>item.id===target?{...item,discipline:updated,status:item.medical.injury?'injured':suspension?'suspended':item.status,availability:item.medical.injury?{available:false,status:'injured',reason:item.medical.injury.type,estimatedReturnSeason:item.medical.injury.returnSeason,estimatedReturnWeek:item.medical.injury.returnWeek}:suspension?{available:false,status:'suspended',reason,estimatedReturnSeason:null,estimatedReturnWeek:null}:item.availability}:item);
 if(suspension>player.discipline.suspensionMatchesRemaining)state=withInbox(state,{id:`suspension-${state.season}-${state.week}-${target}-${suspension}`,kind:'player',title:`Suspension: ${player.name}`,body:`${player.name} will miss ${suspension} match${suspension===1?'':'es'} due to ${reason.toLowerCase()}.`,priority:'high',relatedId:target});
 return state;
}

export function servePlayerSuspension(input,playerId,matches=1){
 const state=normalizeCareerWorld(input),target=id(playerId,80,''),served=integer(matches,1,10,1);state.players=state.players.map(player=>{if(player.id!==target)return player;const remaining=Math.max(0,player.discipline.suspensionMatchesRemaining-served),status=TERMINAL_PLAYER_STATUSES.includes(player.status)||player.status==='loaned'?player.status:player.medical.injury?'injured':remaining?'suspended':'active';return {...player,discipline:{...player.discipline,suspensionMatchesRemaining:remaining,reason:remaining?player.discipline.reason:''},status,availability:{available:status==='active',status:status==='active'?'available':status,reason:status==='active'?'available':player.medical.injury?.type||player.discipline.reason,estimatedReturnSeason:player.medical.injury?.returnSeason||null,estimatedReturnWeek:player.medical.injury?.returnWeek||null}}});return state;
}

function defaultContractDemand(player,agent){
 const profile=player.personalityProfile,current=Math.max(50,player.contract.weeklyWage),ambitionFactor=.95+profile.ambition/230,loyaltyDiscount=(profile.loyalty-50)/500,agentFactor=agent.style==='hardline'?1.12:agent.style==='opportunistic'?1.08:agent.style==='collaborative'?.98:1.03,wage=Math.ceil(current*Math.max(1.02,ambitionFactor+agentFactor-1-loyaltyDiscount)/10)*10,role=player.rating>=78?'star':player.rating>=68?'important':player.age<=21?'prospect':player.contract.squadRole;
 return normalizeContractTerms({weeklyWage:wage,seasons:profile.loyalty>=70?3:2,squadRole:role,signingBonus:Math.round(wage*(agent.style==='opportunistic'?10:6)),releaseClause:money(Math.max(player.marketValue*1.6,wage*500),0,0),promotionBonus:Math.round(wage*5),appearanceBonus:Math.round(wage*.18)});
}

export function startContractNegotiation(input,playerId,options={}){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),source=asObject(options),player=state.players.find(item=>item.id===target&&!TERMINAL_PLAYER_STATUSES.includes(item.status));
 if(!player||state.contractNegotiations.some(item=>item.playerId===target&&['awaiting-club','countered'].includes(item.status)))return state;
 const agent=agentForPlayer(player,state.seed),demand=normalizeContractTerms(source.demand,defaultContractDemand(player,agent)),expiry=addWeeks(state.season,state.week,integer(source.expiresInWeeks,1,8,3)),session=normalizeContractNegotiation({id:source.id||`contract-talk-${hashString(`${state.seed}|${state.season}|${state.week}|${target}`).toString(36)}`,playerId:target,status:'awaiting-club',round:0,agent,demand,createdSeason:state.season,createdWeek:state.week,expiresSeason:expiry.season,expiresWeek:expiry.week,history:[{round:0,by:'agent',outcome:'opened',season:state.season,week:state.week,terms:demand,note:'Opening demands'}]},state.contractNegotiations.length,state.players,state.seed,state.season,state.week);
 state.contractNegotiations=last([...state.contractNegotiations,session],FOOTBALL_CAREER_LIMITS.contractNegotiations);return withInbox(state,{id:`contract-open-${session.id}`,kind:'contract',title:`Contract talks: ${player.name}`,body:`${session.agent.name}, a ${session.agent.style} agent, opened talks at $${demand.weeklyWage.toLocaleString('en-AU')} per week for ${demand.seasons} season${demand.seasons===1?'':'s'}.`,priority:'high',relatedId:session.id,expiresSeason:session.expiresSeason,expiresWeek:session.expiresWeek});
}

function contractOfferScore(player,session,offer){
 const roleRank={fringe:1,prospect:2,rotation:3,important:4,star:5},demand=session.demand,wageRatio=offer.weeklyWage/Math.max(1,demand.weeklyWage),roleRatio=Math.min(1.15,(roleRank[offer.squadRole]||1)/(roleRank[demand.squadRole]||1)),termRatio=Math.min(1.1,offer.seasons/Math.max(1,demand.seasons)),bonusDemand=demand.signingBonus+demand.promotionBonus+demand.appearanceBonus*12,bonusOffer=offer.signingBonus+offer.promotionBonus+offer.appearanceBonus*12,bonusRatio=bonusDemand?Math.min(1.15,bonusOffer/bonusDemand):1,promiseBoost=Math.min(.08,offer.promises.length*.025),loyaltyBoost=(player.personalityProfile.loyalty-50)/500,agentPenalty=(session.agent.aggression-50)/500;
 return wageRatio*.55+roleRatio*.18+termRatio*.1+bonusRatio*.12+promiseBoost+loyaltyBoost-agentPenalty;
}

export function submitContractOffer(input,negotiationId,terms={}){
 let state=normalizeCareerWorld(input),target=id(negotiationId,80,''),session=state.contractNegotiations.find(item=>item.id===target&&['awaiting-club','countered'].includes(item.status)),player=session?state.players.find(item=>item.id===session.playerId):null;
 if(!session||!player)return state;
 const offer=normalizeContractTerms(terms,{weeklyWage:player.contract.weeklyWage,seasons:2,squadRole:player.contract.squadRole}),roundNumber=session.round+1,score=contractOfferScore(player,session,offer),random=seededRandom(`${state.seed}|contract-outcome|${session.id}|${roundNumber}|${offer.weeklyWage}|${offer.seasons}|${offer.squadRole}`),threshold=.91+(random()-.5)*.05,historyEntry={round:roundNumber,by:'club',outcome:'offered',season:state.season,week:state.week,terms:offer,note:`Offer score ${round(score,2)}`};
 if(score>=threshold){
  const end=addWeeks(state.season,state.week,offer.seasons*40),promiseIds=[];for(const promiseTerms of offer.promises){const before=new Set(state.squadDynamics.promises.map(item=>item.id));state=createPlayerPromise(state,player.id,{...promiseTerms,source:'negotiation'});const created=state.squadDynamics.promises.find(item=>!before.has(item.id));if(created)promiseIds.push(created.id)}
  state.players=state.players.map(item=>item.id===player.id?{...item,contract:{...item.contract,...offer,expiresSeason:end.season,expiresWeek:end.week,signedSeason:state.season,agentName:session.agent.name,promiseIds:last([...item.contract.promiseIds,...promiseIds],8)},morale:integer(item.morale+5,0,100,item.morale)}:item);
  state.contractNegotiations=state.contractNegotiations.map(item=>item.id===target?{...item,status:'agreed',round:roundNumber,offer,history:last([...item.history,historyEntry,{round:roundNumber,by:'agent',outcome:'accepted',season:state.season,week:state.week,terms:offer,note:'Terms accepted'}],FOOTBALL_CAREER_LIMITS.negotiationHistory),resolution:'Contract agreed'}:item);
  return withInbox(state,{id:`contract-agreed-${target}`,kind:'contract',title:`Contract agreed: ${player.name}`,body:`${player.name} accepted a ${offer.seasons}-season deal worth $${offer.weeklyWage.toLocaleString('en-AU')} per week.`,priority:'normal',relatedId:target});
 }
 const patienceExceeded=roundNumber>=session.agent.patience||roundNumber>=5,tooLow=score<.62;
 if(patienceExceeded||tooLow){const status=patienceExceeded?'walked-away':'rejected';state.contractNegotiations=state.contractNegotiations.map(item=>item.id===target?{...item,status,round:roundNumber,offer,history:last([...item.history,historyEntry,{round:roundNumber,by:'agent',outcome:'rejected',season:state.season,week:state.week,terms:null,note:patienceExceeded?'Agent ended talks':'Offer rejected'}],FOOTBALL_CAREER_LIMITS.negotiationHistory),resolution:patienceExceeded?'Agent walked away':'Offer rejected'}:item);state=recordPlayerReaction(state,player.id,{type:patienceExceeded?'angry':'unhappy',intensity:patienceExceeded?7:4,reason:'Contract talks failed'});return withInbox(state,{id:`contract-failed-${target}-${roundNumber}`,kind:'contract',title:`Contract talks failed: ${player.name}`,body:patienceExceeded?`${session.agent.name} ended negotiations after ${roundNumber} round${roundNumber===1?'':'s'}.`:'The offer was rejected as too far from the player expectations.',priority:patienceExceeded?'urgent':'high',relatedId:target});}
 const counter=normalizeContractTerms({weeklyWage:Math.max(offer.weeklyWage,Math.ceil(session.demand.weeklyWage*(.93-session.agent.relationship/2000)/10)*10),seasons:offer.seasons>=session.demand.seasons?offer.seasons:session.demand.seasons,squadRole:(role=>role)(offer.squadRole),signingBonus:Math.max(offer.signingBonus,Math.round(session.demand.signingBonus*.9)),releaseClause:offer.releaseClause||session.demand.releaseClause,promotionBonus:Math.max(offer.promotionBonus,Math.round(session.demand.promotionBonus*.85)),appearanceBonus:Math.max(offer.appearanceBonus,Math.round(session.demand.appearanceBonus*.85)),promises:offer.promises});
 state.contractNegotiations=state.contractNegotiations.map(item=>item.id===target?{...item,status:'countered',round:roundNumber,offer,demand:counter,history:last([...item.history,historyEntry,{round:roundNumber,by:'agent',outcome:'countered',season:state.season,week:state.week,terms:counter,note:'Revised player demands'}],FOOTBALL_CAREER_LIMITS.negotiationHistory)}:item);return withInbox(state,{id:`contract-counter-${target}-${roundNumber}`,kind:'contract',title:`Counteroffer: ${player.name}`,body:`${session.agent.name} countered at $${counter.weeklyWage.toLocaleString('en-AU')} per week with a ${counter.squadRole} squad role.`,priority:'high',relatedId:target});
}

export function withdrawContractNegotiation(input,negotiationId){
 let state=normalizeCareerWorld(input),target=id(negotiationId,80,''),session=state.contractNegotiations.find(item=>item.id===target&&['awaiting-club','countered'].includes(item.status));if(!session)return state;state.contractNegotiations=state.contractNegotiations.map(item=>item.id===target?{...item,status:'withdrawn',resolution:'Club withdrew',history:last([...item.history,{round:item.round,by:'club',outcome:'withdrawn',season:state.season,week:state.week,terms:null,note:'Club withdrew from talks'}],FOOTBALL_CAREER_LIMITS.negotiationHistory)}:item);return recordPlayerReaction(state,session.playerId,{type:'concerned',intensity:3,reason:'The club withdrew its contract offer'});
}

export function getContractNegotiation(input,negotiationId){return normalizeCareerWorld(input).contractNegotiations.find(item=>item.id===id(negotiationId,80,''))||null}

export function renewPlayerContract(input,playerId,terms={}){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),source=asObject(terms),found=false;
 state.players=state.players.map(player=>{
  if(player.id!==target||['released','transferred','retired'].includes(player.status))return player;
  found=true;const agreed=normalizeContractTerms(source,{weeklyWage:player.contract.weeklyWage,seasons:2,squadRole:player.contract.squadRole}),end=addWeeks(state.season,state.week,agreed.seasons*40);
  return {...player,contract:{...player.contract,weeklyWage:agreed.weeklyWage,expiresSeason:end.season,expiresWeek:end.week,squadRole:agreed.squadRole,signedSeason:state.season,clauses:unique(asArray(source.clauses).map(value=>text(value,60,'')).filter(Boolean)).slice(0,5),signingBonus:agreed.signingBonus,releaseClause:agreed.releaseClause,promotionBonus:agreed.promotionBonus,appearanceBonus:agreed.appearanceBonus,agentName:text(source.agentName,60,player.contract.agentName)},morale:integer(player.morale+4,0,100,player.morale)};
 });
 if(found&&asArray(source.promises).length){const promiseIds=[];for(const promiseTerms of asArray(source.promises).slice(0,4)){const before=new Set(state.squadDynamics.promises.map(item=>item.id));state=createPlayerPromise(state,target,{...asObject(promiseTerms),source:'contract'});const created=state.squadDynamics.promises.find(item=>!before.has(item.id));if(created)promiseIds.push(created.id)}state.players=state.players.map(player=>player.id===target?{...player,contract:{...player.contract,promiseIds:last([...player.contract.promiseIds,...promiseIds],8)}}:player)}
 if(found){state.contractNegotiations=state.contractNegotiations.map(item=>item.playerId===target&&['awaiting-club','countered'].includes(item.status)?{...item,status:'agreed',resolution:'Contract completed directly'}:item);state=withInbox(state,{kind:'contract',title:'Contract renewed',body:`${state.players.find(player=>player.id===target)?.name||'The player'} has signed a new contract.`,priority:'normal'});}
 return state;
}

export function releasePlayer(input,playerId,reason='Released by the club'){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),playerName='Player',changed=false;
 state.players=state.players.map(player=>{
  if(player.id!==target||['released','transferred','retired'].includes(player.status))return player;
  changed=true;playerName=player.name;return {...player,status:'released',ownership:'former',departureSeason:state.season,transferStatus:'not-listed',contract:{...player.contract,weeklyWage:0,expiresSeason:state.season,expiresWeek:state.week}};
 });
 if(changed)state.competitions.registration.registeredPlayerIds=state.competitions.registration.registeredPlayerIds.filter(playerIdValue=>playerIdValue!==target);
 if(changed)state=withInbox(state,{kind:'contract',title:`${playerName} released`,body:text(reason,300,'Released by the club.'),priority:'normal'});
 return state;
}

export function setPlayerTransferStatus(input,playerId,status='not-listed'){
 const state=normalizeCareerWorld(input),target=id(playerId,80,''),safeStatus=enumValue(status,TRANSFER_STATUSES,'not-listed');
 state.players=state.players.map(player=>player.id===target&&!['released','transferred','retired'].includes(player.status)?{...player,transferStatus:safeStatus}:player);
 return state;
}

export function recordTransferFeePaid(input,amount,details={}){
 let state=normalizeCareerWorld(input),fee=money(amount,0,0),source=asObject(details);
 if(fee<=0)return state;
 state.history.records.recordTransferFeePaid=Math.max(state.history.records.recordTransferFeePaid,fee);
 if(source.playerId||source.playerName)state=withInbox(state,{kind:'transfer',title:'Incoming transfer completed',body:`${text(source.playerName,80,'A new player')} joined for $${fee.toLocaleString('en-AU')}.`,priority:'normal',relatedId:source.playerId});
 return state;
}

export function syncAIClubs(input,clubs=[]){
 const state=normalizeCareerWorld(input),previous=new Map(state.aiClubs.map(club=>[club.id,club]));
 const incoming=asArray(clubs).map((club,index)=>{
  const source=asObject(club),clubId=id(source.id||source.clubId,80,`ai-club-${index+1}`);
  return normalizeAIClub({...asObject(previous.get(clubId)),...source},index,state.seed,state.season);
 }),incomingIds=new Set(incoming.map(club=>club.id));
 state.aiClubs=last([...state.aiClubs.filter(club=>!incomingIds.has(club.id)),...incoming],FOOTBALL_CAREER_LIMITS.aiClubs);
 return state;
}

export function evolveAIClubs(input,context={}){
 const state=normalizeCareerWorld(input),source=asObject(context),offseason=bool(source.offseason,state.phase==='offseason'),seasonBoundary=bool(source.seasonBoundary,false)&&state.week===1,weeks=integer(source.weeks,1,40,1);
 state.aiClubs=state.aiClubs.map(club=>{
  const random=seededRandom(`${state.seed}|evolve|${state.season}|${state.week}|${club.id}|${weeks}`),operatingResult=Math.round((club.reputation*95+club.supporterTrust*35-club.strength*80-club.facilities*20)*weeks);
  let finances=money(club.finances+operatingResult,club.finances),trajectory=clamp((club.ambition+club.facilities+club.youth)/45-3+(random()-.5)*1.5,-5,5,0);
  let strength=clamp(club.strength+trajectory*.04*weeks+(finances<0?-.06*weeks:0),20,95,club.strength),facilities=club.facilities,youth=club.youth,scouting=club.scouting,manager={...club.manager},events=[...club.events];
  if(offseason){
   const investment=Math.max(0,Math.min(finances*.12,150_000));finances=money(finances-investment,finances);
   facilities=integer(facilities+investment/90_000+(random()-.35),1,100,facilities);youth=integer(youth+investment/110_000+(random()-.4),1,100,youth);scouting=integer(scouting+investment/140_000+(random()-.45),1,100,scouting);
   strength=clamp(strength+(youth+facilities+manager.ability-150)/80+(random()-.5)*2,20,95,strength);
   if(club.manager.security<25&&random()>.35){manager={name:`${['Alex','Jordan','Casey','Morgan','Taylor'][Math.floor(random()*5)]} ${['Reid','Kelly','Singh','Martin','Costa'][Math.floor(random()*5)]}`,ability:integer(35+random()*50,1,100,50),security:70};events.push({season:state.season,week:state.week,type:'manager-change',text:`${manager.name} appointed as manager.`});}
  }
  manager.security=integer(manager.security+(club.form.filter(result=>result==='W').length-club.form.filter(result=>result==='L').length)*.5,0,100,manager.security);
  return {...club,finances,trajectory:round(trajectory,2),strength:integer(strength,20,95,club.strength),facilities,youth,scouting,manager,events:last(events,FOOTBALL_CAREER_LIMITS.aiEvents),seasonStats:seasonBoundary?{played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0}:club.seasonStats,form:seasonBoundary?[]:club.form};
 });
 return state;
}

export function generateTransferOffers(input,options={}){
 let state=normalizeCareerWorld(input),source=asObject(options),maximum=integer(source.maximum,1,8,3),clubs=asArray(source.clubs).length?asArray(source.clubs).map((club,index)=>normalizeAIClub(club,index,state.seed,state.season)):state.aiClubs;
 const eligible=state.players.filter(player=>['transfer-listed','loan-listed','available'].includes(player.transferStatus)&&player.status==='active');
 for(const player of eligible){
  if(state.transferOffers.filter(offer=>offer.playerId===player.id&&offer.status==='pending').length||state.transferOffers.filter(offer=>offer.createdSeason===state.season&&offer.createdWeek===state.week).length>=maximum)continue;
  const random=seededRandom(`${state.seed}|offer|${state.season}|${state.week}|${player.id}`);
  if(random()>.55&&!bool(source.force))continue;
  const club=clubs.length?clubs[Math.floor(random()*clubs.length)]:normalizeAIClub({id:`interested-${Math.floor(random()*99)}`,name:'Interested Club'},0,state.seed,state.season),loan=player.transferStatus==='loan-listed'||(player.transferStatus==='available'&&random()<.35),expires=addWeeks(state.season,state.week,2);
  const offer=normalizeOffer({id:makeId('offer',state,player.id),playerId:player.id,clubId:club.id,clubName:club.name,type:loan?'loan':'permanent',amount:loan?0:Math.round(player.marketValue*(.78+random()*.48)/1000)*1000,loanFee:loan?Math.round(player.marketValue*(.015+random()*.025)/100)*100:0,wageContribution:loan?integer(45+random()*55,0,100,70):0,optionalFee:loan&&random()<.5?Math.round(player.marketValue*(.8+random()*.25)/1000)*1000:0,status:'pending',createdSeason:state.season,createdWeek:state.week,expiresSeason:expires.season,expiresWeek:expires.week},state.transferOffers.length,state.season,state.week);
  state.transferOffers=last([...state.transferOffers,offer],FOOTBALL_CAREER_LIMITS.transferOffers);
  state=withInbox(state,{id:`transfer-${offer.id}`,relatedId:offer.id,kind:'transfer',title:`Offer for ${player.name}`,body:`${club.name} submitted a ${loan?'loan':'transfer'} offer${loan?` with ${offer.wageContribution}% wage coverage`:` worth $${offer.amount.toLocaleString('en-AU')}`}.`,priority:'high',expiresSeason:offer.expiresSeason,expiresWeek:offer.expiresWeek,actions:[{id:'accept',label:'Accept',tone:'positive',effects:{confidence:0,supporterTrust:player.contract.squadRole==='star'?-3:0}},{id:'reject',label:'Reject',tone:'neutral'},{id:'negotiate',label:'Negotiate',tone:'cautious'}]});
 }
 return state;
}

function isLoanEligible(player,direction){
 if(!player||TERMINAL_PLAYER_STATUSES.includes(player.status)||player.status==='loaned')return false;
 if(direction==='out')return player.status==='active'&&player.ownership==='owned';
 return player.status==='active'&&player.ownership!=='on-loan';
}

export function startPlayerLoan(input,playerId,terms={}){
 let state=normalizeCareerWorld(input),target=id(playerId,80,''),source=asObject(terms),player=state.players.find(entry=>entry.id===target);
 const direction=enumValue(source.direction,['in','out'],'out');
 if(!isLoanEligible(player,direction)||state.loans.some(loan=>loan.playerId===target&&loan.status==='active'))return state;
 const duration=integer(source.durationWeeks,1,80,20),end=addWeeks(state.season,state.week,duration);
 const loan=normalizeLoan({id:makeId('loan',state,`${target}|${source.clubId}`),playerId:target,clubId:source.clubId,clubName:source.clubName,direction,startSeason:state.season,startWeek:state.week,endSeason:end.season,endWeek:end.week,wageContribution:source.wageContribution,fee:source.fee,development:source.development,status:'active'},state.loans.length,state.season,state.week);
 state.loans=last([...state.loans,loan],FOOTBALL_CAREER_LIMITS.loans);state.players=state.players.map(entry=>entry.id===target?{...entry,status:direction==='out'?'loaned':'active',ownership:direction==='in'?'on-loan':entry.ownership,transferStatus:'not-listed'}:entry);
 if(direction==='out')state.competitions.registration.registeredPlayerIds=state.competitions.registration.registeredPlayerIds.filter(idValue=>idValue!==target);
 return withInbox(state,{kind:'loan',title:`Loan agreed for ${player.name}`,body:`${player.name} will ${direction==='out'?'join':'arrive from'} ${loan.clubName} until season ${loan.endSeason}, week ${loan.endWeek}.`,priority:'normal'});
}

export function recallPlayerLoan(input,loanId){
 let state=normalizeCareerWorld(input),target=id(loanId,80,''),playerId='';
 state.loans=state.loans.map(loan=>{if(loan.id!==target||loan.status!=='active'||loan.direction!=='out')return loan;playerId=loan.playerId;return {...loan,status:'recalled'};});
 if(playerId)state.players=state.players.map(player=>player.id===playerId&&player.status==='loaned'&&!TERMINAL_PLAYER_STATUSES.includes(player.status)?{...player,status:'active'}:player);
 return state;
}

export function respondToTransferOffer(input,offerId,response='reject'){
 let state=normalizeCareerWorld(input),target=id(offerId,80,''),choice=enumValue(response,['accept','reject','negotiate'],'reject'),selected=state.transferOffers.find(offer=>offer.id===target&&offer.status==='pending');
 if(!selected)return state;
 const player=state.players.find(item=>item.id===selected.playerId),message=state.inbox.find(item=>item.kind==='transfer'&&(item.relatedId===target||item.id===`transfer-${target}`)&&!item.resolved),messageAction=message?.actions.find(action=>action.id===choice),effects=messageAction?.effects||{confidence:0,supporterTrust:0};
 if(choice==='accept'&&(!player||TERMINAL_PLAYER_STATUSES.includes(player.status)||player.ownership!=='owned'))return state;
 if(choice==='accept'&&selected.type==='loan'&&!isLoanEligible(player,'out'))return state;
 if(choice==='negotiate'){
  const random=seededRandom(`${state.seed}|negotiate|${target}|${selected.negotiationRound}`),accepted=random()>.22&&selected.negotiationRound<3;
  state.transferOffers=state.transferOffers.map(offer=>offer.id===target?accepted?{...offer,amount:money(offer.amount*1.08,offer.amount,0),loanFee:money(offer.loanFee*1.08,offer.loanFee,0),wageContribution:integer(offer.wageContribution+5,0,100,offer.wageContribution),negotiationRound:offer.negotiationRound+1}:{...offer,status:'withdrawn'}:offer);
  const improved=state.transferOffers.find(offer=>offer.id===target);
  state.inbox=state.inbox.map(item=>item.id!==message?.id?item:accepted?{...item,title:`Improved offer for ${player?.name||'player'}`,body:selected.type==='loan'?`${selected.clubName} improved its loan terms to ${improved.wageContribution}% wage coverage.`:`${selected.clubName} improved its offer to $${improved.amount.toLocaleString('en-AU')}.`,read:false,resolved:false,resolution:''}:{...item,title:'Transfer negotiation ended',body:`${selected.clubName} withdrew from negotiations.`,read:true,resolved:true,resolution:'negotiate'});
  state.board.confidence=round(clamp(state.board.confidence+effects.confidence,0,100,state.board.confidence));state.board.supporterTrust=round(clamp(state.board.supporterTrust+effects.supporterTrust,0,100,state.board.supporterTrust));
  return state;
 }
 const status=choice==='accept'?'accepted':'rejected';state.transferOffers=state.transferOffers.map(offer=>offer.id===target?{...offer,status}:offer);
 if(choice==='accept'){
  if(selected.type==='loan')state=startPlayerLoan(state,selected.playerId,{clubId:selected.clubId,clubName:selected.clubName,direction:'out',durationWeeks:20,wageContribution:selected.wageContribution,fee:selected.loanFee});
  else{
   state.players=state.players.map(item=>item.id===selected.playerId?{...item,status:'transferred',ownership:'former',departureSeason:state.season,transferStatus:'not-listed',contract:{...item.contract,weeklyWage:0}}:item);
   state.competitions.registration.registeredPlayerIds=state.competitions.registration.registeredPlayerIds.filter(playerId=>playerId!==selected.playerId);
   state.history.records.recordTransferFeeReceived=Math.max(state.history.records.recordTransferFeeReceived,selected.amount);
  }
 }
 state.inbox=state.inbox.map(item=>item.id===message?.id?{...item,title:`Offer ${status}`,body:`The ${selected.type} offer from ${selected.clubName} was ${status}.`,read:true,resolved:true,resolution:choice}:item);
 state.board.confidence=round(clamp(state.board.confidence+effects.confidence,0,100,state.board.confidence));state.board.supporterTrust=round(clamp(state.board.supporterTrust+effects.supporterTrust,0,100,state.board.supporterTrust));
 return state;
}

export function createScoutingAssignment(input,details={}){
 let state=normalizeCareerWorld(input),source=asObject(details),type=enumValue(source.type,SCOUTING_TYPES,'player'),duration=integer(source.durationWeeks,1,8,2),due=addWeeks(state.season,state.week,duration);
 const region=text(source.region,60,'Queensland'),focus=enumValue(String(source.focus||'all').toLowerCase(),SCOUTING_FOCUSES,'all');
 let candidate=asObject(source.candidate),targetId=id(source.targetId||candidate.id,80,''),hasCandidateData=['name','position','age','rating','potential'].some(key=>hasOwn(candidate,key));
 if(type==='region'&&!targetId)targetId=`region-${id(region,45,'queensland')}-${focus}`;
 if(type==='region'&&!hasCandidateData){
  const random=seededRandom(`${state.seed}|region-assignment|${state.season}|${state.week}|${region}|${focus}|${targetId}`),positions=['GK','DF','MF','FW'],position={gk:'GK',df:'DF',mf:'MF',fw:'FW'}[focus]||positions[Math.floor(random()*positions.length)];
  const firstNames=['Ari','Bailey','Charlie','Dakota','Ellis','Frankie','Harper','Jordan'],lastNames=['Brown','Chen','Costa','Jones','Kelly','Nguyen','Reid','Singh'],age=focus==='youth'?integer(16+random()*4,15,20,18):integer(17+random()*10,15,45,21),rating=focus==='youth'?integer(42+random()*18,1,100,50):integer(44+random()*22,1,100,55),potentialBoost=focus==='youth'?20+random()*20:8+random()*22,potential=integer(rating+potentialBoost,rating,100,rating+12);
  candidate={id:`prospect-${hashString(`${state.seed}|${region}|${focus}|${state.season}|${state.week}|${targetId}`).toString(36)}`,name:`${firstNames[Math.floor(random()*firstNames.length)]} ${lastNames[Math.floor(random()*lastNames.length)]}`,position,age,rating,potential,marketValue:inferredValue({rating,potential,age},state.season),traits:[focus==='gk'?'Reflexes':focus==='df'?'Positioning':focus==='mf'?'Vision':focus==='fw'?'Movement':focus==='youth'?'Potential':'Work rate']};
 }
 if(type==='opponent'&&!targetId)targetId=id(source.clubId,80,'');
 if(!targetId||state.scouting.assignments.some(item=>item.targetId===targetId&&item.status==='active'))return state;
 const assignment=normalizeScoutingAssignment({...source,type,focus,region,candidate,id:makeId('assignment',state,targetId),targetId,targetName:source.targetName||(type==='region'?`${region} talent search`:source.clubName),startedSeason:state.season,startedWeek:state.week,dueSeason:due.season,dueWeek:due.week,status:'active'},state.scouting.assignments.length,state.season,state.week);
 state.scouting.assignments=last([...state.scouting.assignments,assignment],FOOTBALL_CAREER_LIMITS.scoutingAssignments);
 return withInbox(state,{kind:'scouting',title:'Scouting assignment started',body:`Scouts will report on ${assignment.targetName} in ${duration} week${duration===1?'':'s'}.`,priority:'normal'});
}

export function cancelScoutingAssignment(input,assignmentId){
 const state=normalizeCareerWorld(input),target=id(assignmentId,80,'');
 state.scouting.assignments=state.scouting.assignments.map(item=>item.id===target&&item.status==='active'?{...item,status:'cancelled'}:item);
 return state;
}

function completeScoutingAssignment(state,assignment){
 const candidate=assignment.candidate,durationWeeks=integer(absoluteWeek(assignment.dueSeason,assignment.dueWeek)-absoluteWeek(assignment.startedSeason,assignment.startedWeek),1,8,2),observationTier=durationWeeks>=8?2:durationWeeks>=4?1:0,effectiveQuality=clamp(assignment.scoutQuality+observationTier*12,1,100,assignment.scoutQuality),random=seededRandom(`${state.seed}|scout-report|${assignment.id}|${candidate.id||assignment.targetId}`),uncertainty=Math.max(1,Math.round((108-effectiveQuality)/10)),error=Math.round((random()-.5)*uncertainty);
 const centerRating=integer(candidate.rating+error,1,100,candidate.rating),centerPotential=integer(candidate.potential+Math.round((random()-.5)*uncertainty),1,100,candidate.potential),value=candidate.marketValue||inferredValue(candidate,state.season);
 const strengths=candidate.traits.length?candidate.traits:['Work rate','Ball retention','Decision making'],weaknessPool=['Consistency','Aerial duels','Positioning','Physicality','End product'];
 const recommendation=centerPotential>=75||centerRating>=70?'priority':centerPotential>=65||centerRating>=60?'shortlist':centerRating>=48?'monitor':'avoid';
 return normalizeScoutingReport({id:makeId('report',state,assignment.id),assignmentId:assignment.id,targetId:candidate.id||assignment.targetId,targetName:candidate.name||assignment.targetName,position:candidate.position,age:candidate.age,completedSeason:state.season,completedWeek:state.week,confidence:integer(assignment.scoutQuality*.78+10+observationTier*8+random()*4,1,100,50),ratingRange:[centerRating-uncertainty,centerRating+uncertainty],potentialRange:[centerPotential-uncertainty,centerPotential+uncertainty],valueRange:[value*(1-uncertainty/40),value*(1+uncertainty/35)],strengths:strengths.slice(0,3),weaknesses:[weaknessPool[Math.floor(random()*weaknessPool.length)]],recommendation,summary:`${candidate.name||assignment.targetName} projects as a ${recommendation} target after ${durationWeeks} weeks of observation. The remaining range reflects scouting uncertainty.`},state.scouting.reports.length,state.season,state.week);
}

export function createOpponentReport(input,opponent={}){
 let state=normalizeCareerWorld(input),source=asObject(opponent),clubId=id(source.id||source.clubId,80,'');
 if(!clubId)return state;
 const stored=state.aiClubs.find(club=>club.id===clubId),profile=stored||normalizeAIClub(source,0,state.seed,state.season),quality=integer(source.scoutQuality,1,100,60),uncertainty=Math.max(2,Math.round((105-quality)/12)),random=seededRandom(`${state.seed}|opponent|${state.season}|${state.week}|${clubId}`);
 const threats=profile.style==='high-press'?['Aggressive press','Fast turnovers']:profile.style==='direct'?['Aerial service','Second balls']:profile.style==='possession'?['Ball retention','Central overloads']:['Structured shape','Set pieces'];
 const weaknesses=profile.style==='high-press'?['Space behind the press']:profile.style==='low-block'?['Limited transition support']:profile.formation==='3-5-2'?['Space outside wing-backs']:['Can be stretched laterally'];
 const report=normalizeOpponentReport({id:makeId('opponent-report',state,clubId),clubId,clubName:profile.name,season:state.season,week:state.week,confidence:quality,formation:profile.formation,style:profile.style,strengthRange:[profile.strength-uncertainty,profile.strength+uncertainty],threats,weaknesses,summary:`${profile.name} usually use ${profile.formation} with a ${profile.style.replace('-', ' ')} approach. ${random()>.5?'Their recent trend is improving.':'Their recent form is mixed.'}`},state.scouting.opponentReports.length,state.season,state.week);
 state.scouting.opponentReports=last([...state.scouting.opponentReports.filter(item=>item.clubId!==clubId),report],FOOTBALL_CAREER_LIMITS.opponentReports);
 return withInbox(state,{kind:'scouting',title:`Opponent report: ${profile.name}`,body:report.summary,priority:'normal'});
}

export function addToScoutingShortlist(input,target={}){
 const state=normalizeCareerWorld(input),source=isObject(target)?target:{playerId:target},playerId=id(source.playerId||source.targetId||source.id,80,'');
 if(!playerId)return state;
 const existing=state.scouting.shortlist.find(item=>item.playerId===playerId),report=[...state.scouting.reports].reverse().find(item=>item.targetId===playerId),player=state.players.find(item=>item.id===playerId);
 const merged=existing?{...existing,...source,playerId,addedSeason:existing.addedSeason,addedWeek:existing.addedWeek}:{...source,playerId,name:source.name||source.targetName||report?.targetName||player?.name,position:source.position||report?.position||player?.primaryPosition,reportId:source.reportId||report?.id,addedSeason:state.season,addedWeek:state.week};
 const item=normalizeShortlistItem(merged,state.scouting.shortlist.length,state.season,state.week);
 state.scouting.shortlist=last(existing?state.scouting.shortlist.map(entry=>entry.playerId===playerId?item:entry):[...state.scouting.shortlist,item],FOOTBALL_CAREER_LIMITS.shortlist);
 return state;
}

export function removeFromScoutingShortlist(input,playerId){
 const state=normalizeCareerWorld(input),target=id(playerId,80,'');
 state.scouting.shortlist=state.scouting.shortlist.filter(item=>item.playerId!==target);
 return state;
}

export function getScoutingView(input){
 const state=normalizeCareerWorld(input);
 return {assignments:state.scouting.assignments.map(({candidate,...assignment})=>assignment),reports:[...state.scouting.reports].reverse(),opponentReports:[...state.scouting.opponentReports].reverse(),shortlist:[...state.scouting.shortlist],active:state.scouting.assignments.filter(item=>item.status==='active').length};
}

export function setClubIdentity(input,patch={}){
 const state=normalizeCareerWorld(input),source=asObject(patch);
 state.identity={...state.identity,nickname:source.nickname===undefined?state.identity.nickname:text(source.nickname,50,''),motto:source.motto===undefined?state.identity.motto:text(source.motto,100,''),values:source.values===undefined?state.identity.values:unique(asArray(source.values).map(value=>enumValue(value,VALID_VALUES,'community'))).slice(0,3)};
 return state;
}

export function registerRivalry(input,rival={}){
 const state=normalizeCareerWorld(input),source=asObject(rival),targetId=id(source.clubId,80,'');
 if(!targetId)return state;
 const existing=state.identity.rivalries.find(entry=>entry.clubId===targetId),item=normalizeRivalry(existing?{...existing,...source}:source,state.identity.rivalries.length);
 if(!item.clubId||item.clubId===state.clubId)return state;
 state.identity.rivalries=last(existing?state.identity.rivalries.map(entry=>entry.clubId===item.clubId?item:entry):[...state.identity.rivalries,item],FOOTBALL_CAREER_LIMITS.rivalries);
 return state;
}

export function recordRivalryResult(input,clubId,result={}){
 let state=normalizeCareerWorld(input),target=id(clubId,80,''),source=asObject(result),gf=integer(source.goalsFor,0,50,0),ga=integer(source.goalsAgainst,0,50,0),outcome=gf>ga?'W':gf<ga?'L':'D',changed=false;
 state.identity.rivalries=state.identity.rivalries.map(rival=>{
  if(rival.clubId!==target)return rival;changed=true;
  return {...rival,played:rival.played+1,wins:rival.wins+(outcome==='W'?1:0),draws:rival.draws+(outcome==='D'?1:0),losses:rival.losses+(outcome==='L'?1:0),goalsFor:rival.goalsFor+gf,goalsAgainst:rival.goalsAgainst+ga,lastResult:`${outcome} ${gf}-${ga}`,intensity:integer(rival.intensity+(outcome==='D'?1:2),1,100,rival.intensity)};
 });
 if(changed)state=applyClubSentimentEvent(state,{type:outcome==='W'?'derby-win':outcome==='L'?'derby-loss':'draw'});
 return state;
}

export function recordAIClubResult(input,clubId,result={}){
 const state=normalizeCareerWorld(input),target=id(clubId,80,''),source=asObject(result),gf=integer(source.goalsFor,0,50,0),ga=integer(source.goalsAgainst,0,50,0),outcome=gf>ga?'W':gf<ga?'L':'D';
 state.aiClubs=state.aiClubs.map(club=>club.id===target?{...club,seasonStats:{played:club.seasonStats.played+1,wins:club.seasonStats.wins+(outcome==='W'?1:0),draws:club.seasonStats.draws+(outcome==='D'?1:0),losses:club.seasonStats.losses+(outcome==='L'?1:0),goalsFor:club.seasonStats.goalsFor+gf,goalsAgainst:club.seasonStats.goalsAgainst+ga,points:club.seasonStats.points+(outcome==='W'?3:outcome==='D'?1:0)},form:last([...club.form,outcome],6),manager:{...club.manager,security:integer(club.manager.security+(outcome==='W'?2:outcome==='L'?-2:0),0,100,club.manager.security)}}:club);
 return state;
}

export function recordClubMatch(input,match={}){
 const source=asObject(match),signature=`${source.season??asObject(input).season}|${source.week??asObject(input).week}|${source.competition}|${source.opponentId}|${source.venue}|${source.goalsFor}|${source.goalsAgainst}`;
 let state=normalizeCareerWorld(input),item=normalizeMatch({...source,id:source.id||`match-${hashString(`${asObject(input).seed||'football-career'}|${signature}`).toString(36)}`,season:source.season??state.season,week:source.week??state.week},state.history.matches.length,state.season,state.week),records={...state.history.records};
 const existingIndex=state.history.matches.findIndex(entry=>entry.id===item.id);
 if(existingIndex>=0){if(item.report){state.history.matches=state.history.matches.map((entry,index)=>index===existingIndex?{...entry,report:item.report}:entry);const reportStart=Math.max(0,state.history.matches.length-FOOTBALL_CAREER_LIMITS.matchReports);state.history.matches=state.history.matches.map((entry,index)=>index<reportStart?stripMatchReport(entry):entry)}return state}
 state.history.matches=last([...state.history.matches,item],FOOTBALL_CAREER_LIMITS.matches);
 const reportStart=Math.max(0,state.history.matches.length-FOOTBALL_CAREER_LIMITS.matchReports);state.history.matches=state.history.matches.map((entry,index)=>index<reportStart?stripMatchReport(entry):entry);
 const margin=item.goalsFor-item.goalsAgainst,recordItem=stripMatchReport(item);
 if(margin>0&&(!records.biggestWin||margin>records.biggestWin.goalsFor-records.biggestWin.goalsAgainst))records.biggestWin=recordItem;
 if(margin<0&&(!records.biggestLoss||margin<records.biggestLoss.goalsFor-records.biggestLoss.goalsAgainst))records.biggestLoss=recordItem;
 if(!records.highestAttendance||item.attendance>records.highestAttendance.attendance)records.highestAttendance=recordItem;
 records.currentWinningRun=item.result==='W'?records.currentWinningRun+1:0;records.longestWinningRun=Math.max(records.longestWinningRun,records.currentWinningRun);
 records.currentUnbeatenRun=item.result!=='L'?records.currentUnbeatenRun+1:0;records.longestUnbeatenRun=Math.max(records.longestUnbeatenRun,records.currentUnbeatenRun);state.history.records=records;
 state=applyClubSentimentEvent(state,{type:item.result==='W'?'win':item.result==='L'?'loss':'draw'});
 if(state.identity.rivalries.some(rival=>rival.clubId===item.opponentId))state=recordRivalryResult(state,item.opponentId,item);
 if(state.aiClubs.some(club=>club.id===item.opponentId))state=recordAIClubResult(state,item.opponentId,{goalsFor:item.goalsAgainst,goalsAgainst:item.goalsFor});
 return state;
}

export function archiveCareerSeason(input,summary={}){
 let state=normalizeCareerWorld(input),source=asObject(summary),season=integer(source.season,MIN_SEASON,MAX_SEASON,state.season);
 const record={season,divisionId:id(source.divisionId,60,''),leaguePosition:integer(source.leaguePosition,1,30,12),played:integer(source.played,0,100,0),wins:integer(source.wins,0,100,0),draws:integer(source.draws,0,100,0),losses:integer(source.losses,0,100,0),goalsFor:integer(source.goalsFor,0,500,0),goalsAgainst:integer(source.goalsAgainst,0,500,0),points:integer(source.points,0,300,0),cupResult:text(source.cupResult,70,'Not entered'),academyRating:text(source.academyRating,60,''),cashBalance:money(source.cashBalance,0),summary:text(source.summary,300,'')};
 const alreadyArchived=state.history.seasons.some(item=>item.season===season);
 state.history.seasons=last([...state.history.seasons.filter(item=>item.season!==season),record],FOOTBALL_CAREER_LIMITS.seasons);
 if(alreadyArchived)return state;
 state.players=state.players.map(player=>{
  const former=TERMINAL_PLAYER_STATUSES.includes(player.status)||player.ownership==='former',hasSeason=player.history.some(entry=>entry.season===season);
  if(former&&player.departureSeason!==season)return player;
  const history=hasSeason?player.history:last([...player.history,{season,club:text(source.clubName,80,''),competition:text(source.competition,70,'League'),stats:player.seasonStats}],FOOTBALL_CAREER_LIMITS.playerHistory);
  if(former)return {...player,history,seasonStats:emptyStats()};
  return {...player,history,seasonStats:emptyStats(),departureSeason:null,age:integer(player.age+1,15,50,player.age),marketValue:money(player.marketValue*(player.age<29?1.02:.94),player.marketValue,0)};
 });
 state.squadDynamics=normalizeSquadDynamics(state.squadDynamics,state.players,state.seed,state.season,state.week);
 return state;
}

export function addClubTrophy(input,trophy={}){
 let state=normalizeCareerWorld(input),source=asObject(trophy),name=text(source.name,90,'Trophy'),season=integer(source.season,MIN_SEASON,MAX_SEASON,state.season),trophyId=id(source.id,80,`trophy-${season}-${id(name,40,'honour')}`);
 if(state.history.trophies.some(item=>item.id===trophyId))return state;
 state.history.trophies=last([...state.history.trophies,{id:trophyId,season,name,competition:text(source.competition,80,name),level:text(source.level,50,'Senior')}],FOOTBALL_CAREER_LIMITS.trophies);
 state=applyClubSentimentEvent(state,{type:'trophy'});
 return withInbox(state,{kind:'competition',title:`${name} won`,body:`The club added ${name} to its honours in ${season}.`,priority:'high'});
}

export function setMatchdayPlan(input,patch={}){
 const state=normalizeCareerWorld(input);state.matchday.plan=normalizeMatchdayPlan({...state.matchday.plan,...asObject(patch)});return state;
}

function forecastWeather(state,context={}){
 const source=asObject(context),climate=enumValue(source.climate,['subtropical','coastal','inland','temperate'],'subtropical'),random=seededRandom(`${state.seed}|weather|${state.season}|${state.week}|${text(source.venueId,80,'home')}`);
 const summer=state.week<=8||state.week>=36,baseTemp=climate==='inland'?(summer?31:20):climate==='temperate'?(summer?25:15):(summer?29:22),rainBase=climate==='coastal'||climate==='subtropical'?(summer?48:25):(summer?25:15);
 const rainChance=integer(rainBase+(random()-.5)*30,0,100,rainBase),windKph=integer(5+random()*30,0,150,10),temperature=round(baseTemp+(random()-.5)*8),roll=random();
 let condition=rainChance>70&&roll<.45?'heavy-rain':rainChance>40&&roll<.55?'showers':temperature>=33?'hot':windKph>27?'windy':roll<.35?'partly-cloudy':roll<.55?'overcast':'clear';
 return {condition,temperature,rainChance,windKph};
}

export function previewMatchdayOperations(input,fixture={}){
 const state=normalizeCareerWorld(input),source=asObject(fixture),plan=normalizeMatchdayPlan({...state.matchday.plan,...asObject(source.plan)}),isHome=source.venue!=='away'&&source.venue!=='neutral',capacity=integer(source.capacity,100,500_000,5_000),baseAttendance=integer(source.baseAttendance,0,capacity,Math.round(capacity*.55)),opponentReputation=integer(source.opponentReputation,1,100,50),importance=clamp(source.importance,.5,2,1),isRival=bool(source.isRival,state.identity.rivalries.some(rival=>rival.clubId===id(source.opponentId,80,''))),weather=forecastWeather(state,source),priceElasticity=isHome?Math.pow(Math.max(.35,22/Math.max(5,plan.ticketPrice)),.42):1,weatherFactor=weather.condition==='heavy-rain'?.72:weather.condition==='showers'?.88:weather.condition==='hot'?.91:1,promotionFactor=isHome?1+Math.min(.18,plan.promotionSpend/8_000):1,trustFactor=.72+state.board.supporterTrust/180,opponentFactor=.78+opponentReputation/180,rivalFactor=isRival?1.18:1;
 const attendance=Math.min(capacity,Math.max(0,Math.round(baseAttendance*priceElasticity*weatherFactor*promotionFactor*trustFactor*opponentFactor*rivalFactor*importance))),hospitalityCapacity=isHome?integer(source.hospitalityCapacity,0,capacity,Math.round(capacity*.035)):0,hospitalitySold=Math.min(hospitalityCapacity,Math.round(hospitalityCapacity*(.42+opponentReputation/180+(isRival?.16:0)))),ticketRevenue=isHome?money(attendance*plan.ticketPrice,0,0):0,hospitalityRevenue=isHome?money(hospitalitySold*plan.hospitalityPrice,0,0):0,concessionRevenue=isHome?money(attendance*plan.concessionSpend*.56,0,0):0,travelKm=round(clamp(source.travelKm,0,10_000,0)),travelCost=money(travelKm*(source.venue==='away'?7.5:1.2)+(travelKm>250?integer(source.travelParty,12,80,32)*95:0),0,0),homeOperatingCost=isHome?plan.staffing*900+plan.security*700+plan.pitchPrep*800+plan.promotionSpend:0,operatingCost=money(homeOperatingCost+plan.transportSubsidy+travelCost,0,0),pitchBefore=integer(source.pitchCondition,0,100,isHome?state.matchday.pitchCondition:70),rainWear=isHome?(weather.condition==='heavy-rain'?12:weather.condition==='showers'?7:3):0,pitchAfter=isHome?integer(pitchBefore-rainWear+plan.pitchPrep*2,0,100,pitchBefore):pitchBefore,satisfaction=integer(48+state.board.supporterTrust*.25+(isHome?(22-plan.ticketPrice)*.65:0)+plan.transportSubsidy/400+(isRival?5:0)-(weather.condition==='heavy-rain'?7:0),0,100,60);
 const suppliedFixtureId=id(source.fixtureId||source.id,80,''),fixtureIdentity=`${suppliedFixtureId||`${state.season}|${state.week}|${id(source.opponentId,80,'fixture')}`}|${text(source.competition,70,'League')}|${source.venue||'home'}`;
 return normalizeMatchdayReport({id:`matchday-${hashString(`${state.seed}|${fixtureIdentity}`).toString(36)}`,fixtureId:suppliedFixtureId,season:state.season,week:state.week,competition:source.competition,venue:source.venue,opponentId:source.opponentId,opponentName:source.opponentName,attendance,capacity,weather,pitchConditionBefore:pitchBefore,pitchConditionAfter:pitchAfter,ticketRevenue,hospitalityRevenue,concessionRevenue,travelCost,operatingCost,netRevenue:ticketRevenue+hospitalityRevenue+concessionRevenue-operatingCost,satisfaction},state.matchday.reports.length,state.season,state.week);
}

export function settleMatchdayOperations(input,fixture={}){
 let state=normalizeCareerWorld(input),report=previewMatchdayOperations(state,fixture);
 if(state.matchday.reports.some(item=>item.id===report.id))return state;
 state.matchday.reports=last([...state.matchday.reports,report],FOOTBALL_CAREER_LIMITS.matchdayReports);if(report.venue==='home')state.matchday.pitchCondition=report.pitchConditionAfter;
 const priceDelta=report.venue==='home'?(state.matchday.plan.ticketPrice>28?-2:state.matchday.plan.ticketPrice<18?1:0):0,satisfactionDelta=(report.satisfaction-60)/20;
 state.board.supporterTrust=round(clamp(state.board.supporterTrust+priceDelta+satisfactionDelta,0,100,state.board.supporterTrust));
 return withInbox(state,{kind:'matchday',title:'Matchday operations report',body:`Attendance was ${report.attendance.toLocaleString('en-AU')} and operations returned ${report.netRevenue<0?'-':''}$${Math.abs(report.netRevenue).toLocaleString('en-AU')} net.`,priority:report.netRevenue<0?'high':'normal'});
}

function progressMedicalAndSquad(state,seasonBoundary=false){
 const returned=[];
 state.players=state.players.map(player=>{
  let discipline=seasonBoundary?{...player.discipline,season:state.season,yellowCards:0,nextThreshold:5,lastCardSeason:null,lastCardWeek:null}:player.discipline,medical=player.medical,status=player.status;
  if(medical.injury){
   const injury=medical.injury,random=seededRandom(`${state.seed}|rehab|${state.season}|${state.week}|${player.id}|${injury.id}`),accelerated=injury.rehabPlan==='intensive'&&injury.weeksRemaining>1&&random()<.35,progress=accelerated?2:1,remaining=Math.max(0,injury.weeksRemaining-progress),fitness=integer(medical.fitness+(injury.rehabPlan==='conservative'?8:injury.rehabPlan==='intensive'?11:9),0,100,medical.fitness),risk=integer(injury.recurrenceRisk+(injury.rehabPlan==='intensive'&&accelerated?2:injury.rehabPlan==='conservative'?-1:0),0,100,injury.recurrenceRisk);
   if(remaining===0){medical={...medical,fitness:Math.max(75,fitness),matchSharpness:integer(medical.matchSharpness-8,0,100,medical.matchSharpness),injury:null,lastInjury:{type:injury.type,bodyArea:injury.bodyArea,resolvedSeason:state.season,resolvedWeek:state.week,recurrenceRisk:risk}};status=player.status==='loaned'?'loaned':discipline.suspensionMatchesRemaining?'suspended':'active';returned.push({id:player.id,name:player.name,injury:injury.type});}
   else{const returnAt=addWeeks(state.season,state.week,remaining);medical={...medical,fitness,injury:{...injury,weeksRemaining:remaining,returnSeason:returnAt.season,returnWeek:returnAt.week,recurrenceRisk:risk,rehabStatus:remaining===1?'return-to-training':'rehabilitation'}};if(player.status!=='loaned')status='injured';}
  }else medical={...medical,fitness:integer(medical.fitness+3,0,100,medical.fitness),matchSharpness:integer(medical.matchSharpness+2,0,100,medical.matchSharpness)};
  const availability=status==='active'?{available:true,status:'available',reason:'available',estimatedReturnSeason:null,estimatedReturnWeek:null}:status==='injured'&&medical.injury?{available:false,status:'injured',reason:medical.injury.type,estimatedReturnSeason:medical.injury.returnSeason,estimatedReturnWeek:medical.injury.returnWeek}:{available:false,status,reason:discipline.suspensionMatchesRemaining?discipline.reason:status,estimatedReturnSeason:null,estimatedReturnWeek:null};
  return {...player,discipline,medical,status,availability};
 });
 if(state.week%4===0){
  const playersById=new Map(state.players.map(player=>[player.id,player]));
  for(const group of state.squadDynamics.mentoringGroups){const mentor=playersById.get(group.mentorId);if(!mentor)continue;for(const menteeId of group.menteeIds){state.players=state.players.map(player=>{if(player.id!==menteeId)return player;const key=group.focus==='development'?null:group.focus,profile=key?{...player.personalityProfile,[key]:integer(player.personalityProfile[key]+(mentor.personalityProfile[key]>=70?1:0),1,100,player.personalityProfile[key])}:player.personalityProfile;return {...player,personalityProfile:{...profile,label:personalityLabel(profile)},development:group.focus==='development'?round(clamp(player.development+.15,-10,10,player.development)):player.development}})}}
 }
 for(const item of returned.slice(0,4))state=withInbox(state,{id:`medical-clearance-${state.season}-${state.week}-${item.id}`,kind:'player',title:`Medical clearance: ${item.name}`,body:`${item.name} has completed rehabilitation for ${item.injury} and is available subject to match fitness and any suspension.`,priority:'normal',relatedId:item.id});
 return state;
}

function progressPromisesAndNegotiations(state){
 const now=absoluteWeek(state.season,state.week),resolutions=[];
 state.squadDynamics.promises=state.squadDynamics.promises.map(promise=>{
  if(promise.status!=='active')return promise;const player=state.players.find(item=>item.id===promise.playerId);if(!player)return {...promise,status:'cancelled',resolvedSeason:state.season,resolvedWeek:state.week,resolutionNote:'Player left the club'};
  let progress=promise.progress;if(promise.type==='playing-time')progress=Math.max(progress,player.seasonStats.appearances);if(promise.type==='development')progress=Math.max(progress,Math.max(0,player.development));if(promise.type==='squad-role'&&promise.targetRole&&player.contract.squadRole===promise.targetRole)progress=Math.max(progress,promise.target);if(promise.type==='captaincy'&&state.squadDynamics.captainId===player.id)progress=Math.max(progress,promise.target);if(promise.type==='new-contract'&&player.contract.signedSeason===state.season)progress=Math.max(progress,promise.target);if(promise.type==='transfer'&&player.transferStatus!=='not-listed')progress=Math.max(progress,promise.target);
  if(progress>=promise.target){resolutions.push({...promise,outcome:'fulfilled'});return {...promise,progress,status:'fulfilled',resolvedSeason:state.season,resolvedWeek:state.week,resolutionNote:'Target achieved'}}
  if(absoluteWeek(promise.dueSeason,promise.dueWeek)<=now){resolutions.push({...promise,outcome:'broken'});return {...promise,progress,status:'broken',resolvedSeason:state.season,resolvedWeek:state.week,resolutionNote:'Deadline passed'}}
  return {...promise,progress};
 });
 for(const promise of resolutions.slice(0,6)){state=recordPlayerReaction(state,promise.playerId,{type:promise.outcome==='fulfilled'?'positive':promise.moraleImpact>=9?'angry':'unhappy',intensity:promise.outcome==='fulfilled'?Math.max(2,Math.ceil(promise.moraleImpact/2)):promise.moraleImpact,reason:`Promise ${promise.outcome}: ${promise.detail}`});state=withInbox(state,{id:`promise-weekly-${promise.id}-${promise.outcome}`,kind:'player',title:`Player promise ${promise.outcome}`,body:`${state.players.find(player=>player.id===promise.playerId)?.name||'Player'}: ${promise.detail}.`,priority:promise.outcome==='broken'?'high':'normal',relatedId:promise.playerId})}
 const expired=[];state.contractNegotiations=state.contractNegotiations.map(session=>{if(!['awaiting-club','countered'].includes(session.status)||absoluteWeek(session.expiresSeason,session.expiresWeek)>now)return session;expired.push(session);return {...session,status:'expired',resolution:'Negotiation deadline passed',history:last([...session.history,{round:session.round,by:'system',outcome:'expired',season:state.season,week:state.week,terms:null,note:'Negotiation expired'}],FOOTBALL_CAREER_LIMITS.negotiationHistory)}});
 for(const session of expired.slice(0,4)){state=recordPlayerReaction(state,session.playerId,{type:'unhappy',intensity:5,reason:'Contract talks expired without agreement'});state=withInbox(state,{id:`contract-expired-${session.id}`,kind:'contract',title:'Contract talks expired',body:`Negotiations with ${state.players.find(player=>player.id===session.playerId)?.name||'the player'} expired without an agreement.`,priority:'high',relatedId:session.id})}
 return refreshSquadDynamics(state);
}

function expireOffersAndLoans(state){
 const now=absoluteWeek(state.season,state.week),completedOutbound=new Map(),completedInbound=new Map();
 state.transferOffers=state.transferOffers.map(offer=>offer.status==='pending'&&absoluteWeek(offer.expiresSeason,offer.expiresWeek)<now?{...offer,status:'expired'}:offer);
 state.loans=state.loans.map(loan=>{
  if(loan.status!=='active'||absoluteWeek(loan.endSeason,loan.endWeek)>=now)return loan;
  if(loan.direction==='out')completedOutbound.set(loan.playerId,loan.development);else completedInbound.set(loan.playerId,loan.endSeason);
  return {...loan,status:'completed'};
 });
 state.players=state.players.map(player=>{
  if(completedOutbound.has(player.id)&&player.status==='loaned'&&!TERMINAL_PLAYER_STATUSES.includes(player.status))return {...player,status:'active',development:round(clamp(player.development+completedOutbound.get(player.id),-10,10,player.development))};
  if(completedInbound.has(player.id)&&player.ownership==='on-loan'&&!TERMINAL_PLAYER_STATUSES.includes(player.status))return {...player,status:'transferred',ownership:'former',departureSeason:completedInbound.get(player.id),transferStatus:'not-listed',contract:{...player.contract,weeklyWage:0}};
  return player;
 });
 const expiredContractIds=new Set(state.players.filter(player=>!TERMINAL_PLAYER_STATUSES.includes(player.status)&&absoluteWeek(player.contract.expiresSeason,player.contract.expiresWeek)<now).map(player=>player.id));
 if(expiredContractIds.size){
   state.players=state.players.map(player=>expiredContractIds.has(player.id)?{...player,status:'released',ownership:'former',departureSeason:player.contract.expiresSeason,transferStatus:'not-listed',contract:{...player.contract,weeklyWage:0}}:player);
  state=withInbox(state,{id:`expired-contracts-${state.season}-${state.week}`,kind:'contract',title:'Contracts expired',body:`${[...expiredContractIds].length} player contract${expiredContractIds.size===1?' has':'s have'} ended and the affected player${expiredContractIds.size===1?' is':'s are'} no longer registered.`,priority:'high'});
 }
 if(completedInbound.size||expiredContractIds.size)state.competitions.registration.registeredPlayerIds=state.competitions.registration.registeredPlayerIds.filter(playerId=>!completedInbound.has(playerId)&&!expiredContractIds.has(playerId));
 return state;
}

function finishScouting(state){
 const now=absoluteWeek(state.season,state.week),completed=[],completedAssignmentIds=[];
 for(const assignment of [...state.scouting.assignments]){
  if(assignment.status!=='active'||absoluteWeek(assignment.dueSeason,assignment.dueWeek)>now)continue;
  if(assignment.type==='opponent'){
   if(!state.scouting.opponentReports.some(report=>report.clubId===assignment.targetId))state=createOpponentReport(state,{id:assignment.targetId,clubId:assignment.targetId,clubName:assignment.targetName,scoutQuality:assignment.scoutQuality});
   completedAssignmentIds.push(assignment.id);continue;
  }
  const existing=state.scouting.reports.find(item=>item.assignmentId===assignment.id);
  if(existing){completedAssignmentIds.push(assignment.id);continue}
  const report=completeScoutingAssignment(state,assignment);state.scouting.reports.push(report);completed.push(report);completedAssignmentIds.push(assignment.id);
 }
 state.scouting.assignments=state.scouting.assignments.map(assignment=>completedAssignmentIds.includes(assignment.id)?{...assignment,status:'completed'}:assignment);
 state.scouting.reports=last(state.scouting.reports,FOOTBALL_CAREER_LIMITS.scoutingReports);
 for(const report of completed)state=withInbox(state,{id:`scouting-${report.id}`,kind:'scouting',title:`Scouting report: ${report.targetName}`,body:report.summary,priority:report.recommendation==='priority'?'high':'normal'});
 return state;
}

function weeklyMessages(state,context={}){
 let next=state,current=state.calendar.current;
 if(current.registrationOpen&&(state.week===1||state.week===23))next=withInbox(next,{id:`registration-open-${state.season}-${state.week}`,kind:'calendar',title:'Registration window open',body:'Players may now be registered for competitive fixtures.',priority:'high'});
 if(state.week===8||state.week===26)next=withInbox(next,{id:`registration-close-${state.season}-${state.week}`,kind:'calendar',title:'Registration deadline this week',body:'Resolve transfers, loans and squad registration before the window closes.',priority:'urgent'});
 if(current.events.length)next=withInbox(next,{id:`calendar-${state.season}-${state.week}`,kind:'calendar',title:current.events[0].label,body:`${current.events.map(event=>event.label).join(', ')} is scheduled in week ${state.week}.`,priority:current.events.some(event=>event.type==='cup')?'high':'normal'});
 const reminderThresholds=new Set([8,4,1,0]),now=absoluteWeek(state.season,state.week),expiring=state.players.filter(player=>player.status==='active'&&reminderThresholds.has(absoluteWeek(player.contract.expiresSeason,player.contract.expiresWeek)-now));
 if(expiring.length)next=withInbox(next,{id:`contracts-${state.season}-${state.week}`,kind:'contract',title:'Contracts nearing expiry',body:`${expiring.slice(0,4).map(player=>player.name).join(', ')} ${expiring.length===1?'has reached':'have reached'} a contract decision checkpoint (8, 4, or 1 week remaining, or deadline week).`,priority:'high'});
 if(state.week%4===0&&asObject(context).metrics)next=reviewBoardPerformance(next,asObject(context).metrics);
 return next;
}

function processSingleWeek(input,season,week,context={}){
 const previousSeason=integer(asObject(input).season,MIN_SEASON,MAX_SEASON,season),seasonBoundary=week===1&&season>previousSeason;
 let state=normalizeCareerWorld(input,{season,week});state.lastTickKey=`${season}-${week}`;state=expireOffersAndLoans(state);state=finishScouting(state);
 if(seasonBoundary){
  state.competitions.registration={...state.competitions.registration,season,registeredPlayerIds:[],lastChangedSeason:season,lastChangedWeek:week};
  state.competitions.cup=normalizeCup({id:state.competitions.cup.id,name:state.competitions.cup.name,season,status:'not-entered'},season,week,state.calendar.cupName);
 }
 state=progressMedicalAndSquad(state,seasonBoundary);state=progressPromisesAndNegotiations(state);
 state.matchday.pitchCondition=integer(state.matchday.pitchCondition+2,0,100,state.matchday.pitchCondition);
 state=evolveAIClubs(state,{weeks:1,offseason:week===32,seasonBoundary});
 state=weeklyMessages(state,context);
 return state;
}

export function tickCareerWorld(input,context={}){
 let state=normalizeCareerWorld(input),source=asObject(context),target;
 if(source.season!==undefined||source.week!==undefined)target={season:integer(source.season,MIN_SEASON,MAX_SEASON,state.season),week:integer(source.week,1,40,state.week)};
 else target=addWeeks(state.season,state.week,1);
 const start=absoluteWeek(state.season,state.week),end=absoluteWeek(target.season,target.week);
 if(end<=start)return state;
 const steps=Math.min(120,end-start);
 for(let offset=1;offset<=steps;offset+=1){const point=weekFromAbsolute(start+offset);state=processSingleWeek(state,point.season,point.week,source)}
 if(end-start>steps)state=normalizeCareerWorld(state,{season:target.season,week:target.week});
 return state;
}
