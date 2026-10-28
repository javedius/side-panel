import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../tests/',import.meta.url));
async function collect(folder){return (await Promise.all((await readdir(folder,{withFileTypes:true})).map(item=>item.isDirectory()?collect(join(folder,item.name)):[join(folder,item.name)]))).flat();}
const files=(await collect(root)).filter(path=>path.endsWith('.test.js')).sort();
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
process.exit(result.status??1);
