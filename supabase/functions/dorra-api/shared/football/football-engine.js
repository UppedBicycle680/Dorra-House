import {
 ACADEMY_FEE_BANDS,
 ACADEMY_RANKINGS_2026,
 A_LEAGUE_CLUBS_2026_27,
 FACILITY_UPGRADES,
 FOOTBALL_GAME_ASSUMPTIONS,
 FOOTBALL_OBJECTIVES,
 FOOTBALL_TOKEN_REWARDS,
 FORMATION_PROFILES,
 PLAYING_STYLES,
 SENIOR_DIVISIONS,
 SENIOR_LEAGUE_ROSTERS_2026,
 STAFF_ROLES,
 START_SITES,
 TRAINING_SESSION_EFFECTS,
 TRAINING_INTENSITIES,
 getFacility,
 getPlayingStyle,
 getSeniorDivision,
 getSeniorRoster,
 getStaffRole,
 getStartSite
} from './football-data.js';

import {
 FOOTBALL_DEVELOPMENT_FOCUSES,
 addToScoutingShortlist as careerAddToScoutingShortlist,
 addClubTrophy as careerAddClubTrophy,
 archiveCareerSeason,
 cancelFriendly as careerCancelFriendly,
 cancelScoutingAssignment as careerCancelScoutingAssignment,
 createCareerWorld,
 createOpponentReport as careerCreateOpponentReport,
 createScoutingAssignment as careerCreateScoutingAssignment,
 enterCup as careerEnterCup,
 generateTransferOffers as careerGenerateTransferOffers,
 getCalendarWeek as careerGetCalendarWeek,
 getCompetitionHub as careerGetCompetitionHub,
 getDecisionHub as careerGetDecisionHub,
 getScoutingView as careerGetScoutingView,
 markInboxRead as careerMarkInboxRead,
 normalizeCareerWorld,
 previewMatchdayOperations as careerPreviewMatchdayOperations,
 recallPlayerLoan as careerRecallPlayerLoan,
 recordAIClubResult,
 recordClubMatch,
 recordCupResult as careerRecordCupResult,
 recordFriendlyResult as careerRecordFriendlyResult,
 recordPlayerAppearance,
 recordTransferFeePaid as careerRecordTransferFeePaid,
 registerPlayerForCompetition as careerRegisterPlayerForCompetition,
 releasePlayer as careerReleasePlayer,
 renewPlayerContract as careerRenewPlayerContract,
 resolveInboxDecision as careerResolveInboxDecision,
 respondToTransferOffer as careerRespondToTransferOffer,
 scheduleFriendly as careerScheduleFriendly,
 setBoardExpectations as careerSetBoardExpectations,
 setClubIdentity as careerSetClubIdentity,
 setMatchdayPlan as careerSetMatchdayPlan,
 setPlayerDevelopmentFocus as careerSetPlayerDevelopmentFocus,
 setPlayerTransferStatus as careerSetPlayerTransferStatus,
 setCaptaincy as careerSetCaptaincy,
 createMentoringGroup as careerCreateMentoringGroup,
 removeMentoringGroup as careerRemoveMentoringGroup,
 createPlayerPromise as careerCreatePlayerPromise,
 resolvePlayerPromise as careerResolvePlayerPromise,
 reportPlayerInjury as careerReportPlayerInjury,
 setPlayerRehabilitation as careerSetPlayerRehabilitation,
 recordPlayerDiscipline as careerRecordPlayerDiscipline,
 servePlayerSuspension as careerServePlayerSuspension,
 startContractNegotiation as careerStartContractNegotiation,
 submitContractOffer as careerSubmitContractOffer,
 withdrawContractNegotiation as careerWithdrawContractNegotiation,
 settleMatchdayOperations,
 startPlayerLoan as careerStartPlayerLoan,
 registerRivalry as careerRegisterRivalry,
 syncAIClubs,
 tickCareerWorld,
 unregisterPlayerFromCompetition as careerUnregisterPlayerFromCompetition,
 removeFromScoutingShortlist as careerRemoveFromScoutingShortlist
} from './football-career.js';

import {
 createFootballOperations,
 normalizeFootballOperations,
 getPeopleView as operationsGetPeopleView,
 getCommercialView as operationsGetCommercialView,
 hireStaffMember as operationsHireStaffMember,
 dismissStaffMember as operationsDismissStaffMember,
 renewStaffContract as operationsRenewStaffContract,
 setDelegation as operationsSetDelegation,
 respondToSponsorOffer as operationsRespondToSponsorOffer,
 setCommercialPlan as operationsSetCommercialPlan,
 tickFootballOperations
} from './football-operations.js';

export const FOOTBALL_SCHEMA_VERSION=10;
export const FOOTBALL_WEEK_MS=7*24*60*60*1000;
export const PLAYER_FIRST_TEAM_ID='player-first';
export const PLAYER_B_TEAM_ID='player-b';
export const PLAYER_U23_TEAM_ID='player-u23';
export const PLAYER_ACADEMY_TEAM_ID='player-academy';
export const ACADEMY_AGE_GROUPS=Object.freeze(['u13','u14','u15','u16','u18']);
export const ACADEMY_MATCH_WEEKS=Object.freeze(Array.from({length:36},(_,index)=>index+5).filter(week=>![9,10,11,21,22,23,33,34,35].includes(week)));
export const ACADEMY_MATCH_COUNT=ACADEMY_MATCH_WEEKS.length;

const MAX_MONEY=9_000_000_000_000_000;
const WALL_CLOCK_MIN=Date.UTC(2020,0,1),WALL_CLOCK_MAX=Date.UTC(2200,0,1);
const DAY_IDS=Object.freeze(['mon','tue','wed','thu','fri','sat','sun']);
const ACADEMY_LEAGUES=Object.freeze(['fqa-4','fqa-3','fqa-2','fqa-1']);
const VALID_STATUS=Object.freeze(['active','administration','bankrupt']);
const VALID_FOCUS=Object.freeze(['balanced','technical','tactical','physical','recovery','youth']);
const TRAINING_ACTIVITY_IDS=Object.freeze(['rest','recovery','technical','tactical','fitness','match-prep','academy-development']);
const PLAYER_POSITIONS=Object.freeze(['GK','DF','MF','FW']);
const PLAYER_CAREER_STATUSES=Object.freeze(['active','loaned','released','transferred']);
const FORMATIONS=Object.freeze(['4-3-3','4-4-2','4-2-3-1','3-5-2','5-3-2']);
const ACADEMY_SERVICE_IDS=Object.freeze(['coaching','safeguarding','facilities','equipment','pathway','affordability','retention','femaleCompliance']);
const CREST_SHAPES=Object.freeze(['classic','round','hex','diamond','pennant','fortress','oval','modern']);
const CREST_SYMBOLS=Object.freeze(['initials','ball','star','crown','bolt','mountain','wave','sun','wings','torch','anchor','qld']);
const MATCH_SPEEDS=Object.freeze(['instant','visual']);
const REFERENCE_TEAMS=new Map(
 [...Object.values(SENIOR_LEAGUE_ROSTERS_2026).flat(),...A_LEAGUE_CLUBS_2026_27].map(item=>[item.id,item])
);
const ACADEMY_REFERENCE_TEAMS=new Map(ACADEMY_RANKINGS_2026.map(item=>[item.clubId,item]));
const ACADEMY_RATING_BY_LEAGUE=Object.freeze({'fqa-4':'development-committed','fqa-3':'bronze','fqa-2':'silver','fqa-1':'gold'});
const ACADEMY_STRENGTH_BY_LEAGUE=Object.freeze({'fqa-4':43,'fqa-3':51,'fqa-2':59,'fqa-1':67});
const QLD_DIVISION_IDS=Object.freeze(['fqpl-6','fqpl-5','fqpl-4','fqpl-3','fqpl-2','fqpl-1','npl-qld']);
const AI_STYLE_IDS=Object.freeze(['balanced','possession','high-press','counterattack','direct','low-block']);

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max,fallback=min)=>Math.min(max,Math.max(min,finite(value,fallback)));
const integer=(value,min,max,fallback=min)=>Math.round(clamp(Number.isFinite(Number(value))?Number(value):fallback,min,max));
const money=(value,fallback=0,min=-1_000_000_000)=>Math.round(clamp(Number.isSafeInteger(Number(value))?Number(value):fallback,min,MAX_MONEY));
const unique=list=>[...new Set(list)];
const cleanText=(value,max=80,fallback='')=>{
 const text=String(value??'').replace(/[<>\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
 return text||fallback;
};
const cleanId=(value,max=80)=>cleanText(value,max,'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,max);
const findIntensity=id=>TRAINING_INTENSITIES.find(item=>item.id===id)||TRAINING_INTENSITIES[1];
const divisionBaseStrength=divisionId=>({
 'fqpl-6':37,'fqpl-5':44,'fqpl-4':51,'fqpl-3':58,'fqpl-2':65,'fqpl-1':72,'npl-qld':80,'a-league':85
 }[divisionId]??37);
const academyIndex=leagueId=>Math.max(0,ACADEMY_LEAGUES.indexOf(leagueId));
const formationProfile=id=>FORMATION_PROFILES[id]||FORMATION_PROFILES['4-3-3'];
const trainingSessionEffect=id=>TRAINING_SESSION_EFFECTS[id]||TRAINING_SESSION_EFFECTS.rest;
const isPlayerAvailable=player=>Boolean(player)&&!player.injuryWeeks&&!player.suspensionMatchesRemaining&&(player.careerStatus||'active')==='active';

function hashString(value){
 let hash=2166136261;
 for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
 return hash>>>0;
}

function seededRandom(seed){
 let value=hashString(seed)||0x6d2b79f5;
 return ()=>{
  value+=0x6d2b79f5;
  let t=value;
  t=Math.imul(t^t>>>15,t|1);
  t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296;
 };
}

function poisson(lambda,random){
 const limit=Math.exp(-clamp(lambda,.05,4.8));
 let product=1,count=0;
 do{count+=1;product*=random()}while(product>limit&&count<10);
 return Math.min(8,count-1);
}

function defaultSchedule(kind='first'){
 const values=kind==='academy'?['rest','technical','rest','academy-development','rest','rest','rest']:kind==='u23'||kind==='b'?['recovery','technical','tactical','rest','match-prep','rest','rest']:['recovery','technical','tactical','rest','match-prep','rest','rest'];
 const activities=Object.fromEntries(DAY_IDS.map((day,index)=>[day,values[index]])),days=DAY_IDS.filter(day=>!['rest','recovery'].includes(activities[day]));
 return {days,intensity:'normal',focus:kind==='academy'?'technical':kind==='u23'||kind==='b'?'youth':'balanced',activities};
}

function normalizeSchedule(raw,kind='first'){
 const source=raw&&typeof raw==='object'?raw:{},defaults=defaultSchedule(kind);
 let activitySource=source.activities&&typeof source.activities==='object'?source.activities:null;
 if(Array.isArray(raw))activitySource=Object.fromEntries(DAY_IDS.map((day,index)=>[day,raw[index]]));
 const activities={...defaults.activities};
 if(activitySource){for(const day of DAY_IDS)if(TRAINING_ACTIVITY_IDS.includes(activitySource[day]))activities[day]=activitySource[day]}
 else if(Array.isArray(source.days)){
  for(const day of DAY_IDS)activities[day]=source.days.includes(day)?'technical':day==='mon'?'recovery':'rest';
 }
 const days=DAY_IDS.filter(day=>!['rest','recovery'].includes(activities[day]));
 return {
  days,
  intensity:TRAINING_INTENSITIES.some(item=>item.id===source.intensity)?source.intensity:defaults.intensity,
  focus:VALID_FOCUS.includes(source.focus)?source.focus:defaults.focus,activities
 };
}

function normalizeBadge(raw,name){
 const source=raw&&typeof raw==='object'?raw:{};
 const kind=['generated','upload'].includes(source.kind)?source.kind:'generated';
 const initials=cleanText(source.initials,4,name.split(' ').map(word=>word[0]).join('').slice(0,3).toUpperCase());
 const primary=/^#[0-9a-f]{6}$/i.test(source.primary)?source.primary:'#28d17c';
 const secondary=/^#[0-9a-f]{6}$/i.test(source.secondary)?source.secondary:'#071b2f';
 const rawData=source.dataUrl||source.logoData||source.imageData||'',dataUrl=kind==='upload'||rawData?(/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(String(rawData))&&String(rawData).length<=262_144?String(rawData):''):'';
 const crestId=cleanId(source.crestId||source.id,40);
 const shapeId=CREST_SHAPES.includes(source.shapeId)?source.shapeId:(CREST_SHAPES.includes(crestId)?crestId:'classic');
 const symbolId=CREST_SYMBOLS.includes(source.symbolId)?source.symbolId:'initials';
 return dataUrl?{kind:'upload',dataUrl,initials,primary,secondary,crestId:shapeId,shapeId,symbolId}:{kind:'generated',initials,primary,secondary,crestId:shapeId,shapeId,symbolId};
}

function normalizeManagerSettings(raw){
 const source=raw&&typeof raw==='object'?raw:{};
 const savedSpeed=['1','2'].includes(String(source.matchSpeed))?'visual':String(source.matchSpeed);
 return {
  matchSpeed:MATCH_SPEEDS.includes(savedSpeed)?savedSpeed:'visual',
  confirmWeek:source.confirmWeek!==false,
  reducedMotion:Boolean(source.reducedMotion),
  compactTables:Boolean(source.compactTables),
  showCrestNotice:source.showCrestNotice!==false
 };
}

function badgeFromOptions(options,name){
 const colours=Array.isArray(options.colours)?{primary:options.colours[0],secondary:options.colours[1]}:options.colours&&typeof options.colours==='object'?options.colours:{};
 const crest=options.crest;
 if(typeof crest==='string'&&crest.startsWith('data:image/'))return normalizeBadge({kind:'upload',dataUrl:crest,...colours},name);
 if(crest&&typeof crest==='object')return normalizeBadge({...crest,...colours},name);
 return normalizeBadge({kind:'generated',crestId:typeof crest==='string'?crest:'',...colours},name);
}

function emptyTable(teamIds){return Object.fromEntries(teamIds.map(id=>[id,[0,0,0,0,0,0,0]]))}

function defaultLeagueMemberships(){return Object.fromEntries(QLD_DIVISION_IDS.map(id=>[id,getSeniorRoster(id).map(team=>team.id)]))}

function normalizeLeagueMemberships(raw){
 const fallback=defaultLeagueMemberships(),source=raw&&typeof raw==='object'?raw:{},seen=new Set(),result={};
 for(const divisionId of QLD_DIVISION_IDS){
  const candidate=unique((Array.isArray(source[divisionId])?source[divisionId]:[]).map(String).filter(id=>REFERENCE_TEAMS.has(id)&&!seen.has(id)));
  result[divisionId]=(candidate.length>=6?candidate:fallback[divisionId]).filter(id=>{if(seen.has(id))return false;seen.add(id);return true});
 }
 return result;
}

function competitionPlayerId(squad='first'){
 if(squad==='b')return PLAYER_B_TEAM_ID;
 if(squad==='u23')return PLAYER_U23_TEAM_ID;
 if(squad==='academy')return PLAYER_ACADEMY_TEAM_ID;
 return PLAYER_FIRST_TEAM_ID;
}

function competitionTeamIds(divisionId,squad='first',memberships=null){
 const playerId=competitionPlayerId(squad);
 if(squad==='academy'){
  const rating=ACADEMY_RATING_BY_LEAGUE[divisionId]||ACADEMY_RATING_BY_LEAGUE['fqa-4'];
  const teams=unique([...ACADEMY_RANKINGS_2026.filter(item=>item.rating===rating).map(item=>item.clubId),playerId]);
  // The round-robin scheduler gives odd-sized leagues a bye; never invent a club.
  return teams;
 }
 const seniorIds=memberships?.[divisionId]||getSeniorRoster(divisionId).map(item=>item.id);
 return unique([...seniorIds,playerId]);
}

function roundCount(teamIds){
 const count=teamIds.length+(teamIds.length%2);
 return Math.max(0,(count-1)*2);
}

function leagueWeekForRound(round){return 5+Math.max(0,integer(round,0,100,0))}
function academyRoundCount(){return ACADEMY_MATCH_COUNT}
function academyWeekForRound(round){return ACADEMY_MATCH_WEEKS[Math.max(0,integer(round,0,ACADEMY_MATCH_COUNT-1,0))]??FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks}
function academySchoolBreakWeek(week){return [9,10,11,21,22,23,33,34,35].includes(integer(week,1,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,1))}
function academyTrainingAttendeeIds(state){
 const available=state.squads.academy.players.filter(isPlayerAvailable),schoolBreak=academySchoolBreakWeek(state.week),random=seededRandom(`${state.seed}|academy-attendance|${state.season}|${state.week}`),rate=schoolBreak?.56+random()*.18:.84+random()*.1,target=Math.max(0,Math.min(available.length,Math.round(available.length*rate)));
 return new Set([...available].sort((a,b)=>hashString(`${state.seed}|academy-attendee|${state.season}|${state.week}|${a.id}`)-hashString(`${state.seed}|academy-attendee|${state.season}|${state.week}|${b.id}`)).slice(0,target).map(player=>player.id));
}
function academyIsRainPostponed(state,round){
 const scheduledWeek=academyWeekForRound(round);
 if(state.week!==scheduledWeek)return false;
 return seededRandom(`${state.seed}|academy-rain|${state.season}|${round}`)()<.065;
}

function buildAcademyRoundFixtures(teamIds,round,season=2026,divisionId='academy'){
 if(round<0||round>=academyRoundCount())return [];
 const baseRounds=roundCount(teamIds),baseRound=baseRounds?round%baseRounds:0;
 return buildRoundFixtures(teamIds,baseRound,season,divisionId).map(fixture=>({...fixture,id:`${season}:${divisionId}:academy-${round+1}:${fixture.home}:${fixture.away}`,round}));
}

function makeCompetition(divisionId,squad='first',memberships=null){
 const teams=competitionTeamIds(divisionId,squad,memberships);
 return {divisionId,teams,table:emptyTable(teams),round:0,playedRound:-1,lastResult:null,results:[]};
}

function makeAcademyCompetitions(divisionId){
 return Object.fromEntries(ACADEMY_AGE_GROUPS.map(ageGroup=>[ageGroup,makeCompetition(divisionId,'academy')]));
}

function normalizeTable(raw,teamIds){
 const source=raw&&typeof raw==='object'?raw:{};
 const table={};
 for(const id of teamIds){
  const row=Array.isArray(source[id])?source[id]:[];
  const played=integer(row[0],0,200,0),wins=integer(row[1],0,played,0),draws=integer(row[2],0,played-wins,0),losses=integer(row[3],0,played-wins-draws,played-wins-draws);
  table[id]=[played,wins,draws,losses,integer(row[4],0,999,0),integer(row[5],0,999,0),wins*3+draws];
 }
 return table;
}

function normalizeMatchStats(raw){
 const source=raw&&typeof raw==='object'?raw:{};
 const pair=(key,min,max,fallbackHome=0,fallbackAway=0,decimals=0)=>{
  const value=source[key]&&typeof source[key]==='object'?source[key]:{};
  const normalize=value=>{const bounded=clamp(value,min,max,0),factor=10**decimals;return Math.round(bounded*factor)/factor};
  return {home:normalize(value.home??fallbackHome),away:normalize(value.away??fallbackAway)};
 };
 const possession=pair('possession',20,80,50,50);
 possession.away=100-possession.home;
 return {
  possession,
  shots:pair('shots',0,60),shotsOnTarget:pair('shotsOnTarget',0,40),xG:pair('xG',0,12,0,0,2),corners:pair('corners',0,30),
  fouls:pair('fouls',0,40),yellowCards:pair('yellowCards',0,12),redCards:pair('redCards',0,5)
 };
}

function normalizeTactics(raw){
 const source=raw&&typeof raw==='object'?raw:{},profile=value=>{
  const item=value&&typeof value==='object'?value:{};
  return {formation:FORMATIONS.includes(item.formation)?item.formation:'4-3-3',styleId:getPlayingStyle(item.styleId)?.id||'balanced',coachingBonus:clamp(item.coachingBonus,-10,15,0),matchup:clamp(item.matchup,-10,10,0),delegated:Boolean(item.delegated)};
 };
 return {home:profile(source.home),away:profile(source.away)};
}

function normalizeMatchday(raw,attendance=0){
 const source=raw&&typeof raw==='object'?raw:{},weather=source.weather&&typeof source.weather==='object'?source.weather:{};
 const ticketRevenueAud=money(source.ticketRevenueAud,0,0),hospitalityRevenueAud=money(source.hospitalityRevenueAud,0,0),concessionRevenueAud=money(source.concessionRevenueAud,0,0),operatingCostAud=money(source.operatingCostAud,0,0),grossRevenueAud=ticketRevenueAud+hospitalityRevenueAud+concessionRevenueAud;
 return {
   attendance:integer(source.attendance,0,200_000,attendance),ticketPriceAud:money(source.ticketPriceAud,0,0),ticketRevenueAud,hospitalityRevenueAud,
   concessionRevenueAud,travelCostAud:money(source.travelCostAud??source.travelCost,0,0),operatingCostAud,totalRevenueAud:money(source.totalRevenueAud,grossRevenueAud,0),netRevenueAud:money(source.netRevenueAud,grossRevenueAud-operatingCostAud),
   fixtureId:cleanText(source.fixtureId,180,''),competition:cleanText(source.competition,70,'League'),venue:['home','away','neutral'].includes(source.venue)?source.venue:'home',opponentId:cleanId(source.opponentId,80),opponentName:cleanText(source.opponentName,80,'Opponent'),
   weather:{condition:cleanId(weather.condition,30)||'clear',temperature:integer(weather.temperature,-5,50,24),rainChance:integer(weather.rainChance,0,100,10),windKph:integer(weather.windKph,0,150,8)},
   pitchConditionBefore:integer(source.pitchConditionBefore,0,100,80),pitchConditionAfter:integer(source.pitchConditionAfter,0,100,75),satisfaction:integer(source.satisfaction,0,100,60)
 };
}

function normalizeResult(raw,validTeams){
 if(!raw||typeof raw!=='object')return null;
 const home=String(raw.home||''),away=String(raw.away||'');
 if(!validTeams.includes(home)||!validTeams.includes(away)||home===away)return null;
 const incidents=(Array.isArray(raw.incidents)?raw.incidents:[]).slice(0,20).map((incident,index)=>({
  type:['kickoff','goal','card','injury','substitution','tactical-change','full-time'].includes(incident?.type)?incident.type:'commentary',minute:integer(incident?.minute,0,120,index),teamId:validTeams.includes(incident?.teamId)?incident.teamId:null,
  playerId:cleanId(incident?.playerId,80)||null,playerName:cleanText(incident?.playerName,48,''),assistPlayerId:cleanId(incident?.assistPlayerId,80)||null,assistPlayerName:cleanText(incident?.assistPlayerName,48,''),text:cleanText(incident?.text,150,'Match update')
 }));
 const attendance=integer(raw.attendance,0,200_000,0),rawStats=raw.stats&&typeof raw.stats==='object'?raw.stats:raw.statistics&&typeof raw.statistics==='object'?raw.statistics:null;
 const playerOfMatchSource=raw.playerOfMatch&&typeof raw.playerOfMatch==='object'?raw.playerOfMatch:{name:raw.playerOfMatch},playerOfMatchName=cleanText(playerOfMatchSource.name,48,'');
 return {
  id:cleanText(raw.id,180,`${home}-${away}`),round:integer(raw.round,0,100,0),week:integer(raw.week,1,60,1),
  home,away,homeGoals:integer(raw.homeGoals,0,20,0),awayGoals:integer(raw.awayGoals,0,20,0),attendance,incidents,commentary:incidents.map(incident=>incident.text),
  stats:rawStats?normalizeMatchStats(rawStats):{},tactics:normalizeTactics(raw.tactics),matchday:normalizeMatchday(raw.matchday,attendance),playerOfMatch:playerOfMatchName?{playerId:cleanId(playerOfMatchSource.playerId||playerOfMatchSource.id,80)||null,name:playerOfMatchName,teamId:validTeams.includes(playerOfMatchSource.teamId)?playerOfMatchSource.teamId:null,rating:clamp(playerOfMatchSource.rating,0,10,0)}:null
 };
}

function normalizeCompetition(raw,divisionId,squad='first',memberships=null){
 const source=raw&&typeof raw==='object'?raw:{};
 const teams=competitionTeamIds(divisionId,squad,memberships),rounds=squad==='academy'?academyRoundCount():roundCount(teams),round=integer(source.round,0,rounds,0);
 const lastResult=normalizeResult(source.lastResult,teams);
 const results=(Array.isArray(source.results)?source.results:[]).map(item=>normalizeResult(item,teams)).filter(Boolean).slice(-60);
 return {
  divisionId,teams,table:normalizeTable(source.table,teams),round,
  playedRound:integer(source.playedRound,-1,Math.max(-1,round),-1),lastResult,results
 };
}

function normalizeEvents(raw){
 return (Array.isArray(raw)?raw:[]).slice(-40).map((event,index)=>({
  type:cleanId(event?.type,50)||'event',code:cleanId(event?.code,60),season:integer(event?.season,2026,9999,2026),week:integer(event?.week,1,60,1),
  message:cleanText(event?.message,240,`Club event ${index+1}`)
 }));
}

function normalizeFinanceHistory(raw){
 return (Array.isArray(raw)?raw:[]).slice(-104).map(item=>({season:integer(item?.season,2026,9999,2026),week:integer(item?.week,1,60,1),income:money(item?.income,0,0),expenses:money(item?.expenses,0,0),net:money(item?.net,money(item?.income,0,0)-money(item?.expenses,0,0))}));
}

function normalizeLedger(raw){
 return (Array.isArray(raw)?raw:[]).slice(-180).map((item,index)=>({id:cleanText(item?.id,80,`ledger-${index+1}`),season:integer(item?.season,2026,9999,2026),week:integer(item?.week,1,60,1),category:cleanId(item?.category,40)||'club',description:cleanText(item?.description,100,'Club transaction'),amount:money(item?.amount,0)}));
}

function pushLedgerInPlace(state,category,description,amount){
 const entry={id:`${state.season}:${state.week}:${category}:${state.finance.ledger.length+1}`,season:state.season,week:state.week,category,description,amount:money(amount,0)};
 state.finance.ledger=[...state.finance.ledger.slice(-179),entry];return entry;
}

function defaultClock(season=2026){return Date.UTC(season,0,5,0,0,0,0)}

const PLAYER_FIRST_NAMES=Object.freeze(['Liam','Noah','Oliver','Jack','Henry','Leo','Kai','Ethan','Lucas','Hugo','Mason','Finn','Jai','Dylan','Bailey','Riley','Thomas','Samuel','Archie','Oscar','Max','Cooper','Luke','Nathan']);
const PLAYER_LAST_NAMES=Object.freeze(['Nguyen','Walker','Patel','Williams','Chen','Thompson','Singh','Harris','Brown','Wilson','Martin','Taylor','Evans','Lee','Kelly','Fraser','Okafor','Murphy','Reid','Costa','Tran','Jones','Scott','Park']);

function playerLayout(kind){
 if(kind==='academy')return ['GK','GK','DF','DF','DF','DF','DF','MF','MF','MF','MF','MF','FW','FW','FW','FW'];
 if(kind==='u23')return ['GK','GK','DF','DF','DF','DF','DF','MF','MF','MF','MF','MF','FW','FW','FW','FW'];
 return ['GK','GK','DF','DF','DF','DF','DF','DF','MF','MF','MF','MF','MF','MF','FW','FW','FW','FW'];
}

function generatePlayers(seed,kind='first',ratingBase=50){
 const random=seededRandom(`${seed}|players|${kind}`),layout=playerLayout(kind),usedNames=new Set();
 return layout.map((position,index)=>{
  let first='',last='',name='';
  for(let attempt=0;attempt<24&&!name;attempt++){
   first=PLAYER_FIRST_NAMES[Math.floor(random()*PLAYER_FIRST_NAMES.length)];last=PLAYER_LAST_NAMES[Math.floor(random()*PLAYER_LAST_NAMES.length)];
   const candidate=`${first} ${last}`;if(!usedNames.has(candidate))name=candidate;
  }
  if(!name)name=`${first} ${last} ${index+1}`;usedNames.add(name);
  const rating=integer(ratingBase+(random()-.5)*15,25,92,ratingBase);
  const age=kind==='academy'?integer(14+random()*4,14,17,15):kind==='u23'?integer(17+random()*6,17,22,19):integer(19+random()*14,19,33,24);
  const weeklyWage=kind==='academy'?0:kind==='u23'?Math.round((20+rating*.9+random()*35)/10)*10:Math.round((25+rating*1.45+random()*55)/10)*10;
  return {id:`${kind}-${index+1}-${hashString(`${seed}|${kind}|${index}`).toString(36).slice(0,5)}`,name,position,squadNumber:index+1,age,rating,potential:integer(rating+(kind==='academy'?12+random()*22:kind==='u23'?7+random()*17:2+random()*9),rating,99,rating),weeklyWage,fatigue:integer(5+random()*10,0,100,8),morale:integer(48+random()*14,0,100,55),injuryWeeks:0,suspensionMatchesRemaining:0,contractSeasons:kind==='academy'?0:integer(1+random()*3,1,5,2),careerStatus:'active',loanId:'',developmentFocus:'balanced'};
 });
}

function formationCounts(formation){return {'4-3-3':{GK:1,DF:4,MF:3,FW:3},'4-4-2':{GK:1,DF:4,MF:4,FW:2},'4-2-3-1':{GK:1,DF:4,MF:5,FW:1},'3-5-2':{GK:1,DF:3,MF:5,FW:2},'5-3-2':{GK:1,DF:5,MF:3,FW:2}}[formation]||{GK:1,DF:4,MF:3,FW:3}}

function autoLineup(players,formation='4-3-3'){
 const counts=formationCounts(formation),available=players.filter(isPlayerAvailable),lineup=[];
 for(const position of PLAYER_POSITIONS)lineup.push(...available.filter(player=>player.position===position).sort((a,b)=>b.rating-a.rating).slice(0,counts[position]).map(player=>player.id));
 for(const player of [...available].sort((a,b)=>b.rating-a.rating))if(lineup.length<11&&!lineup.includes(player.id))lineup.push(player.id);
 return {lineup:lineup.slice(0,11),bench:available.filter(player=>!lineup.includes(player.id)).sort((a,b)=>b.rating-a.rating).slice(0,7).map(player=>player.id)};
}

function repairSquadSelection(selection){
 const availablePlayers=selection.players.filter(isPlayerAvailable),available=new Set(availablePlayers.map(player=>player.id)),playerById=new Map(selection.players.map(player=>[player.id,player]));
 const previousLineup=unique(selection.lineup),lineup=previousLineup.filter(id=>available.has(id)).slice(0,11),benchOrder=new Map(selection.bench.map((id,index)=>[id,index]));
 const addCandidate=id=>{if(lineup.length<11&&available.has(id)&&!lineup.includes(id))lineup.push(id)};
 for(const missingId of previousLineup.filter(id=>!available.has(id))){
  const position=playerById.get(missingId)?.position;
  availablePlayers.filter(player=>player.position===position&&!lineup.includes(player.id)).sort((a,b)=>(benchOrder.get(a.id)??999)-(benchOrder.get(b.id)??999)||b.rating-a.rating).forEach(player=>addCandidate(player.id));
 }
 const automatic=autoLineup(availablePlayers,selection.formation);
 automatic.lineup.forEach(addCandidate);availablePlayers.sort((a,b)=>b.rating-a.rating).forEach(player=>addCandidate(player.id));
 selection.lineup=lineup.slice(0,11);
 selection.bench=unique([...selection.bench,...automatic.bench,...availablePlayers.map(player=>player.id)]).filter(id=>available.has(id)&&!selection.lineup.includes(id)).slice(0,9);
 return selection;
}

function createSquad(seed,kind,ratingBase){
 const players=generatePlayers(seed,kind,ratingBase),formation='4-3-3',selection=autoLineup(players,formation);
 return {formation,...selection,players};
}

function normalizePlayer(raw,index,kind='first'){
 if(!raw||typeof raw!=='object')return null;
 const id=cleanId(raw.id,80)||`${kind}-player-${index+1}`,position=PLAYER_POSITIONS.includes(raw.position)?raw.position:'MF';
 return {id,name:cleanText(raw.name,48,`Player ${index+1}`),position,squadNumber:integer(raw.squadNumber,1,99,index+1),age:integer(raw.age,13,45,kind==='academy'?15:kind==='u23'?19:24),rating:integer(raw.rating,1,99,45),potential:integer(raw.potential,1,99,Math.max(45,integer(raw.rating,1,99,45))),weeklyWage:money(raw.weeklyWage??raw.wage,0,0),fatigue:clamp(raw.fatigue,0,100,8),morale:clamp(raw.morale,0,100,55),injuryWeeks:integer(raw.injuryWeeks,0,80,0),suspensionMatchesRemaining:integer(raw.suspensionMatchesRemaining,0,12,0),contractSeasons:integer(raw.contractSeasons,0,8,kind==='academy'?0:2),careerStatus:PLAYER_CAREER_STATUSES.includes(raw.careerStatus)?raw.careerStatus:'active',loanId:cleanId(raw.loanId,80),developmentFocus:FOOTBALL_DEVELOPMENT_FOCUSES.includes(raw.developmentFocus)?raw.developmentFocus:'balanced'};
}

function repairSquadNumbers(players){
 const used=new Set();
 for(let index=0;index<players.length;index++){
  let value=integer(players[index].squadNumber,1,99,index+1);
  if(used.has(value)){value=1;while(value<=99&&used.has(value))value++}
  players[index].squadNumber=value<=99?value:index+1;used.add(players[index].squadNumber);
 }
 return players;
}

function normalizeSquad(raw,fallback,kind='first'){
 const source=raw&&typeof raw==='object'?raw:{},candidate=(Array.isArray(source.players)?source.players:[]).map((player,index)=>normalizePlayer(player,index,kind)).filter(Boolean),players=candidate.length>=(kind==='academy'?11:14)?candidate.slice(0,30):clone(fallback.players);
 const ids=new Set(),deduped=[];for(const player of players){if(!ids.has(player.id)){ids.add(player.id);deduped.push(player)}}
 repairSquadNumbers(deduped);
 const formation=FORMATIONS.includes(source.formation)?source.formation:fallback.formation;
 const availableIds=new Set(deduped.filter(isPlayerAvailable).map(player=>player.id));
 let lineup=unique((Array.isArray(source.lineup)?source.lineup:[]).map(String).filter(id=>availableIds.has(id))).slice(0,11);
 let bench=unique((Array.isArray(source.bench)?source.bench:[]).map(String).filter(id=>availableIds.has(id)&&!lineup.includes(id))).slice(0,9);
 return repairSquadSelection({formation,lineup,bench,players:deduped});
}

function recruitmentFunnel(seed,season,week,academyTalent=45,context={}){
 const random=seededRandom(`${seed}|recruitment-funnel|${season}|${week}`),staffLevel=integer(context.staffLevel,0,4,0),siteTalent=clamp(context.siteTalent,0,100,50),reputation=clamp(context.reputation,0,100,25),interest=clamp(context.interest,0,100,55);
 const enquiries=Math.max(30,Math.round(38+siteTalent*.72+interest*.62+reputation*.25+staffLevel*13+(random()-.5)*18));
 const invited=Math.max(12,Math.min(enquiries,Math.round(enquiries*(.55+staffLevel*.035+(random()-.5)*.06))));
 const attendees=Math.max(8,Math.min(invited,Math.round(invited*(.68+staffLevel*.025+(random()-.5)*.08))));
 const highPotential=Math.max(1,Math.min(attendees,Math.round(attendees*(.055+academyTalent*.0015+staffLevel*.018+(random()-.5)*.025))));
 return {enquiries,invited,attendees,highPotential,seniorLeads:6+Math.floor(staffLevel/2),lastUpdatedKey:`${season}:${week}`};
}

function generateRecruitment(seed,season,week,divisionId,academyTalent=45,context={}){
 const staffLevel=integer(context.staffLevel,0,4,0),seniorBase=clamp(divisionBaseStrength(divisionId)-2+staffLevel*1.2,38,86),marketCount=6+Math.floor(staffLevel/2),trialCount=6+staffLevel;
 const market=generatePlayers(`${seed}|market|${season}|${week}`,'first',seniorBase).slice(0,marketCount).map((player,index)=>({...player,id:`market-${season}-${week}-${index+1}`,age:integer(player.age,19,31,24),weeklyWage:Math.round((player.weeklyWage*(1+index*.08))/10)*10,signingFeeAud:Math.round(player.weeklyWage*(8+index)/100)*100}));
 const trialists=generatePlayers(`${seed}|trials|${season}|${week}`,'academy',clamp(academyTalent+staffLevel*1.4,35,82)).slice(0,trialCount).map((player,index)=>({...player,id:`trial-${season}-${week}-${index+1}`,traits:index%3===0?['High potential']:index%2?['Technical upside']:['Local pathway']}));
 return {key:`${season}:${week}`,market,trialists,funnel:recruitmentFunnel(seed,season,week,academyTalent,context)};
}

function normalizeRecruitmentFunnel(raw,fallback){
 const source=raw&&typeof raw==='object'?raw:{},base=fallback&&typeof fallback==='object'?fallback:{};
 const enquiries=integer(source.enquiries,0,10_000,base.enquiries||0),invited=integer(source.invited,0,enquiries,Math.min(enquiries,base.invited||0)),attendees=integer(source.attendees,0,invited,Math.min(invited,base.attendees||0));
 return {enquiries,invited,attendees,highPotential:integer(source.highPotential,0,attendees,Math.min(attendees,base.highPotential||0)),seniorLeads:integer(source.seniorLeads,0,100,base.seniorLeads||0),lastUpdatedKey:cleanText(source.lastUpdatedKey,30,base.lastUpdatedKey||'')};
}

function normalizeRecruitPlayer(raw,index,kind){
 const player=normalizePlayer(raw,index,kind);
 if(!player)return null;
 if(kind==='first')player.signingFeeAud=money(raw.signingFeeAud,player.weeklyWage*10,0);
 else player.traits=unique((Array.isArray(raw.traits)?raw.traits:[]).map(value=>cleanText(value,32,'')).filter(Boolean)).slice(0,3);
 return player;
}

function managerForRole(rawRole,rawManager={}){
 const role=String(rawRole||'').toLowerCase();
 if(role==='first'||role==='first-team-coach')return {managerRole:'first-team-coach',manager:{mode:'coach',controlledSquad:'first'}};
 if(role==='u23'||role==='u23-coach')return {managerRole:'u23-coach',manager:{mode:'coach',controlledSquad:'u23'}};
 if(role==='academy'||role==='academy-coach')return {managerRole:'academy-coach',manager:{mode:'coach',controlledSquad:'academy'}};
 if(role==='club'||role==='club-manager')return {managerRole:'club-manager',manager:{mode:'club',controlledSquad:'first'}};
 if(rawManager?.mode==='coach'&&['first','u23','academy'].includes(rawManager.controlledSquad))return managerForRole(rawManager.controlledSquad);
 return {managerRole:'club-manager',manager:{mode:'club',controlledSquad:'first'}};
}

function careerPlayersFor(selection,season,week){
 return (selection?.players||[]).map(player=>({
  id:player.id,name:player.name,position:player.position,positions:[player.position],age:player.age,rating:player.rating,potential:player.potential,morale:player.morale,status:player.careerStatus!=='active'?player.careerStatus:player.injuryWeeks?'injured':player.suspensionMatchesRemaining?'suspended':'active',weeklyWage:player.weeklyWage,developmentFocus:player.developmentFocus,
  contract:{weeklyWage:player.weeklyWage,expiresSeason:Math.max(season,season+Math.max(0,player.contractSeasons)),expiresWeek:Math.min(FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,Math.max(1,week)),squadRole:player.age<=21?'prospect':'rotation',signedSeason:season}
 }));
}

function careerPlayersForSync(selection,season,week,previousPlayers=[]){
 const previousIds=new Set((previousPlayers||[]).map(player=>player.id));
 const current=careerPlayersFor(selection,season,week).map(player=>previousIds.has(player.id)?{...player,contract:{weeklyWage:player.weeklyWage}}:player),currentIds=new Set(current.map(player=>player.id));
 const departed=(previousPlayers||[]).filter(player=>!currentIds.has(player.id)&&(['released','transferred','retired'].includes(player.status)||player.ownership==='former'));
 return [...departed,...current];
}

function initialiseCareerCompetitionsInPlace(state,{registerAll=false}={}){
 state.careerWorld=careerEnterCup(state.careerWorld,{entryFee:0});
 if(registerAll){
  const active=state.careerWorld.players.filter(item=>item.status==='active'),byId=new Map(active.map(player=>[player.id,player])),ordered=unique([...(state.squads.first?.lineup||[]),...active.map(player=>player.id)]).map(playerId=>byId.get(playerId)).filter(Boolean).slice(0,25);
  state.careerWorld=normalizeCareerWorld({...state.careerWorld,competitions:{...state.careerWorld.competitions,registration:{...state.careerWorld.competitions.registration,season:state.season,registeredPlayerIds:ordered.map(player=>player.id),lastChangedSeason:state.season,lastChangedWeek:Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks)}}},{seed:state.seed,season:state.season,week:Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),clubId:'player-club'});
 }
 return state;
}

function aiClubInputs(divisionId,memberships){
 const ids=divisionId==='a-league'?A_LEAGUE_CLUBS_2026_27.map(club=>club.id):(memberships?.[divisionId]||getSeniorRoster(divisionId).map(club=>club.id));
 return ids.map(id=>{const reference=REFERENCE_TEAMS.get(id);return {id,name:reference?.name||id,divisionId,strength:reference?.gameStrength||divisionBaseStrength(divisionId),reputation:clamp((reference?.gameStrength||divisionBaseStrength(divisionId))-5,1,100,45)}});
}

function syncRootPlayersFromCareerInPlace(state){
 const byId=new Map((state.careerWorld?.players||[]).map(player=>[player.id,player]));
 for(const player of state.squads.first.players){
  const careerPlayer=byId.get(player.id);if(!careerPlayer)continue;
  player.careerStatus=careerPlayer.status==='retired'?'released':PLAYER_CAREER_STATUSES.includes(careerPlayer.status)?careerPlayer.status:'active';
  const loan=state.careerWorld.loans.find(item=>item.playerId===player.id&&item.status==='active');player.loanId=loan?.id||'';
  if(['released','transferred'].includes(player.careerStatus)){player.weeklyWage=0;player.contractSeasons=0}
  else if(careerPlayer.contract?.weeklyWage!==undefined)player.weeklyWage=money(careerPlayer.contract.weeklyWage,player.weeklyWage,0);
  if(careerPlayer.contract?.expiresSeason){const remaining=(careerPlayer.contract.expiresSeason-state.season)*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+(careerPlayer.contract.expiresWeek-Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks)),seasons=remaining<0?0:Math.max(1,Math.ceil(remaining/FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks));player.contractSeasons=integer(seasons,0,8,player.contractSeasons)}
  player.morale=clamp(careerPlayer.morale,0,100,player.morale);
  player.injuryWeeks=integer(careerPlayer.medical?.injury?.weeksRemaining,0,80,0);
  player.suspensionMatchesRemaining=integer(careerPlayer.discipline?.suspensionMatchesRemaining,0,12,0);
  player.developmentFocus=FOOTBALL_DEVELOPMENT_FOCUSES.includes(careerPlayer.developmentFocus)?careerPlayer.developmentFocus:player.developmentFocus||'balanced';
 }
 state.squads.first.players=state.squads.first.players.filter(player=>!['released','transferred'].includes(player.careerStatus));
 repairSquadSelection(state.squads.first);return state;
}

