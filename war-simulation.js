import { createVaultClient } from './vault-client.js';
import { supabase } from './auth-client.js';
import { createWarClient } from './war/client.mjs';
import { CommandMap } from './war/map.mjs';
import { BRANCHES } from './war/catalog.mjs';
import { validateOrder } from './war/command-info.mjs';
import { escapeHTML as e, renderLobby, renderNationList, renderResources, renderNav, renderDrawer, renderSelection, renderClock, getPlatforms, titleCase } from './war/ui.mjs';

const $ = selector => document.querySelector(selector);
const dom = { app: $('#warApp'), boot: $('#bootPanel'), lobby: $('#lobbyPanel'), drawer: $('#commandDrawer'), nav: $('#commandNav'), selection: $('#selectionPanel'), clock: $('#matchClock'), resources: $('#resourceBar'), context: $('#commandContext'), toast: $('#toast'), dialog: $('#commandDialog'), banner: $('#connectionBanner') };
const model = { nations: [], worlds: [], nationId: 'AU', opponentNationId: 'NZ', opponent: 'ai', template: 'duel', pace: 'fast', visibility: 'public', name: '', search: '', lobbyTab: 'create', tab: 'map', branch: BRANCHES[0]?.id, view: null, selectedUnits: [], provinceId: null, provinceFeature: null, orderType: null, pendingOrder: null, routeMode: false, inviteCode: new URL(location.href).searchParams.get('invite') || '', busy: false, userId: null, legacy: null };
const hintRevisions = new Map();
let vault, client, map, toastTimer, polling, clockTimer, clockAnchor = null, refreshPending, refreshAgain = false, booted = false;
function displayView() { if (!model.view || !clockAnchor || clockAnchor.id !== model.view.match.id || !['running', 'active'].includes(model.view.match.status)) return model.view; const elapsed = Math.max(0, client.serverNow - clockAnchor.receivedAt) / 1000; const limit = model.view.match.pace === 'fast' ? 30 * 86400 : 60 * 86400; return { ...model.view, match: { ...model.view.match, gameTime: Math.min(limit, clockAnchor.gameTime + elapsed * clockAnchor.speed) } }; }
function toast(message, error = false) { clearTimeout(toastTimer); dom.toast.textContent = message; dom.toast.className = `war-toast show${error ? ' error' : ''}`; toastTimer = setTimeout(() => { dom.toast.className = 'war-toast'; }, error ? 6500 : 3500); }
function connection(status, error) { dom.banner.hidden = status === 'connected'; if (status !== 'connected') { dom.banner.querySelector('span').textContent = error?.message || 'Reconnecting to command…'; $('#retryConnection').textContent = status === 'ended' ? 'Reload & sign in' : 'Reconnect'; if (status === 'ended') { model.busy = true; render(); } } }
function render() {
  if (!booted) return;
  const active = Boolean(model.view);
  dom.lobby.hidden = active; dom.nav.hidden = !active; dom.clock.hidden = !active; dom.drawer.hidden = !active || model.tab === 'map';
  if (!active) { const scroll = dom.lobby.querySelector('.lobby-body')?.scrollTop || 0; dom.lobby.innerHTML = renderLobby(model); if (dom.lobby.querySelector('.lobby-body')) dom.lobby.querySelector('.lobby-body').scrollTop = scroll; dom.context.textContent = 'OPERATIONS CENTRE'; dom.resources.innerHTML = ''; dom.selection.hidden = true; }
  else {
    dom.context.textContent = model.view.match.name || 'ACTIVE OPERATION'; dom.resources.innerHTML = renderResources(model.view.player.resources); dom.nav.innerHTML = renderNav(model.tab); dom.clock.innerHTML = renderClock(displayView());
    if (model.tab !== 'map') { const scroll = dom.drawer.querySelector('.drawer-body')?.scrollTop || 0; dom.drawer.innerHTML = renderDrawer(model); dom.drawer.querySelector('.drawer-body').scrollTop = scroll; }
    dom.selection.innerHTML = renderSelection(model); dom.selection.hidden = !dom.selection.innerHTML;
  }
  document.querySelectorAll('[data-action]').forEach(button => {
    if (model.busy && ['create', 'join-match', 'open-match', 'start', 'pause', 'resume', 'reward', 'retire', 'research', 'produce', 'build', 'diplomacy', 'import-license', 'transfer-resources', 'confirm-order', 'direct-order'].includes(button.dataset.action)) button.disabled = true;
    if (model.view && !['running', 'active'].includes(model.view.match.status) && ['research', 'produce', 'build', 'diplomacy', 'import-license', 'transfer-resources', 'confirm-order', 'direct-order', 'order-type', 'route-mode'].includes(button.dataset.action)) button.disabled = true;
  });
  dom.app.setAttribute('aria-busy', String(model.busy));
  map.setView(model.view); map.setSelection({ country: active ? null : model.nationId, province: model.provinceId, units: model.selectedUnits }); map.setOrderPreview(model.pendingOrder);
}
function adopt(response) {
  if (response.matches) model.worlds = response.matches;
  if (response.view) {
    const old = model.view;
    if (!old || old.match.id !== response.view.match.id || Number(response.view.match.revision) >= Number(old.match.revision)) {
      model.view = response.view;
      clockAnchor = { id: model.view.match.id, gameTime: Number(model.view.match.gameTime) || 0, speed: Number(model.view.match.speed) || (model.view.match.pace === 'fast' ? 360 : 4), receivedAt: client.serverNow };
      if (old && old.match.status !== 'finished' && model.view.match.status === 'finished') { model.tab = 'operation'; model.pendingOrder = null; model.orderType = null; toast(model.view.victory?.won ? 'Victory confirmed. Your operation has concluded.' : 'The operation has concluded. Review the final standings.'); }
      model.selectedUnits = model.selectedUnits.filter(id => model.view.units?.some(unit => unit.id === id));
      const url = new URL(location.href); url.searchParams.set('match', model.view.match.id); history.replaceState(null, '', url);
    }
  }
  render(); return response;
}
async function refresh() {
  if (!client || client.blocked || document.hidden) return;
  if (refreshPending) { refreshAgain = true; return refreshPending; }
  const matchId = model.view?.match.id;
  refreshPending = client.command(matchId ? 'view' : 'list', matchId ? { revision: model.view.match.revision } : {}, matchId).then(response => {
    // A read started before leaving a world must not reopen it when it arrives.
    if ((model.view?.match.id || null) === (matchId || null)) adopt(response);
  }).finally(() => { refreshPending = null; if (refreshAgain) { refreshAgain = false; void refresh().catch(() => {}); } });
  return refreshPending;
}
async function mutate(action, args = {}, success) {
  if (model.busy || client.blocked) return null;
  model.busy = true; render();
  try {
    const response = await client.command(action, args, model.view?.match.id);
    adopt(response);
    if (!response.view && model.view) await refresh();
    if (success) toast(success);
    return response;
  } catch (error) { toast(error.message, true); return null; }
  finally { model.busy = client.blocked; render(); }
}
function chooseNation(id, focus = true) {
  if (!model.nations.some(nation => nation.id === id)) return;
  model.nationId = id;
  if (model.opponentNationId === id) model.opponentNationId = model.nations.find(nation => nation.id !== id)?.id;
  render(); if (focus) void map.focus(id);
}
function selectUnits(ids) { model.selectedUnits = ids; model.orderType = null; model.pendingOrder = null; model.routeMode = false; model.unitDetailsOpen = false; model.tab = 'map'; render(); }
async function focusSelectedUnit(id) {
  let anchor = null;
  if (innerWidth <= 700 && !dom.selection.hidden) {
    const canvas = map.canvas.getBoundingClientRect(), panel = dom.selection.getBoundingClientRect();
    const top = Math.max(0, dom.resources.getBoundingClientRect().bottom - canvas.top) + 18;
    const bottom = Math.max(top, panel.top - canvas.top - 22);
    anchor = { x: canvas.width * .44, y: (top + bottom) / 2 };
  }
  await map.focusUnit(id, anchor);
}
function target(hit) {
  const ownUnits = model.selectedUnits.filter(id => model.view?.units?.some(unit => unit.id === id && unit.nationId === model.view.player.nationId));
  if (!ownUnits.length) return;
  let provinceId = hit.provinceId;
  if (!provinceId && hit.countryId) provinceId = model.nations.find(n => n.id === hit.countryId)?.capitalProvinceId;
  if (!provinceId) { toast('Zoom in and select a province for this order.'); return; }
  const province = model.view.provinces?.find(p => p.id === provinceId);
  const type = model.orderType || (province?.ownerId && province.ownerId !== model.view.player.nationId ? 'attack' : 'move');
  const waypoints = model.routeMode && model.pendingOrder ? [...(model.pendingOrder.waypoints || []), model.pendingOrder.targetProvinceId] : [];
  if (waypoints.length > 8) { toast('A route supports up to eight waypoints. Confirm this route or remove a waypoint.'); return; }
  model.pendingOrder = { unitIds: ownUnits, type, targetProvinceId: provinceId, targetName: hit.feature?.properties?.name || province?.name || provinceId, ...(waypoints.length ? { waypoints } : {}), ...(hit.unitIds?.length ? { targetUnitId: hit.unitIds[0] } : {}) };
  model.tab = 'map'; render();
}
function mapSelect(hit) {
  if (!model.view) { chooseNation(hit.countryId, false); return; }
  if (model.orderType && model.selectedUnits.length) { target(hit); return; }
  if (hit.unitIds?.length) { selectUnits(hit.unitIds); return; }
  model.provinceId = hit.provinceId || model.nations.find(n => n.id === hit.countryId)?.capitalProvinceId;
  model.provinceFeature = hit.feature?.properties?.countryId ? hit.feature : map.provinces.get(model.provinceId);
  model.selectedUnits = []; model.pendingOrder = null; model.orderType = null; model.tab = 'industry';
  if (!hit.provinceId) void map.loadChunk(hit.countryId).then(() => { model.provinceFeature = map.provinces.get(model.provinceId); render(); });
  render();
}
function showDialog({ eyebrow = 'STRATEGIC COMMAND', title, body, confirm = 'Confirm', danger = false, onConfirm }) {
  const content = $('#dialogBody');
  content.innerHTML = `<span class="eyebrow">${e(eyebrow)}</span><h2 id="dialogTitle">${e(title)}</h2>${body}<div class="dialog-actions"><button class="button secondary" id="dialogCancel">${onConfirm ? 'Cancel' : 'Close'}</button>${onConfirm ? `<button class="button${danger ? ' danger' : ''}" id="dialogConfirm">${e(confirm)}</button>` : ''}</div>`;
  $('#dialogCancel').onclick = () => dom.dialog.close();
  if (onConfirm) { const confirmButton = $('#dialogConfirm'); confirmButton.onclick = async () => { confirmButton.disabled = true; try { const result = await onConfirm(); if (result !== false) dom.dialog.close(); } catch (error) { toast(error.message, true); } finally { confirmButton.disabled = false; } }; }
  if (!dom.dialog.open) dom.dialog.showModal();
}
async function openMatch(id) {
  if (model.busy) return;
  model.busy = true; render();
  try { const response = await client.command('view', {}, id); adopt(response); model.tab = ['waiting', 'lobby', 'ready'].includes(model.view?.match.status) ? 'operation' : 'map'; const nationId = model.view?.player?.nationId; render(); if (nationId) await map.focus(nationId); }
  catch (error) { toast(error.message, true); }
  finally { model.busy = false; render(); }
}
function leave() { model.view = null; model.selectedUnits = []; model.provinceId = null; model.provinceFeature = null; model.pendingOrder = null; model.orderType = null; model.routeMode = false; model.inviteCode = ''; model.lobbyTab = 'worlds'; const url = new URL(location.href); url.searchParams.delete('match'); url.searchParams.delete('invite'); history.replaceState(null, '', url); map.home(); render(); void refresh().catch(error => toast(error.message, true)); }

