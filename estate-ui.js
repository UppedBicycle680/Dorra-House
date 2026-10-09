import {estateSnapshot} from './estate-engine.js?v=20261009-estate1';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cash = value => '$' + Math.floor(Math.max(0, value || 0)).toLocaleString();
const compact = value => '$' + new Intl.NumberFormat('en', {notation:'compact', maximumFractionDigits:1}).format(Math.max(0,value||0));
const rate = value => '$' + new Intl.NumberFormat('en', {maximumFractionDigits:1}).format(value || 0);
const symbols = {terrace:'coffee',valet:'car',boutique:'diamond',skyline:'glass-cocktail',grandprix:'flag',hotel:'building'};
const icon = (name, cls='') => `<i class="ti ti-${name} ${cls}" aria-hidden="true"></i>`;
const initials = name => name.split(' ').map(part=>part[0]).join('');

/** A single controller keeps service buttons stable between live updates. */
export function createEstateUI({panel,getState,mutate,notify,cloudStatus,openAccount,now=()=>Date.now()}) {
  let view='estate',selected='terrace',busy=false,lastMessage='',feedbackTimer;
  const snapshot = () => {
    const current=getState();
    // The cloud snapshot is an authoritative receipt. Forecast on a copy only.
    return estateSnapshot(cloudStatus().connected ? structuredClone(current.progress) : current.progress, now());
  };
  const affordable = (amount, balance) => balance>=amount;
  const shortfall = (cost,balance) => balance>=cost?'':`<small class="estate-shortfall">${cash(cost-balance)} more to save</small>`;

  function venueCard(venue) {
    const status=venue.manager?'Manager on duty':venue.owned?'You’re running this':venue.unlocked?'Ready to open':`${venue.stars} stars to unlock`;
    return `<button class="estate-venue ${venue.id===selected?'selected':''} ${venue.owned?'owned':''} ${venue.manager?'managed':''}" data-estate-select="${venue.id}" aria-pressed="${venue.id===selected}">
      <span class="estate-venue-icon">${icon(symbols[venue.id])}</span><span class="estate-venue-copy"><small>${venue.area}</small><strong>${venue.name}</strong><span>${status}</span></span>
      <span class="estate-venue-yield"><b>${venue.owned?compact(venue.tapValue):compact(venue.openCost)}</b><small>${venue.owned?'per service':'opening cost'}</small><span class="estate-stars" aria-label="${venue.level} of 5 levels">${Array.from({length:5},(_,i)=>icon(i<venue.level?'star-filled':'star')).join('')}</span></span>
    </button>`;
  }

  function goalCard(goal) {
    return `<article class="estate-goal ${goal.claimed?'claimed':''}"><span class="estate-goal-mark">${icon(goal.claimed?'check':goal.complete?'gift':'target')}</span><div><h3>${goal.name}</h3><p>${goal.copy}</p><div class="estate-meter" role="progressbar" aria-label="${escape(goal.name)}" aria-valuemin="0" aria-valuemax="${goal.target}" aria-valuenow="${Math.min(goal.value,goal.target)}"><b style="width:${goal.progress*100}%"></b></div><small>${Math.min(goal.value,goal.target).toLocaleString()} / ${goal.target.toLocaleString()}</small></div><button data-estate-goal="${goal.id}" ${!goal.complete||goal.claimed?'disabled':''}>${goal.claimed?'Claimed':goal.complete?'Claim '+cash(goal.amount):cash(goal.amount)+' reward'}</button></article>`;
  }

  function managerCard(venue,balance,large=false) {
    return `<article class="estate-manager ${venue.manager?'hired':''} ${large?'featured':''}"><span class="estate-avatar">${initials(venue.managerName)}</span><div class="estate-manager-info"><small>${venue.managerTitle}</small><h3>${venue.managerName}</h3><p>${venue.manager?'On duty at '+venue.name:'Automates '+venue.name}</p></div><span class="estate-manager-state">${icon(venue.manager?'circle-check':'user-plus')}</span><div class="estate-manager-benefit">${icon('clock')}<span>${venue.manager?`Earning <strong>${rate(venue.autoPerMinute)}/min</strong>, even while you’re away.`:`Serves a customer every ${venue.cycleMs/1000}s. Keeps earning while you’re away.`}</span></div>${venue.manager?`<div class="estate-on-duty">${icon('check')} Hired · automatic service enabled</div>`:`<button class="estate-button ${venue.canHire?'primary':''}" data-estate-manager="${venue.id}" ${!venue.canHire||!affordable(venue.managerCost,balance)?'disabled':''}>${!venue.owned?'Open this venue first':!venue.canHire?'Reach Level 2 to hire':'Hire '+venue.managerName.split(' ')[0]+' · '+cash(venue.managerCost)}</button>${venue.canHire?shortfall(venue.managerCost,balance):''}`}</article>`;
  }

  function activeVenue(venue,snap,balance) {
    const requirement=venue.requirements.filter(item=>!item.met).map(item=>item.label).join(' · ');
    const next=venue.level<5?venue.payouts[venue.level]:0;
    return `<div class="estate-workspace"><section class="estate-service-card" aria-label="${escape(venue.name)} service">
      <header><div><small>${venue.area} · ${venue.owned?'Level '+venue.level+' / 5':'Your next business'}</small><h2>${venue.name}</h2><p>${venue.owned?venue.levels[venue.level-1]:venue.copy}</p></div><span class="estate-status ${venue.manager?'automatic':''}">${icon(venue.manager?'bolt':venue.owned?'hand-click':'lock-open')}${venue.manager?'Automated':venue.owned?'Hands on':'Unopened'}</span></header>
      <div class="estate-scene estate-scene-${venue.id}"><img src="assets/progression/dorra-estate-idle.png" alt="Illustrated Dorra estate with its café, valet, gallery, rooftop, motor club and hotel"><div class="estate-scene-shade"></div><span class="estate-scene-label">${icon(symbols[venue.id])}${venue.name}</span><div class="estate-scene-guests" aria-hidden="true">${[1,2,3].map(n=>`<span>${icon('user')}${n===1?icon(symbols[venue.id]):''}</span>`).join('')}</div><span class="estate-floating-income" aria-hidden="true"></span></div>
      ${venue.owned?`<div class="estate-service-stats"><span><small>Per service</small><strong data-estate-tap-value>${cash(venue.tapValue)}</strong></span><span><small>${venue.manager?'Automatic income':'Manager income'}</small><strong>${venue.manager?rate(venue.autoPerMinute)+'/min':'Not hired yet'}</strong></span><span><small>Customers served</small><strong data-estate-customers>${venue.customers.toLocaleString()}</strong></span></div>
      <div class="estate-service-action"><button class="estate-serve" data-estate-serve="${venue.id}" aria-label="${venue.action} at ${venue.name}">${icon(symbols[venue.id])}<span><strong>${venue.action}</strong><small>Tap or press Space · <b data-estate-serve-value>+${cash(venue.tapValue)}</b></small></span>${icon('arrow-right')}</button><p data-estate-help>${venue.manager?'Your manager runs automatic service. You can still serve extra customers.':'Every tap serves a customer and adds cash to your balance.'}</p></div>
      <div class="estate-bonus-row"><div><span>${icon('flame')}<strong data-estate-rush-label>${venue.rushRemainingMs>0?'Rush active · 1.5× earnings':'Build a service rush'}</strong></span><small data-estate-rush-copy>${venue.rushRemainingMs>0?Math.ceil(venue.rushRemainingMs/1000)+'s remaining':'Every '+venue.rushEvery+' services · 8s of 1.5× earnings'}</small><div class="estate-meter"><b data-estate-rush-fill style="width:${venue.rushRemainingMs>0?100:(venue.served%venue.rushEvery)/venue.rushEvery*100}%"></b></div></div><div><span>${icon('crown')}<strong>Next VIP · 3× reward</strong></span><small data-estate-vip-copy>${venue.vipIn} services away</small><div class="estate-meter gold"><b data-estate-vip-fill style="width:${(venue.vipEvery-venue.vipIn)/venue.vipEvery*100}%"></b></div></div></div>`:
      `<div class="estate-opening"><h3>${venue.unlocked?'Every great estate starts somewhere.':'A bigger chapter is coming.'}</h3><p>${venue.unlocked?'Open '+venue.name+', serve your first customer, and start building your business.':escape(requirement)}</p><button class="estate-button primary" data-estate-open="${venue.id}" ${!venue.unlocked||!affordable(venue.openCost,balance)?'disabled':''}>${venue.unlocked?'Open venue · '+cash(venue.openCost):'Earn '+venue.stars+' estate stars to unlock'}</button>${venue.unlocked?shortfall(venue.openCost,balance):''}</div>`}
      ${venue.manager?`<div class="estate-auto-cycle"><span>${icon('refresh')} ${venue.managerName.split(' ')[0]} is serving customers <b>${venue.cycleMs/1000}s per service</b></span><div class="estate-meter"><b data-estate-cycle-fill style="width:${venue.cycleProgress*100}%"></b></div></div>`:''}
    </section><aside class="estate-venue-tools">${venue.owned?`<section class="estate-upgrade"><header><small>Make it your own</small><h3>${venue.level===5?'A House institution':'Grow '+venue.name}</h3></header><div class="estate-levels" aria-label="Venue level ${venue.level} of 5">${Array.from({length:5},(_,i)=>`<span class="${i<venue.level?'filled':''}">${i+1}</span>`).join('')}</div><p>${venue.level===5?'Every upgrade complete. Your venue is at its best.':`Next: <strong>${venue.levels[venue.level]}</strong>`}</p>${venue.level<5?`<div class="estate-upgrade-impact"><span>Base service value</span><strong>${cash(venue.baseTapValue)} ${icon('arrow-right')} ${cash(next)}</strong></div><button class="estate-button primary" data-estate-upgrade="${venue.id}" ${!affordable(venue.upgradeCost,balance)?'disabled':''}>Upgrade to Level ${venue.level+1} · ${cash(venue.upgradeCost)}</button>${shortfall(venue.upgradeCost,balance)}`:`<div class="estate-on-duty">${icon('star-filled')} Maximum level reached</div>`}</section>`:''}${managerCard(venue,balance,true)}<section class="estate-tip"><small>Your next move</small><p>${!venue.owned?'Open the venue to start earning.':venue.level===1?'Upgrade to Level 2 to unlock your manager.':!venue.manager?'Hire '+venue.managerName.split(' ')[0]+' to keep this venue earning automatically.':snap.ownedCount<6?'Keep serving or collect manager income. Upgrade venues to earn the stars that unlock your next business.':'Grow each venue to Level 5 and complete your Estate milestones.'}</p></section></aside></div>`;
  }

  function render() {
    const focus=document.activeElement?.closest('[data-estate-select],[data-estate-serve],[data-estate-upgrade],[data-estate-manager],[data-estate-open],[data-estate-goal],[data-estate-view],[data-estate-claim],[data-estate-account]');
    const focusAttr=focus&&Array.from(focus.attributes).find(attr=>attr.name.startsWith('data-estate-'));
    const snap=snapshot(),current=getState(),balance=current.balance,cloud=cloudStatus();
    let venue=snap.venues.find(item=>item.id===selected)||snap.venues[0];
    panel.innerHTML=`<div class="estate-game" aria-label="Dorra Estate idle game"><div class="estate-summary"><div><small>${cloud.connected?'Cloud Estate balance':'Available balance'}</small><strong data-estate-wallet>${cash(balance)}</strong></div><div><small>Manager income</small><strong data-estate-income>${rate(snap.autoPerMinute)}<em>/min</em></strong></div><div><small>Estate progress</small><strong>${snap.stars}<em>/ 30 stars</em></strong><span>${snap.ownedCount} venues · ${snap.managedCount} managers</span></div><button class="estate-collect" data-estate-claim ${snap.claimable<1?'disabled':''}><span>${icon('wallet')} Collect income</span><strong data-estate-bank>${cash(snap.claimable)}</strong><small data-estate-bank-copy>${snap.bankHours.toFixed(1)} / ${snap.capHours} hours banked</small></button></div>
      <nav class="estate-nav" aria-label="Estate game sections">${[['estate','building-estate','Your estate'],['managers','users','Managers'],['milestones','target','Milestones']].map(([id,symbol,label])=>`<button data-estate-view="${id}" class="${view===id?'active':''}" aria-pressed="${view===id}">${icon(symbol)}${label}${id==='milestones'&&snap.goals.some(goal=>goal.complete&&!goal.claimed)?'<b class="estate-notification">!</b>':''}</button>`).join('')}<button class="estate-account-trigger" data-estate-account>${icon(cloud.connected?'cloud-check':'cloud')}<span>${cloud.connected?escape(cloud.username||'Cloud connected'):'Connect cloud save'}</span></button></nav>
      <div class="estate-feedback" role="status" aria-live="polite">${escape(lastMessage||'Open. Serve. Upgrade. Hire a manager. Build the next chapter.')}</div>
      ${view==='estate'?activeVenue(venue,snap,balance)+`<section class="estate-portfolio"><header><div><small>Your growing portfolio</small><h2>Six venues. One Dorra.</h2></div><p>Each upgrade earns a star and opens the way to your next venue.</p></header><div class="estate-venues">${snap.venues.map(venueCard).join('')}</div></section>`:view==='managers'?`<section class="estate-section-heading"><small>Put the House in good hands</small><h2>Your management team</h2><p>Reach Level 2, hire a director, and let them serve customers for you. Collect up to ${snap.capHours} hours of income when you return.</p></section><div class="estate-managers">${snap.venues.map(item=>managerCard(item,balance)).join('')}</div>`:`<section class="estate-section-heading"><small>Something to work towards</small><h2>Little wins. A bigger estate.</h2><p>Build your business and claim each milestone reward once.</p></section><div class="estate-goals">${snap.goals.map(goalCard).join('')}</div>`}
      ${view!=='milestones'&&snap.nextGoal?`<section class="estate-next-goal"><span>${icon('target')}</span><div><small>Next milestone</small><strong>${snap.nextGoal.name}</strong><p>${snap.nextGoal.copy}</p></div><button ${snap.nextGoal.complete?`data-estate-goal="${snap.nextGoal.id}"`:'data-estate-view="milestones"'}>${snap.nextGoal.complete?'Claim '+cash(snap.nextGoal.amount):'View milestones '+(Math.min(snap.nextGoal.value,snap.nextGoal.target))+'/'+snap.nextGoal.target}</button></section>`:''}
      <footer class="estate-game-footnote"><span>${icon('device-gamepad-2')} Fictional play money</span><span>${cloud.connected?'Account Estate · local casino balance is separate':'Saved on this device · connect your account to play your cloud Estate'}</span><span>Managers earn offline · ${snap.capHours}h cap</span></footer></div>`;
    if(focusAttr) panel.querySelector(`[${focusAttr.name}="${CSS.escape(focusAttr.value)}"]`)?.focus({preventScroll:true});
    if(busy) panel.querySelectorAll('[data-estate-serve],[data-estate-open],[data-estate-upgrade],[data-estate-manager],[data-estate-claim],[data-estate-goal]').forEach(button=>button.disabled=true);
  }

  function update() {
    if(panel.hidden||!panel.querySelector('.estate-game')) return;
    const snap=snapshot(),venue=snap.venues.find(item=>item.id===selected);
    const set=(selector,value)=>{const target=panel.querySelector(selector);if(target)target.textContent=value;};
    set('[data-estate-bank]',cash(snap.claimable));set('[data-estate-bank-copy]',`${snap.bankHours.toFixed(1)} / ${snap.capHours} hours banked`);
    const collect=panel.querySelector('[data-estate-claim]');if(collect)collect.disabled=busy||snap.claimable<1;
    if(!venue) return;
    set('[data-estate-customers]',venue.customers.toLocaleString());
    set('[data-estate-tap-value]',cash(venue.tapValue));set('[data-estate-serve-value]','+'+cash(venue.tapValue));
    set('[data-estate-rush-label]',venue.rushRemainingMs>0?'Rush active · 1.5× earnings':'Build a service rush');
    set('[data-estate-rush-copy]',venue.rushRemainingMs>0?Math.ceil(venue.rushRemainingMs/1000)+'s remaining':'Every '+venue.rushEvery+' services · 8s of 1.5× earnings');
    set('[data-estate-vip-copy]',venue.vipIn+' services away');
    for(const [selector,percent] of [['[data-estate-cycle-fill]',venue.cycleProgress*100],['[data-estate-rush-fill]',venue.rushRemainingMs>0?100:(venue.served%venue.rushEvery)/venue.rushEvery*100],['[data-estate-vip-fill]',(venue.vipEvery-venue.vipIn)/venue.vipEvery*100]]){const fill=panel.querySelector(selector);if(fill)fill.style.width=percent+'%';}
  }

  function feedback(result,action) {
    lastMessage=action==='serve'?`${result.vip?'VIP service! ':result.rush?'Service rush started! ':''}+${cash(result.amount)} earned.`:action==='manager'?'Manager hired. Automatic service is now running.':action==='upgrade'?'Venue upgraded. Every customer is worth more.':action==='open'?'Doors open. Serve your first customer!':action==='claim'?cash(result.amount)+' manager income collected.':cash(result.amount)+' milestone reward claimed.';
    if(action==='serve') {
      const chip=panel.querySelector('.estate-floating-income');
      if(chip){chip.textContent='+'+cash(result.amount);chip.classList.remove('pop');void chip.offsetWidth;chip.classList.add('pop');}
      const button=panel.querySelector('[data-estate-serve]');button?.classList.remove('served');void button?.offsetWidth;button?.classList.add('served');
      panel.querySelector('.estate-feedback').textContent=lastMessage;
      clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{panel.querySelector('[data-estate-serve]')?.classList.remove('served');},220);
    } else notify(lastMessage);
  }

  async function click(event) {
    const button=event.target.closest('button');if(!button||!panel.contains(button)) return;
    if(button.hasAttribute('data-estate-account')){openAccount();return;}
    if(button.dataset.estateView){view=button.dataset.estateView;render();return;}
    if(button.dataset.estateSelect){selected=button.dataset.estateSelect;view='estate';render();panel.querySelector('.estate-service-card')?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
    if(busy||button.disabled) return;
    const action=['serve','open','upgrade','manager','claim','goal'].find(name=>button.hasAttribute('data-estate-'+name));if(!action) return;
    const arg=button.getAttribute('data-estate-'+action),cloud=cloudStatus().connected;
    busy=true;if(cloud)button.disabled=true;
    try {
      const result=await mutate(action,action==='goal'?{goalId:arg}:action==='claim'?{}:{venueId:arg});
      if(!result?.ok){if(!result?.retryAfterMs)notify(result?.reason||'That action could not be completed.');return;}
      feedback(result,action);
      if(action==='serve'){
        update();panel.querySelector('[data-estate-wallet]').textContent=cash(getState().balance);
        // New milestones and affordable upgrades are refreshed without moving
        // keyboard focus; the service button remains the primary target.
        render();feedback(result,action);
      }else render();
    } catch(error){notify(error.message||'Could not save this action. Please retry.');}
    finally {busy=false;update();const serve=panel.querySelector('[data-estate-serve]');if(serve)serve.disabled=false;}
  }
  panel.addEventListener('click',click);
  return {render,update,destroy(){panel.removeEventListener('click',click);clearTimeout(feedbackTimer);}};
}
