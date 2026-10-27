const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8101');
 await page.evaluate(()=>{state.collections=[{id:"x');window.importExecuted=true;//",name:'Safe collection',prompts:[{id:"y');window.importExecuted=true;//",workflow:'<img src=x onerror=window.importExecuted=true>',model:'<svg onload=window.importExecuted=true>',positivePrompt:'An illustrated greenhouse.',negativePrompt:'',seed:'<img src=x onerror=window.importExecuted=true>',createdAt:'2026-01-01'}]}];saveToLocalStorage();updateAllUI();});
 await page.locator('#openGenerator').click();await page.locator('[data-prompt-action=show]').click();
 assert.equal(await page.locator('#savedPromptsList img, #savedPromptsList svg').count(),0);
 assert.match(await page.locator('.saved-prompt-workflow').innerText(),/<img/);
 assert.equal(await page.locator('#savedPromptsList [onclick], #collectionsList [onclick]').count(),0);
 await page.locator('[data-prompt-action=detail]').click();assert.equal(await page.locator('#promptDetailContent img').count(),0);
 assert.equal(await page.evaluate(()=>window.importExecuted),undefined);
 const download=page.waitForEvent('download');await page.evaluate(()=>{state.aiConfig.apiKey='synthetic-session-only-key';exportData();});
 const file=await download,stream=await file.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);assert.equal(JSON.parse(Buffer.concat(chunks)).aiConfig.apiKey,'');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('comfyui-prompt-generator')).aiConfig.apiKey),'');
 assert.deepEqual(errors,[]);console.log('PASS: hostile collection IDs use safe callbacks, prompt markup remains text, and dedicated API keys are excluded from storage/exports.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
