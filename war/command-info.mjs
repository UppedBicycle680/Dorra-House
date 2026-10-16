import { PLATFORMS } from './catalog.mjs';

export function unitPlatform(unit, view) {
  return view?.catalog?.platforms?.find(platform => platform.id === unit.platformId) || PLATFORMS.find(platform => platform.id === unit.platformId) || null;
}
export const activeOrder = unit => Boolean(unit.order?.type);
const caps = (unit, view) => unitPlatform(unit, view)?.capabilities || [];
const isInterceptor = (unit, view) => unit.domain === 'missile' && caps(unit, view).includes('interceptor');

export function formationOrders(model) {
  const own = (model.view?.units || []).filter(unit => model.selectedUnits.includes(unit.id) && unit.nationId === model.view.player.nationId);
  if (!own.length) return [];
  const choices = ['move', 'attack', 'patrol', 'bombard', 'retreat', 'intercept', 'embark'];
  return choices.filter(type => own.every(unit => {
    const platform = unitPlatform(unit, model.view), capabilities = caps(unit, model.view);
    if (unit.domain === 'missile') return isInterceptor(unit, model.view) ? type === 'intercept' : type === 'attack';
    if (type === 'embark') return ['land', 'support'].includes(unit.domain);
    if (type === 'patrol') return ['air', 'sea'].includes(unit.domain);
    if (type === 'intercept') return Number(platform?.stats?.airDefense) > 0;
    if (type === 'bombard') return Number(platform?.stats?.range) > 5 && Number(platform?.stats?.attack) > 0;
    if (type === 'attack') return Number(platform?.stats?.attack) > 0 || capabilities.includes('capture');
    return true;
  })).map(type => {
    const busy = own.some(activeOrder);
    const canRetargetDefence = type === 'intercept' && own.every(unit => unit.domain !== 'air' && (!activeOrder(unit) || unit.order.type === 'intercept'));
    const canLeaveDefence = ['move', 'attack'].includes(type) && own.every(unit => !['air', 'missile'].includes(unit.domain) && (!activeOrder(unit) || unit.order.type === 'intercept'));
    const disabled = busy && !canRetargetDefence && !canLeaveDefence && (type !== 'retreat' || own.some(unit => unit.domain === 'missile'));
    return { type, disabled, reason: disabled ? 'This formation already has an order. Use Retreat to redirect it to friendly territory.' : '' };
  });
}

export function formationStatus(unit, gameTime = 0) {
  const order = unit.order;
  if (!order?.type) return { label: 'Ready for orders', remaining: null };
  const remaining = Number(order.arrival ?? order.returnDue) - Number(gameTime);
  if (order.sortie) return { label: 'On station · returning to base', remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : null };
  if (order.type === 'retreat') return { label: unit.domain === 'air' ? 'Returning to base' : 'Retreating', remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : null };
  if (order.type === 'intercept') return { label: 'Intercepting / air defence', remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : null };
  const names = { move: 'Moving', attack: 'Advancing to attack', patrol: 'Patrolling', bombard: 'Bombarding', embark: 'Embarking / sea transport', strike: 'Strike in flight' };
  return { label: names[order.type] || 'Executing order', remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : null };
}

export function orderGuidance(model) {
  const own = (model.view?.units || []).filter(unit => model.selectedUnits.includes(unit.id) && unit.nationId === model.view.player.nationId);
  if (!own.length) return '';
  if (own.every(unit => unit.domain !== 'air' && unit.order?.type === 'intercept')) return `Air defence active. Choose Intercept to change the defended friendly province.${own.every(unit => unit.domain !== 'missile') ? ' Move or Attack replaces this defence stance with a movement order.' : ''}`;
  if (own.some(unit => activeOrder(unit))) return 'An order is already active. Retreat redirects available formations toward friendly territory.';
  if (own.every(unit => isInterceptor(unit, model.view))) return 'Defensive interceptor: choose Intercept and select your own or an allied province.';
  if (own.some(unit => caps(unit, model.view).includes('strategic-nuclear'))) return 'Nuclear capability: a confirmed strike causes fallout and can harm friendly and neutral forces.';
  if (own.every(unit => unit.domain === 'missile')) return own.some(unit => caps(unit, model.view).includes('anti-ship')) ? 'Anti-ship weapon: select a detected hostile surface vessel or embarked transport, then confirm the strike.' : 'Single-use strike weapon. Select a hostile target within the platform’s range.';
  if (Number(model.view.player.resources?.fuel) === 0) return 'Fuel reserves are depleted. Movement and aircraft return flights require fuel.';
  if (Number(model.view.player.resources?.supplies) === 0) return 'Supplies are depleted. Combat support and field repairs may be reduced.';
  return '';
}

