/*
 * Deterministic people, delegation, sponsorship and commercial systems.
 *
 * This module has no DOM, storage, clock or network dependencies. Public
 * operations normalize and copy their inputs, so callers can safely use it in
 * save migrations, previews and simulation workers.
 */

export const FOOTBALL_OPERATIONS_SCHEMA_VERSION=1;
export const FOOTBALL_OPERATIONS_SEASON_WEEKS=40;
export const FOOTBALL_OPERATIONS_LIMITS=Object.freeze({staff:24,candidates:18,delegations:12,sponsorOffers:12,sponsorContracts:12,history:60});

const MIN_SEASON=2020,MAX_SEASON=2200,MAX_MONEY=9_000_000_000_000_000;
const STAFF_ROLES=Object.freeze([
 ['head-coach','Head coach','football',['training-plan','team-selection','opposition-analysis']],
 ['assistant-coach','Assistant coach','football',['training-plan','team-selection','opposition-analysis']],
 ['academy-director','Academy director','academy',['academy-pathway','training-plan']],
 ['recruitment-director','Recruitment director','recruitment',['recruitment-shortlist','sponsor-negotiation']],
 ['chief-scout','Chief scout','recruitment',['recruitment-shortlist','opposition-analysis']],
 ['sports-scientist','Sports scientist','performance',['injury-return','training-plan']],
 ['physio','Head physiotherapist','performance',['injury-return']],
 ['analyst','Performance analyst','analysis',['opposition-analysis','training-plan']],
 ['grounds-manager','Grounds manager','operations',['matchday-operations']],
 ['commercial-director','Commercial director','commercial',['sponsor-negotiation','ticket-strategy','community-programme']],
 ['community-manager','Community manager','community',['community-programme','ticket-strategy']],
 ['finance-director','Finance director','finance',['sponsor-negotiation','ticket-strategy','matchday-operations']]
]);
const ROLE_MAP=new Map(STAFF_ROLES.map(([id,name,department,responsibilities])=>[id,{id,name,department,responsibilities}]));
const PERSONALITIES=Object.freeze(['ambitious','analytical','calm','charismatic','demanding','diplomatic','innovative','loyal','pragmatic','resilient']);
const RESPONSIBILITIES=Object.freeze([
 ['training-plan','Training plan','football',['head-coach','assistant-coach','academy-director','sports-scientist','analyst']],
 ['team-selection','Team selection','football',['head-coach','assistant-coach']],
 ['academy-pathway','Academy pathway','academy',['academy-director']],
 ['recruitment-shortlist','Recruitment shortlist','recruitment',['recruitment-director','chief-scout']],
 ['injury-return','Injury return decisions','performance',['sports-scientist','physio']],
 ['opposition-analysis','Opposition analysis','analysis',['analyst','chief-scout','head-coach','assistant-coach']],
 ['matchday-operations','Matchday operations','operations',['grounds-manager','finance-director']],
 ['sponsor-negotiation','Sponsor negotiation','commercial',['commercial-director','finance-director','recruitment-director']],
 ['community-programme','Community programme','community',['community-manager','commercial-director']],
 ['ticket-strategy','Ticket strategy','commercial',['commercial-director','community-manager','finance-director']]
]);
const RESPONSIBILITY_MAP=new Map(RESPONSIBILITIES.map(([id,name,department,roles])=>[id,{id,name,department,roles}]));
const CATEGORIES=Object.freeze(['apparel','automotive','banking','community','construction','education','food-beverage','health','technology','tourism']);
const FIRST_NAMES=Object.freeze(['Alex','Amelia','Ben','Casey','Chris','Elena','Grace','Harper','Isaac','Jordan','Kai','Leah','Marcus','Mia','Noah','Priya','Riley','Sam','Sienna','Tom']);
const LAST_NAMES=Object.freeze(['Bennett','Campbell','Chen','Evans','Foster','Gibson','Harris','Kaur','Kelly','Martin','Murphy','Nguyen','Patel','Reid','Silva','Singh','Taylor','Walker','Williams','Young']);
const SPONSOR_PREFIXES=Object.freeze(['Banksia','Coastal','Coral','Glasshouse','Moreton','Northstar','Rivergum','Southern Cross','Sunstate','Wattle']);
const SPONSOR_SUFFIXES=Object.freeze(['Collective','Group','Industries','Partners','Services','Solutions','Works']);

const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const asObject=value=>isObject(value)?value:{};
const asArray=value=>Array.isArray(value)?value:[];
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max,fallback=min)=>Math.min(max,Math.max(min,finite(value,fallback)));
const integer=(value,min,max,fallback=min)=>Math.round(clamp(value,min,max,fallback));
const money=(value,fallback=0,min=0)=>Math.round(clamp(value,min,MAX_MONEY,fallback));
const bool=(value,fallback=false)=>typeof value==='boolean'?value:fallback;
const text=(value,max=100,fallback='')=>String(value??'').replace(/[<>\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,max)||fallback;
const id=(value,max=80,fallback='')=>text(value,max,fallback).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,max)||fallback;
const enumValue=(value,values,fallback)=>values.includes(value)?value:fallback;
const round=(value,places=1)=>Number(finite(value).toFixed(places));
const unique=list=>[...new Set(list)];
const last=(list,limit)=>list.length>limit?list.slice(list.length-limit):list;
const clone=value=>JSON.parse(JSON.stringify(value));