function resyncCareerPlayersInPlace(state){
 const week=Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),players=careerPlayersForSync(state.squads.first,state.season,week,state.careerWorld?.players);
 state.careerWorld=normalizeCareerWorld(state.careerWorld,{seed:state.seed,season:state.season,week,clubId:'player-club',players});
 return state;
}

function cancelActivePlayerLoansInPlace(state,playerId){
 for(const loan of state.careerWorld.loans.filter(item=>item.playerId===playerId&&item.status==='active')){
  if(loan.direction==='out')state.careerWorld=careerRecallPlayerLoan(state.careerWorld,loan.id);
  else state.careerWorld.loans=state.careerWorld.loans.map(item=>item.id===loan.id?{...item,status:'cancelled'}:item);
 }
 return state;
}

function createDefaultState(options={}){
 const site=getStartSite(options.siteId)||START_SITES[2],name=cleanText(options.name??options.clubName,48,'Queensland United');
 const foundingCost=site.acquisitionCostAud+site.initialClearanceCostAud;
 const ownerInvestment=money(options.ownerInvestmentAud,foundingCost+2_000_000,0),startupLoan=money(options.startupLoanAud,0,0);
 const cash=ownerInvestment+startupLoan-foundingCost,clockMs=Math.round(clamp(options.nowMs,defaultClock(2026),defaultClock(2100),defaultClock(2026)));
 const fullBadge=options.badge?normalizeBadge(options.badge,name):badgeFromOptions(options,name),logoData=fullBadge.dataUrl||'',badge={...fullBadge};delete badge.dataUrl;
 const palette=cleanId(options.crest?.palette||options.palette||(typeof options.colours?.primary==='string'?options.colours.primary:''),24)||'maroon';
 const divisionId='fqpl-6',leagueMemberships=defaultLeagueMemberships();
 const squads={first:createSquad(options.seed||'qld-club-2026','first',54),u23:createSquad(options.seed||'qld-club-2026','u23',47),academy:createSquad(options.seed||'qld-club-2026','academy',43),b:null,bU23:null};
 const recruitment=generateRecruitment(options.seed||'qld-club-2026',2026,1,divisionId,45,{siteTalent:site.talent,reputation:25,interest:55,staffLevel:0}),academyByAge=makeAcademyCompetitions('fqa-4');
 let careerWorld=createCareerWorld({seed:options.seed||'qld-club-2026',season:2026,week:1,clubId:'player-club',players:careerPlayersFor(squads.first,2026,1),aiClubs:aiClubInputs(divisionId,leagueMemberships)});
 careerWorld=careerEnterCup(careerWorld,{entryFee:0});
 for(const player of careerWorld.players.filter(item=>item.status==='active').slice(0,25))careerWorld=careerRegisterPlayerForCompetition(careerWorld,player.id);
 return {
  schemaVersion:FOOTBALL_SCHEMA_VERSION,seed:cleanText(options.seed,80,'qld-club-2026'),season:2026,week:1,clockMs,status:'active',footballTokens:0,leagueMemberships,
  managerRole:'club-manager',manager:{mode:'club',controlledSquad:'first'},settings:normalizeManagerSettings(options.settings),
  club:{name,shortName:cleanText(options.shortName,18,name.slice(0,18)),initials:badge.initials,palette,logoData,siteId:site.id,badge,reputation:25,governance:50,u23Linked:true,aLeagueMember:false,queenslandPathwayDivisionId:''},
  first:{divisionId,styleId:getPlayingStyle(options.playingStyle)?.id||'balanced',morale:55,fatigue:8,familiarity:58,training:defaultSchedule('first')},
  u23:{divisionId,styleId:'youth-first',morale:53,fatigue:8,familiarity:55,training:defaultSchedule('u23')},
  b:null,
  academy:{leagueId:'fqa-4',secondaryLeagueId:'',tier:2,shield:'development-committed',score:30,services:{coaching:35,safeguarding:45,facilities:25,equipment:25,pathway:25,affordability:60,retention:55,femaleCompliance:30},femaleProgramme:false,feeAud:money(options.academyFeeAud,1750,0),talent:45,wealth:site.wealth,enrolment:120,trialInterest:55,trials:clone(recruitment.funnel),satisfaction:62,morale:55,fatigue:8,seasonsInLeague:0,secondarySeasons:0,lastAssessmentSeason:0,styleId:'youth-first',familiarity:55,training:defaultSchedule('academy')},
  facilities:{pitch:site.readyFields>0?1:0,training:0,academy:0,medical:0,analysis:0,clubhouse:1,stadium:0,fields:site.readyFields},
  staff:{'head-coach':1,'academy-director':1,recruitment:0,'sports-science':0,'medical-team':0,'grounds-team':1,analysts:0},
  projects:[],careerWorld,
  footballOperations:createFootballOperations({seed:options.seed||'qld-club-2026',season:2026,week:1,legacyStaff:{'head-coach':1,'academy-director':1,'grounds-team':1}}),
  squads,recruitment,
  competitions:{first:makeCompetition(divisionId,'first',leagueMemberships),u23:makeCompetition(divisionId,'u23',leagueMemberships),academy:academyByAge.u18,academyByAge,b:null},
  finance:{cash,debt:startupLoan,loanWeeksRemaining:startupLoan>0?FOOTBALL_GAME_ASSUMPTIONS.startupLoanTermSeasons*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks:0,weeklyFirstTeamBudget:money(options.weeklyFirstTeamBudget,5000,0),ownerInvested:ownerInvestment,ownerWithdrawn:0,missedPayrollWeeks:0,seasonIncome:0,seasonExpenses:foundingCost,lastWeekly:null,lastSettledKey:'',history:[],ledger:[]},
  metrics:{seasons:0,promotions:0,relegations:0,trophies:0,seniorWins:0,academyGraduates:0,nplSeasons:0,nplTitles:0,attendanceTotal:0,homeMatches:0,lastALeagueBidSeason:0},
  objectives:{claimed:[]},counters:{project:0,match:0},events:[]
 };
}

function normalizeProject(raw,index,facilities,site,clockMs){
 if(!raw||typeof raw!=='object')return null;
 const facilityId=cleanId(raw.facilityId,40),definition=getFacility(facilityId);
 if(!definition)return null;
 const current=facilities[facilityId]||0,max=facilityId==='fields'?site.maxFields:definition.maxLevel,toLevel=integer(raw.toLevel,1,max,current+1);
 if(toLevel<=current)return null;
 const startedAtMs=Math.round(clamp(raw.startedAtMs,WALL_CLOCK_MIN,WALL_CLOCK_MAX,WALL_CLOCK_MIN)),completesAtMs=Math.round(clamp(raw.completesAtMs,startedAtMs,WALL_CLOCK_MAX,startedAtMs));
 return {id:cleanText(raw.id,80,`project-${index+1}`),facilityId,toLevel,startedAtMs,completesAtMs,costAud:money(raw.costAud,0,0)};
}

export function normalizeFootballState(input,options={}){
 const source=input&&typeof input==='object'?clone(input):{},fallback=createDefaultState({});
 const site=getStartSite(source.club?.siteId)||getStartSite(fallback.club.siteId),season=integer(source.season,2026,9999,2026);
 const name=cleanText(source.club?.name,48,fallback.club.name),divisionId=getSeniorDivision(source.first?.divisionId)?.id||'fqpl-6';
 const leagueMemberships=normalizeLeagueMemberships(source.leagueMemberships);
 const fullBadge=normalizeBadge({...source.club?.badge,dataUrl:source.club?.logoData||source.club?.badge?.dataUrl},name),logoData=fullBadge.dataUrl||'',badge={...fullBadge};delete badge.dataUrl;
 const managerSelection=managerForRole(source.managerRole,source.manager);
 const state={
  schemaVersion:FOOTBALL_SCHEMA_VERSION,seed:cleanText(source.seed,80,fallback.seed),season,week:integer(source.week,1,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+1,1),footballTokens:integer(source.footballTokens,0,999_999,0),leagueMemberships,
  clockMs:Math.round(clamp(source.clockMs,defaultClock(2025),defaultClock(2100),fallback.clockMs)),status:VALID_STATUS.includes(source.status)?source.status:'active',
  managerRole:managerSelection.managerRole,manager:managerSelection.manager,settings:normalizeManagerSettings(source.settings),
  club:{
   name,shortName:cleanText(source.club?.shortName,18,name.slice(0,18)),initials:cleanText(source.club?.initials,4,badge.initials),palette:cleanId(source.club?.palette,24)||fallback.club.palette,logoData,siteId:site.id,badge,
   reputation:clamp(source.club?.reputation,0,100,fallback.club.reputation),governance:clamp(source.club?.governance,0,100,fallback.club.governance),u23Linked:true,aLeagueMember:Boolean(source.club?.aLeagueMember||divisionId==='a-league'),queenslandPathwayDivisionId:getSeniorDivision(source.club?.queenslandPathwayDivisionId)?.id||''
  },
  first:{
   divisionId,styleId:getPlayingStyle(source.first?.styleId)?.id||'balanced',morale:clamp(source.first?.morale,0,100,fallback.first.morale),fatigue:clamp(source.first?.fatigue,0,100,fallback.first.fatigue),familiarity:clamp(source.first?.familiarity,0,100,fallback.first.familiarity),
   training:normalizeSchedule(source.first?.training,'first')
  },
  u23:{
   divisionId,styleId:getPlayingStyle(source.u23?.styleId)?.id||'youth-first',morale:clamp(source.u23?.morale,0,100,fallback.u23.morale),fatigue:clamp(source.u23?.fatigue,0,100,fallback.u23.fatigue),familiarity:clamp(source.u23?.familiarity,0,100,fallback.u23.familiarity),
   training:normalizeSchedule(source.u23?.training,'u23')
  },
  b:null,
  academy:{
   leagueId:ACADEMY_LEAGUES.includes(source.academy?.leagueId)?source.academy.leagueId:'fqa-4',secondaryLeagueId:'',tier:integer(source.academy?.tier,1,2,2),
   shield:['development-committed','bronze','silver','gold'].includes(source.academy?.shield)?source.academy.shield:'development-committed',score:clamp(source.academy?.score,0,100,fallback.academy.score),services:{},femaleProgramme:Boolean(source.academy?.femaleProgramme),
   feeAud:money(source.academy?.feeAud,1750,0),talent:clamp(source.academy?.talent,0,100,fallback.academy.talent),wealth:clamp(source.academy?.wealth,0,100,site.wealth),
   enrolment:integer(source.academy?.enrolment,0,1200,120),trialInterest:clamp(source.academy?.trialInterest,0,100,fallback.academy.trialInterest),trials:{},satisfaction:clamp(source.academy?.satisfaction,0,100,fallback.academy.satisfaction),morale:clamp(source.academy?.morale,0,100,fallback.academy.morale),fatigue:clamp(source.academy?.fatigue,0,100,fallback.academy.fatigue),
   lastTrainingAttendance:source.academy?.lastTrainingAttendance&&typeof source.academy.lastTrainingAttendance==='object'?{season:integer(source.academy.lastTrainingAttendance.season,2026,9999,season),week:integer(source.academy.lastTrainingAttendance.week,1,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,integer(source.week,1,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,1)),attended:integer(source.academy.lastTrainingAttendance.attended,0,100,0),total:integer(source.academy.lastTrainingAttendance.total,0,100,0),schoolBreak:Boolean(source.academy.lastTrainingAttendance.schoolBreak)}:null,
   seasonsInLeague:integer(source.academy?.seasonsInLeague,0,99,0),secondarySeasons:integer(source.academy?.secondarySeasons,0,99,0),lastAssessmentSeason:integer(source.academy?.lastAssessmentSeason,0,9999,0),
   styleId:getPlayingStyle(source.academy?.styleId)?.id||'youth-first',familiarity:clamp(source.academy?.familiarity,0,100,fallback.academy.familiarity),training:normalizeSchedule(source.academy?.training,'academy')
  },
  facilities:{},staff:{},projects:[],careerWorld:null,footballOperations:null,squads:{first:null,u23:null,academy:null,b:null,bU23:null},recruitment:null,competitions:{first:null,u23:null,academy:null,academyByAge:{},b:null},
  finance:{
   cash:money(source.finance?.cash,fallback.finance.cash),debt:money(source.finance?.debt,0,0),loanWeeksRemaining:integer(source.finance?.loanWeeksRemaining,0,FOOTBALL_GAME_ASSUMPTIONS.startupLoanTermSeasons*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,source.finance?.debt>0?FOOTBALL_GAME_ASSUMPTIONS.startupLoanTermSeasons*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks:0),
   weeklyFirstTeamBudget:money(source.finance?.weeklyFirstTeamBudget,5000,0),ownerInvested:money(source.finance?.ownerInvested,site.acquisitionCostAud+site.initialClearanceCostAud+fallback.finance.cash,0),
   ownerWithdrawn:money(source.finance?.ownerWithdrawn,0,0),missedPayrollWeeks:integer(source.finance?.missedPayrollWeeks,0,999,0),
   seasonIncome:money(source.finance?.seasonIncome,0,0),seasonExpenses:money(source.finance?.seasonExpenses,0,0),lastWeekly:null,lastSettledKey:cleanText(source.finance?.lastSettledKey,30,''),history:normalizeFinanceHistory(source.finance?.history),ledger:normalizeLedger(source.finance?.ledger)
  },
  metrics:{
   seasons:integer(source.metrics?.seasons,0,999,0),promotions:integer(source.metrics?.promotions,0,999,0),relegations:integer(source.metrics?.relegations,0,999,0),trophies:integer(source.metrics?.trophies,0,999,0),
   seniorWins:integer(source.metrics?.seniorWins,0,99999,0),academyGraduates:integer(source.metrics?.academyGraduates,0,99999,0),nplSeasons:integer(source.metrics?.nplSeasons,0,999,0),
   nplTitles:integer(source.metrics?.nplTitles,0,999,0),attendanceTotal:integer(source.metrics?.attendanceTotal,0,999_999_999,0),homeMatches:integer(source.metrics?.homeMatches,0,99_999,0),lastALeagueBidSeason:integer(source.metrics?.lastALeagueBidSeason,0,9999,0)
  },
  objectives:{claimed:unique((Array.isArray(source.objectives?.claimed)?source.objectives.claimed:[]).map(String).filter(id=>FOOTBALL_OBJECTIVES.some(item=>item.id===id))).slice(-40)},
  counters:{project:integer(source.counters?.project,0,999999,0),match:integer(source.counters?.match,0,999999,0)},events:normalizeEvents(source.events)
 };
 const generatedFallback={
  first:createSquad(state.seed,'first',54),u23:createSquad(state.seed,'u23',47),academy:createSquad(state.seed,'academy',43)
 };
 state.squads.first=normalizeSquad(source.squads?.first,generatedFallback.first,'first');
 state.squads.u23=normalizeSquad(source.squads?.u23,generatedFallback.u23,'u23');
 state.squads.academy=normalizeSquad(source.squads?.academy,generatedFallback.academy,'academy');
 const hasSourceB=source.b&&typeof source.b==='object'&&source.b.unlocked!==false;
 if(hasSourceB){
  const bDivisionId=getSeniorDivision(source.b.divisionId)?.id||source.club?.queenslandPathwayDivisionId||'npl-qld',bBase=divisionBaseStrength(bDivisionId);
  state.squads.b=normalizeSquad(source.squads?.b,createSquad(`${state.seed}|b-team`,'first',clamp(bBase-3,40,82)),'first');
  state.squads.bU23=normalizeSquad(source.squads?.bU23,createSquad(`${state.seed}|b-u23`,'u23',clamp(bBase-10,35,74)),'u23');
 }
 const recruitmentContext={siteTalent:site.talent,reputation:state.club.reputation,interest:state.academy.trialInterest,staffLevel:integer(source.staff?.recruitment,0,4,0)};
 const generatedRecruitment=generateRecruitment(state.seed,state.season,state.week,divisionId,state.academy.talent,recruitmentContext),rawRecruitment=source.recruitment&&typeof source.recruitment==='object'?source.recruitment:null;
 const normalizedMarket=(Array.isArray(rawRecruitment?.market)?rawRecruitment.market:[]).map((player,index)=>normalizeRecruitPlayer(player,index,'first')).filter(Boolean).slice(0,10);
 const normalizedTrialists=(Array.isArray(rawRecruitment?.trialists)?rawRecruitment.trialists:[]).map((player,index)=>normalizeRecruitPlayer(player,index,'academy')).filter(Boolean).slice(0,10);
 const currentRecruitment=rawRecruitment?.key===generatedRecruitment.key&&Array.isArray(rawRecruitment.market)&&Array.isArray(rawRecruitment.trialists);
 const savedFunnel=rawRecruitment?.funnel||source.academy?.trials;
 state.recruitment=currentRecruitment?{key:generatedRecruitment.key,market:normalizedMarket,trialists:normalizedTrialists,funnel:normalizeRecruitmentFunnel(savedFunnel,generatedRecruitment.funnel)}:generatedRecruitment;
 state.academy.trials=clone(state.recruitment.funnel);
 for(const id of ACADEMY_SERVICE_IDS)state.academy.services[id]=clamp(source.academy?.services?.[id],0,100,fallback.academy.services[id]);
 for(const definition of FACILITY_UPGRADES){
  const maximum=definition.id==='fields'?site.maxFields:definition.maxLevel;
  const minimum=definition.id==='clubhouse'?1:definition.id==='pitch'&&site.readyFields>0?1:0;
  const defaultLevel=definition.id==='fields'?site.readyFields:minimum;
  state.facilities[definition.id]=integer(source.facilities?.[definition.id],minimum,maximum,defaultLevel);
 }
 for(const role of STAFF_ROLES)state.staff[role.id]=integer(source.staff?.[role.id],0,role.maxLevel,role.id==='head-coach'||role.id==='academy-director'||role.id==='grounds-team'?1:0);
 const hasFootballOperations=Boolean(source.footballOperations&&typeof source.footballOperations==='object');
 state.footballOperations=hasFootballOperations
  ?normalizeFootballOperations(source.footballOperations,{seed:state.seed,season:state.season,week:Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),legacyStaff:state.staff})
  :createFootballOperations({seed:state.seed,season:state.season,week:Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),legacyStaff:state.staff});
 const secondary=source.academy?.secondaryLeagueId;
 if(state.academy.leagueId==='fqa-1'&&['fqa-4','fqa-3','fqa-2'].includes(secondary))state.academy.secondaryLeagueId=secondary;
 if(state.academy.tier===2)state.academy.shield='development-committed';
 if(state.academy.tier===1&&state.academy.shield==='development-committed')state.academy.shield=state.academy.score>=75?'gold':state.academy.score>=55?'silver':'bronze';
 const rawB=source.b&&typeof source.b==='object'&&source.b.unlocked!==false?source.b:null;
 if(rawB){
  const bDivision=getSeniorDivision(rawB.divisionId)?.id||'fqpl-6';
  state.b={unlocked:true,divisionId:bDivision,styleId:getPlayingStyle(rawB.styleId)?.id||'youth-first',morale:clamp(rawB.morale,0,100,52),fatigue:clamp(rawB.fatigue,0,100,8),familiarity:clamp(rawB.familiarity,0,100,50),training:normalizeSchedule(rawB.training,'b'),origin:'queensland-pathway',hasU23:true,u23SquadKey:'bU23',annualLicenceAud:FOOTBALL_GAME_ASSUMPTIONS.bTeamAnnualLicenceAud};
 }
 state.competitions.first=normalizeCompetition(source.competitions?.first,divisionId,'first',state.leagueMemberships);
 state.competitions.u23=normalizeCompetition(source.competitions?.u23,divisionId,'u23',state.leagueMemberships);
 const rawAcademyDivision=source.competitions?.academyByAge?.u18?.divisionId||source.competitions?.academy?.divisionId,assessmentTransition=state.academy.lastAssessmentSeason===state.season;
 const academyCompetitionDivision=ACADEMY_LEAGUES.includes(rawAcademyDivision)&&(rawAcademyDivision===state.academy.leagueId||assessmentTransition)?rawAcademyDivision:state.academy.leagueId;
 const rawAcademyByAge=source.competitions?.academyByAge&&typeof source.competitions.academyByAge==='object'?source.competitions.academyByAge:{},legacyAcademy=source.competitions?.academy;
 for(const ageGroup of ACADEMY_AGE_GROUPS){
  const rawCompetition=rawAcademyByAge[ageGroup]||(ageGroup==='u18'?legacyAcademy:null);
  state.competitions.academyByAge[ageGroup]=normalizeCompetition(rawCompetition,academyCompetitionDivision,'academy');
 }
 const legacyRound=integer(legacyAcademy?.round,0,academyRoundCount(),0),legacyPlayedRound=integer(legacyAcademy?.playedRound,-1,legacyRound,-1),completedAcademyRounds=Math.min(academyRoundCount(),legacyRound+(legacyPlayedRound===legacyRound?1:0));
 for(const ageGroup of ACADEMY_AGE_GROUPS)if(ageGroup!=='u18'&&!rawAcademyByAge[ageGroup])backfillAcademyCompetitionInPlace(state,state.competitions.academyByAge[ageGroup],ageGroup,completedAcademyRounds,legacyRound,legacyPlayedRound===legacyRound);
 state.competitions.academy=state.competitions.academyByAge.u18;
 if(state.b)state.competitions.b=normalizeCompetition(source.competitions?.b,state.b.divisionId,'b',state.leagueMemberships);
 const hadCareerWorld=source.careerWorld&&typeof source.careerWorld==='object',careerWeek=Math.min(FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,state.week);
 const careerContext={seed:state.seed,season:state.season,week:careerWeek,clubId:'player-club',players:careerPlayersForSync(state.squads.first,state.season,careerWeek,hadCareerWorld?source.careerWorld.players:[])};
 state.careerWorld=hadCareerWorld?normalizeCareerWorld(source.careerWorld,careerContext):createCareerWorld({...careerContext,aiClubs:aiClubInputs(divisionId,state.leagueMemberships)});
 if(!hadCareerWorld||Number(source.careerWorld?.schemaVersion||0)<2)initialiseCareerCompetitionsInPlace(state,{registerAll:true});
 const existingCareerAI=new Set(state.careerWorld.aiClubs.map(club=>club.id)),careerAIInputs=aiClubInputs(divisionId,state.leagueMemberships).map(club=>existingCareerAI.has(club.id)?{id:club.id,name:club.name,divisionId:club.divisionId}:club);
 state.careerWorld=syncAIClubs(state.careerWorld,careerAIInputs);
 syncRootPlayersFromCareerInPlace(state);
 if(source.finance?.lastWeekly&&typeof source.finance.lastWeekly==='object')state.finance.lastWeekly={
  income:money(source.finance.lastWeekly.income,0,0),expenses:money(source.finance.lastWeekly.expenses,0,0),net:money(source.finance.lastWeekly.net,0),week:integer(source.finance.lastWeekly.week,1,60,state.week)
 };
 if(state.finance.debt===0)state.finance.loanWeeksRemaining=0;
 const projectIds=new Set(),projectFacilities=new Set();
 for(const [index,raw] of (Array.isArray(source.projects)?source.projects:[]).slice(-20).entries()){
  const project=normalizeProject(raw,index,state.facilities,site,state.clockMs);
  if(project&&!projectIds.has(project.id)&&!projectFacilities.has(project.facilityId)){state.projects.push(project);projectIds.add(project.id);projectFacilities.add(project.facilityId)}
 }
 if(options&&Number.isFinite(Number(options.nowMs)))reconcileProjectsInPlace(state,Number(options.nowMs));
 return state;
}

