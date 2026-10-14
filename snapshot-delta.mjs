const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const forbidden = new Set(['__proto__','prototype','constructor']);

// Only public snapshots belong here. Arrays are replaced as a unit so deletes
// cannot shift indices and apply a change to a different record.
export function snapshotChanges(before, after, path = [], changes = []) {
  if (Object.is(before,after)) return changes;
  if (object(before) && object(after) && path.length < 24) {
    for (const key of Object.keys(before)) if (!Object.hasOwn(after,key)) changes.push({path:[...path,key],remove:true});
    for (const key of Object.keys(after)) {
      if (!Object.hasOwn(before,key)) changes.push({path:[...path,key],value:after[key]});
      else snapshotChanges(before[key],after[key],[...path,key],changes);
    }
  } else if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({path,value:after});
  return changes;
}

export function applySnapshotChanges(snapshot, changes) {
  if (!Array.isArray(changes) || changes.length > 20000) throw new Error('Invalid cloud update.');
  let result = structuredClone(snapshot);
  for (const change of changes) {
    if (!change || !Array.isArray(change.path) || change.path.length > 24 || change.path.some(key=>typeof key!=='string'||forbidden.has(key))) throw new Error('Invalid cloud update path.');
    if (change.remove !== true && !Object.hasOwn(change,'value')) throw new Error('Incomplete cloud update.');
    if (!change.path.length) {
      if (change.remove) throw new Error('Invalid cloud update root.');
      result = structuredClone(change.value); continue;
    }
    let parent = result;
    for (const key of change.path.slice(0,-1)) {
      if (!object(parent) || !Object.hasOwn(parent,key)) throw new Error('Cloud update needs a fresh snapshot.');
      parent = parent[key];
    }
    if (!object(parent)) throw new Error('Invalid cloud update parent.');
    const key = change.path.at(-1);
    if (change.remove) delete parent[key];
    else parent[key] = structuredClone(change.value);
  }
  return result;
}

export function touches(paths, ...prefixes) {
  return !paths || paths.some(path=>prefixes.some(prefix=>{
    const parts=prefix.split('.');
    return parts.slice(0,Math.min(parts.length,path.length)).every((key,index)=>key===path[index]);
  }));
}
