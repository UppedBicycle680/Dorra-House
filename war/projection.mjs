// Projection deltas contain filtered entities only. They never upload gameplay state.
const allowedFields = new Set(['match','player','nations','reports','diplomacy','catalog','victory']);
export function applyWarDelta(view, delta) {
  if (!view || delta?.matchId !== view.match.id || delta.baseRevision !== view.match.revision || !Number.isSafeInteger(delta.revision) || delta.revision < delta.baseRevision) throw new Error('WAR_PROJECTION_MISMATCH');
  const next = structuredClone(view);
  for (const [field,value] of Object.entries(delta.fields || {})) {
    if (!allowedFields.has(field)) throw new Error('WAR_PROJECTION_MISMATCH');
    next[field] = structuredClone(value);
  }
  for (const field of ['units','provinces']) {
    const patch = delta[field];
    if (!patch || !Array.isArray(patch.upsert) || !Array.isArray(patch.remove)) throw new Error('WAR_PROJECTION_MISMATCH');
    const entities = new Map((next[field] || []).map(item => [item.id,item]));
    for (const id of patch.remove) entities.delete(id);
    for (const entity of patch.upsert) {
      if (!entity || typeof entity.id !== 'string') throw new Error('WAR_PROJECTION_MISMATCH');
      entities.set(entity.id,structuredClone(entity));
    }
    next[field] = [...entities.values()].sort((a,b) => a.id.localeCompare(b.id));
  }
  next.match.revision = delta.revision;
  return next;
}