function pushEvent(state,event){
 const normalized={
  type:cleanId(event.type,50)||'event',code:cleanId(event.code,60),season:state.season,week:state.week,message:cleanText(event.message,240,'Club update')
 };
 state.events=[...state.events.slice(-39),normalized];
 return {...event,...normalized};
}

function operation(state,event,ok=true,extra={}){
 const recorded=pushEvent(state,event);
 return {ok,state,event:recorded,code:recorded.code,message:recorded.message,...extra};
}
function failure(input,code,message,extra={}){
 const state=normalizeFootballState(input);
 return operation(state,{type:'football-error',code,message},false,extra);
}

export function startClub(options={}){
 const site=getStartSite(options.siteId||'burpengary');
 if(!site)return {ok:false,state:null,event:{type:'football-error',code:'site-unknown',message:'Choose a valid Queensland start site.'}};
 const clubName=cleanText(options.name??options.clubName,48,'');
 if(clubName.length<2)return {ok:false,state:null,event:{type:'football-error',code:'club-name-invalid',message:'Enter a club name with at least two characters.'}};
 const foundingCost=site.acquisitionCostAud+site.initialClearanceCostAud,loanRaw=options.startupLoanAud??0,investmentRaw=options.ownerInvestmentAud??(foundingCost+2_000_000);
 if(!Number.isSafeInteger(Number(loanRaw))||Number(loanRaw)<0||Number(loanRaw)>FOOTBALL_GAME_ASSUMPTIONS.startupLoanMaxAud)return {ok:false,state:null,event:{type:'football-error',code:'startup-loan-invalid',message:`The startup loan must be a whole-dollar amount from $0 to $${FOOTBALL_GAME_ASSUMPTIONS.startupLoanMaxAud.toLocaleString()}.`}};
 if(!Number.isSafeInteger(Number(investmentRaw))||Number(investmentRaw)<0)return {ok:false,state:null,event:{type:'football-error',code:'owner-investment-invalid',message:'Owner investment must be a non-negative whole-dollar amount.'}};
 const startupLoan=Number(loanRaw),ownerInvestment=Number(investmentRaw),minimumAvailable=foundingCost;
 if(ownerInvestment+startupLoan<minimumAvailable)return {ok:false,state:null,event:{type:'football-error',code:'capital-insufficient',message:`Acquisition, initial clearance and working cash require at least $${minimumAvailable.toLocaleString()} in combined owner investment and startup lending.`}};
 const division=getSeniorDivision('fqpl-6'),weeklyBudget=money(options.weeklyFirstTeamBudget,5000,0),academyFeeRaw=options.academyFeeAud??1750,academyFee=Number(academyFeeRaw);
 if(weeklyBudget<500||weeklyBudget>division.weeklyBudgetMax)return {ok:false,state:null,event:{type:'football-error',code:'senior-budget-invalid',message:`Set a starting weekly first-team budget between $500 and $${division.weeklyBudgetMax.toLocaleString()}.`}};
 if(!Number.isSafeInteger(academyFee)||academyFee<0||academyFee>15_000)return {ok:false,state:null,event:{type:'football-error',code:'academy-fee-invalid',message:'Set a starting academy fee between $0 and $15,000.'}};
 if(options.playingStyle&&!getPlayingStyle(options.playingStyle))return {ok:false,state:null,event:{type:'football-error',code:'style-unknown',message:'Choose a recognised starting football style.'}};
 const state=normalizeFootballState(createDefaultState({...options,name:clubName,siteId:site.id,ownerInvestmentAud:ownerInvestment,startupLoanAud:startupLoan,academyFeeAud:academyFee,weeklyFirstTeamBudget:weeklyBudget}));
 return operation(state,{type:'club-started',code:'club-started',message:`${state.club.name} has entered FQPL 6 Metro with an FQ Academy League 4 program.`},true,{site:clone(site),walletDeltaAud:-ownerInvestment,foundingCostAud:foundingCost,startupLoanAud:startupLoan});
}

function competitionFor(state,squad='first'){
 if(squad==='b')return state.competitions.b;
 if(squad==='u23')return state.competitions.u23;
 if(squad==='academy')return state.competitions.academy;
 return state.competitions.first;
}

function squadSelectionKey(squad='first'){return squad==='academy'?'academy':squad==='b'?'b':squad==='b-u23'?'bU23':squad==='u23'?'u23':'first'}

function teamName(state,id,squad='first'){
 if(id===PLAYER_FIRST_TEAM_ID)return state.club.name;
 if(id===PLAYER_B_TEAM_ID)return `${state.club.name} B`;
 if(id===PLAYER_U23_TEAM_ID)return `${state.club.name} U23`;
 if(id===PLAYER_ACADEMY_TEAM_ID)return `${state.club.name} Academy`;
 if(String(id).startsWith('academy-invitational-'))return 'Academy Invitational XI';
 const reference=squad==='academy'?ACADEMY_REFERENCE_TEAMS.get(id):REFERENCE_TEAMS.get(id),name=reference?.name||id;
 return squad==='u23'?`${name} U23`:name;
}

function tableRowObject(state,id,row,squad='first'){
 const reference=squad==='academy'?ACADEMY_REFERENCE_TEAMS.get(id):REFERENCE_TEAMS.get(id);
 return {teamId:id,name:teamName(state,id,squad),played:row[0],won:row[1],drawn:row[2],lost:row[3],gf:row[4],ga:row[5],gd:row[4]-row[5],points:row[6],isPlayer:id===competitionPlayerId(squad),badgeKey:reference?.badgeKey||null};
}

function sortedTable(state,competition,squad='first'){
 return competition.teams.map(id=>tableRowObject(state,id,competition.table[id]||[0,0,0,0,0,0,0],squad)).sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name)).map((row,index)=>({...row,position:index+1}));
}

export function getDivisionTable(input,squad='first'){
 const state=normalizeFootballState(input),competition=competitionFor(state,squad);
 return competition?sortedTable(state,competition,squad):[];
}

function academyAgeGroupTableInState(state,ageGroup){
 const competition=state.competitions.academyByAge?.[ageGroup]||state.competitions.academy;
 return sortedTable(state,competition,'academy').map(row=>({...row,ageGroup}));
}

function backfillAcademyCompetitionInPlace(state,competition,ageGroup,completedRounds,legacyRound,pendingPlayed){
 competition.table=emptyTable(competition.teams);competition.results=[];competition.lastResult=null;
 const playerId=PLAYER_ACADEMY_TEAM_ID,total=Math.min(academyRoundCount(),completedRounds);
 for(let round=0;round<total;round++){
  const fixtures=buildAcademyRoundFixtures(competition.teams,round,state.season,`${competition.divisionId}-${ageGroup}`),resolved=fixtures.map(fixture=>resolveFixture(state,fixture,'academy',{ageGroup}));
  for(const result of resolved)applyTableResult(competition.table,result);
  const playerResult=resolved.find(result=>result.home===playerId||result.away===playerId)||null;
  if(playerResult){competition.lastResult=playerResult;competition.results=[...competition.results.slice(-59),playerResult]}
 }
 competition.round=Math.min(academyRoundCount(),legacyRound);
 competition.playedRound=pendingPlayed?competition.round:Math.max(-1,competition.round-1);
 return competition;
}

export function getAcademyAgeGroupTable(input,ageGroup='u18'){
 const state=normalizeFootballState(input),selected=String(ageGroup).toLowerCase();
 if(selected!=='all'&&!ACADEMY_AGE_GROUPS.includes(selected))return academyAgeGroupTableInState(state,'u18');
 if(selected!=='all')return academyAgeGroupTableInState(state,selected);
 const combined=new Map();
 for(const group of ACADEMY_AGE_GROUPS)for(const row of academyAgeGroupTableInState(state,group)){
  const current=combined.get(row.teamId)||{...row,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,points:0,ageGroup:'all'};
  for(const key of ['played','won','drawn','lost','gf','ga','points'])current[key]+=row[key];
  current.gd=current.gf-current.ga;combined.set(row.teamId,current);
 }
 return [...combined.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name)).map((row,index)=>({...row,position:index+1}));
}

export function getAcademyAgeGroupFixtures(input,ageGroup='u18',roundOverride){
 const state=normalizeFootballState(input),selected=ACADEMY_AGE_GROUPS.includes(String(ageGroup).toLowerCase())?String(ageGroup).toLowerCase():'u18',competition=state.competitions.academyByAge[selected],round=Number.isInteger(roundOverride)?roundOverride:competition.round;
 const fixtureDivision=selected==='u18'?competition.divisionId:`${competition.divisionId}-${selected}`;
 const scheduledWeek=academyWeekForRound(round),rescheduled=(state.week>scheduledWeek||academyIsRainPostponed(state,round))&&competition.playedRound!==round;
 return buildAcademyRoundFixtures(competition.teams,round,state.season,fixtureDivision).map(fixture=>({...fixture,ageGroup:selected,scheduledWeek,scheduledDay:rescheduled?'Wednesday':'Weekend',rescheduled,rescheduleReason:rescheduled?'Rain make-up':'',schoolBreak:false,homeName:teamName(state,fixture.home,'academy'),awayName:teamName(state,fixture.away,'academy'),isPlayer:[fixture.home,fixture.away].includes(PLAYER_ACADEMY_TEAM_ID),played:competition.playedRound===round,result:competition.playedRound===round&&competition.lastResult?.id===fixture.id?clone(competition.lastResult):null}));
}

export function getCompetitionDisplayName(divisionId,season=2026){
 const division=getSeniorDivision(divisionId);
 if(!division)return '';
 return Number(season)>=2027&&division.id.startsWith('fqpl-')?division.name.replace(/^FQPL\b/,'QPL'):division.name;
}

export function buildRoundFixtures(teamIds,round,season=2026,divisionId='league'){
 const teams=[...teamIds];
 if(teams.length%2)teams.push(null);
 const perLeg=teams.length-1,total=perLeg*2;
 if(round<0||round>=total)return [];
 const leg=Math.floor(round/perLeg),roundInLeg=round%perLeg;
 let rotation=[...teams];
 for(let index=0;index<roundInLeg;index++)rotation=[rotation[0],rotation[rotation.length-1],...rotation.slice(1,-1)];
 const fixtures=[];
 for(let index=0;index<rotation.length/2;index++){
  let home=rotation[index],away=rotation[rotation.length-1-index];
  if((roundInLeg+index)%2===1)[home,away]=[away,home];
  if(leg===1)[home,away]=[away,home];
  if(!home||!away)continue;
  fixtures.push({id:`${season}:${divisionId}:${round+1}:${home}:${away}`,round,home,away});
 }
 return fixtures;
}

export function getRoundFixtures(input,squad='first',roundOverride){
 const state=normalizeFootballState(input),competition=competitionFor(state,squad);
 if(!competition)return [];
 const round=Number.isInteger(roundOverride)?roundOverride:competition.round,playerId=competitionPlayerId(squad);
 return buildRoundFixtures(competition.teams,round,state.season,competition.divisionId).map(fixture=>({
  ...fixture,scheduledWeek:leagueWeekForRound(round),homeName:teamName(state,fixture.home,squad),awayName:teamName(state,fixture.away,squad),isPlayer:fixture.home===playerId||fixture.away===playerId,
  played:competition.playedRound===round,result:competition.playedRound===round&&competition.lastResult?.id===fixture.id?clone(competition.lastResult):null
 }));
}

export function getCurrentFixture(input,squad='first'){
 const state=normalizeFootballState(input),competition=competitionFor(state,squad);
 if(!competition)return null;
 if(squad==='academy'){
  const playerId=PLAYER_ACADEMY_TEAM_ID,fixtures=getAcademyAgeGroupFixtures(state,'u18'),fixture=fixtures.find(item=>item.home===playerId||item.away===playerId),scheduledWeek=academyWeekForRound(competition.round);
  if(fixture)return {...fixture,canSimulate:state.week>=scheduledWeek,bye:false};
  if(competition.round>=academyRoundCount())return null;
  return {id:`${state.season}:${competition.divisionId}:academy-${competition.round+1}:bye:${playerId}`,round:competition.round,scheduledWeek,scheduledDay:state.week>scheduledWeek?'Wednesday':'Weekend',rescheduled:state.week>scheduledWeek,canSimulate:state.week>=scheduledWeek,home:null,away:null,homeName:'',awayName:'',isPlayer:true,played:competition.playedRound===competition.round,result:null,bye:true};
 }
 const playerId=competitionPlayerId(squad),fixtures=getRoundFixtures(state,squad),fixture=fixtures.find(item=>item.home===playerId||item.away===playerId);
 if(fixture)return {...fixture,scheduledWeek:leagueWeekForRound(competition.round),canSimulate:state.week>=leagueWeekForRound(competition.round),bye:false};
 if(competition.round>=roundCount(competition.teams))return null;
 return {id:`${state.season}:${competition.divisionId}:${competition.round+1}:bye:${playerId}`,round:competition.round,scheduledWeek:leagueWeekForRound(competition.round),canSimulate:state.week>=leagueWeekForRound(competition.round),home:null,away:null,homeName:'',awayName:'',isPlayer:true,played:competition.playedRound===competition.round,result:null,bye:true};
}

function facilityEffect(state,facilityId,key){
 const definition=getFacility(facilityId),level=state.facilities[facilityId]||0;
 return definition?.levels.find(item=>item.level===level)?.[key]||0;
}

function holderFor(state,squad='first'){
 if(squad==='b')return state.b;
 if(squad==='u23')return state.u23;
 if(squad==='academy')return state.academy;
 return state.first;
}

function baseStrengthFor(state,squad='first'){
 if(squad==='academy')return ACADEMY_STRENGTH_BY_LEAGUE[state.academy.leagueId]||43;
 const divisionId=holderFor(state,squad)?.divisionId||state.first.divisionId;
 return divisionBaseStrength(divisionId)+(squad==='u23'?-7:0);
}

function lineupPositionReport(selection,formation=selection?.formation||'4-3-3'){
 const required=formationCounts(formation),actual=Object.fromEntries(PLAYER_POSITIONS.map(position=>[position,0]));
 for(const player of selection?.players||[])if(selection.lineup?.includes(player.id))actual[player.position]=(actual[player.position]||0)+1;
 const shortages=Object.fromEntries(PLAYER_POSITIONS.map(position=>[position,Math.max(0,required[position]-actual[position])]));
 const excesses=Object.fromEntries(PLAYER_POSITIONS.map(position=>[position,Math.max(0,actual[position]-required[position])]));
 const misplaced=Object.values(shortages).reduce((sum,value)=>sum+value,0),suitability=Math.round(clamp(1-misplaced/11,0,1,0)*100)/100;
 return {formation,required,actual,shortages,excesses,misplaced,suitability,suitable:actual.GK===1&&misplaced<=2};
}

function trainingProgramme(holder){
 const schedule=holder?.training||defaultSchedule('first'),intensity=findIntensity(schedule.intensity),totals={load:0,recovery:0,development:0,familiarity:0,attack:0,control:0,defence:0,injuryRisk:0};
 for(const activity of Object.values(schedule.activities||{}))for(const key of Object.keys(totals))totals[key]+=finite(trainingSessionEffect(activity)[key],0);
 const preparedSessions=Object.values(schedule.activities||{}).filter(activity=>!['rest','recovery'].includes(activity)).length;
 return {...totals,intensity,preparedSessions,matchBonus:intensity.match+(totals.attack+totals.control+totals.defence)/6};
}

function managerCoachingEffect(state,squad='first'){
 if(state.manager.mode==='coach'&&state.manager.controlledSquad===squad)return {bonus:3.5,development:1.18,delegated:false,controlled:true};
 if(state.manager.mode==='club')return squad==='first'?{bonus:1.5,development:1.06,delegated:false,controlled:true}:{bonus:.6,development:1.02,delegated:true,controlled:false};
 const staffBonus=squad==='academy'?(state.staff['academy-director']||0)*.45:(state.staff['head-coach']||0)*.35;
 return {bonus:Math.min(1.8,staffBonus),development:1,delegated:true,controlled:false};
}

export function getManagerResponsibilities(input){
 const state=normalizeFootballState(input),squads=state.b?['first','u23','academy','b']:['first','u23','academy'];
 return {role:state.managerRole,mode:state.manager.mode,controlledSquad:state.manager.mode==='club'?'first':state.manager.controlledSquad,delegatedSquads:squads.filter(squad=>managerCoachingEffect(state,squad).delegated),squads:Object.fromEntries(squads.map(squad=>[squad,managerCoachingEffect(state,squad)]))};
}

function pitchConditionInState(state){
 const pitch=facilityEffect(state,'pitch','quality'),drainage=facilityEffect(state,'drainage','reliability'),grounds=(state.staff['grounds-team']||0)*8,facilityBaseline=38+pitch*1.05+drainage*.35+grounds,operational=integer(state.careerWorld?.matchday?.pitchCondition,0,100,82);
 return Math.round(clamp(operational*.62+facilityBaseline*.38,20,100,50));
}

export function getPitchCondition(input){return pitchConditionInState(normalizeFootballState(input))}

function playerStrength(state,squad='first'){
 const team=holderFor(state,squad),base=baseStrengthFor(state,squad),selection=state.squads[squadSelectionKey(squad)],xi=selection.players.filter(player=>selection.lineup.includes(player.id));
 const xiRating=xi.length?xi.reduce((sum,player)=>sum+player.rating,0)/xi.length:base,xiFatigue=xi.length?xi.reduce((sum,player)=>sum+player.fatigue,0)/xi.length:team.fatigue,xiMorale=xi.length?xi.reduce((sum,player)=>sum+player.morale,0)/xi.length:team.morale;
 let resourceBonus=0,staffBonus=(state.staff['head-coach']||0)*2.2+(state.staff.analysts||0)*1.2;
 if(squad==='academy'){
  staffBonus=(state.staff['academy-director']||0)*2.6+(state.staff.recruitment||0)*.8;
  resourceBonus=(state.academy.talent-50)*.11+(state.academy.score-50)*.055;
 }else{
  const division=getSeniorDivision(team?.divisionId||state.first.divisionId),range=Math.max(1,division.weeklyBudgetMax-division.weeklyBudgetMin),budget=squad==='first'?state.finance.weeklyFirstTeamBudget:state.finance.weeklyFirstTeamBudget*(squad==='b'?.22:.28);
  resourceBonus=clamp((budget-division.weeklyBudgetMin)/range,0,1)*10+(squad==='b'?-7+state.academy.talent*.04:squad==='u23'?-2+state.academy.talent*.025:0);
 }
 const training=trainingProgramme(team),coaching=managerCoachingEffect(state,squad),positionReport=lineupPositionReport(selection),formation=formationProfile(selection.formation);
 const facilityBonus=facilityEffect(state,'pitch','quality')*.12+facilityEffect(state,'analysis','match')*.22+facilityEffect(state,'training','development')*.08+facilityEffect(state,'drainage','reliability')*.025+facilityEffect(state,'floodlights','trainingAccess')*.035+facilityEffect(state,'gym','development')*.06+(state.staff['grounds-team']||0)*.22+(squad==='academy'?facilityEffect(state,'academy','academy')*.11:0);
 const morale=(team.morale-50)*.08+(xiMorale-50)*.04,fatigue=team.fatigue*.065+xiFatigue*.035,reputation=(state.club.reputation-50)*.04,selectionBonus=(xiRating-base)*.28,familiarity=(team.familiarity-50)*.055,formationBalance=(formation.attack+formation.control+formation.defence)*.08,positionPenalty=positionReport.misplaced*1.7;
 return clamp(base-5+resourceBonus+staffBonus+facilityBonus+morale-fatigue+reputation+selectionBonus+familiarity+training.matchBonus*.32+coaching.bonus+formationBalance-positionPenalty,20,98);
}

function academyAgeStrengthDelta(state,id,ageGroup){
 if(!ageGroup)return 0;
 const ageIndex=ACADEMY_AGE_GROUPS.indexOf(ageGroup),profile=((hashString(`${state.seed}|academy-age-profile|${id}|${ageGroup}`)%2001)-1000)/240;
 return profile+(ageIndex-2.5)*.35;
}

function teamStrength(state,id,squad,ageGroup=''){
 if(id===competitionPlayerId(squad))return playerStrength(state,squad)+(squad==='academy'?academyAgeStrengthDelta(state,id,ageGroup):0);
 if(squad==='academy'){
  const reference=ACADEMY_REFERENCE_TEAMS.get(id),base=baseStrengthFor(state,squad);
  return (reference?clamp(base+(reference.rankScore-50)*.22,25,86):base)+academyAgeStrengthDelta(state,id,ageGroup);
 }
 const careerStrength=state.careerWorld?.aiClubs?.find(club=>club.id===id)?.strength,reference=careerStrength||REFERENCE_TEAMS.get(id)?.gameStrength||divisionBaseStrength(holderFor(state,squad)?.divisionId||state.first.divisionId);
 return squad==='u23'?reference-7:reference;
}

function tacticalProfile(state,id,squad,ageGroup=''){
 if(id===competitionPlayerId(squad)){
  const selection=state.squads[squadSelectionKey(squad)],holder=holderFor(state,squad),style=getPlayingStyle(holder?.styleId)||getPlayingStyle('balanced'),formation=formationProfile(selection?.formation),training=trainingProgramme(holder),coaching=managerCoachingEffect(state,squad);
  return {formationId:selection?.formation||'4-3-3',styleId:style.id,attack:style.attack+formation.attack+training.attack*.34+training.intensity.match*.35,control:style.control+formation.control+training.control*.32,defence:formation.defence+training.defence*.34,variance:style.variance,fatigue:style.fatigue*formation.fatigue,pressing:formation.pressing+(style.id==='high-press'?3:style.id==='low-block'?-2:0),width:formation.width,coachingBonus:coaching.bonus,delegated:coaching.delegated};
 }
 const hash=hashString(`${id}|${squad}|${ageGroup}`),careerClub=state.careerWorld?.aiClubs?.find(club=>club.id===id),formationId=FORMATIONS.includes(careerClub?.formation)?careerClub.formation:FORMATIONS[hash%FORMATIONS.length],styleId=getPlayingStyle(careerClub?.style)?.id||AI_STYLE_IDS[Math.floor(hash/FORMATIONS.length)%AI_STYLE_IDS.length],formation=formationProfile(formationId),style=getPlayingStyle(styleId)||getPlayingStyle('balanced'),coachingBonus=careerClub?clamp(careerClub.manager?.ability/35,0,3,1):((hash>>>8)%21)/10;
 return {formationId,styleId,attack:style.attack+formation.attack,control:style.control+formation.control,defence:formation.defence,variance:style.variance,fatigue:style.fatigue*formation.fatigue,pressing:formation.pressing+(style.id==='high-press'?3:style.id==='low-block'?-2:0),width:formation.width,coachingBonus,delegated:true};
}

function tacticalMatchup(own,opponent){
 const counters={possession:{'low-block':.8,'high-press':-1.25,direct:-.45},'high-press':{possession:1.65,direct:.55,'low-block':-.7},counterattack:{'high-press':2.1,possession:.75,'low-block':-.85},direct:{possession:1.2,'high-press':-.55,'low-block':-1.25},'low-block':{direct:1.45,possession:-.55,counterattack:.85},balanced:{}};
 const styleEdge=counters[own.styleId]?.[opponent.styleId]||0,midfield=(own.control-opponent.control)*.18,widthEdge=(own.width-opponent.width)*.12,pressingEdge=(own.pressing-opponent.pressing)*.07;
 return clamp(styleEdge+midfield+widthEdge+pressingEdge,-4,4,0);
}

export function getOpponentTacticalProfile(input,teamId,squad='first',ageGroup=''){
 const state=normalizeFootballState(input),key=['first','u23','academy','b'].includes(squad)?squad:'first',profile=tacticalProfile(state,String(teamId||''),key,ageGroup);
 return {teamId:String(teamId||''),formation:profile.formationId,styleId:profile.styleId,attack:Math.round(profile.attack*10)/10,control:Math.round(profile.control*10)/10,defence:Math.round(profile.defence*10)/10,pressing:Math.round(profile.pressing*10)/10,width:Math.round(profile.width*10)/10,coachingBonus:Math.round(profile.coachingBonus*10)/10,delegated:profile.delegated};
}

function generatedMatchPlayer(state,teamId,squad,random){
 if(teamId!==competitionPlayerId(squad))return null;
 const selection=state.squads[squadSelectionKey(squad)],xi=selection.players.filter(player=>selection.lineup.includes(player.id)&&isPlayerAvailable(player)),outfield=xi.filter(player=>player.position!=='GK');
 const weighted=outfield.flatMap(player=>Array(player.position==='FW'?3:player.position==='MF'?2:1).fill(player));
 return weighted.length?weighted[Math.floor(random()*weighted.length)]:xi[0]||null;
}

function generatedAssistPlayer(state,teamId,squad,random,scorerId=''){
 if(teamId!==competitionPlayerId(squad)||random()>.78)return null;
 const selection=state.squads[squadSelectionKey(squad)],candidates=selection.players.filter(player=>selection.lineup.includes(player.id)&&isPlayerAvailable(player)&&player.position!=='GK'&&player.id!==scorerId),weighted=candidates.flatMap(player=>Array(player.position==='MF'?3:player.position==='FW'?2:1).fill(player));
 return weighted.length?weighted[Math.floor(random()*weighted.length)]:null;
}

function matchIncidentRank(type){return type==='kickoff'?0:type==='goal'?1:type==='card'?2:type==='injury'?3:type==='commentary'?4:type==='full-time'?9:5}
function sortMatchIncidents(incidents){return incidents.sort((a,b)=>a.minute-b.minute||matchIncidentRank(a.type)-matchIncidentRank(b.type))}

function attachHalfIncidents(state,result,squad,half){
 const random=seededRandom(`${state.seed}|${result.id}|${squad}|half-${half}|incidents`),incidents=[];
 const minuteForGoal=()=>half===1?integer(3+random()*42,1,45,23):integer(46+random()*44,46,90,68);
 const minuteForCard=()=>half===1?integer(8+random()*35,1,45,27):integer(48+random()*39,46,90,69);
 for(const [teamId,goals] of [[result.home,result.homeGoals],[result.away,result.awayGoals]])for(let index=0;index<goals;index++){
  const scorer=generatedMatchPlayer(state,teamId,squad,random),assist=generatedAssistPlayer(state,teamId,squad,random,scorer?.id),minute=minuteForGoal(),playerName=scorer?.name||`${teamName(state,teamId,squad)} player`,assistText=assist?` Assisted by ${assist.name}.`:'';
  incidents.push({type:'goal',minute,teamId,playerId:scorer?.id||null,playerName,assistPlayerId:assist?.id||null,assistPlayerName:assist?.name||'',text:`${minute}' Goal — ${playerName} (${teamName(state,teamId,squad)}).${assistText}`});
 }
 for(const teamId of [result.home,result.away])if(random()<.24){
  const player=generatedMatchPlayer(state,teamId,squad,random),minute=minuteForCard(),playerName=player?.name||`${teamName(state,teamId,squad)} player`;
  incidents.push({type:'card',minute,teamId,playerId:player?.id||null,playerName,assistPlayerId:null,assistPlayerName:'',text:`${minute}' Yellow card — ${playerName}.`});
 }
 result.incidents=sortMatchIncidents(incidents);result.commentary=result.incidents.map(incident=>incident.text);
 return result;
}

function resolveFixtureHalf(state,fixture,squad,half=1,options={}){
 const ageGroup=squad==='academy'&&ACADEMY_AGE_GROUPS.includes(options.ageGroup)?options.ageGroup:'',homeStrength=teamStrength(state,fixture.home,squad,ageGroup),awayStrength=teamStrength(state,fixture.away,squad,ageGroup),homeTactic=tacticalProfile(state,fixture.home,squad,ageGroup),awayTactic=tacticalProfile(state,fixture.away,squad,ageGroup);
 const homeMatchup=tacticalMatchup(homeTactic,awayTactic),awayMatchup=tacticalMatchup(awayTactic,homeTactic),variance=(homeTactic.variance+awayTactic.variance)*.025,random=seededRandom(`${state.seed}|${fixture.id}|${squad}|${ageGroup}|half-${half}|score`);
 const playerHome=fixture.home===competitionPlayerId(squad)&&fixture.venue!=='neutral',pitchCondition=playerHome?pitchConditionInState(state):70,homeGround=fixture.venue==='neutral'?0:.18+(playerHome?(pitchCondition-60)/145:0);
 const playerFixture=squad==='first'&&(fixture.home===PLAYER_FIRST_TEAM_ID||fixture.away===PLAYER_FIRST_TEAM_ID),matchdayPreview=options.matchdayPreview||(playerFixture?careerPreviewMatchdayOperations(state.careerWorld,matchdayContextForFixtureInState(state,fixture)):null),weatherFactor=matchdayPreview?.weather?.condition==='heavy-rain'?.82:matchdayPreview?.weather?.condition==='showers'?.91:matchdayPreview?.weather?.condition==='hot'?.94:matchdayPreview?.weather?.condition==='windy'?.93:1,pitchFactor=clamp(.78+pitchCondition/320,.82,1.09,1);
 const homeExpected=clamp((1.2+(homeStrength-awayStrength)/27+homeTactic.attack*.048-awayTactic.defence*.043+homeMatchup*.075+homeTactic.coachingBonus*.025+homeGround+(random()-.5)*variance)*weatherFactor*pitchFactor,.1,4.8)/2;
 const awayExpected=clamp((1.08+(awayStrength-homeStrength)/27+awayTactic.attack*.048-homeTactic.defence*.043+awayMatchup*.075+awayTactic.coachingBonus*.025+(random()-.5)*variance)*weatherFactor*pitchFactor,.1,4.7)/2;
 const selection=state.squads[squadSelectionKey(squad)],playerTactic=fixture.home===competitionPlayerId(squad)?homeTactic:awayTactic;
 return attachHalfIncidents(state,{
  ...fixture,week:state.week,half,ageGroup:ageGroup||undefined,homeGoals:poisson(homeExpected,random),awayGoals:poisson(awayExpected,random),expectedGoals:{home:homeExpected,away:awayExpected},pitchCondition,
  tactics:{home:{formation:homeTactic.formationId,styleId:homeTactic.styleId,coachingBonus:homeTactic.coachingBonus,matchup:homeMatchup,delegated:homeTactic.delegated},away:{formation:awayTactic.formationId,styleId:awayTactic.styleId,coachingBonus:awayTactic.coachingBonus,matchup:awayMatchup,delegated:awayTactic.delegated}},
  playerLineupIds:selection?clone(selection.lineup):[],playerStyleFatigue:finite(playerTactic.fatigue,1)
 },squad,half);
}

function buildMatchStats(state,result,squad,firstHalf,secondHalf){
 const random=seededRandom(`${state.seed}|${result.id}|${squad}|match-statistics`),homeTactic=secondHalf.tactics?.home||firstHalf.tactics?.home||{},awayTactic=secondHalf.tactics?.away||firstHalf.tactics?.away||{};
 const fullXg={home:clamp(finite(firstHalf.expectedGoals?.home,0)+finite(secondHalf.expectedGoals?.home,0),.05,12,.8),away:clamp(finite(firstHalf.expectedGoals?.away,0)+finite(secondHalf.expectedGoals?.away,0),.05,12,.8)};
 const homeControl=(getPlayingStyle(homeTactic.styleId)?.control||0)+(formationProfile(homeTactic.formation).control||0),awayControl=(getPlayingStyle(awayTactic.styleId)?.control||0)+(formationProfile(awayTactic.formation).control||0),homePossession=Math.round(clamp(50+(homeControl-awayControl)*2.15+(random()-.5)*5.5,27,73,50));
 const shotsFor=(xg,goals)=>Math.max(goals,Math.round(xg*3.9+3+(random()-.5)*3)),onTargetFor=(xg,goals,shots)=>Math.min(shots,Math.max(goals,Math.round(xg*1.85+1+(random()-.5)*1.5)));
 const homeShots=shotsFor(fullXg.home,result.homeGoals),awayShots=shotsFor(fullXg.away,result.awayGoals),homeOnTarget=onTargetFor(fullXg.home,result.homeGoals,homeShots),awayOnTarget=onTargetFor(fullXg.away,result.awayGoals,awayShots);
 const cardsFor=teamId=>result.incidents.filter(incident=>incident.type==='card'&&incident.teamId===teamId).length;
 return {
  possession:{home:homePossession,away:100-homePossession},shots:{home:homeShots,away:awayShots},shotsOnTarget:{home:homeOnTarget,away:awayOnTarget},
  xG:{home:Math.round(fullXg.home*100)/100,away:Math.round(fullXg.away*100)/100},corners:{home:Math.max(0,Math.round(homeShots*.32+(random()-.5)*2)),away:Math.max(0,Math.round(awayShots*.32+(random()-.5)*2))},
  fouls:{home:Math.round(clamp(8+(getPlayingStyle(homeTactic.styleId)?.fatigue||1)*4+(random()-.5)*5,4,25,11)),away:Math.round(clamp(8+(getPlayingStyle(awayTactic.styleId)?.fatigue||1)*4+(random()-.5)*5,4,25,11))},
  yellowCards:{home:cardsFor(result.home),away:cardsFor(result.away)},redCards:{home:0,away:0}
 };
}

