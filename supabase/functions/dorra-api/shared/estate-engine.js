// Shared, DOM-free Dorra Estate rules. Wallet changes belong to the caller so
// the same commands can run in the local vault and the authoritative cloud API.
export const ESTATE_SCHEMA_VERSION = 1;
export const ESTATE_TAP_INTERVAL_MS = 300;
export const ESTATE_RUSH_EVERY = 10;
export const ESTATE_VIP_EVERY = 25;
export const ESTATE_RUSH_MS = 8_000;

export const ESTATE_MANAGERS = {
  terrace: {name:'Amara Bell', title:'Hospitality Director', cost:1_200},
  valet: {name:'Leo Navarro', title:'Arrival Director', cost:4_800},
  boutique: {name:'Sabine Laurent', title:'Gallery Curator', cost:22_000},
  skyline: {name:'Noah Mercer', title:'Nightlife Director', cost:80_000},
  grandprix: {name:'Sofia Renaud', title:'Paddock Director', cost:280_000},
  hotel: {name:'Helena Ward', title:'Hotel Director', cost:950_000}
};

export const ESTATE_VENUES = [
  {id:'terrace', name:'The Terrace Cafe', area:'East Arcade', icon:'☕', stars:0,
    copy:'Good coffee. Familiar faces. Your first little corner of Dorra.', action:'Serve coffee', customer:'Coffee order',
    costs:[250,900,2_200,5_600,14_000], payouts:[12,18,30,50,85], cycleMs:5_000,
    levels:['Soft Opening','Breakfast Service','Evening Menu','Chef’s Table','House Institution']},
  {id:'valet', name:'Grand Valet', area:'Motor Atrium', icon:'◇', stars:2,
    copy:'Park the cars, welcome the guests, and keep the arrivals moving.', action:'Park a car', customer:'Arriving driver',
    costs:[3_500,6_500,13_000,26_000,52_000], payouts:[40,60,100,165,270], cycleMs:8_000,
    levels:['Two Bays','Covered Arrival','Detailing Studio','Concierge Fleet','Ceremonial Arrival']},
  {id:'boutique', name:'Gilded Boutique', area:'Gallery Walk', icon:'◆', stars:5,
    copy:'Find the perfect piece for Dorra’s collectors and private clients.', action:'Wrap a purchase', customer:'Boutique shopper',
    costs:[18_000,32_000,60_000,110_000,200_000], payouts:[160,250,400,650,1_050], cycleMs:12_000,
    levels:['Curated Cabinet','Private Fittings','Design Salon','Collector’s Gallery','House Atelier']},
  {id:'skyline', name:'Skyline Club', area:'Rooftop', icon:'✦', stars:8,
    copy:'A city view, a perfect drink, and a rooftop full of possibility.', action:'Mix a drink', customer:'Rooftop guest',
    costs:[65_000,110_000,190_000,330_000,570_000], payouts:[600,900,1_450,2_400,3_900], cycleMs:16_000,
    levels:['Sunset Lounge','Live Quartet','Private Booths','Midnight Salon','Skyline Institution']},
  {id:'grandprix', name:'Grand Prix Club', area:'Dorra Downs', icon:'♞', stars:13,
    copy:'Welcome the drivers and turn the paddock into the place to be.', action:'Welcome a driver', customer:'Paddock member',
    costs:[240_000,420_000,720_000,1_250_000,2_200_000], payouts:[2_100,3_300,5_300,8_700,14_200], cycleMs:22_000,
    levels:['Members’ Paddock','Drivers’ Lounge','Heritage Garage','Track Pavilion','Grand Prix Weekend']},
  {id:'hotel', name:'Dorra Royal Hotel', area:'North Wing', icon:'♛', stars:18,
    copy:'Check in your guests and bring the crown of the estate to life.', action:'Check in a guest', customer:'Hotel arrival',
    costs:[850_000,1_450_000,2_500_000,4_300_000,7_400_000], payouts:[7_200,11_300,18_200,30_000,49_000], cycleMs:30_000,
    levels:['North Wing','Butler Floor','Royal Suites','Grand Ballroom','Dorra Royal']}
].map(venue => ({...venue, managerCost:ESTATE_MANAGERS[venue.id].cost}));

