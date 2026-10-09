/** Simulated airline services; these profiles are game choices, not timetables. */
export const SERVICE_PROFILES = Object.freeze([
  {id:'generic',name:'Open traffic',airline:'Independent operators',destination:'Queensland and beyond',description:'A balanced mix of every aircraft your stands can serve.',aircraftIds:null},
  {id:'training',name:'Local training circuits',airline:'Flying school',destination:'Local training circuit',description:'Cessna 172 training flights suited to your first airstrip.',aircraftIds:['c172']},
  {id:'scenic',name:'Scenic charters',airline:'Scenic charter operators',destination:'Queensland sightseeing',description:'Light-aircraft and King Air scenic charters.',aircraftIds:['c172','caravan','king-air']},
  {id:'regional',name:'Regional connections',airline:'Regional operators',destination:'Regional Queensland',description:'Light aircraft and regional turboprops on frequent local services.',aircraftIds:['c172','caravan','king-air','atr42','atr72','q400']},
  {id:'qantaslink',name:'QantasLink regional',airline:'QantasLink',destination:'Regional Queensland',description:'Simulated regional Dash 8 services.',aircraftIds:['q400']},
  {id:'qantas-domestic',name:'Qantas domestic',airline:'Qantas',destination:'Sydney / Melbourne',description:'Simulated Boeing 737 domestic connections.',aircraftIds:['b737']},
  {id:'qantas-international',name:'Qantas international',airline:'Qantas',destination:'Singapore / London',description:'Simulated Airbus A330 and A380 international services.',aircraftIds:['a330','a380']},
  {id:'jetstar',name:'Jetstar leisure',airline:'Jetstar',destination:'Sydney / Melbourne / Cairns',description:'Simulated Airbus A320 and A321 leisure services.',aircraftIds:['a320','a321']},
  {id:'virgin',name:'Virgin Australia domestic',airline:'Virgin Australia',destination:'Sydney / Melbourne',description:'Simulated Boeing 737 domestic connections.',aircraftIds:['b737']},
  {id:'emirates',name:'Emirates international',airline:'Emirates',destination:'Dubai',description:'Simulated Boeing 777, Airbus A350 and A380 services.',aircraftIds:['b777','a350','a380']},
  {id:'cargo',name:'Special cargo',airline:'Cargo charter operators',destination:'Global freight hubs',description:'Special C-5 and fictional An-225 heritage cargo operations.',aircraftIds:['c5','an225'],requiresCargo:true}
].map(service=>Object.freeze(service)));

export const SERVICE_BY_ID = Object.fromEntries(SERVICE_PROFILES.map(service=>[service.id,service]));
export const ROUTE_STRATEGIES = Object.freeze([
  {id:'frequent',name:'Frequent',cashMultiplier:.9,cycleMultiplier:.8,cashPercent:90,cyclePercent:80},
  {id:'standard',name:'Standard',cashMultiplier:1,cycleMultiplier:1,cashPercent:100,cyclePercent:100},
  {id:'premium',name:'Premium',cashMultiplier:1.25,cycleMultiplier:1.35,cashPercent:125,cyclePercent:135}
]);
export const STRATEGY_BY_ID = Object.fromEntries(ROUTE_STRATEGIES.map(strategy=>[strategy.id,strategy]));
export const PRESENCE_LEASE_MS = 15_000;
export const MAX_SPOTLIGHT_FLIGHTS = 3;
export const CONTRACT_ACTIVE_MS = 15 * 60_000;
export const INCIDENT_FALLBACK_MS = 300_000;
export const INCIDENT_RESPONSE_MS = 60_000;
export const INCIDENT_TYPES = Object.freeze([
  {type:'fire',title:'Ground equipment fire',description:'Dispatch the fire crew. This stand is temporarily closed.',responseMs:INCIDENT_RESPONSE_MS},
  {type:'fuel',title:'Fuel shortage',description:'Send the fuel crew to reopen this stand.',responseMs:30_000},
  {type:'baggage',title:'Baggage belt jam',description:'Send a ground crew to clear the affected stand.',responseMs:45_000}
]);
export function atcCost(airportOrder){return 250 * 4 ** airportOrder;}
export function flightTimings(airportId){
  if(airportId==='gold-coast')return {arrivalMs:45_000,taxiOutMs:34_000,departureMs:19_000};
  if(['archerfield','sunshine-coast'].includes(airportId))return {arrivalMs:40_000,taxiOutMs:26_000,departureMs:16_000};
  if(airportId==='hamilton-island')return {arrivalMs:40_000,taxiOutMs:22_000,departureMs:18_000};
  return {arrivalMs:32_000,taxiOutMs:14_000,departureMs:20_000};
}
