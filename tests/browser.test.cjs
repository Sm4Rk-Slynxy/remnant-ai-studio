/* Run with NODE_PATH pointing to your Playwright installation and the app on :8099. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
    const browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',d=>d.accept(d.type()==='prompt'?'1':undefined));
    try {
        await page.route('**/api/studio/config',r=>r.fulfill({status:404,body:'{}'}));
        await page.route('**/api/ai/health',r=>r.fulfill({status:404,body:'{}'}));
        await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8099');
        await page.locator('[data-action="demo"]').click();
        await page.locator('[data-field="title"]').fill('Browser test film');
        await page.locator('[data-tab-id="timeline"]').click();
        assert.equal(await page.locator('.clip-item').count(),3);
        await page.locator('[data-field="clip.actualEnd"]').fill('Mara holds the silver handle with her right hand.');
        await page.locator('[data-action="carry-end"]').click();
        assert.equal(await page.locator('[data-field="clip.start"]').inputValue(),'Mara holds the silver handle with her right hand.');
        await page.locator('[data-action="clip-prompt"]').click();
        assert.match(await page.locator('[data-field="clip.prompt"]').inputValue(),/silver handle/);
        await page.reload();
        assert.equal(await page.locator('#studioTitle').textContent(),'Browser test film');
        await page.locator('[data-tab-id="timeline"]').click();
        await page.locator('.clip-item').nth(1).click();
        assert.match(await page.locator('[data-field="clip.prompt"]').inputValue(),/silver handle/);
        // Real browser media storage, portable backup and import.
        await page.locator('[data-tab-id="assets"]').click();
        await page.locator('#studioMedia').setInputFiles({name:'anchor.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ3sAAAAASUVORK5CYII=','base64')});
        await page.waitForFunction(()=>document.querySelector('.asset-list img')?.complete);
        const downloadWait=page.waitForEvent('download');await page.locator('[data-action="export-project"]').click();
        const download=await downloadWait;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);
        const backup=JSON.parse(Buffer.concat(chunks).toString());assert.equal(backup.media.length,1);assert.equal(backup.project.title,'Browser test film');assert.equal(backup.connection,undefined);
        await page.locator('#studioImport').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
        await page.waitForFunction(()=>document.querySelector('#studioTitle')?.textContent.endsWith('(imported)'));
        // Local video playback and capture feed the next clip's actual starting image.
        if(process.env.STUDIO_VIDEO) {
            await page.locator('#studioMedia').setInputFiles(process.env.STUDIO_VIDEO);
            await page.waitForFunction(()=>document.querySelectorAll('.asset-list video').length===1);
            await page.locator('[data-tab-id="timeline"]').click();
            await page.locator('[data-action="preview-video"]').click();
            await page.waitForFunction(()=>document.querySelector('#studioPreview video')?.readyState>=2);
            await page.evaluate(()=>{document.querySelector('#studioPreview video').currentTime=1;});
            await page.waitForFunction(()=>document.querySelector('#studioPreview video')?.currentTime===1);
            await page.locator('[data-action="capture-frame"]').click();
            await page.waitForFunction(()=>document.querySelector('#studioStatus').textContent.includes('Frame captured'));
            await page.locator('.clip-item').nth(1).click();
            assert.equal(await page.locator('[data-field="clip.startAsset"] option:checked').textContent(),'ending-1.png');
        }
        // Mapped workflow upload / queue / history / output retrieval, through a mocked server.
        let queued,uploads=0;
        await page.route('http://comfy.test/**',async route=>{
            const url=new URL(route.request().url());let body;
            if(url.pathname==='/system_stats')body={system:{comfyui_version:'test'},devices:[{name:'mock GPU'}]};
            else if(url.pathname==='/upload/image'){uploads++;body={name:'uploaded-anchor.png',subfolder:'studio'};}
            else if(url.pathname==='/prompt'){queued=route.request().postDataJSON();body={prompt_id:'job-1'};}
            else if(url.pathname==='/history/job-1')body={'job-1':{status:{completed:true,status_str:'success'},outputs:{'9':{images:[{filename:'result.png',subfolder:'',type:'output'}]}}}};
            else if(url.pathname==='/view')return route.fulfill({contentType:'image/png',body:Buffer.from(backup.media[0].data.split(',')[1],'base64')});
            else throw new Error('Unexpected API request '+url.pathname);
            return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
        });
        await page.locator('[data-tab-id="render"]').click();await page.locator('[data-field="comfy.endpoint"]').fill('http://comfy.test');
        await page.locator('[data-action="test-comfy"]').click();await page.waitForFunction(()=>document.querySelector('#studioStatus').textContent.includes('Connected'));
        const graph={'1':{class_type:'Text',inputs:{text:'old'}},'2':{class_type:'Sampler',inputs:{seed:1,seconds:10,positive:['1',0]}},'3':{class_type:'LoadImage',inputs:{image:'old.png'}}};
        await page.locator('#studioWorkflow').setInputFiles({name:'workflow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(graph))});
        await page.waitForFunction(()=>document.querySelector('[data-mapping="positive"]').options.length>1);
        await page.locator('[data-mapping="positive"]').selectOption('["1","text"]');
        await page.locator('[data-mapping="seed"]').selectOption('["2","seed"]');
        await page.locator('[data-mapping="duration"]').selectOption('["2","seconds"]');
        await page.locator('[data-mapping="image"]').selectOption('["3","image"]');
        await page.locator('[data-tab-id="timeline"]').click();await page.locator('.clip-item').nth(1).click();
        const asset=backup.project.assets[0];
        await page.locator('[data-field="clip.startAsset"]').selectOption({label:asset.name});
        await page.locator('[data-action="queue-clip"]').click();
        await page.waitForFunction(()=>document.querySelector('.clip-item.active')?.textContent.includes('complete'));
        assert.equal(uploads,1);assert.match(queued.prompt['1'].inputs.text,/silver handle/);assert.equal(queued.prompt['3'].inputs.image,'studio/uploaded-anchor.png');assert.deepEqual(queued.prompt['2'].inputs.positive,['1',0]);
        assert.equal(await page.locator('[data-action="preview-take"]').count(),1);
        await page.locator('[data-action="check-job"]').click();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('[data-action="preview-take"]').count(),1);
        await page.locator('[data-action="preview-take"]').click();
        await page.locator('[data-tab-id="characters"]').click();await page.locator('[data-action="save-profile"]').click();
        await page.locator('[data-action="use-profile"]').click();assert.equal(await page.locator('[data-character]').count(),2);
        await page.waitForTimeout(850);await page.locator('[data-action="add-character"]').click();
        assert.equal(await page.locator('[data-character]').count(),3);
        await page.locator('[data-action="undo"]').click();assert.equal(await page.locator('[data-character]').count(),2);
        await page.locator('[data-action="redo"]').click();assert.equal(await page.locator('[data-character]').count(),3);
        // AI planning/refinement: validate output and preserve a plan on malformed responses.
        let aiMode='plan';
        await page.route('http://director.test/**',async route=>{
            const request=route.request().postDataJSON();assert.equal(request.messages.length,2);
            const content=aiMode==='invalid'?'not json':aiMode==='clip'?'subject_definitions:\nsummary:\n[text generation] Mara continues toward the train.\nretention_analysis:\ndetailed_description:\n[Shot 1] Mara walks slowly along the platform.\noverall_soundscape:\nRain continues.\nnon_diegetic_music:\nN/A':JSON.stringify({clips:Array.from({length:3},(_,i)=>({title:'AI clip '+(i+1),beat:'Mara continues walking along the platform.',start:'Mara stands by the train.',end:'Mara is beside the door.',camera:'The camera tracks slowly.',dialogue:''}))});
            await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content},finish_reason:'stop'}]})});
        });
        await page.evaluate(()=>{state.aiConfig={backend:'openai',endpoint:'http://director.test/v1',model:'test-director',apiKey:'',enabled:true};});
        await page.locator('[data-tab-id="story"]').click();await page.locator('[data-action="ai-plan"]').click();
        await page.waitForFunction(()=>document.querySelector('.clip-item')?.textContent.includes('AI clip'));
        aiMode='clip';await page.locator('[data-action="ai-clip"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-field="clip.prompt"]')?.value.includes('Rain continues.'));
        aiMode='invalid';await page.locator('[data-tab-id="story"]').click();await page.locator('[data-action="ai-plan"]').click();
        await page.waitForFunction(()=>document.querySelector('#studioStatus').classList.contains('error'));
        await page.locator('[data-tab-id="timeline"]').click();assert.equal(await page.locator('.clip-item').count(),3);assert.match(await page.locator('.clip-item').first().textContent(),/AI clip/);
        await page.evaluate(()=>{state.aiConfig.enabled=false;});
        // Existing prompt generator remains accessible and uses structured H3 prompts.
        await page.locator('#openGenerator').click();await page.locator('#workflow').selectOption('text-to-video');await page.locator('#model').selectOption('minimax-h3');
        await page.locator('#characters').fill('An adult explorer in a blue jacket');await page.locator('#action').fill('walks toward a lighthouse');await page.locator('#generateBtn').click();
        assert.match(await page.locator('#positivePrompt').inputValue(),/integrated_multimodal_description/);
        assert.doesNotMatch(await page.locator('#positivePrompt').inputValue(),/\(.*:1.2\)/);
        await page.locator('#openStudio').click();await page.screenshot({path:'/tmp/film-studio-desktop.png',fullPage:true});
        await page.setViewportSize({width:390,height:844});await page.locator('[data-tab-id="story"]').click();
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:'/tmp/film-studio-mobile.png',fullPage:true});
        assert.deepEqual(errors,[]);console.log('Browser integration passed: planning, continuity, persistence, media backup/import, mapped ComfyUI flow, legacy generator, mobile layout.');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
