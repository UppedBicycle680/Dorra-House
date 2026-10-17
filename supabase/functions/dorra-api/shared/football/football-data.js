/*
 * Immutable reference data for the Queensland football club simulation.
 *
 * Real competition names, club names and the 2026 FQ Academy Rank Scores are
 * factual reference data. Strength, finance, facility, staffing and site
 * balance values are explicitly fictional gameplay assumptions.
 */

const deepFreeze=value=>{
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  Object.freeze(value);
  for(const child of Object.values(value))deepFreeze(child);
 }
 return value;
};

export const FOOTBALL_DATA_VERSION='2026.2';

export const FOOTBALL_DATA_SOURCES=deepFreeze({
 academyRankScores:{
  label:'Football Queensland 2026 Club Assessment Rank Scores (provisional v3)',
  url:'https://footballqueensland.com.au/2025/10/08/football-queensland-releases-2026-club-assessment-rank-scores/',
  imageUrl:'https://footballqueensland.com.au/wp-content/uploads/2025/10/2509006-General-FQ-Academy-Leagues-2026-Declaration-of-Leagues-Rank-Score-SM-v3.png',
  provisional:true
 },
 seniorLeagues:{
  label:'Football Queensland 2026 Provisional Declaration of NPL, FQPL 1 & 2 and Metro Men Leagues',
  url:'https://footballqueensland.com.au/2025/10/02/2026-fq-provisional-declaration-of-npl-fqpl-1-2-and-metro-men-leagues/',
  imageUrl:'https://footballqueensland.com.au/wp-content/uploads/2025/10/2509005-General-2026-Provisional-Declaration-of-Leagues-SEQ-Metro-Mens-3.png',
  provisional:true
 },
 advancedRules:{
  label:'2026 Football Queensland Advanced Leagues Rules of Competition',
  url:'https://footballqueensland.com.au/wp-content/uploads/2025/10/2026-Football-Queensland-Advanced-Leagues-Rules-of-Competition.pdf'
 },
 statewideRules:{
  label:'2026 Football Queensland Statewide Rules of Competition',
  url:'https://footballqueensland.com.au/wp-content/uploads/2025/12/2026-Statewide-Rules-of-Competition.pdf'
 },
 aLeague:{
  label:'2026/27 Isuzu UTE A-League fixture release',
  url:'https://aleagues.com.au/news/aleague-men-2026-2027-fixture-list-revealed-key-dates-fixture-information/'
 },
 localityBoundaries:{
  label:'Queensland Government Locality boundaries — Queensland',
  url:'https://www.data.qld.gov.au/dataset/locality-boundaries-queensland',
  note:'Locality identities are factual; site coordinates are approximate locality centroids, while parcels, costs, areas and gameplay scores are fictional.'
 },
 qplBranding:{
  label:'Football Queensland — Queensland Premier League brand from 2027',
  url:'https://footballqueensland.com.au/2026/08/04/queensland-premier-league-to-usher-in-a-bold-new-era-for-football-in-queensland/'
 }
});

export const ACADEMY_RATING_ORDER=deepFreeze([
 {id:'development-committed',name:'Development Committed',tier:2},
 {id:'bronze',name:'Bronze',tier:1},
 {id:'silver',name:'Silver',tier:1},
 {id:'gold',name:'Gold',tier:1}
]);