function hashString(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return hash>>>0}
function seededRandom(seed){let value=hashString(seed)||0x6d2b79f5;return()=>{value+=0x6d2b79f5;let result=value;result=Math.imul(result^result>>>15,result|1);result^=result+Math.imul(result^result>>>7,result|61);return((result^result>>>14)>>>0)/4294967296}}
const absoluteWeek=(season,week)=>(integer(season,MIN_SEASON,MAX_SEASON,2026)-MIN_SEASON)*FOOTBALL_OPERATIONS_SEASON_WEEKS+integer(week,1,FOOTBALL_OPERATIONS_SEASON_WEEKS,1);
const weekFromAbsolute=value=>({season:MIN_SEASON+Math.floor((Math.max(1,value)-1)/FOOTBALL_OPERATIONS_SEASON_WEEKS),week:(Math.max(1,value)-1)%FOOTBALL_OPERATIONS_SEASON_WEEKS+1});
const addWeeks=(season,week,amount)=>weekFromAbsolute(absoluteWeek(season,week)+integer(amount,0,400,0));

function normalizeAttributes(raw={}){
 const source=asObject(raw);
 return {technical:integer(source.technical,1,100,50),people:integer(source.people,1,100,50),judgement:integer(source.judgement,1,100,50),negotiation:integer(source.negotiation,1,100,50),organisation:integer(source.organisation,1,100,50),innovation:integer(source.innovation,1,100,50)};
}

function departmentEffect(roleId,attributes){
 const role=ROLE_MAP.get(roleId)||ROLE_MAP.get('assistant-coach'),a=normalizeAttributes(attributes);
 const weights=role.department==='commercial'||role.department==='finance'?[a.negotiation,a.organisation,a.people]:role.department==='performance'?[a.technical,a.judgement,a.organisation]:role.department==='community'?[a.people,a.organisation,a.innovation]:[a.technical,a.judgement,a.organisation];
 const quality=Math.round(weights.reduce((sum,value)=>sum+value,0)/weights.length);
 return {department:role.department,quality,speed:integer(a.organisation*.65+a.innovation*.35,1,100,50),development:integer(a.technical*.55+a.people*.45,1,100,50),riskReduction:integer(a.judgement*.6+a.organisation*.4,1,100,50),revenue:integer(a.negotiation*.55+a.innovation*.25+a.people*.2,1,100,50)};
}

function normalizeContract(raw,season,week,defaultWeeks=80){
 const source=asObject(raw),end=addWeeks(season,week,defaultWeeks);
 return {startsSeason:integer(source.startsSeason,MIN_SEASON,MAX_SEASON,season),startsWeek:integer(source.startsWeek,1,40,week),expiresSeason:integer(source.expiresSeason,MIN_SEASON,MAX_SEASON,end.season),expiresWeek:integer(source.expiresWeek,1,40,end.week),releaseClauseAud:money(source.releaseClauseAud,0),renewalOption:bool(source.renewalOption)};
}

function normalizeStaff(raw,index,season,week,status='active'){
 const source=asObject(raw),roleId=enumValue(source.roleId||source.role,STAFF_ROLES.map(item=>item[0]),'assistant-coach'),attributes=normalizeAttributes(source.attributes);
 return {id:id(source.id,80,`${status==='candidate'?'candidate':'staff'}-${roleId}-${index+1}`),name:text(source.name,70,`Staff member ${index+1}`),roleId,roleName:ROLE_MAP.get(roleId).name,attributes,weeklyWageAud:money(source.weeklyWageAud??source.weeklyWage,1200),hiringFeeAud:money(source.hiringFeeAud,0),contract:normalizeContract(source.contract,season,week,status==='candidate'?52:80),personality:enumValue(source.personality,PERSONALITIES,'pragmatic'),morale:integer(source.morale,0,100,70),trust:integer(source.trust,0,100,55),reputation:integer(source.reputation,0,100,50),departmentEffect:departmentEffect(roleId,attributes),status:enumValue(source.status,['active','candidate','expired','dismissed'],status)};
}

function generatedPerson(seed,season,week,index,roleId,status='candidate'){
 const random=seededRandom(`${seed}|person|${season}|${week}|${index}|${roleId}`),base=42+Math.round(random()*37),attributes={technical:integer(base+(random()-.5)*25,15,96,50),people:integer(base+(random()-.5)*25,15,96,50),judgement:integer(base+(random()-.5)*25,15,96,50),negotiation:integer(base+(random()-.5)*25,15,96,50),organisation:integer(base+(random()-.5)*25,15,96,50),innovation:integer(base+(random()-.5)*25,15,96,50)};
 const name=`${FIRST_NAMES[Math.floor(random()*FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(random()*LAST_NAMES.length)]}`,quality=departmentEffect(roleId,attributes).quality,wage=Math.round((420+quality*34+(random()-.5)*300)/25)*25;
 return normalizeStaff({id:`${status}-${roleId}-${hashString(`${seed}|${name}|${season}|${week}|${index}`).toString(36)}`,name,roleId,attributes,weeklyWageAud:wage,hiringFeeAud:status==='candidate'?Math.round(wage*(2+random()*4)/100)*100:0,personality:PERSONALITIES[Math.floor(random()*PERSONALITIES.length)],morale:72,trust:50,reputation:integer(quality+(random()-.5)*15,20,92,50),status},index,season,week,status);
}

function defaultStaff(seed,season,week,legacy={}){
 const required=['head-coach','academy-director','grounds-manager'],mapped={'grounds-team':'grounds-manager',recruitment:'recruitment-director','medical-team':'physio',analysts:'analyst','sports-science':'sports-scientist'};
 const roles=[...required];
 for(const [legacyRole,rawLevel] of Object.entries(asObject(legacy))){const roleId=mapped[legacyRole]||legacyRole,level=integer(isObject(rawLevel)?rawLevel.level:rawLevel,0,4,0);if(ROLE_MAP.has(roleId)&&level>0&&!roles.includes(roleId))roles.push(roleId)}
 return roles.map((roleId,index)=>generatedPerson(`${seed}|initial`,season,week,index,roleId,'active'));
}

