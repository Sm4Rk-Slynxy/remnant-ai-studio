/* Film Studio: local projects, media, continuity and a mapped ComfyUI client. */
(function () {
    'use strict';
    const C = StudioCore;
    const KEY = 'comfyui-film-studio-v1';
    let proxyConfig=null;
    let comfyDraft=null,comfySaving=false;
    const proxyReady=fetch('/api/studio/config').then(r=>r.ok?r.json():null).then(cfg=>{if(cfg?.token)proxyConfig={endpoint:cfg.comfyEndpoint?C.safeEndpoint(cfg.comfyEndpoint):'',token:cfg.token};}).catch(()=>{});
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = id => document.getElementById(id);
    let data = { projects: [C.project()], selected: '', profiles: [], connection: { endpoint: 'http://127.0.0.1:8188', graph: null, mappings: {}, durationUnit: 'seconds' } };
    let tab = 'easy', selectedClip = '', activeRun = null, busy = false, submitting = false, urls = [], dbPromise;
    const previous = new Map(), undo = new Map(), redo = new Map(), historyTime = new Map();
    let pendingRemoteSave = '';
    const AI_KEY='comfyui-studio-ai-connections-v1';
    let aiProfiles=[],aiProfile='',aiModels=[],aiMessage='Not tested yet.',aiTesting=false;
    try {const saved=JSON.parse(localStorage.getItem(AI_KEY)||'{}');aiProfiles=Array.isArray(saved.profiles)?saved.profiles.slice(0,20):[];aiProfile=saved.selected||'';}catch{}
    function saveAI(){
        updateSettingsPanel();saveToLocalStorage();
        localStorage.setItem(AI_KEY,JSON.stringify({selected:aiProfile,profiles:aiProfiles.map(p=>({...p,apiKey:''}))}));
    }
    function aiPanel(){const cfg=state.aiConfig;
        return `<div class="section-intro"><div><h3>AI connections</h3><p>Power the studio with a text model on this computer or your local network.</p></div>${badge(cfg.enabled?'AI enabled':'AI disabled',cfg.enabled?'complete':'draft')}</div>
        <div class="music-layout"><div class="studio-card"><div class="panel-heading"><span>Active AI connection</span><small>LOCAL / NETWORK</small></div>
        ${select('Server software','ai.provider',cfg.provider||'compatible',[['unsloth','Unsloth'],['vllm','vLLM'],['lmstudio','LM Studio'],['ollama','Ollama'],['compatible','Other OpenAI-compatible server']])}
        ${field('API base URL','ai.endpoint',cfg.endpoint,'url','placeholder="http://127.0.0.1:8000/v1"')}
        <p class="field-hint">Use 127.0.0.1 for this computer or the other computer’s LAN IP. Include the API base path, usually /v1.</p>
        <div class="studio-actions">${button(aiTesting?'Connecting…':'Discover models','ai-models',aiTesting?'disabled':'')}${button('Test model','ai-test',aiTesting?'disabled':'')}</div>
        ${aiModels.length?select('Available server models','ai.model',cfg.model,[['','Choose a model'],...aiModels.map(x=>[x,x])]):''}
        ${field('Model ID','ai.model',cfg.model,'text','placeholder="Model name returned by your server"')}
        ${field('Reply token limit · per AI request','ai.maxOutputTokens',LocalAI.replyLimit(cfg),'number','min="256" max="65536" step="1"')}<p class="field-hint">Maximum generated reply, separate from the model’s context window. Default: 16,384. Increase for long replies or models that spend tokens reasoning; the server must allow the requested output length.</p>
        ${field('AI request timeout · minutes','ai.timeoutMinutes',LocalAI.timeoutMinutes(cfg),'number','min="1" max="120" step="1"')}<p class="field-hint">How long to wait for each local AI reply. Default: 30 minutes. This setting also controls the studio’s AI relay timeout.</p>
        ${field('API key · optional, kept for this session','ai.apiKey',cfg.apiKey||'','password','autocomplete="off"')}
        <label class="toggle-label"><input type="checkbox" data-field="ai.enabled" ${cfg.enabled?'checked':''}>Use this connection for studio AI</label>
        <p class="studio-status" aria-live="polite">${esc(aiMessage)}</p></div>
        <div class="studio-card"><div class="panel-heading"><span>Saved connections</span><small>SWITCH SERVERS</small></div>
        ${select('Connection profile','ai.profile',aiProfile,[['','Current / unsaved connection'],...aiProfiles.map(p=>[p.id,p.name])])}
        ${field('Profile name','ai.profileName',aiProfiles.find(p=>p.id===aiProfile)?.name||cfg.provider||'My AI server')}
        <div class="studio-actions">${button('Save connection profile','ai-save')}${button('New connection','ai-new')}</div>
        <p class="field-hint">Profiles save the address, model and server type in this browser. API keys are excluded.</p>
        <h3>What this model powers</h3><p class="studio-muted">Story development, music-video plot enhancement, song-timed shot planning and prompt refinement. Review the AI’s plan before rendering.</p>
        <p class="studio-muted">ComfyUI renders the approved video using its own connection. Your original song remains the final soundtrack.</p>
        <details class="studio-disclosure"><summary>Server setup notes</summary><p>Start your text model’s OpenAI-compatible API server. For a network server, enable LAN listening and use its computer’s IP address. The included studio server relays AI requests, avoiding browser CORS restrictions.</p><p>Typical API bases: Unsloth uses the address shown by its server; vLLM http://127.0.0.1:8000/v1; LM Studio http://127.0.0.1:1234/v1; Ollama http://127.0.0.1:11434/v1. Change the IP and port to match your setup.</p></details></div></div>`;
    }
    function editAI(el){const key=el.dataset.field?.slice(3);if(!key)return;
        if(key==='profileName')return;
        if(key==='profile'){const p=aiProfiles.find(p=>p.id===el.value);aiProfile=el.value;if(p)Object.assign(state.aiConfig,{backend:'openai',provider:p.provider,endpoint:p.endpoint,model:p.model,enabled:p.enabled,maxOutputTokens:LocalAI.replyLimit(p),timeoutMinutes:LocalAI.timeoutMinutes(p),apiKey:''});aiModels=[];aiMessage='Connection selected. Test it before generating.';saveAI();render();return;}
        if(['maxOutputTokens','timeoutMinutes'].includes(key)){if(!el.validity.valid||el.value==='')return;state.aiConfig[key]=Number(el.value);}else state.aiConfig[key]=el.type==='checkbox'?el.checked:el.value;state.aiConfig.backend='openai';
        aiMessage='Settings changed. Test this connection.';
        if(key==='provider'&&el.tagName==='SELECT'){aiModels=[];saveAI();render();}else saveAI();
    }
    async function aiConnectionAction(action){
        if(action==='ai-new'){aiProfile='';aiModels=[];state.aiConfig={backend:'openai',provider:'compatible',endpoint:'http://127.0.0.1:8000/v1',model:'',enabled:false,apiKey:''};aiMessage='Enter your server address, then discover its models.';saveAI();render();return;}
        if(action==='ai-save'){const name=$('studioContent').querySelector('[data-field="ai.profileName"]').value.trim();if(!name)throw Error('Give this connection a name.');LocalAI.base(state.aiConfig.endpoint);const profile={id:aiProfile||C.uid(),name,provider:state.aiConfig.provider||'compatible',endpoint:state.aiConfig.endpoint,model:state.aiConfig.model,enabled:state.aiConfig.enabled,maxOutputTokens:LocalAI.replyLimit(state.aiConfig),timeoutMinutes:LocalAI.timeoutMinutes(state.aiConfig)};const old=aiProfiles.findIndex(p=>p.id===profile.id);if(old<0)aiProfiles.push(profile);else aiProfiles[old]=profile;aiProfile=profile.id;saveAI();render();status('AI connection saved. API key stays in this session.','success');return;}
        if(aiTesting)return;const config=structuredClone(state.aiConfig);aiTesting=true;aiMessage=action==='ai-models'?'Reading available models…':'Testing model generation…';render();
        try{if(action==='ai-models'){aiModels=await LocalAI.models(config);if(!aiModels.length)throw Error('No models listed. Load a text model on the server.');if(!aiModels.includes(state.aiConfig.model))state.aiConfig.model=aiModels[0];aiMessage=`Connected. ${aiModels.length} model${aiModels.length===1?'':'s'} available.`;saveAI();}else{await LocalAI.test(config);aiMessage=`Model ${config.model} responded successfully.`;}}
        catch(error){aiMessage='Connection failed: '+error.message;}
        finally{aiTesting=false;render();}
    }
    const current = () => data.projects.find(p => p.id === data.selected) || data.projects[0];
    const currentClip = () => current().clips.find(c => c.id === selectedClip) || current().clips[0];
    function receiveStudioSave(value) {
        // Never replace the project object used by an active generation loop.
        if (!value || VideoJoiner.isRunning() || Sequence.isRunning() || Characters.isRunning() || Music.isRunning() || Images.isRunning() || Photoshoot.isRunning() || Easy.isRunning() || activeRun || submitting || busy) return;
        if (document.activeElement?.matches('input,textarea,select')) { pendingRemoteSave=value; return; }
        try {
            const raw=JSON.parse(value);
            if (!Array.isArray(raw.projects)||!raw.projects.length) return;
            let preservedImages=false;const projects=raw.projects.map(value=>{let p=C.normalizeProject(value);const existing=data.projects.find(x=>x.id===p.id);if(existing){if(existing.imageStudio?.library?.length||existing.assets.some(a=>a.imageMetadata))preservedImages=true;if(!value.imageStudio&&existing.imageStudio)preservedImages=true;for(const c of p.characters){const old=existing.characters.find(x=>x.id===c.id),source=value.characters?.find(x=>x.id===c.id);if(old&&source&&!('references' in source)){for(const key of ['canonical','references','outfit','avoid','sheetSeed','sheetJob'])c[key]=structuredClone(old[key]??(key==='references'?[]:''));preservedImages=true;}}p=ImageCore.retainLegacy(p,existing);}return p;});
            const connection=raw.connection?{endpoint:C.safeEndpoint(raw.connection.endpoint),graph:raw.connection.graph?C.workflow(raw.connection.graph):null,mappings:raw.connection.mappings||{},durationUnit:['seconds','frames','frames-plus-one'].includes(raw.connection.durationUnit)?raw.connection.durationUnit:'seconds'}:data.connection;
            data.projects=projects;data.connection=connection;
            if (!projects.some(p=>p.id===data.selected))data.selected=projects.some(p=>p.id===raw.selected)?raw.selected:projects[0].id;
            if (proxyConfig?.endpoint)data.connection.endpoint=proxyConfig.endpoint;
            for (const p of projects) { const snapshot=structuredClone(p);delete snapshot.updatedAt;previous.set(p.id,snapshot);undo.delete(p.id);redo.delete(p.id); }
            pendingRemoteSave='';if(preservedImages&&JSON.stringify(data.projects)!==JSON.stringify(raw.projects))localStorage.setItem(KEY,JSON.stringify(data));render();status('Project updated from the other studio tab.');
        } catch { /* A malformed external save must not replace the visible project. */ }
    }
    const paths = {
        plus: 'M12 5v14M5 12h14', film: 'M4 4h16v16H4zM4 8h16M8 8v12M16 8v12',
        arrow: 'M5 12h14m-5-5 5 5-5 5', download: 'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4',
        upload: 'M12 16V4m-4 4 4-4 4 4M5 16v4h14v-4', copy: 'M9 9h11v11H9zM15 9V4H4v11h5',
        undo: 'M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10', redo: 'm15 5 5 5-5 5M20 10H10a5 5 0 0 0 0 10',
        play: 'm8 5 11 7-11 7V5Z', spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
        image: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M8 8h.01', chevron: 'm9 5 7 7-7 7',
        folder: 'M3 7h7l2 2h9v11H3zM3 7V4h7l2 3', settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
        trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7', check: 'm5 12 4 4L19 6',
        book: 'M12 5c-4-3-8-2-9-1v15c3-2 6-2 9 0 3-2 6-2 9 0V4c-1-1-5-2-9 1Zm0 0v14',
        users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 7M20 21v-3a7 7 0 0 0-3-5',
        clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2', bolt: 'm13 2-9 12h7l-1 8 10-12h-7l0-8'
    };
    const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.film}"/></svg>`;
    const field = (label, key, value, type = 'text', attrs = '') => `<label class="studio-field"><span class="field-label">${esc(label)}</span><input class="form-input" data-field="${key}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
    const placeholders = { story: 'Describe your film in a few beats. One line becomes one moment in the sequence.', setting: 'Location, time of day, lighting and details that should stay consistent.', 'clip.actualEnd': 'What does the rendered clip really end on? Describe pose, position and camera direction.', 'character.description': 'Distinctive features, wardrobe and the props that stay with this character.' };
    const area = (label, key, value, extra = '') => `<label class="studio-field"><span class="field-label">${esc(label)}</span><textarea class="form-input ${extra}" data-field="${key}" placeholder="${esc(placeholders[key] || '')}">${esc(value)}</textarea></label>`;
    const select = (label, key, value, options) => `<label class="studio-field"><span class="field-label">${esc(label)}</span><select class="form-select" data-field="${key}">${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const actionIcons = { 'music-direct':'spark','music-draft':'film','music-approve':'check','music-render':'play','music-export':'download','music-setup':'settings','music-reprompt':'spark','music-preview':'play','music-stop':'clock', 'add-clip':'plus','add-character':'plus','new-project':'plus','copy-clip':'copy','copy-clip-seed':'copy','duplicate-clip':'copy','duplicate-project':'copy','delete-project':'trash','delete-clip':'trash','undo':'undo','redo':'redo','ai-plan':'spark','ai-clip':'spark','queue-clip':'play','export-pack':'download','export-project':'download','export-characters':'download','import-media':'upload','capture-frame':'image','clip-prompt':'spark','carry-end':'arrow','test-comfy':'bolt','import-workflow':'upload','open-settings':'settings' };
    const button = (label, action, extra = '') => `<button class="btn btn-small btn-outline ${['queue-clip','music-render','music-direct','join-run'].includes(action) ? 'btn-primary' : ''}" data-action="${action}" ${extra}>${actionIcons[action] ? icon(actionIcons[action]) : ''}<span>${label}</span></button>`;
    const badge = (label, kind = '') => `<span class="status-badge ${kind}"><i></i>${esc(label)}</span>`;

    const ClipQuality = createClipQuality({esc,button,field,select,save,render,status,comfyRequest,connection:()=>data.connection,productionRunning:()=>VideoJoiner.isRunning()||Sequence.isRunning()||busy||activeRun||submitting||Images.isRunning()||Music.isRunning()||Characters.isRunning()||Photoshoot.isRunning()||Easy.isRunning()});

    const Music = createMusicStudio({esc,button,field,area,select,icon,connection:()=>data.connection,aiConfig:()=>state.aiConfig,save,render,status,assetStore,addAsset,comfyRequest,queueClip,watchJob,outputURL,download:(...args)=>download(...args),openClip:id=>{selectedClip=id;tab='timeline';render();}});

    const Images = createImageStudio({esc,button,field,area,select,connection:()=>data.connection,aiConfig:()=>state.aiConfig,save,render,status,assetStore,addAsset,comfyRequest,outputURL,download:(...args)=>download(...args),downloadBlob,updateSummary:updateProjectSummary,productionRunning:()=>VideoJoiner.isRunning()||Sequence.isRunning()||Photoshoot.isRunning()||Characters.isRunning()||Music.isRunning()||activeRun||submitting});

    const Gallery = createImageGallery({esc,button,field,area,select,projects:()=>data.projects,save,render,status,assetStore,addAsset,comfyRequest,outputURL,download:(...args)=>download(...args),downloadBlob,connection:()=>data.connection,productionRunning:()=>VideoJoiner.isRunning()||Sequence.isRunning()||Photoshoot.isRunning()||Music.isRunning()||Images.isRunning(),openImages:()=>{tab='images';render();}});
    const Characters = createCharacterStudio({esc,button,field,area,select,profiles:()=>data.profiles,save,render,status,assetStore,addAsset,currentClip,connection:()=>data.connection,comfyRequest,outputURL,download:(...args)=>download(...args),productionRunning:()=>VideoJoiner.isRunning()||Sequence.isRunning()||Photoshoot.isRunning()||Music.isRunning()||Images.isRunning()||activeRun||submitting,openImages:()=>{tab='images';render();}});

    const Photoshoot = createPhotoshootStudio({esc,button,field,area,select,save,render,status,assetStore,addAsset,comfyRequest,outputURL,connection:()=>data.connection,download:(...args)=>download(...args),downloadBlob,productionRunning:()=>VideoJoiner.isRunning()||Sequence.isRunning()||busy||Characters.isRunning()||Images.isRunning()||Music.isRunning()||activeRun||submitting});

    const Cast = createCharacterDirector({button,field,area,aiConfig:()=>state.aiConfig,current,save,render,status,isBusy:()=>busy,setBusy:v=>{busy=v;},productionRunning:()=>VideoJoiner.isRunning()||Sequence.isRunning()||Photoshoot.isRunning()||Characters.isRunning()||Images.isRunning()||Music.isRunning()||activeRun||submitting,openCharacters:()=>{tab='characters';render();}});

    const Easy = createEasyStudio({sequencePanel:p=>Sequence.panel(p),esc,button,field,area,select,comfyRequest,updateSummary:updateProjectSummary,aiConfig:()=>state.aiConfig,current,save,render,status,assetStore,song:(file,p)=>Music.song(file,p),setBusy:v=>{busy=v;},productionRunning:()=>VideoJoiner.isRunning()||Sequence.isRunning()||busy||Photoshoot.isRunning()||Characters.isRunning()||Images.isRunning()||Music.isRunning()||activeRun||submitting,open:(next,id)=>{tab=next;if(id)selectedClip=id;render();},commit:draft=>{data.projects.push(draft);data.selected=draft.id;selectedClip=draft.clips[0]?.id||'';tab='easy';save();render();}});

    function status(message, kind = '') {
        const el = $('studioStatus');
        if (el) { el.textContent = message; el.className = `studio-status ${kind}`; }
    }
    const Sequence = createSequenceStudio({esc,button,save,render,status,current,connection:()=>data.connection,aiConfig:()=>state.aiConfig,assetStore,addAsset,comfyRequest,queueClip,watchJob,outputURL,downloadBlob,productionRunning:()=>VideoJoiner.isRunning()||busy||activeRun||submitting||Easy.isRunning()||Characters.isRunning()||Music.isRunning()||Images.isRunning()||Photoshoot.isRunning()});

    const VideoJoiner=createVideoJoiner({esc,button,field,select,current,save,render,status,assetStore,addAsset,downloadBlob,productionRunning:()=>Sequence.isRunning()||busy||activeRun||submitting||Easy.isRunning()||Images.isRunning()||Music.isRunning()||Characters.isRunning()||Photoshoot.isRunning()});

    function save(skipHistory = false) {
        pendingRemoteSave='';
        const p = current(); data.projects.forEach(ImageLibrary.archive); Music.changed(p); Sequence.changed(p); const snapshot = structuredClone(p); delete snapshot.updatedAt;
        if (!skipHistory && previous.has(p.id) && JSON.stringify(snapshot) !== JSON.stringify(previous.get(p.id))) {
            const stack = undo.get(p.id) || [];
            if (Date.now() - (historyTime.get(p.id) || 0) > 800) { stack.push(previous.get(p.id)); if (stack.length > 30) stack.shift(); historyTime.set(p.id, Date.now()); }
            undo.set(p.id, stack); redo.set(p.id, []);
        }
        previous.set(p.id, snapshot);
        current().updatedAt = new Date().toISOString();
        try { localStorage.setItem(KEY, JSON.stringify(data)); $('studioSaveState').textContent = 'Saved on this browser'; }
        catch { $('studioSaveState').textContent = 'Save failed — export a backup'; status('Browser storage is full or unavailable. Export your project before closing this tab.', 'error'); }
    }
    function database() {
        if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('comfyui-studio-media', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('assets');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(new Error('Media storage is unavailable in this browser.'));
        });
        return dbPromise;
    }
    async function assetStore(method, id, blob) {
        const db = await database();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('assets', method === 'get' ? 'readonly' : 'readwrite');
            const req = method === 'put' ? tx.objectStore('assets').put(blob, id) : tx.objectStore('assets')[method](id);
            let result;
            req.onsuccess = () => { result = req.result; };
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(new Error('Unable to store media. Check browser disk space.'));
            tx.onabort = tx.onerror;
        });
    }
    async function addAsset(file, role = 'Reference', p = current()) {
        if (!/^(image|video|audio)\//.test(file.type)) throw new Error('Choose an image, video or audio file.');
        if (file.size > 250 * 1024 * 1024) throw new Error('Use media smaller than 250 MB per file.');
        const a = { id: C.uid(), name: file.name || 'Captured frame.png', type: file.type, role };
        await assetStore('put', a.id, file);
        p.assets.push(a);
        save();
        return a;
    }
    function mount() {
        $('studioRoot').innerHTML = `<div class="studio-layout">
            <aside class="studio-sidebar"><details id="studioLibrary" open><summary class="library-switcher">${icon('folder')}<span id="studioLibraryName">Projects</span>${icon('chevron')}</summary><div class="library-content">
            <div class="library-heading"><h2>Projects</h2><span id="studioProjectCount"></span></div><button class="btn btn-primary" data-action="new-project">${icon('plus')}New film</button>
            <div class="project-list" id="studioProjects"></div>
            <button class="btn library-example" data-action="demo">${icon('film')}Load example film</button>
            <div class="library-divider"></div><button class="btn btn-outline" data-action="import-project">${icon('upload')}Import project</button>
            <button class="btn btn-outline" data-action="export-project">${icon('download')}Export backup</button>
            <div class="library-storage">${icon('check')}<span>Stored on this browser<small>Export a backup to take it with you.</small></span></div></div></details></aside>
            <section class="studio-main"><div class="studio-topline"><div><div class="eyebrow" id="studioBreadcrumb">Project / Development</div><h2 id="studioTitle"></h2></div><div class="studio-actions">
            ${button('Undo', 'undo')}${button('Redo', 'redo')}<details class="project-menu"><summary aria-label="Project actions">•••</summary><div>${button('Duplicate', 'duplicate-project')}${button('Delete project', 'delete-project')}</div></details></div></div>
            <div class="studio-summary" id="studioSummary"></div><div class="studio-tabs" role="tablist" aria-label="Studio sections">
            ${[['easy','Easy studio','spark'],['story','Story & direction','book'],['music','Music video','play'],['characters','Characters','users'],['photoshoot','Character photoshoot','image'],['timeline','Clip timeline','film'],['join','Video joiner','film'],['assets','Reference media','image'],['images','Image studio','image'],['gallery','Image gallery','image'],['ai','AI connections','spark'],['render','ComfyUI','settings'],['guide','Production guide','book']].map(([id,name,glyph]) => `<button class="studio-tab" role="tab" id="tab-${id}" aria-controls="studioContent" data-tab-id="${id}">${icon(glyph)}${name}</button>`).join('')}</div>
            <div id="studioContent" role="tabpanel"></div><div id="studioStatus" class="studio-status" role="status" aria-live="polite"></div>
            <p id="studioSaveState" class="studio-muted">Saved on this browser</p></section></div>
            <input id="studioImport" type="file" accept="application/json,.json" hidden>
            <input id="studioMedia" type="file" accept="image/*,video/*,audio/*" multiple hidden>
            <input id="studioWorkflow" type="file" accept="application/json,.json" hidden>`;
        $('studioRoot').addEventListener('click', e => {
            const t = e.target.closest('[data-action], [data-tab-id], [data-project], [data-clip]');
            if (!t) return;
            if (t.dataset.tabId) { tab = t.dataset.tabId; render(); }
            else if (t.dataset.project) { if(VideoJoiner.isRunning()||Sequence.isRunning()||Easy.isRunning()||Photoshoot.isRunning()||Characters.isRunning()||Music.isRunning()||Images.isRunning()){status('Stop production before switching projects.','error');return;} data.selected = t.dataset.project; selectedClip = ''; if(matchMedia('(max-width: 960px)').matches)$('studioLibrary').open=false; save(); render(); }
            else if (t.dataset.clip) { selectedClip = t.dataset.clip; render(); }
            else act(t.dataset.action, t).catch(error => status(error.message, 'error'));
        });
        $('studioContent').addEventListener('change',e=>{if(e.target.matches('[data-character-upload]'))Characters.upload(Array.from(e.target.files),current(),Number(e.target.dataset.characterUpload)).catch(error=>status(error.message,'error'));});
        $('studioContent').addEventListener('input', onEdit);
        $('studioContent').addEventListener('change', onEdit);
        $('studioContent').addEventListener('change', e=>{if(e.target.matches('[data-image-upload]'))Images.uploadImage(e.target.files[0],current()).catch(error=>status(error.message,'error'));if(e.target.matches('[data-image-workflow]'))Images.importWorkflow(e.target.files[0],current()).catch(error=>status(error.message,'error'));});
        $('studioContent').addEventListener('change',e=>{if(e.target.matches('[data-easy-song]'))Easy.upload(e.target.files[0],current()).catch(error=>status(error.message,'error'));});
        $('studioContent').addEventListener('change', e=>{if(e.target.matches('[data-music-song]'))Music.song(e.target.files[0],current()).catch(error=>status(error.message,'error'));});
        $('studioImport').addEventListener('change', e => importProject(e.target.files[0]).catch(error => status(error.message, 'error')));
        $('studioWorkflow').addEventListener('change', async e => {
            try {
                const file = e.target.files[0]; if (!file) return;
                if (file.size > 5 * 1024 * 1024) throw new Error('Workflow file is too large.');
                data.connection.graph = C.workflow(JSON.parse(await file.text())); data.connection.mappings = {};
                save(); render(); status('Workflow imported. Map its inputs before queueing a clip.', 'success');
            } catch (error) { status(error.message, 'error'); }
            e.target.value = '';
        });
        $('studioMedia').addEventListener('change', async e => {
            const p = current();
            try { for (const file of e.target.files) await addAsset(file, 'Reference', p); render(); status('Media saved locally.', 'success'); }
            catch (error) { status(error.message, 'error'); } e.target.value = '';
        });
    }
    function updateProjectSummary(p) {
        const total = C.timeline(p.clips).at(-1)?.end || 0;
        if(tab==='easy'){const e=EasyStudioCore.settings(p.easyStudio||{story:p.story,style:p.style,aspect:p.aspect,nsfw:p.nsfw});const seconds=e.useSong&&p.musicVideo?.songDuration?p.musicVideo.songDuration:e.duration;$('studioSummary').innerHTML=`<span>${icon('spark')}AI video draft</span><span>${icon('clock')}${seconds.toFixed(2)} seconds</span><span>${esc(e.aspect)}</span><span class="content-badge">${e.nsfw?'Adult NSFW enabled':'General audience'}</span>`;return;}
        if(tab==='gallery'){$('studioSummary').innerHTML=`<span>${icon('image')}All projects</span><span>${ImageLibrary.records(data.projects).length} images</span><span>Prompts & reusable recipes</span>`;return;}
        if(tab==='images'){const im=ImageCore.settings(p.imageStudio);$('studioSummary').innerHTML=`<span>${icon('image')}Krea 2 image workspace</span><span>${im.mode==='upscale'?im.scale+'× upscale':im.width+' × '+im.height}</span><span>${im.jobs.length} image takes</span><span class="content-badge">${p.nsfw?'NSFW allowed':'General audience'}</span>`;return;}
        $('studioSummary').innerHTML = `<span>${icon('film')}${p.clips.length} clips</span><span>${icon('clock')}${total}s / ${p.duration}s</span><span>${p.model==='minimax-h3'?'MiniMax H3':p.model==='ltx-25'?'LTX 2.5':'KREA 2'}</span><span>${p.aspect} · ${p.fps} fps</span><span class="content-badge">${p.nsfw ? 'NSFW allowed' : 'General audience'}</span>`;
    }
    function render() {
        for (const url of urls) URL.revokeObjectURL(url); urls = [];
        const p = current();
        document.querySelector('.studio-main').dataset.view = tab;
        $('studioBreadcrumb').textContent = 'Project / '+({easy:'Easy studio',story:'Development',music:'Music video',characters:'Character bible',photoshoot:'Character photoshoot',timeline:'Sequence',join:'Video joiner',assets:'Media library',render:'Render setup',guide:'Production',ai:'AI connections',images:'Image studio',gallery:'Image gallery'})[tab];
        $('studioLibraryName').textContent = p.title;
        $('studioProjectCount').textContent = data.projects.length;
        $('studioTitle').textContent = p.title;
        updateProjectSummary(p);
        $('studioProjects').innerHTML = data.projects.map(item => `<button class="project-item ${item.id === p.id ? 'active' : ''}" data-project="${esc(item.id)}">${icon('film')}<span class="project-title">${esc(item.title)}</span><small>${item.imageStudio&&!item.clips.length?item.imageStudio.jobs.length+' image takes':item.clips.length+' clips'} · ${item.imageStudio&&!item.clips.length?'Krea 2':item.model === 'minimax-h3' ? 'MiniMax H3' : esc(item.model)}</small></button>`).join('');
        document.querySelectorAll('.studio-tab').forEach(el => { el.classList.toggle('active', el.dataset.tabId === tab); el.setAttribute('aria-selected', el.dataset.tabId === tab); el.tabIndex = el.dataset.tabId === tab ? 0 : -1; });
        $('studioContent').setAttribute('aria-labelledby', `tab-${tab}`);
        $('studioContent').innerHTML = ({ easy: Easy.panel, story: storyPanel, music: Music.panel, images: Images.panel, gallery: Gallery.panel, characters: Characters.panel, photoshoot: Photoshoot.panel, timeline: timelinePanel, join: VideoJoiner.panel, assets: assetsPanel, ai: aiPanel, render: renderPanel, guide: guidePanel })[tab](p);
        if(tab==='easy'){Easy.afterRender();Sequence.afterRender(p).catch(error=>status(error.message,'error'));}
        if(tab==='join')VideoJoiner.afterRender(p).catch(error=>status(error.message,'error'));
        if(tab==='photoshoot')Photoshoot.afterRender(p).catch(error=>status(error.message,'error'));
        if (tab === 'characters') Characters.afterRender().catch(error=>status(error.message,'error'));
        if (tab === 'gallery') Gallery.afterRender().catch(error=>status(error.message,'error'));
        if (tab === 'images') Images.afterRender(p).catch(error=>status(error.message,'error'));
        if (tab === 'music') Music.afterRender(p).catch(error=>status(error.message,'error'));
        if (tab === 'assets') showMedia(p).catch(error => status(error.message, 'error'));
        if (tab === 'timeline') {
            showMedia(p).catch(error=>status(error.message,'error'));
            showOutputs(p, currentClip()).catch(error => status(error.message, 'error'));
            const opening = $('studioContent').querySelector('[data-field="clip.start"]');
            if (opening && p.clips.indexOf(currentClip()) > 0&&currentClip().transition!=='cut') opening.readOnly = true;
        }
        $('studioContent').querySelectorAll('[data-ai-action]').forEach(el => { el.disabled = busy; });
    }
    function storyPanel(p) {
        return `<div class="section-intro"><div><h3>Every film starts with a story.</h3><p>Define the moments. Set the look. Build a sequence that flows.</p></div><span class="section-step">01 / Develop</span></div>
            <div class="story-layout"><div class="studio-card story-brief"><div class="panel-heading"><span>${icon('book')}Story brief</span><small>THE THROUGHLINE</small></div>
            ${field('Film title', 'title', p.title)}${area('Story beats', 'story', p.story, 'tall')}
            <p class="field-hint">One action or scene per line. Keep each beat focused on a single moment.</p>
            <div class="story-note">${icon('film')}<div><strong>Think in connected shots.</strong><span>The last pose of one clip becomes the opening of the next.</span></div></div></div>
            <div class="studio-card film-settings"><div class="panel-heading"><span>${icon('settings')}Film settings</span></div>
            ${select('Generation model', 'model', p.model, [['minimax-h3','MiniMax H3'],['ltx-25','LTX 2.5'],['krea-2','KREA 2 (image prompts)']])}
            <div class="studio-grid">${field('Target length · sec', 'duration', p.duration, 'number', 'min="4" max="600" step="1"')}${field('Clip limit · sec', 'clipLength', p.clipLength, 'number', 'min="4" max="15" step="1"')}
            ${select('Aspect ratio', 'aspect', p.aspect, ['16:9','9:16','1:1','4:3','21:9'].map(s=>[s,s]))}${field('Frame rate · fps', 'fps', p.fps, 'number', 'min="1" max="120" step="1"')}</div>
            ${select('Continuation method', 'connection', p.connection, [['last-frame','Last frame → starting image'],['video-reference','Previous video → reference']])}
            <div class="content-preference"><label class="toggle-label"><input type="checkbox" data-field="nsfw" ${p.nsfw ? 'checked' : ''}><span>Allow NSFW content</span></label><p>For compatible local models. Your backend’s content rules still apply.</p></div></div></div>
            ${Cast.panel(p)}
            <div class="studio-card direction-card"><div class="panel-heading"><span>${icon('image')}Visual direction</span><small>THE WORLD OF YOUR FILM</small></div>
            <div class="studio-grid">${area('Look, palette & lighting', 'style', p.style)}${area('Location & scene details', 'setting', p.setting)}${area('Camera movement & lens', 'camera', p.camera)}</div>
            <details class="direction-audio"><summary>${icon('settings')}Sound & music<span>Optional audio direction</span>${icon('chevron')}</summary><div class="studio-grid">${area('Ambience & physical sounds', 'sound', p.sound)}${area('Music (N/A for none)', 'music', p.music)}</div></details></div>
            <div class="studio-action-bar"><div class="action-bar-note">${icon('check')}Changes save automatically</div><div class="studio-actions">${button('Use generator inputs', 'use-inputs')}${button('AI plan shots', 'ai-plan', 'data-ai-action')}<button class="btn btn-primary" data-action="plan">Build timeline${icon('arrow')}</button></div></div>
            <p class="field-hint"><strong>AI plan shots</strong> asks your text model to draft shot actions, opening/ending states, camera notes and dialogue, then builds clip prompts. You review the timeline before rendering. <strong>Build timeline</strong> divides your existing story beats into clips without calling AI. Neither button generates images or video.</p><p class="studio-footnote">H3 clips are 4–15 seconds. Longer films use linked clips and actual frame or video references.</p>`;
    }
    function timelinePanel(p) {
        const c = currentClip(), times = C.timeline(p.clips);
        if (!c) return `<div class="studio-empty"><span class="empty-icon">${icon('film')}</span><h3>Your sequence is waiting.</h3><p>Build a timeline from your story, or start with a single clip.</p><div class="studio-actions">${button('Add first clip', 'add-clip')}${button('Load example film', 'demo')}</div></div>`;
        const i = p.clips.indexOf(c), prev = p.clips[i - 1];
        return `<div class="studio-toolbar"><div><h3>Sequence</h3><p class="studio-muted">${p.clips.length} connected clips · ${times.at(-1).end} seconds</p></div><div class="studio-actions">${button('Add clip', 'add-clip')}${button('Rebuild prompts', 'all-prompts')}${button('Export', 'export-pack')}</div></div>
            <div class="sequence-strip"><div class="sequence-strip-heading"><span>${icon('film')}CLIP SEQUENCE</span><small>Select a clip to edit</small></div><div class="clip-list">${p.clips.map((item,j)=>`<button class="clip-item ${item.id === c.id ? 'active' : ''}" data-clip="${esc(item.id)}" aria-pressed="${item.id === c.id}"><div class="clip-item-top"><span class="clip-number">${String(j+1).padStart(2,'0')}</span>${badge(item.status,item.status)}</div><strong class="clip-title">${esc(item.title)}</strong><span class="clip-beat">${esc(item.beat.slice(0,100))}</span><div class="clip-item-footer"><small>${times[j].start.toFixed(2)}–${times[j].end.toFixed(2)}s</small><span>${item.duration.toFixed(2)}s</span></div></button>`).join('')}</div></div>
            <div class="timeline-workspace"><div class="timeline-stage"><div class="studio-card viewer-card"><div class="panel-heading"><span>${icon('play')}Clip preview</span><span class="viewer-spec">${p.aspect} · ${p.fps} FPS</span></div>
            <div class="clip-preview" id="studioPreview"></div><div class="viewer-footer"><span class="viewer-time">${times[i].start.toFixed(2)}s — ${times[i].end.toFixed(2)}s</span>${badge(c.outputs.length?'Rendered take':c.startAsset?'Reference attached':'No render yet',c.outputs.length?'complete':'draft')}</div>
            <div class="viewer-actions">${button('Capture frame', 'capture-frame')}${button('Open local video', 'preview-video')}</div>
            ${c.takes.length?`<div class="take-list"><span>TAKES</span>${c.takes.map((t,j)=>button('Take '+(j+1), 'preview-take', `data-id="${esc(t.id)}"`)).join('')}</div>`:''}
            <p class="field-hint">Pause near the end to capture a clean starting frame for your next clip.</p></div>
            <div class="studio-card prompt-editor"><div class="panel-heading"><span>${icon('spark')}Generation prompt</span>${button('Copy', 'copy-clip')}</div>${area('Prompt for this clip', 'clip.prompt', c.prompt, 'studio-prompt')}<div class="studio-actions">${button('Rebuild', 'clip-prompt')}${button('AI refine', 'ai-clip', 'data-ai-action')}${button('Render clip', 'queue-clip')}${c.job ? button('Check status', 'check-job') : ''}${activeRun ? button('Stop watching', 'stop-watch') : ''}</div><p class="field-hint">Rebuild applies current direction and continuity, replacing manual prompt edits. H3 AI refine uses the <a href="prompts/h3-full-reference-system.txt" target="_blank" rel="noopener">six-section rewrite guide</a> with this clip’s attached references.</p></div></div>
            <aside class="studio-card clip-inspector"><div class="panel-heading"><span>${icon('settings')}Clip inspector</span><span class="clip-index">${String(i+1).padStart(2,'0')} / ${String(p.clips.length).padStart(2,'0')}</span></div>
            ${field('Clip name', 'clip.title', c.title)}<div class="studio-grid">${field('Duration · sec', 'clip.duration', c.duration, 'number','min="4" max="15" step="0.01"')}${field('Seed', 'clip.seed', c.seed, 'number','min="0" max="9007199254740991" step="1"')}</div>
            ${i===0&&p.model==='minimax-h3'?select('Opening generation','clip.generationMode',c.generationMode||'',[['','Follow workflow / attached references'],['text','Text to video · no opening image'],['image','Image to video · starting image required']]):''}
            ${area('Action / story beat', 'clip.beat', c.beat)}${c.sceneId?area('Scene location & lighting','clip.sceneLocation',c.sceneLocation):''}
            ${ClipQuality.panel(p,c)}<details class="inspector-section" open><summary>${icon('arrow')}Continuity${icon('chevron')}</summary><div>${area(prev&&c.transition!=='cut' ? 'Opening · from previous clip' : 'Opening state', 'clip.start', C.continuity(p,i))}${area('Planned ending', 'clip.end', c.end)}${area('Actual rendered ending', 'clip.actualEnd', c.actualEnd)}${button('Carry ending forward', 'carry-end')}</div></details>
            <details class="inspector-section" open><summary>${icon('image')}Starting reference${icon('chevron')}</summary><div>${select('Frame / video reference', 'clip.startAsset', c.startAsset, [['','Choose a reference'],...p.assets.filter(a => (i > 0 && p.connection === 'video-reference') ? /^video\//.test(a.type) : /^image\//.test(a.type)).map(a=>[a.id,a.name])])}<p class="field-hint">Attach the actual previous ending frame or video for continuity.</p></div></details>
            <details class="inspector-section" open><summary>${icon('image')}Scene start & end images${icon('chevron')}</summary><div><p class="field-hint">Prepare a Krea image, review its prompt in Image studio, then generate. The result attaches to this scene and enters the gallery. End images guide the destination pose; they are optional.</p>${button('Prepare start image','scene-start')}${button('Prepare end image','scene-end')}${c.startAsset?`<div class="scene-keyframe-preview"><small>Start</small><div data-media-id="${esc(c.startAsset)}"></div></div>`:''}${c.endAsset&&c.endAsset!==c.startAsset?`<div class="scene-keyframe-preview"><small>End</small><div data-media-id="${esc(c.endAsset)}"></div></div>`:''}${select('End image · optional','clip.endAsset',c.endAsset||'',[['','No end anchor'],...p.assets.filter(a=>a.type.startsWith('image/')).map(a=>[a.id,a.name])])}<p class="field-hint">Use the H3 start / end preset in ComfyUI to animate between both images.</p></div></details>
            <details class="inspector-section"><summary>${icon('film')}Camera & dialogue${icon('chevron')}</summary><div>${area('Camera override', 'clip.camera', c.camera)}${area('Dialogue · speaker, language & delivery', 'clip.dialogue', c.dialogue)}</div></details>
            <details class="inspector-section"><summary>${icon('book')}Production notes${icon('chevron')}</summary><div>${area('Notes for this clip', 'clip.notes', c.notes)}</div></details>
            <div class="clip-management">${button('Move left', 'move-left')}${button('Move right', 'move-right')}${button('Duplicate', 'duplicate-clip')}${button('Delete', 'delete-clip')}</div></aside></div>`;
    }
    function assetsPanel(p) {
        return `<div class="studio-section-head"><div><h3>Reference media</h3><p class="studio-muted">Images, videos and audio stay on this browser until you export or upload them.</p></div>${button('+ Import media', 'import-media')}</div>
            <div class="asset-list">${p.assets.map(a=>`<div class="studio-card"><div data-media-id="${esc(a.id)}"></div><strong>${esc(a.name)}</strong><p class="studio-muted">${esc(a.role)}</p><div class="studio-actions">${button('Download', 'download-asset', `data-id="${esc(a.id)}"`)}${button('Remove', 'delete-asset', `data-id="${esc(a.id)}"`)}</div></div>`).join('') || '<div class="studio-empty">Import your character reference, starting image, rendered clip or audio reference.</div>'}</div>`;
    }
    function renderPanel(p) {
        const cfg = data.connection;
        const mapping = (name, kind, type) => `<label class="studio-field">${name}<select class="form-select" data-mapping="${kind}"><option value="">Not mapped</option>${C.fields(cfg.graph,type).map(f=>`<option value="${esc(f.value)}" ${cfg.mappings[kind] === f.value ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select></label>`;
        return `<div class="studio-card"><h3>Connect to your ComfyUI server</h3>${field('Server address', 'comfy.endpoint', comfyDraft??cfg.endpoint,'url',comfySaving?'disabled':'placeholder="http://127.0.0.1:8188"')}<p class="field-hint">${proxyConfig?'Save the current IP address or hostname and port here. This connection is shared by browsers using this studio and survives container restarts.':'Save the address for this browser. Your ComfyUI server must allow this page’s origin.'}</p><div class="studio-actions">${button(comfySaving?'Saving…':'Save address','save-comfy',comfySaving?'disabled':'')}${button('Test connection', 'test-comfy',comfySaving?'disabled':'')}${button('Load H3 start / end preset','preset-h3')}${button('Import API workflow', 'import-workflow')}${button('Download mapped clip workflow', 'download-workflow')}</div>
            <p><a href="workflows/h3-scene-first-last-api.json" download>Download built-in H3 API workflow</a> · <a href="workflows/krea2-scene-image-api.json" download>Download built-in Krea API workflow</a></p><p class="studio-muted" style="margin-top:12px">Export a working workflow from ComfyUI with File → Export (API). Models and custom nodes must already be installed there. This app uses the local /prompt, /history, /view and /upload endpoints.</p></div>
            <div class="studio-card"><h3>Workflow input mapping</h3><p class="studio-muted">${cfg.graph ? `${Object.keys(cfg.graph).length} nodes imported. Only literal string and number inputs can be mapped; existing node links are preserved.` : 'Import an API workflow to select its inputs.'}</p>
            <div class="studio-grid" style="margin-top:14px">${mapping('Positive prompt (required)','positive','string')}${mapping('Negative prompt (optional)','negative','string')}${mapping('Seed (optional)','seed','number')}${mapping('Duration / frame count (optional)','duration','number')}${mapping('Starting image filename (I2V)','image','string')}${mapping('Ending image filename (FL2V)','endImage','string')}${mapping('Previous video filename (continuation)','video','string')}${mapping('Song excerpt filename (H3 audio conditioning)','audio','string')}${mapping('Width (music video, optional)','width','number')}${mapping('Height (music video, optional)','height','number')}</div>
            ${select('Duration input units', 'comfy.durationUnit', cfg.durationUnit, [['seconds','Seconds'],['frames','Frames (round duration × fps)'],['frames-plus-one','Frames + 1 (round duration × fps + 1)']])}
            <p class="studio-muted">Check your node’s required frame-count pattern and resolution settings. Aspect ratio and frame rate in the film brief describe your delivery target; they do not change workflow nodes automatically.</p></div>
            <div class="studio-callout">Queue one clip at a time. For the next clip, capture and attach the previous ending frame, or attach its video to a supported continuation workflow. Watching can be stopped without interrupting another ComfyUI user’s jobs.</div>
            <div class="studio-card"><h3>Local AI director</h3><p class="studio-muted">Uses your selected connection from AI connections. AI can plan a story or refine the selected clip. ComfyUI itself is a workflow renderer, not a chat-completions service.</p>${button('Open AI settings', 'open-settings')}</div>`;
    }
    function guidePanel() {
        return `<div class="studio-card studio-help"><h3>From idea to a longer film</h3><ol><li>Write one story beat per line, set the total duration, and add your characters.</li><li>Build a timeline. Review the action and ending state for every clip.</li><li>Render the first clip with your working ComfyUI workflow.</li><li>Pause near its end and capture a clean frame. Record its real pose, camera and props in “Actual rendered ending”.</li><li>Use that image as the next clip’s starting reference. Rebuild the next prompt and render it.</li><li>Check each join for motion direction, pose and exposure. A shared frame helps visual continuity but cannot guarantee velocity or audio continuity.</li><li>Download your videos as clip-01.mp4, clip-02.mp4 and so on. Export the production pack for the edit list and FFmpeg assembly script.</li></ol>
            <h3 style="margin-top:20px">Audio & finishing</h3><p>Keep one continuous music bed in your editor. Match ambience across joins and crossfade audio where needed. The assembly script normalizes video dimensions and frame rate and joins video only; add your finished soundtrack afterward. Remove a duplicated anchor frame at a join when necessary. Cross-dissolves may hide a lighting jump but can ghost moving subjects.</p>
            <h3 style="margin-top:20px">Testing a local installation</h3><p>Serve this folder with <code>python3 -m http.server 8099</code>. Start ComfyUI with an origin allowed for this studio, for example <code>python main.py --enable-cors-header http://localhost:8099</code>. Open the studio at that same address. Use your installed H3 workflow and map its real inputs in the ComfyUI tab.</p>
            <p><a href="https://huggingface.co/MiniMaxAI/MiniMax-H3/tree/main/docs" target="_blank" rel="noopener">MiniMax H3 prompt guides</a> · <a href="https://docs.comfy.org" target="_blank" rel="noopener">ComfyUI documentation</a></p>
            <h3 style="margin-top:20px">Backups & portability</h3><p>Project backups include prompts, character profiles and local reference media. Connection credentials are excluded. Server render outputs remain on the ComfyUI server until downloaded or imported as local media.</p></div>`;
    }
    function onEdit(e) {
        const el = e.target, key = el.dataset.field;
        if(VideoJoiner.isRunning()&&(key||el.dataset.mapping)){status('Wait for video joining before editing.','error');render();return;}
        try{if(VideoJoiner.edit(e,current()))return;}catch(error){status(error.message,'error');return;}
        if(Sequence.isRunning()&&(key||el.dataset.mapping)){status('Stop the film loop before editing.','error');render();return;}
        try{if(Sequence.edit(e,current()))return;}catch(error){status(error.message,'error');render();return;}
        if(Easy.isRunning()&&(key||el.dataset.mapping)){status('Wait for the video draft before editing.','error');render();return;}
        try{if(Easy.edit(e,current()))return;}catch(error){status(error.message,'error');return;}
        if(Photoshoot.isRunning()&&(key||el.dataset.mapping)){status('Pause the photoshoot before editing.','error');render();return;}
        try{if(Photoshoot.edit(e,current()))return;}catch(error){status(error.message,'error');return;}
        if(Characters.isRunning()&&(key||el.dataset.mapping)){status('Stop character production before editing.','error');render();return;}
        try { if(Cast.edit(e,current()))return;if(Characters.edit(e,current()))return;if(Gallery.edit(e))return;if(Images.edit(e,current()))return; } catch(error){status(error.message,'error');return;}
        if(Images.isRunning() && (key||el.dataset.mapping)){status('Stop watching the image job before editing the project.','error');render();return;}
        if(key?.startsWith('ai.')){editAI(el);return;}
        if(Music.isRunning() && (key||el.dataset.mapping)){status('Stop music production before editing the project or workflow.','error');render();return;}
        try { if(Music.edit(e,current())) return; } catch(error){status(error.message,'error');return;}
        try { if(ClipQuality.edit(e,current(),currentClip()))return; } catch(error){status(error.message,'error');render();return;}
        if (el.dataset.mapping) { data.connection.mappings[el.dataset.mapping] = el.value; save(); return; }
        if (!key) return;
        if(key==='comfy.endpoint'){if(!comfySaving)comfyDraft=el.value;return;}
        const p = current();
        let value = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'number') {
            if (!el.validity.valid || value === '') return;
            value = Number(value);
        }
        if (key.startsWith('clip.')) {
            const c = currentClip(); if (!c) return;
            if (key === 'clip.start' && p.clips.indexOf(c) > 0&&c.transition!=='cut') return;
            if(p.easyStudio?.draftReady&&key==='clip.sceneLocation'&&c.sceneLocation!==value)c.musicPromptDirty=true;
            if(p.musicVideo?.planStamp && ['beat','camera','startAsset','endAsset','sceneLocation','musicPerformance','start','end','duration'].includes(key.slice(5)) && c[key.slice(5)]!==value)c.musicPromptDirty=true;
            c[key.slice(5)] = value;
            if(key==='clip.generationMode'){if(p.easyStudio)p.easyStudio.openingMode=value==='text'?'text':'image';c.prompt=C.prompt(p,p.clips.indexOf(c));c.musicPromptDirty=false;if(p.musicVideo?.planStamp)c.musicInputStamp=MusicCore.hash(MusicCore.prompt(p,p.clips.indexOf(c)));}
            if(key==='clip.prompt'){c.musicPromptDirty=false;if(p.musicVideo?.planStamp)c.musicInputStamp=MusicCore.hash(MusicCore.prompt(p,p.clips.indexOf(c)));}
        } else if (key.startsWith('character.')) p.characters[Number(el.closest('[data-character]').dataset.character)][key.slice(10)] = value;
        else if (key.startsWith('comfy.')) data.connection[key.slice(6)] = value;
        else p[key] = value;
        save();
        if(key==='character.canonical'||key==='clip.startAsset'||key==='clip.endAsset'||key==='clip.generationMode')render();
        updateProjectSummary(p);
        if (key.startsWith('clip.')) {
            const c = currentClip(), times = C.timeline(p.clips);
            document.querySelectorAll('.clip-item').forEach((el,i)=>{
                const item=p.clips[i];if(!item)return;
                el.querySelector('.clip-title').textContent=item.title;
                el.querySelector('.clip-beat').textContent=item.beat.slice(0,100);
                el.querySelector('.clip-item-footer small').textContent=`${times[i].start.toFixed(2)}–${times[i].end.toFixed(2)}s`;
                el.querySelector('.clip-item-footer span').textContent=`${item.duration.toFixed(2)}s`;
            });
            const range=times[p.clips.indexOf(c)], time=document.querySelector('.viewer-time');
            if(range&&time)time.textContent=`${range.start.toFixed(2)}s — ${range.end.toFixed(2)}s`;
        }
        if (key === 'title') { $('studioTitle').textContent = p.title; const item = document.querySelector('.project-item.active'); if(item) item.querySelector('.project-title').textContent = p.title; $('studioLibraryName').textContent = p.title; }
    }
    async function act(action, el) {
        const p = current(), c = currentClip(), i = c ? p.clips.indexOf(c) : -1;
        if(await VideoJoiner.action(action,el,p))return;
        if(VideoJoiner.isRunning()&&!['export-project','export-pack'].includes(action))throw Error('Wait for video joining before changing the project.');
        if(await Sequence.action(action,el,p))return;
        if(Sequence.isRunning()&&!['export-project','export-pack','copy-clip'].includes(action))throw Error('Stop the film loop before changing production.');
        if(await Easy.action(action,el,p))return;
        if(Easy.isRunning()&&!['export-project','export-pack'].includes(action))throw Error('Wait for the video draft before changing the project.');
        if(await Photoshoot.action(action,el,p))return;
        if(Photoshoot.isRunning()&&!['export-project','export-pack'].includes(action))throw Error('Pause the photoshoot before changing the project.');
        if(['ai-new','ai-save','ai-models','ai-test'].includes(action)){await aiConnectionAction(action);return;}
        if(await Cast.action(action,p))return;
        if(action==='portrait-prepare'){if(busy||Characters.isRunning()||Images.isRunning()||Music.isRunning()||activeRun||submitting)throw Error('Wait for the current operation before preparing a character portrait.');await Images.prepareCharacter(p,p.characters[Number(el.dataset.index)]);tab='images';render();return;}
        if(await Characters.action(action,el,p))return;
        if(Characters.isRunning()&&!['export-project','export-pack'].includes(action))throw Error('Stop character production before changing the project.');
        if(await Gallery.action(action,el,p))return;
        if(action==='scene-start'||action==='scene-end'){if(activeRun||submitting||Images.isRunning()||Music.isRunning())throw Error('Stop current production before preparing scene images.');await Images.prepareScene(p,c,action==='scene-end'?'end':'start');tab='images';render();return;}
        if(action==='preset-h3'){if(activeRun||submitting||Images.isRunning()||Music.isRunning())throw Error('Stop production before changing workflows.');const preset=WorkflowPresets.h3(await comfyRequest('/object_info'));if(data.connection.graph&&!confirm('Replace the active clip workflow with the built-in H3 first/last-frame preset?'))return;Object.assign(data.connection,preset);save();render();status('H3 four-step preset loaded. Generate/select scene images in Clip timeline. Start at 768 × 448; review a short test before increasing resolution.','success');return;}
        if(await Images.action(action,el,p))return;
        if(Images.isRunning() && !['export-project','export-pack'].includes(action))throw new Error('Stop watching the image job before changing the project.');
        if(await Music.action(action,el,p))return;
        if(Music.isRunning() && !['check-job','stop-watch','export-project','export-pack','copy-clip','copy-clip-seed'].includes(action))throw new Error('Stop music production before changing the project.');
        if(await ClipQuality.action(action,el,p,c))return;
        if (action === 'undo' || action === 'redo') {
            if (activeRun || submitting) throw new Error('Stop watching the active render before undoing project edits.');
            const source = action === 'undo' ? undo : redo, target = action === 'undo' ? redo : undo;
            const stack = source.get(p.id) || [], snapshot = stack.pop();
            if (!snapshot) { status('No '+action+' history in this session.'); return; }
            const other = target.get(p.id) || []; other.push(structuredClone(p)); target.set(p.id,other);
            data.projects[data.projects.indexOf(p)] = C.normalizeProject(snapshot); save(true); render(); status('Project '+(action === 'undo' ? 'restored to the previous edit.' : 'edit reapplied.'));
        } else if (action === 'save-profile') {
            const character = p.characters[Number(el.dataset.index)];
            const existing = data.profiles.findIndex(c=>c.id===character.id);
            if (existing >= 0) data.profiles[existing] = structuredClone(character); else data.profiles.push(structuredClone(character));
            save();render();status('Character saved to the reusable library.', 'success');
        } else if (action === 'use-profile') {
            const profile = data.profiles.find(c=>c.id===el.dataset.id); if(!profile)return;
            const copy=CharacterCore.normalize(profile), ids=new Set([copy.canonical,...copy.references.map(r=>r.assetId)].filter(Boolean)), map=new Map();for(const id of ids){const blob=await assetStore('get',id);if(!blob)continue;const original=data.projects.flatMap(p=>p.assets).find(a=>a.id===id);const a=await addAsset(new File([blob],original?.name||'character-reference.png',{type:blob.type||'image/png'}),'Character: '+copy.name,p);map.set(id,a.id);}CharacterCore.remap(copy,map);copy.id=C.uid();p.characters.push(copy);save();render();status('Character and available local references added to this film.','success');
        } else if (action === 'preview-take') {
            const take = c.takes.find(t=>t.id===el.dataset.id); if(!take)return;
            $('studioPreview').replaceChildren(); await showOutputs(p,{...c,outputs:take.outputs,job:take.job});
            status('Viewing take '+(c.takes.indexOf(take)+1)+'. Seed: '+take.seed);
        } else if (action === 'new-project' || action === 'demo') {
            const next = C.project();
            if (action === 'demo') {
                Object.assign(next, { title: 'The last train', duration: 30, setting: 'A rain-soaked station platform at blue hour, warm lamps, a stationary silver train.', story: 'Mara walks along the platform toward the train door.\nMara stops beside the door and reaches toward its handle.\nMara opens the door and steps into the warm carriage.' });
                next.characters.push({ id: C.uid(), name: 'Mara', description: 'An adult woman with short dark hair, an olive raincoat, black boots and a worn brown satchel over her left shoulder.', voice: 'Quiet alto voice, measured delivery.' });
                next.clips = C.plan(next); next.clips.forEach((c,j)=> { c.prompt = C.prompt(next,j); });
            }
            data.projects.push(next); data.selected = next.id; selectedClip = ''; tab = action==='demo'?'story':'easy'; save(); render();
        } else if (action === 'duplicate-project') {
            const copy = C.normalizeProject(p); copy.id = C.uid(); copy.title += ' (copy)';
            copy.clips.forEach(c=>{ c.id=C.uid(); c.job=null; c.outputs=[]; c.takes=[]; c.status='draft'; });
            data.projects.push(copy); data.selected=copy.id; selectedClip=''; save(); render();
        } else if (action === 'delete-project') {
            if (!confirm(`Delete "${p.title}" from this browser? Export a backup first if you need it.`)) return;
            data.projects = data.projects.filter(item=>item.id!==p.id); if(!data.projects.length) data.projects.push(C.project());
            data.selected=data.projects[0].id; selectedClip=''; save(); render();
        } else if (action === 'plan') {
            const clips = C.plan(p);
            if(p.clips.length && !confirm('Replace the current clip timeline and its prompt edits?')) return;
            p.clips=clips; p.clips.forEach((c,j)=>{ c.prompt=C.prompt(p,j); }); selectedClip=p.clips[0].id; tab='timeline'; save(); render();
            status('Timeline created. Review each ending and attach actual references as you render.', 'success');
        } else if (action === 'add-character') {
            p.characters.push({id:C.uid(),name:`Character ${p.characters.length+1}`,description:'',voice:''}); save(); render();
        } else if (action === 'remove-character') {
            p.characters.splice(Number(el.dataset.index),1); save(); render();
        } else if (action === 'export-characters') download('character-profiles.json',JSON.stringify(p.characters,null,2),'application/json');
        else if (action === 'add-clip' || action === 'duplicate-clip') {
            const next = action === 'duplicate-clip' && c ? {...structuredClone(c),id:C.uid(),title:c.title+' (copy)',job:null,outputs:[],takes:[],status:'draft'} : C.clip();
            p.clips.splice(i+1,0,next); selectedClip=next.id; next.prompt=C.prompt(p,i+1); save(); render();
        } else if (action === 'delete-clip') {
            if(!c || !confirm('Delete this clip and its prompt edits?')) return;
            p.clips.splice(i,1); selectedClip=p.clips[Math.max(0,i-1)]?.id || ''; save(); render();
        } else if (action === 'move-left' || action === 'move-right') {
            const j=i+(action==='move-left'?-1:1); if(j<0 || j>=p.clips.length) return;
            [p.clips[i],p.clips[j]]=[p.clips[j],p.clips[i]]; save(); render(); status('Clip moved. Rebuild affected prompts to reflect the new continuity.');
        } else if (action === 'clip-prompt' || action === 'all-prompts') {
            if(action==='all-prompts' && !confirm('Rebuild every prompt? This replaces manual prompt edits.')) return;
            if(action==='clip-prompt') { if(!c) return; c.prompt=C.prompt(p,i);c.musicPromptDirty=false;if(p.musicVideo?.planStamp)c.musicInputStamp=MusicCore.hash(c.prompt); }
            else p.clips.forEach((c,j)=>{c.prompt=C.prompt(p,j);c.musicPromptDirty=false;if(p.musicVideo?.planStamp)c.musicInputStamp=MusicCore.hash(c.prompt);}); save(); render(); status('Prompts rebuilt from current direction and continuity.', 'success');
        } else if (action === 'carry-end') {
            if(!p.clips[i+1]) throw new Error('Add another clip first.');
            p.clips[i+1].start=c.actualEnd||c.end; selectedClip=p.clips[i+1].id; save(); render(); status('Ending carried forward. Rebuild this clip’s prompt when ready.');
        } else if (action === 'copy-clip') await copyToClipboard(c?.prompt || '');
        else if (action === 'copy-clip-seed') await copyToClipboard(String(c?.seed || 0));
        else if (action === 'use-inputs') {
            p.story=state.inputs.action || p.story; p.setting=[state.inputs.setting,state.inputs.environment].filter(Boolean).join('. ');
            p.style=[state.inputs.artStyle,state.inputs.genre,state.inputs.mood,state.inputs.colorPalette].filter(Boolean).join(', ') || p.style;
            p.camera=state.inputs.cameraAngle || p.camera; p.model=state.model; p.nsfw=state.nsfwEnabled;
            if(state.inputs.characters) p.characters.push({id:C.uid(),name:'Main subject',description:state.inputs.characters,voice:''}); save(); render();
        } else if (action === 'import-project') $('studioImport').click();
        else if (action === 'export-project') await exportProject(p);
        else if (action === 'export-pack') exportPack(p);
        else if (action === 'import-media') $('studioMedia').click();
        else if (action === 'download-asset') {
            const a=p.assets.find(a=>a.id===el.dataset.id), blob=await assetStore('get',a.id); if(!blob) throw new Error('Media not found in this browser.'); downloadBlob(a.name,blob);
        } else if (action === 'delete-asset') {
            const id=el.dataset.id;
            if(!confirm('Remove this reference from the project?')) return;
            p.assets=p.assets.filter(a=>a.id!==id); p.clips.forEach(c=>{if(c.startAsset===id)c.startAsset='';if(c.endAsset===id)c.endAsset='';});
            // Retain the blob so session undo and copied projects can restore the reference.
            save(); render();
        } else if (action === 'import-workflow') $('studioWorkflow').click();
        else if (action === 'save-comfy') await saveComfyAddress();
        else if (action === 'test-comfy') {
            if(comfyDraft!==null)await saveComfyAddress();
            const result=await comfyRequest('/system_stats');
            status(`Connected. ComfyUI ${result.system?.comfyui_version || ''} · ${result.devices?.map(d=>d.name).join(', ') || 'server online'}`, 'success');
        } else if (action === 'download-workflow') {
            if(!c) throw new Error('Create a clip first.');
            const graph=await mappedWorkflow(p,c,false); download('clip-workflow-api.json',JSON.stringify(graph,null,2),'application/json');
            status('Mapped workflow exported. Attached media must be uploaded separately before using it.');
        } else if (action === 'queue-clip') await queueClip(p,c);
        else if (action === 'check-job') { if(!c?.job) throw new Error('No queued job for this clip.'); await watchJob(p,c); }
        else if (action === 'stop-watch') { activeRun=null; status('Stopped watching. The ComfyUI job may still be running; use Check render status to resume.'); render(); }
        else if (action === 'capture-frame') await captureFrame(p,c,i);
        else if (action === 'preview-video') {
            const videos=p.assets.filter(a=>a.type.startsWith('video/'));
            if(!videos.length)throw new Error('Import a rendered video in Reference media first.');
            const choice=prompt('Enter the number of the local video to preview:\n'+videos.map((a,i)=>`${i+1}. ${a.name}`).join('\n'),'1');
            if(choice===null)return;
            const a=videos[Number(choice)-1];if(!a)throw new Error('Choose a valid video number.');
            const blob=await assetStore('get',a.id);if(!blob)throw new Error('Video is missing from this browser.');
            const video=document.createElement('video');const url=URL.createObjectURL(blob);urls.push(url);video.src=url;video.controls=true;$('studioPreview').replaceChildren(video);
        } else if (action === 'open-settings') { tab='ai';render(); }
        else if (action === 'ai-plan' || action === 'ai-clip') await directAI(p,action,c);
    }
    function downloadBlob(name,blob) {
        const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    const download=(name,value,type='text/plain')=>downloadBlob(name,new Blob([value],{type}));
    async function exportProject(p) {
        status('Preparing portable backup…');
        const media=[];
        for(const a of p.assets) {
            const blob=await assetStore('get',a.id); if(!blob) continue;
            const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
            media.push({id:a.id,data:encoded});
        }
        download('film-studio-project.json',JSON.stringify({version:1,project:p,media},null,2),'application/json');
        status('Backup exported with local reference media. Download server outputs separately.', 'success');
    }
    async function importProject(file) {
        if(!file) return;
        try {
            if(file.size>350*1024*1024) throw new Error('Backup exceeds the 350 MB import limit.');
            const raw=JSON.parse(await file.text()); if(raw.version!==1) throw new Error('Unsupported project backup version.');
            const p=C.normalizeProject(raw.project); p.id=C.uid(); p.title+=' (imported)';
            const idMap=new Map();
            for(const a of p.assets) {
                const old=a.id; a.id=C.uid(); idMap.set(old,a.id);
                const m=raw.media?.find(m=>m.id===old);
                if(m && /^data:(image|video|audio)\/[a-z0-9.+-]+;base64,/i.test(m.data)) {
                    const response=await fetch(m.data), blob=await response.blob(); await assetStore('put',a.id,blob);
                }
            }
            p.characters.forEach(c=>CharacterCore.remap(c,idMap));
            p.clips.forEach(c=>{c.id=C.uid();c.startAsset=idMap.get(c.startAsset)||'';c.endAsset=idMap.get(c.endAsset)||'';});
            for(const a of p.assets){if(a.imageMetadata){a.imageMetadata.sourceId=idMap.get(a.imageMetadata.sourceId)||'';a.imageMetadata.secondId=idMap.get(a.imageMetadata.secondId)||'';}}
            if(p.photoshoot){p.photoshoot.characterId='';p.photoshoot.jobs=p.photoshoot.jobs.filter(j=>j.status==='complete');for(const j of p.photoshoot.jobs)for(const o of j.outputs)o.assetId=idMap.get(o.assetId)||'';}
            if(p.imageStudio){p.imageStudio.sceneTarget=null;p.imageStudio.characterTarget=null;for(const job of p.imageStudio.jobs||[])if(job.settings){job.settings.sceneTarget=null;job.settings.characterTarget=null;}for(const entry of p.imageStudio.library||[]){entry.metadata.sourceId=idMap.get(entry.metadata.sourceId)||'';entry.metadata.secondId=idMap.get(entry.metadata.secondId)||'';}p.imageStudio.sourceId=idMap.get(p.imageStudio.sourceId)||'';p.imageStudio.secondId=idMap.get(p.imageStudio.secondId)||'';}
            if(p.musicVideo){p.musicVideo.songId=idMap.get(p.musicVideo.songId)||'';p.musicVideo.referenceId=idMap.get(p.musicVideo.referenceId)||'';p.musicVideo.approval='';p.musicVideo.planStamp=p.musicVideo.planStamp?MusicCore.brief(p):'';p.musicVideo.finalId='';}
            data.projects.push(p);data.selected=p.id;selectedClip='';save();render();status('Project imported. Check that all required media is present.', 'success');
        } finally { $('studioImport').value=''; }
    }
    function exportPack(p) {
        if(!p.clips.length) throw new Error('Build a timeline first.');
        const times=C.timeline(p.clips);
        const pack={version:1,title:p.title,model:p.model,aspect:p.aspect,fps:p.fps,characters:p.characters,clips:p.clips.map((c,i)=>({...c,range:times[i],opening:C.continuity(p,i),file:`clip-${String(i+1).padStart(2,'0')}.mp4`}))};
        download('production-pack.json',JSON.stringify(pack,null,2),'application/json');
        const [w,h]=p.aspect==='9:16'?[1080,1920]:p.aspect==='1:1'?[1080,1080]:p.aspect==='4:3'?[1440,1080]:p.aspect==='21:9'?[2520,1080]:[1920,1080];
        const filters=p.clips.map((c,i)=>`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${p.fps},setpts=PTS-STARTPTS[v${i}]`).join(';');
        const inputs=p.clips.map((c,i)=>`-i 'clip-${String(i+1).padStart(2,'0')}.mp4'`).join(' ');
        const script=`#!/usr/bin/env bash\nset -euo pipefail\n# Run in the folder containing your downloaded clip-01.mp4, clip-02.mp4, etc.\n# Video-only assembly. Add one continuous mastered soundtrack afterward.\n# Inspect joins and trim repeated anchor frames before final delivery.\nffmpeg ${inputs} -filter_complex '${filters};${p.clips.map((c,i)=>`[v${i}]`).join('')}concat=n=${p.clips.length}:v=1:a=0[outv]' -map '[outv]' -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart 'assembled-film.mp4'\n`;
        download('assemble-film.sh',script);
        status('Production JSON and video assembly script exported. Your browser may ask to allow multiple downloads.', 'success');
    }
    async function showMedia(p) {
        for(const a of p.assets) {
            const el=document.querySelector(`[data-media-id="${CSS.escape(a.id)}"]`); if(!el) continue;
            try {
                const blob=await assetStore('get',a.id); if(!blob || !el.isConnected) {el.textContent='Media unavailable — re-import the file.';continue;}
                const url=URL.createObjectURL(blob);urls.push(url);
                const media=document.createElement(a.type.startsWith('video/')?'video':a.type.startsWith('audio/')?'audio':'img');
                media.src=url; if(media.tagName==='IMG')media.alt=a.name;else media.controls=true; el.append(media);
            } catch(error) {el.textContent=error.message;}
        }
    }
    function outputURL(output, endpoint) {
        const base=C.safeEndpoint(endpoint);
        const url=new URL(proxyConfig?.endpoint===base?location.origin+'/api/comfy/view':base+'/view');
        url.search=new URLSearchParams({filename:output.filename,subfolder:output.subfolder||'',type:output.type||'output',...(proxyConfig?.endpoint===base?{__studio_endpoint:base}:{})}).toString();return url.href;
    }
    async function showOutputs(p,c) {
        const box=$('studioPreview');if(!box||!c)return;
        const videos=c.outputs.filter(o=>/\.(mp4|webm|mov|mkv|gif)$/i.test(o.filename));
        const outputs=videos.length?videos:c.outputs;
        for(const o of outputs) {
            const isVideo=/\.(mp4|webm|mov|mkv)$/i.test(o.filename);
            const media=document.createElement(isVideo?'video':'img');if(/\.(wav|mp3|ogg|flac|m4a)$/i.test(o.filename)){const audio=document.createElement('audio');audio.src=outputURL(o,c.job?.endpoint||data.connection.endpoint);audio.controls=true;box.append(audio);continue;}media.src=outputURL(o,c.job?.endpoint||data.connection.endpoint);
            if(isVideo){media.controls=true;media.crossOrigin='anonymous';}else media.alt=o.filename;
            const link=document.createElement('a');link.href=media.src;link.download=o.filename;link.textContent=`Download ${o.filename}`;link.className='studio-muted';link.target='_blank';link.rel='noopener';
            box.append(media,link);
        }
        if(!outputs.length && c.startAsset) {
            const a=p.assets.find(a=>a.id===c.startAsset), blob=await assetStore('get',c.startAsset);
            if(a&&blob&&box.isConnected){const media=document.createElement(a.type.startsWith('video/')?'video':'img');const url=URL.createObjectURL(blob);urls.push(url);media.src=url;if(media.tagName==='VIDEO')media.controls=true;else media.alt=a.name;box.append(media);}
        }
        if(!box.childNodes.length)box.innerHTML=`<div class="preview-empty"><span class="preview-frame">${icon('film')}</span><h4>Your shot, ready to take shape.</h4><p>Render this clip or open a local video to review its ending.</p><span class="preview-empty-spec">${esc(p.model==='minimax-h3'?'MiniMax H3':p.model)} · ${esc(p.aspect)} · ${c.duration}s</span></div>`;
    }
    async function captureFrame(p,c,i) {
        const video=$('studioPreview')?.querySelector('video');if(!video || !video.videoWidth)throw new Error('Load a playable video and pause on the frame you want first.');
        if(!video.paused)throw new Error('Pause the video at the desired ending frame before capturing.');
        const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
        canvas.getContext('2d').drawImage(video,0,0);
        const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(b=>b?resolve(b):reject(new Error('Frame capture failed.')),'image/png');}catch{reject(new Error('The video server must allow this studio’s origin for frame capture. Download and import the video to capture it locally.'));}});
        const a=await addAsset(new File([blob],`ending-${i+1}.png`,{type:'image/png'}),'Ending frame',p);
        if(p.clips[i+1])p.clips[i+1].startAsset=a.id;save();status(p.clips[i+1]?'Frame captured and attached to the next clip. Describe the actual ending, then rebuild the next prompt.':'Frame captured in reference media. Add a next clip to continue.','success');
    }
    async function comfyRequest(path, options={}, endpoint=data.connection.endpoint) {
        await proxyReady;
        const base=C.safeEndpoint(endpoint),proxied=proxyConfig?.endpoint===base;
        const response=await fetch((proxied?'/api/comfy':base)+path,{...options,headers:{...options.headers,...(proxied?{'X-Studio-Token':proxyConfig.token,'X-Comfy-Endpoint':base}:{})},signal:AbortSignal.timeout(120000)});
        if(!response.ok)throw new Error(`ComfyUI HTTP ${response.status}: ${(await response.text()).slice(0,800)}`);
        return response.json();
    }
    async function saveComfyAddress(){
        if(comfySaving)throw Error('Wait for the ComfyUI address to finish saving.');
        if(VideoJoiner.isRunning()||Sequence.isRunning()||activeRun||submitting||busy||Easy.isRunning()||Photoshoot.isRunning()||Characters.isRunning()||Images.isRunning()||Music.isRunning())throw Error('Stop the active production watcher before changing the ComfyUI address.');
        await proxyReady;
        const endpoint=C.safeEndpoint(comfyDraft??data.connection.endpoint);
        comfySaving=true;render();
        try{
            if(proxyConfig){
                const response=await fetch('/api/studio/config',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':proxyConfig.token},body:JSON.stringify({comfyEndpoint:endpoint}),signal:AbortSignal.timeout(15000)});
                const result=await response.json();
                if(!response.ok)throw Error(result.error||'Unable to save the ComfyUI address.');
                proxyConfig={endpoint:C.safeEndpoint(result.comfyEndpoint),token:result.token};
            }
            data.connection.endpoint=endpoint;comfyDraft=null;save();
            status(proxyConfig?'ComfyUI address saved on the server. Test the connection before rendering.':'ComfyUI address saved in this browser. Test the connection before rendering.','success');
        }finally{comfySaving=false;render();}
    }
    async function mappedWorkflow(p,c,upload,cfg=data.connection) {
        if(!cfg.graph)throw new Error('Import a working API workflow in the ComfyUI tab first.');
        if(!c?.prompt)throw new Error('Build or write a prompt for this clip first.');
        const i=p.clips.indexOf(c), kind=!p.musicVideo?.planStamp && i>0 && p.connection==='video-reference'?'video':'image';
        const textOpening=c.generationMode==='text';
        const a=textOpening?null:p.assets.find(a=>a.id===c.startAsset);
        if(c.generationMode==='image'&&!a)throw Error('Generate or select a starting image, or choose Text to video for the opening clip.');
        if(!p.musicVideo?.planStamp && !textOpening && i>0 && !a)throw new Error('Attach the actual previous ending frame or video before continuing.');
        if(a && !cfg.mappings[kind]&&!Sequence.owns(p))throw new Error(`Map the ${kind} filename input in your workflow first.`);
        if(a && !(kind==='image'?a.type.startsWith('image/'):a.type.startsWith('video/')))throw new Error(`This continuation mode requires a ${kind} reference.`);
        const values={positive:c.prompt,negative:p.nsfw?'':NSFW_NEGATIVE_TERMS,seed:c.seed,duration:cfg.durationUnit==='seconds'?c.duration:Math.round(c.duration*p.fps)+(cfg.durationUnit==='frames-plus-one'?1:0)};
        if(a) {
            let filename=a.name;
            if(upload) {
                const blob=await assetStore('get',a.id);if(!blob)throw new Error('Reference media is missing. Re-import it.');
                const form=new FormData();form.append('image',blob,a.name);form.append('type','input');
                const result=await comfyRequest('/upload/image',{method:'POST',body:form},cfg.endpoint);filename=[result.subfolder,result.name].filter(Boolean).join('/');
            }
            values[kind]=filename;
        }
        if(p.musicVideo?.planStamp)Object.assign(values,await Music.audioValues(p,c,upload,cfg));
        if(c.endAsset&&!textOpening){
            if(!cfg.mappings.endImage&&!p.musicVideo?.planStamp)throw Error('Load the H3 start / end preset, or map the ending-image filename.');
            const end=p.assets.find(a=>a.id===c.endAsset);if(!end?.type.startsWith('image/'))throw Error('Select a valid end image.');
            let filename=end.name;if(upload){const blob=await assetStore('get',end.id);if(!blob)throw Error('End image is missing; re-import it.');const form=new FormData();form.append('image',blob,end.name);form.append('type','input');const result=await comfyRequest('/upload/image',{method:'POST',body:form},cfg.endpoint);filename=[result.subfolder,result.name].filter(Boolean).join('/');}values.endImage=filename;
        }
        const base=textOpening?WorkflowPresets.textOpening(cfg.graph,cfg.mappings):WorkflowPresets.anchors(cfg.graph,cfg.mappings,!!a,!!c.endAsset);
        const [nativeId]=JSON.parse(cfg.mappings.positive||'[]');if(['MiniMaxH3ImageToVideo','MiniMaxH3ReferenceToVideo'].includes(base[nativeId]?.class_type)){if(p.fps!==24)throw Error('The H3 preset requires 24 fps.');if(cfg.durationUnit!=='frames')throw Error('The H3 preset requires Frames duration units.');if(!p.musicVideo?.planStamp)values.duration=WorkflowPresets.frames(c.duration);}
        let graph=C.patchWorkflow(base,cfg.mappings,values);
        if(Sequence.owns(p)&&a){const [id]=JSON.parse(cfg.mappings.positive);if(graph[id]?.class_type==='MiniMaxH3ReferenceToVideo'||!cfg.mappings.image)graph=WorkflowPresets.startGuide(graph,cfg.mappings,values.image);}
        if(c.endAsset&&!textOpening&&!cfg.mappings.endImage&&p.musicVideo?.planStamp){const s=await comfyRequest('/object_info',{},cfg.endpoint);if(!s.MiniMaxH3AddGuide)throw Error('Install MiniMaxH3AddGuide for music scene end anchoring.');graph=WorkflowPresets.endGuide(graph,cfg.mappings,values.endImage);}
        if(p.musicVideo?.planStamp)graph=await Music.continuityGraph(p,c,graph,upload,cfg);
        const quality=RenderQuality.effective(p,c);if(RenderQuality.active(RenderQuality.videoProfile(quality))){const schema=await comfyRequest('/object_info',{},cfg.endpoint);graph=RenderQuality.videoGraph(graph,quality,schema);}
        return graph;
    }
    async function queueClip(p,c,options={}) {
        if(!c)throw new Error('Create a clip first.');
        if(p.easyStudio?.draftReady&&c.musicPromptDirty)throw Error('Scene direction changed. Rebuild or review this clip prompt before rendering.');
        if(p.musicVideo?.planStamp&&!Music.valid(p)&&!(options.sequence&&Sequence.owns(p)))throw new Error('Review and approve this music-video plan before rendering.');
        if(c.status==='queued' || activeRun || submitting)throw new Error('A clip is already queued or being watched. Check its status before submitting again.');
        submitting=true;
        try {
        const cfg=structuredClone(data.connection), endpoint=C.safeEndpoint(cfg.endpoint);
        const draft=structuredClone(p), submitted=draft.clips.find(item=>item.id===c.id);
        const graph=await mappedWorkflow(draft,submitted,true,cfg);
        const result=await comfyRequest('/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:graph,client_id:C.uid()})},endpoint);
        if(!result.prompt_id)throw new Error('ComfyUI did not return a prompt ID. Check the workflow inputs.');
        c.job={id:result.prompt_id,endpoint,prompt:submitted.prompt,seed:submitted.seed,...(p.musicVideo?.planStamp?{musicStamp:MusicCore.signature(draft,cfg),musicShotStamp:MusicCore.shotSignature(draft,draft.clips.indexOf(submitted),cfg)}:{})};c.status='queued';c.outputs=[];if(options.sequence&&c.sequenceTake)c.sequenceTake.jobId=c.job.id;save();render();
        status('Clip queued. Waiting for ComfyUI…');await watchJob(p,c);
        } finally { submitting=false; }
    }
    async function watchJob(p,c) {
        if(activeRun)throw new Error('Already watching a job. Stop watching first.');
        const token=C.uid();activeRun=token;render();
        try {
            const end=Date.now()+30*60*1000;
            while(activeRun===token && Date.now()<end) {
                const raw=await comfyRequest('/history/'+encodeURIComponent(c.job.id),{},c.job.endpoint), result=raw[c.job.id];
                if(activeRun!==token)return;
                if(result) {
                    if(result.status?.status_str==='error') {c.status='error';save();throw new Error('ComfyUI execution failed: '+JSON.stringify(result.status.messages||[]).slice(0,800));}
                    if(result.status?.completed || result.status?.status_str==='success') {
                        c.outputs=Object.values(result.outputs||{}).flatMap(o=>['images','gifs','videos','audio'].flatMap(key=>o[key]||[])).filter(o=>typeof o.filename==='string').map(o=>({filename:o.filename,subfolder:o.subfolder||'',type:o.type||'output'}));
                        c.status='complete';
                        if(!c.takes.some(t=>t.job.id===c.job.id)) c.takes.push({id:C.uid(),job:structuredClone(c.job),outputs:structuredClone(c.outputs),prompt:c.job.prompt||c.prompt,seed:c.job.seed??c.seed,createdAt:new Date().toISOString()});
                        if(c.takes.length>30)c.takes.shift();save();render();status(`Render complete for ${c.title}. Inspect the ending before continuing.`, 'success');return;
                    }
                }
                await new Promise(resolve=>setTimeout(resolve,2000));
            }
            if(activeRun===token)status('Stopped watching after 30 minutes. The job remains on ComfyUI; check its status later.');
        } finally {if(activeRun===token){activeRun=null;render();}}
    }
    async function directAI(p,action,c) {
        if(busy) return;
        const cfg=state.aiConfig;
        if(!cfg.enabled || cfg.backend!=='openai' || !cfg.endpoint)throw new Error('Enable an OpenAI-compatible Local AI connection in AI connections first.');
                const snapshot=JSON.stringify(p), index=c?p.clips.indexOf(c):-1;
        let system=action==='ai-plan'
            ? `You are a film director. Return ONLY JSON with a clips array. Each clip has title, beat, start, end, camera and dialogue strings. Exactly ${Math.ceil(p.duration/p.clipLength)} clips; each describes one continuous shot. Make a coherent story progression from the user brief. Carry each ending pose, props, motion direction and camera position into the next start. Preserve all character descriptions. Do not invent reference assets. Content preference: ${p.nsfw?'local workflow NSFW allowed':'general audience, clothed subjects, no sexual content'}.`
            : `You write ${p.model} video prompts. Return only the finished prompt, no commentary or code fences. One continuous ${c.duration}-second shot. Preserve the supplied opening and ending states, cast, lighting, motion direction and exact dialogue. Do not introduce references beyond the provided prompt.`;
        let rewriteContext=null;
        busy=true;render();status('Local AI director is working…');
        try {
        if(p.model==='minimax-h3'&&action!=='ai-plan'){rewriteContext=H3Prompts.context(p,c,data.connection);const guide=await fetch('prompts/h3-full-reference-system.txt',{cache:'no-store'});if(!guide.ok)throw Error('Could not load the H3 system prompt guide.');system=H3Prompts.system(await guide.text(),rewriteContext,p.directorSystemPrompt);}
        else if(p.model==='minimax-h3')system+=H3Prompts.planningRules;
        if(action==='ai-plan'||p.model!=='minimax-h3')system=H3Prompts.plannerSystem(system,p.directorSystemPrompt);

            const response=await LocalAI.fetchChat(cfg,{method:'POST',headers:{'Content-Type':'application/json',...(cfg.apiKey?{Authorization:'Bearer '+cfg.apiKey}:{})},signal:AbortSignal.timeout(120000),body:JSON.stringify({model:cfg.model,messages:[{role:'system',content:system},{role:'user',content:action==='ai-plan'?JSON.stringify({story:p.story,duration:p.duration,style:p.style,setting:p.setting,characters:p.characters,camera:p.camera,sound:p.sound,music:p.music}):rewriteContext?JSON.stringify({...rewriteContext,seedPrompt:C.prompt(p,index)}):C.prompt(p,index)}],max_tokens:action==='ai-plan'?8000:4000,temperature:.65})});
            if(!response.ok)throw new Error(`Local AI HTTP ${response.status}. Check your model and endpoint.`);
            const result=await response.json();if(result.choices?.[0]?.finish_reason==='length')throw LocalAI.truncationError(response,result.usage);
            const content=result.choices?.[0]?.message?.content?.replace(/^```[^\n]*\n?/,'').replace(/\n?```$/,'').trim();
            if(!content)throw new Error('Local AI returned no text.');
            if(JSON.stringify(p)!==snapshot)throw new Error('The project changed while AI was working. Result was discarded to preserve your edits.');
            if(action==='ai-plan') {
                const result=JSON.parse(content);if(!Array.isArray(result.clips) || result.clips.length!==Math.ceil(p.duration/p.clipLength))throw new Error('AI returned an invalid clip plan. Existing timeline was preserved.');
                for(const item of result.clips)if(!item || ['title','beat','start','end','camera','dialogue'].some(k=>typeof item[k]!=='string') || !item.beat.trim() || !item.end.trim())throw new Error('AI clip plan is incomplete. Existing timeline was preserved.');
                const clips=C.plan(p,result.clips.map(c=>c.beat));clips.forEach((c,i)=>{for(const key of ['title','beat','start','end','camera','dialogue'])c[key]=result.clips[i][key].slice(0,30000);});
                if(p.clips.length&&!confirm('Replace the existing timeline with the AI plan?'))return;
                p.clips=clips;p.clips.forEach((c,i)=>{c.prompt=C.prompt(p,i);});selectedClip=p.clips[0].id;tab='timeline';
            } else {c.prompt=rewriteContext?H3Prompts.validate(content,rewriteContext):content;c.musicPromptDirty=false;if(p.musicVideo?.planStamp)c.musicInputStamp=MusicCore.hash(MusicCore.prompt(p,index));}
            save();render();status('AI draft ready. Review the action, dialogue and continuity before rendering.', 'success');
        } finally {busy=false;render();}
    }
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const saved=localStorage.getItem(KEY);
            if(saved){const raw=JSON.parse(saved);if(Array.isArray(raw.projects)&&raw.projects.length){data.projects=raw.projects.map(C.normalizeProject);data.selected=raw.selected;}
                if(Array.isArray(raw.profiles)) data.profiles=C.normalizeProject({characters:raw.profiles}).characters;
                if(raw.connection){try{data.connection.endpoint=C.safeEndpoint(raw.connection.endpoint);data.connection.graph=raw.connection.graph?C.workflow(raw.connection.graph):null;data.connection.mappings=raw.connection.mappings||{};data.connection.durationUnit=['seconds','frames','frames-plus-one'].includes(raw.connection.durationUnit)?raw.connection.durationUnit:'seconds';}catch{/* Discard invalid saved connection. */}}}
        } catch {/* Start with an empty film when no readable storage exists. */}
        if(!data.projects.some(p=>p.id===data.selected))data.selected=data.projects[0].id;
        for(const p of data.projects){const snapshot=structuredClone(p);delete snapshot.updatedAt;previous.set(p.id,snapshot);}
        await proxyReady;
        if(proxyConfig?.endpoint)data.connection.endpoint=proxyConfig.endpoint;
        mount();save(true);render();
        window.addEventListener('storage',event=>{if(event.key===KEY)receiveStudioSave(event.newValue);});
        $('studioContent').addEventListener('focusout',()=>{if(pendingRemoteSave)setTimeout(()=>receiveStudioSave(pendingRemoteSave),0);});
        const libraryMedia = matchMedia('(max-width: 960px)');
        const fitLibrary = () => { $('studioLibrary').open = !libraryMedia.matches; };
        fitLibrary(); libraryMedia.addEventListener('change', fitLibrary);
        $('openStudio').addEventListener('click',()=>{document.body.classList.remove('generator-mode');$('openStudio').setAttribute('aria-pressed','true');$('openGenerator').setAttribute('aria-pressed','false');});
        $('openGenerator').addEventListener('click',()=>{document.body.classList.add('generator-mode');$('openStudio').setAttribute('aria-pressed','false');$('openGenerator').setAttribute('aria-pressed','true');});
        document.querySelector('.studio-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...document.querySelectorAll('.studio-tab')];const index=buttons.findIndex(b=>b.dataset.tabId===tab);const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;e.preventDefault();tab=buttons[next].dataset.tabId;render();buttons[next].focus();});
    });
})();
