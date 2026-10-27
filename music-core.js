/* Song timing and review invariants, shared by the studio and tests. */
(function(root){
'use strict';
const C = typeof module !== 'undefined' ? require('./studio-core.js') : root.StudioCore;
const Q=typeof module!=='undefined'?require('./render-quality.js'):root.RenderQuality;
function settings(v={}) {
 const s=k=>typeof v[k]==='string'?v[k].slice(0,30000):'';
 return {songId:s('songId'),songName:s('songName'),songDuration:Number.isFinite(v.songDuration)?Math.max(0,Math.min(1200,v.songDuration)):0,plot:s('plot'),lyrics:s('lyrics'),concept:s('concept'),mode:['narrative','mixed','performance'].includes(v.mode)?v.mode:'narrative',shotLength:Math.max(5,Math.min(14,Number(v.shotLength)||10)),bpm:Math.max(0,Math.min(300,Number(v.bpm)||0)),beatOffset:Math.max(0,Math.min(30,Number(v.beatOffset)||0)),referenceId:s('referenceId'),energy:Array.isArray(v.energy)?v.energy.slice(0,2400).map(n=>Math.max(0,Math.min(1,Number(n)||0))):[],approval:s('approval'),planStamp:s('planStamp'),finalId:/^[a-f0-9]{32}$/.test(v.finalId||'')?v.finalId:'',finalStamp:s('finalStamp')};
}
function hash(value){ const s=JSON.stringify(value);let a=2166136261,b=2246822519;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b^s.charCodeAt(i),3266489917);}return (a>>>0).toString(16)+(b>>>0).toString(16); }
function brief(p){const m=settings(p.musicVideo);return hash({song:m.songId,duration:m.songDuration,plot:m.plot,lyrics:m.lyrics,mode:m.mode,shot:m.shotLength,bpm:m.bpm,offset:m.beatOffset,reference:m.referenceId,style:p.style,aspect:p.aspect,cast:p.characters,setting:p.setting,nsfw:p.nsfw});}
function signature(p,cfg){return hash({brief:brief(p),concept:p.musicVideo?.concept,model:p.model,fps:p.fps,clips:p.clips.map(c=>({id:c.id,title:c.title,beat:c.beat,start:c.start,end:c.end,camera:c.camera,prompt:c.prompt,duration:c.duration,seed:c.seed,reference:c.startAsset,endReference:c.endAsset||'',...(c.sceneLocation?{sceneLocation:c.sceneLocation}:{}),...(Array.isArray(c.castIds)?{castIds:c.castIds}:{}),performance:c.musicPerformance,dirty:!!c.musicPromptDirty,...(c.generationMode?{generationMode:c.generationMode}:{}),...(c.renderQuality?{renderQuality:Q.videoProfile(c.renderQuality)}:{}),...(c.musicContinuity==='previous'?{continuity:'previous'}:{})})),...(p.renderQuality&&Q.active(Q.videoProfile(p.renderQuality))?{renderQuality:Q.videoProfile(p.renderQuality)}:{}),workflow:cfg});}
function shotSignature(p,i,cfg){const c=p.clips[i],r=ranges(p)[i],quality=Q.videoProfile(Q.effective(p,c));return hash({song:p.musicVideo?.songId,start:r.start,frames:r.frames,generationFrames:r.generationFrames,prompt:c.prompt,seed:c.seed,reference:c.startAsset,endReference:c.endAsset||'',...(c.sceneLocation?{sceneLocation:c.sceneLocation}:{}),...(Array.isArray(c.castIds)?{castIds:c.castIds}:{}),model:p.model,fps:p.fps,aspect:p.aspect,nsfw:p.nsfw,...(c.generationMode?{generationMode:c.generationMode}:{}),...(Q.active(quality)?{renderQuality:quality}:{}),workflow:cfg,...(c.musicContinuity==='previous'&&i>0?{previous:shotSignature(p,i-1,cfg),previousJob:p.clips[i-1].job?.id,previousOutput:p.clips[i-1].outputs}:{})});}
function generationFrames(seconds){return Math.max(124,Math.ceil((Math.ceil(seconds*24-1e-7)-5)/17)*17+5);}
function ranges(p){let frame=0;return p.clips.map((c,i)=>{const frames=Math.round(c.duration*24),start=frame/24,overlapFrames=i>0&&c.musicContinuity==='previous'?22:0;frame+=frames;return {start,end:frame/24,frames,overlapFrames,generationFrames:generationFrames((frames+overlapFrames)/24)};});}
function plan(p){if(p.musicVideo?.songDuration>1200)throw new Error('Maximum song duration is 20 minutes.');const m=settings(p.musicVideo);if(!m.songId||m.songDuration<5||m.songDuration>1200)throw new Error('Upload a song between 5 seconds and 20 minutes.');if(!m.plot.trim())throw new Error('Write a short plot first.');
 const total=Math.ceil(m.songDuration*24),max=Math.floor(m.shotLength*24),count=Math.ceil(total/max);
 const cuts=[0];
 for(let i=1;i<count;i++){let f=Math.round(i*total/count);if(m.bpm){const bar=60/m.bpm*4*24,offset=m.beatOffset*24;const snap=Math.round((f-offset)/bar)*bar+offset;const candidate=Math.round(snap);if(candidate-cuts.at(-1)>=120&&candidate-cuts.at(-1)<=max&&total-candidate>=(count-i)*120&&total-candidate<=(count-i)*max)f=candidate;}cuts.push(f);}
 cuts.push(total);
 // If a beat snap makes the following span invalid, use evenly spaced frame boundaries.
 if(cuts.some((f,i)=>i&&(f-cuts[i-1]<120||f-cuts[i-1]>max)))for(let i=0;i<=count;i++)cuts[i]=Math.round(i*total/count);
 const beats=m.plot.split(/[\n]+/).filter(s=>s.trim());
 return Array.from({length:count},(_,i)=>{const c=C.clip();c.duration=(cuts[i+1]-cuts[i])/24;c.title=`Shot ${String(i+1).padStart(2,'0')}`;c.beat=beats[Math.min(beats.length-1,Math.floor(i*beats.length/count))]||m.plot;c.start='Establish this scene with the recurring cast and visual palette.';c.end='Complete the action naturally, ready for an intentional editorial cut.';c.musicPerformance=m.mode==='performance'||(m.mode==='mixed'&&i%3===1);c.startAsset=m.referenceId;return c;});
}
function prompt(p,i,timing){const c=p.clips[i].generationMode==='text'?{...p.clips[i],startAsset:'',endAsset:''}:p.clips[i],m=settings(p.musicVideo),r=timing||ranges(p)[i];const picture=c.startAsset?'<Picture 1> anchors the recurring identity, wardrobe, palette and scene.\n':'';
 if(r.overlapFrames){const original=prompt({...p,clips:p.clips.map((x,j)=>j===i?{...x,musicContinuity:'cut'}:x)},i,{...r,start:r.start-r.overlapFrames/24,overlapFrames:0});return original.replace('One continuous music-video shot for the supplied song excerpt.','A single continuous shot from beginning to end. The first 22 frames (0.917 seconds) are motion context from the previous shot, supplied as an H3 guide. Continue that same movement, pose, camera and lighting smoothly beyond the context.').replace(`[Shot 1] ${c.start}`, '[Shot 1] Continue from the supplied motion guide without resetting the pose.').replace(`The edit uses the first ${c.duration.toFixed(3)} seconds`,`The edit discards the first 22 context frames and retains the following ${c.duration.toFixed(3)} seconds`);}
 const vocals=c.musicPerformance?'The on-screen performer (S1) sings only the vocals audible in <Audio 1>, synchronizing mouth shapes to the supplied recording. During instrumental pauses the lips stay closed. Do not invent lyrics or additional voices.':'This is a narrative shot. Subjects do not sing or speak; mouths stay naturally closed. Body movement follows the supplied rhythm.';
 const cast=C.castFor(p,c).map(c=>`${c.name}: ${c.description}${c.outfit?' Wardrobe: '+c.outfit:''}${c.avoid?' Avoid identity changes: '+c.avoid:''}`).join('; ');
 return `subject_definitions:\n${picture}<Audio 1> is the exact song excerpt starting at ${r.start.toFixed(3)} seconds in the master song, supplied for this shot.\n${cast?`Recurring cast: ${cast}\n`:''}\nsummary:\n[audio reuse + reference generation] One continuous music-video shot for the supplied song excerpt. ${c.beat}\n\nretention_analysis:\n<Audio 1>: fully_copy - preserve the supplied excerpt, including tempo, vocals and timing; no added dialogue or music.\n${c.startAsset?'<Picture 1>: fully_preserved - keep the reference identity and wardrobe.\n':''}\ndetailed_description:\n${p.nsfw?'':'General audience, clothed subjects, no sexual content. '}${p.style}. ${p.aspect} composition. ${c.sceneLocation||p.setting||'Establish the setting from the reviewed story'}. [Shot 1] ${c.start} ${c.beat.replace(/[.!?]+$/,'')}. ${c.camera||p.camera}. ${vocals} Maintain consistent faces, costume, props and lighting. ${c.end} No internal cuts, subtitles, logos, fades or artificial freeze. The edit uses the first ${c.duration.toFixed(3)} seconds of a ${(r.generationFrames/24).toFixed(3)}-second generation. Keep the action moving through the extra tail.\n\noverall_soundscape:\nOnly the supplied song excerpt. No extra ambience or sound effects.\n\nnon_diegetic_music:\n${c.musicPerformance?'The song is performed on screen in detailed_description; no separate background score.':'<Audio 1> is reused as the complete audience-only soundtrack.'}`;
}
function nativeWorkflow(models,withImage=false){
 const node=(class_type,inputs)=>({class_type,inputs});
 const graph={
 '1':node('UNETLoader',{unet_name:models.diffusion,weight_dtype:'default'}),
 '2':node('CLIPLoader',{clip_name:models.encoder,type:'minimax',device:'default'}),
 '3':node('VAELoader',{vae_name:models.videoVae}),
 '4':node('VAELoader',{vae_name:models.audioVae}),
 '5':node('LoadAudio',{audio:'studio-song-excerpt.wav'}),
 '6':node('MiniMaxH3ReferenceToVideo',{clip:['2',0],vae:['3',0],audio_vae:['4',0],prompt:'Review a song-timed prompt before rendering.',width:1344,height:768,length:243,ref_image_size:'match','ref_audios.ref_audio_0':['5',0]}),
 '7':node('MiniMaxH3NativeAudioLock',{model:['1',0],av_latent:['6',1],audio_vae:['4',0],audio:['5',0]}),
 '8':node('BasicGuider',{model:['7',0],conditioning:['6',0]}),
 '9':node('RandomNoise',{noise_seed:123456}),
 '10':node('KSamplerSelect',{sampler_name:'res_multistep'}),
 '11':node('BasicScheduler',{model:['7',0],scheduler:'beta',steps:20,denoise:1}),
 '12':node('SamplerCustomAdvanced',{noise:['9',0],guider:['8',0],sampler:['10',0],sigmas:['11',0],latent_image:['7',1]}),
 '13':node('VAEDecode',{samples:['12',0],vae:['3',0]}),
 '14':node('CreateVideo',{images:['13',0],audio:['7',2],fps:24}),
 '15':node('SaveVideo',{video:['14',0],filename_prefix:'music-video/shot',format:'auto',codec:'auto'})
 };
 const mappings={positive:JSON.stringify(['6','prompt']),duration:JSON.stringify(['6','length']),audio:JSON.stringify(['5','audio']),seed:JSON.stringify(['9','noise_seed']),width:JSON.stringify(['6','width']),height:JSON.stringify(['6','height'])};
 if(withImage){graph['16']=node('LoadImage',{image:'studio-reference.png'});graph['6'].inputs['ref_images.ref_image_0']=['16',0];mappings.image=JSON.stringify(['16','image']);}
 return {graph:C.workflow(graph),mappings,durationUnit:'frames'};
}
const api={settings,hash,brief,signature,shotSignature,generationFrames,ranges,plan,prompt,nativeWorkflow};if(typeof module!=='undefined')module.exports=api;else root.MusicCore=api;
})(typeof window!=='undefined'?window:globalThis);
