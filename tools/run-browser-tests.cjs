const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
(async()=>{const server=process.env.STUDIO_URL?null:await require('./test-server.cjs')();
 const env={...process.env,STUDIO_URL:process.env.STUDIO_URL||server.url};
 const cases=fs.readdirSync(path.join(__dirname,'../tests')).filter(f=>f.endsWith('.test.cjs')&&f.includes('browser')).sort().map(file=>({file,extra:{}}));
 cases.push({file:'render-quality-browser.test.cjs',extra:{STUDIO_UPSCALE_METHOD:'dlss5',STUDIO_CLIP_QUALITY:'1'}},{file:'sequence-browser.test.cjs',extra:{SEQUENCE_NO_VISION:'1'}},{file:'sequence-browser.test.cjs',extra:{SEQUENCE_STOP_TEST:'1'}},{file:'sequence-browser.test.cjs',extra:{SEQUENCE_TEXT_WORKFLOW:'1'}});
 try{for(const {file,extra}of cases){console.log('\nBrowser:',file,JSON.stringify(extra));const status=await new Promise((resolve,reject)=>{const p=cp.spawn(process.execPath,[path.join('tests',file)],{cwd:path.resolve(__dirname,'..'),env:{...env,...extra},stdio:'inherit',timeout:150000});p.on('error',reject);p.on('exit',resolve);});if(status!==0)throw Error(file+' failed with status '+status);}console.log('All '+cases.length+' browser scenarios passed.');}
 finally{if(server)await server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