const academyRows=[
 [1,'moreton-city-excelsior','Moreton City Excelsior',97.3,'gold'],
 [2,'gold-coast-knights','Gold Coast Knights',93.5,'gold'],
 [3,'lions-fc','Lions FC',92.2,'gold'],
 [4,'logan-lightning','Logan Lightning',91.8,'gold'],
 [5,'brisbane-city','Brisbane City',91.3,'gold'],
 [6,'olympic-fc','Olympic FC',91.2,'gold'],
 [7,'eastern-suburbs','Eastern Suburbs',91.2,'gold'],
 [8,'gold-coast-united','Gold Coast United',91.1,'gold'],
 [9,'wynnum-wolves','Wynnum Wolves',90.6,'gold'],
 [10,'rochedale-rovers','Rochedale Rovers',90.6,'gold'],
 [11,'holland-park-hawks','Holland Park Hawks',86.5,'silver'],
 [12,'magic-united','Magic United',84.4,'silver'],
 [13,'mitchelton','Mitchelton FC',79.2,'silver'],
 [14,'brisbane-strikers','Brisbane Strikers',78.8,'silver'],
 [15,'sunshine-coast-wanderers','Sunshine Coast Wanderers',78.7,'silver'],
 [16,'ipswich-knights','Ipswich Knights',78.6,'silver'],
 [17,'caboolture-sports','Caboolture Sports FC',78.4,'silver'],
 [18,'virginia-united','Virginia United',75.1,'silver'],
 [19,'taringa-rovers','Taringa Rovers',74.8,'silver'],
 [20,'peninsula-power','Peninsula Power',74.3,'silver'],
 [21,'samford-rangers','Samford Rangers',71.0,'silver'],
 [22,'grange-thistle','Grange Thistle',70.2,'silver'],
 [23,'ipswich-fc','Ipswich FC',68.4,'silver'],
 [24,'capalaba-fc','Capalaba FC',67.5,'silver'],
 [25,'the-gap-fc','The Gap FC',66.0,'bronze'],
 [26,'north-lakes-united','North Lakes United',65.5,'bronze'],
 [27,'redlands-united','Redlands United',64.6,'bronze'],
 [28,'coomera-fc','Coomera FC',63.6,'bronze'],
 [29,'north-star','North Star',63.1,'bronze'],
 [30,'southside-eagles','Southside Eagles',60.8,'bronze'],
 [31,'swq-thunder','SWQ Thunder',59.0,'bronze'],
 [32,'robina-city','Robina City',57.9,'bronze'],
 [33,'southside-comets','Southside Comets',40.9,'development-committed'],
 [34,'across-the-waves','Across The Waves',36.8,'development-committed'],
 [35,'noosa-lions','Noosa Lions',35.8,'development-committed'],
 [36,'brothers-townsville','Brothers Townsville',35.5,'development-committed'],
 [37,'brighton-bulldogs','Brighton Bulldogs',35.0,'development-committed'],
 [38,'pine-hills','Pine Hills',34.7,'development-committed'],
 [39,'springfield-united','Springfield United',34.7,'development-committed'],
 [40,'ma-olympic','MA Olympic',34.6,'development-committed'],
 [41,'riverway-jcu','Riverway JCU',34.4,'development-committed'],
 [42,'mackay-wanderers','Mackay Wanderers',34.4,'development-committed'],
 [43,'uqfc','UQFC',34.4,'development-committed'],
 [44,'leichhardt-fc','Leichhardt FC',33.9,'development-committed']
];

export const ACADEMY_RANKINGS_2026=deepFreeze(academyRows.map(([rank,clubId,name,rankScore,rating])=>({
 rank,clubId,name,rankScore,rating,season:2026,sourceVersion:'v3',provisional:true,badgeKey:clubId,licensedLogoAsset:null
})));

// These clubs display a current shield on FQ's assessment page but did not
// have a numeric score in the v3 Rank Score declaration. No score is invented.
export const ACADEMY_UNSCORED_SHIELDS_2026=deepFreeze([
 {clubId:'northern-rivers',name:'Northern Rivers',rankScore:null,rating:'development-committed',season:2026},
 {clubId:'ormeau-fc',name:'Ormeau FC',rankScore:null,rating:'development-committed',season:2026}
]);

export const ACADEMY_FEE_BANDS=deepFreeze({
 'fqa-4':{league:'FQ Academy League 4',minAud:1500,maxAud:2000,recommendedAud:1750},
 'fqa-3':{league:'FQ Academy League 3',minAud:2000,maxAud:4000,recommendedAud:3000},
 'fqa-2':{league:'FQ Academy League 2',minAud:3000,maxAud:4000,recommendedAud:3500},
 'fqa-1':{league:'FQ Academy League 1',minAud:4000,maxAud:6000,recommendedAud:5000}
});

export const SENIOR_DIVISIONS=deepFreeze([
 {id:'fqpl-6',name:'FQPL 6 Metro',tier:7,promoteTo:'fqpl-5',relegateTo:null,promotionPlaces:2,relegationPlaces:0,weeklyBudgetMin:2500,weeklyBudgetMax:12000},
 {id:'fqpl-5',name:'FQPL 5 Metro',tier:6,promoteTo:'fqpl-4',relegateTo:'fqpl-6',promotionPlaces:2,relegationPlaces:2,weeklyBudgetMin:4000,weeklyBudgetMax:18000},
 {id:'fqpl-4',name:'FQPL 4 Metro',tier:5,promoteTo:'fqpl-3',relegateTo:'fqpl-5',promotionPlaces:2,relegationPlaces:2,weeklyBudgetMin:6000,weeklyBudgetMax:26000},
 {id:'fqpl-3',name:'FQPL 3 Metro',tier:4,promoteTo:'fqpl-2',relegateTo:'fqpl-4',promotionPlaces:1,relegationPlaces:2,playoffPlace:2,weeklyBudgetMin:9000,weeklyBudgetMax:40000},
 {id:'fqpl-2',name:'FQPL 2',tier:3,promoteTo:'fqpl-1',relegateTo:'fqpl-3',promotionPlaces:2,relegationPlaces:2,weeklyBudgetMin:14000,weeklyBudgetMax:65000,u23Linked:true},
 {id:'fqpl-1',name:'FQPL 1',tier:2,promoteTo:'npl-qld',relegateTo:'fqpl-2',promotionPlaces:2,relegationPlaces:2,weeklyBudgetMin:22000,weeklyBudgetMax:100000,u23Linked:true},
 {id:'npl-qld',name:'NPL Queensland',tier:1,promoteTo:null,relegateTo:'fqpl-1',promotionPlaces:0,relegationPlaces:2,weeklyBudgetMin:40000,weeklyBudgetMax:180000,u23Linked:true},
 {id:'a-league',name:'A-League Men',tier:0,promoteTo:null,relegateTo:null,promotionPlaces:0,relegationPlaces:0,weeklyBudgetMin:180000,weeklyBudgetMax:900000,licensedEntry:true}
]);

