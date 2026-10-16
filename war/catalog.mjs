// Operator allowlists describe a conservative, source-backed subset of serving
// platforms, not complete national inventories. Costs, timers and combat numbers
// are original game balance. '*' is only used by labelled scenario capabilities.
export const CATALOG_VERSION = 'ne-5.1.2-war-1';
export const BRANCHES = Object.freeze([
  {id:'infantry',name:'Infantry'}, {id:'armor',name:'Armour'},
  {id:'artillery-air-defense',name:'Artillery & air defence'}, {id:'aviation',name:'Aviation'},
  {id:'naval',name:'Naval forces'}, {id:'missiles',name:'Missiles & deterrence'},
  {id:'intelligence-support',name:'Intelligence & support'}, {id:'industry',name:'Industry & command'}
]);
const BRANCH_MAP = Object.freeze({artillery:'artillery-air-defense','air-defense':'artillery-air-defense',fighters:'aviation',strike:'aviation',rotary:'aviation',drones:'aviation',sensors:'intelligence-support','electronic-warfare':'intelligence-support',logistics:'intelligence-support',nuclear:'missiles'});
export const FACILITIES = Object.freeze([
  {id:'army-base',name:'Army base',description:'Trains formations and supports land equipment.'},
  {id:'air-base',name:'Air base',description:'Aircraft operations, maintenance and air defence.'},
  {id:'naval-base',name:'Naval base',description:'Requires a province containing a source-mapped port.',requiresPort:true},
  {id:'missile-site',name:'Missile site',description:'Launch infrastructure and strategic security.'},
  {id:'intelligence-center',name:'Intelligence centre',description:'Detection, electronic support and secure command.'},
  {id:'arms-industry',name:'Arms industry',description:'Production, research and logistical capacity.'},
  {id:'radar',name:'Radar station',description:'Improves the province sensor picture and air warning.'},
  {id:'fortification',name:'Fortifications',description:'Defensive works improve the protection of a province garrison.'}
].map(item=>Object.freeze({...item,cost:{cash:1500,supplies:500,fuel:0,electronics:200,manpower:100},buildHours:6,maxLevel:5})));

export function facilityCost(facilityId,existingLevel=0) {
  if(!FACILITIES.some(item=>item.id===facilityId))throw new RangeError('Unknown facility.');
  if(!Number.isInteger(existingLevel)||existingLevel<0||existingLevel>=5)throw new RangeError('Facility level must be 0 through 4.');
  return {cash:1500*(existingLevel+1),supplies:500*(existingLevel+1),fuel:0,electronics:200*(existingLevel+1),manpower:100};
}
export function getFacilityQuote(facilityId,existingLevel=0) {
  return {facilityId,level:existingLevel+1,cost:facilityCost(facilityId,existingLevel),buildHours:6+6*existingLevel};
}
export function getResearchCost(platformOrId) {
  const item=typeof platformOrId==='string'?getPlatform(platformOrId):platformOrId;
  if(!item?.cost)throw new RangeError('Unknown platform.');
  return {cash:Math.max(200,item.cost.cash*.25),electronics:Math.max(100,item.cost.electronics*.5)};
}
export const researchCost=getResearchCost;