function mergeFixtureHalves(state,fixture,squad,firstHalf,secondHalf){
 const homeGoals=firstHalf.homeGoals+secondHalf.homeGoals,awayGoals=firstHalf.awayGoals+secondHalf.awayGoals;
 const playerTeamId=competitionPlayerId(squad),playerSide=fixture.home===playerTeamId?'home':'away',selection=state.squads[squadSelectionKey(squad)],changes=[];
 if(fixture.home===playerTeamId||fixture.away===playerTeamId){
  const off=(firstHalf.playerLineupIds||[]).filter(id=>!secondHalf.playerLineupIds?.includes(id)),on=(secondHalf.playerLineupIds||[]).filter(id=>!firstHalf.playerLineupIds?.includes(id));
  on.forEach((id,index)=>{const incoming=selection.players.find(player=>player.id===id),outgoing=selection.players.find(player=>player.id===off[index]);changes.push({type:'substitution',minute:45,teamId:playerTeamId,playerId:id,playerName:incoming?.name||'',text:`45' Substitution — ${incoming?.name||'Substitute'} on for ${outgoing?.name||'starter'}.`})});
  const before=firstHalf.tactics?.[playerSide],after=secondHalf.tactics?.[playerSide];
  if(before&&after&&(before.formation!==after.formation||before.styleId!==after.styleId))changes.push({type:'tactical-change',minute:45,teamId:playerTeamId,playerId:null,playerName:'',text:`45' Tactical change — ${after.formation}, ${getPlayingStyle(after.styleId)?.name||after.styleId}.`});
 }
 const incidents=sortMatchIncidents([
  {type:'kickoff',minute:0,teamId:null,playerId:null,playerName:'',text:'Kick-off.'},
  ...clone(firstHalf.incidents),
  {type:'commentary',minute:45,teamId:null,playerId:null,playerName:'',text:`Half time: ${teamName(state,fixture.home,squad)} ${firstHalf.homeGoals}–${firstHalf.awayGoals} ${teamName(state,fixture.away,squad)}.`},
  ...changes,
  ...clone(secondHalf.incidents),
  {type:'full-time',minute:90,teamId:null,playerId:null,playerName:'',text:`Full time: ${teamName(state,fixture.home,squad)} ${homeGoals}–${awayGoals} ${teamName(state,fixture.away,squad)}.`}
 ]);
 const tactics={home:{...secondHalf.tactics.home,matchup:Math.round((finite(firstHalf.tactics?.home?.matchup,0)+finite(secondHalf.tactics?.home?.matchup,0))*5)/10},away:{...secondHalf.tactics.away,matchup:Math.round((finite(firstHalf.tactics?.away?.matchup,0)+finite(secondHalf.tactics?.away?.matchup,0))*5)/10}};
 const merged={...fixture,week:state.week,ageGroup:secondHalf.ageGroup||firstHalf.ageGroup,pitchCondition:integer(secondHalf.pitchCondition,0,100,70),homeGoals,awayGoals,incidents,commentary:incidents.map(incident=>incident.text),tactics,halves:{first:clone(firstHalf),second:clone(secondHalf)}};
 merged.stats=buildMatchStats(state,merged,squad,firstHalf,secondHalf);return merged;
}

function resolveFixture(state,fixture,squad,options={}){
 const playerFixture=squad==='first'&&(fixture.home===PLAYER_FIRST_TEAM_ID||fixture.away===PLAYER_FIRST_TEAM_ID),matchdayPreview=playerFixture?careerPreviewMatchdayOperations(state.careerWorld,matchdayContextForFixtureInState(state,fixture)):null,halfOptions=matchdayPreview?{...options,matchdayPreview}:options;
 return mergeFixtureHalves(state,fixture,squad,resolveFixtureHalf(state,fixture,squad,1,halfOptions),resolveFixtureHalf(state,fixture,squad,2,halfOptions));
}

function normalizePreviewHalf(raw,fixture,state,squad,half){
 if(!raw||typeof raw!=='object'||raw.id!==fixture.id||raw.home!==fixture.home||raw.away!==fixture.away||Number(raw.half)!==half)return null;
 const minMinute=half===1?1:46,maxMinute=half===1?45:90,validTeams=new Set([fixture.home,fixture.away]);
 const incidents=(Array.isArray(raw.incidents)?raw.incidents:[]).filter(incident=>['goal','card'].includes(incident?.type)&&finite(incident?.minute,-1)>=minMinute&&finite(incident?.minute,-1)<=maxMinute&&validTeams.has(incident?.teamId)).slice(0,18).map(incident=>({
  type:incident.type,minute:integer(incident.minute,minMinute,maxMinute,minMinute),teamId:incident.teamId,playerId:cleanId(incident.playerId,80)||null,playerName:cleanText(incident.playerName,48,''),assistPlayerId:cleanId(incident.assistPlayerId,80)||null,assistPlayerName:cleanText(incident.assistPlayerName,48,''),text:cleanText(incident.text,150,'Match update')
 }));
 const homeGoals=integer(raw.homeGoals,0,8,0),awayGoals=integer(raw.awayGoals,0,8,0),goalIncidents=incidents.filter(incident=>incident.type==='goal');
 if(goalIncidents.filter(incident=>incident.teamId===fixture.home).length!==homeGoals||goalIncidents.filter(incident=>incident.teamId===fixture.away).length!==awayGoals)return null;
 const selection=state.squads[squadSelectionKey(squad)],availableIds=new Set(selection?.players.map(player=>player.id)||[]),playerLineupIds=unique((Array.isArray(raw.playerLineupIds)?raw.playerLineupIds:selection?.lineup||[]).map(String).filter(id=>availableIds.has(id))).slice(0,11);
 const expectedSource=raw.expectedGoals&&typeof raw.expectedGoals==='object'?raw.expectedGoals:{},expectedGoals={home:clamp(expectedSource.home,.05,6,Math.max(.1,homeGoals*.65)),away:clamp(expectedSource.away,.05,6,Math.max(.1,awayGoals*.65))};
 return {...fixture,week:state.week,half,ageGroup:squad==='academy'?'u18':undefined,homeGoals,awayGoals,incidents,commentary:incidents.map(incident=>incident.text),expectedGoals,tactics:normalizeTactics(raw.tactics),pitchCondition:integer(raw.pitchCondition,0,100,70),playerLineupIds,playerStyleFatigue:clamp(raw.playerStyleFatigue,.5,2,1)};
}

function applyHalftimeChangesInPlace(state,squad,halftime={}){
 const source=halftime&&typeof halftime==='object'?halftime:{},styleId=source.styleId?String(source.styleId):'',outId=String(source.outId||''),inId=String(source.inId||'');
 const selection=state.squads[squadSelectionKey(squad)],formation=source.formation?String(source.formation):selection.formation;
 if(!FORMATIONS.includes(formation))return {ok:false,code:'formation-unknown',message:'Choose a recognised second-half formation.'};
 if((outId&&!inId)||(!outId&&inId))return {ok:false,code:'substitution-incomplete',message:'Choose both players for a halftime substitution, or leave both blank.'};
 const lineup=[...selection.lineup],bench=[...selection.bench];
 if(outId&&inId){
  const outIndex=lineup.indexOf(outId),benchIndex=bench.indexOf(inId),incoming=selection.players.find(player=>player.id===inId);
  if(outIndex<0||benchIndex<0||!incoming||!isPlayerAvailable(incoming))return {ok:false,code:'substitution-invalid',message:'Choose one available named substitute and one starter to replace.'};
  lineup[outIndex]=inId;bench[benchIndex]=outId;
 }
 const suitability=lineupPositionReport({...selection,lineup,formation},formation);
 if(suitability.actual.GK!==1)return {ok:false,code:'lineup-no-goalkeeper',message:'Keep exactly one goalkeeper on the pitch. Replace your goalkeeper with another goalkeeper.'};
 if(styleId){
  const style=getPlayingStyle(styleId),holder=holderFor(state,squad);
  if(!style)return {ok:false,code:'style-unknown',message:'Choose a recognised second-half style.'};
  if(holder.styleId!==style.id)holder.familiarity=clamp(holder.familiarity-14,0,100);
  holder.styleId=style.id;
 }
 selection.lineup=lineup;selection.bench=bench;selection.formation=formation;
 return {ok:true,styleId:styleId||holderFor(state,squad)?.styleId||'balanced',outId:outId||null,inId:inId||null};
}

function captureMatchPlan(state,squad){
 const selection=state.squads[squadSelectionKey(squad)],holder=holderFor(state,squad);
 return {lineup:clone(selection?.lineup||[]),bench:clone(selection?.bench||[]),formation:selection?.formation||'4-3-3',styleId:holder?.styleId||'balanced',familiarity:finite(holder?.familiarity,0)};
}

function restoreMatchPlan(state,squad,plan){
 if(!plan)return;
 const selection=state.squads[squadSelectionKey(squad)],holder=holderFor(state,squad);
 if(selection){selection.lineup=clone(plan.lineup);selection.bench=clone(plan.bench);selection.formation=plan.formation;repairSquadSelection(selection)}
 if(holder){holder.styleId=plan.styleId;holder.familiarity=plan.familiarity}
}

function currentPlayerFixtureInState(state,squad){
 const competition=competitionFor(state,squad),playerId=competitionPlayerId(squad);
 const total=squad==='academy'?academyRoundCount():roundCount(competition?.teams||[]),scheduledWeek=squad==='academy'?academyWeekForRound(competition?.round||0):leagueWeekForRound(competition?.round||0);
 if(!competition||competition.round>=total||competition.playedRound===competition.round||state.week<scheduledWeek)return null;
 const fixtures=squad==='academy'?buildAcademyRoundFixtures(competition.teams,competition.round,state.season,competition.divisionId):buildRoundFixtures(competition.teams,competition.round,state.season,competition.divisionId);
 const fixture=fixtures.find(fixture=>fixture.home===playerId||fixture.away===playerId)||null;
 if(fixture&&squad==='academy'){
  const rescheduled=academyIsRainPostponed(state,competition.round);
  return {...fixture,scheduledWeek,scheduledDay:rescheduled?'Wednesday':'Weekend',rescheduled,rescheduleReason:rescheduled?'Rain make-up':''};
 }
 return fixture;
}

export function previewMatchHalf(input,options={}){
 const state=normalizeFootballState(input),squad=['first','u23','academy','b'].includes(options.squad)?options.squad:'first',half=Number(options.half)===2?2:1;
 if(squad==='b'&&!state.b)return {ok:false,code:'squad-unavailable',message:'That squad is not available.'};
 if(state.status==='bankrupt')return {ok:false,code:'club-bankrupt',message:'A bankrupt club cannot play another fixture.'};
 if(squad==='first'){const registrationIssue=competitiveRegistrationIssue(state);if(registrationIssue)return {ok:false,code:'competition-registration-invalid',message:registrationIssue}}
 const fixture=currentPlayerFixtureInState(state,squad);
 if(!fixture)return {ok:false,code:'match-unavailable',message:'There is no player fixture ready for that squad.'};
 if(half===2){const changed=applyHalftimeChangesInPlace(state,squad,options.halftime);if(!changed.ok)return changed}
 return {ok:true,fixture:clone(fixture),result:clone(resolveFixtureHalf(state,fixture,squad,half,squad==='academy'?{ageGroup:'u18'}:{}))};
}

export function getStadiumCapacity(input){
 const state=normalizeFootballState(input),capacity=facilityEffect(state,'stadium','capacity');
 return capacity|| (state.facilities.fields===0?2500:600);
}

export function getAverageAttendance(input){
 const state=normalizeFootballState(input);
 return state.metrics.homeMatches?Math.round(state.metrics.attendanceTotal/state.metrics.homeMatches):0;
}

function nextFirstTeamFixtureInState(state){
 const competition=state.competitions.first,playerId=PLAYER_FIRST_TEAM_ID;
 if(!competition||competition.round>=roundCount(competition.teams))return null;
 const fixture=buildRoundFixtures(competition.teams,competition.round,state.season,competition.divisionId).find(item=>item.home===playerId||item.away===playerId);
 return fixture?{...fixture,scheduledWeek:leagueWeekForRound(competition.round)}:null;
}

function matchdayContextForFixtureInState(state,fixture=null,overrides={}){
 const target=fixture||nextFirstTeamFixtureInState(state),source=overrides&&typeof overrides==='object'?overrides:{},site=getStartSite(state.club.siteId),division=getSeniorDivision(state.first.divisionId),homeCapacity=getStadiumCapacity(state);
 if(!target)return {venue:'home',planningOnly:true,venueId:state.club.siteId,capacity:homeCapacity,baseAttendance:0,hospitalityCapacity:Math.round(homeCapacity*(.012+(state.facilities.clubhouse||1)*.018)),travelKm:0,travelParty:32,pitchCondition:pitchConditionInState(state),climate:site.region==='Toowoomba'?'inland':site.region==='Gold Coast'||site.region==='Moreton Bay'?'coastal':'subtropical',forecastSeason:state.season,forecastWeek:Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),plan:source.plan};
 const venue=['home','away','neutral'].includes(source.venue)?source.venue:(target.home===PLAYER_FIRST_TEAM_ID?'home':'away'),isHome=venue==='home',opponentId=source.opponentId||(target.home===PLAYER_FIRST_TEAM_ID?target.away:target.home),opponent=state.careerWorld.aiClubs.find(club=>club.id===opponentId),reference=REFERENCE_TEAMS.get(opponentId),opponentReputation=opponent?.reputation||reference?.gameStrength||divisionBaseStrength(state.first.divisionId),capacity=isHome?homeCapacity:integer(source.capacity,100,500_000,Math.round(800+opponentReputation*90)),random=seededRandom(`${state.seed}|attendance|${target.id||target.fixtureId}`),homeAttendance=150+state.club.reputation*42+site.wealth*12+(8-division.tier)*320+(random()-.5)*500,awayAttendance=capacity*(.32+opponentReputation/190)+(random()-.5)*capacity*.1,neutralAttendance=capacity*(.4+(state.club.reputation+opponentReputation)/420)+(random()-.5)*capacity*.08,baseAttendance=Math.round(clamp(isHome?homeAttendance:venue==='neutral'?neutralAttendance:awayAttendance,100,capacity));
 const travelKm=isHome?0:integer(source.travelKm,0,10_000,Math.max(20,Math.round(site.travelBurden*12+(hashString(`${state.seed}|travel|${opponentId}`)%360))));
 return {fixtureId:target.id||target.fixtureId,competition:source.competition||getCompetitionDisplayName(state.first.divisionId,state.season),venue,venueId:isHome?state.club.siteId:opponentId,capacity,baseAttendance,opponentId,opponentName:source.opponentName||teamName(state,opponentId,'first'),opponentReputation,importance:finite(source.importance,1),hospitalityCapacity:isHome?Math.round(capacity*(.012+(state.facilities.clubhouse||1)*.018)):0,travelKm,travelParty:integer(source.travelParty,12,80,32),pitchCondition:isHome?pitchConditionInState(state):integer(source.pitchCondition,0,100,70),climate:site.region==='Toowoomba'?'inland':site.region==='Gold Coast'||site.region==='Moreton Bay'?'coastal':'subtropical',forecastSeason:state.season,forecastWeek:integer(source.forecastWeek,1,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,target.scheduledWeek||state.week),plan:source.plan};
}

export function getMatchdayOperationsContext(input,fixture={}){
 const state=normalizeFootballState(input),source=fixture&&typeof fixture==='object'?fixture:{},current=nextFirstTeamFixtureInState(state);
 const target=(source.id||source.fixtureId||source.home||source.away)?source:current;
 return clone(matchdayContextForFixtureInState(state,target,source));
}

function applyTableResult(table,result){
 const home=table[result.home],away=table[result.away];
 home[0]+=1;away[0]+=1;home[4]+=result.homeGoals;home[5]+=result.awayGoals;away[4]+=result.awayGoals;away[5]+=result.homeGoals;
 if(result.homeGoals>result.awayGoals){home[1]+=1;home[6]+=3;away[3]+=1}
 else if(result.homeGoals<result.awayGoals){away[1]+=1;away[6]+=3;home[3]+=1}
 else{home[2]+=1;away[2]+=1;home[6]+=1;away[6]+=1}
}

function recordCareerMatchInPlace(state,result,context={}){
 const playerId=PLAYER_FIRST_TEAM_ID,isHome=result.home===playerId,opponentId=isHome?result.away:result.home,goalsFor=isHome?result.homeGoals:result.awayGoals,goalsAgainst=isHome?result.awayGoals:result.homeGoals,outcome=goalsFor>goalsAgainst?'W':goalsFor<goalsAgainst?'L':'D';
 const firstParticipants=new Set(result.halves?.first?.playerLineupIds||[]),secondParticipants=new Set(result.halves?.second?.playerLineupIds||[]),participants=new Set([...firstParticipants,...secondParticipants]),goalCounts=new Map(),assistCounts=new Map(),yellowCounts=new Map();
 for(const incident of result.incidents||[]){if(incident.teamId===playerId){if(incident.type==='goal'&&incident.playerId)goalCounts.set(incident.playerId,(goalCounts.get(incident.playerId)||0)+1);if(incident.type==='goal'&&incident.assistPlayerId)assistCounts.set(incident.assistPlayerId,(assistCounts.get(incident.assistPlayerId)||0)+1);if(incident.type==='card'&&incident.playerId)yellowCounts.set(incident.playerId,(yellowCounts.get(incident.playerId)||0)+1)}}
 const performances=state.squads.first.players.filter(item=>participants.has(item.id)).map(player=>{
  const halves=Number(firstParticipants.has(player.id))+Number(secondParticipants.has(player.id)),goals=goalCounts.get(player.id)||0,assists=assistCounts.get(player.id)||0,cleanSheet=player.position==='GK'&&goalsAgainst===0?1:0,random=seededRandom(`${state.seed}|career-rating|${result.id}|${player.id}`),rating=clamp(6.15+(outcome==='W'?.65:outcome==='L'?-0.45:.1)+goals*.75+assists*.42+cleanSheet*.6+(random()-.5)*.7,3,10,6.2);
  return {player,halves,goals,assists,cleanSheet,rating};
 });
 const playerOfMatch=[...performances].sort((a,b)=>b.rating-a.rating||b.goals-a.goals||b.assists-a.assists||a.player.name.localeCompare(b.player.name))[0]||null;
 if(playerOfMatch)result.playerOfMatch={playerId:playerOfMatch.player.id,name:playerOfMatch.player.name,teamId:playerId,rating:Math.round(playerOfMatch.rating*100)/100};
 if(context.recordClubMatch!==false)state.careerWorld=recordClubMatch(state.careerWorld,{id:`career-${result.id}`,season:state.season,week:Math.min(FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,state.week),competition:context.competition||getCompetitionDisplayName(state.first.divisionId,state.season),competitionType:context.competitionType||'league',opponentId,opponentName:context.opponentName||teamName(state,opponentId,'first'),venue:context.venue||(isHome?'home':'away'),goalsFor,goalsAgainst,attendance:result.attendance||0,netRevenue:result.matchday?.netRevenueAud||0,result:outcome,report:{...result,fixtureId:result.id}});
 if(context.recordAppearances===false)return;
 for(const performance of performances){
  const {player,halves,goals,assists,cleanSheet,rating}=performance;
  state.careerWorld=recordPlayerAppearance(state.careerWorld,player.id,{appeared:true,started:firstParticipants.has(player.id),minutes:halves*45,goals,assists,cleanSheets:cleanSheet,yellowCards:yellowCounts.get(player.id)||0,playerOfMatch:player.id===playerOfMatch?.player.id?1:0,rating});
 }
}

function recordAIResultsInPlace(state,results,playerTeamId){
 for(const result of results){
  if(result.home===playerTeamId||result.away===playerTeamId)continue;
  state.careerWorld=recordAIClubResult(state.careerWorld,result.home,{goalsFor:result.homeGoals,goalsAgainst:result.awayGoals});
  state.careerWorld=recordAIClubResult(state.careerWorld,result.away,{goalsFor:result.awayGoals,goalsAgainst:result.homeGoals});
 }
}

function applyPlayerMatchEffects(state,result,squad,careerContext={}){
 const id=competitionPlayerId(squad),holder=holderFor(state,squad),goalsFor=result.home===id?result.homeGoals:result.awayGoals,goalsAgainst=result.home===id?result.awayGoals:result.homeGoals;
 const suspensionsToServe=squad==='first'&&careerContext.competitive!==false?state.careerWorld.players.filter(player=>player.discipline?.suspensionMatchesRemaining>0).map(player=>player.id):[];
 const style=getPlayingStyle(holder.styleId)||getPlayingStyle('balanced'),outcome=goalsFor>goalsAgainst?'win':goalsFor<goalsAgainst?'loss':'draw',firstHalf=result.halves?.first||{},secondHalf=result.halves?.second||{};
 const matchdayContext=squad==='first'?matchdayContextForFixtureInState(state,result,{competition:careerContext.competition||getCompetitionDisplayName(state.first.divisionId,state.season),...careerContext.matchday}):null;
 const operations=matchdayContext?careerPreviewMatchdayOperations(state.careerWorld,matchdayContext):null;
 if(operations)result.pitchCondition=operations.pitchConditionBefore;
 const firstStyleFatigue=clamp(firstHalf.playerStyleFatigue,.5,2,style.fatigue),secondStyleFatigue=clamp(secondHalf.playerStyleFatigue,.5,2,style.fatigue);
 holder.morale=clamp(holder.morale+(outcome==='win'?4:outcome==='loss'?-3:1),0,100);holder.fatigue=clamp(holder.fatigue+5.5*(firstStyleFatigue+secondStyleFatigue),0,100);
 const selection=state.squads[squadSelectionKey(squad)];
 const firstParticipants=new Set(Array.isArray(firstHalf.playerLineupIds)?firstHalf.playerLineupIds:selection.lineup),secondParticipants=new Set(Array.isArray(secondHalf.playerLineupIds)?secondHalf.playerLineupIds:selection.lineup);
 for(const player of selection.players){
  const halvesPlayed=Number(firstParticipants.has(player.id))+Number(secondParticipants.has(player.id));
  if(halvesPlayed){
   const fatigueAdded=(firstParticipants.has(player.id)?5*firstStyleFatigue:0)+(secondParticipants.has(player.id)?5*secondStyleFatigue:0);
   player.fatigue=clamp(player.fatigue+fatigueAdded,0,100);player.morale=clamp(player.morale+(outcome==='win'?3:outcome==='loss'?-2:1),0,100);
  }else player.fatigue=clamp(player.fatigue-2,0,100);
 }
 const injuries=[],intensity=findIntensity(holder.training.intensity),programme=trainingProgramme(holder),injuryRandom=seededRandom(`${state.seed}|${result.id}|injuries`),pitchRisk=Math.max(0,68-integer(result.pitchCondition,0,100,70))*.00022,groundsProtection=(state.staff['grounds-team']||0)*.0014;
 for(const player of selection.players.filter(candidate=>secondParticipants.has(candidate.id)&&isPlayerAvailable(candidate))){
  const risk=clamp(.002+player.fatigue*.0003+Math.max(0,intensity.fatigue-1)*.018+Math.max(0,style.fatigue-1)*.02+Math.max(0,programme.injuryRisk)*.004+pitchRisk-groundsProtection,.001,.09);
  if(injuryRandom()<risk){
   const injuryWeeks=integer(1+injuryRandom()*4,1,5,2),minute=integer(48+injuryRandom()*39,1,90,70);player.injuryWeeks=injuryWeeks;
   if(squad==='first')state.careerWorld=careerReportPlayerInjury(state.careerWorld,player.id,{type:'Match injury',bodyArea:player.position==='GK'?'Shoulder':player.position==='FW'?'Hamstring':'Lower leg',severity:injuryWeeks<=2?'minor':'moderate',weeksTotal:injuryWeeks,recurrenceRisk:10});
   const incident={type:'injury',minute,teamId:id,playerId:player.id,playerName:player.name,text:`${minute}' Injury — ${player.name} will miss about ${injuryWeeks} week${injuryWeeks===1?'':'s'}.`};
   injuries.push({playerId:player.id,playerName:player.name,injuryWeeks,minute});result.incidents.push(incident);
  }
 }
 if(injuries.length){sortMatchIncidents(result.incidents);result.commentary=result.incidents.map(incident=>incident.text);repairSquadSelection(selection)}
 if(squad==='first'&&careerContext.competitive!==false&&outcome==='win'){state.metrics.seniorWins+=1;state.club.reputation=clamp(state.club.reputation+.45,0,100)}
 else if(squad==='first'&&careerContext.competitive!==false&&outcome==='loss')state.club.reputation=clamp(state.club.reputation-.08,0,100);
 let attendance=0;
 if(operations){
  attendance=operations.attendance;const ticketPriceAud=operations.venue==='home'?state.careerWorld.matchday.plan.ticketPrice:0,ticketRevenueAud=operations.ticketRevenue,hospitalityRevenueAud=operations.hospitalityRevenue,concessionRevenueAud=operations.concessionRevenue,travelCostAud=operations.travelCost,operatingCostAud=operations.operatingCost,totalRevenueAud=ticketRevenueAud+hospitalityRevenueAud+concessionRevenueAud;
  result.attendance=attendance;result.matchday={fixtureId:operations.fixtureId||result.id,competition:operations.competition,venue:operations.venue,opponentId:operations.opponentId,opponentName:operations.opponentName,capacity:operations.capacity,attendance,ticketPriceAud,ticketRevenue:ticketRevenueAud,ticketRevenueAud,hospitalityRevenue:hospitalityRevenueAud,hospitalityRevenueAud,concessionRevenue:concessionRevenueAud,concessionRevenueAud,travelCost:travelCostAud,travelCostAud,operatingCost:operatingCostAud,operatingCostAud,totalRevenueAud,netRevenue:operations.netRevenue,netRevenueAud:operations.netRevenue,weather:clone(operations.weather),pitchConditionBefore:operations.pitchConditionBefore,pitchConditionAfter:operations.pitchConditionAfter,satisfaction:operations.satisfaction};
  if(operations.venue==='home'){state.metrics.attendanceTotal+=attendance;state.metrics.homeMatches+=1}
  state.careerWorld=settleMatchdayOperations(state.careerWorld,matchdayContext);
 }else result.matchday={attendance:0,ticketPriceAud:0,ticketRevenueAud:0,hospitalityRevenueAud:0,concessionRevenueAud:0,travelCostAud:0,operatingCostAud:0,totalRevenueAud:0,netRevenueAud:0};
 if(squad==='first'){
  recordCareerMatchInPlace(state,result,careerContext);
  for(const playerId of suspensionsToServe)state.careerWorld=careerServePlayerSuspension(state.careerWorld,playerId,1);
  syncRootPlayersFromCareerInPlace(state);
 }
 return {outcome,goalsFor,goalsAgainst,attendance,injuries};
}

function resolveRoundInPlace(state,squad='first',options={}){
 if(squad==='academy'){
   const ageGroupResults={},selection=state.squads.academy;repairSquadSelection(selection);
   const unfinished=ACADEMY_AGE_GROUPS.map(ageGroup=>state.competitions.academyByAge[ageGroup]).filter(competition=>competition.round<academyRoundCount()&&competition.playedRound!==competition.round);
   if(unfinished.length&&unfinished.every(competition=>state.week<academyWeekForRound(competition.round)))return {ok:false,code:'match-not-due',message:`The next academy league round is scheduled for week ${Math.min(...unfinished.map(competition=>academyWeekForRound(competition.round)))}.`};
   for(const ageGroup of ACADEMY_AGE_GROUPS){
    const competition=state.competitions.academyByAge[ageGroup],total=academyRoundCount(),playerId=PLAYER_ACADEMY_TEAM_ID;
    if(competition.round>=total||competition.playedRound===competition.round||state.week<academyWeekForRound(competition.round))continue;
   const fixtureDivision=ageGroup==='u18'?competition.divisionId:`${competition.divisionId}-${ageGroup}`,rainMakeup=academyIsRainPostponed(state,competition.round),fixtures=buildAcademyRoundFixtures(competition.teams,competition.round,state.season,fixtureDivision).map(fixture=>({...fixture,scheduledWeek:academyWeekForRound(competition.round),scheduledDay:rainMakeup?'Wednesday':'Weekend',rescheduled:rainMakeup,rescheduleReason:rainMakeup?'Rain make-up':''})),firstHalf=ageGroup==='u18'?options.firstHalf||null:null;
   const resolved=fixtures.map(fixture=>firstHalf&&fixture.id===firstHalf.id?mergeFixtureHalves(state,fixture,'academy',firstHalf,resolveFixtureHalf(state,fixture,'academy',2,{ageGroup})):resolveFixture(state,fixture,'academy',{ageGroup}));
   for(const result of resolved)applyTableResult(competition.table,result);
   const playerResult=resolved.find(result=>result.home===playerId||result.away===playerId)||null;
   competition.playedRound=competition.round;competition.lastResult=playerResult;state.counters.match+=resolved.length;
   let summary={outcome:'bye',goalsFor:0,goalsAgainst:0};
   if(playerResult){competition.results=[...competition.results.slice(-59),playerResult];if(ageGroup==='u18')summary=applyPlayerMatchEffects(state,playerResult,'academy')}
   ageGroupResults[ageGroup]={result:playerResult,roundResults:resolved,summary};
  }
  const primary=ageGroupResults.u18;
  if(!primary&&!Object.keys(ageGroupResults).length)return {ok:false,code:'season-complete',message:'The academy league season is complete.'};
  const result=primary?.result||null,summary=primary?.summary||{outcome:'bye',goalsFor:0,goalsAgainst:0};
  return {ok:true,code:result?'match-simulated':'round-bye',message:result?`${teamName(state,result.home,'academy')} ${result.homeGoals}–${result.awayGoals} ${teamName(state,result.away,'academy')}.`:`${teamName(state,PLAYER_ACADEMY_TEAM_ID,'academy')} had a bye.`,result,roundResults:primary?.roundResults||[],summary,ageGroupResults};
 }
 const competition=competitionFor(state,squad),playerId=competitionPlayerId(squad);
 if(!competition)return {ok:false,code:'squad-unavailable',message:'That squad is not available.'};
 if(squad==='first'){const registrationIssue=competitiveRegistrationIssue(state);if(registrationIssue)return {ok:false,code:'competition-registration-invalid',message:registrationIssue}}
 const total=roundCount(competition.teams);
 if(competition.round>=total)return {ok:false,code:'season-complete',message:'The league season is complete.'};
 if(competition.playedRound===competition.round)return {ok:false,code:'match-already-played',message:'This week has already been simulated.'};
 if(state.week<leagueWeekForRound(competition.round))return {ok:false,code:'match-not-due',message:`The next league round is scheduled for week ${leagueWeekForRound(competition.round)}.`};
 repairSquadSelection(state.squads[squadSelectionKey(squad)]);
 const fixtures=buildRoundFixtures(competition.teams,competition.round,state.season,competition.divisionId),firstHalf=options.firstHalf||null;
 const resolved=fixtures.map(fixture=>firstHalf&&fixture.id===firstHalf.id?mergeFixtureHalves(state,fixture,squad,firstHalf,resolveFixtureHalf(state,fixture,squad,2)):resolveFixture(state,fixture,squad));
 for(const result of resolved)applyTableResult(competition.table,result);
 if(squad==='first')recordAIResultsInPlace(state,resolved,playerId);
 const playerResult=resolved.find(result=>result.home===playerId||result.away===playerId)||null;
 competition.playedRound=competition.round;competition.lastResult=playerResult;state.counters.match+=resolved.length;
 let summary={outcome:'bye',goalsFor:0,goalsAgainst:0};
 if(playerResult){
  competition.results=[...competition.results.slice(-59),playerResult];summary=applyPlayerMatchEffects(state,playerResult,squad);
 }
 return {ok:true,code:playerResult?'match-simulated':'round-bye',message:playerResult?`${teamName(state,playerResult.home,squad)} ${playerResult.homeGoals}–${playerResult.awayGoals} ${teamName(state,playerResult.away,squad)}.`:`${teamName(state,playerId,squad)} had a bye.`,result:playerResult,roundResults:resolved,summary};
}

export function simulateMatch(input,options={}){
 const state=normalizeFootballState(input),squad=['first','u23','academy','b'].includes(options.squad)?options.squad:'first';
 if(squad==='b'&&!state.b)return failure(state,'squad-unavailable','That squad is not available.');
 if(state.status==='bankrupt')return failure(state,'club-bankrupt','A bankrupt club cannot play another fixture.');
 if(squad==='first'){const registrationIssue=competitiveRegistrationIssue(state);if(registrationIssue)return failure(state,'competition-registration-invalid',registrationIssue)}
 let firstHalf=null,originalPlan=null;
 if(options.firstHalf){
  const fixture=currentPlayerFixtureInState(state,squad);
  firstHalf=fixture?normalizePreviewHalf(options.firstHalf,fixture,state,squad,1):null;
  if(!firstHalf)return failure(state,'match-phase-invalid','The saved first-half state no longer matches this fixture. Restart the visual match.');
  originalPlan=captureMatchPlan(state,squad);
  const changed=applyHalftimeChangesInPlace(state,squad,options.halftime);
  if(!changed.ok){restoreMatchPlan(state,squad,originalPlan);return failure(state,changed.code,changed.message)}
 }else if(options.halftime)return failure(state,'match-phase-invalid','Halftime changes require a completed first half.');
 const resolved=resolveRoundInPlace(state,squad,{firstHalf});
 if(!resolved.ok){restoreMatchPlan(state,squad,originalPlan);return failure(state,resolved.code,resolved.message)}
 restoreMatchPlan(state,squad,originalPlan);
 return operation(state,{type:'match-result',code:resolved.code,message:resolved.message},true,{result:clone(resolved.result),roundResults:clone(resolved.roundResults),summary:resolved.summary,ageGroupResults:clone(resolved.ageGroupResults||null)});
}

export function academyTrainingRequirement(input){
 const state=normalizeFootballState(input),academy=state.academy;
 if(academy.leagueId==='fqa-4')return 2;
 if(academy.leagueId==='fqa-3')return academy.seasonsInLeague>=2?3:2;
 return 3;
}

