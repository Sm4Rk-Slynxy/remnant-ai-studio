/* Shared OpenAI-compatible client for local and LAN text models. */
(function(root){
'use strict';
function base(endpoint){
 const u=new URL(endpoint);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('Use an HTTP server address without credentials or query parameters.');
 const path=u.pathname.replace(/\/(chat\/completions|models)\/?$/,'').replace(/\/+$/,'');
 u.pathname=path||'/v1';
 return u.href.replace(/\/$/,'');
}
async function request(config,route,payload){
 if(config.backend==='comfyui')throw Error('Choose a text AI server in AI connections.');
 const endpoint=base(config.endpoint), method=payload?'POST':'GET';
 const seconds=payload?timeoutMinutes(config)*60:30;
 const controller=AbortSignal.timeout(seconds*1000+(payload?15000:0));
 // The local relay avoids cross-origin restrictions without changing AI-server settings.
 const health=await fetch('/api/ai/health',{signal:AbortSignal.timeout(5000)}).catch(()=>null);
 try{
 if(health?.ok){
  const {token}=await health.json();
  const response=await fetch('/api/ai/request',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':token},signal:controller,body:JSON.stringify({endpoint,route,apiKey:config.apiKey||'',payload,...(payload?{timeoutSeconds:seconds}:{})})});
  if(response.status===504){let detail='';try{detail=(await response.json()).error||'';}catch{}throw Error(detail||timeoutMessage(seconds));}
  return response;
 }
 return await fetch(endpoint+'/'+route,{method,headers:{...(payload?{'Content-Type':'application/json'}:{}),...(config.apiKey?{Authorization:'Bearer '+config.apiKey}:{})},signal:controller,...(payload?{body:JSON.stringify({...payload,stream:false})}:{})});
 }catch(error){if(error?.name==='TimeoutError'||(controller.aborted&&error?.name==='AbortError'))throw Error(payload?timeoutMessage(seconds):'AI model discovery timed out after 30 seconds. Check the AI server connection.');throw error;}
}
async function models(config){const r=await request(config,'models');const x=await r.json();if(!r.ok)throw Error(x.error?.message||x.error||`AI server HTTP ${r.status}`);if(!Array.isArray(x.data))throw Error('The server did not return an OpenAI-compatible model list.');return x.data.map(m=>m.id).filter(id=>typeof id==='string');}
async function test(config){if(!config.model)throw Error('Select or enter a model first.');const r=await request(config,'chat/completions',{model:config.model,messages:[{role:'user',content:'Reply with the word connected.'}],max_tokens:32,temperature:0});const x=await r.json();if(!r.ok)throw Error(x.error?.message||x.error||`AI server HTTP ${r.status}`);if(!x.choices?.[0]?.message?.content?.trim())throw Error('Server responded, but the model returned no text.');return x.choices[0].message.content.trim();}
function timeoutMinutes(config={}){const n=Number(config.timeoutMinutes);return Number.isFinite(n)&&n>=1?Math.max(1,Math.min(120,Math.floor(n))):30;}
function timeoutMessage(seconds){return 'AI request timed out after '+Math.round(seconds/60)+' minutes. Increase AI request timeout in AI connections or check the AI server. Completed clips are retained.';}
function replyLimit(config={},fallback=0){const chosen=Number(config.maxOutputTokens);return Number.isFinite(chosen)&&chosen>=256?Math.max(256,Math.min(65536,Math.floor(chosen))):Math.min(65536,Math.max(16384,Number(fallback)||0));}
function truncationError(response,usage={}){usage=usage||{};const limit=response?.studioMaxTokens,generated=usage.completion_tokens??usage.output_tokens,reasoning=usage.completion_tokens_details?.reasoning_tokens??usage.output_tokens_details?.reasoning_tokens;const facts=[limit?'app requested '+limit.toLocaleString()+' reply tokens':'reply limit reached',Number.isFinite(generated)?'server reported '+generated.toLocaleString()+' output tokens':'',Number.isFinite(reasoning)&&reasoning>0?reasoning.toLocaleString()+' reasoning tokens':''].filter(Boolean).join('; ');return Error('AI reply was truncated ('+facts+'). Increase Reply token limit in AI connections, or check the server generation cap if it stops sooner. Context window size is a separate limit.');}
async function fetchChat(config,options){const payload=JSON.parse(options.body),limit=replyLimit(config,payload.max_tokens);payload.max_tokens=limit;const response=await request(config,'chat/completions',payload);response.studioMaxTokens=limit;return response;}
const api={timeoutMinutes,replyLimit,truncationError,base,request,models,test,fetchChat};if(typeof module!=='undefined')module.exports=api;else root.LocalAI=api;
})(typeof window!=='undefined'?window:globalThis);