const SOURCE = Object.freeze({
  army:'https://api.army.mil/e2/c/downloads/2023/11/20/0f0da2ca/2023-u-s-army-acquisition-portfolio.pdf',
  british:'https://www.army.mod.uk/learn-and-explore/equipment/combat-vehicles/',
  leopard:'https://knds.com/en/products/leopard',
  french:'https://www.defense.gouv.fr/en/node/212',
  boxer:'https://www.defence.gov.au/defence-activities/projects/combat-reconnaissance-vehicle',
  bushmaster:'https://www.defence.gov.au/defence-activities/projects/protected-mobility-vehicle-technology-modernisation-bushmaster',
  k9:'https://www.hanwhaaerospace.com/eng/media/newsroom/view.do?seq=612',
  k2:'https://www.hyundai-rotem.co.kr/ko/company/press/details.do?seq=2635',
  airforce:'https://www.af.mil/About-Us/Fact-Sheets/Aircraft-Factsheets/',
  f16:'https://www.lockheedmartin.com/content/dam/lockheed-martin/aero/documents/F-16FastFactsSeptember2023.pdf',
  f35:'https://www.lockheedmartin.com/f35/about/fast-facts.html',
  hornet:'https://www.boeing.com/defense/fighters-and-bombers/fa-18-super-hornet-and-ea-18-growler',
  rafale:'https://www.dassault-aviation.com/en/defense/rafale/introduction/',
  gripen:'https://www.saab.com/products/gripen-c-series',
  typhoon:'https://www.eurofighter.com/the-programme',
  rostec:'https://rostec.ru/upload/iblock/3db/3x1o2vwzm72hl2zua9eq1hj1elprrn99.pdf',
  china:'https://eng.chinamil.com.cn/CHINA_209163/WeaponryEquipment/News_209182/index.html',
  drdo:'https://drdo.gov.in/drdo/en/offerings/products/brahmos',
  tb2:'https://www.baykartech.com/en/press/indigenous-ucav-bayraktar-tb2-completes-750-thousand-flight-hours/',
  nasams:'https://www.kongsberg.com/what-we-do/defence-and-security/integrated-air-and-missile-defence/nasams-air-defence-system/',
  patriot:'https://www.rtx.com/raytheon/what-we-do/integrated-air-and-missile-defense/global-patriot-solutions',
  himars:'https://www.lockheedmartin.com/en-us/products/himars.html',
  aster:'https://www.mbda-systems.com/products/area-protection/aster-family/aster',
  navy:'https://www.navy.mil/Resources/Fact-Files/',
  royalnavy:'https://www.royalnavy.mod.uk/equipment/ships',
  aunavy:'https://www.navy.gov.au/capabilities/ships-boats-and-submarines',
  navyfr:'https://www.defense.gouv.fr/marine/equipements',
  navyin:'https://www.indiannavy.nic.in/content/ships',
  nsm:'https://www.kongsberg.com/what-we-do/defence-and-security/strike-missiles/naval-strike-missile/',
  tomahawk:'https://www.navy.mil/Resources/Fact-Files/Display-FactFiles/Article/2169229/tomohawk-cruise-missile/tomahawk-cruise-missile/',
  radar:'https://www.saab.com/products/giraffe-amb',
  trident:'https://commonslibrary.parliament.uk/research-briefings/cbp-10275/',
  minuteman:'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104466/lgm-30g-minuteman-iii/',
  nuclear:'https://www.un.org/en/about-us/un-charter/chapter-7',
});

const CARRIER_VARIANTS = Object.freeze({
  'fa18-super-hornet': {operators:{US:'F/A-18E/F'},sources:[SOURCE.hornet]},
  f35: {operators:{US:'F-35B/C',GB:'F-35B',IT:'F-35B'},sources:[
    'https://www.airpac.navy.mil/Portals/53/Documents/DVBrief2025.pdf',
    'https://www.royalnavy.mod.uk/equipment/aircraft/f-35',
    'https://www.marina.difesa.it/media-cultura/press-room/comunicati/Pagine/20240824_la-marina_militare_dichiara_la_capacita_componene_f35b.aspx'
  ]},
  rafale: {operators:{FR:'Rafale M'},sources:['https://www.dassault-aviation.com/en/defense/rafale/a-fully-optimized-airframe/']}
});