const team=(divisionId,id,name,gameStrength,clubId=id,extra={})=>({
 id,name,divisionId,clubId,gameStrength,badgeKey:clubId,fictional:false,...extra
});

export const SENIOR_LEAGUE_ROSTERS_2026=deepFreeze({
 'npl-qld':[
  team('npl-qld','moreton-city-excelsior','Moreton City Excelsior',84),
  team('npl-qld','lions-fc','Lions FC',83),
  team('npl-qld','peninsula-power','Peninsula Power',81),
  team('npl-qld','eastern-suburbs','Eastern Suburbs',80),
  team('npl-qld','gold-coast-knights','Gold Coast Knights',82),
  team('npl-qld','olympic-fc','Olympic FC',80),
  team('npl-qld','brisbane-city','Brisbane City',80),
  team('npl-qld','wynnum-wolves','Wynnum Wolves',78),
  team('npl-qld','gold-coast-united','Gold Coast United',79),
  team('npl-qld','brisbane-roar-npl','Brisbane Roar',77,'brisbane-roar'),
  team('npl-qld','magic-united','Magic United',76),
  team('npl-qld','rochedale-rovers','Rochedale Rovers',76)
 ],
 'fqpl-1':[
  team('fqpl-1','st-george-willawong','St George Willawong',74),
  team('fqpl-1','sunshine-coast-wanderers','Sunshine Coast Wanderers',73),
  team('fqpl-1','broadbeach-united','Broadbeach United',72),
  team('fqpl-1','brisbane-strikers','Brisbane Strikers',73),
  team('fqpl-1','logan-lightning','Logan Lightning',72),
  team('fqpl-1','redlands-united','Redlands United',70),
  team('fqpl-1','caboolture-sports','Caboolture Sports FC',69),
  team('fqpl-1','holland-park-hawks','Holland Park Hawks',69),
  team('fqpl-1','ipswich-fc','Ipswich FC',68),
  team('fqpl-1','capalaba-fc','Capalaba FC',67),
  team('fqpl-1','robina-city','Robina City',67),
  team('fqpl-1','north-star','North Star',66)
 ],
 'fqpl-2':[
  team('fqpl-2','swq-thunder','SWQ Thunder',65),
  team('fqpl-2','southside-eagles','Southside Eagles',65),
  team('fqpl-2','moreton-city-excelsior-b','Moreton City Excelsior',66,'moreton-city-excelsior',{isAdditionalTeam:true}),
  team('fqpl-2','grange-thistle','Grange Thistle',64),
  team('fqpl-2','taringa-rovers','Taringa Rovers',63),
  team('fqpl-2','brisbane-knights','Brisbane Knights',62),
  team('fqpl-2','samford-rangers','Samford Rangers',62),
  team('fqpl-2','souths-united','Souths United',61),
  team('fqpl-2','mitchelton','Mitchelton',61),
  team('fqpl-2','pine-hills','Pine Hills',60),
  team('fqpl-2','virginia-united','Virginia United',60),
  team('fqpl-2','caloundra','Caloundra',59)
 ],
 'fqpl-3':[
  team('fqpl-3','north-lakes-united','North Lakes United',58),
  team('fqpl-3','newmarket','Newmarket',57),
  team('fqpl-3','ac-carina','AC Carina',57),
  team('fqpl-3','ipswich-knights','Ipswich Knights',58),
  team('fqpl-3','mt-gravatt-hawks','Mt Gravatt Hawks',56),
  team('fqpl-3','springfield-united','Springfield United',56),
  team('fqpl-3','north-pine','North Pine',55),
  team('fqpl-3','yeronga-eagles','Yeronga Eagles',55),
  team('fqpl-3','redcliffe-dolphins','Redcliffe Dolphins',54),
  team('fqpl-3','uqfc','UQFC',54),
  team('fqpl-3','north-brisbane','North Brisbane',53),
  team('fqpl-3','logan-roos','Logan Roos',53),
  team('fqpl-3','moggill-fc','Moggill FC',52)
 ],
 'fqpl-4':[
  team('fqpl-4','centenary-stormers','Centenary Stormers',51),
  team('fqpl-4','bayside-united','Bayside United',51),
  team('fqpl-4','new-farm-united','New Farm United',50),
  team('fqpl-4','logan-metro','Logan Metro',50),
  team('fqpl-4','ripley-valley','Ripley Valley',49),
  team('fqpl-4','the-gap-fc','The Gap FC',49),
  team('fqpl-4','narangba-eagles','Narangba Eagles',48),
  team('fqpl-4','bardon-latrobe','Bardon Latrobe',48),
  team('fqpl-4','annerley','Annerley',47),
  team('fqpl-4','western-spirit','Western Spirit',47),
  team('fqpl-4','logan-village','Logan Village',46),
  team('fqpl-4','kangaroo-point-rovers','Kangaroo Point Rovers',46)
 ],
 'fqpl-5':[
  team('fqpl-5','ipswich-fc-b','Ipswich FC',45,'ipswich-fc',{isAdditionalTeam:true}),
  team('fqpl-5','acacia-ridge','Acacia Ridge',45),
  team('fqpl-5','westside-grovely','Westside Grovely',44),
  team('fqpl-5','fc-old-bridge','FC Old Bridge',44),
  team('fqpl-5','slacks-creek','Slacks Creek',43),
  team('fqpl-5','pine-rivers-fc','Pine Rivers FC',43),
  team('fqpl-5','jimboomba-united','Jimboomba United',42),
  team('fqpl-5','braza-fc','Braza FC',42),
  team('fqpl-5','bethania-rams','Bethania Rams',41),
  team('fqpl-5','willowburn-fc','Willowburn FC',41),
  team('fqpl-5','qut-fc','QUT FC',40),
  team('fqpl-5','ridge-hills','Ridge Hills',40)
 ],
 'fqpl-6':[
  team('fqpl-6','brighton-bulldogs','Brighton Bulldogs',39),
  team('fqpl-6','tarragindi-tigers','Tarragindi Tigers',39),
  team('fqpl-6','mooroondu','Mooroondu',38),
  team('fqpl-6','park-ridge','Park Ridge',38),
  team('fqpl-6','oxley-united','Oxley United',37),
  team('fqpl-6','acu','ACU',37),
  team('fqpl-6','teviot-downs','Teviot Downs',36),
  team('fqpl-6','bribie-island-tigers','Bribie Island Tigers',36),
  team('fqpl-6','north-lakes-united-b','North Lakes United',38,'north-lakes-united',{isAdditionalTeam:true}),
  team('fqpl-6','holland-park-hawks-b','Holland Park Hawks',38,'holland-park-hawks',{isAdditionalTeam:true})
 ]
});

