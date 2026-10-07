import {goldCoastGeographicPoint} from './gold-coast-bays.mjs';

// Individual visible roof sections traced in the 2048 × 2304 City aerial.
// Cross-checked against Vantor's 2025-12-01 image. Pixel measurements remain
// explicit so the QA overlay can independently inspect every roof boundary.
// Quadrilaterals run airside-left, airside-right, landside-right, landside-left.
// Eave/ridge heights are photo-informed estimates in metres, not survey data.
const sections=[
 ['N1',[[158,444],[192,476],[295,368],[261,335]],4.3,5.6,{sideDoors:3,skylights:2,roof:'#e7e0ca'}],
 ['N2',[[234,521],[272,560],[375,451],[336,415]],4.3,5.6,{sideDoors:3,skylights:2,roof:'#dedbcf'}],
 ['N3',[[315,595],[351,632],[456,521],[419,486]],4.3,5.6,{sideDoors:3,skylights:5,roof:'#d6d7d0'}],
 ['N4',[[394,671],[429,706],[534,592],[497,559]],4.3,5.6,{sideDoors:3,skylights:4,roof:'#e5dfcb'}],
 ['N5a',[[474,751],[517,795],[579,732],[535,688]],5.5,6.8,{skylights:3,roof:'#eeeeDF'}],
 ['N5b',[[517,795],[587,864],[648,798],[579,732]],6.2,8.2,{roof:'#d1c5a4',vents:3}],
 ['N6',[[624,888],[712,976],[787,900],[695,814]],6,7.8,{roof:'#a6b0b2',roofRight:'#c2ccca',skylights:2,skylightSides:'left',vents:7}],
 ['N6-annex',[[734.56,850.98],[748.36,863.88],[753,859],[739,846]],4.2,4.5,{roof:'#e0e3d8',roofForm:'mono',doors:false}],
 ['C1',[[737,1010],[781,1050],[844,984],[799,943]],5,6.3,{solar:true,roof:'#c3c9c9'}],
 ['C2',[[798,1054],[827,1084],[884,1027],[854,998]],4.8,5.8,{roof:'#b7b2a1'}],
 ['C3',[[827,1084],[875,1137],[949,1061],[902,1010]],6.2,8.1,{skylights:6,roof:'#e6e9df'}],
 ['C4',[[887,1148],[944,1201],[1006,1142],[950,1090]],5.8,7.4,{skylights:4,roof:'#c3beaa'}],
 ['C5',[[944,1201],[980,1236],[1042,1176],[1006,1142]],5.8,7.1,{skylights:2,roof:'#e6e8de'}],
 ['C6',[[980,1236],[1017,1271],[1079,1210],[1042,1176]],5.8,7.1,{skylights:3,roof:'#d8ded5'}],
 ['C7',[[1017,1271],[1050,1303],[1112,1243],[1079,1210]],5.8,7.1,{skylights:2,roof:'#d9dfd6'}],
 ['C8',[[1050,1303],[1093,1344],[1155,1285],[1112,1243]],5.8,7.3,{skylights:3,roof:'#d9ddd3',office:'glazed'}],
 ['C9',[[1100,1346],[1195,1440],[1259,1371],[1174,1292],[1161,1305],[1150,1293]],7.2,8.4,{framePixels:[[1100,1346],[1195,1440],[1259,1371],[1164,1277]],skylights:5,skylightSides:'left',roof:'#e4e7df',office:'airways',source:'airways-photo'}],
 ['S1',[[1246,1455],[1295,1500],[1370,1422],[1321,1372]],6,7.8,{skylights:3,roof:'#d7ddd8'}],
 ['S2',[[1295,1500],[1360,1566],[1454,1473],[1389,1407]],6.2,8.2,{roof:'#c0b69a',vents:4}],
 ['S3',[[1367,1576],[1442,1651],[1532,1558],[1458,1482]],6.5,8.4,{skylights:4,roof:'#e4e6db'}],
 ['S4',[[1442,1651],[1515,1719],[1592,1646],[1524,1578]],6.1,7.9,{skylights:4,roof:'#d8cfb4'}],
 ['S5',[[1542,1745],[1596,1800],[1653,1743],[1599,1692]],5.5,7,{skylights:3,roof:'#d5c9ae'}],
 ['S5-annex',[[1599,1692],[1653,1743],[1674,1723],[1620,1669]],4.5,4.9,{roof:'#dedfd5',roofForm:'mono',doors:false}],
 ['S6-link',[[1596,1800],[1621,1827],[1672,1774],[1653,1743]],4.5,4.8,{roof:'#c9c9bd',roofForm:'mono',doors:false}],
 ['S6',[[1621,1827],[1726,1935],[1779,1882],[1672,1774]],6.6,8.2,{skylights:4,roof:'#cdd8d5'}],
];
export const GOLD_COAST_HANGAR_SOURCE={
 image:'city-aerial-ga.png',width:2048,height:2304,
 extent:{xmin:17088151.344894003,ymin:-3269565.200585069,xmax:17088824.759984467,ymax:-3268807.6086082975},
 imageryUrl:'https://maps1.goldcoast.qld.gov.au/arcgis/rest/services/Image_Service/Aerial_Latest_Map_Image/MapServer',
 crossCheckDate:'2025-12-01',heightAccuracy:'estimated from aircraft/door/storey proportions; not surveyed',
 facadeSources:['https://airgoldcoast.com.au/aircraft-maintenance/','https://amelia.airwaysaviation.com/theme/edumy/style/images/students-feedback-section.jpg']
};
export function goldCoastHangarPixelPoint([px,py]){
 const m=GOLD_COAST_HANGAR_SOURCE,e=m.extent;
 const x=e.xmin+px/m.width*(e.xmax-e.xmin),y=e.ymax-py/m.height*(e.ymax-e.ymin);
 const lon=x/6378137*180/Math.PI,lat=(2*Math.atan(Math.exp(y/6378137))-Math.PI/2)*180/Math.PI;
 return goldCoastGeographicPoint({latitudeSeconds:(-lat-28.15)*3600,longitudeSeconds:(lon-153.5)*3600});
}
const extent=p=>({x:Math.min(...p.map(p=>p[0])),y:Math.min(...p.map(p=>p[1])),w:Math.max(...p.map(p=>p[0]))-Math.min(...p.map(p=>p[0])),h:Math.max(...p.map(p=>p[1]))-Math.min(...p.map(p=>p[1]))});
export const GOLD_COAST_HANGARS=sections.map(([referenceId,sourcePixels,eaveM,ridgeM,details])=>{
 const polygon=sourcePixels.map(goldCoastHangarPixelPoint);
 return {id:`gold-coast-hangar-${referenceId.toLowerCase()}`,referenceId,kind:'hangar',sourcePixels,polygon,roofFrame:(details.framePixels||sourcePixels).map(goldCoastHangarPixelPoint),rect:extent(polygon),eaveM,ridgeM,height:ridgeM*.2,
   roofForm:'gable',roof:'#e1e2d5',wall:'#bfc5b9',doors:true,doorPanels:6,frontEdge:0,heightEstimated:true,...details};
});
// The southern end has a faceted office/terminal extension behind the main
// hangar roof. Keep its non-rectangular footprint instead of a square block.
const endPixels=[[1672,1774],[1720,1809],[1737,1788],[1760,1799],[1777,1827],[1785,1862],[1779,1882]];
const endPolygon=endPixels.map(goldCoastHangarPixelPoint);
GOLD_COAST_HANGARS.push({id:'gold-coast-hangar-s6-office',referenceId:'S6-office',kind:'office',sourcePixels:endPixels,polygon:endPolygon,rect:extent(endPolygon),eaveM:4.3,ridgeM:5.3,height:1.06,heightEstimated:true,roofForm:'faceted',roofApex:goldCoastHangarPixelPoint([1750,1840]),roof:'#e0e3d9',wall:'#d4d8ca',doors:false});