async function handleAction(button) {
  const { action, id } = button.dataset;
  if (action === 'nation') return chooseNation(id);
  if (action === 'lobby-tab') { model.lobbyTab = id; render(); if (id === 'worlds') void refresh().catch(error => toast(error.message, true)); return; }
  if (['opponent', 'pace', 'branch'].includes(action)) { model[action] = id; render(); return; }
  if (action === 'tab') { model.tab = id; render(); return; }
  if (action === 'refresh') return refresh().catch(error => toast(error.message, true));
  if (action === 'create') {
    const response = await mutate('create', { nationId: model.nationId, opponentNationId: model.opponentNationId, template: model.template, opponent: model.opponent, pace: model.pace, visibility: model.visibility, name: model.name.trim() || `Operation ${model.nations.find(n => n.id === model.nationId)?.name || 'Meridian'}` });
    if (response) { const matchId = response.view?.match.id || response.result?.matchId || response.matchId; if (!response.view && matchId) await openMatch(matchId); model.tab = 'operation'; render(); await map.focus(model.nationId); }
    return;
  }
  if (action === 'open-match') return openMatch(id);
  if (action === 'join-invitation') {
    showDialog({ title: 'Join a private operation', body: '<p>Paste the invitation link or code provided by the host.</p><div class="dialog-field"><label class="field-label" for="invitationInput">Invitation link or code</label><input id="invitationInput" type="text" autocomplete="off" placeholder="Paste your invitation…"></div>', confirm: 'Find operation', onConfirm: async () => { const input = $('#invitationInput').value.trim(); let inviteCode = input, matchId = null; try { const url = new URL(input); inviteCode = url.searchParams.get('invite') || ''; matchId = url.searchParams.get('match'); } catch { /* A standalone code is also accepted. */ } if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteCode)) { toast('Paste a complete invitation link or valid invite code.', true); return false; } const response = await client.command('list', { inviteCode, ...(matchId ? { matchId } : {}) }); model.worlds = response.matches || []; const invited = matchId ? model.worlds.find(match => match.id === matchId) : model.worlds.find(match => match.inviteMatched === true); if (!invited) { toast('No available operation was found for this invitation.', true); return false; } model.inviteCode = inviteCode; render(); await handleAction({ dataset: { action: invited.joined ? 'open-match' : 'join-match', id: invited.id } }); return invited.joined ? true : false; } }); return;
  }
  if (action === 'join-match') {
    const match = model.worlds.find(item => item.id === id), occupied = new Set(match?.occupiedNations || (Array.isArray(match?.players) ? match.players.map(p => p.nationId) : []));
    const allowed = Array.isArray(match?.availableNations) ? new Set(match.availableNations.map(nation => typeof nation === 'string' ? nation : nation.id)) : null;
    const candidates = model.nations.filter(n => !occupied.has(n.id) && (!allowed || allowed.has(n.id)));
    showDialog({ title: 'Choose your command', body: '<p>National strength and available equipment differ. Select your nation before joining this operation.</p><div class="dialog-field"><label class="field-label" for="joinNation">Available nation</label><select id="joinNation">' + candidates.map(n => `<option value="${e(n.id)}" ${n.id === model.nationId ? 'selected' : ''}>${e(n.name)}</option>`).join('') + '</select></div>' + (model.inviteCode ? '<p class="fine-print">Private invitation verified. Your invite code will accompany this request.</p>' : ''), confirm: 'Join operation', onConfirm: async () => { const nationId = $('#joinNation').value; if (!nationId) { toast('This operation has no available national commands.', true); return false; } const response = await client.command('join', { nationId, ...(model.inviteCode ? { inviteCode: model.inviteCode } : {}) }, id).catch(error => { toast(error.message, true); return null; }); if (!response) return false; adopt(response); if (!response.view) await openMatch(id); model.tab = 'operation'; render(); await map.focus(nationId); } }); return;
  }
  if (action === 'province') { model.provinceId = id; model.provinceFeature = map.provinces.get(id); render(); return; }
  if (action === 'select-unit') { selectUnits([id]); await focusSelectedUnit(id); return; }
  if (action === 'research') return mutate('research', { platformId: id }, 'Research programme accepted.');
  if (action === 'build') return mutate('build', { provinceId: model.provinceId, facility: id }, 'Construction order accepted.');
  if (action === 'produce') return mutate('produce', { provinceId: model.provinceId, platformId: id }, 'Production order accepted.');
  if (action === 'order-type') { model.orderType = id; model.pendingOrder = null; render(); return; }
  if (action === 'route-mode') { model.routeMode = !model.routeMode; model.orderType ||= 'move'; render(); return; }
  if (action === 'undo-waypoint') { const previous = model.pendingOrder?.waypoints?.at(-1); if (previous) { model.pendingOrder.targetProvinceId = previous; model.pendingOrder.targetName = map.provinces.get(previous)?.properties?.name || previous; model.pendingOrder.waypoints.pop(); } render(); return; }
  if (action === 'clear-selection') return selectUnits([]);
  if (action === 'cancel-order') { model.pendingOrder = null; model.orderType = null; model.routeMode = false; render(); return; }
  if (action === 'confirm-order') { const validation = validateOrder(model, model.pendingOrder); if (validation.blockers.length) { toast(validation.blockers[0], true); render(); return; } const { targetName, ...args } = model.pendingOrder; const response = await mutate('order', args, 'Order transmitted to your forces.'); if (response) { model.pendingOrder = null; model.orderType = null; model.routeMode = false; render(); } return; }
  if (action === 'direct-order') return mutate('order', { unitIds: model.selectedUnits, type: id }, `${titleCase(id)} order accepted.`);
  if (action === 'diplomacy') { const nation = model.nations.find(n => n.id === button.dataset.nation); showDialog({ eyebrow: 'FOREIGN AFFAIRS', title: `${titleCase(id)} · ${nation?.name || button.dataset.nation}`, body: `<p>${id === 'war' ? 'This will declare war and permit hostile actions. Review your forces and supply network before committing.' : 'Send this diplomatic proposal. Agreements take effect only when accepted under the world’s diplomatic rules.'}</p>`, confirm: id === 'war' ? 'Declare war' : 'Send proposal', danger: id === 'war', onConfirm: () => mutate('diplomacy', { nationId: button.dataset.nation, type: id }, 'Diplomatic action accepted.') }); return; }
  if (action === 'import-license') { showDialog({ eyebrow: 'TECHNOLOGY & TRADE', title: 'Request import license', body: '<p>A license permits eligible foreign equipment research and production. Diplomatic acceptance and the required domestic facilities still apply.</p>', confirm: 'Request license', onConfirm: () => mutate('diplomacy', { nationId: button.dataset.nation, type: 'import-license' }, 'Import license request sent.') }); return; }
  if (action === 'transfer-resources') {
    const nationId=button.dataset.nation;
    const recipient=model.view.nations.find(n=>n.id===nationId);
    const relation=()=>model.view.diplomacy?.find(row=>row.nationId===nationId)?.relation||model.view.nations.find(n=>n.id===nationId)?.relation;
    if(!['alliance','allied'].includes(relation())){toast('Accept a coalition before sending resources.',true);return;}
    const keys=['cash','supplies','fuel','electronics','manpower'];
    const limit=key=>Math.max(0,Math.min(100000000,Math.floor(Number(model.view.player.resources?.[key])||0)));
    showDialog({eyebrow:'COALITION LOGISTICS',title:`Send resources · ${recipient?.name||nationId}`,
      body:'<p>Transfer resources from your match economy to this coalition partner. Review the amounts before sending.</p><div class="form-grid">'+keys.map(key=>`<div class="dialog-field"><label class="field-label" for="transfer-${key}">${e(titleCase(key))}</label><input id="transfer-${key}" data-transfer-resource="${key}" type="number" inputmode="numeric" min="0" max="${limit(key)}" step="1" value="0"><p class="fine-print">Available: ${limit(key).toLocaleString()}</p></div>`).join('')+'</div>',
      confirm:'Send resources',onConfirm:async()=>{
        if(!['alliance','allied'].includes(relation())){toast('This nation is no longer a coalition partner.',true);return false;}
        const resources={};
        for(const key of keys){
          const input=$(`#transfer-${key}`),amount=input.value.trim()===''?0:Number(input.value);
          if(!Number.isSafeInteger(amount)||amount<0||amount>limit(key)){toast(`Enter a whole ${titleCase(key).toLowerCase()} amount from 0 to ${limit(key).toLocaleString()}.`,true);input.focus();return false;}
          if(amount>0)resources[key]=amount;
        }
        if(!Object.keys(resources).length){toast('Choose at least one resource amount to send.',true);return false;}
        const response=await mutate('diplomacy',{nationId,type:'transfer',resources},'Coalition resources transferred.');
        return Boolean(response);
      }});return;
  }
  if (['start', 'pause', 'resume', 'reward'].includes(action)) { const response = await mutate(action, {}, action === 'reward' ? 'Reward settlement confirmed by the server.' : `${titleCase(action)} accepted.`); if (response && action === 'reward') void vault.refresh().catch(() => {}); return; }
  if (action === 'retire') { showDialog({ title: 'Retire from this operation?', body: '<p>Retiring ends your command in this world. Your House balance is unaffected. Other commanders continue their campaign.</p>', confirm: 'Retire command', danger: true, onConfirm: async () => { const response = await mutate('retire'); if (response) leave(); return response ? true : false; } }); return; }
  if (action === 'leave') return leave();
  if (action === 'share') { const url = new URL(location.href); url.searchParams.set('match', model.view.match.id); const inviteCode = model.view.match.inviteCode || model.inviteCode; if (inviteCode) url.searchParams.set('invite', inviteCode); try { await navigator.clipboard.writeText(url.href); toast('Operation link copied.'); } catch { showDialog({ title: 'Operation link', body: `<p>Share this link with another commander.</p><input type="text" readonly value="${e(url.href)}" aria-label="Operation link">` }); } }
}
function bind() {
  document.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button && !button.disabled) void handleAction(button).catch(error => toast(error.message, true)); });
  document.addEventListener('toggle', event => { if (event.target.id === 'formationDetails') { const wasOpen = model.unitDetailsOpen; model.unitDetailsOpen = event.target.open; if (!wasOpen && event.target.open && innerWidth <= 700 && model.selectedUnits.length === 1) void focusSelectedUnit(model.selectedUnits[0]); } }, true);
  dom.lobby.addEventListener('input', event => {
    if (event.target.id === 'nationSearch') { model.search = event.target.value; $('#nationList').innerHTML = renderNationList(model); }
    if (event.target.id === 'matchName') model.name = event.target.value;
  });
  dom.lobby.addEventListener('change', event => { const fields = { template: 'template', opponentNation: 'opponentNationId', visibility: 'visibility' }; if (fields[event.target.id]) model[fields[event.target.id]] = event.target.value; });
  $('#mapZoomIn').onclick = () => map.zoom(1.4); $('#mapZoomOut').onclick = () => map.zoom(1 / 1.4); $('#mapHome').onclick = () => map.home();
  $('#retryConnection').onclick = () => { if (client?.blocked || !booted) location.reload(); else void refresh().catch(error => toast(error.message, true)); };
  $('#helpButton').onclick = () => showDialog({ title: 'The commander’s field guide', body: '<p>Build a national economy, research real equipment and control strategic provinces.</p><ul><li>Drag the map to pan. Scroll or pinch to zoom.</li><li>Select a province to construct facilities and produce units.</li><li>Select a formation, choose an order, then select and confirm its destination.</li><li>Shift-drag selects your formations on desktop.</li><li>Research has two parallel slots. Equipment requires appropriate facilities and national access.</li><li>Use diplomacy for peace, coalitions and foreign import licenses.</li><li>Solo worlds can pause. Multiplayer time continues while you are disconnected.</li></ul><p>Shortcuts: R research · I industry · D diplomacy · Escape close · + / − zoom · H whole world.</p>' });
  document.addEventListener('keydown', event => { if (event.target.matches('input,select,textarea') || dom.dialog.open || event.ctrlKey || event.metaKey) return; if (event.key === 'Escape') { model.tab = 'map'; model.pendingOrder = null; model.orderType = null; model.selectedUnits = []; model.routeMode = false; render(); } if (event.target !== map.canvas) { if (event.key.toLowerCase() === 'h') map.home(); if (event.key === '+' || event.key === '=') map.zoom(1.3); if (event.key === '-') map.zoom(1 / 1.3); } if (model.view) { const tabs = { r: 'research', i: 'industry', d: 'diplomacy' }; if (tabs[event.key.toLowerCase()]) { model.tab = tabs[event.key.toLowerCase()]; render(); } } });
  window.addEventListener('online', () => void refresh().catch(() => {}));
  window.addEventListener('offline', () => connection('offline', new Error('You are offline. Your world continues on the server.')));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh().catch(() => {}); });
  window.addEventListener('beforeunload', () => { clearInterval(polling); clearInterval(clockTimer); map.destroy(); client?.close(); vault?.close(); });
}
async function initialize() {
  map = new CommandMap($('#worldCanvas'), { onSelect: mapSelect, onUnits: selectUnits, onTarget: target, onError: error => toast(error.message, true), onHover: (hit, point) => { const tooltip = $('#mapTooltip'); tooltip.hidden = !hit; if (hit) { tooltip.textContent = hit.feature?.properties?.name || model.nations.find(n => n.id === hit.countryId)?.name || hit.countryId; tooltip.style.left = `${Math.min(point.x + 14, window.innerWidth - 220)}px`; tooltip.style.top = `${point.y + 18}px`; } } });
  model.provinceIndex = map.provinces;
  bind();
  const geography = (async () => { const response = await fetch('./assets/war/nations.json'); if (!response.ok) throw new Error('The nation directory is unavailable. Reconnect to try again.'); const data = await response.json(); model.nations = data.nations.filter(nation => nation.playable !== false).sort((a, b) => a.name.localeCompare(b.name)); map.setNations(model.nations); if (!model.nations.some(n => n.id === model.nationId)) model.nationId = model.nations[0]?.id; if (!model.nations.some(n => n.id === model.opponentNationId)) model.opponentNationId = model.nations.find(n => n.id !== model.nationId)?.id; await map.load(); $('#mapLoading').hidden = true; })();
  [vault] = await Promise.all([createVaultClient({ onStatus: (status, error) => { if (status === 'error' && error) toast(error.message, true); } }), geography]);
  model.legacy = vault.snapshot.progress?.campaign || null;
  const { data: { session } } = await supabase.auth.getSession(); model.userId = session?.user.id;
  client = createWarClient({ vault, onStatus: connection, onHint: hint => { if (hint.reconnect) { void refresh().catch(() => {}); return; } if (hint.matchId !== model.view?.match.id || hint.revision <= (hintRevisions.get(hint.matchId) ?? -1)) return; hintRevisions.set(hint.matchId, hint.revision); void refresh().catch(() => {}); } });
  await geography;
  const response = await client.command('list', model.inviteCode ? { inviteCode: model.inviteCode } : {}); model.worlds = response.matches || [];
  booted = true; dom.boot.hidden = true; dom.app.setAttribute('aria-busy', 'false'); render();
  const requested = new URL(location.href).searchParams.get('match');
  if (requested) {
    const candidate = model.worlds.find(match => match.id === requested);
    if (candidate?.joined || candidate?.hostId === model.userId) await openMatch(requested);
    else if (candidate) { model.lobbyTab = 'worlds'; render(); await handleAction({ dataset: { action: 'join-match', id: requested } }); }
    else { model.lobbyTab = 'worlds'; render(); toast('This operation is unavailable, full, or requires a valid private invitation.', true); }
  }
  void client.connect().catch(() => {});
  // Healthy private subscriptions fetch on observable changes. Use a slow
  // recovery read, with faster polling only while the channel is disconnected.
  polling = setInterval(() => { if (!document.hidden && (!model.view || !client.realtimeConnected || Date.now() - client.lastSync >= 300000)) void refresh().catch(() => {}); }, 30000);
  // Time interpolation is display-only; orders and every balance remain server-owned.
  clockTimer = setInterval(() => { if (model.view && !document.hidden) { const visible = displayView(); dom.clock.innerHTML = renderClock(visible); map.setDisplayTime(visible.match.gameTime); } }, 1000);
}
initialize().catch(error => { console.error('War command initialization failed', error); dom.app.setAttribute('aria-busy', 'false'); dom.boot.innerHTML = `<span class="eyebrow">UPLINK UNAVAILABLE</span><h1>Command is offline.</h1><p>${e(error.message)}</p><button class="button" id="bootRetry">Reconnect →</button>`; $('#bootRetry').onclick = () => location.reload(); });