export const A_LEAGUE_CLUBS_2026_27=deepFreeze([
 team('a-league','adelaide-united-a-league','Adelaide United',83,'adelaide-united',{city:'Adelaide',country:'AU'}),
 team('a-league','auckland-fc-a-league','Auckland FC',87,'auckland-fc',{city:'Auckland',country:'NZ'}),
 team('a-league','brisbane-roar-a-league','Brisbane Roar',80,'brisbane-roar',{city:'Brisbane',country:'AU'}),
 team('a-league','central-coast-mariners-a-league','Central Coast Mariners',81,'central-coast-mariners',{city:'Gosford',country:'AU'}),
 team('a-league','macarthur-fc-a-league','Macarthur Bulls',81,'macarthur-fc',{city:'Campbelltown',country:'AU'}),
 team('a-league','melbourne-city-a-league','Melbourne City',85,'melbourne-city',{city:'Melbourne',country:'AU'}),
 team('a-league','melbourne-victory-a-league','Melbourne Victory',84,'melbourne-victory',{city:'Melbourne',country:'AU'}),
 team('a-league','newcastle-jets-a-league','Newcastle Jets',87,'newcastle-jets',{city:'Newcastle',country:'AU'}),
 team('a-league','perth-glory-a-league','Perth Glory',78,'perth-glory',{city:'Perth',country:'AU'}),
 team('a-league','sydney-fc-a-league','Sydney FC',84,'sydney-fc',{city:'Sydney',country:'AU'}),
 team('a-league','wellington-phoenix-a-league','Wellington Phoenix',82,'wellington-phoenix',{city:'Wellington',country:'NZ'}),
 team('a-league','western-sydney-wanderers-a-league','Western Sydney Wanderers',82,'western-sydney-wanderers',{city:'Sydney',country:'AU'})
]);

