// Archive regression: retain all original geometry/travel assertions on their renderer.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const target=new URL(process.env.STUDIO_URL||'http://127.0.0.1:8765');
target.searchParams.set('world','legacy');
for(const name of ['check-world.mjs','check-world-physics.mjs']) {
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(name,import.meta.url))],{
    stdio:'inherit',env:{...process.env,STUDIO_URL:target.href}});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
