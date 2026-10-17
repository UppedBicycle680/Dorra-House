import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const excluded=new Set(['node_modules','.git','dist','work','vendor']);let count=0;
async function check(dir){for(const item of await readdir(dir,{withFileTypes:true})){if(excluded.has(item.name))continue;const f=dir+'/'+item.name;if(item.isDirectory())await check(f);else if(/\.(js|mjs)$/.test(f)){const result=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(result.status){console.error(result.stderr);process.exitCode=1;}count++;}}}
await check('.');console.log(`Checked ${count} JavaScript modules.`);