const siteRows=[
 ['caboolture','Caboolture','Moreton Bay',-27.0847,152.9511,1_400_000,200_000,6.0,1,4,58,42],
 ['morayfield','Morayfield','Moreton Bay',-27.1089,152.9492,1_800_000,300_000,5.2,1,4,62,46],
 ['burpengary','Burpengary','Moreton Bay',-27.1570,152.9580,2_300_000,400_000,6.8,1,5,66,52],
 ['north-lakes','North Lakes','Moreton Bay',-27.2377,153.0177,8_500_000,3_000_000,3.4,1,3,78,76],
 ['brisbane-city','Brisbane City','Brisbane',-27.4698,153.0251,190_000_000,320_000_000,2.3,0,2,100,100],
 ['albion','Albion','Brisbane',-27.4297,153.0457,24_000_000,14_000_000,3.5,0,3,92,88],
 ['nudgee','Nudgee','Brisbane',-27.3692,153.0988,9_000_000,1_500_000,6.5,1,5,88,78],
 ['richlands','Richlands','Brisbane',-27.5969,152.9534,5_500_000,800_000,7.2,1,6,84,60],
 ['southport','Southport','Gold Coast',-27.9672,153.4131,85_000_000,120_000_000,2.8,0,2,98,96],
 ['carrara','Carrara','Gold Coast',-28.0210,153.3675,18_000_000,3_000_000,7.5,1,6,93,84],
 ['robina','Robina','Gold Coast',-28.0707,153.3930,28_000_000,10_000_000,4.2,1,4,96,93],
 ['coomera','Coomera','Gold Coast',-27.8535,153.3150,10_000_000,1_800_000,6.0,1,5,90,75],
 ['toowoomba-city','Toowoomba City','Toowoomba',-27.5598,151.9507,5_000_000,2_500_000,3.8,1,3,70,64],
 ['harristown','Harristown','Toowoomba',-27.5940,151.9265,2_800_000,500_000,5.8,1,4,66,54],
 ['highfields','Highfields','Toowoomba',-27.4580,151.9530,2_200_000,200_000,7.5,1,6,63,68],
 ['westbrook','Westbrook','Toowoomba',-27.6160,151.8680,1_400_000,100_000,10.0,1,8,56,60]
];

const siteTravelBurden={caboolture:64,morayfield:60,burpengary:68,'north-lakes':42,'brisbane-city':10,albion:16,nudgee:28,richlands:32,southport:20,carrara:26,robina:18,coomera:38,'toowoomba-city':48,harristown:52,highfields:60,westbrook:66};

function siteExpansionStages(site){
 const stages=[];
 for(let fieldNumber=site.readyFields+1;fieldNumber<=site.maxFields;fieldNumber++){
  const stageIndex=fieldNumber-site.readyFields;
  const sharedBase=900_000+Math.round(site.acquisitionCostAud*.008);
  const totalStageCostAud=Math.round(sharedBase*(1+(stageIndex-1)*.16)/10_000)*10_000;
  const brisbaneTowerStage=site.id==='brisbane-city';
  const fieldBuildCostAud=Math.min(totalStageCostAud,Math.round((650_000*(1+(stageIndex-1)*.16))/10_000)*10_000);
  const parcelPurchaseCostAud=totalStageCostAud-fieldBuildCostAud;
  stages.push({
   fieldNumber,buildCostAud:totalStageCostAud,fieldBuildCostAud,parcelPurchaseCostAud,buildDurationMs:60*60*1000,
   unlockedHectares:Math.round(site.lotHectares*fieldNumber/site.maxFields*100)/100,
   clearanceAllocationAud:brisbaneTowerStage?160_000_000:Math.round(site.initialClearanceCostAud/Math.max(1,site.maxFields-site.readyFields)),
   clearanceAlreadyFunded:true,clearanceUnits:brisbaneTowerStage?2:0,clearanceUnitName:brisbaneTowerStage?'tower':'site phase',
   demolition:{units:brisbaneTowerStage?2:0,unitName:brisbaneTowerStage?'tower':'site phase',costAllocationAud:brisbaneTowerStage?160_000_000:Math.round(site.initialClearanceCostAud/Math.max(1,site.maxFields-site.readyFields)),alreadyFundedAtFounding:true}
  });
 }
 return stages;
}

export const START_SITES=deepFreeze(siteRows.map(([id,name,region,lat,lng,acquisitionCostAud,initialClearanceCostAud,lotHectares,readyFields,maxFields,talent,wealth])=>{
 const site={
  id,name,region,lat,lng,acquisitionCostAud,initialClearanceCostAud,lotHectares,readyFields,maxFields,talent,wealth,
  travelBurden:siteTravelBurden[id],
  imageSrc:`./assets/football/sites/${id}.webp`,temporaryVenueWeeklyAud:readyFields===0?12_000:0,
  clearanceUnits:id==='brisbane-city'?4:0,clearanceUnitName:id==='brisbane-city'?'tower':'site phase',fictionalParcel:true,
  balanceNote:'Conceptual gameplay assumption; not a property appraisal.'
 };
 return {...site,expansionStages:siteExpansionStages(site)};
}));

