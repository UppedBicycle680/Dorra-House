import {
  normalizeEstate, purchaseEstateVenue, upgradeEstateVenue, hireEstateManager,
  serveEstateCustomer, claimEstateIncome, claimEstateGoal
} from './shared/estate-engine.js';
import {MAX_BALANCE} from './shared/game-limits.js';

export const ESTATE_CLOUD_ACTIONS = new Set([
  'estate-clicker-open','estate-clicker-serve','estate-clicker-upgrade',
  'estate-clicker-manager','estate-clicker-claim','estate-clicker-goal'
]);
const demand = (condition, message, code='INVALID_ACTION') => {
  if (!condition) throw Object.assign(new Error(message), {code,status:400});
};
function argumentsFor(action,args) {
  demand(args && typeof args === 'object' && !Array.isArray(args), 'Use estate action arguments.');
  const field=action==='estate-clicker-claim'?null:action==='estate-clicker-goal'?'goalId':'venueId';
  demand(Object.keys(args).every(key => key === field), 'Estate amounts and outcomes are calculated by the House.');
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
  else if(action==='estate-clicker-upgrade') result=upgradeEstateVenue(p,args.venueId,snapshot.balance,now);
  else if(action==='estate-clicker-manager') result=hireEstateManager(p,args.venueId,snapshot.balance,now);
  else if(action==='estate-clicker-serve') result=serveEstateCustomer(p,args.venueId,now);
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
    'estate-clicker-manager':'Your manager is on duty.', 'estate-clicker-serve':result.vip?'VIP served.':'Customer served.',
    'estate-clicker-claim':'Manager income collected.', 'estate-clicker-goal':'Milestone reward collected.'
  };
  result={...result,message:labels[action]};
  // Taps already have bounded counters; recording every tap would crowd out
  // the meaningful investments in the existing House ledger.
  if(action!=='estate-clicker-serve') {
    const office=p.office=p.office && typeof p.office==='object' && !Array.isArray(p.office)?p.office:{};
    office.transactions=Array.isArray(office.transactions)?office.transactions:[];
    office.transactions.unshift({type:cost?'estate':'income',label:result.message,amount:cost?-cost:amount,at:now});
    office.transactions=office.transactions.slice(0,40);
  }
  return {snapshot,privateState,result};
}
