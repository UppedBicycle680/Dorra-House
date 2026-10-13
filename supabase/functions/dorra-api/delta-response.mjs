import {snapshotChanges} from './shared/snapshot-delta.mjs';

export function actionResponse(saved, committed, responseMode) {
  // A replay may refer to an older action. Return the current full snapshot,
  // never a delta based on the original command's now-obsolete revision.
  if (responseMode !== 'delta-v1' || committed.replayed) return committed;
  const changes = snapshotChanges(saved.snapshot,committed.snapshot);
  const delta = {baseRevision:saved.revision,changes};
  if (changes.length > 20000 || JSON.stringify(delta).length >= JSON.stringify(committed.snapshot).length) return committed;
  const {snapshot,...rest} = committed;
  return {...rest,delta};
}
