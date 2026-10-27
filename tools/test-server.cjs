/* Isolated loopback server: never loads a user's saved connection settings. */
const cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
module.exports=async function(){
 const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'remnant-demo-'));
 const child=cp.spawn(process.env.PYTHON||'python3',['studio-server.py','--port','0','--comfy-url','http://127.0.0.1:8188','--settings-file',path.join(folder,'settings.json')],{cwd:root,stdio:['ignore','pipe','pipe']});
 let output='',diagnostics='';child.stderr.on('data',d=>{diagnostics=(diagnostics+d).slice(-4000);});
 try {
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Test server startup timed out. '+diagnostics)),15000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Test server exited '+code+' '+diagnostics));});child.stdout.on('data',d=>{output+=d;const m=output.match(/Studio: (http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  return {url,async close(){await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill('SIGTERM');});fs.rmSync(folder,{recursive:true,force:true});}};
 }catch(e){child.kill('SIGTERM');fs.rmSync(folder,{recursive:true,force:true});throw e;}
};