export function academyPlacementForScore(rawScore){
 const score=clamp(rawScore,0,100),rating=score>=75?'gold':score>=55?'silver':score>=35?'bronze':'development-committed';
 return {score,rating,shield:rating,tier:rating==='development-committed'?2:1,leagueId:{gold:'fqa-1',silver:'fqa-2',bronze:'fqa-3','development-committed':'fqa-4'}[rating]};
}

export function academyMarketProjection(input){
 const state=normalizeFootballState(input),academy=state.academy,site=getStartSite(state.club.siteId),band=ACADEMY_FEE_BANDS[academy.leagueId],fee=academy.feeAud;
 const valueDelta=clamp((band.recommendedAud-fee)/Math.max(1,band.recommendedAud),-.75,.75),tierPower=academyIndex(academy.leagueId)*8;
 const interest=clamp(site.talent*.34+academy.score*.30+state.club.reputation*.12+50*valueDelta+facilityEffect(state,'academy','academy')*.35,0,100);
 const applicantTalent=clamp(site.talent*.43+academy.score*.24+tierPower*.45+Math.max(0,valueDelta)*13+(state.staff.recruitment||0)*3,0,100);
 const applicantWealth=clamp(site.wealth*.55+45*Math.max(0,(fee-band.minAud)/Math.max(1,band.maxAud-band.minAud))-Math.max(0,valueDelta)*8,0,100);
 const capacity=100+(state.facilities.fields||1)*85+(state.facilities.academy||0)*75;
 const projectedEnrolment=Math.round(clamp(45+interest*2.1,30,capacity));
 return {leagueId:academy.leagueId,feeAud:fee,band:clone(band),interest,applicantTalent,applicantWealth,capacity,projectedEnrolment,annualFeeRevenueAud:projectedEnrolment*fee};
}

export function setAcademyFee(input,feeAud){
 const state=normalizeFootballState(input),fee=Number(feeAud);
 if(!Number.isSafeInteger(fee)||fee<0||fee>15_000)return failure(state,'academy-fee-invalid','Set an academy season fee between $0 and $15,000.');
 state.academy.feeAud=fee;
 const projection=academyMarketProjection(state),band=ACADEMY_FEE_BANDS[state.academy.leagueId];
 return operation(state,{type:'academy-fee-set',code:'academy-fee-set',message:`Academy fees are now $${fee.toLocaleString()} per season.`},true,{projection,withinSuggestedBand:fee>=band.minAud&&fee<=band.maxAud});
}

export function setManagerSettings(input,patch={}){
 const state=normalizeFootballState(input);
 state.settings=normalizeManagerSettings({...state.settings,...(patch&&typeof patch==='object'?patch:{})});
 return operation(state,{type:'manager-settings',code:'manager-settings-saved',message:'Football manager settings saved.'},true,{settings:clone(state.settings)});
}

export function fundFemaleProgramme(input){
 const state=normalizeFootballState(input),costAud=50_000;
 if(state.academy.femaleProgramme)return failure(state,'female-programme-active','The academy female-program compliance programme is already active.');
 if(state.finance.cash<costAud)return failure(state,'cash-insufficient',`This academy programme requires $${costAud.toLocaleString()}.`);
 state.finance.cash-=costAud;state.finance.seasonExpenses+=costAud;state.academy.femaleProgramme=true;
 pushLedgerInPlace(state,'academy-programme','Female participation and compliance programme',-costAud);
 return operation(state,{type:'academy-programme',code:'female-programme-funded',message:'The academy funded a female-program compliance and access programme.'},true,{costAud});
}

export function setWeeklyFirstTeamBudget(input,budgetAud){
 const state=normalizeFootballState(input),division=getSeniorDivision(state.first.divisionId),budget=money(budgetAud,0,0);
 if(budget<500||budget>division.weeklyBudgetMax)return failure(state,'senior-budget-invalid',`Set a weekly first-team budget between $500 and $${division.weeklyBudgetMax.toLocaleString()} in ${division.name}.`);
 const contracted=squadWeeklyWages(state,'first');if(budget<contracted)return failure(state,'senior-budget-below-contracts',`The budget ceiling cannot be set below the $${contracted.toLocaleString()} contracted first-team wage bill.`,{contractedWeeklyWagesAud:contracted});
 state.finance.weeklyFirstTeamBudget=budget;
 return operation(state,{type:'senior-budget-set',code:'senior-budget-set',message:`The first-team weekly player budget is now $${budget.toLocaleString()}.`},true,{suggestedMinimum:division.weeklyBudgetMin,suggestedMaximum:division.weeklyBudgetMax});
}

export function setTrainingSchedule(input,squad,schedule){
 const state=normalizeFootballState(input);
 if(schedule===undefined&&squad&&typeof squad==='object'&&!Array.isArray(squad)){
  const calendar=squad,senior=calendar.senior??calendar.first,academy=calendar.academy,u23=calendar.u23;
  if(senior!==undefined)state.first.training=normalizeSchedule(senior,'first');
  if(academy!==undefined)state.academy.training=normalizeSchedule(academy,'academy');
  if(u23!==undefined)state.u23.training=normalizeSchedule(u23,'u23');
  const required=academyTrainingRequirement(state),meetsStandard=state.academy.training.days.length>=required;
  return operation(state,{type:'training-set',code:'training-calendar-set',message:'The weekly first-team, U23 and academy training calendar was saved.'},true,{requiredSessions:required,meetsStandard,training:{first:clone(state.first.training),u23:clone(state.u23.training),academy:clone(state.academy.training)}});
 }
 const key=squad==='academy'?'academy':squad==='b'?'b':squad==='u23'?'u23':'first';
 if(key==='b'&&!state.b)return failure(state,'b-team-unavailable','Establish a B team before setting its training schedule.');
 const normalized=normalizeSchedule(schedule,key),holder=key==='academy'?state.academy:key==='b'?state.b:key==='u23'?state.u23:state.first;
 holder.training=normalized;
 const required=key==='academy'?academyTrainingRequirement(state):3,meetsStandard=normalized.days.length>=required;
 return operation(state,{type:'training-set',code:'training-set',message:`${key==='academy'?'Academy':key==='b'?'B team':key==='u23'?'U23':'First team'} training is set for ${normalized.days.length} sessions each week.`},true,{requiredSessions:required,meetsStandard});
}

export function setPlayingStyle(input,squad,styleId){
 if(styleId===undefined){styleId=squad;squad='first'}
 const state=normalizeFootballState(input),style=getPlayingStyle(styleId),key=squad==='academy'?'academy':squad==='b'?'b':squad==='u23'?'u23':'first';
 if(!style)return failure(state,'style-unknown','Choose a recognised football style.');
 if(key==='b'&&!state.b)return failure(state,'b-team-unavailable','Establish a B team before setting its style.');
 const holder=key==='academy'?state.academy:key==='b'?state.b:key==='u23'?state.u23:state.first;
 if(holder.styleId!==style.id)holder.familiarity=clamp(holder.familiarity-14,0,100);
 holder.styleId=style.id;
 return operation(state,{type:'style-set',code:'style-set',message:`${style.name} is now the ${key==='academy'?'academy':key==='b'?'B-team':key==='u23'?'U23':'first-team'} identity.`},true,{style:clone(style)});
}

export function setManagerRole(input,role){
 const state=normalizeFootballState(input),selection=managerForRole(role);
 const valid=['club','club-manager','first','first-team-coach','u23','u23-coach','academy','academy-coach'].includes(String(role||'').toLowerCase());
 if(!valid)return failure(state,'manager-role-unknown','Choose club manager, first-team coach, U23 coach or academy coach.');
 state.managerRole=selection.managerRole;state.manager=selection.manager;
 const label=selection.manager.mode==='club'?'club manager':`${selection.manager.controlledSquad==='first'?'first-team':selection.manager.controlledSquad.toUpperCase()} coach`;
 return operation(state,{type:'manager-role-set',code:'manager-role-set',message:`You are now operating as ${label}.`},true,{manager:clone(state.manager),managerRole:state.managerRole});
}

function squadKey(raw){return raw==='academy'?'academy':raw==='b'?'b':raw==='b-u23'?'bU23':raw==='u23'?'u23':'first'}
function squadLabel(key){return key==='academy'?'academy':key==='u23'?'U23':key==='b'?'B-team':key==='bU23'?'B-team U23':'first-team'}

export function getSquad(input,squad='first'){
 const state=normalizeFootballState(input),key=squadKey(squad),selection=state.squads[key];
 if(!selection)return null;
 const selected=new Set(selection.lineup);
 const players=selection.players.map(player=>({...clone(player),available:isPlayerAvailable(player),selected:selected.has(player.id),onBench:selection.bench.includes(player.id)}));
 const xi=players.filter(player=>player.selected),averageRating=xi.length?Math.round(xi.reduce((sum,player)=>sum+player.rating,0)/xi.length*10)/10:0;
 return {...clone(selection),players,totalWeeklyWages:squadWeeklyWages(state,key),averageRating,positionSuitability:lineupPositionReport(selection)};
}

export function getLineupSuitability(input,squad='first',config=null){
 const state=normalizeFootballState(input),key=squadKey(squad),selection=state.squads[key];
 if(!selection)return null;
 const source=config&&typeof config==='object'?config:{},formation=FORMATIONS.includes(source.formation)?source.formation:selection.formation,lineup=Array.isArray(source.lineup)?unique(source.lineup.map(String)):selection.lineup;
 return lineupPositionReport({...selection,formation,lineup},formation);
}

export function setLineup(input,squad,config){
 if(config===undefined&&squad&&typeof squad==='object'){config=squad;squad='first'}
 const state=normalizeFootballState(input),key=squadKey(squad),selection=state.squads[key],source=config&&typeof config==='object'?config:{};
 if(!selection)return failure(state,'squad-unavailable','That squad is not available.');
 const formation=FORMATIONS.includes(source.formation)?source.formation:selection.formation;
 const registered=key==='first'?new Set(state.careerWorld.competitions.registration.registeredPlayerIds):null,availableIds=new Set(selection.players.filter(player=>isPlayerAvailable(player)&&(!registered||registered.has(player.id))).map(player=>player.id)),lineup=unique((Array.isArray(source.lineup)?source.lineup:[]).map(String).filter(id=>availableIds.has(id)));
 if(lineup.length!==11)return failure(state,'lineup-invalid','Select exactly 11 unique registered players.');
 const positionSuitability=lineupPositionReport({...selection,formation,lineup},formation);
 if(positionSuitability.actual.GK!==1)return failure(state,'lineup-no-goalkeeper','The starting XI needs exactly one goalkeeper.',{positionSuitability});
 if(!positionSuitability.suitable)return failure(state,'lineup-position-unsuitable',`The ${formation} needs a more suitable positional balance. No more than two starters may cover a different unit.`,{positionSuitability});
 const bench=unique((Array.isArray(source.bench)?source.bench:selection.players.filter(player=>isPlayerAvailable(player)&&!lineup.includes(player.id)).map(player=>player.id)).map(String).filter(id=>availableIds.has(id)&&!lineup.includes(id))).slice(0,9);
 selection.formation=formation;selection.lineup=lineup;selection.bench=bench;
 return operation(state,{type:'lineup-set',code:'lineup-set',message:`The ${squadLabel(key)} ${formation} selection was saved.`},true,{squad:key,selection:clone(selection),positionSuitability});
}

export function makeSubstitution(input,squad,outPlayerId,inPlayerId){
 if(inPlayerId===undefined){inPlayerId=outPlayerId;outPlayerId=squad;squad='first'}
 const state=normalizeFootballState(input),key=squadKey(squad),selection=state.squads[key],outId=String(outPlayerId||''),inId=String(inPlayerId||'');
 if(!selection)return failure(state,'squad-unavailable','That squad is not available.');
 const outIndex=selection.lineup.indexOf(outId),benchIndex=selection.bench.indexOf(inId);
 if(outIndex<0||benchIndex<0)return failure(state,'substitution-invalid','Choose one starter to replace and one named substitute to enter.');
 selection.lineup[outIndex]=inId;selection.bench[benchIndex]=outId;
 return operation(state,{type:'substitution-made',code:'substitution-made',message:`The ${squadLabel(key)} selection substituted ${selection.players.find(player=>player.id===inId)?.name||'a player'} on.`},true,{squad:key,lineup:clone(selection.lineup),bench:clone(selection.bench)});
}

export function signSeniorPlayer(input,playerId){
 const state=normalizeFootballState(input),index=state.recruitment.market.findIndex(player=>player.id===String(playerId));
 if(index<0)return failure(state,'recruit-unknown','That senior player is no longer in the recruitment market.');
 if(state.squads.first.players.filter(player=>!['released','transferred'].includes(player.careerStatus)).length>=25)return failure(state,'senior-squad-full','The first-team squad is at its 25-player limit.');
 const player=state.recruitment.market[index],currentWages=squadWeeklyWages(state,'first'),newWages=currentWages+player.weeklyWage;
 if(newWages>state.finance.weeklyFirstTeamBudget)return failure(state,'senior-wage-budget','Increase the weekly first-team budget before offering this contract.',{currentWages,requiredWeeklyBudgetAud:newWages});
 if(state.finance.cash<player.signingFeeAud)return failure(state,'cash-insufficient',`Signing ${player.name} requires a $${player.signingFeeAud.toLocaleString()} fee.`);
 state.finance.cash-=player.signingFeeAud;state.finance.seasonExpenses+=player.signingFeeAud;state.recruitment.market.splice(index,1);
 pushLedgerInPlace(state,'player-signing',`${player.name} signing fee`,-player.signingFeeAud);
 const signed=clone(player);delete signed.signingFeeAud;signed.contractSeasons=Math.max(1,signed.contractSeasons||2);state.squads.first.players.push(signed);if(state.squads.first.bench.length<9)state.squads.first.bench.push(signed.id);
 repairSquadNumbers(state.squads.first.players);
 resyncCareerPlayersInPlace(state);
 return operation(state,{type:'player-signed',code:'senior-player-signed',message:`${signed.name} signed for the first team.`},true,{player:clone(signed),signingFeeAud:player.signingFeeAud,totalWeeklyWagesAud:newWages});
}

export function signTrialist(input,playerId){
 const state=normalizeFootballState(input),index=state.recruitment.trialists.findIndex(player=>player.id===String(playerId));
 if(index<0)return failure(state,'trialist-unknown','That academy trialist is no longer available.');
 if(state.squads.academy.players.length>=30)return failure(state,'academy-squad-full','The academy intake is at its 30-player limit.');
 const player=state.recruitment.trialists.splice(index,1)[0],signed=clone(player);delete signed.traits;state.squads.academy.players.push(signed);repairSquadNumbers(state.squads.academy.players);if(state.squads.academy.bench.length<9)state.squads.academy.bench.push(signed.id);
 state.academy.talent=clamp(state.academy.talent+(signed.rating-state.academy.talent)*.025,0,100);
 return operation(state,{type:'academy-trialist-signed',code:'academy-trialist-signed',message:`${signed.name} joined the academy intake.`},true,{player:clone(signed)});
}

function staffWeeklyWages(state){
 if(state.footballOperations)return operationsGetPeopleView(state.footballOperations).weeklyPayrollAud;
 return STAFF_ROLES.reduce((total,role)=>total+(role.weeklyWages[state.staff[role.id]||0]||0),0);
}

function operationsFinanceSnapshot(state){
 if(!state.footballOperations)return {sponsorship:0,merchandise:0,sponsorBonuses:0,staff:staffWeeklyWages(state),commercialPlan:0,sponsorPenalties:0,exact:false};
 const view=operationsGetCommercialView(state.footballOperations),weekly=view.lastWeekly||{},exact=weekly.season===state.season&&weekly.week===Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks)&&state.footballOperations.lastTickKey===`${weekly.season}:${weekly.week}`;
 return {
  sponsorship:exact?money(weekly.sponsorIncomeAud,0,0):money(view.weeklyContractedIncomeAud,0,0),
  merchandise:exact?money(weekly.merchandiseIncomeAud,0,0):money(weekly.merchandiseIncomeAud,0,0),
  sponsorBonuses:exact?money(weekly.bonusesAud,0,0):0,
  staff:exact?money(weekly.staffWagesAud,0,0):money(operationsGetPeopleView(state.footballOperations).weeklyPayrollAud,0,0),
  commercialPlan:exact?money(weekly.planSpendAud,0,0):money(view.weeklyPlanSpendAud,0,0),
  sponsorPenalties:exact?money(weekly.penaltiesAud,0,0):0,
  exact
 };
}

function settleFootballOperationsInPlace(state){
 const divisionPosition=positionFor(state,state.competitions.first,PLAYER_FIRST_TEAM_ID),averageAttendance=state.metrics.homeMatches?Math.round(state.metrics.attendanceTotal/state.metrics.homeMatches):0,metrics={
  supporters:state.footballOperations?.commercial?.metrics?.supporters,
  communityReach:state.footballOperations?.commercial?.metrics?.communityReach,
  digitalFollowers:state.footballOperations?.commercial?.metrics?.digitalFollowers,
  commercialReputation:state.footballOperations?.commercial?.metrics?.commercialReputation,
  averageAttendance,wins:state.metrics.seniorWins,academyGraduates:state.metrics.academyGraduates
 };
 const result=tickFootballOperations(state.footballOperations,{season:state.season,week:Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),leaguePosition:divisionPosition,metrics});
 if(result?.ok)state.footballOperations=result.state;
 return result;
}

function facilityMaintenance(state){
 const capitalIndex=Object.entries(state.facilities).reduce((total,[id,level])=>total+level*(id==='stadium'?1800:id==='fields'?750:420),0);
 const site=getStartSite(state.club.siteId),rates=Math.round(site.acquisitionCostAud*.012/FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks);
 return capitalIndex+rates;
}

function playerWeeklyWageLiability(state,player){
 if(!player||['released','transferred'].includes(player.careerStatus))return 0;
 const loan=player.careerStatus==='loaned'?state.careerWorld?.loans?.find(item=>item.playerId===player.id&&item.status==='active'&&item.direction==='out'):null,clubShare=loan?1-clamp(loan.wageContribution,0,100,0)/100:1;
 return Math.round(money(player.weeklyWage,0,0)*clubShare);
}

function squadWeeklyWages(state,key){
 return (state.squads[key]?.players||[]).reduce((sum,player)=>sum+playerWeeklyWageLiability(state,player),0);
}

export function getWeeklyPlayerWages(input){
 const state=normalizeFootballState(input),firstTeam=squadWeeklyWages(state,'first'),u23=squadWeeklyWages(state,'u23'),bTeam=squadWeeklyWages(state,'b'),bU23=squadWeeklyWages(state,'bU23');
 return {firstTeam,u23,bTeam,bU23,total:firstTeam+u23+bTeam+bU23,budgetCeiling:state.finance.weeklyFirstTeamBudget,budgetRemaining:state.finance.weeklyFirstTeamBudget-firstTeam,withinBudget:firstTeam<=state.finance.weeklyFirstTeamBudget};
}

function currentWeekMatchdayIncome(state){
 const result=state.competitions.first.lastResult;
 if(!result||result.week!==state.week||result.home!==PLAYER_FIRST_TEAM_ID||!result.attendance)return {homeMatch:false,attendance:0,ticketPriceAud:0,ticketRevenueAud:0,hospitalityRevenueAud:0,concessionRevenueAud:0,operatingCostAud:0,totalRevenueAud:0,resultId:null};
 const division=getSeniorDivision(state.first.divisionId),attendance=integer(result.attendance,0,200_000,0),ticketPriceAud=result.matchday?.ticketPriceAud??FOOTBALL_GAME_ASSUMPTIONS.ticketPricesByTierAud?.[division.tier]??15,ticketRevenueAud=result.matchday?.ticketRevenueAud??attendance*ticketPriceAud,hospitalityRevenueAud=result.matchday?.hospitalityRevenueAud??Math.round(attendance*facilityEffect(state,'clubhouse','revenue')*(.62+state.club.reputation*.0035));
 const concessionRevenueAud=result.matchday?.concessionRevenueAud??0,operatingCostAud=result.matchday?.operatingCostAud??0;
 return {homeMatch:true,attendance,ticketPriceAud,ticketRevenueAud,hospitalityRevenueAud,concessionRevenueAud,operatingCostAud,totalRevenueAud:ticketRevenueAud+hospitalityRevenueAud+concessionRevenueAud,resultId:result.id};
}

function clubAssetValueInState(state){
 const site=getStartSite(state.club.siteId);
 let value=site.acquisitionCostAud+site.initialClearanceCostAud;
 for(const definition of FACILITY_UPGRADES){
  const level=state.facilities[definition.id]||0;
  if(definition.id==='fields')value+=site.expansionStages.filter(stage=>stage.fieldNumber<=level).reduce((sum,stage)=>sum+stage.buildCostAud,0);
  else value+=definition.levels.filter(item=>item.level<=level).reduce((sum,item)=>sum+(item.costAud||0),0);
 }
 return Math.round(value);
}

export function getClubAssetValue(input){return clubAssetValueInState(normalizeFootballState(input))}

export function financeSnapshot(input){
 const state=normalizeFootballState(input),market=academyMarketProjection(state),division=getSeniorDivision(state.first.divisionId),site=getStartSite(state.club.siteId);
 const academyIncome=Math.round(state.academy.enrolment*state.academy.feeAud/FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks);
 const matchdayDetail=currentWeekMatchdayIncome(state),matchday=matchdayDetail.totalRevenueAud;
 const operationsFinance=operationsFinanceSnapshot(state),sponsorship=operationsFinance.sponsorship,merchandise=operationsFinance.merchandise,sponsorBonuses=operationsFinance.sponsorBonuses,grants=Math.round((20_000+(8-division.tier)*15_000+(state.academy.femaleProgramme?15_000:0))/FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),income=academyIncome+matchday+sponsorship+merchandise+sponsorBonuses+grants;
 const staff=operationsFinance.staff,commercialPlan=operationsFinance.commercialPlan,sponsorPenalties=operationsFinance.sponsorPenalties,facilities=facilityMaintenance(state),temporaryVenue=state.facilities.fields===0?FOOTBALL_GAME_ASSUMPTIONS.temporaryVenueWeeklyAud:0,academyCosts=Math.round(2200+state.academy.enrolment*28+(state.facilities.academy||0)*900);
 const loanInterest=Math.round(state.finance.debt*FOOTBALL_GAME_ASSUMPTIONS.startupLoanAnnualRate/FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),loanPrincipal=state.finance.debt>0?Math.min(state.finance.debt,Math.ceil(state.finance.debt/Math.max(1,state.finance.loanWeeksRemaining))):0;
 const firstTeam=squadWeeklyWages(state,'first'),u23=squadWeeklyWages(state,'u23'),bTeamPlayers=squadWeeklyWages(state,'b'),bU23=squadWeeklyWages(state,'bU23'),bTeam=state.b?bTeamPlayers+bU23:0,bTeamLicence=state.b?Math.round(state.b.annualLicenceAud/FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks):0,travel=Math.round(350+site.travelBurden*18+(8-division.tier)*220+(state.b?site.travelBurden*5:0)),matchdayOperating=matchdayDetail.operatingCostAud,expenses=firstTeam+u23+bTeam+bTeamLicence+staff+commercialPlan+sponsorPenalties+facilities+temporaryVenue+academyCosts+travel+matchdayOperating+loanInterest+loanPrincipal;
 const assetValue=clubAssetValueInState(state),debtToAssets=assetValue>0?state.finance.debt/assetValue:1;
 const net=income-expenses,runwayWeeks=net<0?Math.max(0,Math.floor(state.finance.cash/Math.abs(net))):999;
 return {cash:state.finance.cash,debt:state.finance.debt,income,weeklyIncome:income,expenses,weeklyExpenses:expenses,net,runwayWeeks,assetValue,debtToAssets,breakdown:{academyIncome,matchday,tickets:matchdayDetail.ticketRevenueAud,hospitality:matchdayDetail.hospitalityRevenueAud,concessions:matchdayDetail.concessionRevenueAud,matchdayOperating,matchdayAttendance:matchdayDetail.attendance,matchdayResultId:matchdayDetail.resultId,sponsorship,merchandise,sponsorBonuses,sponsorPenalties,commercialPlan,commercialSettled:operationsFinance.exact,grants,firstTeam,u23,bTeam,bTeamLicence,staff,facilities,temporaryVenue,academyCosts,travel,loanInterest,loanPrincipal,budgetCeiling:state.finance.weeklyFirstTeamBudget},market,workingCapitalTarget:expenses*8};
}

function applyWeeklyFinanceInPlace(state){
 const settlementKey=`${state.season}:${Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks)}`;
 if(state.finance.lastSettledKey===settlementKey)return {...financeSnapshot(state),income:0,weeklyIncome:0,expenses:0,weeklyExpenses:0,net:0,alreadySettled:true};
 settleFootballOperationsInPlace(state);
 const snapshot=financeSnapshot(state);
 state.finance.cash=money(state.finance.cash+snapshot.net,state.finance.cash);
 state.finance.debt=Math.max(0,state.finance.debt-snapshot.breakdown.loanPrincipal);
 if(state.finance.debt>0)state.finance.loanWeeksRemaining=Math.max(1,state.finance.loanWeeksRemaining-1);else state.finance.loanWeeksRemaining=0;
 state.finance.seasonIncome=money(state.finance.seasonIncome+snapshot.income,0,0);state.finance.seasonExpenses=money(state.finance.seasonExpenses+snapshot.expenses,0,0);
 state.finance.lastWeekly={income:snapshot.income,expenses:snapshot.expenses,net:snapshot.net,week:state.week};
 state.finance.lastSettledKey=settlementKey;
 state.finance.history=[...state.finance.history.slice(-103),{season:state.season,week:state.week,income:snapshot.income,expenses:snapshot.expenses,net:snapshot.net}];
 const entries=[['academy-fees','Academy season-fee income',snapshot.breakdown.academyIncome],['tickets','Home-match ticket income',snapshot.breakdown.tickets],['hospitality','Clubhouse hospitality income',snapshot.breakdown.hospitality],['concessions','Home-match concession income',snapshot.breakdown.concessions],['matchday-operations','Home-match staffing and operations',-snapshot.breakdown.matchdayOperating],['sponsorship','Named partnership income',snapshot.breakdown.sponsorship],['merchandise','Merchandise sales',snapshot.breakdown.merchandise],['sponsor-bonus','Partner objective bonuses',snapshot.breakdown.sponsorBonuses],['sponsor-penalty','Partner objective penalties',-snapshot.breakdown.sponsorPenalties],['commercial-plan','Community, digital and merchandise investment',-snapshot.breakdown.commercialPlan],['grants','Football and participation grants',snapshot.breakdown.grants],['player-wages','Contracted first-team player wages',-snapshot.breakdown.firstTeam],['u23-wages','Contracted U23 player wages',-snapshot.breakdown.u23],['b-team','B-team players and licence',-(snapshot.breakdown.bTeam+snapshot.breakdown.bTeamLicence)],['staff','Named football-department payroll',-snapshot.breakdown.staff],['travel','Competition travel',-snapshot.breakdown.travel],['maintenance','Facilities and site maintenance',-snapshot.breakdown.facilities],['academy-services','Academy delivery costs',-snapshot.breakdown.academyCosts],['temporary-ground','Temporary home-ground rental',-snapshot.breakdown.temporaryVenue],['loan','Loan principal and interest',-(snapshot.breakdown.loanPrincipal+snapshot.breakdown.loanInterest)]];
 for(const [category,description,amount] of entries)if(amount)pushLedgerInPlace(state,category,description,amount);
 state.finance.missedPayrollWeeks=state.finance.cash<0?state.finance.missedPayrollWeeks+1:0;
 return snapshot;
}

export function applyWeeklyFinance(input){
 const state=normalizeFootballState(input),snapshot=applyWeeklyFinanceInPlace(state);
 const bankruptcy=checkBankruptcyInPlace(state);
 return operation(state,{type:'weekly-finance',code:bankruptcy.code,message:`Weekly club cash flow was ${snapshot.net>=0?'+':''}$${snapshot.net.toLocaleString()}.`},true,{snapshot,bankruptcy});
}

export function investOwnerFunds(input,amountAud){
 const state=normalizeFootballState(input),amount=money(amountAud,0,0);
 if(amount<1)return failure(state,'owner-transfer-invalid','Enter a positive owner investment.');
 state.finance.cash=money(state.finance.cash+amount);state.finance.ownerInvested=money(state.finance.ownerInvested+amount,0,0);
 pushLedgerInPlace(state,'owner-investment','Owner investment from Dorra',amount);
 if(state.status==='administration'&&state.finance.cash>=0&&state.finance.missedPayrollWeeks<3)state.status='active';
 return operation(state,{type:'owner-investment',code:'owner-investment',message:`The owner invested $${amount.toLocaleString()} in the club.`},true,{walletDeltaAud:-amount,clubCashDeltaAud:amount});
}

export function withdrawOwnerFunds(input,amountAud){
 const state=normalizeFootballState(input),amount=money(amountAud,0,0),available=Math.max(0,state.finance.cash);
 if(amount<1)return failure(state,'owner-transfer-invalid','Enter a positive owner withdrawal.');
 if(state.finance.debt>0)return failure(state,'owner-withdrawal-debt','Repay the startup loan before withdrawing club funds.');
 if(amount>available)return failure(state,'club-cash-insufficient','The club does not have enough cash for that withdrawal.',{available});
 state.finance.cash-=amount;state.finance.ownerWithdrawn=money(state.finance.ownerWithdrawn+amount,0,0);
 pushLedgerInPlace(state,'owner-withdrawal','Owner withdrawal returned to Dorra',-amount);
 return operation(state,{type:'owner-withdrawal',code:'owner-withdrawal',message:`The owner withdrew $${amount.toLocaleString()} from club cash.`},true,{availableAfter:available-amount,walletDeltaAud:amount,clubCashDeltaAud:-amount});
}

export function transferOwnerFunds(input,amountAud){return Number(amountAud)>=0?investOwnerFunds(input,amountAud):withdrawOwnerFunds(input,Math.abs(Number(amountAud)))}

export function repayStartupLoan(input,amountAud){
 const state=normalizeFootballState(input),amount=money(amountAud,0,0);
 if(state.finance.debt<=0)return failure(state,'loan-repaid','The startup loan is already repaid.');
 if(amount<1)return failure(state,'loan-payment-invalid','Enter a positive startup-loan repayment.');
 const payment=Math.min(amount,state.finance.debt);
 if(state.finance.cash<payment)return failure(state,'club-cash-insufficient','The club does not have enough cash for that loan repayment.');
 state.finance.cash-=payment;state.finance.debt-=payment;state.finance.seasonExpenses+=payment;if(state.finance.debt===0)state.finance.loanWeeksRemaining=0;
 pushLedgerInPlace(state,'loan','Extra startup-loan repayment',-payment);
 return operation(state,{type:'loan-repayment',code:'loan-repayment',message:`The club repaid $${payment.toLocaleString()} of its startup loan.`},true,{paymentAud:payment,remainingDebtAud:state.finance.debt});
}

export function hireStaff(input,roleId){
 const state=normalizeFootballState(input),role=getStaffRole(roleId);
 if(!role)return failure(state,'staff-role-unknown','Choose a recognised staff department.');
 const level=state.staff[role.id]||0;
 if(level>=role.maxLevel)return failure(state,'staff-max-level',`${role.name} is already at its maximum level.`);
 const toLevel=level+1,cost=role.hireCosts[toLevel]||0;
 if(state.finance.cash<cost)return failure(state,'cash-insufficient',`Hiring this staff level requires $${cost.toLocaleString()}.`);
 state.finance.cash-=cost;state.finance.seasonExpenses+=cost;state.staff[role.id]=toLevel;
 pushLedgerInPlace(state,'staff',`${role.name} hiring and upgrade`,-cost);
 return operation(state,{type:'staff-hired',code:'staff-hired',message:`${role.name} advanced to level ${toLevel}.`},true,{costAud:cost,weeklyWages:role.weeklyWages[toLevel]});
}

export function reduceStaff(input,roleId){
 const state=normalizeFootballState(input),role=getStaffRole(roleId);
 if(!role)return failure(state,'staff-role-unknown','Choose a recognised staff department.');
 const minimum=['head-coach','academy-director','grounds-team'].includes(role.id)?1:0,level=state.staff[role.id]||0;
 if(level<=minimum)return failure(state,'staff-minimum-level','The club must retain this minimum staffing level.');
 state.staff[role.id]=level-1;
 return operation(state,{type:'staff-reduced',code:'staff-reduced',message:`${role.name} was reduced to level ${level-1}.`});
}

export function getConstructionQuote(input,facilityId){
 const state=normalizeFootballState(input),definition=getFacility(facilityId);
 if(!definition)return {ok:false,code:'facility-unknown',message:'Choose a recognised facility.'};
 const site=getStartSite(state.club.siteId),current=state.facilities[facilityId]||0,maximum=facilityId==='fields'?site.maxFields:definition.maxLevel,toLevel=current+1;
 if(toLevel>maximum)return {ok:false,code:'facility-max-level',message:`${definition.name} cannot be expanded further at this site.`};
 const level=definition.levels.find(item=>item.level===toLevel),stage=facilityId==='fields'?site.expansionStages.find(item=>item.fieldNumber===toLevel):null;
 const costAud=stage?.buildCostAud??level?.costAud??0,buildDurationMs=stage?.buildDurationMs??level?.buildDurationMs??60*60*1000;
 return {
  ok:true,facilityId,currentLevel:current,toLevel,name:facilityId==='fields'?`${toLevel}-field campus`:level?.name||definition.name,
  buildDurationMs,baseCostAud:level?.costAud||0,siteBuildCostAud:stage?.buildCostAud||0,clearanceAllocationAud:stage?.clearanceAllocationAud||0,
  fieldBuildCostAud:stage?.fieldBuildCostAud||0,parcelPurchaseCostAud:stage?.parcelPurchaseCostAud||0,unlockedHectares:stage?.unlockedHectares??null,
  clearanceAlreadyFunded:Boolean(stage?.clearanceAlreadyFunded),clearanceUnits:stage?.clearanceUnits||0,clearanceUnitName:stage?.clearanceUnitName||'',demolition:clone(stage?.demolition||null),costAud,siteLimit:maximum
 };
}

