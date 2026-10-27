const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../studio-core.js');

test('timeline allocates exact duration with no undersized trailing clip', () => {
    for (const duration of [4, 16, 20, 31, 60, 91, 600]) {
        const p=C.project();p.duration=duration;p.clipLength=15;
        p.clips=C.plan(p,['Walk toward the door.']);
        assert.equal(C.timeline(p.clips).at(-1).end,duration);
        assert.ok(p.clips.every(c=>c.duration>=4&&c.duration<=15));
    }
});
test('excess story beats are rejected before replacing a plan', () => {
    const p=C.project();p.duration=10;
    assert.throws(()=>C.plan(p,['a','b','c']),/Too many/);
});
test('observed ending overrides planned ending in the next clip', () => {
    const p=C.project();p.clips=[C.clip(),C.clip()];p.clips[0].end='Planned pose';p.clips[0].actualEnd='Hand on brass handle';
    assert.equal(C.continuity(p,1),'Hand on brass handle');
    assert.match(C.prompt(p,1),/Hand on brass handle/);
    assert.doesNotMatch(C.prompt(p,1),/<Picture 1>/);p.clips[1].startAsset='actual-frame';assert.match(C.prompt(p,1),/<Picture 1>/);
});
test('H3 text generation has no invented image reference', () => {
    const p=C.project();p.clips=[C.clip()];
    assert.match(C.prompt(p,0),/integrated_multimodal_description/);
    assert.doesNotMatch(C.prompt(p,0),/<Picture|<Video/);
});
test('H3 continuation uses the full-reference structure', () => {
    const p=C.project();p.connection='video-reference';p.clips=[C.clip(),C.clip()];
    assert.match(C.prompt(p,1),/\[video continuation\]/);
    assert.match(C.prompt(p,1),/retention_analysis/);
    assert.doesNotMatch(C.prompt(p,1),/<Picture/);
});
test('NSFW preference is retained without adding unwanted material', () => {
    const p=C.project();p.clips=[C.clip()];
    assert.match(C.prompt(p,0),/general audience/);
    p.nsfw=true;assert.doesNotMatch(C.prompt(p,0),/general audience/);
    assert.equal(C.normalizeProject(p).nsfw,true);
});
test('project import clamps invalid data and strips unexpected properties', () => {
    const p=C.normalizeProject({title:'Example',duration:900,clipLength:1,clips:[{duration:90,seed:-2}],apiKey:'secret'});
    assert.equal(p.duration,600);assert.equal(p.clipLength,4);assert.equal(p.clips[0].duration,15);assert.equal(p.clips[0].seed,0);
    assert.equal(p.apiKey,undefined);
});
test('editor workflow is rejected and API graph links are preserved', () => {
    assert.throws(()=>C.workflow({nodes:[]}),/API format/);
    const graph={'1':{class_type:'Text',inputs:{text:'old'}},'2':{class_type:'Sampler',inputs:{positive:['1',0],seed:1}}};
    const changed=C.patchWorkflow(graph,{positive:'["1","text"]',seed:'["2","seed"]'},{positive:'new',seed:9});
    assert.equal(changed['1'].inputs.text,'new');assert.deepEqual(changed['2'].inputs.positive,['1',0]);assert.equal(graph['1'].inputs.text,'old');
});
test('mappings reject input collisions and wrong types', () => {
    const graph={'1':{class_type:'Text',inputs:{text:'old',seed:2}}};
    assert.throws(()=>C.patchWorkflow(graph,{positive:'["1","text"]',negative:'["1","text"]'},{positive:'new',negative:'bad'}),/different/);
    assert.throws(()=>C.patchWorkflow(graph,{positive:'["1","seed"]'},{positive:'new'}),/Wrong input type/);
});
test('API workflow supports expanded subgraph node IDs', () => {
    const graph={'93:88':{class_type:'CLIPTextEncode',inputs:{text:'old'}}};
    assert.equal(C.patchWorkflow(graph,{positive:'["93:88","text"]'},{positive:'new'})['93:88'].inputs.text,'new');
});
test('endpoint rejects executable URLs and embedded credentials', () => {
    assert.throws(()=>C.safeEndpoint('javascript:alert(1)'),/HTTP/);
    assert.throws(()=>C.safeEndpoint('https://user:secret@example.com'),/credentials/);
    assert.equal(C.safeEndpoint('http://localhost:8188/'),'http://localhost:8188');
});