function defaultCandidates(seed,season,week,count=10){return Array.from({length:Math.min(count,FOOTBALL_OPERATIONS_LIMITS.candidates)},(_,index)=>generatedPerson(seed,season,week,index,STAFF_ROLES[(index+3)%STAFF_ROLES.length][0]))}

function delegationScores(responsibility,staff){
 if(!staff)return {quality:50,risk:18};
 const a=staff.attributes,base=responsibility.department==='commercial'?a.negotiation*.4+a.people*.25+a.organisation*.35:responsibility.department==='community'?a.people*.45+a.organisation*.3+a.innovation*.25:responsibility.department==='performance'?a.technical*.4+a.judgement*.35+a.organisation*.25:a.technical*.35+a.judgement*.35+a.organisation*.3;
 const fit=responsibility.roles.includes(staff.roleId)?8:-18,quality=integer(base+fit+(staff.trust-50)*.12,1,100,50),risk=integer(40-quality*.32+(100-staff.trust)*.12,1,60,20);
 return {quality,risk};
}

function normalizeDelegation(raw,definition,staff){
 const source=asObject(raw),assignedStaffId=id(source.assignedStaffId||source.staffId,80,''),candidate=staff.find(item=>item.id===assignedStaffId&&item.status==='active')||null,member=bool(source.managerControlled,false)?null:candidate,scores=delegationScores(definition,member);
 return {id:definition.id,name:definition.name,department:definition.department,managerControlled:!member,assignedStaffId:member?.id||'',quality:integer(source.quality,0,100,scores.quality),risk:integer(source.risk,0,100,scores.risk),trust:integer(source.trust,0,100,member?.trust??50),lastOutcome:enumValue(source.lastOutcome,['none','excellent','good','mixed','poor'],'none'),lastUpdatedKey:text(source.lastUpdatedKey,30,'')};
}

function normalizeObjective(raw,index=0){const source=asObject(raw);return{id:id(source.id,60,`objective-${index+1}`),type:enumValue(source.type,['supporters','community-reach','digital-followers','commercial-reputation','average-attendance','wins','academy-graduates'],'supporters'),target:integer(source.target,1,10_000_000,1000),progress:integer(source.progress,0,10_000_000,0),rewardAud:money(source.rewardAud,0),penaltyAud:money(source.penaltyAud,0),status:enumValue(source.status,['active','met','missed'],'active'),paid:bool(source.paid)}}
function normalizeBonus(raw,index=0){const source=asObject(raw);return{id:id(source.id,60,`bonus-${index+1}`),type:enumValue(source.type,['supporters','community-reach','digital-followers','commercial-reputation','average-attendance','wins','academy-graduates'],'commercial-reputation'),target:integer(source.target,1,10_000_000,50),rewardAud:money(source.rewardAud,0),earned:bool(source.earned)}}
function normalizeSponsor(raw,index,season,week,kind='offer'){
 const source=asObject(raw),category=enumValue(source.category,CATEGORIES,'community'),durationWeeks=integer(source.durationWeeks,4,200,40),end=addWeeks(season,week,durationWeeks);
 return {id:id(source.id,80,`${kind}-${season}-${week}-${index+1}`),sponsorName:text(source.sponsorName||source.name,80,`Club partner ${index+1}`),category,weeklyFeeAud:money(source.weeklyFeeAud,1000),signingBonusAud:money(source.signingBonusAud,0),durationWeeks,weeksElapsed:integer(source.weeksElapsed,0,durationWeeks,0),weeksRemaining:integer(source.weeksRemaining,0,durationWeeks,durationWeeks),exclusivity:enumValue(source.exclusivity,['none','category','club'],'category'),reputationFit:integer(source.reputationFit,0,100,60),objectives:asArray(source.objectives).slice(0,4).map(normalizeObjective),bonuses:asArray(source.bonuses).slice(0,4).map(normalizeBonus),status:enumValue(source.status,kind==='offer'?['pending','accepted','rejected','expired']:['active','completed','terminated'],kind==='offer'?'pending':'active'),createdSeason:integer(source.createdSeason,MIN_SEASON,MAX_SEASON,season),createdWeek:integer(source.createdWeek,1,40,week),expiresSeason:integer(source.expiresSeason,MIN_SEASON,MAX_SEASON,kind==='offer'?addWeeks(season,week,6).season:end.season),expiresWeek:integer(source.expiresWeek,1,40,kind==='offer'?addWeeks(season,week,6).week:end.week),totalEarnedAud:money(source.totalEarnedAud,0)};
}

function normalizePlan(raw={}){
 const source=asObject(raw),merch=asObject(source.merchandise),community=asObject(source.community),digital=asObject(source.digital),tickets=asObject(source.tickets);
 return {merchandise:{strategy:enumValue(merch.strategy,['value','balanced','premium','limited-drops'],'balanced'),weeklyBudgetAud:money(merch.weeklyBudgetAud,700),productFocus:enumValue(merch.productFocus,['kits','casual','youth','collectibles'],'kits')},community:{strategy:enumValue(community.strategy,['schools','grassroots','charity','open-club'],'grassroots'),weeklyBudgetAud:money(community.weeklyBudgetAud,500)},digital:{strategy:enumValue(digital.strategy,['low-key','steady','matchday','always-on'],'steady'),weeklyBudgetAud:money(digital.weeklyBudgetAud,350),contentCadence:integer(digital.contentCadence,1,14,4)},tickets:{strategy:enumValue(tickets.strategy,['accessible','balanced','yield','membership-first'],'balanced'),basePriceAud:money(tickets.basePriceAud,22),familyDiscountPercent:integer(tickets.familyDiscountPercent,0,60,15)}};
}