export const SITE_REGIONS=deepFreeze([...new Set(START_SITES.map(site=>site.region))]);

const MINUTE_MS=60*1000;
const HOUR_MS=60*MINUTE_MS;

export const FACILITY_UPGRADES=deepFreeze([
 {id:'pitch',name:'Pitch quality',maxLevel:4,levels:[
  {level:1,name:'Community grass pitch',costAud:250_000,buildDurationMs:2*HOUR_MS,quality:8},
  {level:2,name:'Drainage and resurfacing',costAud:650_000,buildDurationMs:4*HOUR_MS,quality:16},
  {level:3,name:'Elite reinforced surface',costAud:1_800_000,buildDurationMs:12*HOUR_MS,quality:25},
  {level:4,name:'Stadium-grade hybrid pitch',costAud:4_800_000,buildDurationMs:24*HOUR_MS,quality:36}
 ]},
 {id:'training',name:'Training equipment',maxLevel:4,levels:[
  {level:1,name:'Core training kit',costAud:180_000,buildDurationMs:15*MINUTE_MS,development:6},
  {level:2,name:'Performance equipment',costAud:520_000,buildDurationMs:20*MINUTE_MS,development:12},
  {level:3,name:'Integrated performance lab',costAud:1_450_000,buildDurationMs:25*MINUTE_MS,development:20},
  {level:4,name:'Elite high-performance suite',costAud:3_800_000,buildDurationMs:30*MINUTE_MS,development:30}
 ]},
 {id:'drainage',name:'Pitch drainage',maxLevel:3,levels:[
  {level:1,name:'Surface drainage',costAud:280_000,buildDurationMs:2*HOUR_MS,reliability:10},
  {level:2,name:'Sand-slit drainage system',costAud:760_000,buildDurationMs:6*HOUR_MS,reliability:22},
  {level:3,name:'Elite subsurface drainage',costAud:1_900_000,buildDurationMs:12*HOUR_MS,reliability:36}
 ]},
 {id:'floodlights',name:'Floodlights',maxLevel:3,levels:[
  {level:1,name:'Community training lights',costAud:320_000,buildDurationMs:2*HOUR_MS,trainingAccess:6},
  {level:2,name:'Competition floodlights',costAud:980_000,buildDurationMs:6*HOUR_MS,trainingAccess:14},
  {level:3,name:'Broadcast-standard lighting',costAud:3_200_000,buildDurationMs:12*HOUR_MS,trainingAccess:24}
 ]},
 {id:'gym',name:'Strength and conditioning gym',maxLevel:3,levels:[
  {level:1,name:'Community weights room',costAud:260_000,buildDurationMs:30*MINUTE_MS,development:5,recovery:3},
  {level:2,name:'Performance gym',costAud:850_000,buildDurationMs:4*HOUR_MS,development:12,recovery:7},
  {level:3,name:'Elite strength centre',costAud:2_500_000,buildDurationMs:10*HOUR_MS,development:20,recovery:12}
 ]},
 {id:'academy',name:'Academy centre',maxLevel:4,levels:[
  {level:1,name:'Academy classrooms',costAud:350_000,buildDurationMs:2*HOUR_MS,academy:8},
  {level:2,name:'Player development centre',costAud:950_000,buildDurationMs:6*HOUR_MS,academy:16},
  {level:3,name:'Regional academy hub',costAud:2_400_000,buildDurationMs:12*HOUR_MS,academy:25},
  {level:4,name:'Elite academy campus',costAud:6_500_000,buildDurationMs:24*HOUR_MS,academy:36}
 ]},
 {id:'medical',name:'Medical facilities',maxLevel:3,levels:[
  {level:1,name:'Treatment room',costAud:240_000,buildDurationMs:30*MINUTE_MS,recovery:7},
  {level:2,name:'Sports medicine clinic',costAud:820_000,buildDurationMs:HOUR_MS,recovery:15},
  {level:3,name:'Rehabilitation centre',costAud:2_300_000,buildDurationMs:2*HOUR_MS,recovery:24}
 ]},
 {id:'analysis',name:'Analysis facilities',maxLevel:3,levels:[
  {level:1,name:'Video review room',costAud:160_000,buildDurationMs:15*MINUTE_MS,match:4},
  {level:2,name:'Data and opposition suite',costAud:580_000,buildDurationMs:25*MINUTE_MS,match:9},
  {level:3,name:'Integrated football intelligence centre',costAud:1_700_000,buildDurationMs:30*MINUTE_MS,match:15}
 ]},
 {id:'clubhouse',name:'Clubhouse',maxLevel:3,levels:[
  {level:1,name:'Community clubhouse',costAud:0,buildDurationMs:0,revenue:4},
  {level:2,name:'Function and hospitality rooms',costAud:1_100_000,buildDurationMs:6*HOUR_MS,revenue:11},
  {level:3,name:'Professional football headquarters',costAud:3_600_000,buildDurationMs:12*HOUR_MS,revenue:22}
 ]},
 {id:'stadium',name:'Spectator facilities',maxLevel:4,levels:[
  {level:1,name:'Covered community stand',costAud:900_000,buildDurationMs:4*HOUR_MS,capacity:1000},
  {level:2,name:'Regional ground',costAud:4_500_000,buildDurationMs:12*HOUR_MS,capacity:3500},
  {level:3,name:'NPL venue',costAud:14_000_000,buildDurationMs:24*HOUR_MS,capacity:8000},
  {level:4,name:'A-League-ready venue',costAud:75_000_000,buildDurationMs:24*HOUR_MS,capacity:18000}
 ]},
 {id:'fields',name:'Training fields',maxLevel:8,siteLimited:true,levels:Array.from({length:8},(_,index)=>({level:index+1,name:`${index+1}-field campus`,costAud:0,buildDurationMs:HOUR_MS,fields:index+1}))}
]);

