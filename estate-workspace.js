import {EMPIRE_VENUES} from './progression-engine.js?v=20260819-business2';

export const ESTATE_VIEWS = [['overview','Overview','home'],['portfolio','Portfolio','building'],['operations','Operations','settings'],['upgrades','Upgrades','chart-bar'],['marketing','Marketing','speakerphone'],['finance','Finance','coins'],['objectives','Objectives','target']];
export const estateIcon = name => `<i class="ti ti-${name}" aria-hidden="true"></i>`;

export function estateOverview({p, snapshot, balance, claimable, cap, stars, next, money, actionButton, eventHTML, analyticsHTML, art, venueStatus, lockCopy}) {
  const operating = EMPIRE_VENUES.filter(v => p.empire.venues[v.id]?.level);
  const venue = next.venue || operating[0] || EMPIRE_VENUES[0];
  const level = p.empire.venues[venue.id]?.level || 0;
  const firstOpening = !operating.length && next.type === 'upgrade';
  const photo = venue.id === 'terrace' ? {src:'assets/estate-terrace-v1.png',alt:'The Terrace Cafe with emerald awnings and warm evening lights'} : art[venue.id];
  const upcoming = EMPIRE_VENUES.find(v => venueStatus(v,p) === 'locked');
  const rows = [venue, upcoming].filter((v,i,a) => v && a.indexOf(v) === i);
  const button = actionButton({...next, button:firstOpening ? `Open Terrace · ${money(venue.costs[0])}` : next.button});
  return `${eventHTML}<div class="estate-overview-grid">
    <article class="estate-next-move" aria-labelledby="estateNextTitle">
      <img class="estate-feature-art" src="${photo.src}" alt="${photo.alt}" decoding="async">
      <div class="estate-feature-copy"><small class="estate-eyebrow">${firstOpening ? 'Your next move' : next.eyebrow}</small>
        <h2 id="estateNextTitle" tabindex="-1">${firstOpening ? 'Your first venue awaits.' : next.title}</h2>
        <p>${firstOpening ? 'Open the Terrace in the East Arcade. Welcome your first guests and start building an estate of your own.' : next.copy}</p>
        <dl class="estate-opening-facts"><div><dt>${estateIcon('map-pin')}Venue</dt><dd>${venue.name}<small>${venue.area}</small></dd></div><div><dt>${estateIcon('coins')}${level ? 'Next investment' : 'Opening cost'}</dt><dd>${level < 5 ? money(venue.costs[level]) : 'Fully upgraded'}</dd></div><div><dt>${estateIcon('chart-bar')}${level ? 'Base output' : 'Initial income'}</dt><dd>${money(venue.rates[Math.max(0,level-1)])}<small>per hour</small></dd></div></dl>
        ${button}
      </div>
    </article>
    <aside class="estate-income-bank" aria-labelledby="estateIncomeTitle"><small class="estate-eyebrow" id="estateIncomeTitle">Income bank</small><strong id="empireReadyValue">${money(claimable)}</strong><p>Ready to collect</p><button data-empire-claim ${claimable<1?'disabled':''}>Collect profit</button><small id="empireBankCopy">${operating.length ? `${((p.empire.unclaimedMs||0)/3600000).toFixed(1)} of ${cap} hours banked` : 'Open a venue to start earning'}</small><div class="empire-bank-track" aria-hidden="true"><b id="empireBankFill" style="width:${Math.min(100,(p.empire.unclaimedMs||0)/3600000/cap*100)}%"></b></div>
      <section><h3>${estateIcon('info-circle')}How it works</h3><p>Venues earn income over time, even while you’re away. Collect the banked profit, then reinvest to grow your estate.</p></section>
      <section><h3>${estateIcon('star')}Next milestone</h3><p>${upcoming ? `Upgrade venue levels to earn Empire stars. ${upcoming.name} unlocks at ${upcoming.stars} stars${upcoming.vehicle?' with a vehicle':''}.` : 'Every venue is unlocked. Develop your properties and appoint directors to improve their output.'}</p></section>
    </aside>
  </div><section class="estate-roadmap" aria-labelledby="estateRoadmapTitle"><header><div><small class="estate-eyebrow" id="estateRoadmapTitle">Venue roadmap</small><p>${stars} Empire star${stars===1?'':'s'} · Each venue level earns another star.</p></div><button data-business-view="portfolio">View all properties ${estateIcon('arrow-right')}</button></header><div class="estate-roadmap-rows">${rows.map(v=>{const status=venueStatus(v,p),entry=p.empire.venues[v.id];return `<button data-business-view="portfolio" data-estate-property="${v.id}" class="estate-roadmap-row"><span class="estate-roadmap-symbol">${estateIcon(status==='locked'?'lock':'building')}</span><span><strong>${v.name}</strong><small>${status==='locked'?lockCopy(v):entry?.level?`Operating · Level ${entry.level}`:v.area}</small></span><span class="estate-roadmap-status">${status==='locked'?'Locked':entry?.level?'Operating':'Ready to open'}</span>${estateIcon('chevron-right')}</button>`}).join('')}</div></section>
  ${operating.length ? `<details class="estate-trading-details"><summary>Trading performance and market insights</summary>${analyticsHTML}</details>` : ''}`;
}

export function estateWorkspace({p,balance,snapshot,claimable,stars,view,money,content}) {
  const operating = EMPIRE_VENUES.filter(v=>p.empire.venues[v.id]?.level).length;
  const label = ESTATE_VIEWS.find(v=>v[0]===view)?.[1] || 'Overview';
  const projectedNet = `${snapshot.weekly.net < 0 ? '−' : ''}${money(Math.abs(snapshot.weekly.net))}`;
  return `<header class="estate-content-heading"><div><p class="estate-breadcrumb">House / Estate <span>Week ${p.empire.week} · Year ${p.empire.year}, Q${Math.floor((p.empire.week-1)/13)+1}</span></p><h1 id="estateWorkspaceTitle" tabindex="-1">${view==='overview'?'Your estate, at a glance.':label}</h1><p>Manage your venues, grow your income, and build a lasting legacy.</p></div><button class="estate-week-action" data-business-advance ${p.empire.event?'disabled':''}>${estateIcon('calendar')}<span>Close business week<small>${p.empire.event?'Decision required first':`${projectedNet} projected net`}</small></span>${estateIcon('chevron-right')}</button></header>
  <dl class="estate-financial-summary"><div><dt>Available capital</dt><dd>${money(balance)}</dd><small>Ready to invest</small></div><div><dt>Projected trading week</dt><dd class="${snapshot.weekly.net<0?'negative':''}">${projectedNet}</dd><small>${money(snapshot.gross)} gross revenue per hour</small></div><div><dt>Ready to collect</dt><dd id="estateBankSummary">${money(claimable)}</dd><small>${operating?'Banked venue income':'Open a venue to start earning'}</small></div><div><dt>Estate status</dt><dd>${operating}</dd><small>Operating venue${operating===1?'':'s'} · ${stars} Empire star${stars===1?'':'s'}</small></div></dl>
  <div class="estate-section-content ${view==='portfolio'?'portfolio-view':''}">${content}</div>`;
}
