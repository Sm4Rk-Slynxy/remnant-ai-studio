const {test}=require('node:test'),assert=require('node:assert/strict'),Q=require('../render-quality.js'),P=require('../workflow-presets.js'),I=require('../image-core.js'),C=require('../studio-core.js'),M=require('../music-core.js'),E=require('../easy-studio-core.js');
const schema=require('./fixtures/render-quality-schema.json'),model='krea2_demo.safetensors',imageLora='example-image-style.safetensors',videoLora='example-video-style.safetensors',upscaler='example-4x.pth';
const quality={imageModel:model,videoModel:'minimax_h3_fl2va_pruned_int8_convrot.safetensors',loras:[{target:'images',name:imageLora,strength:.7,enabled:true},{target:'video',name:videoLora,strength:.45,enabled:true}],upscale:{method:'model',target:'both',scale:2,model:upscaler}};
test('quality controls survive easy/project normalization and preserve defaults',()=>{assert.equal(Q.active({}),false);const p=C.project();p.easyStudio=E.settings({quality});p.renderQuality=quality;const c=C.normalizeProject(p);assert.equal(c.easyStudio.quality.imageModel,model);assert.equal(c.renderQuality.loras[1].strength,.45);assert.equal(c.renderQuality.upscale.model,upscaler);});
test('Krea preparation receives only image LoRAs and both identity edits and quality edits remain connected',()=>{const c=Q.imageSettings({...P.krea(schema),loras:[{name:'krea2_identity_edit_v1_2.safetensors',strength:1}]},quality,schema);assert.equal(c.model,model);assert.equal(c.loras.length,2);assert.ok(c.loras.some(l=>l.name===imageLora));assert.ok(c.loras.some(l=>/identity/.test(l.name)));assert.ok(!c.loras.some(l=>l.name===videoLora));const g=Q.addUpscale(I.nativeGraph({...c,prompt:'Portrait',width:512,height:768}),c.finishUpscale,'images',{width:512,height:768});I.validate(g,schema);assert.equal(g.studio_quality_images_0_resize.inputs.width,1024);assert.equal(g.studio_quality_images_0_resize.inputs.height,1536);assert.deepEqual(g.save.inputs.images,['studio_quality_images_0_resize',0]);});
test('H3 quality stack feeds the existing turbo workflow once without cycles or mutation',()=>{const p=P.h3(schema),before=JSON.stringify(p.graph),g=Q.videoGraph(p.graph,quality,schema);I.validate(g,schema);assert.equal(g.model.inputs.unet_name,quality.videoModel);assert.equal(g.studio_quality_video_lora_0.inputs.lora_name,videoLora);assert.deepEqual(g.studio_quality_video_lora_0.inputs.model,['model',0]);assert.deepEqual(g.turbo.inputs.model,['studio_quality_video_lora_0',0]);assert.equal(g.turbo.inputs.strength_model,1);assert.equal(g.sigmas.inputs.steps,4);assert.deepEqual(g.video.inputs.images,['studio_quality_video_0_resize',0]);assert.equal(g.studio_quality_video_0_resize.inputs.width,1536);assert.equal(g.studio_quality_video_0_resize.inputs.height,896);assert.equal(JSON.stringify(p.graph),before);});
test('choosing an existing turbo LoRA changes its strength without applying it twice',()=>{const p=P.h3(schema),name=p.graph.turbo.inputs.lora_name,g=Q.videoGraph(p.graph,{loras:[{name,target:'video',strength:.8}]},schema);assert.equal(g.turbo.inputs.strength_model,.8);assert.ok(!Object.keys(g).some(k=>k.includes('quality_video_lora')));});
test('interpolation upscaling preserves source wiring and does not load an SR model',()=>{const g=Q.addUpscale({save:{class_type:'SaveImage',inputs:{images:['decode',0],filename_prefix:'test'}}},{method:'lanczos',scale:2,target:'images'},'images');assert.equal(g.studio_quality_images_0_resize.class_type,'ImageScaleBy');assert.deepEqual(g.studio_quality_images_0_resize.inputs.image,['decode',0]);assert.equal(g.studio_quality_images_0_resize.inputs.scale_by,2);assert.ok(!g.studio_quality_images_0_loader);});
test('missing files, duplicate LoRAs and ambiguous multi-model graphs fail before queueing',()=>{assert.throws(()=>Q.validate({imageModel:'missing'},schema,'images'),/not installed/);assert.throws(()=>Q.validate({upscale:{method:'model',model:'missing'}},schema,'images'),/upscaler/);assert.throws(()=>Q.validate({loras:[{target:'images',name:imageLora},{target:'images',name:imageLora}]},schema,'images'),/only once/);assert.throws(()=>Q.videoGraph({a:{class_type:'UNETLoader',inputs:{}},b:{class_type:'UNETLoader',inputs:{}}},quality,schema),/one UNETLoader/);});
test('quality changes invalidate approved music takes and gallery recipes retain image finishing',()=>{const p=C.project();p.clips=[C.clip()];p.musicVideo=M.settings({songId:'song',songDuration:10});const before=M.shotSignature(p,0,{});p.renderQuality=quality;assert.notEqual(M.shotSignature(p,0,{}),before);const L=require('../image-library.js'),m=L.metadata({mode:'generate',finishUpscale:quality.upscale});assert.equal(L.recipe(m).finishUpscale.model,upscaler);});

