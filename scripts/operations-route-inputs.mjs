import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const excluded=new Set(['airport/operations-routing.mjs','airport/operations-route-manifest.mjs']);
/** Fingerprint every static geometry/data dependency, including stand sources.
 * Runtime token resolution and the output manifest are excluded to avoid a
 * self-referential fingerprint. Builtins contain no authored airport geometry. */
export async function operationsRouteSourceHashes(){
  const hashes={},pending=['airport/catalog.mjs','airport/layouts.mjs','airport/traffic.mjs','airport/aircraft-dimensions.mjs',
    'airport/aircraft-ground-geometry.mjs','airport/operations-route-compiler.mjs','airport/aircraft-models.mjs',
    'scripts/generate-operations-routes.mjs','scripts/operations-route-inputs.mjs'];
  while(pending.length){
    const path=pending.pop();if(excluded.has(path)||hashes[path])continue;
    const url=new URL(path,root),source=await readFile(url,'utf8');
    hashes[path]=createHash('sha256').update(source).digest('hex');
    for(const match of source.matchAll(/\bfrom\s+['"](\.[^'"]+\.mjs)['"]/g)){
      const dependency=new URL(match[1],url),relative=decodeURIComponent(dependency.href.slice(root.href.length));
      if(dependency.href.startsWith(root.href))pending.push(relative);
    }
  }
  return Object.fromEntries(Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b)));
}