const MAX_NUMBER = Number.MAX_SAFE_INTEGER;
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, maximum=MAX_NUMBER) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(maximum, number)) : 0;
};
const integer = (value, maximum=MAX_NUMBER) => Math.floor(bounded(value, maximum));
const timestamp = value => Number.isFinite(Number(value)) && Number(value)>=0 ? integer(value) : Date.now();
const stars = progress => ESTATE_VENUES.reduce((total,venue)=>total+progress.empire.venues[venue.id].level,0);
const capMs = progress => ((progress.empire.venues.hotel?.level||0)>=3 ? 10 : 8)*3_600_000;
const venueById = id => ESTATE_VENUES.find(venue=>venue.id===id);
const fail = reason => ({ok:false, reason, amount:0, cost:0});

const GOALS = [
  {id:'first-service', name:'Your first customer', copy:'Serve one customer yourself.', target:1, amount:75, metric:'served'},
  {id:'regulars', name:'A familiar face', copy:'Serve 25 customers yourself.', target:25, amount:250, metric:'served'},
  {id:'first-manager', name:'A helping hand', copy:'Hire your first venue manager.', target:1, amount:350, metric:'managed'},
  {id:'second-venue', name:'Room to grow', copy:'Open two Dorra venues.', target:2, amount:750, metric:'owned'},
  {id:'hundred-services', name:'The personal touch', copy:'Serve 100 customers yourself.', target:100, amount:1_000, metric:'served'},
  {id:'management-team', name:'In good hands', copy:'Hire managers for three venues.', target:3, amount:5_000, metric:'managed'},
  {id:'estate-complete', name:'The whole House', copy:'Open all six Dorra venues.', target:6, amount:25_000, metric:'owned'},
  {id:'thirty-stars', name:'A Dorra institution', copy:'Reach Level 5 in all six venues.', target:30, amount:50_000, metric:'stars'}
];

/** Preserve the old estate and add a separate, versioned clicker save. */
export function normalizeEstate(progress, now=Date.now()) {
  if (!isObject(progress)) throw new TypeError('Dorra Estate requires a progression object.');
  now=timestamp(now);
  const empire=progress.empire=isObject(progress.empire)?progress.empire:{};
  empire.venues=isObject(empire.venues)?empire.venues:{};
  empire.pending=bounded(empire.pending);
  empire.lifetimeEarned=integer(empire.lifetimeEarned);
  for (const venue of ESTATE_VENUES) {
    const entry=empire.venues[venue.id]=isObject(empire.venues[venue.id])?empire.venues[venue.id]:{};
    entry.level=integer(entry.level,5);
    entry.manager=entry.level>0 && !!entry.manager;
    entry.focus=['balanced','yield','service','prestige'].includes(entry.focus)?entry.focus:'balanced';
    entry.purchasedAt=integer(entry.purchasedAt);
    // Existing staff, property projects, specialisations, and unrelated save
    // fields deliberately stay on the original entry, with their investment.
  }
  const migrated=!isObject(empire.clicker);
  const clicker=empire.clicker=isObject(empire.clicker)?empire.clicker:{};
  clicker.schemaVersion=ESTATE_SCHEMA_VERSION;
  clicker.migratedAt=migrated?now:integer(clicker.migratedAt);
  clicker.lastAccruedAt=migrated?now:timestamp(clicker.lastAccruedAt??now);
  clicker.lastManualAt=integer(clicker.lastManualAt);
  clicker.hasManualTap=!!clicker.hasManualTap;
  clicker.bankMs=bounded(migrated?empire.unclaimedMs:clicker.bankMs,capMs(progress));
  clicker.served=integer(clicker.served);
  clicker.manualEarned=bounded(clicker.manualEarned);
  clicker.automatedEarned=bounded(clicker.automatedEarned);
  clicker.legacyLifetime=migrated?empire.lifetimeEarned:bounded(clicker.legacyLifetime);
  clicker.claimedGoals=[...new Set((Array.isArray(clicker.claimedGoals)?clicker.claimedGoals:[]).filter(id=>GOALS.some(goal=>goal.id===id)))];
  clicker.venues=isObject(clicker.venues)?clicker.venues:{};
  for (const venue of ESTATE_VENUES) {
    const activity=clicker.venues[venue.id]=isObject(clicker.venues[venue.id])?clicker.venues[venue.id]:{};
    activity.served=integer(activity.served);
    activity.customers=integer(activity.customers);
    activity.cycleElapsedMs=bounded(activity.cycleElapsedMs,venue.cycleMs-1);
    activity.rushUntil=integer(activity.rushUntil);
  }
  empire.lastAccruedAt=clicker.lastAccruedAt;
  empire.unclaimedMs=clicker.bankMs;
  return progress;
}