function initialMetrics(raw={}){const source=asObject(raw);return{supporters:integer(source.supporters??source.supporterBase,50,10_000_000,1200),digitalFollowers:integer(source.digitalFollowers,0,100_000_000,800),communityReach:integer(source.communityReach,0,100_000_000,500),commercialReputation:integer(source.commercialReputation??source.reputation,0,100,35),merchandiseIncomeAud:money(source.merchandiseIncomeAud,0),lifetimeCommercialIncomeAud:money(source.lifetimeCommercialIncomeAud,0),lastSupporterGrowth:integer(source.lastSupporterGrowth,-1_000_000,1_000_000,0)}}

function generateSponsorOffers(seed,season,week,metrics,count=3,token='initial'){
 const offers=[];
 for(let index=0;index<count;index+=1){
  const random=seededRandom(`${seed}|sponsor|${season}|${week}|${token}|${index}`),category=CATEGORIES[Math.floor(random()*CATEGORIES.length)],fit=integer(42+random()*48+(metrics.commercialReputation-50)*.2,20,98,60),weekly=Math.round((450+metrics.supporters*.18+metrics.commercialReputation*25+random()*900)/50)*50,duration=[20,40,60][Math.floor(random()*3)],sponsorName=`${SPONSOR_PREFIXES[Math.floor(random()*SPONSOR_PREFIXES.length)]} ${SPONSOR_SUFFIXES[Math.floor(random()*SPONSOR_SUFFIXES.length)]}`,metricType=index%3===0?'supporters':index%3===1?'digital-followers':'community-reach',baseline=metricType==='supporters'?metrics.supporters:metricType==='digital-followers'?metrics.digitalFollowers:metrics.communityReach,target=Math.max(1,Math.round(baseline+duration*(metricType==='supporters'?2:metricType==='digital-followers'?12:8)*(0.75+random()*.7))),idValue=`offer-${hashString(`${seed}|${sponsorName}|${season}|${week}|${index}`).toString(36)}`;
  offers.push(normalizeSponsor({id:idValue,sponsorName,category,weeklyFeeAud:weekly,signingBonusAud:Math.round(weekly*(1.5+random()*3)/100)*100,durationWeeks:duration,exclusivity:random()<.16?'club':random()<.82?'category':'none',reputationFit:fit,objectives:[{id:`${idValue}-objective`,type:metricType,target,progress:baseline,rewardAud:Math.round(weekly*3/100)*100,penaltyAud:Math.round(weekly*1.5/100)*100}],bonuses:[{id:`${idValue}-bonus`,type:'commercial-reputation',target:Math.min(100,metrics.commercialReputation+8),rewardAud:Math.round(weekly*2/100)*100}]},index,season,week,'offer'));
 }
 return offers;
}

export function normalizeFootballOperations(input={},context={}){
 const outer=asObject(input),source=isObject(outer.footballOperations)?outer.footballOperations:isObject(outer.operations)?outer.operations:outer,ctx=asObject(context),season=integer(ctx.season??source.season??outer.season,MIN_SEASON,MAX_SEASON,2026),week=integer(ctx.week??source.week??outer.week,1,40,1),seed=text(ctx.seed??source.seed??outer.seed,120,'football-operations'),peopleSource=asObject(source.people),commercialSource=asObject(source.commercial),legacyStaff=asObject(ctx.legacyStaff||(!Array.isArray(outer.staff)?outer.staff:{}));
 const rawStaff=Array.isArray(peopleSource.staff)?peopleSource.staff:Array.isArray(source.staff)?source.staff:null,staff=(rawStaff?rawStaff.map((item,index)=>normalizeStaff(item,index,season,week)):defaultStaff(seed,season,week,legacyStaff)).slice(0,FOOTBALL_OPERATIONS_LIMITS.staff),rawCandidates=Array.isArray(peopleSource.candidates)?peopleSource.candidates:Array.isArray(source.candidates)?source.candidates:null,candidates=(rawCandidates?rawCandidates.map((item,index)=>normalizeStaff(item,index,season,week,'candidate')):defaultCandidates(seed,season,week)).slice(0,FOOTBALL_OPERATIONS_LIMITS.candidates),rawDelegations=asArray(peopleSource.delegations||source.delegations),delegationMap=new Map(rawDelegations.map(item=>[id(asObject(item).id,60,''),item])),delegations=RESPONSIBILITIES.map(item=>{const definition=RESPONSIBILITY_MAP.get(item[0]);return normalizeDelegation(delegationMap.get(definition.id),definition,staff)}),metrics=initialMetrics(commercialSource.metrics||source.metrics),rawOffers=Array.isArray(commercialSource.offers)?commercialSource.offers:Array.isArray(source.sponsorOffers)?source.sponsorOffers:null,offers=(rawOffers?rawOffers.map((item,index)=>normalizeSponsor(item,index,season,week,'offer')):generateSponsorOffers(seed,season,week,metrics)).slice(0,FOOTBALL_OPERATIONS_LIMITS.sponsorOffers),contracts=asArray(commercialSource.contracts||source.sponsorContracts).map((item,index)=>normalizeSponsor(item,index,season,week,'contract')).slice(0,FOOTBALL_OPERATIONS_LIMITS.sponsorContracts),weekly=asObject(commercialSource.lastWeekly);
 return {schemaVersion:FOOTBALL_OPERATIONS_SCHEMA_VERSION,seed,season,week,lastTickKey:text(source.lastTickKey,30,''),people:{staff,candidates,delegations},commercial:{offers,contracts,plan:normalizePlan(commercialSource.plan||source.commercialPlan),metrics,lastWeekly:{season:integer(weekly.season,MIN_SEASON,MAX_SEASON,season),week:integer(weekly.week,1,40,week),sponsorIncomeAud:money(weekly.sponsorIncomeAud,0),merchandiseIncomeAud:money(weekly.merchandiseIncomeAud,0),staffWagesAud:money(weekly.staffWagesAud,0),planSpendAud:money(weekly.planSpendAud,0),bonusesAud:money(weekly.bonusesAud,0),penaltiesAud:money(weekly.penaltiesAud,0),netAud:Math.round(clamp(weekly.netAud,-MAX_MONEY,MAX_MONEY,0))}},history:last(asArray(source.history).map((entry,index)=>({id:id(asObject(entry).id,80,`event-${index+1}`),type:id(asObject(entry).type,50,'update'),code:id(asObject(entry).code,60,''),season:integer(asObject(entry).season,MIN_SEASON,MAX_SEASON,season),week:integer(asObject(entry).week,1,40,week),message:text(asObject(entry).message,240,'Club update')})),FOOTBALL_OPERATIONS_LIMITS.history)};
}