function relation(model, nationId) {
  if (nationId === model.view.player.nationId) return 'self';
  return model.view.diplomacy?.find(row => row.nationId === nationId)?.relation || model.view.nations?.find(nation => nation.id === nationId)?.relation || 'peace';
}
export function validateOrder(model, order) {
  const blockers = [], warnings = [];
  const units = model.view.units.filter(unit => order.unitIds.includes(unit.id));
  const province = model.view.provinces?.find(province => province.id === order.targetProvinceId);
  const ownerRelation = province ? relation(model, province.ownerId) : null;
  const targetUnit = order.targetUnitId ? model.view.units.find(unit => unit.id === order.targetUnitId) : null;
  const offensiveRelation = targetUnit ? relation(model, targetUnit.nationId) : ownerRelation;
  const targets = model.view.units.filter(unit => unit.provinceId === order.targetProvinceId && relation(model, unit.nationId) === 'war');
  for (const unit of units) {
    const capabilities = caps(unit, model.view);
    const stationaryDefence = order.type === 'intercept' && unit.domain !== 'air';
    if (isInterceptor(unit, model.view)) {
      if (order.type !== 'intercept') blockers.push('Interceptor missiles are defensive. Choose Intercept.');
    }
    if (stationaryDefence) {
      if (ownerRelation && !['self', 'alliance', 'allied'].includes(ownerRelation)) blockers.push('Deploy defensive interception in your own or an allied province.');
    } else if (order.type === 'intercept') {
      if (ownerRelation && !['self', 'alliance', 'allied', 'war', 'hostile', 'enemy'].includes(ownerRelation)) blockers.push('An interception sortie requires friendly, allied or hostile airspace.');
      warnings.push('Aircraft defend on station for one game hour, then return automatically.');
    } else if (['attack', 'bombard'].includes(order.type) && offensiveRelation && !['war', 'hostile', 'enemy'].includes(offensiveRelation)) blockers.push('Declare war before issuing an offensive order against this nation.');
    if (order.type === 'retreat' && province && province.ownerId !== model.view.player.nationId) blockers.push('Retreat requires a province under your control.');
    if (unit.domain === 'missile' && capabilities.includes('anti-ship')) {
      const surface = targets.filter(target => target.domain === 'sea' && !caps(target, model.view).includes('submarine'));
      const transportCandidate = targets.some(target => ['land', 'support'].includes(target.domain));
      if (!surface.length && !transportCandidate) blockers.push('This anti-ship weapon requires a detected hostile surface vessel or embarked transport at the target.');
      else if (!surface.length) warnings.push('An anti-ship strike can hit this formation only while it is embarked. Target eligibility is checked when you confirm.');
    }
    if (capabilities.includes('strategic-nuclear') || unitPlatform(unit, model.view)?.nuclear) warnings.push('Nuclear strike: fallout and collateral damage can affect friendly and neutral formations.');
    if (unit.domain === 'air' && ['attack', 'bombard'].includes(order.type) && !capabilities.some(capability => ['strike', 'multirole', 'precision-strike', 'strategic-strike', 'close-support', 'anti-armor'].includes(capability))) {
      const landTarget = targetUnit ? ['land', 'support'].includes(targetUnit.domain) : !targets.length || targets.every(target => ['land', 'support'].includes(target.domain));
      if (landTarget) warnings.push(`${unitPlatform(unit, model.view)?.name || 'This aircraft'} has no land-strike capability. A sortie against land formations will do no damage while they are ashore; choose a suitable naval target instead.`);
    }
    if (unit.domain === 'air' && ['move', 'retreat'].includes(order.type)) warnings.push('Aircraft require a friendly operational airfield or a compatible carrier with deck capacity.');
    if (order.type === 'embark') {
      const source = model.provinceIndex?.get(unit.provinceId)?.properties, target = model.provinceIndex?.get(order.targetProvinceId)?.properties;
      if (source?.port === false || target?.port === false) blockers.push('Embarkation and landing both require mapped ports.');
      else warnings.push('Transport uses permitted port routes; embarked formations are more vulnerable.');
    }
  }
  return { blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
}