export function startConstruction(input,facilityId,options={}){
 const requestedNow=Number.isFinite(Number(options.nowMs))?Number(options.nowMs):Date.now(),state=normalizeFootballState(input,{nowMs:requestedNow}),quote=getConstructionQuote(state,facilityId);
 if(!quote.ok)return failure(state,quote.code,quote.message);
 if(state.projects.some(project=>project.facilityId===facilityId))return failure(state,'construction-already-active','That facility already has an active construction project.');
 if(state.finance.cash<quote.costAud)return failure(state,'cash-insufficient',`This project requires $${quote.costAud.toLocaleString()}.`);
 const nowMs=Math.round(clamp(requestedNow,WALL_CLOCK_MIN,WALL_CLOCK_MAX,Date.now()));
 state.counters.project+=1;
 const project={id:`P${state.counters.project}`,facilityId,toLevel:quote.toLevel,startedAtMs:nowMs,completesAtMs:nowMs+quote.buildDurationMs,costAud:quote.costAud};
 state.projects.push(project);state.finance.cash-=quote.costAud;state.finance.seasonExpenses+=quote.costAud;
 pushLedgerInPlace(state,'construction',`${quote.name} construction`,-quote.costAud);
 return operation(state,{type:'construction-started',code:'construction-started',message:`Construction started on ${quote.name}.`},true,{project:clone(project),quote});
}

export function cancelConstruction(input,projectId){
 const state=normalizeFootballState(input),index=state.projects.findIndex(project=>project.id===projectId);
 if(index<0)return failure(state,'project-unknown','That construction project is not active.');
 const [project]=state.projects.splice(index,1),refund=Math.round(project.costAud*.4);
 state.finance.cash=money(state.finance.cash+refund);state.finance.seasonExpenses=Math.max(0,state.finance.seasonExpenses-refund);
 pushLedgerInPlace(state,'construction','Cancelled construction recovery',refund);
 return operation(state,{type:'construction-cancelled',code:'construction-cancelled',message:`Construction was cancelled with a $${refund.toLocaleString()} recovery.`},true,{refundAud:refund,project});
}

function reconcileProjectsInPlace(state,nowMs){
 const effectiveNow=Math.round(clamp(nowMs,WALL_CLOCK_MIN,WALL_CLOCK_MAX,Date.now())),completed=[],remaining=[];
 for(const project of state.projects){
  if(project.completesAtMs<=effectiveNow){
   state.facilities[project.facilityId]=Math.max(state.facilities[project.facilityId]||0,project.toLevel);
   if(project.facilityId==='fields'&&project.toLevel>=1)state.facilities.pitch=Math.max(1,state.facilities.pitch||0);
   completed.push(project);
  }
  else remaining.push(project);
 }
 state.projects=remaining;
 return completed;
}

export function reconcileConstruction(input,nowMs){
 const effective=Number.isFinite(Number(nowMs))?Number(nowMs):Date.now(),state=normalizeFootballState(input),completed=reconcileProjectsInPlace(state,effective);
 return operation(state,{type:'construction-reconciled',code:completed.length?'construction-completed':'construction-pending',message:completed.length?`${completed.length} construction project${completed.length===1?'':'s'} completed.`:'No construction project is due yet.'},true,{completed:clone(completed)});
}

export function getConstructionSkipCost(input,projectId,nowMs){
 const state=normalizeFootballState(input),project=state.projects.find(item=>item.id===projectId);
 if(!project)return {ok:false,code:'project-unknown',costTokens:0,remainingMs:0};
 const effectiveNow=Math.round(clamp(Number.isFinite(Number(nowMs))?Number(nowMs):Date.now(),WALL_CLOCK_MIN,WALL_CLOCK_MAX,Date.now())),remainingMs=Math.max(0,project.completesAtMs-effectiveNow);
 return {ok:true,projectId,costTokens:Math.ceil(remainingMs/(60*60*1000)),remainingMs,effectiveNow};
}

export function skipConstruction(input,projectId,nowMs){
 const state=normalizeFootballState(input),quote=getConstructionSkipCost(state,projectId,nowMs);
 if(!quote.ok)return failure(state,quote.code,'That construction project is not active.');
 if(quote.costTokens===0)return reconcileConstruction(state,quote.effectiveNow);
 if(state.footballTokens<quote.costTokens)return failure(state,'football-tokens-insufficient',`Skipping this timer requires ${quote.costTokens} football token${quote.costTokens===1?'':'s'}.`,{skipQuote:quote});
 const project=state.projects.find(item=>item.id===projectId);state.footballTokens-=quote.costTokens;state.projects=state.projects.filter(item=>item.id!==projectId);
 state.facilities[project.facilityId]=Math.max(state.facilities[project.facilityId]||0,project.toLevel);if(project.facilityId==='fields'&&project.toLevel>=1)state.facilities.pitch=Math.max(1,state.facilities.pitch||0);
 return operation(state,{type:'construction-skipped',code:'construction-skipped',message:`Construction completed immediately for ${quote.costTokens} football token${quote.costTokens===1?'':'s'}.`},true,{costTokens:quote.costTokens,project:clone(project)});
}

function objectiveReady(state,id){
 if(id==='first-win')return state.metrics.seniorWins>=1;
 if(id==='positive-week')return (state.finance.lastWeekly?.net||0)>0;
 if(id==='academy-assessed')return state.academy.lastAssessmentSeason>0;
 if(id==='gold-academy')return state.academy.shield==='gold';
 if(id==='npl-arrival')return ['npl-qld','a-league'].includes(state.first.divisionId)||state.metrics.nplSeasons>0;
 if(id==='a-league-admission')return state.club.aLeagueMember;
 return false;
}

export function getFootballObjectives(input){
 const state=normalizeFootballState(input);
 return FOOTBALL_OBJECTIVES.map(objective=>({...clone(objective),ready:objectiveReady(state,objective.id),claimed:state.objectives.claimed.includes(objective.id)}));
}

export function claimFootballObjective(input,objectiveId){
 const state=normalizeFootballState(input),objective=FOOTBALL_OBJECTIVES.find(item=>item.id===objectiveId);
 if(!objective)return failure(state,'objective-unknown','Choose a recognised football objective.');
 if(state.objectives.claimed.includes(objective.id))return failure(state,'objective-claimed','That football objective was already claimed.');
 if(!objectiveReady(state,objective.id))return failure(state,'objective-not-ready','That football objective is not complete yet.');
 state.objectives.claimed.push(objective.id);state.footballTokens+=objective.rewardTokens;
 return operation(state,{type:'football-objective',code:'objective-claimed',message:`${objective.name} awarded ${objective.rewardTokens} football tokens.`},true,{rewardTokens:objective.rewardTokens,objective:clone(objective)});
}

function updateAcademyMarketInPlace(state){
 const projection=academyMarketProjection(state),style=getPlayingStyle(state.academy.styleId),required=academyTrainingRequirement(state),sessions=state.academy.training.days.length,programme=trainingProgramme(state.academy),intensity=programme.intensity,coaching=managerCoachingEffect(state,'academy');
 const attendeeIds=academyTrainingAttendeeIds(state),availableTotal=state.squads.academy.players.filter(isPlayerAvailable).length;
 state.academy.lastTrainingAttendance={season:state.season,week:state.week,attended:attendeeIds.size,total:availableTotal,schoolBreak:academySchoolBreakWeek(state.week)};
 state.academy.trialInterest=clamp(state.academy.trialInterest*.72+projection.interest*.28,0,100);
 state.academy.talent=clamp(state.academy.talent*.84+projection.applicantTalent*.16+style.academyDevelopment*.06,0,100);
 state.academy.wealth=clamp(state.academy.wealth*.82+projection.applicantWealth*.18,0,100);
 state.academy.enrolment=Math.round(clamp(state.academy.enrolment*.8+projection.projectedEnrolment*.2,30,projection.capacity));
 const compliance=sessions>=required?1:-1,stateTraining=sessions*intensity.development;
 state.academy.satisfaction=clamp(state.academy.satisfaction+compliance*.35+(stateTraining-required)*.08,0,100);
 state.academy.familiarity=clamp(state.academy.familiarity+programme.familiarity*.55*intensity.development*coaching.development+.1,0,100);
 for(const player of state.squads.academy.players){
  const attended=attendeeIds.has(player.id);
  player.fatigue=clamp(player.fatigue+(attended?programme.load*1.35*intensity.fatigue:0)-10-programme.recovery*.52-facilityEffect(state,'gym','recovery')*.08,0,100);
  if(attended)player.morale=clamp(player.morale+(compliance>0?.25:-.2),0,100);
  if(attended&&state.week%10===0)player.rating=integer(player.rating+Math.max(0,(player.potential-player.rating)*.0085*programme.development*intensity.development*coaching.development*playerDevelopmentMultiplier(player)),1,99,player.rating);
 }
}

function recoverSquadInPlace(state,squad='first'){
 const holder=squad==='b'?state.b:squad==='u23'?state.u23:state.first;
 if(!holder)return;
 const schedule=holder.training,programme=trainingProgramme(holder),intensity=programme.intensity,style=getPlayingStyle(holder.styleId),medical=(state.staff['medical-team']||0)*2+(state.staff['sports-science']||0)*1.5+facilityEffect(state,'medical','recovery')*.18+facilityEffect(state,'gym','recovery')*.12,coaching=managerCoachingEffect(state,squad);
 const trainingLoad=programme.load*1.45*intensity.fatigue*style.fatigue,baseRecovery=9+medical+programme.recovery*.72,teamRecovery=baseRecovery+holder.fatigue*.16;
 holder.fatigue=clamp(holder.fatigue+trainingLoad-teamRecovery,0,100);
 holder.morale=clamp(holder.morale+.2,0,100);
 holder.familiarity=clamp(holder.familiarity+programme.familiarity*.55*intensity.development*coaching.development+.08,0,100);
 const selection=state.squads[squadSelectionKey(squad)];
 for(const player of selection.players){
  const playerRecovery=baseRecovery*.82+player.fatigue*.13;player.fatigue=clamp(player.fatigue+trainingLoad*.7-playerRecovery,0,100);player.morale=clamp(player.morale+.15,0,100);
  if(state.week%10===0&&player.age<=27)player.rating=integer(player.rating+Math.max(0,(player.potential-player.rating)*.0055*programme.development*intensity.development*coaching.development*playerDevelopmentMultiplier(player)),1,99,player.rating);
 }
}

function refreshRecruitmentInPlace(state){
 const key=`${state.season}:${state.week}`;
 if(state.recruitment?.key!==key){const site=getStartSite(state.club.siteId);state.recruitment=generateRecruitment(state.seed,state.season,state.week,state.first.divisionId,state.academy.talent,{siteTalent:site.talent,reputation:state.club.reputation,interest:state.academy.trialInterest,staffLevel:state.staff.recruitment||0})}
 state.academy.trials=clone(state.recruitment.funnel);
 return state.recruitment;
}

function playerDevelopmentMultiplier(player){
 const focus=FOOTBALL_DEVELOPMENT_FOCUSES.includes(player?.developmentFocus)?player.developmentFocus:'balanced',roleMatch=(focus==='goalkeeping'&&player.position==='GK')||(focus==='defending'&&player.position==='DF')||(focus==='playmaking'&&player.position==='MF')||(focus==='finishing'&&player.position==='FW');
 return focus==='balanced'?1:roleMatch?1.24:1.12;
}

export function refreshRecruitmentMarket(input){
 const state=normalizeFootballState(input),previousKey=state.recruitment.key;
 const site=getStartSite(state.club.siteId);state.recruitment=generateRecruitment(state.seed,state.season,state.week,state.first.divisionId,state.academy.talent,{siteTalent:site.talent,reputation:state.club.reputation,interest:state.academy.trialInterest,staffLevel:state.staff.recruitment||0});state.academy.trials=clone(state.recruitment.funnel);
 return operation(state,{type:'recruitment-refreshed',code:'recruitment-refreshed',message:'The weekly recruitment market and academy trial list are ready.'},true,{changed:previousKey!==state.recruitment.key,recruitment:clone(state.recruitment)});
}

function tickPlayerInjuriesInPlace(state,newInjuryIds=new Set()){
 for(const [key,selection] of Object.entries(state.squads).filter(([,value])=>Boolean(value))){
  if(key!=='first')for(const player of selection.players)if(player.injuryWeeks>0&&!newInjuryIds.has(player.id))player.injuryWeeks-=1;
 }
 for(const selection of Object.values(state.squads).filter(Boolean))repairSquadSelection(selection);
}

function applyTrainingInjuriesInPlace(state){
 const incidents=[];
 for(const key of state.b?['first','u23','academy','b']:['first','u23','academy']){
  const holder=holderFor(state,key),selection=state.squads[squadSelectionKey(key)],programme=trainingProgramme(holder),intensity=programme.intensity,random=seededRandom(`${state.seed}|training-injury|${state.season}|${state.week}|${key}`);
  const academyAttendees=key==='academy'?academyTrainingAttendeeIds(state):null;
  for(const player of selection.players.filter(player=>isPlayerAvailable(player)&&(!academyAttendees||academyAttendees.has(player.id)))){
   const risk=clamp(.0002+player.fatigue*.000045+programme.load*Math.max(0,intensity.fatigue-.65)*.00024+Math.max(0,programme.injuryRisk)*.0007-(state.staff['sports-science']||0)*.0002,.0001,.018);
   if(random()<risk){const injuryWeeks=integer(1+random()*3,1,4,2);player.injuryWeeks=injuryWeeks;incidents.push({squad:key,playerId:player.id,playerName:player.name,injuryWeeks});break}
  }
  repairSquadSelection(selection);
 }
 return incidents;
}

function bankruptcyProjection(state){
 const snapshot=financeSnapshot(state),assetBuffer=getStartSite(state.club.siteId).acquisitionCostAud*.08,creditLimit=Math.max(250_000,Math.min(5_000_000,assetBuffer+snapshot.income*12));
 const danger=state.finance.cash<0||state.finance.missedPayrollWeeks>=3,bankrupt=state.finance.cash<-creditLimit||state.finance.missedPayrollWeeks>=6||state.status==='bankrupt';
 return {danger,bankrupt,creditLimit,missedPayrollWeeks:state.finance.missedPayrollWeeks,cash:state.finance.cash,status:bankrupt?'bankrupt':danger?'administration':'active'};
}

export function getBankruptcyStatus(input){return bankruptcyProjection(normalizeFootballState(input))}

function checkBankruptcyInPlace(state){
 const projection=bankruptcyProjection(state),previous=state.status;
 state.status=projection.status;
 if(state.status==='bankrupt'){
  state.projects=[];state.finance.weeklyFirstTeamBudget=0;
  return {...projection,code:'club-bankrupt',changed:previous!=='bankrupt'};
 }
 if(state.status==='administration')return {...projection,code:'club-administration',changed:previous!=='administration'};
 return {...projection,code:'club-solvent',changed:previous!=='active'};
}

export function checkBankruptcy(input){
 const state=normalizeFootballState(input),projection=checkBankruptcyInPlace(state);
 return operation(state,{type:'financial-status',code:projection.code,message:projection.bankrupt?'The club has entered bankruptcy.':projection.danger?'The club has entered financial administration.':'The club is solvent.'},true,{projection});
}

export function declareBankruptcy(input){
 const state=normalizeFootballState(input),projection=bankruptcyProjection(state);
 if(!projection.danger)return failure(state,'bankruptcy-not-available','The solvent club cannot voluntarily enter bankruptcy.');
 state.status='bankrupt';state.projects=[];state.finance.weeklyFirstTeamBudget=0;
 return operation(state,{type:'financial-status',code:'club-bankrupt',message:'The club has declared bankruptcy and ceased football operations.'},true,{projection:{...projection,bankrupt:true,status:'bankrupt'}});
}

export function advanceWeek(input,options={}){
 let state=normalizeFootballState(input);
 if(state.status==='bankrupt')return failure(state,'club-bankrupt','A bankrupt club cannot advance another football week.');
 if(state.week>FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks)return failure(state,'season-awaiting-settlement',`The ${FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks}-week season is complete. Settle the season before advancing again.`);
 const completedSeason=state.season,completedWeek=state.week,autoSimulate=options.autoSimulate!==false,matchEvents=[],matchSquads=state.b?['first','u23','academy','b']:['first','u23','academy'];
 const dueFriendlies=state.careerWorld.competitions.friendlies.filter(fixture=>fixture.status==='scheduled'&&fixture.season===state.season&&fixture.week===state.week),cupDue=state.careerWorld.competitions.cup.status==='active'&&state.careerWorld.competitions.cup.season===state.season&&state.careerWorld.competitions.cup.nextRoundWeek===state.week;
 if(!autoSimulate&&(dueFriendlies.length||cupDue))return failure(state,'match-pending',dueFriendlies.length?'Play or cancel the scheduled friendly before advancing the week.':'Play the scheduled cup tie before advancing the week.');
 if(autoSimulate){
  for(const friendly of dueFriendlies){const played=simulateFriendlyMatch(state,friendly.id);if(!played.ok)return played;state=played.state;matchEvents.push({squad:'first',competitionType:'friendly',code:played.code,result:played.result,summary:played.summary,finance:played.finance,event:played.event})}
  if(cupDue){const played=simulateCupMatch(state);if(!played.ok)return played;state=played.state;matchEvents.push({squad:'first',competitionType:'cup',code:played.code,result:played.result,summary:played.summary,finance:played.finance,event:played.event})}
 }
 for(const squad of matchSquads){
  const competition=competitionFor(state,squad);
  const matchPending=squad==='academy'?ACADEMY_AGE_GROUPS.some(ageGroup=>{const item=state.competitions.academyByAge[ageGroup];return state.week>=academyWeekForRound(item.round)&&item.round<academyRoundCount()&&item.playedRound!==item.round}):state.week>=leagueWeekForRound(competition.round)&&competition.round<roundCount(competition.teams)&&competition.playedRound!==competition.round;
  if(matchPending){
   if(!autoSimulate)return failure(state,'match-pending',`Simulate the ${squad==='b'?'B-team':squad==='u23'?'U23':squad==='academy'?'academy':'first-team'} match before advancing the week.`);
   const result=resolveRoundInPlace(state,squad);if(!result.ok)return failure(state,result.code,result.message);matchEvents.push({squad,competitionType:'league',...result});
  }
 }
 for(const squad of matchSquads){
  if(squad==='academy')for(const ageGroup of ACADEMY_AGE_GROUPS){const competition=state.competitions.academyByAge[ageGroup];if(competition.playedRound===competition.round)competition.round+=1}
  else{const competition=competitionFor(state,squad);if(competition.playedRound===competition.round)competition.round+=1}
 }
 const finance=applyWeeklyFinanceInPlace(state);
 recoverSquadInPlace(state,'first');recoverSquadInPlace(state,'u23');if(state.b)recoverSquadInPlace(state,'b');updateAcademyMarketInPlace(state);
 const newInjuryIds=new Set(matchEvents.flatMap(event=>event.summary?.injuries||[]).map(injury=>injury.playerId));tickPlayerInjuriesInPlace(state,newInjuryIds);const trainingInjuries=applyTrainingInjuriesInPlace(state);
 for(const injury of trainingInjuries.filter(item=>item.squad==='first'))state.careerWorld=careerReportPlayerInjury(state.careerWorld,injury.playerId,{type:'Training strain',bodyArea:'Lower leg',severity:injury.injuryWeeks<=2?'minor':'moderate',weeksTotal:injury.injuryWeeks,recurrenceRisk:8});
 state.week=Math.min(FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+1,state.week+1);state.clockMs+=FOOTBALL_WEEK_MS;
 const youthMinutes=state.careerWorld.players.filter(player=>player.age<=21).reduce((sum,player)=>sum+(player.seasonStats?.minutes||0),0),careerMetrics={leaguePosition:positionFor(state,state.competitions.first,PLAYER_FIRST_TEAM_ID),cashBalance:state.finance.cash,youthMinutes,academyScore:state.academy.score,supporterTrust:state.careerWorld.board.supporterTrust};
 if(completedWeek<FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks)state.careerWorld=tickCareerWorld(state.careerWorld,{season:completedSeason,week:completedWeek+1,metrics:careerMetrics});
 else state.careerWorld=normalizeCareerWorld(state.careerWorld,{seed:state.seed,season:completedSeason,week:FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,clubId:'player-club',players:careerPlayersForSync(state.squads.first,completedSeason,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,state.careerWorld.players)});
 state.careerWorld=careerGenerateTransferOffers(state.careerWorld,{maximum:3});syncRootPlayersFromCareerInPlace(state);
 refreshRecruitmentInPlace(state);
 const completed=Number.isFinite(Number(options.nowMs))?reconcileProjectsInPlace(state,Number(options.nowMs)):[],bankruptcy=checkBankruptcyInPlace(state);
 const message=bankruptcy.bankrupt?'The week ended with the club entering bankruptcy.':`Week ${state.week-1} completed with ${finance.net>=0?'positive':'negative'} cash flow of $${Math.abs(finance.net).toLocaleString()}.`;
 return operation(state,{type:'week-advanced',code:bankruptcy.code,message},true,{matchEvents:clone(matchEvents),trainingInjuries:clone(trainingInjuries),finance,completedProjects:clone(completed),bankruptcy});
}

function assessmentProjection(state){
 const site=getStartSite(state.club.siteId),required=academyTrainingRequirement(state),sessions=state.academy.training.days.length,intensity=findIntensity(state.academy.training.intensity),style=getPlayingStyle(state.academy.styleId);
 const feeBand=ACADEMY_FEE_BANDS[state.academy.leagueId],valueScore=clamp(8+(feeBand.recommendedAud-state.academy.feeAud)/feeBand.recommendedAud*10,0,16),trainingScore=clamp(3+(sessions-required)*2+intensity.development*3,0,10);
 const division=getSeniorDivision(state.first.divisionId),relativeFee=(feeBand.recommendedAud-state.academy.feeAud)/Math.max(1,feeBand.recommendedAud);
 const services={
  coaching:clamp(18+(state.staff['academy-director']||0)*15+(state.staff['head-coach']||0)*5+trainingScore*1.7+style.academyDevelopment*2+state.academy.familiarity*.1,0,100),
  safeguarding:clamp(state.club.governance*.55+(state.staff['medical-team']||0)*8+state.academy.satisfaction*.2+(state.academy.femaleProgramme?5:0),0,100),
  facilities:clamp((state.facilities.fields||0)*7+(state.facilities.academy||0)*15+facilityEffect(state,'pitch','quality')*.6+facilityEffect(state,'medical','recovery')*.4+facilityEffect(state,'drainage','reliability')*.35+facilityEffect(state,'floodlights','trainingAccess')*.35,0,100),
  equipment:clamp(facilityEffect(state,'training','development')*1.7+facilityEffect(state,'analysis','match')*1.4+facilityEffect(state,'medical','recovery')*.8+facilityEffect(state,'gym','development')*.9,0,100),
  pathway:clamp((8-division.tier)*8+state.club.reputation*.2+state.metrics.academyGraduates*1.5+(state.b?12:0)+(state.club.aLeagueMember?15:0),0,100),
  affordability:clamp(72+relativeFee*65+(65-site.wealth)*.12,0,100),
  retention:clamp(state.academy.satisfaction*.62+state.academy.talent*.22+(state.staff.recruitment||0)*3+Math.min(12,state.academy.enrolment/30),0,100),
  femaleCompliance:clamp((state.academy.femaleProgramme?45:10)+state.club.governance*.25+(state.facilities.academy||0)*8+(state.staff['academy-director']||0)*3,0,100)
 };
 const score=clamp(ACADEMY_SERVICE_IDS.reduce((sum,id)=>sum+services[id],0)/ACADEMY_SERVICE_IDS.length,0,100),placement=academyPlacementForScore(score);
 return {...placement,services,requiredSessions:required,trainingSessions:sessions,valueScore,trainingScore};
}

export function previewAcademyAssessment(input){return assessmentProjection(normalizeFootballState(input))}

function assessAcademyInPlace(state,force=false){
 if(!force&&state.week<35)return {ok:false,code:'assessment-window-closed',message:'The annual FQ-style academy assessment opens from week 35.'};
 if(state.academy.lastAssessmentSeason===state.season)return {ok:false,code:'assessment-already-complete',message:'This season’s academy assessment is already complete.'};
 const previousLeague=state.academy.leagueId,previousShield=state.academy.shield,projection=assessmentProjection(state);
 state.academy.score=Math.round(projection.score*10)/10;state.academy.services=Object.fromEntries(Object.entries(projection.services).map(([id,value])=>[id,Math.round(value*10)/10]));state.academy.tier=projection.tier;state.academy.shield=projection.shield;state.academy.leagueId=projection.leagueId;state.academy.lastAssessmentSeason=state.season;
 state.academy.seasonsInLeague=projection.leagueId===previousLeague?state.academy.seasonsInLeague+1:0;
 if(state.academy.secondaryLeagueId){
  const secondaryIndex=academyIndex(state.academy.secondaryLeagueId),canAdvance=projection.shield==='gold';
  if(canAdvance&&secondaryIndex<academyIndex('fqa-2')){state.academy.secondaryLeagueId=ACADEMY_LEAGUES[secondaryIndex+1];state.academy.secondarySeasons=0}
  else state.academy.secondarySeasons+=1;
 }
 const graduates=Math.max(0,Math.round((state.academy.talent-50)/12+(state.staff.recruitment||0)));
 state.metrics.academyGraduates+=graduates;
 return {ok:true,code:'academy-assessed',message:`Academy assessment: ${state.academy.score.toFixed(1)}, ${state.academy.shield.replace('-', ' ')}, ${ACADEMY_FEE_BANDS[state.academy.leagueId].league}.`,projection,previousLeague,previousShield,graduates};
}

export function assessAcademy(input,options={}){
 const state=normalizeFootballState(input),assessment=assessAcademyInPlace(state,Boolean(options.force));
 if(!assessment.ok)return failure(state,assessment.code,assessment.message);
 return operation(state,{type:'academy-assessment',code:assessment.code,message:assessment.message},true,{assessment:clone(assessment)});
}

export function getAcademyTable(input){
 const state=normalizeFootballState(input),rows=[...ACADEMY_RANKINGS_2026.map(item=>({...item,isPlayer:false,officialRank:item.rank})),{
  rank:null,officialRank:null,clubId:'player-club',name:state.club.name,rankScore:state.academy.score,rating:state.academy.shield,season:state.season,sourceVersion:'simulation',provisional:false,badgeKey:null,licensedLogoAsset:null,isPlayer:true
 }].sort((a,b)=>(b.rankScore??-1)-(a.rankScore??-1)||a.name.localeCompare(b.name));
 return rows.map((row,index)=>({...row,displayPosition:index+1}));
}

export function purchaseDualRating(input){
 const state=normalizeFootballState(input),fee=FOOTBALL_GAME_ASSUMPTIONS.dualRatingFeeAud;
 if(state.academy.secondaryLeagueId)return failure(state,'dual-rating-owned','The club already operates a second academy stream.');
 if(state.academy.leagueId!=='fqa-1')return failure(state,'dual-rating-fqa1-required','Reach FQ Academy League 1 before applying for the game’s dual-stream licence.');
 if(state.finance.cash<fee)return failure(state,'cash-insufficient',`The fictional dual-stream application costs $${fee.toLocaleString()}.`);
 state.finance.cash-=fee;state.finance.seasonExpenses+=fee;state.academy.secondaryLeagueId='fqa-4';state.academy.secondarySeasons=0;
 pushLedgerInPlace(state,'academy-licence','Dual-rating second-stream licence',-fee);
 return operation(state,{type:'dual-rating-purchased',code:'dual-rating-purchased',message:'A second academy stream has entered FQ Academy League 4 in the simulation.'},true,{feeAud:fee,officialRule:false});
}

export function requestBTeam(input){
 const state=normalizeFootballState(input),fee=FOOTBALL_GAME_ASSUMPTIONS.bTeamApplicationFeeAud;
 if(state.b)return failure(state,'b-team-owned','The club already operates a B team.');
 if(!state.club.aLeagueMember||state.first.divisionId!=='a-league')return failure(state,'b-team-a-league-required','A senior B-team licence becomes available only after A-League admission.');
 if(state.finance.cash<fee)return failure(state,'cash-insufficient',`The B-team licence requires $${fee.toLocaleString()}.`);
 state.finance.cash-=fee;state.finance.seasonExpenses+=fee;
 pushLedgerInPlace(state,'b-team-licence','B-team application licence',-fee);
 const inheritedDivision=getSeniorDivision(state.club.queenslandPathwayDivisionId)?.id||'npl-qld',base=divisionBaseStrength(inheritedDivision);
 state.b={unlocked:true,divisionId:inheritedDivision,styleId:'youth-first',morale:52,fatigue:8,familiarity:50,training:defaultSchedule('b'),origin:'queensland-pathway',hasU23:true,u23SquadKey:'bU23',annualLicenceAud:FOOTBALL_GAME_ASSUMPTIONS.bTeamAnnualLicenceAud};
 state.squads.b=createSquad(`${state.seed}|b-team`,'first',clamp(base-3,40,82));state.squads.bU23=createSquad(`${state.seed}|b-u23`,'u23',clamp(base-10,35,74));state.competitions.b=makeCompetition(inheritedDivision,'b',state.leagueMemberships);
 return operation(state,{type:'b-team-created',code:'b-team-created',message:`${state.club.name} B has inherited the former ${getSeniorDivision(inheritedDivision).name} pathway position.`},true,{feeAud:fee,annualLicenceAud:state.b.annualLicenceAud,hasU23:true,inheritedDivisionId:inheritedDivision,promotionCap:'npl-qld'});
}

function positionFor(state,competition,playerId){return sortedTable(state,competition).find(row=>row.teamId===playerId)?.position||competition.teams.length}

function seasonMovement(state,competition,squad,newFirstDivisionId=null){
 const playerId=squad==='b'?PLAYER_B_TEAM_ID:PLAYER_FIRST_TEAM_ID,division=getSeniorDivision(competition.divisionId),position=positionFor(state,competition,playerId),teams=competition.teams.length;
 let nextDivisionId=division.id,reason='retained',playoff=null;
 if(division.id==='fqpl-3'&&position===division.playoffPlace){
  const probability=clamp(.42+(playerStrength(state,squad)-divisionBaseStrength('fqpl-2'))*.025,.2,.8),roll=seededRandom(`${state.seed}|${state.season}|fqpl3-playoff|${squad}`)();
  playoff={played:true,probability,roll,won:roll<probability};if(playoff.won){nextDivisionId=division.promoteTo;reason='playoff-promotion'}
 }else if(division.promoteTo&&position<=division.promotionPlaces){nextDivisionId=division.promoteTo;reason='promoted'}
 else if(division.relegateTo&&position>teams-division.relegationPlaces){nextDivisionId=division.relegateTo;reason='relegated'}
 if(squad==='b'&&newFirstDivisionId){
  const targetTier=getSeniorDivision(nextDivisionId).tier,firstTier=getSeniorDivision(newFirstDivisionId).tier;
  if(targetTier<=firstTier){nextDivisionId=division.id;reason='reserve-ceiling'}
 }
 return {squad,from:division.id,to:nextDivisionId,position,reason,playoff};
}

function seniorRowsForMembershipMovement(state,divisionId){
 if(state.first.divisionId===divisionId&&divisionId!=='a-league')return sortedTable(state,state.competitions.first,'first');
 if(state.b?.divisionId===divisionId&&state.competitions.b)return sortedTable(state,state.competitions.b,'b');
 const random=seededRandom(`${state.seed}|${state.season}|ai-table|${divisionId}`);
 return state.leagueMemberships[divisionId].map(teamId=>({teamId,score:(REFERENCE_TEAMS.get(teamId)?.gameStrength||divisionBaseStrength(divisionId))+random()*8})).sort((a,b)=>b.score-a.score||a.teamId.localeCompare(b.teamId)).map((row,index)=>({...row,position:index+1}));
}

function advanceLeagueMembershipsInPlace(state){
 const playerIds=new Set([PLAYER_FIRST_TEAM_ID,PLAYER_B_TEAM_ID]),promotions={},relegations={};
 for(const divisionId of QLD_DIVISION_IDS){
  const division=getSeniorDivision(divisionId),rows=seniorRowsForMembershipMovement(state,divisionId);
  promotions[divisionId]=division.promoteTo?rows.slice(0,division.promotionPlaces).map(row=>row.teamId).filter(id=>!playerIds.has(id)):[];
  if(divisionId==='fqpl-3'){
   const runner=rows[1],roll=seededRandom(`${state.seed}|${state.season}|fqpl3-ai-playoff`)();
   if(runner&&!playerIds.has(runner.teamId)&&roll<.5)promotions[divisionId].push(runner.teamId);
  }
  relegations[divisionId]=division.relegateTo?rows.slice(-division.relegationPlaces).map(row=>row.teamId).filter(id=>!playerIds.has(id)):[];
 }
 const next=Object.fromEntries(QLD_DIVISION_IDS.map(id=>[id,[...state.leagueMemberships[id]]]));
 for(const divisionId of QLD_DIVISION_IDS){
  const division=getSeniorDivision(divisionId),outgoing=new Set([...promotions[divisionId],...relegations[divisionId]]);
  next[divisionId]=next[divisionId].filter(id=>!outgoing.has(id));
  if(division.promoteTo)next[division.promoteTo].push(...promotions[divisionId]);
  if(division.relegateTo)next[division.relegateTo].push(...relegations[divisionId]);
 }
 state.leagueMemberships=normalizeLeagueMemberships(Object.fromEntries(QLD_DIVISION_IDS.map(id=>[id,unique(next[id])])));
 return {promotions:clone(promotions),relegations:clone(relegations)};
}