function incomeMultiplier(progress, venue) {
  const entry=progress.empire.venues[venue.id];
  const focus=entry.focus==='yield'?1.15:entry.focus==='service'?.92:entry.focus==='prestige'?.95:1;
  const projects=['capacity','experience','efficiency'].reduce((sum,id)=>sum+integer(entry.improvements?.[id],3),0);
  const headquarters=['intelligence','procurement','academy','loyalty','private-desk','destination','collector-relations','energy']
    .reduce((sum,id)=>sum+integer(progress.empire.headquarters?.[id],3),0);
  return focus*(1+projects*.025+headquarters*.01+(typeof entry.specialization==='string'&&entry.specialization.length ? .05 : 0));
}

function values(progress, venue) {
  const entry=progress.empire.venues[venue.id];
  const payout=entry.level?Math.max(1,Math.round(venue.payouts[entry.level-1]*incomeMultiplier(progress,venue))):0;
  // Stable cycle lengths mean upgrading cannot reprice an unfinished cycle.
  return {payout, cycleMs:venue.cycleMs, autoPerMinute:entry.manager?payout/venue.cycleMs*60_000:0};
}

/** A rate lookup never settles income or changes the caller's clock. */
export function estateAutoPerMinute(progress) {
  const view={empire:structuredClone(progress.empire||{})};
  normalizeEstate(view,view.empire.clicker?.lastAccruedAt||0);
  return ESTATE_VENUES.reduce((sum,venue)=>sum+values(view,venue).autoPerMinute,0);
}

/** Bank only managed income; elapsed fractions survive snapshots and claims. */
export function accrueEstate(progress, now=Date.now()) {
  normalizeEstate(progress,now);
  now=timestamp(now);
  const empire=progress.empire, clicker=empire.clicker;
  if (now<=clicker.lastAccruedAt) return Math.floor(empire.pending);
  const managers=ESTATE_VENUES.filter(venue=>empire.venues[venue.id].manager);
  const elapsed=managers.length?Math.min(now-clicker.lastAccruedAt,Math.max(0,capMs(progress)-clicker.bankMs)):0;
  let earned=0;
  for (const venue of managers) {
    const {payout,cycleMs}=values(progress,venue), activity=clicker.venues[venue.id];
    earned+=elapsed/cycleMs*payout;
    const phase=activity.cycleElapsedMs+elapsed;
    activity.customers=integer(activity.customers+Math.floor(phase/cycleMs));
    activity.cycleElapsedMs=phase%cycleMs;
  }
  empire.pending=bounded(empire.pending+earned);
  clicker.automatedEarned=bounded(clicker.automatedEarned+earned);
  clicker.bankMs+=elapsed;
  // A high water mark prevents backwards clocks from accruing the same period.
  clicker.lastAccruedAt=now;
  empire.lastAccruedAt=now;
  empire.unclaimedMs=clicker.bankMs;
  return Math.floor(empire.pending);
}

