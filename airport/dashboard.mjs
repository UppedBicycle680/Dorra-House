import {getAirportLayout, rectPolygon} from './layouts.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const amount = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const money = value => `$${Math.floor(amount(value)).toLocaleString('en-AU')}`;
const unattendedRate = airport => airport.rates?.unattendedCashPerHour ?? amount(airport.rates?.cashPerHour) * (airport.operations?.atc?.owned || airport.atcOwned ? 1 : .75);
const previewCache = new Map();

// Small, static maps use the same airport geometry as the simulation.
// No additional canvases, animation loops, external images or requests.
function airportMap(id) {
  if (previewCache.has(id)) return previewCache.get(id);
  const layout = getAirportLayout(id);
  const footprint = [...layout.runways, ...(layout.aprons || []), ...(layout.terminals || [])]
    .flatMap(item => item.polygon || (item.rect ? rectPolygon(item.rect) : []));
  const xs = footprint.map(p => p[0]), ys = footprint.map(p => p[1]);
  const b = {minX:Math.min(...xs), minY:Math.min(...ys), maxX:Math.max(...xs), maxY:Math.max(...ys)};
  const padding = Math.max(b.maxX - b.minX, b.maxY - b.minY) * .08;
  const points = items => items.map(p => p.map(n => Number(n.toFixed(2))).join(',')).join(' ');
  const polygon = (item, fill) => {
    const p = item.polygon || (item.rect ? rectPolygon(item.rect) : null);
    return p?.length ? `<polygon points="${points(p)}" fill="${fill}"/>` : '';
  };
  const line = (item, fill, width) => item.points?.length ? `<polyline points="${points(item.points)}" fill="none" stroke="${fill}" stroke-width="${width || item.width || 3}" stroke-linejoin="round"/>` : '';
  const svg = `<svg viewBox="${b.minX - padding} ${b.minY - padding} ${b.maxX - b.minX + padding * 2} ${b.maxY - b.minY + padding * 2}" aria-hidden="true" focusable="false">
    ${(layout.water || []).map(p => polygon(p, '#8cc8d1')).join('')}
    ${(layout.roads || []).map(p => line(p, '#b3c5b4')).join('')}
    ${(layout.aprons || []).map(p => polygon(p, '#b7c7c2')).join('')}
    ${(layout.taxiways || []).map(p => line(p, '#94aaa3')).join('')}
    ${layout.runways.map(p => polygon(p, '#55736e')).join('')}
    ${layout.runways.map(p => `<path d="M${p.start.join(' ')} L${p.end.join(' ')}" fill="none" stroke="#edf7e9" stroke-width="1" stroke-dasharray="5 6"/>`).join('')}
    ${(layout.terminals || []).map(p => polygon(p, '#f7fbf0')).join('')}
  </svg>`;
  previewCache.set(id, svg);
  return svg;
}

export function createAirportDashboard(root) {
  let signature = '', busy = false;
  function render(view) {
    const airports = view.airports || [], owned = airports.filter(a => a.owned);
    const nextSignature = JSON.stringify(airports.map(a => [a.id, a.owned]));
    if (signature !== nextSignature) {
      const focusedId = root.querySelector(':focus')?.dataset.airportId;
      root.querySelector('[data-airport-cards]').innerHTML = airports.map(a => `<article class="destination-card ${a.owned ? 'is-open' : 'is-locked'}" data-destination="${esc(a.id)}" aria-labelledby="destination-${esc(a.id)}">
        <div class="destination-map">${airportMap(a.id)}<span class="destination-code">${esc(a.code)}</span><span class="destination-status">${a.owned ? '<i></i> Open' : 'Locked'}</span><span class="destination-map-label">AIRFIELD OVERVIEW</span></div>
        <div class="destination-body"><p class="destination-region">${esc(a.region)}${a.fictional ? ' · Fictional' : ''}</p><h3 id="destination-${esc(a.id)}">${esc(a.name)}</h3>
          <dl class="destination-money"><div><dt>Unattended / hour</dt><dd data-income>—</dd></div><div><dt>Cash balance</dt><dd data-cash>—</dd></div></dl><p class="destination-full-rate" data-full-rate></p>
          ${a.owned ? `<button class="destination-visit" data-action="visit-airport" data-airport-id="${esc(a.id)}" aria-label="Visit ${esc(a.name)}" ${busy?'disabled':''}><span>Visit airport</span><span aria-hidden="true">↗</span></button>` : '<div class="destination-unavailable">Not open yet</div>'}
          <p class="destination-note" data-note></p>
        </div></article>`).join('');
      signature = nextSignature;
      if (focusedId) [...root.querySelectorAll('[data-airport-id]')].find(el => el.dataset.airportId === focusedId)?.focus({preventScroll:true});
    }
    root.querySelector('[data-network-income]').textContent = money(owned.reduce((sum, a) => sum + amount(unattendedRate(a)), 0));
    root.querySelector('[data-network-cash]').textContent = money(owned.reduce((sum, a) => sum + amount(a.cash), 0));
    root.querySelector('[data-network-count]').textContent = `${owned.length} / ${airports.length}`;
    for (const a of airports) {
      const card = [...root.querySelectorAll('[data-destination]')].find(el => el.dataset.destination === a.id);
      card.querySelector('[data-income]').textContent = a.owned ? money(unattendedRate(a)) : '—';
      card.querySelector('[data-cash]').textContent = a.owned ? money(a.cash) : '—';
      const atc = a.operations?.atc?.owned || a.atcOwned;
      card.querySelector('[data-full-rate]').textContent = a.owned ? `${money(a.rates?.fullCashPerHour ?? a.rates?.cashPerHour)} / hour while visiting · bonuses extra` : '';
      card.querySelector('[data-note]').textContent = a.owned ? atc ? 'ATC hired · full unattended income' : 'Manual ATC · 75% unattended income' : 'Unlock through airport progression';
    }
  }
  function status(state) {
    const element = root.querySelector('[data-dashboard-status]');
    element.textContent = state === 'error' ? 'Reconnecting · showing last saved figures' : state === 'saving' ? 'Opening airport…' : 'Live · updates every 5 seconds';
    element.classList.toggle('is-error', state === 'error');
  }
  function setBusy(value) {
    busy = value;
    root.setAttribute('aria-busy', String(value));
    root.querySelectorAll('[data-action="visit-airport"]').forEach(button => { button.disabled = value; });
  }
  return {render, status, setBusy};
}