export function createFootballOperations(options={}){return normalizeFootballOperations(options,options)}

function operation(state,event,ok=true,extra={}){
 const recorded={id:`event-${hashString(`${state.seed}|${state.season}|${state.week}|${state.history.length}|${event.code}`).toString(36)}`,type:id(event.type,50,'operations-update'),code:id(event.code,60,''),season:state.season,week:state.week,message:text(event.message,240,'Club update')};
 state.history=last([...state.history,recorded],FOOTBALL_OPERATIONS_LIMITS.history);
 return {ok,state,event:recorded,code:recorded.code,message:recorded.message,...extra};
}
function unchanged(state,code,message,extra={}){const event={id:`event-${hashString(`${state.seed}|${state.season}|${state.week}|${code}`).toString(36)}`,type:'operations-tick',code,season:state.season,week:state.week,message};return{ok:true,state,event,code,message,...extra}}
function failure(input,code,message,extra={}){return operation(normalizeFootballOperations(input),{type:'operations-error',code,message},false,extra)}

export function getPeopleView(input){
 const state=normalizeFootballOperations(input),active=state.people.staff.filter(item=>item.status==='active'),assigned=new Set(state.people.delegations.map(item=>item.assignedStaffId).filter(Boolean));
 return {staff:clone(active),candidates:clone(state.people.candidates.filter(item=>item.status==='candidate').sort((a,b)=>b.departmentEffect.quality-a.departmentEffect.quality)),delegations:state.people.delegations.map(item=>({...clone(item),assignedStaffName:active.find(staff=>staff.id===item.assignedStaffId)?.name||'Manager'})),weeklyPayrollAud:active.reduce((sum,item)=>sum+item.weeklyWageAud,0),vacantRoles:STAFF_ROLES.filter(([roleId])=>!active.some(item=>item.roleId===roleId)).map(([roleId,name])=>({roleId,name})),unassignedStaffIds:active.filter(item=>!assigned.has(item.id)).map(item=>item.id)};
}

export function getCommercialView(input){
 const state=normalizeFootballOperations(input),active=state.commercial.contracts.filter(item=>item.status==='active'),pending=state.commercial.offers.filter(item=>item.status==='pending');
 return {offers:clone(pending),contracts:clone(active),plan:clone(state.commercial.plan),metrics:clone(state.commercial.metrics),lastWeekly:clone(state.commercial.lastWeekly),weeklyContractedIncomeAud:active.reduce((sum,item)=>sum+item.weeklyFeeAud,0),weeklyPlanSpendAud:Object.values(state.commercial.plan).reduce((sum,item)=>sum+money(asObject(item).weeklyBudgetAud,0),0),exclusiveCategories:unique(active.filter(item=>item.exclusivity==='category').map(item=>item.category)),clubExclusive:active.some(item=>item.exclusivity==='club')};
}

export function hireStaffMember(input,candidateId,terms={}){
 const state=normalizeFootballOperations(input),target=id(candidateId,80,''),index=state.people.candidates.findIndex(item=>item.id===target&&item.status==='candidate');
 if(index<0)return failure(state,'candidate-unknown','That staff candidate is no longer available.');
 if(state.people.staff.filter(item=>item.status==='active').length>=FOOTBALL_OPERATIONS_LIMITS.staff)return failure(state,'staff-capacity','The club has reached its named-staff limit.');
 const candidate=state.people.candidates[index],source=asObject(terms),weeklyWageAud=money(source.weeklyWageAud,candidate.weeklyWageAud),minimum=Math.round(candidate.weeklyWageAud*.82);
 if(weeklyWageAud<minimum)return failure(state,'staff-offer-too-low',`${candidate.name} will not accept that wage.`,{minimumWeeklyWageAud:minimum});
 const durationWeeks=integer(source.durationWeeks,20,200,80),end=addWeeks(state.season,state.week,durationWeeks),member=normalizeStaff({...candidate,status:'active',weeklyWageAud,hiringFeeAud:0,trust:55,morale:78,contract:{startsSeason:state.season,startsWeek:state.week,expiresSeason:end.season,expiresWeek:end.week,releaseClauseAud:money(source.releaseClauseAud,0),renewalOption:bool(source.renewalOption)}},state.people.staff.length,state.season,state.week);
 if(state.people.staff.length>=FOOTBALL_OPERATIONS_LIMITS.staff)state.people.staff=state.people.staff.filter(item=>item.status==='active');
 state.people.staff=last([...state.people.staff,member],FOOTBALL_OPERATIONS_LIMITS.staff);state.people.candidates.splice(index,1);
 return operation(state,{type:'staff-hired',code:'staff-member-hired',message:`${member.name} joined as ${member.roleName}.`},true,{staff:clone(member),financeDeltaAud:-candidate.hiringFeeAud,weeklyWageDeltaAud:weeklyWageAud});
}

