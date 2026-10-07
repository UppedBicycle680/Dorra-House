import {gatewayPlot,gatewayBank} from './queensland-gateway-data.mjs';

// Stable, independent runway slots. Outer-runway traffic follows the bank's
// end-around roads rather than cutting across a neighbouring active strip.
export function createGatewayPlan(layout,airport,stand,roundedPath) {
  const runway=layout.runways.find(r=>r.id===stand.runwayId),side=stand.side,bank=gatewayBank(side);
  const [rx,sy]=runway.start,ey=runway.end[1],[gx,gy]=stand.position;
  const arrivalX=rx+side*26,departureX=rx+side*44;
  const gates=(airport.gates||[]).filter(g=>g.status!=='waiting'&&g.aircraft&&gatewayPlot(g.plotId)?.precinct.runway===runway.id)
    .sort((a,b)=>gatewayPlot(a.plotId).slot-gatewayPlot(b.plotId).slot);
  const slotIndex=Math.max(0,gates.findIndex(g=>g.plotId===stand.plotId));
  const hold=[rx+side*15,sy+12],touchdown=[rx,sy+32],exitEnd=[arrivalX,ey+5],pushEnd=[gx+side*10,stand.taxiOutY];
  return {routeModel:'queensland-gateway',runway,stand,slotIndex,period:Math.max(160,gates.length*40),hold,
    holdLine:[rx+side*11,sy+12],holdHeading:side>0?Math.PI:0,
    approach:[[rx,sy-70],touchdown],landing:[touchdown,[rx,ey-30]],
    exit:roundedPath([[rx,ey-30],[rx,ey-14],[arrivalX,ey-14],exitEnd],6),
    inbound:roundedPath([exitEnd,[arrivalX,bank.south],[bank.arrivalX,bank.south],
      [bank.arrivalX,stand.taxiInY],[gx,stand.taxiInY],[gx,gy]],6),
    pushback:roundedPath([[gx,gy],[gx,stand.taxiOutY],pushEnd],6),
    outbound:roundedPath([pushEnd,[bank.departureX,stand.taxiOutY],[bank.departureX,bank.north],
      [departureX,bank.north],[departureX,sy+12],hold],6),
    lineup:roundedPath([hold,[rx,sy+12],[rx,sy+30]],6),
    takeoff:[[rx,sy+30],[rx,ey-12]],climb:[[rx,ey-12],[rx,ey+70]],
    departureConnectorId:`${stand.precinct}-ENTRY`,arrivalConnectorId:`${stand.precinct}-EXIT`};
}
