const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const tests=fs.readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.cjs')&&!f.includes('browser')).sort().map(f=>path.join('tests',f));
const run=cp.spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
process.exit(run.status??1);
