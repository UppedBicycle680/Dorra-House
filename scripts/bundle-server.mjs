import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'), target=path.join(root,'supabase/functions/dorra-api/shared');
const visited=new Set();
async function copy(relative){if(visited.has(relative))return;visited.add(relative);const source=await readFile(path.join(root,relative),'utf8');const dest=path.join(target,relative);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,source);for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){const child=path.normalize(path.join(path.dirname(relative),match[1].split('?')[0]));if(child.startsWith('..'))throw new Error('Server import escaped source root');await copy(child);}}
for(const file of ['progression-engine.js','campaign-engine.js','game-limits.js','football/football-engine.js','airport/engine.mjs'])await copy(file);
console.log(`Bundled ${visited.size} pure game modules.`);