function resolveKnockoutInPlace(state,home,away,stage,index){
 if(home===PLAYER_FIRST_TEAM_ID||away===PLAYER_FIRST_TEAM_ID)repairSquadSelection(state.squads.first);
 const fixture={id:`${state.season}:a-league-finals:${stage}:${home}:${away}`,round:index,home,away},result=resolveFixture(state,fixture,'first');
 let winnerId,decidedBy='90-minutes';
 if(result.homeGoals!==result.awayGoals)winnerId=result.homeGoals>result.awayGoals?home:away;
 else{
  const homeStrength=teamStrength(state,home,'first'),awayStrength=teamStrength(state,away,'first'),random=seededRandom(`${state.seed}|${fixture.id}|shootout`);
  const homeChance=clamp(.52+(homeStrength-awayStrength)/220,.28,.75);winnerId=random()<homeChance?home:away;decidedBy='penalties';
  result.incidents.push({type:'commentary',minute:120,teamId:winnerId,playerId:null,playerName:'',text:`${teamName(state,winnerId)} win the penalty shootout.`});
  result.incidents.sort((a,b)=>a.minute-b.minute);result.commentary=result.incidents.map(incident=>incident.text);
 }
 result.stage=stage;result.winnerId=winnerId;result.decidedBy=decidedBy;
 if(home===PLAYER_FIRST_TEAM_ID||away===PLAYER_FIRST_TEAM_ID)applyPlayerMatchEffects(state,result,'first');
 state.counters.match+=1;
 return result;
}

function simulateALeagueFinalsInPlace(state,competition){
 if(competition.divisionId!=='a-league')return null;
 const qualified=sortedTable(state,competition).slice(0,6),seedById=new Map(qualified.map(row=>[row.teamId,row.position]));
 if(qualified.length<6)return null;
 const matches=[];
 const eliminationOne=resolveKnockoutInPlace(state,qualified[2].teamId,qualified[5].teamId,'elimination-final-1',0);
 const eliminationTwo=resolveKnockoutInPlace(state,qualified[3].teamId,qualified[4].teamId,'elimination-final-2',1);
 matches.push(eliminationOne,eliminationTwo);
 const eliminationWinners=[eliminationOne.winnerId,eliminationTwo.winnerId].sort((a,b)=>(seedById.get(b)||99)-(seedById.get(a)||99));
 const semiOne=resolveKnockoutInPlace(state,qualified[0].teamId,eliminationWinners[0],'semi-final-1',2);
 const semiTwo=resolveKnockoutInPlace(state,qualified[1].teamId,eliminationWinners[1],'semi-final-2',3);
 matches.push(semiOne,semiTwo);
 const finalists=[semiOne.winnerId,semiTwo.winnerId].sort((a,b)=>(seedById.get(a)||99)-(seedById.get(b)||99));
 const grandFinal=resolveKnockoutInPlace(state,finalists[0],finalists[1],'grand-final',4);matches.push(grandFinal);
 return {
  qualified:qualified.map(row=>({teamId:row.teamId,name:row.name,seed:row.position})),matches,championId:grandFinal.winnerId,championName:teamName(state,grandFinal.winnerId),
  playerQualified:qualified.some(row=>row.teamId===PLAYER_FIRST_TEAM_ID),playerChampion:grandFinal.winnerId===PLAYER_FIRST_TEAM_ID
 };
}

function settleRosterInPlace(state,key){
 const selection=state.squads[key];if(!selection)return;
 const kind=key==='bU23'?'u23':key==='b'?'first':key,minimum=kind==='first'?14:16,target=kind==='first'?18:16,careerById=new Map(state.careerWorld.players.map(player=>[player.id,player])),seasonStart=(state.season-2020)*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+1;
 let players=selection.players.map(player=>{let contractSeasons=kind==='academy'?0:Math.max(0,player.contractSeasons-1);if(kind==='first'&&contractSeasons===0){const career=careerById.get(player.id),expires=career?(career.contract.expiresSeason-2020)*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+career.contract.expiresWeek:0;if(expires>=seasonStart)contractSeasons=1}return {...player,age:player.age+1,contractSeasons,injuryWeeks:Math.max(0,player.injuryWeeks-4)}});
 if(kind==='first'){
  players=players.filter(player=>player.contractSeasons>0&&player.age<=36&&!['released','transferred'].includes(player.careerStatus));
 }
 else if(kind==='u23')players=players.filter(player=>player.contractSeasons>0&&player.age<=22);
 else players=players.filter(player=>player.age<=18);
 let continuingCount=kind==='first'?players.filter(player=>{const career=careerById.get(player.id);if(!career)return true;const expires=(career.contract.expiresSeason-2020)*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+career.contract.expiresWeek;return expires>seasonStart}).length:players.length;
 if(continuingCount<minimum){
  const seniorDivisionId=key==='b'||key==='bU23'?state.b?.divisionId:state.first.divisionId,ratingBase=kind==='first'?clamp(divisionBaseStrength(seniorDivisionId)-1,40,84):kind==='u23'?clamp(divisionBaseStrength(seniorDivisionId)-8,36,75):clamp(state.academy.talent,35,78);
  for(const candidate of generatePlayers(`${state.seed}|intake|${state.season}|${key}`,kind,ratingBase))if(continuingCount<target&&players.length<30&&!players.some(player=>player.id===candidate.id)){players.push(candidate);continuingCount+=1}
 }
 if(kind==='first')players.sort((a,b)=>{const expiring=player=>{const career=careerById.get(player.id);return career&&((career.contract.expiresSeason-2020)*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+career.contract.expiresWeek)<=seasonStart?1:0};return expiring(a)-expiring(b)});
 selection.players=players.slice(0,30);const picked=autoLineup(selection.players,selection.formation);selection.lineup=picked.lineup;selection.bench=picked.bench;
}

export function settleSeason(input,options={}){
 const state=normalizeFootballState(input),first=state.competitions.first,total=roundCount(first.teams),force=Boolean(options.force);
 if(!force&&state.week<=FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks)return failure(state,'season-calendar-incomplete',`${FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks-state.week+1} of the ${FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks} operating weeks remain.`);
 if(!force&&first.round<total)return failure(state,'season-incomplete',`${total-first.round} first-team rounds remain.`);
 if(!force&&state.competitions.u23.round<roundCount(state.competitions.u23.teams))return failure(state,'u23-season-incomplete','The linked U23 competition still has fixtures remaining.');
 if(!force&&ACADEMY_AGE_GROUPS.some(ageGroup=>{const competition=state.competitions.academyByAge[ageGroup];return competition.round<academyRoundCount()}))return failure(state,'academy-season-incomplete','At least one academy age-group competition still has fixtures remaining.');
 if(state.b&&!force&&state.competitions.b.round<roundCount(state.competitions.b.teams))return failure(state,'b-season-incomplete','The B-team league season is not complete.');
 const aLeagueFinals=simulateALeagueFinalsInPlace(state,first),firstMove=seasonMovement(state,first,'first'),bMove=state.b?seasonMovement(state,state.competitions.b,'b',firstMove.to):null,membershipMoves=advanceLeagueMembershipsInPlace(state);
 if(firstMove.reason==='promoted'||firstMove.reason==='playoff-promotion'){state.metrics.promotions+=1;state.footballTokens+=FOOTBALL_TOKEN_REWARDS.promotion;state.club.reputation=clamp(state.club.reputation+6,0,100);state.club.governance=clamp(state.club.governance+3,0,100)}
 if(firstMove.reason==='relegated'){state.metrics.relegations+=1;state.club.reputation=clamp(state.club.reputation-4,0,100)}
 if(firstMove.position===1){state.metrics.trophies+=1;state.footballTokens+=FOOTBALL_TOKEN_REWARDS.premiership;state.club.reputation=clamp(state.club.reputation+5,0,100)}
 if(aLeagueFinals?.playerChampion){state.metrics.trophies+=1;state.footballTokens+=FOOTBALL_TOKEN_REWARDS.premiership;state.club.reputation=clamp(state.club.reputation+6,0,100)}
 if(first.divisionId==='npl-qld'){
  state.metrics.nplSeasons+=1;
  if(firstMove.position===1){state.metrics.nplTitles+=1;state.club.reputation=clamp(state.club.reputation+8,0,100)}
 }
 let academyAssessment=null;
 if(state.academy.lastAssessmentSeason!==state.season)academyAssessment=assessAcademyInPlace(state,true);
 const careerSeasonRow=sortedTable(state,first,'first').find(row=>row.teamId===PLAYER_FIRST_TEAM_ID)||{position:firstMove.position,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0};
 const cup=state.careerWorld.competitions.cup,cupResult=cup.status==='won'?'Winners':cup.status==='eliminated'?`Eliminated — ${cup.roundName}`:cup.status==='active'?`Reached ${cup.roundName}`:'Not entered';
 state.careerWorld=archiveCareerSeason(state.careerWorld,{season:state.season,divisionId:first.divisionId,leaguePosition:careerSeasonRow.position,played:careerSeasonRow.played,wins:careerSeasonRow.won,draws:careerSeasonRow.drawn,losses:careerSeasonRow.lost,goalsFor:careerSeasonRow.gf,goalsAgainst:careerSeasonRow.ga,points:careerSeasonRow.points,cupResult,academyRating:state.academy.shield,cashBalance:state.finance.cash,clubName:state.club.name,competition:getCompetitionDisplayName(first.divisionId,state.season),summary:`${state.club.name} finished ${careerSeasonRow.position} in ${getCompetitionDisplayName(first.divisionId,state.season)}.`});
 if(firstMove.position===1)state.careerWorld=careerAddClubTrophy(state.careerWorld,{id:`premiership-${state.season}-${first.divisionId}`,season:state.season,name:`${getCompetitionDisplayName(first.divisionId,state.season)} Premiership`,competition:getCompetitionDisplayName(first.divisionId,state.season),level:'Senior'});
 if(aLeagueFinals?.playerChampion)state.careerWorld=careerAddClubTrophy(state.careerWorld,{id:`championship-${state.season}-a-league`,season:state.season,name:'A-League Championship',competition:'A-League Men',level:'Senior'});
 state.metrics.seasons+=1;state.season+=1;state.week=1;state.clockMs=Math.max(state.clockMs,defaultClock(state.season));
 if(state.status==='active'&&state.finance.missedPayrollWeeks===0)state.club.governance=clamp(state.club.governance+4,0,100);
 state.first.divisionId=firstMove.to;state.first.fatigue=12;state.first.morale=52;state.first.familiarity=clamp(state.first.familiarity-4,0,100);state.competitions.first=makeCompetition(firstMove.to,'first',state.leagueMemberships);
 state.u23.divisionId=firstMove.to;state.u23.fatigue=10;state.u23.morale=52;state.u23.familiarity=clamp(state.u23.familiarity-3,0,100);state.competitions.u23=makeCompetition(firstMove.to,'u23',state.leagueMemberships);
 state.academy.fatigue=10;state.academy.morale=52;state.academy.familiarity=clamp(state.academy.familiarity-2,0,100);state.competitions.academyByAge=makeAcademyCompetitions(state.academy.leagueId);state.competitions.academy=state.competitions.academyByAge.u18;
 if(state.b){state.b.divisionId=bMove.to;state.b.fatigue=12;state.b.morale=51;state.competitions.b=makeCompetition(bMove.to,'b',state.leagueMemberships)}
 settleRosterInPlace(state,'first');settleRosterInPlace(state,'u23');settleRosterInPlace(state,'academy');if(state.b){settleRosterInPlace(state,'b');settleRosterInPlace(state,'bU23')}refreshRecruitmentInPlace(state);
 state.careerWorld=tickCareerWorld(state.careerWorld,{season:state.season,week:1});
 state.careerWorld=normalizeCareerWorld(state.careerWorld,{seed:state.seed,season:state.season,week:1,clubId:'player-club',players:careerPlayersForSync(state.squads.first,state.season,1,state.careerWorld.players)});
 initialiseCareerCompetitionsInPlace(state,{registerAll:true});
 const divisionByTeamId=new Map(Object.entries(state.leagueMemberships).flatMap(([divisionId,teamIds])=>teamIds.map(teamId=>[teamId,divisionId])));state.careerWorld=normalizeCareerWorld({...state.careerWorld,aiClubs:state.careerWorld.aiClubs.map(club=>divisionByTeamId.has(club.id)?{...club,divisionId:divisionByTeamId.get(club.id)}:club)});
 const nextCareerExisting=new Set(state.careerWorld.aiClubs.map(club=>club.id));state.careerWorld=syncAIClubs(state.careerWorld,aiClubInputs(state.first.divisionId,state.leagueMemberships).map(club=>nextCareerExisting.has(club.id)?{id:club.id,name:club.name,divisionId:club.divisionId}:club));syncRootPlayersFromCareerInPlace(state);
 state.finance.seasonIncome=0;state.finance.seasonExpenses=0;state.finance.lastWeekly=null;
 const completed=Number.isFinite(Number(options.nowMs))?reconcileProjectsInPlace(state,Number(options.nowMs)):[];
 return operation(state,{type:'season-settled',code:'season-settled',message:`Season settled: the first team ${firstMove.reason.replace('-', ' ')} in ${getSeniorDivision(firstMove.to).name}.`},true,{firstMovement:firstMove,bMovement:bMove,membershipMoves:clone(membershipMoves),aLeagueFinals:clone(aLeagueFinals),academyAssessment:clone(academyAssessment),completedProjects:clone(completed)});
}

export function getALeagueBidStatus(input){
 const state=normalizeFootballState(input),fee=FOOTBALL_GAME_ASSUMPTIONS.aLeagueBidFeeAud,reserve=FOOTBALL_GAME_ASSUMPTIONS.aLeagueCashReserveAud,capacity=getStadiumCapacity(state),averageAttendance=getAverageAttendance(state),assets=clubAssetValueInState(state),debtToAssets=assets>0?state.finance.debt/assets:1;
 const checks={
  inNpl:state.first.divisionId==='npl-qld',twoNplSeasons:state.metrics.nplSeasons>=2,nplPremiership:state.metrics.nplTitles>=1,goldAcademy:state.academy.shield==='gold',
  stadiumCapacity:capacity>=10_000,averageAttendance:averageAttendance>=5_000,governance:state.club.governance>=85,debtToAssets:debtToAssets<.5,
  cashReserve:state.finance.cash-fee>=reserve,solvent:state.status==='active',notBidThisSeason:state.metrics.lastALeagueBidSeason!==state.season
 };
 const score=Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100);
 return {eligible:Object.values(checks).every(Boolean),checks,score,feeAud:fee,cashReserveAud:reserve,stadiumCapacity:capacity,averageAttendance,governance:state.club.governance,debtToAssets,assetValueAud:assets,fictionalLicensingPath:true};
}

export function submitALeagueBid(input){
 const state=normalizeFootballState(input),status=getALeagueBidStatus(state);
 if(!status.eligible)return failure(state,'a-league-bid-ineligible','The club does not yet meet every fictional A-League expansion-bid requirement.',{bidStatus:status});
 state.finance.cash-=status.feeAud;state.finance.seasonExpenses+=status.feeAud;state.metrics.lastALeagueBidSeason=state.season;
 pushLedgerInPlace(state,'a-league-bid','Non-refundable A-League expansion bid',-status.feeAud);
 const approved=true;
 state.club.queenslandPathwayDivisionId=state.first.divisionId;state.club.aLeagueMember=true;state.club.reputation=clamp(state.club.reputation+10,0,100);state.club.governance=clamp(state.club.governance+3,0,100);state.first.divisionId='a-league';state.u23.divisionId='a-league';state.competitions.first=makeCompetition('a-league','first',state.leagueMemberships);state.competitions.u23=makeCompetition('a-league','u23',state.leagueMemberships);
 return operation(state,{type:'a-league-bid',code:'a-league-bid-approved',message:'The fictional A-League expansion bid was approved.'},true,{approved,bidStatus:status,nonRefundableFeeAud:status.feeAud});
}

export function getCareerWorld(input){return clone(normalizeFootballState(input).careerWorld)}
export function getDecisionHub(input){return clone(careerGetDecisionHub(normalizeFootballState(input).careerWorld))}
export function getScoutingView(input){return clone(careerGetScoutingView(normalizeFootballState(input).careerWorld))}
export function getPeopleView(input){
 const state=normalizeFootballState(input),career=state.careerWorld,dynamics=career.squadDynamics||{},staff=operationsGetPeopleView(state.footballOperations),activePlayers=career.players.filter(player=>!['released','transferred','retired'].includes(player.status)&&player.ownership!=='former'),hierarchyById=new Map((dynamics.hierarchy||[]).map(item=>[item.playerId,item]));
 return {
  players:clone(activePlayers.map(player=>({...player,hierarchy:hierarchyById.get(player.id)||null}))),
  dynamics:clone(dynamics),negotiations:clone(career.contractNegotiations||[]),
  medicalCases:clone(activePlayers.filter(player=>player.medical?.injury||player.discipline?.suspensionMatchesRemaining)),
  expiringContracts:clone(activePlayers.filter(player=>{const end=(player.contract?.expiresSeason-2020)*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+(player.contract?.expiresWeek||1),now=(state.season-2020)*FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks+Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks);return end-now<=12})),staff
 };
}
export function getCommercialView(input){const state=normalizeFootballState(input);return clone(operationsGetCommercialView(state.footballOperations))}

export function setCaptaincy(input,captainId,viceCaptainId=''){
 const state=normalizeFootballState(input),captain=String(captainId||''),vice=String(viceCaptainId||''),validIds=new Set(state.careerWorld.players.filter(player=>!['released','transferred','retired'].includes(player.status)&&player.ownership!=='former').map(player=>player.id));
 if(!validIds.has(captain)||captain===vice||(vice&&!validIds.has(vice)))return failure(state,'captaincy-invalid','Choose eligible, distinct captain and vice-captain options.');
 const next=careerSetCaptaincy(state.careerWorld,captain,vice);state.careerWorld=next;syncRootPlayersFromCareerInPlace(state);
 return operation(state,{type:'squad-dynamics',code:'captaincy-set',message:'The first-team leadership group was updated.'},true,{dynamics:clone(next.squadDynamics)});
}

export function createMentoringGroup(input,details={}){
 const state=normalizeFootballState(input),before=state.careerWorld.squadDynamics?.mentoringGroups?.length||0,next=careerCreateMentoringGroup(state.careerWorld,details);
 if((next.squadDynamics?.mentoringGroups?.length||0)<=before)return failure(state,'mentoring-group-invalid','Choose one eligible mentor and at least one different mentee.');state.careerWorld=next;
 return operation(state,{type:'squad-dynamics',code:'mentoring-group-created',message:'The mentoring group was created.'},true,{dynamics:clone(next.squadDynamics)});
}

export function removeMentoringGroup(input,groupId){
 const state=normalizeFootballState(input),before=state.careerWorld.squadDynamics?.mentoringGroups?.length||0,next=careerRemoveMentoringGroup(state.careerWorld,groupId);
 if((next.squadDynamics?.mentoringGroups?.length||0)>=before)return failure(state,'mentoring-group-unknown','That mentoring group is no longer active.');state.careerWorld=next;
 return operation(state,{type:'squad-dynamics',code:'mentoring-group-removed',message:'The mentoring group was closed.'},true,{dynamics:clone(next.squadDynamics)});
}

export function createPlayerPromise(input,playerId,details={}){
 const state=normalizeFootballState(input),before=state.careerWorld.squadDynamics?.promises?.length||0,next=careerCreatePlayerPromise(state.careerWorld,playerId,details);
 if((next.squadDynamics?.promises?.length||0)<=before)return failure(state,'player-promise-invalid','That player promise could not be created.');state.careerWorld=next;
 return operation(state,{type:'squad-dynamics',code:'player-promise-created',message:'The commitment was recorded with the player.'},true,{promise:clone(next.squadDynamics.promises.at(-1))});
}

export function resolvePlayerPromise(input,promiseId,outcome='fulfilled',reason=''){
 const state=normalizeFootballState(input),prior=state.careerWorld.squadDynamics?.promises?.find(item=>item.id===String(promiseId)&&item.status==='active');if(!prior)return failure(state,'player-promise-unknown','That active player promise could not be found.');
 state.careerWorld=careerResolvePlayerPromise(state.careerWorld,promiseId,outcome,reason);syncRootPlayersFromCareerInPlace(state);return operation(state,{type:'squad-dynamics',code:'player-promise-resolved',message:`The player promise was marked ${String(outcome).replace('-', ' ')}.`},true,{promiseId});
}

export function reportPlayerInjury(input,playerId,details={}){
 const state=normalizeFootballState(input),prior=state.careerWorld.players.find(player=>player.id===String(playerId));if(!prior)return failure(state,'player-unknown','Choose a contracted first-team player.');state.careerWorld=careerReportPlayerInjury(state.careerWorld,playerId,details);syncRootPlayersFromCareerInPlace(state);
 return operation(state,{type:'medical',code:'player-injury-reported',message:`${prior.name} was added to the medical list.`},true,{player:clone(state.careerWorld.players.find(player=>player.id===prior.id))});
}

export function setPlayerRehabilitation(input,playerId,plan='standard'){
 const state=normalizeFootballState(input),prior=state.careerWorld.players.find(player=>player.id===String(playerId)&&player.medical?.injury);if(!prior)return failure(state,'medical-case-unknown','That player does not have an active rehabilitation case.');state.careerWorld=careerSetPlayerRehabilitation(state.careerWorld,playerId,plan);syncRootPlayersFromCareerInPlace(state);
 return operation(state,{type:'medical',code:'rehabilitation-plan-set',message:`${prior.name}'s rehabilitation plan is now ${String(plan).replace('-', ' ')}.`},true,{player:clone(state.careerWorld.players.find(player=>player.id===prior.id))});
}

export function recordPlayerDiscipline(input,playerId,incident={}){
 const state=normalizeFootballState(input),prior=state.careerWorld.players.find(player=>player.id===String(playerId));if(!prior)return failure(state,'player-unknown','Choose a contracted first-team player.');state.careerWorld=careerRecordPlayerDiscipline(state.careerWorld,playerId,incident);syncRootPlayersFromCareerInPlace(state);
 return operation(state,{type:'discipline',code:'discipline-recorded',message:`${prior.name}'s disciplinary record was updated.`},true,{player:clone(state.careerWorld.players.find(player=>player.id===prior.id))});
}

export function startContractNegotiation(input,playerId,options={}){
 const state=normalizeFootballState(input),before=state.careerWorld.contractNegotiations?.length||0,next=careerStartContractNegotiation(state.careerWorld,playerId,options);
 if((next.contractNegotiations?.length||0)<=before)return failure(state,'contract-negotiation-unavailable','Contract talks are already active or the player is unavailable.');state.careerWorld=next;
 return operation(state,{type:'player-contract',code:'contract-negotiation-started',message:'The player’s representative opened formal contract talks.'},true,{negotiation:clone(next.contractNegotiations.at(-1))});
}

export function submitContractOffer(input,negotiationId,terms={}){
 const state=normalizeFootballState(input),session=state.careerWorld.contractNegotiations?.find(item=>item.id===String(negotiationId)&&['awaiting-club','countered'].includes(item.status)),rootPlayer=session?state.squads.first.players.find(player=>player.id===session.playerId):null;
 if(!session||!rootPlayer)return failure(state,'contract-negotiation-unavailable','That contract negotiation is no longer active.');
 const next=careerSubmitContractOffer(state.careerWorld,negotiationId,terms),resolved=next.contractNegotiations.find(item=>item.id===session.id),careerPlayer=next.players.find(player=>player.id===session.playerId);
 if(!resolved||resolved.round===session.round)return failure(state,'contract-offer-invalid','Enter valid contract terms before submitting the offer.');
 if(resolved.status==='agreed'){
  const projected=squadWeeklyWages(state,'first')-playerWeeklyWageLiability(state,rootPlayer)+money(careerPlayer.contract.weeklyWage,0,0),signingBonus=money(careerPlayer.contract.signingBonus,0,0);
  if(projected>state.finance.weeklyFirstTeamBudget)return failure(state,'senior-wage-budget','The accepted terms would exceed the first-team wage-budget ceiling.',{projectedWagesAud:projected,budgetCeilingAud:state.finance.weeklyFirstTeamBudget});
  if(signingBonus>state.finance.cash)return failure(state,'club-cash-insufficient',`The club needs $${signingBonus.toLocaleString()} for the agreed signing bonus.`,{requiredAud:signingBonus,availableAud:state.finance.cash});
  state.finance.cash-=signingBonus;state.finance.seasonExpenses+=signingBonus;if(signingBonus)pushLedgerInPlace(state,'player-contract',`${careerPlayer.name} signing bonus`,-signingBonus);
 }
 state.careerWorld=next;syncRootPlayersFromCareerInPlace(state);
 const status=resolved.status,code=status==='agreed'?'contract-offer-agreed':status==='countered'?'contract-countered':'contract-offer-rejected';
 return operation(state,{type:'player-contract',code,message:status==='agreed'?`${careerPlayer.name} signed the new contract.`:status==='countered'?`${resolved.agent.name} returned a counteroffer.`:`Contract talks with ${careerPlayer.name} did not reach agreement.`},true,{negotiation:clone(resolved),player:clone(careerPlayer)});
}

export function withdrawContractNegotiation(input,negotiationId){
 const state=normalizeFootballState(input),session=state.careerWorld.contractNegotiations?.find(item=>item.id===String(negotiationId)&&['awaiting-club','countered'].includes(item.status));if(!session)return failure(state,'contract-negotiation-unavailable','That contract negotiation is no longer active.');state.careerWorld=careerWithdrawContractNegotiation(state.careerWorld,negotiationId);syncRootPlayersFromCareerInPlace(state);
 return operation(state,{type:'player-contract',code:'contract-negotiation-withdrawn',message:'The club withdrew from contract talks.'},true,{negotiationId});
}

function applyImmediateOperationsFinanceInPlace(state,result,category,description){
 const delta=money(result?.financeDeltaAud,0);
 if(delta<0&&state.finance.cash<Math.abs(delta))return {ok:false,code:'club-cash-insufficient',message:`The club needs $${Math.abs(delta).toLocaleString()} in available cash for that decision.`};
 state.footballOperations=result.state;
 if(delta){state.finance.cash=money(state.finance.cash+delta,state.finance.cash);if(delta>0)state.finance.seasonIncome=money(state.finance.seasonIncome+delta,0,0);else state.finance.seasonExpenses=money(state.finance.seasonExpenses+Math.abs(delta),0,0);pushLedgerInPlace(state,category,description,delta)}
 return {ok:true,delta};
}

export function hireNamedStaff(input,candidateId,terms={}){
 const state=normalizeFootballState(input),result=operationsHireStaffMember(state.footballOperations,candidateId,terms);
 if(!result.ok)return failure(state,result.code||'staff-hire-failed',result.message||'The staff appointment could not be completed.');
 const applied=applyImmediateOperationsFinanceInPlace(state,result,'staff-recruitment',`Appointment fee for ${result.staff?.name||'staff member'}`);if(!applied.ok)return failure(state,applied.code,applied.message);
 return operation(state,{type:'named-staff',code:'named-staff-hired',message:result.message},true,{staff:clone(result.staff),financeDeltaAud:applied.delta});
}

export function dismissNamedStaff(input,staffId,options={}){
 const state=normalizeFootballState(input),result=operationsDismissStaffMember(state.footballOperations,staffId,options);
 if(!result.ok)return failure(state,result.code||'staff-dismissal-failed',result.message||'That staff member could not be dismissed.');
 const applied=applyImmediateOperationsFinanceInPlace(state,result,'staff-severance',`Staff severance for ${staffId}`);if(!applied.ok)return failure(state,applied.code,applied.message);
 return operation(state,{type:'named-staff',code:'named-staff-dismissed',message:result.message},true,{staffId,financeDeltaAud:applied.delta});
}

export function renewNamedStaff(input,staffId,terms={}){
 const state=normalizeFootballState(input),result=operationsRenewStaffContract(state.footballOperations,staffId,terms);
 if(!result.ok)return failure(state,result.code||'staff-renewal-failed',result.message||'The staff renewal was rejected.');state.footballOperations=result.state;
 return operation(state,{type:'named-staff',code:'named-staff-renewed',message:result.message},true,{staff:clone(result.staff)});
}

export function setDelegation(input,responsibilityId,staffId=''){
 const state=normalizeFootballState(input),result=operationsSetDelegation(state.footballOperations,responsibilityId,staffId);
 if(!result.ok)return failure(state,result.code||'delegation-failed',result.message||'That responsibility could not be delegated.');state.footballOperations=result.state;
 return operation(state,{type:'club-delegation',code:'club-delegation-changed',message:result.message},true,{responsibility:clone(result.responsibility)});
}

export function respondToSponsorOffer(input,offerId,response='reject'){
 const state=normalizeFootballState(input),result=operationsRespondToSponsorOffer(state.footballOperations,offerId,response);
 if(!result.ok)return failure(state,result.code||'sponsor-response-failed',result.message||'That sponsor decision could not be completed.');
 const applied=applyImmediateOperationsFinanceInPlace(state,result,'sponsor-signing',`${result.contract?.sponsorName||'Partner'} signing bonus`);if(!applied.ok)return failure(state,applied.code,applied.message);
 return operation(state,{type:'club-commercial',code:result.code||'sponsor-response-recorded',message:result.message},true,{contract:result.contract?clone(result.contract):null,financeDeltaAud:applied.delta});
}

export function setCommercialPlan(input,patch={}){
 const state=normalizeFootballState(input),result=operationsSetCommercialPlan(state.footballOperations,patch);
 if(!result.ok)return failure(state,result.code||'commercial-plan-failed',result.message||'The commercial plan could not be saved.');
 if(result.weeklyPlanSpendAud>Math.max(0,state.finance.cash))return failure(state,'commercial-plan-unfunded','The club does not have enough cash to fund one week of that commercial plan.',{requiredAud:result.weeklyPlanSpendAud,availableAud:Math.max(0,state.finance.cash)});
 state.footballOperations=result.state;return operation(state,{type:'club-commercial',code:'club-commercial-plan-set',message:result.message},true,{plan:clone(result.plan),weeklyPlanSpendAud:result.weeklyPlanSpendAud});
}
export function getCareerCalendarWeek(input,week){const state=normalizeFootballState(input);return clone(careerGetCalendarWeek(state.season,week??Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks)))}
export function previewMatchdayOperations(input,fixture={}){
 const state=normalizeFootballState(input),source=fixture&&typeof fixture==='object'?fixture:{},current=nextFirstTeamFixtureInState(state),target=(source.id||source.fixtureId||source.home||source.away)?source:current,context=matchdayContextForFixtureInState(state,target,source);
 const forecastWorld=normalizeCareerWorld(state.careerWorld,{seed:state.seed,season:context.forecastSeason||state.season,week:context.forecastWeek||Math.min(state.week,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks),clubId:'player-club'});
 return clone(careerPreviewMatchdayOperations(forecastWorld,context));
}

function competitiveRegistrationIssue(state){
 const hub=careerGetCompetitionHub(state.careerWorld),registered=new Set(hub.registration.registeredPlayerIds),missing=state.squads.first.lineup.filter(playerId=>!registered.has(playerId));
 if(hub.registration.registeredCount<11)return 'Register at least 11 eligible senior players before playing a competitive fixture.';
 if(hub.registration.homegrownCount<hub.registration.homegrownMinimum)return `Register at least ${hub.registration.homegrownMinimum} homegrown player${hub.registration.homegrownMinimum===1?'':'s'} before playing a competitive fixture.`;
 if(missing.length)return `${missing.length} selected player${missing.length===1?' is':'s are'} not registered for competitive fixtures.`;
 return '';
}

function standaloneOpponent(state,key='fixture'){
 const candidates=state.careerWorld.aiClubs.filter(club=>club.id&&club.id!==PLAYER_FIRST_TEAM_ID);
 if(!candidates.length)return {id:'community-select',name:'Queensland Select',strength:divisionBaseStrength(state.first.divisionId)};
 return candidates[hashString(`${state.seed}|${state.season}|${state.week}|${key}`)%candidates.length];
}

function standaloneFixture(state,details={}){
 const opponentId=cleanId(details.opponentId,80)||standaloneOpponent(state,details.id).id,opponentName=cleanText(details.opponentName,80,teamName(state,opponentId,'first')),venue=['home','away','neutral'].includes(details.venue)?details.venue:'home',playerIsHome=venue!=='away';
 return {id:cleanText(details.id,180,`standalone-${state.season}-${state.week}-${opponentId}`),round:integer(details.round,0,20,0),scheduledWeek:state.week,venue,home:playerIsHome?PLAYER_FIRST_TEAM_ID:opponentId,away:playerIsHome?opponentId:PLAYER_FIRST_TEAM_ID,opponentId,opponentName};
}

