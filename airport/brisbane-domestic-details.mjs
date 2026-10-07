import {domesticAerialPoint as point} from './brisbane-domestic-precinct.mjs';

// Visual landside detail, traced against the 5 October 2025 Esri aerial.
// Coordinates use the same 1600px geographic reference as the precinct.
// Signal equipment positions are interpretations of visible kerbs/shadows,
// not surveyed pole coordinates. See BRISBANE-DOMESTIC-DETAILS-AUDIT.md.
const polygon=p=>p.map(point);
export const DOMESTIC_MATERIALS={
  asphalt:'#626b70',parking:'#737a7c',concrete:'#d1d0c9',path:'#c4ae96',
  roof:'#e3e4e1',solar:'#37474e',parkingFrame:'#bcc0bf',opening:'#41494d',
  screen:'#a9afb2',pier:'#62696d',white:'#f0eee5',
};
export const DOMESTIC_DETAIL={
  junction:polygon([[686,420],[703,393],[722,396],[738,373],[764,385],[754,416],[772,433],[786,445],[770,472],[747,458],[730,484],[710,474],[717,450],[704,434]]),
  medians:[
    [[704,397],[723,400],[742,380],[732,405],[728,416]],
    [[745,399],[770,343],[777,310],[761,351]],
    [[726,454],[705,496],[713,478],[734,456]],
  ].map(polygon),
  stopBars:[[[700,413],[709,427]],[[753,445],[773,452]],[[735,404],[748,410]],[[723,458],[730,443]]].map(polygon),
  // Kerb-side primary heads plus opposite repeaters at all four arms.
  signals:[
    {id:'west-near',p:[700,410],arm:[710,417],axis:'ew'},
    {id:'west-far',p:[749,453],axis:'ew'},
    {id:'east-near',p:[775,452],arm:[762,445],axis:'ew'},
    {id:'east-far',p:[715,402],axis:'ew'},
    {id:'north-near',p:[751,408],axis:'ns'},
    {id:'north-far',p:[728,465],axis:'ns'},
    {id:'south-near',p:[723,456],axis:'ns'},
    {id:'south-far',p:[733,397],axis:'ns'},
  ].map(s=>({...s,p:point(s.p),arm:s.arm&&point(s.arm)})),
  // Coloured route-selection panels observed on Airport/Moreton Drive.
  // Labels are omitted where they cannot be read reliably in the aerial.
  lanePanels:[
    {a:[749,447],b:[762,453],width:8,colour:'#81b4b1'},
    {a:[746,455],b:[759,461],width:8,colour:'#c8b878'},
    {a:[757,460],b:[770,466],width:8,colour:'#c18477'},
    {a:[682,404],b:[695,410],width:8,colour:'#87b5b6'},
    {a:[679,412],b:[692,418],width:8,colour:'#c4b778'},
    {a:[646,393],b:[659,397],width:8,colour:'#c18477'},
    {a:[619,389],b:[632,391],width:8,colour:'#c7b979'},
    {a:[806,475],b:[817,483],width:8,colour:'#c18477'},
    {a:[798,469],b:[810,477],width:8,colour:'#c8b878'},
    {a:[790,463],b:[802,471],width:8,colour:'#80b2b2'},
    {a:[455,510],b:[450,522],width:8,colour:'#c28578'},
    {a:[447,506],b:[442,518],width:8,colour:'#cbb87b'},
    {a:[438,502],b:[433,514],width:8,colour:'#84b6b5'},
  ].map(s=>({...s,a:point(s.a),b:point(s.b)})),
  paths:[
    [[461,442],[499,403],[545,377],[601,366],[655,377],[703,394],[732,344],[749,290]],
    [[460,479],[492,449],[536,427],[577,415],[620,425],[673,444],[694,458],[671,505]],
    [[623,425],[614,458],[626,474],[646,479],[662,468],[658,450]],
    [[750,419],[782,435],[833,457],[894,476]],
    [[701,483],[666,550],[603,678],[536,814],[478,949]],
  ].map(polygon),
  plantedBeds:[
    [[529,476],[570,483],[611,493],[638,520],[654,540],[672,521],[656,487],[631,475],[594,458],[550,456]],
    [[640,342],[669,328],[705,324],[730,318],[717,370],[685,366]],
    [[504,346],[545,330],[586,327],[634,319],[651,288],[633,289],[618,308],[562,314]],
    [[565,635],[583,647],[641,536],[627,533]],
    [[358,878],[387,899],[464,734],[518,626],[526,578],[509,586],[475,659]],
  ].map(polygon),
  // Separate paved compounds on either side of the long covered walkway.
  parkingAreas:[
    {polygon:polygon([[905,231],[1009,277],[919,466],[897,475],[775,417],[823,334],[855,278]]),rows:[
      [[882,273],[811,415]],[[909,260],[830,426]],[[935,272],[856,440]],
      [[960,283],[881,451]],[[986,297],[912,451]],
    ].map(polygon)},
    {polygon:polygon([[1023,274],[1093,300],[1096,325],[1078,342],[1094,349],[1122,371],[1149,386],[1152,403],[1130,438],[1106,447],[1094,433],[1070,416],[1030,417],[1003,437],[977,435],[951,428],[942,453],[924,450]]),rows:[
      [[1035,293],[973,419]],[[1060,307],[1005,416]],
      [[1068,347],[1121,378]],[[1058,382],[1105,410]],
    ].map(polygon)},
  ],
  coveredWalks:[
    {polygon:polygon([[1012,270],[1017,273],[924,460],[919,457]]),height:.46,segments:1},
    {polygon:polygon([[924,446],[980,467],[978,472],[922,451]]),height:.46,segments:1},
  ],
};

// Suppress randomly placed, oversized scenic trees inside this authored area.
const region=polygon([[280,180],[1160,180],[1160,1160],[280,1160]]);
export function inDomesticDetailRegion(x,y){
  let inside=false;
  for(let i=0,j=region.length-1;i<region.length;j=i++){
    const a=region[i],b=region[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
