import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
async function files(folder){
  const entries=await readdir(folder,{withFileTypes:true});
  return (await Promise.all(entries.map(entry=>entry.isDirectory()?files(join(folder,entry.name)):[join(folder,entry.name)]))).flat();
}
const scripts=[...(await files(join(root,'src'))),...(await files(join(root,'scripts')))].filter(path=>['.js','.mjs'].includes(extname(path)));
for(const path of scripts){
  const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log(`Syntax checked ${scripts.length} JavaScript modules.`);
const graph=spawnSync('python3',[join(root,'scripts/project.py')],{stdio:'inherit'});
if(graph.status!==0)process.exit(graph.status||1);