function applyStandaloneMatchdayFinanceInPlace(state,result,label){
 const report=result.matchday;if(!report)return {incomeAud:0,expensesAud:0,netAud:0};
 const incomeAud=money(report.totalRevenueAud,0,0),expensesAud=money(report.operatingCostAud,0,0),netAud=money(incomeAud-expensesAud,0);
 state.finance.cash=money(state.finance.cash+netAud,state.finance.cash);state.finance.seasonIncome=money(state.finance.seasonIncome+incomeAud,0,0);state.finance.seasonExpenses=money(state.finance.seasonExpenses+expensesAud,0,0);
 if(report.ticketRevenueAud)pushLedgerInPlace(state,'tickets',`${label} ticket income`,report.ticketRevenueAud);
 if(report.hospitalityRevenueAud)pushLedgerInPlace(state,'hospitality',`${label} hospitality income`,report.hospitalityRevenueAud);
 if(report.concessionRevenueAud)pushLedgerInPlace(state,'concessions',`${label} concession income`,report.concessionRevenueAud);
 if(expensesAud)pushLedgerInPlace(state,'matchday-operations',`${label} operations`,-expensesAud);
 return {incomeAud,expensesAud,netAud};
}

export function getCompetitionHub(input){return clone(careerGetCompetitionHub(normalizeFootballState(input).careerWorld))}

export function registerPlayerForCompetition(input,playerId){
 const state=normalizeFootballState(input),target=String(playerId||''),before=state.careerWorld.competitions.registration.registeredPlayerIds.includes(target);if(before)return failure(state,'competition-registration-unavailable','That player is already registered.');state.careerWorld=careerRegisterPlayerForCompetition(state.careerWorld,target);const after=state.careerWorld.competitions.registration.registeredPlayerIds.includes(target);
 if(!after)return failure(state,'competition-registration-unavailable','The player could not be registered. Check eligibility, squad capacity and the registration window.');
 return operation(state,{type:'competition-registration',code:'player-registered',message:`${state.squads.first.players.find(player=>player.id===target)?.name||'The player'} was registered for competitive fixtures.`},true,{competitionHub:careerGetCompetitionHub(state.careerWorld)});
}

export function unregisterPlayerFromCompetition(input,playerId){
 const state=normalizeFootballState(input),target=String(playerId||''),before=state.careerWorld.competitions.registration.registeredPlayerIds.includes(target);state.careerWorld=careerUnregisterPlayerFromCompetition(state.careerWorld,target);const after=state.careerWorld.competitions.registration.registeredPlayerIds.includes(target);
 if(!before||after)return failure(state,'competition-unregistration-unavailable',!before?'That player is not registered.':'The player cannot be unregistered outside a registration window.');
 return operation(state,{type:'competition-registration',code:'player-unregistered',message:`${state.squads.first.players.find(player=>player.id===target)?.name||'The player'} was removed from the competition list.`},true,{competitionHub:careerGetCompetitionHub(state.careerWorld)});
}

export const registerPlayer=registerPlayerForCompetition;
export const unregisterPlayer=unregisterPlayerFromCompetition;

export function enterCup(input,options={}){
 const state=normalizeFootballState(input),before=state.careerWorld.competitions.cup,entryFee=money(options?.entryFee,0,0);
 if(before.status!=='not-entered'&&before.season===state.season)return failure(state,'cup-already-entered',`The club is already ${before.status==='active'?'entered in':`recorded as ${before.status} in`} ${before.name}.`);
 if(entryFee>state.finance.cash)return failure(state,'cash-insufficient','The club cannot cover the cup entry fee.');
 state.careerWorld=careerEnterCup(state.careerWorld,{...options,entryFee});
 if(entryFee){state.finance.cash-=entryFee;state.finance.seasonExpenses+=entryFee;pushLedgerInPlace(state,'cup-entry',`${state.careerWorld.competitions.cup.name} entry fee`,-entryFee)}
 return operation(state,{type:'competition-cup',code:'cup-entered',message:`Entered ${state.careerWorld.competitions.cup.name}.`},true,{competitionHub:careerGetCompetitionHub(state.careerWorld)});
}

export function scheduleFriendly(input,fixture={}){
 const state=normalizeFootballState(input),source=fixture&&typeof fixture==='object'?fixture:{},opponent=source.opponentId?{id:cleanId(source.opponentId,80),name:cleanText(source.opponentName,80,teamName(state,source.opponentId,'first'))}:standaloneOpponent(state,'friendly'),week=integer(source.week,1,FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks,state.week<=1?2:state.week<=4?state.week:state.week>=32?state.week:32),beforeIds=new Set(state.careerWorld.competitions.friendlies.map(item=>item.id));
 state.careerWorld=careerScheduleFriendly(state.careerWorld,{...source,season:state.season,week,opponentId:opponent.id,opponentName:opponent.name,venue:['home','away','neutral'].includes(source.venue)?source.venue:'home'});
 const scheduled=state.careerWorld.competitions.friendlies.find(item=>!beforeIds.has(item.id));if(!scheduled)return failure(state,'friendly-unavailable','A friendly could not be arranged for that date or opponent.');
 return operation(state,{type:'competition-friendly',code:'friendly-scheduled',message:`Friendly arranged against ${scheduled.opponentName} in week ${scheduled.week}.`},true,{friendly:clone(scheduled),competitionHub:careerGetCompetitionHub(state.careerWorld)});
}

export const arrangeFriendly=scheduleFriendly;

export function cancelFriendly(input,fixtureId){
 const state=normalizeFootballState(input),target=String(fixtureId||''),before=state.careerWorld.competitions.friendlies.find(fixture=>fixture.id===target);state.careerWorld=careerCancelFriendly(state.careerWorld,target);const after=state.careerWorld.competitions.friendlies.find(fixture=>fixture.id===target);
 if(!before||before.status!=='scheduled'||after?.status!=='cancelled')return failure(state,'friendly-cancel-unavailable','That scheduled friendly could not be cancelled.');
 return operation(state,{type:'competition-friendly',code:'friendly-cancelled',message:`The friendly against ${after.opponentName} was cancelled.`},true,{friendly:clone(after),competitionHub:careerGetCompetitionHub(state.careerWorld)});
}

export function recordFriendlyResult(input,fixtureId,result={}){
 const state=normalizeFootballState(input),before=state.careerWorld.competitions.friendlies.find(fixture=>fixture.id===String(fixtureId));state.careerWorld=careerRecordFriendlyResult(state.careerWorld,fixtureId,result);const after=state.careerWorld.competitions.friendlies.find(fixture=>fixture.id===String(fixtureId));
 if(!before||before.status!=='scheduled'||after?.status!=='played')return failure(state,'friendly-result-unavailable','That friendly result could not be recorded.');
 return operation(state,{type:'competition-friendly',code:'friendly-result-recorded',message:`The friendly against ${after.opponentName} was recorded.`},true,{friendly:clone(after)});
}

export function recordCupResult(input,result={}){
 const state=normalizeFootballState(input),before=state.careerWorld.competitions.cup.matches.length;state.careerWorld=careerRecordCupResult(state.careerWorld,result);if(state.careerWorld.competitions.cup.matches.length===before)return failure(state,'cup-result-unavailable','That cup result could not be recorded.');
 return operation(state,{type:'competition-cup',code:'cup-result-recorded',message:`The ${state.careerWorld.competitions.cup.name} result was recorded.`},true,{cup:clone(state.careerWorld.competitions.cup)});
}

export function simulateFriendlyMatch(input,fixtureId){
 const state=normalizeFootballState(input),friendly=state.careerWorld.competitions.friendlies.find(fixture=>fixture.id===String(fixtureId)&&fixture.status==='scheduled');
 if(!friendly)return failure(state,'friendly-unavailable','That scheduled friendly is not available.');
 if(friendly.season!==state.season||friendly.week!==state.week)return failure(state,'friendly-not-due',`That friendly is scheduled for season ${friendly.season}, week ${friendly.week}.`);
 const fixture=standaloneFixture(state,{...friendly,id:friendly.id}),result=resolveFixture(state,fixture,'first'),summary=applyPlayerMatchEffects(state,result,'first',{competition:'Friendly',competitionType:'friendly',competitive:false,recordClubMatch:false,recordAppearances:false,opponentName:friendly.opponentName,venue:friendly.venue,matchday:{venue:friendly.venue,opponentId:friendly.opponentId,opponentName:friendly.opponentName,competition:'Friendly',importance:.72}}),isHome=result.home===PLAYER_FIRST_TEAM_ID,goalsFor=isHome?result.homeGoals:result.awayGoals,goalsAgainst=isHome?result.awayGoals:result.homeGoals,finance=applyStandaloneMatchdayFinanceInPlace(state,result,'Friendly');
 state.careerWorld=careerRecordFriendlyResult(state.careerWorld,friendly.id,{goalsFor,goalsAgainst,attendance:result.attendance,netRevenue:result.matchday?.netRevenueAud||0,report:{...result,fixtureId:result.id}});state.counters.match+=1;
 return operation(state,{type:'match-result',code:'friendly-simulated',message:`Friendly: ${state.club.name} ${goalsFor}–${goalsAgainst} ${friendly.opponentName}.`},true,{result:clone(result),summary,finance,friendly:clone(state.careerWorld.competitions.friendlies.find(item=>item.id===friendly.id))});
}

export function simulateCupMatch(input){
 const state=normalizeFootballState(input),cup=state.careerWorld.competitions.cup;
 if(cup.status!=='active'||cup.season!==state.season)return failure(state,'cup-unavailable','There is no active cup tie to play.');
 if(cup.nextRoundWeek!==state.week)return failure(state,'cup-not-due',`The ${cup.roundName} is scheduled for week ${cup.nextRoundWeek||'TBC'}.`);
 const registrationIssue=competitiveRegistrationIssue(state);if(registrationIssue)return failure(state,'competition-registration-invalid',registrationIssue);
 const opponent=standaloneOpponent(state,`cup-${cup.roundNumber}`),venue=cup.roundNumber>=5?'neutral':hashString(`${state.seed}|cup-venue|${state.season}|${cup.roundNumber}`)%2?'home':'away',fixture=standaloneFixture(state,{id:`cup-${state.season}-${cup.roundNumber}-${opponent.id}`,round:cup.roundNumber-1,opponentId:opponent.id,opponentName:opponent.name,venue}),result=resolveFixture(state,fixture,'first'),isHome=result.home===PLAYER_FIRST_TEAM_ID,goalsFor=isHome?result.homeGoals:result.awayGoals,goalsAgainst=isHome?result.awayGoals:result.homeGoals;
 let penaltiesWon=false,advanced=goalsFor>goalsAgainst,decidedBy='90-minutes';if(goalsFor===goalsAgainst){const random=seededRandom(`${state.seed}|${fixture.id}|penalties`),strengthEdge=(teamStrength(state,PLAYER_FIRST_TEAM_ID,'first')-teamStrength(state,opponent.id,'first'))/220;penaltiesWon=random()<clamp(.5+strengthEdge,.28,.72,.5);advanced=penaltiesWon;decidedBy='penalties';result.incidents.push({type:'commentary',minute:120,teamId:penaltiesWon?PLAYER_FIRST_TEAM_ID:opponent.id,playerId:null,playerName:'',text:`${penaltiesWon?state.club.name:opponent.name} win the penalty shootout.`});sortMatchIncidents(result.incidents);result.commentary=result.incidents.map(incident=>incident.text)}
 result.stage=cup.roundName;result.decidedBy=decidedBy;result.winnerId=advanced?PLAYER_FIRST_TEAM_ID:opponent.id;
 const summary=applyPlayerMatchEffects(state,result,'first',{competition:cup.name,competitionType:'cup',recordClubMatch:false,opponentName:opponent.name,venue,matchday:{venue,opponentId:opponent.id,opponentName:opponent.name,competition:cup.name,importance:cup.roundNumber>=5?1.55:1.18}}),finance=applyStandaloneMatchdayFinanceInPlace(state,result,cup.name),prizes=[0,2_500,5_000,12_500,30_000,85_000],prizeMoney=advanced?prizes[cup.roundNumber]||0:0,isFinal=cup.roundNumber>=5;
 state.careerWorld=careerRecordCupResult(state.careerWorld,{id:fixture.id,fixtureId:fixture.id,week:state.week,opponentId:opponent.id,opponentName:opponent.name,venue,goalsFor,goalsAgainst,penaltiesWon,advanced,isFinal,prizeMoney,attendance:result.attendance,netRevenue:result.matchday?.netRevenueAud||0,report:{...result,fixtureId:result.id}});
 if(prizeMoney){state.finance.cash=money(state.finance.cash+prizeMoney,state.finance.cash);state.finance.seasonIncome=money(state.finance.seasonIncome+prizeMoney,0,0);pushLedgerInPlace(state,'cup-prize',`${cup.name} prize money`,prizeMoney)}
 if(isFinal&&advanced){state.metrics.trophies+=1;state.footballTokens+=15;state.club.reputation=clamp(state.club.reputation+4,0,100)}state.counters.match+=1;
 return operation(state,{type:'match-result',code:advanced?'cup-tie-won':'cup-eliminated',message:`${cup.roundName}: ${state.club.name} ${goalsFor}–${goalsAgainst} ${opponent.name}${decidedBy==='penalties'?` (${penaltiesWon?'won':'lost'} on penalties)`:''}.`},true,{result:clone(result),summary,finance:{...finance,prizeMoneyAud:prizeMoney},cup:clone(state.careerWorld.competitions.cup)});
}

export function setPlayerDevelopmentFocus(input,playerId,focus='balanced'){
 const state=normalizeFootballState(input),target=String(playerId||''),safeFocus=String(focus||'balanced');
 if(!FOOTBALL_DEVELOPMENT_FOCUSES.includes(safeFocus))return failure(state,'development-focus-invalid','Choose a recognised development focus.');
 let player=null,squad='';for(const [key,selection] of Object.entries(state.squads)){const candidate=selection?.players?.find(item=>item.id===target);if(candidate){player=candidate;squad=key;break}}
 if(!player||['released','transferred'].includes(player.careerStatus))return failure(state,'career-player-unavailable','That player is not available for an individual development plan.');
 player.developmentFocus=safeFocus;if(squad==='first')state.careerWorld=careerSetPlayerDevelopmentFocus(state.careerWorld,target,safeFocus);
 return operation(state,{type:'player-development',code:'development-focus-set',message:`${player.name}'s development focus is now ${safeFocus.replace('-', ' ')}.`},true,{player:clone(player),squad,focus:safeFocus});
}

export function promoteAcademyPlayer(input,playerId,destination='u23'){
 const state=normalizeFootballState(input),target=String(playerId||''),academy=state.squads.academy,u23=state.squads.u23,academyIndex=academy.players.findIndex(player=>player.id===target),u23Index=u23.players.findIndex(player=>player.id===target),sourceKey=academyIndex>=0?'academy':u23Index>=0?'u23':'',sourceSquad=sourceKey==='academy'?academy:u23,index=sourceKey==='academy'?academyIndex:u23Index,destinationKey=sourceKey==='u23'||destination==='first'?'first':'u23',destinationSquad=state.squads[destinationKey];
 if(!sourceKey)return failure(state,'pathway-player-unavailable','That academy or U23 player could not be found.');
 if(destinationSquad.players.length>=30||(destinationKey==='first'&&destinationSquad.players.filter(player=>!['released','transferred'].includes(player.careerStatus)).length>=25))return failure(state,'promotion-squad-full',`The ${destinationKey==='first'?'first-team':'U23'} squad is full.`);
 const source=sourceSquad.players[index],weeklyWage=destinationKey==='first'?Math.max(source.weeklyWage||0,60,Math.round((35+source.rating*1.35)/10)*10):Math.max(30,Math.round((20+source.rating*.7)/10)*10);
 if(destinationKey==='first'&&squadWeeklyWages(state,'first')+weeklyWage>state.finance.weeklyFirstTeamBudget)return failure(state,'senior-wage-budget','The promoted player would take the first team above its weekly wage budget.');
 sourceSquad.players.splice(index,1);sourceSquad.lineup=sourceSquad.lineup.filter(id=>id!==target);sourceSquad.bench=sourceSquad.bench.filter(id=>id!==target);
 const promoted=normalizePlayer({...source,weeklyWage,contractSeasons:destinationKey==='first'?2:3,careerStatus:'active',loanId:'',developmentFocus:source.developmentFocus||'balanced'},destinationSquad.players.length,destinationKey);destinationSquad.players.push(promoted);destinationSquad.bench.push(promoted.id);repairSquadSelection(sourceSquad);repairSquadSelection(destinationSquad);if(sourceKey==='academy')state.metrics.academyGraduates+=1;
 if(destinationKey==='first')resyncCareerPlayersInPlace(state);
 return operation(state,{type:'academy-promotion',code:'academy-player-promoted',message:`${promoted.name} was promoted from the ${sourceKey==='academy'?'academy':'U23 squad'} to the ${destinationKey==='first'?'first team':'U23 squad'}.`},true,{player:clone(promoted),source:sourceKey,destination:destinationKey,requiresRegistration:destinationKey==='first'});
}

export const promoteYouthPlayer=promoteAcademyPlayer;

export function shortlistScoutedPlayer(input,reportId,shortlisted=true){
 const state=normalizeFootballState(input),target=String(reportId||''),report=state.careerWorld.scouting.reports.find(item=>item.id===target||item.targetId===target),existing=state.careerWorld.scouting.shortlist.find(item=>item.playerId===(report?.targetId||target));
 if(!report&&!existing)return failure(state,'scouting-report-unavailable','A completed scouting report is required before changing the shortlist.');
 const playerId=report?.targetId||existing.playerId;
 if(shortlisted===false){state.careerWorld=careerRemoveFromScoutingShortlist(state.careerWorld,playerId);return operation(state,{type:'scouting-shortlist',code:'shortlist-player-removed',message:`${existing?.name||report?.targetName||'The player'} was removed from the shortlist.`},true,{scouting:careerGetScoutingView(state.careerWorld)})}
 state.careerWorld=careerAddToScoutingShortlist(state.careerWorld,{playerId,name:report.targetName,position:report.position,reportId:report.id,priority:report.recommendation==='priority'?'high':'normal'});
 return operation(state,{type:'scouting-shortlist',code:'shortlist-player-added',message:`${report.targetName} was added to the recruitment shortlist.`},true,{scouting:careerGetScoutingView(state.careerWorld)});
}

export const shortlistPlayer=shortlistScoutedPlayer;

function enginePositionFromReport(position){const value=String(position||'MF').toUpperCase();if(value.includes('GK'))return 'GK';if(/CB|LB|RB|WB|DF/.test(value))return 'DF';if(/ST|CF|FW/.test(value))return 'FW';return 'MF'}

export function approachScoutedPlayer(input,reportId){
 const state=normalizeFootballState(input),target=String(reportId||''),report=state.careerWorld.scouting.reports.find(item=>item.id===target||item.targetId===target);
 if(!report)return failure(state,'scouting-report-unavailable','A completed scouting report is required before approaching a player.');
 if(state.squads.first.players.some(player=>player.id===report.targetId&&!['released','transferred'].includes(player.careerStatus)))return failure(state,'player-already-owned','That player is already contracted to the club.');
 if(state.squads.first.players.filter(player=>!['released','transferred'].includes(player.careerStatus)).length>=25)return failure(state,'senior-squad-full','The first-team squad is at its 25-player limit.');
 const rating=integer(((report.ratingRange?.[0]||45)+(report.ratingRange?.[1]||55))/2,1,99,50),potential=integer(Math.max(rating,((report.potentialRange?.[0]||rating)+(report.potentialRange?.[1]||rating+8))/2),rating,99,rating+5),valueRange=report.valueRange||[],transferFeeAud=money(valueRange.length?((valueRange[0]||0)+(valueRange[1]||valueRange[0]||0))/2:Math.max(5_000,rating*1_000),0,0),weeklyWage=Math.max(60,Math.round((30+rating*1.55)/10)*10),projectedWages=squadWeeklyWages(state,'first')+weeklyWage;
 if(projectedWages>state.finance.weeklyFirstTeamBudget)return failure(state,'senior-wage-budget','The proposed contract would exceed the first-team wage budget.',{projectedWagesAud:projectedWages,budgetCeilingAud:state.finance.weeklyFirstTeamBudget});
 if(transferFeeAud>state.finance.cash)return failure(state,'cash-insufficient',`Signing ${report.targetName} requires an estimated $${transferFeeAud.toLocaleString()} transfer fee.`);
 const signed=normalizePlayer({id:report.targetId||`scouted-${hashString(`${state.seed}|${report.id}`).toString(36)}`,name:report.targetName,position:enginePositionFromReport(report.position),age:report.age,rating,potential,weeklyWage,fatigue:8,morale:64,injuryWeeks:0,contractSeasons:2,careerStatus:'active',developmentFocus:'balanced'},state.squads.first.players.length,'first');
 state.finance.cash=money(state.finance.cash-transferFeeAud,state.finance.cash);state.finance.seasonExpenses=money(state.finance.seasonExpenses+transferFeeAud,0,0);pushLedgerInPlace(state,'player-signing',`${signed.name} transfer fee`,-transferFeeAud);state.squads.first.players.push(signed);state.squads.first.bench.push(signed.id);repairSquadSelection(state.squads.first);resyncCareerPlayersInPlace(state);state.careerWorld=careerRecordTransferFeePaid(state.careerWorld,transferFeeAud,{playerId:signed.id,playerName:signed.name});state.careerWorld=careerRemoveFromScoutingShortlist(state.careerWorld,signed.id);
 return operation(state,{type:'player-signed',code:'scouted-player-signed',message:`${signed.name} joined for $${transferFeeAud.toLocaleString()}. Register the player before selecting them in a competitive fixture.`},true,{player:clone(signed),transferFeeAud,weeklyWageAud:weeklyWage,requiresRegistration:true});
}

export const approachPlayer=approachScoutedPlayer;

export function markInboxRead(input,messageId,read=true){
 const state=normalizeFootballState(input),target=state.careerWorld.inbox.find(item=>item.id===String(messageId));if(!target)return failure(state,'inbox-message-unavailable','That inbox message could not be found.');state.careerWorld=careerMarkInboxRead(state.careerWorld,messageId,read);
 return operation(state,{type:'career-inbox',code:'inbox-read-state-set',message:'The inbox message was updated.'},true,{decisionHub:careerGetDecisionHub(state.careerWorld)});
}

export function resolveInboxDecision(input,messageId,actionId){
 const state=normalizeFootballState(input),target=state.careerWorld.inbox.find(item=>item.id===String(messageId));if(!target||target.resolved||!target.actions.some(action=>action.id===String(actionId)))return failure(state,'inbox-decision-unavailable','That inbox decision or action is no longer available.');state.careerWorld=careerResolveInboxDecision(state.careerWorld,messageId,actionId);
 return operation(state,{type:'career-inbox',code:'inbox-decision-resolved',message:'The club decision was recorded.'},true,{decisionHub:careerGetDecisionHub(state.careerWorld)});
}

export function renewPlayerContract(input,playerId,terms={}){
 const state=normalizeFootballState(input),player=state.squads.first.players.find(item=>item.id===String(playerId));
 if(!player||['released','transferred'].includes(player.careerStatus))return failure(state,'career-player-unavailable','That player is not available for a new contract.');
 const wage=money(terms?.weeklyWage,player.weeklyWage,0),current=squadWeeklyWages(state,'first'),projected=current-playerWeeklyWageLiability(state,player)+playerWeeklyWageLiability(state,{...player,weeklyWage:wage});
 if(projected>state.finance.weeklyFirstTeamBudget)return failure(state,'senior-wage-budget','The renewed contract would exceed the first-team wage-budget ceiling.',{currentWagesAud:current,projectedWagesAud:projected,budgetCeilingAud:state.finance.weeklyFirstTeamBudget});
 state.careerWorld=careerRenewPlayerContract(state.careerWorld,player.id,{...terms,weeklyWage:wage});player.weeklyWage=wage;player.contractSeasons=integer(terms?.seasons,1,5,Math.max(1,player.contractSeasons));if(player.careerStatus!=='loaned')player.careerStatus='active';resyncCareerPlayersInPlace(state);
 return operation(state,{type:'player-contract',code:'player-contract-renewed',message:`${player.name} signed a new ${player.contractSeasons}-season contract.`},true,{player:clone(player),weeklyWageAud:wage,totalWeeklyWagesAud:projected});
}

export function releasePlayer(input,playerId,reason='Released by the club'){
 const state=normalizeFootballState(input),player=state.squads.first.players.find(item=>item.id===String(playerId));
 if(!player||['released','transferred'].includes(player.careerStatus))return failure(state,'career-player-unavailable','That player is no longer registered with the club.');
 cancelActivePlayerLoansInPlace(state,player.id);state.careerWorld=careerReleasePlayer(state.careerWorld,player.id,reason);syncRootPlayersFromCareerInPlace(state);
 return operation(state,{type:'player-contract',code:'player-released',message:`${player.name} was released by the club.`},true,{playerId:player.id});
}

export function setPlayerTransferStatus(input,playerId,status='not-listed'){
 const state=normalizeFootballState(input),player=state.squads.first.players.find(item=>item.id===String(playerId));
 if(!player||['released','transferred'].includes(player.careerStatus))return failure(state,'career-player-unavailable','That player is not available for transfer instructions.');
 state.careerWorld=careerSetPlayerTransferStatus(state.careerWorld,player.id,status);
 return operation(state,{type:'player-transfer',code:'player-transfer-status-set',message:`Transfer instructions for ${player.name} were updated.`},true,{playerId:player.id,status:state.careerWorld.players.find(item=>item.id===player.id)?.transferStatus||'not-listed'});
}

export function generateTransferOffers(input,options={}){
 const state=normalizeFootballState(input);state.careerWorld=careerGenerateTransferOffers(state.careerWorld,options);
 return operation(state,{type:'player-transfer',code:'transfer-market-checked',message:'The recruitment team checked for transfer and loan interest.'},true,{offers:clone(state.careerWorld.transferOffers)});
}

export function respondToTransferOffer(input,offerId,response='reject'){
 const state=normalizeFootballState(input),offer=state.careerWorld.transferOffers.find(item=>item.id===String(offerId)&&item.status==='pending');
 if(!offer)return failure(state,'transfer-offer-unavailable','That transfer offer is no longer pending.');
 if(response==='accept'&&offer.type==='permanent')cancelActivePlayerLoansInPlace(state,offer.playerId);
 state.careerWorld=careerRespondToTransferOffer(state.careerWorld,offer.id,response);
 if(response==='accept'){
  const income=offer.type==='permanent'?offer.amount:offer.loanFee;
  if(income){state.finance.cash=money(state.finance.cash+income);state.finance.seasonIncome=money(state.finance.seasonIncome+income,0,0);pushLedgerInPlace(state,offer.type==='permanent'?'player-sale':'loan-fee',`${offer.clubName} ${offer.type==='permanent'?'transfer':'loan'} payment`,income)}
  syncRootPlayersFromCareerInPlace(state);
 }
 return operation(state,{type:'player-transfer',code:`transfer-offer-${response}`,message:`The ${offer.type} offer from ${offer.clubName} was ${response==='accept'?'accepted':response==='negotiate'?'negotiated':'rejected'}.`},true,{offer:clone(state.careerWorld.transferOffers.find(item=>item.id===offer.id)),cashDeltaAud:response==='accept'?(offer.type==='permanent'?offer.amount:offer.loanFee):0});
}

export function startPlayerLoan(input,playerId,terms={}){
 const state=normalizeFootballState(input),player=state.squads.first.players.find(item=>item.id===String(playerId));
 if(!player||player.careerStatus!=='active')return failure(state,'career-player-unavailable','That player cannot begin this loan.');
 if(state.careerWorld.loans.some(item=>item.playerId===player.id&&item.status==='active'))return failure(state,'player-loan-active','That player already has an active loan.');
 state.careerWorld=careerStartPlayerLoan(state.careerWorld,player.id,terms);syncRootPlayersFromCareerInPlace(state);
 const loan=state.careerWorld.loans.filter(item=>item.playerId===player.id).at(-1),fee=loan?.direction==='out'?loan.fee:0;
 if(fee){state.finance.cash=money(state.finance.cash+fee);state.finance.seasonIncome=money(state.finance.seasonIncome+fee,0,0);pushLedgerInPlace(state,'loan-fee',`${loan.clubName} loan fee`,fee)}
 return operation(state,{type:'player-loan',code:'player-loan-started',message:`${player.name} began a ${loan?.direction==='in'?'loan to the club':'loan spell away'}.`},true,{loan:clone(loan),cashDeltaAud:fee||0});
}

export function recallPlayerLoan(input,loanId){
 const state=normalizeFootballState(input),loan=state.careerWorld.loans.find(item=>item.id===String(loanId)&&item.status==='active');
 if(!loan)return failure(state,'player-loan-unavailable','That active loan could not be found.');
 state.careerWorld=careerRecallPlayerLoan(state.careerWorld,loan.id);syncRootPlayersFromCareerInPlace(state);
 return operation(state,{type:'player-loan',code:'player-loan-recalled',message:'The player was recalled from loan.'},true,{loan:clone(state.careerWorld.loans.find(item=>item.id===loan.id))});
}

export function createScoutingAssignment(input,details={}){const state=normalizeFootballState(input),before=new Set(state.careerWorld.scouting.assignments.map(item=>item.id));state.careerWorld=careerCreateScoutingAssignment(state.careerWorld,details);const created=state.careerWorld.scouting.assignments.find(item=>!before.has(item.id));if(!created)return failure(state,'scouting-assignment-unavailable','That scouting assignment could not be created or is already active.');return operation(state,{type:'scouting',code:'scouting-assignment-created',message:'The scouting assignment was added.'},true,{assignment:clone(created),scouting:careerGetScoutingView(state.careerWorld)})}
export function cancelScoutingAssignment(input,assignmentId){const state=normalizeFootballState(input),target=state.careerWorld.scouting.assignments.find(item=>item.id===String(assignmentId)&&item.status==='active');if(!target)return failure(state,'scouting-assignment-unavailable','That active scouting assignment could not be found.');state.careerWorld=careerCancelScoutingAssignment(state.careerWorld,assignmentId);const cancelled=state.careerWorld.scouting.assignments.find(item=>item.id===target.id);if(cancelled?.status!=='cancelled')return failure(state,'scouting-assignment-unavailable','That scouting assignment could not be cancelled.');return operation(state,{type:'scouting',code:'scouting-assignment-cancelled',message:'The scouting assignment was cancelled.'},true,{assignment:clone(cancelled),scouting:careerGetScoutingView(state.careerWorld)})}
export function createOpponentReport(input,opponent={}){const state=normalizeFootballState(input),clubId=cleanId(opponent?.clubId||opponent?.id,80);if(!clubId)return failure(state,'opponent-report-unavailable','Choose a valid opponent before requesting a report.');const before=JSON.stringify(state.careerWorld.scouting.opponentReports.find(item=>item.clubId===clubId)||null);state.careerWorld=careerCreateOpponentReport(state.careerWorld,{...opponent,clubId});const report=state.careerWorld.scouting.opponentReports.find(item=>item.clubId===clubId);if(!report||JSON.stringify(report)===before)return failure(state,'opponent-report-unavailable','The existing opponent report is already current.');return operation(state,{type:'scouting',code:'opponent-report-created',message:'The opposition report was prepared.'},true,{report:clone(report),scouting:careerGetScoutingView(state.careerWorld)})}
export function setBoardExpectations(input,expectations=[]){const state=normalizeFootballState(input);state.careerWorld=careerSetBoardExpectations(state.careerWorld,expectations);return operation(state,{type:'board',code:'board-expectations-set',message:'The board plan was updated.'},true,{board:clone(state.careerWorld.board)})}
export function setClubIdentity(input,patch={}){const state=normalizeFootballState(input);state.careerWorld=careerSetClubIdentity(state.careerWorld,patch);return operation(state,{type:'club-identity',code:'club-identity-set',message:'The club identity was updated.'},true,{identity:clone(state.careerWorld.identity)})}
export function registerRivalry(input,rival={}){const state=normalizeFootballState(input),clubId=cleanId(rival?.clubId||rival?.id,80);if(!clubId)return failure(state,'club-rivalry-unavailable','Choose a valid rival club.');const before=JSON.stringify(state.careerWorld.identity.rivalries.find(item=>item.clubId===clubId)||null);state.careerWorld=careerRegisterRivalry(state.careerWorld,{...rival,clubId});const rivalry=state.careerWorld.identity.rivalries.find(item=>item.clubId===clubId);if(!rivalry||JSON.stringify(rivalry)===before)return failure(state,'club-rivalry-unavailable','That rivalry is already recorded with the same details.');return operation(state,{type:'club-identity',code:'club-rivalry-registered',message:'The rivalry was added to club history.'},true,{rivalry:clone(rivalry),identity:clone(state.careerWorld.identity)})}
export function setMatchdayPlan(input,patch={}){const state=normalizeFootballState(input);state.careerWorld=careerSetMatchdayPlan(state.careerWorld,patch);return operation(state,{type:'matchday-plan',code:'matchday-plan-set',message:'The matchday operations plan was saved.'},true,{matchday:clone(state.careerWorld.matchday)})}

export function getClubOverview(input){
 const state=normalizeFootballState(input),firstDivision=getSeniorDivision(state.first.divisionId),site=getStartSite(state.club.siteId);
 return {club:clone(state.club),manager:clone(state.manager),managerResponsibilities:getManagerResponsibilities(state),season:state.season,week:state.week,status:state.status,site:clone(site),firstDivision:{...clone(firstDivision),displayName:getCompetitionDisplayName(firstDivision.id,state.season)},u23:clone(state.u23),academy:clone(state.academy),bTeam:clone(state.b),finance:financeSnapshot(state),careerWorld:clone(state.careerWorld),decisionHub:careerGetDecisionHub(state.careerWorld),currentFixture:getCurrentFixture(state,'first'),u23Fixture:getCurrentFixture(state,'u23'),academyFixture:getCurrentFixture(state,'academy'),bFixture:state.b?getCurrentFixture(state,'b'):null,bankruptcy:getBankruptcyStatus(state)};
}