test('a new Easy draft carries model, LoRA and upscale selections into active generation settings',()=>{const b={title:'Quality draft',synopsis:'A scene',style:'Cinematic',setting:'Lab',characters:[],scenes:[{key:'s1',name:'Lab',location:'Lab',lighting:'Blue',details:''}]},shots=[{title:'Shot',scene:'s1',cast:[],beat:'Lights brighten',start:'Dim room',end:'Bright room',camera:'Static',dialogue:'',transition:'cut',startImagePrompt:'Dim lab',endImagePrompt:'Bright lab'}],p=E.build({story:'Lights brighten',quality},b,shots,[10]);assert.equal(p.renderQuality.imageModel,model);assert.equal(p.renderQuality.loras[1].name,videoLora);assert.equal(p.easyStudio.quality.upscale.scale,2);});
test('interpolated image output dimensions are recorded accurately for gallery reuse',()=>{const L=require('../image-library.js'),g=Q.addUpscale(I.nativeGraph({...P.krea(schema),prompt:'Lab',width:512,height:768}),{method:'lanczos',scale:2,target:'images'},'images',{width:512,height:768}),m=L.graphMetadata(g);assert.equal(m.width,1024);assert.equal(m.height,1536);});

test('DLSS 5 routes Krea images and temporal H3 frames through the installed OreX interface',()=>{
 const u={method:'dlss5',target:'both',scale:1.5};
 Q.validate({upscale:u},schema,'images');
 const image=Q.addUpscale(I.nativeGraph({...P.krea(schema),prompt:'Lab',width:512,height:768}),u,'images',{width:512,height:768});
 I.validate(image,schema);
 const still=image.studio_quality_images_0_enhance;
 assert.equal(still.class_type,'DLSS5NeuralRendering');assert.equal(still.inputs.temporal_mode,'none');assert.equal(still.inputs.upscaling_mode,'1.5x (Quality)');assert.equal(still.inputs.chunk_frames,4);
 assert.deepEqual(image.studio_quality_images_0_resize.inputs.image,['studio_quality_images_0_enhance',0]);
 assert.equal(image.studio_quality_images_0_resize.inputs.width,768);
 const p=P.h3(schema),before=JSON.stringify(p.graph),video=Q.videoGraph(p.graph,{upscale:u},schema);
 I.validate(video,schema);assert.equal(video.studio_quality_video_0_enhance.inputs.temporal_mode,'auto');assert.deepEqual(video.video.inputs.images,['studio_quality_video_0_resize',0]);assert.equal(video.video.inputs.fps,p.graph.video.inputs.fps);assert.deepEqual(video.video.inputs.audio,p.graph.video.inputs.audio);assert.equal(JSON.stringify(p.graph),before);
 const m=require('../image-library.js').graphMetadata(image);assert.equal(m.width,768);assert.equal(m.height,1152);
 assert.equal(Q.settings({upscale:u}).upscale.method,'dlss5');
});
test('DLSS 5 rejects missing backend nodes, unsupported scales and excessive frame sizes before queueing',()=>{
 const missing={...schema};delete missing.DLSS5NeuralRendering;
 assert.throws(()=>Q.validate({upscale:{method:'dlss5',scale:2}},missing,'images'),/DLSS5NeuralRendering/);
 assert.throws(()=>Q.validate({upscale:{method:'dlss5',scale:4}},schema,'images'),/1.5/);
 const g={save:{class_type:'SaveImage',inputs:{images:['decode',0]}}};
 assert.throws(()=>Q.addUpscale(g,{method:'dlss5',scale:2},'images',{width:4096,height:4096}),/16 megapixels/);
 const native=Q.addUpscale(g,{method:'dlss5',scale:1},'images',{width:512,height:768});assert.equal(native.studio_quality_images_0_enhance.inputs.upscaling_mode,'1x (DLAA / native)');assert.equal(native.studio_quality_images_0_resize.inputs.width,512);
});

test('clip overrides persist, isolate clips and reset cleanly to changing project defaults',()=>{
 const p=C.project();p.renderQuality=structuredClone(quality);p.clips=[C.clip(),C.clip()];
 assert.equal(Q.effective(p,p.clips[0]).videoModel,quality.videoModel);
 p.clips[0].renderQuality=Q.effective(p,p.clips[0]);p.clips[0].renderQuality.videoModel='clip-only';
 assert.equal(Q.effective(p,p.clips[1]).videoModel,quality.videoModel);
 const restored=C.normalizeProject(p);assert.equal(restored.clips[0].renderQuality.videoModel,'clip-only');assert.equal(restored.clips[1].renderQuality,undefined);
 p.renderQuality.videoModel='new-project-default';assert.equal(Q.effective(p,p.clips[0]).videoModel,'clip-only');
 delete p.clips[0].renderQuality;assert.equal(Q.effective(p,p.clips[0]).videoModel,'new-project-default');
});
test('per-clip video quality invalidates only that independent music take and its approval',()=>{
 const p=C.project();p.musicVideo=M.settings({songId:'song',songDuration:20});p.clips=[C.clip(),C.clip()];
 const cfg={},before=p.clips.map((c,i)=>M.shotSignature(p,i,cfg)),approval=M.signature(p,cfg);
 p.clips[0].renderQuality=Q.settings({videoModel:quality.videoModel,upscale:{method:'dlss5',target:'video',scale:2}});
 assert.notEqual(M.shotSignature(p,0,cfg),before[0]);assert.equal(M.shotSignature(p,1,cfg),before[1]);assert.notEqual(M.signature(p,cfg),approval);
 const active=M.shotSignature(p,0,cfg);p.clips[0].renderQuality.imageModel='image-only-change';assert.equal(M.shotSignature(p,0,cfg),active);
 assert.equal(Q.outputScale(p),2);p.clips[1].renderQuality=Q.settings({upscale:{method:'model',target:'video',scale:4}});assert.equal(Q.outputScale(p),4);
});