export function dismissStaffMember(input,staffId,options={}){
 const state=normalizeFootballOperations(input),target=id(staffId,80,''),member=state.people.staff.find(item=>item.id===target&&item.status==='active');
 if(!member)return failure(state,'staff-member-unknown','Choose an active staff member.');
 const remaining=Math.max(0,absoluteWeek(member.contract.expiresSeason,member.contract.expiresWeek)-absoluteWeek(state.season,state.week)),reason=text(asObject(options).reason,120,'Club restructuring'),severance=money(Math.min(12,remaining)*member.weeklyWageAud*.25,0);
 member.status='dismissed';member.morale=0;state.people.delegations=state.people.delegations.map(item=>item.assignedStaffId===target?{...item,managerControlled:true,assignedStaffId:'',quality:50,risk:22,trust:Math.max(0,item.trust-12),lastOutcome:'poor'}:item);
 return operation(state,{type:'staff-dismissed',code:'staff-member-dismissed',message:`${member.name} left the club: ${reason}.`},true,{staffId:target,severanceAud:severance,financeDeltaAud:-severance,weeklyWageDeltaAud:-member.weeklyWageAud});
}

export function renewStaffContract(input,staffId,terms={}){
 const state=normalizeFootballOperations(input),target=id(staffId,80,''),member=state.people.staff.find(item=>item.id===target&&item.status==='active');
 if(!member)return failure(state,'staff-member-unknown','Choose an active staff member.');
 const source=asObject(terms),weeklyWageAud=money(source.weeklyWageAud,member.weeklyWageAud),minimum=Math.round(member.weeklyWageAud*(.92+member.reputation/500));
 if(weeklyWageAud<minimum)return failure(state,'staff-renewal-too-low',`${member.name} rejected the renewal terms.`,{minimumWeeklyWageAud:minimum});
 const durationWeeks=integer(source.durationWeeks,20,200,80),end=addWeeks(state.season,state.week,durationWeeks),previousWage=member.weeklyWageAud;
 member.weeklyWageAud=weeklyWageAud;member.contract={startsSeason:state.season,startsWeek:state.week,expiresSeason:end.season,expiresWeek:end.week,releaseClauseAud:money(source.releaseClauseAud,member.contract.releaseClauseAud),renewalOption:bool(source.renewalOption,member.contract.renewalOption)};member.morale=integer(member.morale+6,0,100,member.morale);member.trust=integer(member.trust+4,0,100,member.trust);
 return operation(state,{type:'staff-renewed',code:'staff-contract-renewed',message:`${member.name} signed a new staff contract.`},true,{staff:clone(member),weeklyWageDeltaAud:weeklyWageAud-previousWage});
}

export function setDelegation(input,responsibilityId,staffId=''){
 const state=normalizeFootballOperations(input),definition=RESPONSIBILITY_MAP.get(id(responsibilityId,60,''));
 if(!definition)return failure(state,'responsibility-unknown','Choose a recognised club responsibility.');
 const target=id(staffId,80,''),member=target?state.people.staff.find(item=>item.id===target&&item.status==='active'):null;
 if(target&&!member)return failure(state,'staff-member-unknown','Choose an active staff member.');
 if(member&&!definition.roles.includes(member.roleId))return failure(state,'delegation-role-mismatch',`${member.name} is not qualified to own ${definition.name.toLowerCase()}.`,{compatibleRoleIds:[...definition.roles]});
 const scores=delegationScores(definition,member),delegation=state.people.delegations.find(item=>item.id===definition.id),previous=delegation?.assignedStaffId||'';
 Object.assign(delegation,{managerControlled:!member,assignedStaffId:member?.id||'',quality:scores.quality,risk:scores.risk,trust:member?.trust??50,lastOutcome:'none',lastUpdatedKey:`${state.season}:${state.week}`});
 return operation(state,{type:'delegation-changed',code:'delegation-changed',message:member?`${definition.name} was delegated to ${member.name}.`:`The manager took control of ${definition.name.toLowerCase()}.`},true,{responsibility:clone(delegation),previousStaffId:previous});
}

function sponsorConflict(contracts,offer){return contracts.some(contract=>contract.status==='active'&&(contract.exclusivity==='club'||offer.exclusivity==='club'||(contract.category===offer.category&&(contract.exclusivity==='category'||offer.exclusivity==='category'))))}

export function respondToSponsorOffer(input,offerId,response='reject'){
 const state=normalizeFootballOperations(input),target=id(offerId,80,''),offer=state.commercial.offers.find(item=>item.id===target&&item.status==='pending'),decision=enumValue(response,['accept','reject'],'reject');
 if(!offer)return failure(state,'sponsor-offer-unknown','That sponsor offer is no longer available.');
 if(decision==='reject'){offer.status='rejected';return operation(state,{type:'sponsor-response',code:'sponsor-offer-rejected',message:`${offer.sponsorName}'s offer was declined.`},true,{offerId:target,financeDeltaAud:0})}
 if(sponsorConflict(state.commercial.contracts,offer))return failure(state,'sponsor-exclusivity-conflict','An active sponsor contract conflicts with this offer.',{category:offer.category,exclusivity:offer.exclusivity});
 offer.status='accepted';const contract=normalizeSponsor({...offer,id:`contract-${offer.id}`,status:'active',weeksElapsed:0,weeksRemaining:offer.durationWeeks,totalEarnedAud:offer.signingBonusAud,createdSeason:state.season,createdWeek:state.week,expiresSeason:addWeeks(state.season,state.week,offer.durationWeeks).season,expiresWeek:addWeeks(state.season,state.week,offer.durationWeeks).week},state.commercial.contracts.length,state.season,state.week,'contract');state.commercial.contracts=last([...state.commercial.contracts.filter(item=>item.status==='active'),contract],FOOTBALL_OPERATIONS_LIMITS.sponsorContracts);state.commercial.metrics.lifetimeCommercialIncomeAud=money(state.commercial.metrics.lifetimeCommercialIncomeAud+offer.signingBonusAud);
 return operation(state,{type:'sponsor-response',code:'sponsor-offer-accepted',message:`${offer.sponsorName} became a club partner.`},true,{contract:clone(contract),financeDeltaAud:offer.signingBonusAud});
}

