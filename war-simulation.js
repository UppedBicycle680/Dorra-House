import { normalizeCampaign } from './campaign-engine.js?v=20260830-depth10-qa3';
import { createCampaignController } from './campaign-controller.js?v=20260830-development12';
import { createVaultClient } from './vault-client.js';

const $ = selector => document.querySelector(selector);
const clone = value => structuredClone(value);
const money = value => `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`;
const compactMoney = value => {
  const amount = Math.max(0, Number(value) || 0);
  if (amount >= 1e12) return `$${(amount / 1e12).toFixed(amount >= 10e12 ? 1 : 2)}T`;
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(amount >= 10e9 ? 1 : 2)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(amount >= 10e6 ? 1 : 2)}M`;
  return money(amount);
};
const dom = { app: $('#strategicApp'), loading: $('#strategicLoading'), fatal: $('#strategicFatal'), fatalCopy: $('#strategicFatalCopy'), panel: $('#campaignPanel'), debrief: $('#campaignDebrief'), balance: $('#strategicBalance'), saveStatus: $('#strategicSaveStatus'), toast: $('#strategicToast') };

let vault = null;
let snapshot = null;
let campaignState = null;
let controller = null;
let toastTimer = 0;

function showToast(message, type = '') {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.className = `strategic-toast ${type} show`.trim();
  toastTimer = setTimeout(() => { dom.toast.className = 'strategic-toast'; }, 3300);
}

function updateSaveStatus(status, error = null) {
  if (!dom.saveStatus) return;
  dom.saveStatus.className = status;
  dom.saveStatus.innerHTML = `<i></i> ${status === 'saving' ? 'Saving…' : status === 'error' ? 'Save issue' : 'Saved'}`;
  if (status === 'error' && error) showToast(error.message || 'The protected save could not be updated.', 'error');
}

function renderSharedBalance() {
  dom.balance.textContent = compactMoney(snapshot?.balance);
  dom.balance.title = `${money(snapshot?.balance)} available in Dorra House`;
}

// All finance, progression, rewards, and campaign mutations are committed by
// the authenticated cloud API before the browser renders the new snapshot.
async function dispatchCampaign(action, args = {}) {
  const response = await vault.dispatch('campaign', action, args);
  snapshot = clone(response.snapshot);
  campaignState = snapshot.progress?.campaign ? normalizeCampaign(snapshot.progress.campaign) : null;
  renderSharedBalance();
  return { state: campaignState, event: response.result?.event || response.result };
}

function showFatal(error) {
  console.error('Strategic Command initialization failed', error);
  dom.loading.hidden = true;
  dom.panel.hidden = true;
  dom.fatal.hidden = false;
  dom.fatalCopy.textContent = error?.message || 'Close any other Dorra House tab, then reload this page.';
  dom.app.setAttribute('aria-busy', 'false');
}

async function returnToHouse(event) {
  event.preventDefault();
  const destination = event.currentTarget.href;
  try {
    updateSaveStatus('saving');
    await vault?.flush?.();
    controller?.dispose?.();
    vault?.close?.();
    location.href = destination;
  } catch (error) {
    updateSaveStatus('error', error);
  }
}

function bindStaticEvents() {
  document.querySelectorAll('[data-return-house]').forEach(link => link.addEventListener('click', returnToHouse));
  document.querySelector('[data-reload-page]')?.addEventListener('click', () => location.reload());
  globalThis.addEventListener('beforeunload', () => { controller?.dispose?.(); vault?.close?.(); });
}

async function initialize() {
  bindStaticEvents();
  vault = await createVaultClient({ onStatus: updateSaveStatus });
  snapshot = clone(vault.snapshot);
  snapshot.progress = snapshot.progress && typeof snapshot.progress === 'object' ? snapshot.progress : { level: 1, xp: 0, owned: [], equipped: {}, configurations: {}, vehicles: {} };
  snapshot.history = Array.isArray(snapshot.history) ? snapshot.history.slice(0, 8) : [];
  const savedCampaign = snapshot.progress.campaign;
  campaignState = savedCampaign && typeof savedCampaign === 'object' && !Array.isArray(savedCampaign) ? normalizeCampaign(savedCampaign) : null;
  if (campaignState) {
    campaignState.capitalUsd = snapshot.balance;
    campaignState.finance = { sharedBankLinked: true };
    snapshot.progress.campaign = clone(campaignState);
  }
  renderSharedBalance();
  controller = createCampaignController({
    panel: dom.panel,
    debrief: dom.debrief,
    getCampaign: () => campaignState,
    getBankBalance: () => snapshot.balance,
    dispatch: dispatchCampaign,
    toast: showToast,
    onError: error => showToast(error?.message || 'The 3D globe could not start.', 'error')
  });
  dom.loading.hidden = true;
  dom.panel.hidden = false;
  dom.app.setAttribute('aria-busy', 'false');
  controller.setActive(true);
}

initialize().catch(showFatal);