export function estateGoals(progress) {
  normalizeEstate(progress);
  const empire=progress.empire, clicker=empire.clicker;
  const metrics={served:clicker.served,managed:ESTATE_VENUES.filter(venue=>empire.venues[venue.id].manager).length,
    owned:ESTATE_VENUES.filter(venue=>empire.venues[venue.id].level>0).length,stars:stars(progress)};
  return GOALS.map(goal=>({...goal,reward:goal.amount,value:metrics[goal.metric],progress:Math.min(1,metrics[goal.metric]/goal.target),
    complete:metrics[goal.metric]>=goal.target,claimed:clicker.claimedGoals.includes(goal.id)}));
}

export function estateSnapshot(progress, now=Date.now()) {
  now=timestamp(now);
  const claimable=accrueEstate(progress,now), empire=progress.empire, clicker=empire.clicker, estateStars=stars(progress);
  const venues=ESTATE_VENUES.map(venue=>{
    const entry=empire.venues[venue.id], activity=clicker.venues[venue.id], stats=values(progress,venue), manager=ESTATE_MANAGERS[venue.id];
    const owned=entry.level>0, unlocked=owned||estateStars>=venue.stars;
    const rushRemainingMs=owned?Math.max(0,activity.rushUntil-now):0;
    return {...venue,level:entry.level,manager:entry.manager,managerName:manager.name,managerTitle:manager.title,owned,unlocked,
      requirements:venue.stars?[{label:`Earn ${venue.stars} estate stars`,met:estateStars>=venue.stars}]:[],
      openCost:venue.costs[0],upgradeCost:entry.level<5?venue.costs[entry.level]:0,managerCost:manager.cost,canHire:entry.level>=2&&!entry.manager,
      baseTapValue:stats.payout,tapValue:Math.round(stats.payout*(rushRemainingMs>0?1.5:1)),cycleMs:stats.cycleMs,autoPerMinute:stats.autoPerMinute,
      cycleProgress:entry.manager?activity.cycleElapsedMs/stats.cycleMs:0,customers:activity.customers,served:activity.served,
      vipIn:ESTATE_VIP_EVERY-activity.served%ESTATE_VIP_EVERY,rushRemainingMs,rushEvery:ESTATE_RUSH_EVERY,vipEvery:ESTATE_VIP_EVERY,
      status:owned?(entry.manager?'automated':'manual'):(unlocked?'available':'locked')};
  });
  const goals=estateGoals(progress), bankHours=clicker.bankMs/3_600_000, hours=capMs(progress)/3_600_000;
  return {venues,claimable,pending:empire.pending,autoPerMinute:venues.reduce((sum,venue)=>sum+venue.autoPerMinute,0),capHours:hours,
    bankHours,bankPercent:Math.min(100,bankHours/hours*100),stars:estateStars,ownedCount:venues.filter(venue=>venue.owned).length,
    managedCount:venues.filter(venue=>venue.manager).length,totalServed:clicker.served,
    totalEarned:clicker.legacyLifetime+clicker.manualEarned+clicker.automatedEarned,goals,nextGoal:goals.find(goal=>!goal.claimed)||null};
}