export function setCommercialPlan(input,patch={}){
 const state=normalizeFootballOperations(input),source=asObject(patch),merged={merchandise:{...state.commercial.plan.merchandise,...asObject(source.merchandise)},community:{...state.commercial.plan.community,...asObject(source.community)},digital:{...state.commercial.plan.digital,...asObject(source.digital)},tickets:{...state.commercial.plan.tickets,...asObject(source.tickets)}};state.commercial.plan=normalizePlan(merged);
 const weeklyPlanSpendAud=state.commercial.plan.merchandise.weeklyBudgetAud+state.commercial.plan.community.weeklyBudgetAud+state.commercial.plan.digital.weeklyBudgetAud;
 return operation(state,{type:'commercial-plan',code:'commercial-plan-updated',message:'The club commercial plan was updated.'},true,{plan:clone(state.commercial.plan),weeklyPlanSpendAud});
}

function metricValue(type,state,context){const metrics=state.commercial.metrics,external=asObject(context.metrics);if(type==='supporters')return integer(external.supporters,0,10_000_000,metrics.supporters);if(type==='community-reach')return integer(external.communityReach,0,100_000_000,metrics.communityReach);if(type==='digital-followers')return integer(external.digitalFollowers,0,100_000_000,metrics.digitalFollowers);if(type==='commercial-reputation')return integer(external.commercialReputation,0,100,metrics.commercialReputation);if(type==='average-attendance')return integer(external.averageAttendance,0,200_000,0);if(type==='wins')return integer(external.wins,0,1000,0);return integer(external.academyGraduates,0,1000,0)}

function processWeek(state,point,context){
 state.season=point.season;state.week=point.week;const key=`${point.season}:${point.week}`,plan=state.commercial.plan,metrics=state.commercial.metrics,random=seededRandom(`${state.seed}|commercial|${key}`),commercialDelegation=state.people.delegations.find(item=>item.id==='sponsor-negotiation'),communityDelegation=state.people.delegations.find(item=>item.id==='community-programme'),ticketDelegation=state.people.delegations.find(item=>item.id==='ticket-strategy'),commercialQuality=(commercialDelegation?.quality||50),communityQuality=(communityDelegation?.quality||50),ticketQuality=(ticketDelegation?.quality||50),staffWagesAud=state.people.staff.filter(item=>item.status==='active').reduce((sum,item)=>sum+item.weeklyWageAud,0),planSpendAud=plan.merchandise.weeklyBudgetAud+plan.community.weeklyBudgetAud+plan.digital.weeklyBudgetAud;
 const digitalMultiplier={"low-key":.55,"steady":1,"matchday":1.18,"always-on":1.42}[plan.digital.strategy],communityMultiplier={schools:1.15,grassroots:1.05,charity:1.1,"open-club":1}[plan.community.strategy],ticketMultiplier={accessible:1.2,balanced:1,yield:.72,"membership-first":1.08}[plan.tickets.strategy],digitalGrowth=Math.max(0,Math.round((5+Math.sqrt(plan.digital.weeklyBudgetAud)*.6+plan.digital.contentCadence*2+digitalMultiplier*8)*(0.65+commercialQuality/150)*(0.88+random()*.24))),communityGrowth=Math.max(0,Math.round((4+Math.sqrt(plan.community.weeklyBudgetAud)*.48+communityMultiplier*10)*(0.65+communityQuality/150)*(0.88+random()*.24))),supporterGrowth=Math.round((digitalGrowth*.055+communityGrowth*.085+(metrics.commercialReputation-35)*.035+ticketMultiplier*1.5+(integer(asObject(context).leaguePosition,1,100,8)<=4?1.5:0))*(.85+random()*.3));
 metrics.digitalFollowers=integer(metrics.digitalFollowers+digitalGrowth,0,100_000_000,metrics.digitalFollowers);metrics.communityReach=integer(metrics.communityReach+communityGrowth,0,100_000_000,metrics.communityReach);metrics.supporters=integer(metrics.supporters+supporterGrowth,50,10_000_000,metrics.supporters);metrics.lastSupporterGrowth=supporterGrowth;
 const priceMultiplier={value:.76,balanced:1,premium:1.28,"limited-drops":1.42}[plan.merchandise.strategy],demandMultiplier={value:1.2,balanced:1,premium:.77,"limited-drops":.62}[plan.merchandise.strategy],merchandiseIncomeAud=money((metrics.supporters*.13+metrics.digitalFollowers*.012+plan.merchandise.weeklyBudgetAud*.62)*(0.75+metrics.commercialReputation/140)*priceMultiplier*demandMultiplier*(.9+random()*.2));metrics.merchandiseIncomeAud=money(metrics.merchandiseIncomeAud+merchandiseIncomeAud);
 let sponsorIncomeAud=0,bonusesAud=0,penaltiesAud=0;
 for(const contract of state.commercial.contracts){
  if(contract.status!=='active')continue;sponsorIncomeAud+=contract.weeklyFeeAud;contract.totalEarnedAud=money(contract.totalEarnedAud+contract.weeklyFeeAud);contract.weeksElapsed=Math.min(contract.durationWeeks,contract.weeksElapsed+1);contract.weeksRemaining=Math.max(0,contract.durationWeeks-contract.weeksElapsed);
  for(const objective of contract.objectives){objective.progress=metricValue(objective.type,state,context);if(objective.status==='active'&&objective.progress>=objective.target){objective.status='met';if(!objective.paid){objective.paid=true;bonusesAud+=objective.rewardAud;contract.totalEarnedAud=money(contract.totalEarnedAud+objective.rewardAud)}}}
  for(const bonus of contract.bonuses)if(!bonus.earned&&metricValue(bonus.type,state,context)>=bonus.target){bonus.earned=true;bonusesAud+=bonus.rewardAud;contract.totalEarnedAud=money(contract.totalEarnedAud+bonus.rewardAud)}
  if(contract.weeksRemaining===0){for(const objective of contract.objectives)if(objective.status==='active'){objective.status='missed';penaltiesAud+=objective.penaltyAud}contract.status='completed'}
 }
 const repDelta=clamp(supporterGrowth/Math.max(250,metrics.supporters)*25+communityGrowth/600+commercialQuality/300+(penaltiesAud?-.8:0),-2,2,.1);metrics.commercialReputation=integer(metrics.commercialReputation+repDelta,0,100,metrics.commercialReputation);const gross=sponsorIncomeAud+merchandiseIncomeAud+bonusesAud,netAud=gross-staffWagesAud-planSpendAud-penaltiesAud;metrics.lifetimeCommercialIncomeAud=money(metrics.lifetimeCommercialIncomeAud+gross);
 state.commercial.lastWeekly={season:point.season,week:point.week,sponsorIncomeAud,merchandiseIncomeAud,staffWagesAud,planSpendAud,bonusesAud,penaltiesAud,netAud};
 for(const delegation of state.people.delegations){if(delegation.managerControlled)continue;const roll=seededRandom(`${state.seed}|delegation|${key}|${delegation.id}`)()*100,outcome=roll<delegation.risk*.18?'poor':roll<delegation.risk?'mixed':roll>94?'excellent':'good',trustDelta=outcome==='excellent'?3:outcome==='good'?1:outcome==='mixed'?-1:-4,member=state.people.staff.find(item=>item.id===delegation.assignedStaffId&&item.status==='active');delegation.lastOutcome=outcome;delegation.trust=integer(delegation.trust+trustDelta,0,100,delegation.trust);delegation.lastUpdatedKey=key;if(member){member.trust=integer(member.trust+trustDelta,0,100,member.trust);const scores=delegationScores(RESPONSIBILITY_MAP.get(delegation.id),member);delegation.quality=scores.quality;delegation.risk=scores.risk}}
 for(const member of state.people.staff)if(member.status==='active'&&absoluteWeek(member.contract.expiresSeason,member.contract.expiresWeek)<=absoluteWeek(point.season,point.week))member.status='expired';
 const activeIds=new Set(state.people.staff.filter(item=>item.status==='active').map(item=>item.id));state.people.delegations=state.people.delegations.map(item=>item.assignedStaffId&&!activeIds.has(item.assignedStaffId)?{...item,managerControlled:true,assignedStaffId:'',quality:50,risk:22,trust:Math.max(0,item.trust-8),lastOutcome:'poor'}:item);
 for(const offer of state.commercial.offers)if(offer.status==='pending'&&absoluteWeek(offer.expiresSeason,offer.expiresWeek)<=absoluteWeek(point.season,point.week))offer.status='expired';
 if(point.week%8===1&&state.commercial.offers.filter(item=>item.status==='pending').length<2)state.commercial.offers=last([...state.commercial.offers,...generateSponsorOffers(state.seed,point.season,point.week,metrics,3,`refresh-${key}`)],FOOTBALL_OPERATIONS_LIMITS.sponsorOffers);
 if(point.week%6===1){const existing=new Set(state.people.candidates.filter(item=>item.status==='candidate').map(item=>item.roleId));const fresh=STAFF_ROLES.filter(([roleId])=>!existing.has(roleId)).slice(0,4).map(([roleId],index)=>generatedPerson(`${state.seed}|refresh`,point.season,point.week,index,roleId));state.people.candidates=last([...state.people.candidates.filter(item=>item.status==='candidate'),...fresh],FOOTBALL_OPERATIONS_LIMITS.candidates)}
 state.lastTickKey=key;return netAud;
}

