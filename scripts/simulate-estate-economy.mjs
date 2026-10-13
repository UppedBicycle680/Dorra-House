import {pathToFileURL} from 'node:url';
import {normalizeEstate,estateSnapshot,purchaseEstateVenue,upgradeEstateVenue,hireEstateManager,
 startEstateCycle,claimEstateIncome,claimEstateGoal,trainEstateManager,hireEstateSpecialist} from '../estate-engine.js';

// Deterministic pacing probe: one manual customer, then reinvest automatic income.
// No casino, daily gift, founder advance, admin funds or random windfalls.
export function simulateEstateEconomy(){
 const initial=1_800_000_000_000,progress=normalizeEstate({},initial);
 let now=initial,balance=1000,decisions=0,longestWait=0;
 const openings=[],hires=[];
 const buy=(action,id,role)=>{
  const fn={open:purchaseEstateVenue,upgrade:upgradeEstateVenue,manager:hireEstateManager,train:trainEstateManager}[action];
  const result=role?hireEstateSpecialist(progress,id,role,balance,now):fn(progress,id,balance,now);
  if(!result.ok)throw new Error(result.reason);
  balance-=result.cost;decisions++;
  if(action==='open')openings.push({venue:id,seconds:(now-initial)/1000});
  if(action==='manager')hires.push({venue:id,seconds:(now-initial)/1000});
 };
 buy('open','terrace');startEstateCycle(progress,'terrace',now);now+=5000;
 balance+=claimEstateIncome(progress,now).amount;
 for(let iteration=0;iteration<2000;iteration++){
  let snap=estateSnapshot(progress,now);
  if(snap.claimable>=1)balance+=claimEstateIncome(progress,now).amount;
  for(const goal of snap.goals.filter(g=>g.complete&&!g.claimed))balance+=claimEstateGoal(progress,goal.id,now).amount;
  snap=estateSnapshot(progress,now);
  if(snap.managedCount===6)return {startingBalance:1000,manualCustomers:progress.empire.clicker.served,openings,hires,seconds:(now-initial)/1000,decisions,longestWait,autoPerSecond:snap.autoPerMinute/60};
  const manual=snap.venues.find(v=>v.owned&&!v.manager),opening=snap.venues.find(v=>!v.owned&&v.unlocked&&v.openCost<=balance);
  let choice=manual?{action:manual.level<2?'upgrade':'manager',id:manual.id,cost:manual.level<2?manual.upgradeCost:manual.managerCost}:opening?{action:'open',id:opening.id,cost:opening.openCost}:null;
  if(!choice){
   choice=snap.venues.filter(v=>v.manager).flatMap(v=>[
    {action:'upgrade',id:v.id,cost:v.upgradeCost,gain:v.nextIncomePerSecond-v.autoPerMinute/60},
    {action:'train',id:v.id,cost:v.training.cost,gain:v.training.gainPerSecond},
    ...v.specialists.filter(s=>s.unlocked&&!s.hired&&s.useful).map(s=>({action:'specialist',id:v.id,role:s.id,cost:s.cost,gain:s.gainPerSecond}))
   ]).filter(c=>c.gain>0).sort((a,b)=>a.cost/a.gain-b.cost/b.gain)[0];
  }
  if(!choice)throw new Error('No productive next investment.');
  if(balance<choice.cost){
   const rate=snap.autoPerMinute/60;if(!rate)throw new Error('Opening loop stalled before automation.');
   const wait=Math.ceil((choice.cost-balance)/rate)+1;
   longestWait=Math.max(longestWait,wait);now+=wait*1000;
  }else {buy(choice.action,choice.id,choice.role);now+=1000;}
 }
 throw new Error('The reinvestment policy never reached the last director.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(simulateEstateEconomy(),null,2));
