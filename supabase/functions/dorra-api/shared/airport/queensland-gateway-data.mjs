// Original fictional airport. Keep granite-plains as the durable career key.
export const GATEWAY_ID = 'granite-plains';
export const GATEWAY_SCALE = .12;
export const GATEWAY_STANDS_PER_PRECINCT = 32;
export const GATEWAY_PRECINCTS = Object.freeze([
  {id:'A', name:'A · Queensland domestic', role:'Domestic connections', side:-1, y:-205, runwayX:-590, runwayY:-480, runway:'main', designators:['18L','36R'], colour:'#4e9f97'},
  {id:'B', name:'B · International', role:'Asia & the Pacific', side:1, y:-115, runwayX:410, runwayY:-230, runway:'east-north', designators:['19L','01R'], colour:'#719dcb'},
  {id:'C', name:'C · Regional Queensland', role:'Reef, Outback & regional links', side:-1, y:-25, runwayX:-500, runwayY:-435, runway:'west-centre', designators:['18C','36C'], colour:'#c7a565'},
  {id:'D', name:'D · Global connections', role:'Long-haul transfer hub', side:1, y:65, runwayX:500, runwayY:-185, runway:'east-centre', designators:['19C','01C'], colour:'#9b89b9'},
  {id:'E', name:'E · Pacific connections', role:'Trans-Tasman & island connections', side:-1, y:155, runwayX:-410, runwayY:-390, runway:'west-south', designators:['18R','36L'], colour:'#69a9b4'},
  {id:'F', name:'F · Queensland air freight', role:'Express freight & super-heavy cargo', side:1, y:245, runwayX:590, runwayY:-140, runway:'east-south', designators:['19R','01L'], colour:'#be9275'}
].map(p=>Object.freeze({...p,designators:Object.freeze(p.designators)})));
export const GATEWAY_GATE_COUNT = GATEWAY_PRECINCTS.length * GATEWAY_STANDS_PER_PRECINCT;
export const ribbonCentre = y => 42 * Math.sin((y + 220) / 530 * Math.PI * 2);
export function gatewayBank(side) {
  return {arrivalX:side*348,departureX:side*362,north:side<0?-530:-310,south:side<0?220:470};
}
export function gatewayPlot(plotId) {
  const index = Number(String(plotId).replace('plot-', '')) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= GATEWAY_GATE_COUNT) return null;
  const precinct = GATEWAY_PRECINCTS[Math.floor(index / GATEWAY_STANDS_PER_PRECINCT)];
  return {precinct, index, slot:index % GATEWAY_STANDS_PER_PRECINCT, label:`${precinct.id}${String(index % GATEWAY_STANDS_PER_PRECINCT + 1).padStart(2,'0')}`};
}
