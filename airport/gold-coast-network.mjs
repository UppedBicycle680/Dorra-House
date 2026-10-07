// Centreline topology traced against BCGAD01-173 and BCGAP01-175.
// PDF coordinates use the aerodrome chart's frame. Shared node identities are
// intentional: crossing lines must form one connected junction.
export const GOLD_COAST_NETWORK={
  nodes:{c14:[139,195],hR:[176.7,265.9],hC:[200.8,258],bR:[198.6,304.5],hotspot:[222,295],
    gaG:[258.3,281],gaNorth:[220,236],gaSouth:[266,282.5],r17:[219.75,320.676],
    aR:[218,338.5],aC:[241.5,330],aE:[266,319.5],eNorth:[268,313],
    fR:[241.2,386],fC:[268,377.4],dR:[249,398],dC:[275.4,390.2],dE:[285,384.7],
    lC:[293.1,421.2],lE:[303,415.7],eSouth:[305.7,421],
    kR:[295.8,479],kC:[321.4,472.3],c32:[310.2,500.426],j35:[214.2,394],jR:[243.3,389.5]},
  edges:[
    ['C','c14','hC',[[146,190],[151.5,187.1],[155.5,186],[159.5,187],[163.85,190.075]]],
    ['C','hC','hotspot'],['C','hotspot','aC'],['C','aC','fC'],['C','fC','dC'],['C','dC','lC'],
    ['C','lC','kC'],
    ['C','kC','c32',[[324.15,474.72],[326.2,480],[327.3,483],[326.8,486.3],[325.2,489],[322.6,491]]],
    ['H','hR','hC'],['B','bR','hotspot'],['G','hotspot','gaG'],
    ['G','gaG','gaJunction'],
    ['G1','gaNorth','gaJunction',[[239,255],[248,266]]],['G1','gaJunction','gaSouth'],
    ['17-access','hotspot','r17',[[220.6,300],[219.2,318]]],
    ['A','aR','aC'],['A','aC','aE'],['A','aE','eNorth'],
    ['F','fR','fC'],['D','dR','dC'],['D','dC','dE'],
    ['E','aE','dE'],['E','dE','lE'],['E','lE','eSouth'],
    ['L','lC','lE'],['K','kR','kC'],['J','j35','jR',[[228.5,394.5]]]
  ]
};
