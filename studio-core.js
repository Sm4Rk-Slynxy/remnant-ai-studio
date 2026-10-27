/* Pure project, timeline and workflow logic. Shared by the browser and tests. */
(function (root) {
    'use strict';
    const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const text = (value, limit = 30000) => typeof value === 'string' ? value.slice(0, limit) : '';
    const number = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
    function project() {
        return {
            id: uid(), title: 'Untitled film', story: '', model: 'minimax-h3', duration: 60, clipLength: 10,
            aspect: '16:9', fps: 24, style: 'Live-action, cinematic', setting: '', camera: 'Slow tracking shot',
            sound: 'Continuous natural ambience with synchronized physical sounds.', music: 'N/A',
            nsfw: false, connection: 'last-frame', characters: [], castDrafts: [], clips: [], assets: [], updatedAt: new Date().toISOString()
        };
    }
    function clip() {
        return { id: uid(), title: 'New clip', duration: 10, beat: '', start: '', end: '', actualEnd: '',
            camera: '', dialogue: '', prompt: '', seed: Math.floor(Math.random() * 1000000000),
            startAsset: '', endAsset: '', sceneId: '', sceneLocation: '', transition: '', startImagePrompt: '', endImagePrompt: '', status: 'draft', job: null, outputs: [], takes: [], notes: '' };
    }
    function normalizeProject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid project.');
        const p = project();
        p.id = text(value.id, 100) || p.id;
        p.updatedAt = text(value.updatedAt,100) || p.updatedAt;
        for (const key of ['title', 'story', 'style', 'setting', 'camera', 'sound', 'music']) p[key] = text(value[key]) || p[key];
        p.model = ['minimax-h3', 'ltx-25', 'krea-2'].includes(value.model) ? value.model : p.model;
        p.connection = value.connection === 'video-reference' ? 'video-reference' : 'last-frame';
        p.aspect = ['16:9', '9:16', '1:1', '4:3', '21:9'].includes(value.aspect) ? value.aspect : p.aspect;
        p.duration = number(value.duration, 4, value.musicVideo ? 1200 : 600, 60);
        p.clipLength = number(value.clipLength, 4, 15, 10);
        p.fps = number(value.fps, 1, 120, 24);
        p.nsfw = value.nsfw === true;
        if(typeof value.directorSystemPrompt==='string')p.directorSystemPrompt=text(value.directorSystemPrompt,30000);
        p.characters = (Array.isArray(value.characters) ? value.characters : []).slice(0, 40).map(c => ({
            ...(typeof module!=='undefined'?require('./character-core.js'):root.CharacterCore).normalize(c), id: text(c.id, 100) || uid()
        }));
        p.castDrafts = (Array.isArray(value.castDrafts)?value.castDrafts:[]).slice(0,8).map(c=>(typeof module!=='undefined'?require('./character-core.js'):root.CharacterCore).draft(c));
        p.assets = (Array.isArray(value.assets) ? value.assets : []).slice(0, 300).map(a => ({
            id: text(a.id, 100) || uid(), name: text(a.name, 300), type: text(a.type, 100), role: text(a.role, 200), ...(a.imageMetadata?{imageMetadata:(typeof module!=='undefined'?require('./image-library.js'):root.ImageLibrary).metadata(a.imageMetadata)}:{})
        }));
        p.clips = (Array.isArray(value.clips) ? value.clips : []).slice(0, 250).map(c => {
            const result = clip();
            result.musicPerformance = c.musicPerformance === true;
            result.musicContinuity = c.musicContinuity === 'previous' ? 'previous' : 'cut';
            result.musicPromptDirty = c.musicPromptDirty === true;
            result.musicInputStamp = text(c.musicInputStamp,100);
            for (const key of ['id', 'title', 'beat', 'start', 'end', 'actualEnd', 'camera', 'dialogue', 'prompt', 'startAsset', 'endAsset', 'sceneId', 'sceneLocation', 'startImagePrompt', 'endImagePrompt', 'notes']) result[key] = text(c[key]) || result[key];
            if(c.sequenceTake&&typeof c.sequenceTake==='object')result.sequenceTake=(typeof module!=='undefined'?require('./sequence-core.js'):root.SequenceCore).take(c.sequenceTake);
            if(c.renderQuality&&typeof c.renderQuality==='object')result.renderQuality=(typeof module!=='undefined'?require('./render-quality.js'):root.RenderQuality).settings(c.renderQuality);
            if(['text','image'].includes(c.generationMode))result.generationMode=c.generationMode;
            result.transition=['cut','continue'].includes(c.transition)?c.transition:'';
            if(Array.isArray(c.castIds))result.castIds=c.castIds.slice(0,8).filter(id=>typeof id==='string'&&p.characters.some(x=>x.id===id));
            result.duration = number(c.duration, 4, 15, 10);
            result.seed = Math.floor(number(c.seed, 0, Number.MAX_SAFE_INTEGER, result.seed));
            result.status = ['draft', 'queued', 'complete', 'error'].includes(c.status) ? c.status : 'draft';
            if (c.job && typeof c.job.id === 'string') result.job = { id: text(c.job.id, 200), endpoint: safeEndpoint(c.job.endpoint), prompt: text(c.job.prompt), musicStamp: text(c.job.musicStamp,100), musicShotStamp: text(c.job.musicShotStamp,100), seed: number(c.job.seed, 0, Number.MAX_SAFE_INTEGER, result.seed) };
            result.outputs = (Array.isArray(c.outputs) ? c.outputs : []).slice(0, 100).map(o => ({ filename: text(o.filename, 500), subfolder: text(o.subfolder, 500), type: ['input', 'output', 'temp'].includes(o.type) ? o.type : 'output' }));
            result.takes = (Array.isArray(c.takes) ? c.takes : []).slice(-30).map(t => ({
                id: text(t.id, 100) || uid(), prompt: text(t.prompt), seed: number(t.seed, 0, Number.MAX_SAFE_INTEGER, 0), createdAt: text(t.createdAt, 100),
                job: { id: text(t.job?.id, 200), endpoint: safeEndpoint(t.job?.endpoint) },
                outputs: (Array.isArray(t.outputs) ? t.outputs : []).slice(0,100).map(o => ({filename:text(o.filename,500),subfolder:text(o.subfolder,500),type:['input','output','temp'].includes(o.type)?o.type:'output'}))
            }));
            return result;
        });
        if (value.musicVideo && typeof value.musicVideo === 'object') {
            const M = typeof module !== 'undefined' ? require('./music-core.js') : root.MusicCore;
            p.musicVideo = M.settings(value.musicVideo);
        }
        if(value.videoJoiner&&typeof value.videoJoiner==='object')p.videoJoiner=(typeof module!=='undefined'?require('./video-join-core.js'):root.VideoJoinCore).settings(value.videoJoiner);
        if(value.sequenceProduction&&typeof value.sequenceProduction==='object')p.sequenceProduction=(typeof module!=='undefined'?require('./sequence-core.js'):root.SequenceCore).settings(value.sequenceProduction);
        if(value.renderQuality&&typeof value.renderQuality==='object')p.renderQuality=(typeof module!=='undefined'?require('./render-quality.js'):root.RenderQuality).settings(value.renderQuality);
        if(value.easyStudio&&typeof value.easyStudio==='object'){const E=typeof module!=='undefined'?require('./easy-studio-core.js'):root.EasyStudioCore;p.easyStudio=E.settings(value.easyStudio);}
        if(value.photoshoot&&typeof value.photoshoot==='object'){const P=typeof module!=='undefined'?require('./photoshoot-core.js'):root.PhotoshootCore;p.photoshoot=P.settings(value.photoshoot);}
        if(value.imageStudio&&typeof value.imageStudio==='object'){const I=typeof module!=='undefined'?require('./image-core.js'):root.ImageCore;p.imageStudio=I.settings(value.imageStudio);if(p.imageStudio.customGraph)p.imageStudio.customGraph=workflow(p.imageStudio.customGraph);}
        return p;
    }
    function plan(p, suppliedBeats) {
        const beats = suppliedBeats || p.story.split(/\n+/).map(s => s.trim()).filter(Boolean);
        const count = Math.max(Math.ceil(p.duration / p.clipLength), beats.length || 1);
        if (p.duration / count < 4) throw new Error('Too many story beats for this duration. Allow at least 4 seconds per clip.');
        let previous = p.setting ? `The scene begins in ${p.setting}.` : 'Establish the subjects and setting.';
        return Array.from({ length: count }, (_, i) => {
            const c = clip();
            c.title = `Clip ${String(i + 1).padStart(2, '0')}`;
            // Centisecond allocation avoids a too-short final clip and preserves the exact total.
            c.duration = (Math.round(p.duration * 100 * (i + 1) / count) - Math.round(p.duration * 100 * i / count)) / 100;
            c.beat = beats.length ? beats[Math.min(beats.length - 1, Math.floor(i * beats.length / count))] : 'Continue the main action naturally.';
            c.start = previous;
            c.end = `At the end of this segment of "${c.beat}", keep the subject's pose, screen position, props and camera direction ready for the next movement.`;
            previous = c.end;
            return c;
        });
    }
    function timeline(clips) {
        let time = 0;
        return clips.map(c => { const start = time; time += c.duration; return { start: +start.toFixed(2), end: +time.toFixed(2) }; });
    }
    function castFor(p,c){return Array.isArray(c?.castIds)?p.characters.filter(x=>c.castIds.includes(x.id)):p.characters;}
    function continuity(p, i) {
        const c = p.clips[i], prev = p.clips[i - 1];
        return prev&&c.transition!=='cut' ? prev.actualEnd || prev.end : c.start;
    }
    function prompt(p, i) {
        if(p.clips[i]?.generationMode==='text'&&(p.clips[i].startAsset||p.clips[i].endAsset))p={...p,clips:p.clips.map((c,j)=>j===i?{...c,startAsset:'',endAsset:''}:c)};
        if(p.musicVideo?.planStamp){const M=typeof module!=='undefined'?require('./music-core.js'):root.MusicCore;return M.prompt(p,i);}
        const c = p.clips[i];
        if (!c) throw new Error('Select a clip.');
        const start = continuity(p, i);
        const cast = castFor(p,c).map(c => `${c.name}: ${c.description}${c.outfit?' Wardrobe: '+c.outfit:''}${c.avoid?' Preserve identity; avoid: '+c.avoid:''}${c.voice ? ` Voice: ${c.voice}` : ''}`).join('\n');
        const contentRule = p.nsfw ? '' : 'Keep the scene suitable for a general audience, with clothed subjects and no sexual content. ';
        const scene = `${contentRule}${p.style}. ${p.aspect} composition. ${cast ? `Recurring cast:\n${cast}\n` : ''}Setting: ${c.sceneLocation || p.setting || 'Use the established setting'}. Opening state: ${start}. ${c.camera || p.camera}. Over ${c.duration} seconds, ${c.beat}. End state: ${c.end}. Preserve identity, wardrobe, props, lighting, screen direction and motion speed. A single uninterrupted shot; continue through the ending without a fade or an artificial stop.${c.dialogue ? `\nDialogue and delivery: ${c.dialogue}` : ''}`;
        if (p.model !== 'minimax-h3') return `${scene}\n\nSound: ${p.sound}\nMusic: ${p.music}`;
        if (i > 0 && c.generationMode!=='text' && p.connection === 'video-reference') {
            return `subject_definitions:\n<Video 1> is the previous rendered clip, supplied as the source video to continue.\n${cast ? `<Subject 1> is the recurring cast: ${cast}\n` : ''}\nsummary:\n[video continuation] Continue directly from the ending of <Video 1> for ${c.duration} seconds in ${p.aspect}.\n\nretention_analysis:\n<Video 1>: fully_preserved - continue its final camera position, subject appearance, lighting and motion direction.\n\ndetailed_description:\n[Shot 1] ${scene}\n\noverall_soundscape:\n${p.sound}\n\nnon_diegetic_music:\n${p.music || 'N/A'}`;
        }
        const anchor = c.startAsset ? 'Begin at 0.00 seconds from the supplied first-frame image, <Picture 1>, preserving its composition, identities and scene geometry.\n\n' : '';
        return `${anchor}integrated_multimodal_description:\n[Shot 1] ${scene}\n\noverall_soundscape:\n${p.sound}\n\nnon_diegetic_music:\n${p.music || 'N/A'}`;
    }
    function workflow(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Array.isArray(value.nodes)) throw new Error('Export the workflow in ComfyUI API format, not the editor format.');
        const entries = Object.entries(value);
        if (!entries.length || entries.length > 2000 || entries.some(([id, n]) => !id || id.length > 300 || ['__proto__', 'constructor', 'prototype'].includes(id) || !n || typeof n.class_type !== 'string' || !n.inputs || typeof n.inputs !== 'object' || Array.isArray(n.inputs))) throw new Error('Invalid API workflow: expected nodes with class_type and inputs.');
        return JSON.parse(JSON.stringify(value));
    }
    function fields(graph, kind) {
        return Object.entries(graph || {}).flatMap(([id, n]) => Object.entries(n.inputs).filter(([, v]) => kind === 'number' ? typeof v === 'number' : typeof v === 'string').map(([input]) => ({ value: JSON.stringify([id, input]), label: `${id} · ${n._meta?.title || n.class_type} · ${input}` })));
    }
    function patchWorkflow(graph, mappings, values) {
        const result = workflow(graph);
        if (!mappings.positive) throw new Error('Map a positive prompt input first.');
        const used = new Set();
        for (const [kind, mapping] of Object.entries(mappings)) {
            if (!mapping || values[kind] === undefined) continue;
            const [id, input] = JSON.parse(mapping);
            if (!Object.hasOwn(result[id]?.inputs || {}, input)) throw new Error(`Workflow input for ${kind} no longer exists.`);
            if (used.has(mapping)) throw new Error('Map each value to a different workflow input.');
            used.add(mapping);
            if (typeof result[id].inputs[input] !== typeof values[kind]) throw new Error(`Wrong input type for ${kind}.`);
            result[id].inputs[input] = values[kind];
        }
        return result;
    }
    function safeEndpoint(value) {
        const u = new URL(value || 'http://127.0.0.1:8188');
        if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error('Use an HTTP(S) server address without credentials, query parameters or fragments.');
        return u.href.replace(/\/$/, '');
    }
    const api = { uid, project, clip, normalizeProject, plan, timeline, continuity, castFor, prompt, workflow, fields, patchWorkflow, safeEndpoint };
    if (typeof module !== 'undefined') module.exports = api;
    else root.StudioCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
