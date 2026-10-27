const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[],requests=[];let invalid=false,gpu=0;
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const prompt=`subject_definitions:

summary:
[text generation] One continuous shot follows the traveler.

retention_analysis:

detailed_description:
Cinematic live action in warm station light.
[Shot 1] The traveler stands beside a brass door, pushes it open and walks through while the camera gently tracks forward. A quiet hinge creaks.

overall_soundscape:
Quiet station room tone.

non_diegetic_music:
N/A`;
await page.route('**/api/ai/request',async r=>{const envelope=r.request().postDataJSON();assert.equal(envelope.timeoutSeconds,3600);const payload=envelope.payload;requests.push(payload);await r.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:invalid?prompt.replace('subject_definitions:','subject_definitions:\n<Picture 99> is an invented image.'):prompt},finish_reason:'stop'}]})});});
await page.route('**/api/comfy/prompt',async r=>{gpu++;await r.fulfill({contentType:'application/json',body:'{}'});});
try{await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8099');await page.locator('[data-action="demo"]').click();await page.locator('[data-tab-id="easy"]').click();const custom=page.locator('[data-field="easy.systemPrompt"]');await custom.locator('xpath=ancestor::details').evaluate(el=>el.open=true);await custom.fill('Use restrained camera moves.');await page.locator('[data-tab-id="ai"]').click();await page.locator('[data-field="ai.endpoint"]').fill('http://director.test/v1');await page.locator('[data-field="ai.model"]').fill('test-director');await page.locator('[data-field="ai.maxOutputTokens"]').fill('32768');await page.locator('[data-field="ai.timeoutMinutes"]').fill('60');await page.locator('[data-field="ai.enabled"]').check();await page.locator('[data-tab-id="timeline"]').click();await page.locator('[data-action="ai-clip"]').click();await page.waitForFunction(()=>document.getElementById('studioStatus').textContent.includes('AI draft ready'));assert.equal(await page.locator('[data-field="clip.prompt"]').inputValue(),prompt);assert.equal(requests[0].max_tokens,32768);assert.match(requests[0].messages[0].content,/Use restrained camera moves/);assert.match(requests[0].messages[0].content,/single-shot reference rewrite guide/);assert.match(requests[0].messages[0].content,/ONE continuous/);assert.deepEqual(JSON.parse(requests[0].messages[1].content).references,[]);invalid=true;await page.locator('[data-action="ai-clip"]').click();await page.waitForFunction(()=>document.getElementById('studioStatus').textContent.includes('unattached reference'));assert.equal(await page.locator('[data-field="clip.prompt"]').inputValue(),prompt);await page.locator('[data-tab-id="easy"]').click();const customSaved=page.locator('[data-field="easy.systemPrompt"]');await customSaved.locator('xpath=ancestor::details').evaluate(el=>el.open=true);assert.equal(await customSaved.inputValue(),'Use restrained camera moves.');await page.locator('[data-action="easy-prompt-reset"]').click();await page.locator('[data-field="easy.systemPrompt"]').locator('xpath=ancestor::details').evaluate(el=>el.open=true);assert.equal(await page.locator('[data-field="easy.systemPrompt"]').inputValue(),'');assert.equal(gpu,0);assert.equal(requests.length,2);assert.deepEqual(errors,[]);console.log('PASS: supplied H3 system guide reaches AI refine; six-section output saves; invented asset leaves prior prompt intact; no GPU jobs.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