function platform(id,name,domain,branch,operators,level,sourceUrl,stats={},capabilities=[],extra={}) {
  const facility = domain==='land'?'army-base':domain==='air'?'air-base':domain==='sea'?'naval-base':domain==='missile'?'missile-site':branch==='industry'?'arms-industry':'intelligence-center';
  const weight=domain==='sea'?4:domain==='air'?2.3:domain==='missile'?2.6:1;
  const item={id,name,domain,branch:BRANCH_MAP[branch]||branch,role:branch,operators,level,facility,sourceUrl,
    description:extra.description || `${name}: ${branch.replaceAll('-',' ')} capability.`,
    cost:{cash:Math.round(450*level*weight),supplies:Math.round(80*level*weight),fuel:Math.round((domain==='land'?25:domain==='support'?5:65)*level),electronics:Math.round((domain==='land'?15:65)*level),manpower:domain==='sea'?120:domain==='land'?100:30},
    researchHours:level===1?.5:level*2,buildHours:Math.max(.5,level*weight),
    prerequisites:level>=4?['networked-command']:level>=2?['combined-arms-doctrine']:[],
    stats:{attack:8,defense:8,range:5,speed:35,vision:30,stealth:0,radar:0,airDefense:0,...stats},
    capabilities,serviceStatus:'in-service',balanceNotice:'Costs, timers and combat values are game abstractions, not technical specifications.',...extra};
  item.researchCost=getResearchCost(item);
  // Import licences are a game diplomacy mechanism. Conservatively permit
  // named hardware exports only where the authored roster already documents
  // multiple operators; nuclear and unique domestic-only programmes stay closed.
  item.exportable=extra.exportable ?? (!item.nuclear&&!item.abstractCapability&&operators.length>1);
  const deck=CARRIER_VARIANTS[id];
  item.carrierOperators=deck?Object.keys(deck.operators):[];
  if(deck){
    item.carrierVariants=deck.operators;item.carrierSourceUrls=deck.sources;
    item.carrierNote='Family-level programme: carrier basing represents only these documented national naval variants; land-based variants and other operator fleets are excluded.';
  }
  return Object.freeze(item);
}
const p=platform;
export const PLATFORMS = Object.freeze([
  p('infantry-company','Infantry company','land','infantry',['*'],1,SOURCE.army,{attack:10,defense:16,range:2,speed:12,vision:20},['capture','garrison'],{abstractCapability:true,description:'Scenario-raised personnel formation. No specific weapon model or national inventory is asserted.',researchHours:0,buildHours:.5,cost:{cash:250,supplies:60,fuel:0,electronics:0,manpower:100}}),
  p('combat-engineers','Combat engineers','land','logistics',['*'],1,SOURCE.army,{attack:4,defense:10,speed:18},['repair','entrench','capture'],{abstractCapability:true,description:'Scenario engineering personnel for repair and logistics; not a claimed hardware inventory.'}),
  p('combined-arms-doctrine','Combined arms doctrine','support','industry',['*'],1,SOURCE.army,{attack:0,defense:0,speed:0},['doctrine'],{abstractCapability:true,description:'Game research programme coordinating infantry, fires and logistics.',buildable:false,researchHours:1}),
  p('networked-command','Networked command','support','industry',['*'],2,SOURCE.army,{attack:0,defense:0,speed:0,vision:60},['command','sensor-fusion'],{abstractCapability:true,description:'Game research programme for secure command and sensor coordination.',buildable:false,researchHours:6}),
  p('logistics-column','Logistics column','support','logistics',['*'],1,SOURCE.army,{attack:1,defense:4,speed:35,vision:20},['resupply','repair'],{abstractCapability:true,description:'Scenario transport and supply capacity. Vehicles are not attributed to any manufacturer.'}),
  p('field-observers','Field observers','support','sensors',['*'],1,SOURCE.army,{attack:1,defense:3,speed:18,vision:90,stealth:20},['recon'],{abstractCapability:true,description:'Personnel reconnaissance capability; game visibility is not a real detection range.'}),
  p('m1a2-abrams','M1A2 Abrams','land','armor',['US','AU','PL'],3,SOURCE.army,{attack:38,defense:46,speed:42,vision:35},['armor','capture'],{operatorSources:{AU:'https://www.defence.gov.au/news-events/news/2022-01-12/enhancing-adfs-armoured-combat-capability',PL:'https://www.gov.pl/web/national-defence/abrams-tanks-for-poland'}}),
  p('leopard-2','Leopard 2','land','armor',['DE','CA','PL','FI','NO','GR','ES','SE','DK','CH','AT','TR','SG','UA','PT'],3,SOURCE.leopard,{attack:37,defense:44,speed:45},['armor','capture'],{operatorNote:'Family-level representation; national variants are not asserted interchangeable.'}),
  p('challenger-2','Challenger 2','land','armor',['GB','UA'],3,SOURCE.british,{attack:36,defense:47,speed:35},['armor','capture'],{operatorSources:{UA:'https://www.gov.uk/government/news/uk-military-support-for-ukraine-factsheet'}}),
  p('leclerc','Leclerc','land','armor',['FR'],3,SOURCE.french,{attack:38,defense:41,speed:47},['armor','capture']),
  p('k2-black-panther','K2 Black Panther','land','armor',['KR','PL'],3,SOURCE.k2,{attack:39,defense:43,speed:48},['armor','capture']),
  p('t90','T-90','land','armor',['RU','IN'],3,'https://roe.ru/eng/catalog/land-forces/tanks/t-90ms/',{attack:35,defense:40,speed:40},['armor','capture'],{operatorNote:'T-90 family representation; export brochure does not imply all operators field the MS variant.'}),
  p('type99a','ZTZ-99A','land','armor',['CN'],3,SOURCE.china,{attack:37,defense:43,speed:42},['armor','capture']),
  p('merkava-mk4','Merkava Mk 4','land','armor',['IL'],3,'https://www.idf.il/en/mini-sites/technology-and-innovation/',{attack:36,defense:48,speed:36},['armor','capture']),
  p('m2-bradley','M2 Bradley','land','infantry',['US','UA'],2,SOURCE.army,{attack:24,defense:26,speed:38},['mechanized','capture'],{operatorSources:{UA:'https://www.defense.gov/News/Releases/Release/Article/3263970/285-billion-in-additional-security-assistance-for-ukraine/'}}),
  p('boxer-crv','Boxer CRV','land','infantry',['AU'],2,SOURCE.boxer,{attack:22,defense:27,speed:55,vision:50},['recon','capture']),
  p('bushmaster','Bushmaster PMV','land','infantry',['AU'],1,SOURCE.bushmaster,{attack:13,defense:20,speed:50},['protected-mobility','capture']),
  p('warrior-ifv','Warrior IFV','land','infantry',['GB'],2,SOURCE.british,{attack:23,defense:25,speed:38},['mechanized','capture']),
  p('btr82a','BTR-82A','land','infantry',['RU'],2,SOURCE.rostec,{attack:21,defense:20,speed:50},['mechanized','capture']),
  p('m109-paladin','M109 Paladin','land','artillery',['US'],2,SOURCE.army,{attack:34,defense:12,range:32,speed:30},['indirect-fire']),
  p('k9-thunder','K9 Thunder','land','artillery',['KR','PL','NO','FI','EE','IN','TR'],2,SOURCE.k9,{attack:35,defense:14,range:40,speed:35},['indirect-fire'],{operatorNote:'Includes documented licensed K9-derived national versions; new orders without delivery are excluded.'}),
  p('caesar','CAESAR','land','artillery',['FR','UA','CZ','ID','TH'],2,'https://knds.com/en/products/caesar',{attack:33,defense:9,range:40,speed:50},['indirect-fire']),
  p('m142-himars','M142 HIMARS','land','artillery',['US','PL','RO','UA','SG'],3,SOURCE.himars,{attack:43,defense:9,range:80,speed:48},['rocket-artillery']),
  p('pantsir-s1','Pantsir-S1','land','air-defense',['RU'],2,SOURCE.rostec,{attack:10,defense:15,range:20,radar:90,airDefense:38},['radar','point-defense','anti-drone']),
  p('patriot','Patriot','land','air-defense',['US','DE','NL','JP','KR','PL','RO','UA','ES','GR','SA','AE','KW','QA','TW'],3,SOURCE.patriot,{attack:3,defense:15,range:90,speed:22,radar:180,airDefense:60},['radar','air-defense','missile-defense']),
  p('nasams','NASAMS','land','air-defense',['NO','US','ES','NL','FI','LT','AU','HU','ID','QA','OM','UA'],2,SOURCE.nasams,{attack:3,defense:12,range:40,radar:130,airDefense:44},['radar','air-defense']),
  p('s400','S-400','land','air-defense',['RU','CN','IN','TR'],4,SOURCE.rostec,{attack:4,defense:17,range:150,speed:22,radar:230,airDefense:65},['radar','air-defense','missile-defense']),
  p('f16','F-16 Fighting Falcon','air','fighters',['US','BE','IL','KR','PT','EG','PK','SG','GR','TH','ID','BH','VE','TW','JO','AE','TR','PL','RO','MA','IQ','OM','UA','SK','BG'],2,SOURCE.f16,{attack:29,defense:25,range:650,speed:900,vision:100,radar:110,airDefense:27},['air-superiority','strike'],{operatorNote:'Serving family variants only; retired Danish, Norwegian, Dutch and Italian fleets are excluded.'}),
  p('f35','F-35 Lightning II','air','fighters',['US','GB','IT','NL','AU','DK','NO','IL','JP','KR','BE','PL'],4,SOURCE.f35,{attack:43,defense:37,range:900,speed:850,vision:170,stealth:75,radar:180,airDefense:42},['stealth','sensor-fusion','strike']),
  p('f22','F-22 Raptor','air','fighters',['US'],4,SOURCE.airforce,{attack:45,defense:43,range:850,speed:1000,vision:160,stealth:82,radar:180,airDefense:60},['stealth','air-superiority']),
  p('fa18-super-hornet','F/A-18E/F Super Hornet','air','fighters',['US','AU','KW'],3,SOURCE.hornet,{attack:34,defense:31,range:750,speed:850,vision:130,radar:140,airDefense:34},['carrier-capable','multirole']),
  p('rafale','Rafale','air','fighters',['FR','EG','IN','QA','GR','HR'],3,SOURCE.rafale,{attack:37,defense:34,range:800,speed:900,vision:130,radar:140,airDefense:38},['multirole','electronic-protection'],{operatorNote:'Delivered serving operators; UAE, Serbia and unverified first-delivery dates are excluded.'}),
  p('eurofighter-typhoon','Eurofighter Typhoon','air','fighters',['GB','DE','IT','ES','AT','SA','OM','KW','QA'],3,SOURCE.typhoon,{attack:35,defense:35,range:800,speed:1000,vision:140,radar:150,airDefense:44},['air-superiority','multirole']),
  p('gripen','JAS 39 Gripen','air','fighters',['SE','CZ','HU','ZA','TH','BR'],2,SOURCE.gripen,{attack:29,defense:29,range:650,speed:900,vision:120,radar:130,airDefense:34},['dispersed-basing','multirole'],{operatorNote:'C/D/E family representation, not identical national configurations.'}),
  p('su35','Su-35','air','fighters',['RU','CN'],3,'https://uacrussia.ru/en/aircraft/lineup/military/su-35/',{attack:37,defense:34,range:900,speed:950,vision:130,radar:145,airDefense:42},['air-superiority']),
  p('su30','Su-30','air','fighters',['RU','IN','DZ','VN','MY'],2,'https://uacrussia.ru/en/aircraft/lineup/military/su-30sm/',{attack:32,defense:28,range:850,speed:900,vision:120,radar:130,airDefense:33},['multirole'],{operatorNote:'Su-30 family; national variants have materially different sensors and avionics.'}),
  p('j20','J-20','air','fighters',['CN'],4,SOURCE.china,{attack:42,defense:36,range:1000,speed:950,vision:170,stealth:70,radar:170,airDefense:45},['stealth','air-superiority']),
  p('jf17','JF-17 Thunder','air','fighters',['PK'],2,'https://www.pac.org.pk/jf-17',{attack:26,defense:23,range:650,speed:850,vision:100,radar:110,airDefense:28},['multirole']),
  p('tejas','LCA Tejas','air','fighters',['IN'],2,'https://hal-india.co.in/lca-tejas',{attack:27,defense:25,range:600,speed:850,vision:105,radar:115,airDefense:30},['multirole']),
  p('b2-spirit','B-2 Spirit','air','strike',['US'],5,'https://www.afgsc.af.mil/About/Fact-Sheets/Article/630717/b-2-spirit/',{attack:68,defense:26,range:2200,speed:700,vision:100,stealth:90,radar:60},['stealth','strategic-strike']),
  p('b52','B-52H Stratofortress','air','strike',['US'],3,SOURCE.airforce,{attack:56,defense:18,range:2000,speed:650,vision:80,radar:60},['strategic-strike','stand-off']),
  p('tu160','Tu-160','air','strike',['RU'],4,'https://uacrussia.ru/en/aircraft/lineup/military/tu-160/',{attack:58,defense:22,range:2000,speed:850,vision:90,radar:70},['strategic-strike','stand-off']),
  p('ah64-apache','AH-64 Apache','air','rotary',['US','GB','NL','IL','JP','KR','SG','IN','GR','EG','SA','AE'],2,'https://www.boeing.com/defense/helicopters/ah-64-apache',{attack:32,defense:17,range:250,speed:200,vision:70,radar:65,airDefense:5},['anti-armor','close-support']),
  p('ka52','Ka-52','air','rotary',['RU','EG'],2,'https://www.rhc.aero/en/catalog/ka-52',{attack:32,defense:18,range:250,speed:200,vision:65,radar:60,airDefense:5},['anti-armor','close-support']),
  p('mq9-reaper','MQ-9 Reaper','air','drones',['US','GB','FR','IT','ES','NL'],2,'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104470/mq9-reaper/mq-9-reaper/',{attack:21,defense:8,range:1000,speed:250,vision:160,stealth:18,radar:50},['persistent-isr','precision-strike']),
  p('bayraktar-tb2','Bayraktar TB2','air','drones',['TR','UA','AZ','QA','PL'],1,SOURCE.tb2,{attack:14,defense:6,range:400,speed:150,vision:100,stealth:15},['isr','precision-strike']),
  p('ea18g-growler','EA-18G Growler','air','electronic-warfare',['US','AU'],4,SOURCE.hornet,{attack:15,defense:27,range:750,speed:800,vision:160,radar:190,airDefense:18},['electronic-attack','radar-suppression','signals-intelligence'],{statsNote:'Electronic effects use game modifiers and reveal chances, not actual frequencies or tactics.'}),
  p('e7-wedgetail','E-7 Wedgetail','air','sensors',['AU','KR','TR'],3,'https://www.boeing.com/defense/airborne-early-warning-and-control',{attack:1,defense:13,range:1200,speed:650,vision:260,radar:300},['airborne-radar','command']),
  p('rq4-global-hawk','RQ-4 Global Hawk','air','sensors',['US','KR','JP'],3,SOURCE.airforce,{attack:0,defense:7,range:1800,speed:500,vision:230,radar:130},['high-altitude-isr']),
  p('giraffe-amb','Giraffe AMB','support','sensors',['SE','GB'],2,SOURCE.radar,{attack:0,defense:7,speed:30,vision:160,radar:180},['ground-radar','air-picture']),
  p('arleigh-burke','Arleigh Burke class','sea','naval',['US'],4,'https://www.navy.mil/Resources/Fact-Files/Display-FactFiles/Article/2169871/destroyers-ddg/no/destroyers-ddg-51/',{attack:60,defense:58,range:180,speed:45,vision:200,radar:240,airDefense:62},['destroyer','air-defense','anti-submarine','cruise-missiles']),
  p('virginia-class','Virginia class','sea','naval',['US'],4,SOURCE.navy,{attack:60,defense:42,range:140,speed:40,vision:130,stealth:85,radar:0},['submarine','anti-ship','cruise-missiles','sonar']),
  p('nimitz-class','Nimitz class','sea','naval',['US'],5,SOURCE.navy,{attack:18,defense:68,range:150,speed:40,vision:180,radar:220,airDefense:32},['carrier','air-base-at-sea']),
  p('type45','Type 45 destroyer','sea','naval',['GB'],4,SOURCE.royalnavy,{attack:37,defense:53,range:150,speed:40,vision:220,radar:270,airDefense:65},['destroyer','air-defense']),
  p('astute-class','Astute class','sea','naval',['GB'],4,SOURCE.royalnavy,{attack:57,defense:41,range:130,speed:40,vision:140,stealth:85},['submarine','sonar','cruise-missiles']),
  p('queen-elizabeth-class','Queen Elizabeth class','sea','naval',['GB'],5,SOURCE.royalnavy,{attack:13,defense:61,range:130,speed:36,vision:170,radar:200,airDefense:20},['carrier','air-base-at-sea']),
  p('hobart-class','Hobart class','sea','naval',['AU'],4,SOURCE.aunavy,{attack:48,defense:52,range:150,speed:40,vision:200,radar:240,airDefense:55},['destroyer','air-defense','anti-submarine']),
  p('collins-class','Collins class','sea','naval',['AU'],3,SOURCE.aunavy,{attack:45,defense:30,range:100,speed:27,vision:110,stealth:78},['submarine','sonar','anti-ship']),
  p('fremm','FREMM frigate','sea','naval',['FR','IT','EG','MA'],3,'https://www.naval-group.com/en/surface-ships',{attack:43,defense:44,range:130,speed:38,vision:165,radar:180,airDefense:35},['frigate','anti-submarine','sonar']),
  p('scorpene','Scorpene submarine','sea','naval',['CL','MY','IN','BR'],3,'https://www.naval-group.com/en/submarines',{attack:43,defense:31,range:90,speed:25,vision:100,stealth:78},['submarine','sonar','anti-ship']),
  p('type055','Type 055 destroyer','sea','naval',['CN'],4,SOURCE.china,{attack:58,defense:58,range:170,speed:43,vision:220,radar:250,airDefense:60},['destroyer','air-defense','anti-submarine']),
  p('type052d','Type 052D destroyer','sea','naval',['CN'],3,SOURCE.china,{attack:48,defense:47,range:150,speed:42,vision:180,radar:220,airDefense:50},['destroyer','air-defense']),
  p('kolkata-class','Kolkata class','sea','naval',['IN'],3,SOURCE.navyin,{attack:51,defense:47,range:160,speed:42,vision:180,radar:210,airDefense:45},['destroyer','anti-ship']),
  p('visby-class','Visby class','sea','naval',['SE'],3,'https://www.saab.com/products/visby-class-corvette',{attack:34,defense:29,range:90,speed:50,vision:120,stealth:55,radar:130,airDefense:12},['corvette','low-observable','sonar']),
  p('tomahawk','Tomahawk','missile','missiles',['US','GB','AU'],4,SOURCE.tomahawk,{attack:75,defense:1,range:1600,speed:650,vision:0,stealth:30},['cruise-missile','single-use'],{operatorSources:{AU:'https://www.defence.gov.au/news-events/news/2024-12-10/navy-achieves-tomahawk-milestone'}}),
  p('brahmos','BrahMos','missile','missiles',['IN','PH'],3,SOURCE.drdo,{attack:62,defense:1,range:290,speed:1900,vision:0},['anti-ship','single-use'],{operatorSources:{PH:'https://www.brahmos.com/content.php?id=10'}}),
  p('naval-strike-missile','Naval Strike Missile','missile','missiles',['NO','PL','US','AU'],3,SOURCE.nsm,{attack:55,defense:1,range:200,speed:650,vision:0,stealth:50},['anti-ship','single-use']),
  p('aster30','Aster 30','missile','air-defense',['FR','IT','GB'],3,SOURCE.aster,{attack:4,defense:2,range:120,speed:2300,vision:0,airDefense:65},['interceptor','missile-defense','single-use']),
  p('trident-d5','Trident II D5','missile','nuclear',['US','GB'],5,SOURCE.trident,{attack:200,defense:1,range:5000,speed:4000,vision:0},['strategic-nuclear','single-use'],{nuclear:true,requiresNuclearPolicy:true,description:'Strategic deterrence represented with escalation, fallout and diplomatic consequences. No weapon engineering is modelled.'}),
  p('minuteman-iii','Minuteman III','missile','nuclear',['US'],5,SOURCE.minuteman,{attack:200,defense:1,range:6000,speed:4000,vision:0},['strategic-nuclear','single-use'],{nuclear:true,requiresNuclearPolicy:true}),
  p('m51','M51','missile','nuclear',['FR'],5,'https://www.defense.gouv.fr/marine/equipements/armes/missiles/missile-m51',{attack:200,defense:1,range:5000,speed:4000,vision:0},['strategic-nuclear','single-use'],{nuclear:true,requiresNuclearPolicy:true}),
  p('strategic-deterrent','National strategic deterrent','missile','nuclear',['RU','CN','IN','PK','KP','IL'],5,'https://www.sipri.org/research/armament-and-disarmament/nuclear-disarmament-arms-control-and-non-proliferation/world-nuclear-forces',{attack:200,defense:1,range:4000,speed:3500,vision:0},['strategic-nuclear','single-use'],{nuclear:true,abstractCapability:true,requiresNuclearPolicy:true,description:'High-level scenario representation of independently assessed national nuclear capability, including Israel’s undeclared status. No unverified missile type or stockpile count is asserted.'}),
]);

export const getPlatform = id => PLATFORMS.find(item => item.id===id) || null;
export const getPlatformsForNation = nationId => PLATFORMS.filter(item => item.operators.includes('*') || item.operators.includes(nationId));
export const getFacility = id => FACILITIES.find(item => item.id===id) || null;
export async function loadWorldNations(fetcher=globalThis.fetch) {
  const response=await fetcher(new URL('../assets/war/nations.json',import.meta.url));
  if(!response.ok)throw new Error('The world nation catalogue could not be loaded.');
  const value=await response.json();
  if(value.version!==CATALOG_VERSION||!Array.isArray(value.nations))throw new Error('The world nation catalogue version is unsupported.');
  return value.nations;
}
