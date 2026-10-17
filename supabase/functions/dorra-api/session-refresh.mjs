// Called only after dorra_read_state validates the authenticated gameplay lease.
export function sessionRefresh(saved, expectedRevision, serverNow, ifChanged = false) {
  return ifChanged && saved.revision === expectedRevision
    ? {unchanged:true,revision:saved.revision,serverNow}
    : {snapshot:saved.snapshot,revision:saved.revision,result:{},serverNow};
}
