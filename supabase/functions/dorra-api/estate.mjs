import {
  normalizeEstate, purchaseEstateVenue, upgradeEstateVenue, hireEstateManager,
  startEstateCycle, accrueEstate, claimEstateIncome, claimEstateGoal, trainEstateManager, hireEstateSpecialist
} from './shared/estate-engine.js';
import {MAX_BALANCE} from './shared/game-limits.js';

export const ESTATE_CLOUD_ACTIONS = new Set([
  'estate-clicker-open','estate-clicker-serve','estate-clicker-tick','estate-clicker-upgrade',
  'estate-clicker-manager','estate-clicker-train','estate-clicker-specialist','estate-clicker-claim','estate-clicker-goal'
]);
const demand = (condition, message, code='INVALID_ACTION') => {
  if (!condition) throw Object.assign(new Error(message), {code,status:400});
};
function argumentsFor(action,args) {
  demand(args && typeof args === 'object' && !Array.isArray(args), 'Use estate action arguments.');
  const field=['estate-clicker-claim','estate-clicker-tick'].includes(action)?null:action==='estate-clicker-goal'?'goalId':'venueId';
  demand(Object.keys(args).every(key => key === field || (action==='estate-clicker-upgrade'&&key==='quantity') || (action==='estate-clicker-specialist'&&key==='role')), 'Estate amounts and outcomes are calculated by the House.');
  if(action==='estate-clicker-specialist')demand(['revenue','operations'].includes(args.role),'Choose a valid specialist.');
  if(action==='estate-clicker-upgrade'&&args.quantity!==undefined)demand([1,10,100].includes(args.quantity),'Choose a supported upgrade quantity.');
  if (field) demand(typeof args[field] === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(args[field]), 'Choose a valid estate ' + (field==='goalId'?'milestone.':'venue.'));
}

/** Only bounded player intentions reach these rules. Wallet amounts and the
 * timestamp always come from the saved server snapshot and server clock. */
export function reduceEstateClicker(snapshot, privateState, action, args={}, now=Date.now()) {
  if (!ESTATE_CLOUD_ACTIONS.has(action)) return null;
  argumentsFor(action,args);
  demand(Number.isSafeInteger(snapshot.balance) && snapshot.balance>=0 && snapshot.balance<=MAX_BALANCE,'The account balance is invalid.');
  normalizeEstate(snapshot.progress,now);
  const p=snapshot.progress;
  let result;
  if(action==='estate-clicker-open') result=purchaseEstateVenue(p,args.venueId,snapshot.balance,now);
  else if(action==='estate-clicker-upgrade') {let remaining=snapshot.balance,cost=0;for(let i=0;i<(args.quantity||1);i++){const next=upgradeEstateVenue(p,args.venueId,remaining,now);demand(next.ok,next.reason);remaining-=next.cost;cost+=next.cost;result=next;}result={...result,cost,quantity:args.quantity||1};}
  else if(action==='estate-clicker-manager') result=hireEstateManager(p,args.venueId,snapshot.balance,now);
  else if(action==='estate-clicker-train') result=trainEstateManager(p,args.venueId,snapshot.balance,now);
  else if(action==='estate-clicker-specialist') result=hireEstateSpecialist(p,args.venueId,args.role,snapshot.balance,now);
  else if(action==='estate-clicker-serve') result=startEstateCycle(p,args.venueId,now);
  else if(action==='estate-clicker-tick'){accrueEstate(p,now);const amount=Math.min(Math.floor(p.empire.pending),MAX_BALANCE-snapshot.balance);p.empire.pending-=amount;p.empire.lifetimeEarned=Math.min(Number.MAX_SAFE_INTEGER,p.empire.lifetimeEarned+amount);p.empire.clicker.bankMs=0;p.empire.unclaimedMs=0;result={ok:true,amount};}
  else if(action==='estate-clicker-claim') result=claimEstateIncome(p,now);
  else result=claimEstateGoal(p,args.goalId,now);
  demand(result.ok,result.reason || 'This estate action is not available.');
  const cost=result.cost || 0, amount=result.amount || 0;
  demand(Number.isSafeInteger(cost) && cost>=0 && Number.isSafeInteger(amount) && amount>=0,'Invalid estate settlement.');
  demand(snapshot.balance>=cost,'More account capital is needed.');
  demand(amount<=MAX_BALANCE-(snapshot.balance-cost),'Your account balance has reached its limit.','WALLET_LIMIT');
  snapshot.balance=snapshot.balance-cost+amount;
  const labels={
    'estate-clicker-open':'Venue opened.', 'estate-clicker-upgrade':'Venue upgraded.',
    'estate-clicker-manager':'Your manager is on duty.', 'estate-clicker-serve':result.vip?'VIP service started.':'Business cycle started.',
    'estate-clicker-train':'Director training completed.', 'estate-clicker-specialist':'Your specialist is on duty.',
    'estate-clicker-tick':'Business income received.', 'estate-clicker-claim':'Business income collected.', 'estate-clicker-goal':'Milestone reward collected.'
  };
  result={...result,message:labels[action]};
  // Taps already have bounded counters; recording every tap would crowd out
  // the meaningful investments in the existing House ledger.
  if(!['estate-clicker-serve','estate-clicker-tick'].includes(action)) {
    const office=p.office=p.office && typeof p.office==='object' && !Array.isArray(p.office)?p.office:{};
    office.transactions=Array.isArray(office.transactions)?office.transactions:[];
    office.transactions.unshift({type:cost?'estate':'income',label:result.message,amount:cost?-cost:amount,at:now});
    office.transactions=office.transactions.slice(0,40);
  }
  return {snapshot,privateState,result};
}