export const STAFF_ROLES=deepFreeze([
 {id:'head-coach',name:'First-team coaching',maxLevel:4,weeklyWages:[0,2200,4800,8500,14000],hireCosts:[0,12000,30000,65000,120000],matchPerLevel:3},
 {id:'academy-director',name:'Academy coaching',maxLevel:4,weeklyWages:[0,1600,3400,6200,10500],hireCosts:[0,9000,24000,52000,95000],academyPerLevel:4},
 {id:'recruitment',name:'Recruitment and scouting',maxLevel:4,weeklyWages:[0,900,2100,4200,7600],hireCosts:[0,6000,16000,38000,76000],talentPerLevel:3},
 {id:'sports-science',name:'Sports science',maxLevel:3,weeklyWages:[0,1100,2700,5200],hireCosts:[0,7000,19000,43000],fatiguePerLevel:3},
 {id:'medical-team',name:'Medical staff',maxLevel:3,weeklyWages:[0,1200,2900,5600],hireCosts:[0,8000,21000,47000],recoveryPerLevel:4},
 {id:'grounds-team',name:'Ground staff',maxLevel:3,weeklyWages:[0,800,1800,3600],hireCosts:[0,5000,13000,30000],pitchPerLevel:3},
 {id:'analysts',name:'Performance analysts',maxLevel:3,weeklyWages:[0,1000,2400,4800],hireCosts:[0,6500,17500,40000],matchPerLevel:2}
]);

export const PLAYING_STYLES=deepFreeze([
 {id:'balanced',name:'Balanced',attack:0,control:0,variance:0,fatigue:1,academyDevelopment:0,description:'A stable shape with no extreme physical or tactical trade-off.'},
 {id:'possession',name:'Possession',attack:1,control:5,variance:-1,fatigue:1.08,academyDevelopment:2,description:'Patient circulation builds control and technical development.'},
 {id:'high-press',name:'High press',attack:4,control:2,variance:2,fatigue:1.32,academyDevelopment:1,description:'Win the ball high at the cost of significant fatigue.'},
 {id:'counterattack',name:'Counter-attacking',attack:3,control:-2,variance:3,fatigue:1.04,academyDevelopment:0,description:'Defend compactly and attack space with a volatile match profile.'},
 {id:'direct',name:'Direct and vertical',attack:2,control:-3,variance:4,fatigue:1.12,academyDevelopment:-1,description:'Create chances quickly while accepting less control.'},
 {id:'low-block',name:'Low block',attack:-2,control:-1,variance:-1,fatigue:.88,academyDevelopment:0,description:'Protect the penalty area, limit space and conserve energy.'},
 {id:'youth-first',name:'Youth development',attack:-2,control:1,variance:2,fatigue:1.02,academyDevelopment:5,description:'A patient identity that prioritises learning and academy pathways.'}
]);

export const TRAINING_INTENSITIES=deepFreeze([
 {id:'light',name:'Light',development:.65,fatigue:.55,match:-1},
 {id:'normal',name:'Normal',development:1,fatigue:1,match:0},
 {id:'high',name:'High',development:1.25,fatigue:1.45,match:2}
]);