export function tickFootballOperations(input,context={}){
 const state=normalizeFootballOperations(input),source=asObject(context),target=source.season!==undefined||source.week!==undefined?{season:integer(source.season,MIN_SEASON,MAX_SEASON,state.season),week:integer(source.week,1,40,state.week)}:addWeeks(state.season,state.week,1),start=absoluteWeek(state.season,state.week),end=absoluteWeek(target.season,target.week);
 if(end<start)return unchanged(state,'operations-already-current','Football operations are already current.',{financeDeltaAud:0,weeksProcessed:0,weekly:clone(state.commercial.lastWeekly)});
 if(end===start){
  const targetKey=`${target.season}:${target.week}`;
  if(state.lastTickKey===targetKey)return unchanged(state,'operations-already-current','Football operations are already current.',{financeDeltaAud:0,weeksProcessed:0,weekly:clone(state.commercial.lastWeekly)});
  const financeDeltaAud=processWeek(state,target,source);
  return operation(state,{type:'operations-tick',code:'football-operations-ticked',message:'Football operations settled the current week.'},true,{financeDeltaAud,weeksProcessed:1,weekly:clone(state.commercial.lastWeekly)});
 }
 let financeDeltaAud=0;const steps=Math.min(120,end-start);for(let offset=1;offset<=steps;offset+=1)financeDeltaAud+=processWeek(state,weekFromAbsolute(start+offset),source);if(end-start>steps){state.season=target.season;state.week=target.week;state.lastTickKey=`${target.season}:${target.week}`}
 return operation(state,{type:'operations-tick',code:'football-operations-ticked',message:`Football operations advanced ${end-start} week${end-start===1?'':'s'}.`},true,{financeDeltaAud,weeksProcessed:steps,weekly:clone(state.commercial.lastWeekly)});
}

export const hireStaff=hireStaffMember;
export const dismissStaff=dismissStaffMember;
export const renewStaff=renewStaffContract;
export const tickWeekly=tickFootballOperations;