export function serveEstateCustomer(progress, venueId, now=Date.now()) {
  normalizeEstate(progress,now);
  now=timestamp(now);
  const venue=venueById(venueId), empire=progress.empire, clicker=empire.clicker;
  if (!venue||!empire.venues[venue.id].level) return fail('Open this venue before serving customers.');
  if (now<clicker.lastAccruedAt) return fail('Service will resume when your clock catches up.');
  if (clicker.hasManualTap&&now-clicker.lastManualAt<ESTATE_TAP_INTERVAL_MS) return {...fail('The next customer is arriving.'),retryAfterMs:ESTATE_TAP_INTERVAL_MS-(now-clicker.lastManualAt)};
  accrueEstate(progress,now);
  const activity=clicker.venues[venue.id], vip=(activity.served+1)%ESTATE_VIP_EVERY===0;
  const rushing=activity.rushUntil>now, rush=(activity.served+1)%ESTATE_RUSH_EVERY===0;
  const amount=Math.round(values(progress,venue).payout*(rushing?1.5:1)*(vip?3:1));
  activity.served++;
  activity.customers++;
  clicker.served++;
  clicker.manualEarned=bounded(clicker.manualEarned+amount);
  empire.lifetimeEarned=integer(empire.lifetimeEarned+amount);
  clicker.lastManualAt=now;
  clicker.hasManualTap=true;
  if (rush) activity.rushUntil=now+ESTATE_RUSH_MS;
  return {ok:true,amount,venue:venue.id,vip,rush,rushing,rushUntil:activity.rushUntil,served:activity.served,
    vipIn:ESTATE_VIP_EVERY-activity.served%ESTATE_VIP_EVERY};
}

function purchase(progress, venueId, balance, now, type) {
  normalizeEstate(progress,now);
  const venue=venueById(venueId);
  if (!venue) return fail('This venue is unavailable.');
  const entry=progress.empire.venues[venue.id];
  if (!Number.isSafeInteger(balance)||balance<0) return fail('Your available capital is invalid.');
  let cost;
  if (type==='open') {
    if (entry.level) return fail('This venue is already open.');
    if (stars(progress)<venue.stars) return fail(`Earn ${venue.stars} estate stars to open this venue.`);
    cost=venue.costs[0];
  } else if (type==='upgrade') {
    if (!entry.level) return fail('Open this venue before upgrading it.');
    if (entry.level>=5) return fail('This venue is fully upgraded.');
    cost=venue.costs[entry.level];
  } else {
    if (entry.level<2) return fail('Reach Level 2 to hire this manager.');
    if (entry.manager) return fail('This manager is already on duty.');
    cost=ESTATE_MANAGERS[venue.id].cost;
  }
  if (balance<cost) return {...fail('More capital is needed.'),cost,shortfall:cost-balance};
  // Settle earned money at the OLD payout before changing levels or automation.
  accrueEstate(progress,now);
  if (type==='manager') entry.manager=true;
  else {
    entry.level++;
    if (type==='open') entry.purchasedAt=timestamp(now);
  }
  return {ok:true,cost,venue:venue.id,level:entry.level,manager:entry.manager};
}

export const purchaseEstateVenue = (progress,venueId,balance,now=Date.now()) => purchase(progress,venueId,balance,now,'open');
export const upgradeEstateVenue = (progress,venueId,balance,now=Date.now()) => purchase(progress,venueId,balance,now,'upgrade');
export const hireEstateManager = (progress,venueId,balance,now=Date.now()) => purchase(progress,venueId,balance,now,'manager');

export function claimEstateIncome(progress, now=Date.now()) {
  const amount=accrueEstate(progress,now);
  if (amount<1) return fail('Your managers are still earning.');
  const empire=progress.empire;
  empire.pending-=amount;
  empire.lifetimeEarned=integer(empire.lifetimeEarned+amount);
  empire.lastClaimAt=timestamp(now);
  empire.clicker.bankMs=0;
  empire.unclaimedMs=0;
  return {ok:true,amount};
}

export function claimEstateGoal(progress, goalId, now=Date.now()) {
  normalizeEstate(progress,now);
  const goal=estateGoals(progress).find(item=>item.id===goalId);
  if (!goal) return fail('This milestone is unavailable.');
  if (goal.claimed) return fail('This milestone has already been claimed.');
  if (!goal.complete) return fail('Complete this milestone first.');
  progress.empire.clicker.claimedGoals.push(goal.id);
  return {ok:true,amount:goal.amount,reward:goal.amount,goal};
}