export const FORMATION_PROFILES=deepFreeze({
 '4-3-3':{attack:2.2,control:1.8,defence:0,width:2,pressing:1,fatigue:1.06,description:'Wide attacking triangles and a strong front press.'},
 '4-4-2':{attack:.8,control:-.5,defence:1.2,width:1.5,pressing:.2,fatigue:1,description:'Two compact banks with two natural forwards.'},
 '4-2-3-1':{attack:1.2,control:2.4,defence:1.2,width:.5,pressing:.8,fatigue:1.04,description:'A double pivot supports controlled attacking play.'},
 '3-5-2':{attack:1.6,control:2.1,defence:-.3,width:-.6,pressing:.5,fatigue:1.08,description:'Midfield superiority with demanding wing-back coverage.'},
 '5-3-2':{attack:-.6,control:-.5,defence:3,width:-.4,pressing:-.6,fatigue:.94,description:'A protected penalty area with two counter-attacking outlets.'}
});

export const TRAINING_SESSION_EFFECTS=deepFreeze({
 rest:{load:0,recovery:4,development:0,familiarity:0,attack:0,control:0,defence:0,injuryRisk:-.12},
 recovery:{load:.25,recovery:6,development:.05,familiarity:.05,attack:0,control:0,defence:.15,injuryRisk:-.22},
 technical:{load:1.25,recovery:0,development:1.15,familiarity:.3,attack:.35,control:.8,defence:0,injuryRisk:.02},
 tactical:{load:1.05,recovery:0,development:.55,familiarity:1.35,attack:.15,control:.75,defence:.8,injuryRisk:0},
 fitness:{load:1.9,recovery:0,development:.75,familiarity:.1,attack:.45,control:0,defence:.35,injuryRisk:.18},
 'match-prep':{load:.85,recovery:0,development:.3,familiarity:1.05,attack:.65,control:.4,defence:.65,injuryRisk:-.02},
 'academy-development':{load:1.15,recovery:0,development:1.45,familiarity:.55,attack:.25,control:.35,defence:.25,injuryRisk:.02}
});

export const FOOTBALL_GAME_ASSUMPTIONS=deepFreeze({
 seasonWeeks:40,
 startingDivision:'fqpl-6',
 startingAcademyLeague:'fqa-4',
 dualRatingFeeAud:100_000,
 bTeamApplicationFeeAud:1_000_000,
 bTeamAnnualLicenceAud:250_000,
 aLeagueBidFeeAud:5_000_000,
 aLeagueCashReserveAud:10_000_000,
 startupLoanMaxAud:2_000_000,
 startupLoanAnnualRate:.08,
 startupLoanTermSeasons:5,
 temporaryVenueWeeklyAud:12_000,
 ticketPricesByTierAud:{0:38,1:24,2:21,3:18,4:16,5:15,6:14,7:13},
 academyEntryAndPlacement:'Annual placement is simulated from services and assessment; real FQ Academy leagues do not use promotion and relegation.',
 aLeagueEntry:'A-League entry is a fictional expansion/licensing bid, not automatic promotion from NPL Queensland.',
 priceBands:'Academy fee bands are user-supplied gameplay assumptions, not Football Queensland fee caps.',
 academyCalendar:'Five boys age groups (U13, U14, U15, U16 and U18) play 27 term-time weekend rounds. School-break league rounds are paused; training continues with variable attendance, and optional tournaments are calendar events rather than league fixtures.',
 sites:'Site parcels, acquisition values, clearance costs, hectares and market scores are fictional balance assumptions; acquisition and initial clearance are paid at founding.'
});

export const FOOTBALL_OBJECTIVES=deepFreeze([
 {id:'first-win',name:'First senior win',rewardTokens:2,description:'Win the first competitive senior match.'},
 {id:'positive-week',name:'Sustainable week',rewardTokens:2,description:'Finish a week with positive club cash flow.'},
 {id:'academy-assessed',name:'Assessed academy',rewardTokens:3,description:'Complete an annual academy assessment.'},
 {id:'gold-academy',name:'Gold development service',rewardTokens:8,description:'Earn the custom club Gold rating.'},
 {id:'npl-arrival',name:'Reach NPL Queensland',rewardTokens:8,description:'Guide the first team into NPL Queensland.'},
 {id:'a-league-admission',name:'National admission',rewardTokens:12,description:'Win a fictional A-League expansion licence.'}
]);

export const FOOTBALL_TOKEN_REWARDS=deepFreeze({promotion:8,premiership:15});

export function getSeniorDivision(id){return SENIOR_DIVISIONS.find(item=>item.id===id)||null}
export function getSeniorRoster(id){return id==='a-league'?A_LEAGUE_CLUBS_2026_27:SENIOR_LEAGUE_ROSTERS_2026[id]||[]}
export function getStartSite(id){return START_SITES.find(item=>item.id===id)||null}
export function getFacility(id){return FACILITY_UPGRADES.find(item=>item.id===id)||null}
export function getStaffRole(id){return STAFF_ROLES.find(item=>item.id===id)||null}
export function getPlayingStyle(id){return PLAYING_STYLES.find(item=>item.id===id)||null}
