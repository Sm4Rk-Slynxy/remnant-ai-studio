/* ===== Constants ===== */

// Default prompt templates for each workflow type
const DEFAULT_TEMPLATES = {
    'text-to-image': {
        positive: '{characters}, {genre}, {mood}, {artStyle}, {setting}, {colorPalette}, {cameraAngle}, {environment}, {action}, {composition}, high quality, detailed, 4k, sharp focus',
        negative: 'low quality, blurry, deformed, distorted, ugly, disfigured, extra limbs, missing limbs, bad anatomy, text, signature, watermark, username'
    },
    'text-to-video': {
        positive: '{characters}, {genre}, {mood}, {artStyle}, {setting}, {colorPalette}, {cameraAngle}, {environment}, {action}, {composition}, cinematic, smooth motion, high quality, detailed, 4k, sharp focus',
        negative: 'low quality, blurry, deformed, distorted, ugly, disfigured, extra limbs, missing limbs, bad anatomy, text, signature, watermark, username, jittery, flickering, stuttering'
    },
    'image-to-video': {
        positive: '{characters}, {genre}, {mood}, {artStyle}, {setting}, {colorPalette}, {cameraAngle}, {environment}, {action}, {composition}, cinematic, coherent structure, high quality, detailed, 4k, sharp focus',
        negative: 'low quality, blurry, deformed, distorted, ugly, disfigured, extra limbs, missing limbs, bad anatomy, text, signature, watermark, username, jittery, flickering'
    }
};

// Model-specific additional prompt terms
const MODEL_TERMS = {
    'krea-2': 'masterpiece, best quality, ultra-detailed, 8k, HDR, depth of field',
    'ltx-25': 'cinematic, smooth motion, motion blur, high frame rate, video',
    'minimax-h3': 'narrative, action sequence, character performing action, detailed scene'
};

// Model-specific tips displayed in the UI
const MODEL_TIPS = {
    'krea-2': 'KREA 2 produces high-quality images with excellent prompt following. Use artistic descriptors, style references, and technical terms like 8k, HDR, depth of field.',
    'ltx-25': 'LTX 2.5 works best with motion-related terms and cinematic language. Emphasize smooth motion, camera movements, and temporal consistency.',
    'minimax-h3': 'H3 uses structured audiovisual prompts. Describe visible motion and synchronized sound. Use Film studio for connected clips beyond 15 seconds. Weight syntax is omitted for H3.'
};

// Default preset values for randomization
const DEFAULT_PRESETS = {
    genres: ['cyberpunk', 'fantasy', 'sci-fi', 'steampunk', 'horror', 'renaissance', 'modern', 'retro', 'post-apocalyptic', 'noir', 'baroque', 'gothic', 'art deco', 'surreal', 'dystopian', 'utopian', 'medieval', 'victorian', 'wild west', 'ancient', 'biopunk', 'solarpunk', 'mythic', 'cosmic horror'],
    moods: ['dark', 'bright', 'melancholic', 'joyful', 'mysterious', 'dramatic', 'serene', 'chaotic', 'nostalgic', 'futuristic', 'tense', 'calm', 'energetic', 'eerie', 'warm', 'cold', 'hopeful', 'despairing', 'whimsical', 'serious', 'brooding', 'tranquil', 'vibrant', 'ominous', 'uplifting'],
    artStyles: ['digital art', 'oil painting', 'watercolor', 'anime', 'pixel art', 'photorealistic', 'illustration', '3D render', 'cinematic', 'concept art', 'sketch', 'line art', 'low poly', 'voxel art', 'stained glass', 'graffiti', 'pop art', 'abstract', 'minimalist', 'baroque', 'renaissance', 'impressionist', 'expressionist', 'surrealist', 'ukiyo-e', 'manga', 'comic book', 'matte painting', 'hyperrealistic'],
    settings: ['cityscape', 'forest', 'castle', 'space station', 'underwater', 'desert', 'mountain', 'interior', 'street', 'landscape', 'laboratory', 'temple', 'battlefield', 'marketplace', 'bedroom', 'bridge', 'tower', 'cave', 'garden', 'harbor', 'cybercity', 'neon district', 'abandoned mall', 'space colony', 'alien planet', 'medieval village', 'ancient ruins', 'futuristic metropolis', 'industrial complex', 'enchanted grove'],
    characters: ['warrior', 'mage', 'scientist', 'robot', 'dragon', 'samurai', 'explorer', 'artist', 'pilot', 'monarch', 'knight', 'alien', 'cyborg', 'elf', 'dwarf', 'wizard', 'archer', 'pirate', 'monk', 'queen', 'king', 'prince', 'princess', 'bounty hunter', 'assassin', 'necromancer', 'paladin', 'ranger', 'sorceress', 'corsair'],
    colorPalettes: ['vibrant colors', 'monochromatic', 'warm tones', 'cool tones', 'pastel', 'neon', 'earthy', 'high contrast', 'soft lighting', 'dramatic lighting', 'saturated', 'desaturated', 'complementary', 'analogous', 'triadic', 'chromatic', 'achromatic', 'golden hour', 'twilight', 'midnight'],
    cameraAngles: ['close-up', 'wide shot', 'medium shot', 'bird\'s eye view', 'low angle', 'high angle', 'over the shoulder', 'point of view', 'dutch angle', 'extreme close-up', 'long shot', 'two-shot', 'three-quarter view', 'front view', 'profile view', 'canted angle', 'worm\'s eye view', 'aerial view', 'macro shot', 'portrait orientation'],
    environments: ['atmospheric lighting', 'misty atmosphere', 'detailed background', 'cinematic lighting', 'soft lighting', 'dramatic shadows', 'golden hour lighting', 'twilight ambiance', 'neon glow', 'ethereal mist', 'volumetric lighting', 'ambient occlusion', 'rim lighting', 'backlighting', 'diffused lighting', 'harsh lighting', 'moody atmosphere', 'bright atmosphere', 'stormy weather', 'clear sky'],
    actions: ['dynamic pose', 'in motion', 'running', 'jumping', 'casting a spell', 'swinging a weapon', 'standing confidently', 'looking away', 'reaching out', 'kneeling', 'flying', 'transformation', 'battle ready', 'contemplative stance', 'action sequence', 'dramatic gesture', 'walking forward', 'turning around', 'attacking', 'defending'],
    compositions: ['rule of thirds', 'shallow depth of field', '8k resolution', 'ultra-detailed', 'sharp focus', 'centered composition', 'symmetrical', 'asymmetrical balance', 'leading lines', 'frame within frame', 'golden ratio', 'negative space', 'bokeh background', 'detailed foreground', 'cinematic crop', 'wide aperture', 'high dynamic range', 'studio lighting', 'natural lighting', 'chiaroscuro']
};

// NSFW terms added to negative prompt when NSFW mode is disabled
const NSFW_NEGATIVE_TERMS = 'nude, sexual, explicit, pornographic, erotic, suggestive, revealing clothing, bare skin, cleavage, NSFW, sexy, seductive, lingerie, topless, bottomless';

// Input field IDs mapped to preset categories
const INPUT_FIELDS = ['genre', 'mood', 'artStyle', 'setting', 'characters', 'colorPalette', 'cameraAngle', 'environment', 'action', 'composition'];

/* ===== State Management ===== */

let state = {
    inputs: {
        genre: '',
        mood: '',
        artStyle: '',
        setting: '',
        characters: '',
        colorPalette: '',
        cameraAngle: '',
        environment: '',
        action: '',
        composition: ''
    },
    workflow: 'text-to-image',
    model: 'krea-2',
    weightingEnabled: false,
    weightValue: 1.2,
    randomizeEnabled: false,
    nsfwEnabled: false,
    seed: 0,
    positivePrompt: '',
    negativePrompt: '',
    collections: [],
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    presets: JSON.parse(JSON.stringify(DEFAULT_PRESETS)),
    aiConfig: {
        backend: 'openai',
        endpoint: 'http://127.0.0.1:8000/v1',
        model: '',
        apiKey: '',
        enabled: false
    },
    currentCollection: null,
    currentCollectionId: null
};

/* ===== DOM Cache ===== */

const DOM = {
    // Input panel
    workflowSelect: null,
    modelSelect: null,
    modelTips: null,
    inputForm: null,
    weightingCheckbox: null,
    randomizeCheckbox: null,
    nsfwCheckbox: null,
    generateBtn: null,
    randomizeBtn: null,
    clearBtn: null,
    genStatus: null,

    // Output panel
    positivePrompt: null,
    negativePrompt: null,
    seedValue: null,
    copyPositiveBtn: null,
    copyNegativeBtn: null,
    savePromptBtn: null,
    regenerateSeedBtn: null,
    copySeedBtn: null,

    // Tabs
    tabBtns: [],
    tabPanels: [],

    // Collections
    collectionsList: null,
    collectionHeader: null,
    createCollectionBtn: null,
    collectionView: null,
    backToCollectionsBtn: null,
    currentCollectionName: null,
    savedPromptsList: null,

    // Templates
    templateWorkflowSelect: null,
    positiveTemplate: null,
    negativeTemplate: null,
    saveTemplateBtn: null,

    // Settings - Local AI
    aiBackend: null,
    aiEndpoint: null,
    aiModel: null,
    aiApiKey: null,
    toggleApiKeyBtn: null,
    aiEnabled: null,
    testAiConnectionBtn: null,

    // Settings - Presets
    presetGenres: null,
    presetMoods: null,
    presetArtStyles: null,
    presetSettings: null,
    presetCharacters: null,
    presetColors: null,
    presetCameraAngles: null,
    presetEnvironments: null,
    presetActions: null,
    presetCompositions: null,
    savePresetsBtn: null,

    // Settings - Data Management
    exportDataBtn: null,
    importDataBtn: null,
    importFile: null,
    resetDataBtn: null,

    // Modals
    createCollectionModal: null,
    collectionNameInput: null,
    cancelCollectionBtn: null,
    saveCollectionBtn: null,
    savePromptModal: null,
    saveToCollectionSelect: null,
    saveToNewCollectionBtn: null,
    cancelSaveBtn: null,
    confirmSaveBtn: null,
    promptDetailModal: null,
    promptDetailContent: null,
    closePromptDetailBtn: null
};

/* ===== Initialization ===== */

function init() {
    cacheDOM();
    loadFromLocalStorage();
    setupEventListeners();
    updateAllUI();
    generateSeed();
}

function cacheDOM() {
    // Input panel
    DOM.workflowSelect = document.getElementById('workflow');
    DOM.modelSelect = document.getElementById('model');
    DOM.modelTips = document.getElementById('modelTips');
    DOM.inputForm = document.getElementById('inputForm');
    DOM.weightingCheckbox = document.getElementById('weighting');
    DOM.randomizeCheckbox = document.getElementById('randomize');
    DOM.nsfwCheckbox = document.getElementById('nsfw');
    DOM.generateBtn = document.getElementById('generateBtn');
    DOM.randomizeBtn = document.getElementById('randomizeBtn');
    DOM.clearBtn = document.getElementById('clearBtn');
    DOM.genStatus = document.getElementById('genStatus');

    // Output panel
    DOM.positivePrompt = document.getElementById('positivePrompt');
    DOM.negativePrompt = document.getElementById('negativePrompt');
    DOM.seedValue = document.getElementById('seedValue');
    DOM.copyPositiveBtn = document.getElementById('copyPositive');
    DOM.copyNegativeBtn = document.getElementById('copyNegative');
    DOM.savePromptBtn = document.getElementById('savePrompt');
    DOM.regenerateSeedBtn = document.getElementById('regenerateSeed');
    DOM.copySeedBtn = document.getElementById('copySeed');

    // Tabs
    DOM.tabBtns = document.querySelectorAll('.tab-btn');
    DOM.tabPanels = document.querySelectorAll('.tab-panel');

    // Collections
    DOM.collectionsList = document.getElementById('collectionsList');
    DOM.collectionHeader = document.querySelector('.collections-header');
    DOM.createCollectionBtn = document.getElementById('createCollectionBtn');
    DOM.collectionView = document.getElementById('collectionView');
    DOM.backToCollectionsBtn = document.getElementById('backToCollections');
    DOM.currentCollectionName = document.getElementById('currentCollectionName');
    DOM.savedPromptsList = document.getElementById('savedPromptsList');

    // Templates
    DOM.templateWorkflowSelect = document.getElementById('templateWorkflow');
    DOM.positiveTemplate = document.getElementById('positiveTemplate');
    DOM.negativeTemplate = document.getElementById('negativeTemplate');
    DOM.saveTemplateBtn = document.getElementById('saveTemplateBtn');

    // Settings - Local AI
    DOM.aiBackend = document.getElementById('aiBackend');
    DOM.aiEndpoint = document.getElementById('aiEndpoint');
    DOM.aiModel = document.getElementById('aiModel');
    DOM.aiApiKey = document.getElementById('aiApiKey');
    DOM.toggleApiKeyBtn = document.getElementById('toggleApiKey');
    DOM.aiEnabled = document.getElementById('aiEnabled');
    DOM.testAiConnectionBtn = document.getElementById('testAiConnection');

    // Settings - Presets
    DOM.presetGenres = document.getElementById('presetGenres');
    DOM.presetMoods = document.getElementById('presetMoods');
    DOM.presetArtStyles = document.getElementById('presetArtStyles');
    DOM.presetSettings = document.getElementById('presetSettings');
    DOM.presetCharacters = document.getElementById('presetCharacters');
    DOM.presetColors = document.getElementById('presetColors');
    DOM.presetCameraAngles = document.getElementById('presetCameraAngles');
    DOM.presetEnvironments = document.getElementById('presetEnvironments');
    DOM.presetActions = document.getElementById('presetActions');
    DOM.presetCompositions = document.getElementById('presetCompositions');
    DOM.savePresetsBtn = document.getElementById('savePresetsBtn');

    // Settings - Data Management
    DOM.exportDataBtn = document.getElementById('exportDataBtn');
    DOM.importDataBtn = document.getElementById('importDataBtn');
    DOM.importFile = document.getElementById('importFile');
    DOM.resetDataBtn = document.getElementById('resetDataBtn');

    // Modals
    DOM.createCollectionModal = document.getElementById('createCollectionModal');
    DOM.collectionNameInput = document.getElementById('collectionName');
    DOM.cancelCollectionBtn = document.getElementById('cancelCollection');
    DOM.saveCollectionBtn = document.getElementById('saveCollection');
    DOM.savePromptModal = document.getElementById('savePromptModal');
    DOM.saveToCollectionSelect = document.getElementById('saveToCollection');
    DOM.saveToNewCollectionBtn = document.getElementById('saveToNewCollection');
    DOM.cancelSaveBtn = document.getElementById('cancelSave');
    DOM.confirmSaveBtn = document.getElementById('confirmSave');
    DOM.promptDetailModal = document.getElementById('promptDetailModal');
    DOM.promptDetailContent = document.getElementById('promptDetailContent');
    DOM.closePromptDetailBtn = document.getElementById('closePromptDetail');
}

function setupEventListeners() {
    // Input panel events
    DOM.workflowSelect?.addEventListener('change', (e) => {
        state.workflow = e.target.value;
        // Update template editor workflow if it matches
        if (DOM.templateWorkflowSelect) {
            DOM.templateWorkflowSelect.value = state.workflow;
            updateTemplateEditor();
        }
    });

    DOM.modelSelect?.addEventListener('change', (e) => {
        state.model = e.target.value;
        updateModelTips();
    });

    // Sync input form values
    INPUT_FIELDS.forEach(field => {
        const el = document.getElementById(field);
        el?.addEventListener('input', (e) => {
            state.inputs[field] = e.target.value;
        });
    });

    DOM.weightingCheckbox?.addEventListener('change', (e) => {
        state.weightingEnabled = e.target.checked;
    });

    DOM.randomizeCheckbox?.addEventListener('change', (e) => {
        state.randomizeEnabled = e.target.checked;
    });

    DOM.nsfwCheckbox?.addEventListener('change', (e) => {
        state.nsfwEnabled = e.target.checked;
    });

    DOM.generateBtn?.addEventListener('click', handleGenerate);
    DOM.randomizeBtn?.addEventListener('click', randomizeInputs);
    DOM.clearBtn?.addEventListener('click', clearInputs);

    // Output panel events
    DOM.copyPositiveBtn?.addEventListener('click', () => copyToClipboard(state.positivePrompt));
    DOM.copyNegativeBtn?.addEventListener('click', () => copyToClipboard(state.negativePrompt));
    DOM.savePromptBtn?.addEventListener('click', () => {
        if (!state.positivePrompt) {
            showToast('Please generate a prompt first!');
            return;
        }
        showModal('savePromptModal');
        updateSavePromptModal();
    });
    DOM.regenerateSeedBtn?.addEventListener('click', generateSeed);
    DOM.copySeedBtn?.addEventListener('click', () => copyToClipboard(String(state.seed)));

    // Tab events
    DOM.tabBtns.forEach(btn => {
        btn?.addEventListener('click', () => {
            DOM.tabBtns.forEach(b => b.classList.remove('active'));
            DOM.tabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const panel = document.getElementById(tabId + 'Panel');
            if (panel) panel.classList.add('active');
        });
    });

    // Collections events
    DOM.createCollectionBtn?.addEventListener('click', () => showModal('createCollectionModal'));
    DOM.cancelCollectionBtn?.addEventListener('click', () => hideModal('createCollectionModal'));
    DOM.saveCollectionBtn?.addEventListener('click', createCollectionFromModal);
    DOM.backToCollectionsBtn?.addEventListener('click', showCollectionsList);

    // Templates events
    DOM.templateWorkflowSelect?.addEventListener('change', () => {
        state.workflow = DOM.templateWorkflowSelect.value;
        updateTemplateEditor();
    });
    DOM.saveTemplateBtn?.addEventListener('click', saveTemplate);

    // Settings - Local AI events
    DOM.aiBackend?.addEventListener('change', (e) => {
        state.aiConfig.backend = e.target.value;
    });
    DOM.aiEndpoint?.addEventListener('input', (e) => {
        state.aiConfig.endpoint = e.target.value;
    });
    DOM.aiModel?.addEventListener('input', (e) => {
        state.aiConfig.model = e.target.value;
    });
    DOM.aiApiKey?.addEventListener('input', (e) => {
        state.aiConfig.apiKey = e.target.value;
    });
    DOM.toggleApiKeyBtn?.addEventListener('click', () => {
        if (DOM.aiApiKey) {
            DOM.aiApiKey.type = DOM.aiApiKey.type === 'password' ? 'text' : 'password';
        }
    });
    DOM.aiEnabled?.addEventListener('change', (e) => {
        state.aiConfig.enabled = e.target.checked;
    });
    DOM.testAiConnectionBtn?.addEventListener('click', testAiConnection);

    // Settings - Presets events
    DOM.savePresetsBtn?.addEventListener('click', savePresets);

    // Settings - Data Management events
    DOM.exportDataBtn?.addEventListener('click', exportData);
    DOM.importDataBtn?.addEventListener('click', () => {
        DOM.importFile.click();
    });
    DOM.importFile?.addEventListener('change', handleImportFile);
    DOM.resetDataBtn?.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
            resetAllData();
        }
    });

    // Save prompt modal events
    DOM.cancelSaveBtn?.addEventListener('click', () => hideModal('savePromptModal'));
    DOM.saveToNewCollectionBtn?.addEventListener('click', () => {
        hideModal('savePromptModal');
        showModal('createCollectionModal');
    });
    DOM.confirmSaveBtn?.addEventListener('click', savePromptToCollection);

    // Prompt detail modal events
    DOM.closePromptDetailBtn?.addEventListener('click', () => hideModal('promptDetailModal'));

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

/* ===== Core Functions ===== */

function handleGenerate() {
    // Clear any previous status
    if (DOM.genStatus) {
        DOM.genStatus.hidden = true;
    }

    // If randomize on generate is enabled, randomize first
    if (state.randomizeEnabled) {
        randomizeInputs();
    }

    // If local AI is enabled, use it
    if (state.aiConfig.enabled) {
        connectLocalAI();
    } else {
        generatePrompt();
        setStatus('Template-based prompt generated. Enable Local AI for a detailed cinematic prompt.', 'info');
    }
}

function generatePrompt() {
    if (state.model === 'minimax-h3' && state.workflow !== 'text-to-image') {
        const p = buildH3GeneratorProject();
        state.positivePrompt = StudioCore.prompt(p, 0);
        state.negativePrompt = '';
        state.seed = p.clips[0].seed;
        updateOutput();
        saveToLocalStorage();
        return;
    }
    const workflow = state.workflow;
    const model = state.model;
    const template = state.templates[workflow] || DEFAULT_TEMPLATES[workflow];
    const inputs = state.inputs;

    // Generate positive prompt
    let positivePrompt = template.positive;

    // Replace placeholders
    for (const [key, value] of Object.entries(inputs)) {
        if (value) {
            if (state.weightingEnabled) {
                positivePrompt = positivePrompt.replace(`{${key}}`, `(${value}:${state.weightValue})`);
            } else {
                positivePrompt = positivePrompt.replace(`{${key}}`, value);
            }
        } else {
            positivePrompt = positivePrompt.replace(`{${key}}`, '');
        }
    }

    // Add model-specific terms
    const modelTerms = MODEL_TERMS[model];
    if (modelTerms) {
        positivePrompt += ', ' + modelTerms;
    }

    // Clean up
    positivePrompt = cleanPrompt(positivePrompt);

    // Generate negative prompt
    let negativePrompt = template.negative;

    // Add NSFW terms if NSFW mode is disabled
    if (!state.nsfwEnabled) {
        negativePrompt += ', ' + NSFW_NEGATIVE_TERMS;
    }

    // Clean up
    negativePrompt = cleanPrompt(negativePrompt);

    // Generate seed
    state.seed = Math.floor(Math.random() * 1000000000);

    // Update state
    state.positivePrompt = positivePrompt;
    state.negativePrompt = negativePrompt;

    // Update UI
    updateOutput();
    saveToLocalStorage();
}

function randomizeInputs() {
    const presetMap = {
        'genre': 'genres',
        'mood': 'moods',
        'artStyle': 'artStyles',
        'setting': 'settings',
        'characters': 'characters',
        'colorPalette': 'colorPalettes',
        'cameraAngle': 'cameraAngles',
        'environment': 'environments',
        'action': 'actions',
        'composition': 'compositions'
    };
    INPUT_FIELDS.forEach(field => {
        const presetKey = presetMap[field];
        const values = state.presets[presetKey];
        if (values && values.length > 0) {
            const randomValue = values[Math.floor(Math.random() * values.length)];
            state.inputs[field] = randomValue;
        }
    });
    updateInputForm();
}

function generateSeed() {
    state.seed = Math.floor(Math.random() * 1000000000);
    updateSeed();
}

function clearInputs() {
    state.inputs = {
        genre: '',
        mood: '',
        artStyle: '',
        setting: '',
        characters: '',
        colorPalette: '',
        cameraAngle: '',
        environment: '',
        action: '',
        composition: ''
    };
    state.positivePrompt = '';
    state.negativePrompt = '';
    state.seed = 0;
    updateInputForm();
    updateOutput();
}

function copyToClipboard(text) {
    if (!text) {
        showToast('Nothing to copy!');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
    }).catch(err => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied to clipboard!');
    });
}

/* ===== Collection Management ===== */

function createCollectionFromModal() {
    const name = DOM.collectionNameInput.value.trim();
    if (!name) {
        showToast('Please enter a collection name!');
        return;
    }
    createCollection(name);
    hideModal('createCollectionModal');
    DOM.collectionNameInput.value = '';
}

function createCollection(name) {
    const collection = {
        id: generateId(),
        name: name,
        prompts: [],
        promptIds: [],
        createdAt: new Date().toISOString()
    };
    state.collections.push(collection);
    saveToLocalStorage();
    updateCollectionsList();
}

function updateCollectionsList() {
    if (!DOM.collectionsList) return;

    if (state.collections.length === 0) {
        DOM.collectionsList.innerHTML = '<div class="empty-state">No collections yet. Create one to get started!</div>';
        return;
    }

    DOM.collectionsList.innerHTML = '';
    state.collections.forEach(collection => {
        const div = document.createElement('div');
        div.className = 'collection-item';
        div.innerHTML = `
            <div class="collection-info" data-prompt-action="show">
                <div class="collection-name">${escapeHtml(collection.name)}</div>
                <div class="collection-count">${collection.prompts.length} prompt(s)</div>
            </div>
            <div class="collection-actions">
                <button class="btn btn-small btn-outline" data-prompt-action="delete-collection" title="Delete"></button>
            </div>
        `;
        div.querySelector('[data-prompt-action="show"]').addEventListener('click', () => showCollection(collection.id));
        div.querySelector('[data-prompt-action="delete-collection"]').addEventListener('click', () => deleteCollection(collection.id));
        DOM.collectionsList.appendChild(div);
    });
}

function showCollection(collectionId) {
    const collection = state.collections.find(c => c.id === collectionId);
    if (!collection) return;

    state.currentCollection = collection;
    state.currentCollectionId = collectionId;

    DOM.collectionsList.style.display = 'none';
    DOM.collectionHeader.style.display = 'none';
    DOM.collectionView.style.display = 'block';

    if (DOM.currentCollectionName) {
        DOM.currentCollectionName.textContent = collection.name;
    }

    updateSavedPromptsList();
}

function showCollectionsList() {
    state.currentCollection = null;
    state.currentCollectionId = null;

    DOM.collectionsList.style.display = 'block';
    DOM.collectionHeader.style.display = 'block';
    DOM.collectionView.style.display = 'none';
}

function updateSavedPromptsList() {
    if (!DOM.savedPromptsList || !state.currentCollection) return;

    if (state.currentCollection.prompts.length === 0) {
        DOM.savedPromptsList.innerHTML = '<div class="empty-state">No prompts saved yet.</div>';
        return;
    }

    DOM.savedPromptsList.innerHTML = '';
    state.currentCollection.prompts.forEach(prompt => {
        const div = document.createElement('div');
        div.className = 'saved-prompt-item';
        div.innerHTML = `
            <div class="saved-prompt-header">
                <span class="saved-prompt-workflow">${escapeHtml(prompt.workflow)} <span class="saved-prompt-model">${escapeHtml(prompt.model || '')}</span></span>
                <div class="saved-prompt-actions">
                    <button class="btn btn-small btn-outline" data-prompt-action="copy" title="Copy positive prompt"></button>
                    <button class="btn btn-small btn-outline" data-prompt-action="detail" title="View details"></button>
                    <button class="btn btn-small btn-outline" data-prompt-action="delete-prompt" title="Delete"></button>
                </div>
            </div>
            <div class="saved-prompt-preview">${escapeHtml(truncateText(prompt.positivePrompt, 120))}</div>
            <div class="saved-prompt-seed">Seed: ${escapeHtml(prompt.seed)} • ${escapeHtml(formatDate(prompt.createdAt))}</div>
        `;
        div.querySelector('[data-prompt-action="copy"]').addEventListener('click', () => copySavedPrompt(prompt.id));
        div.querySelector('[data-prompt-action="detail"]').addEventListener('click', () => viewPromptDetail(prompt.id));
        div.querySelector('[data-prompt-action="delete-prompt"]').addEventListener('click', () => deleteSavedPrompt(prompt.id));
        DOM.savedPromptsList.appendChild(div);
    });
}

function copySavedPrompt(promptId) {
    const prompt = findPromptById(promptId);
    if (prompt) {
        copyToClipboard(prompt.positivePrompt);
    }
}

function viewPromptDetail(promptId) {
    const prompt = findPromptById(promptId);
    if (!prompt) return;

    DOM.promptDetailContent.innerHTML = `
        <div class="form-group">
            <label>Positive Prompt</label>
            <textarea class="prompt-textarea" readonly>${escapeHtml(prompt.positivePrompt)}</textarea>
        </div>
        <div class="form-group">
            <label>Negative Prompt</label>
            <textarea class="prompt-textarea" readonly>${escapeHtml(prompt.negativePrompt)}</textarea>
        </div>
        <div class="form-group">
            <label>Workflow</label>
            <div style="color: var(--text-secondary);">${escapeHtml(prompt.workflow)}</div>
        </div>
        <div class="form-group">
            <label>Model</label>
            <div style="color: var(--text-secondary);">${escapeHtml(prompt.model || 'N/A')}</div>
        </div>
        <div class="form-group">
            <label>Seed</label>
            <div style="color: var(--accent); font-family: monospace;">${escapeHtml(prompt.seed)}</div>
        </div>
        <div class="form-group">
            <label>NSFW Mode</label>
            <div style="color: var(--text-secondary);">${prompt.nsfw ? 'Enabled' : 'Disabled'}</div>
        </div>
        <div style="margin-top: 15px; display: flex; gap: 10px;">
            <button class="btn btn-small btn-outline" id="detailCopyPositive"> Copy Positive</button>
            <button class="btn btn-small btn-outline" id="detailCopyNegative"> Copy Negative</button>
            <button class="btn btn-small btn-outline" id="detailCopySeed"> Copy Seed</button>
        </div>
    `;

    setTimeout(() => {
        document.getElementById('detailCopyPositive')?.addEventListener('click', () => copyToClipboard(prompt.positivePrompt));
        document.getElementById('detailCopyNegative')?.addEventListener('click', () => copyToClipboard(prompt.negativePrompt));
        document.getElementById('detailCopySeed')?.addEventListener('click', () => copyToClipboard(String(prompt.seed)));
    }, 0);

    showModal('promptDetailModal');
}

function findPromptById(promptId) {
    for (const collection of state.collections) {
        const prompt = collection.prompts.find(p => p.id === promptId);
        if (prompt) return prompt;
    }
    return null;
}

function deleteSavedPrompt(promptId) {
    if (!confirm('Delete this saved prompt?')) return;

    for (const collection of state.collections) {
        const index = collection.prompts.findIndex(p => p.id === promptId);
        if (index !== -1) {
            collection.prompts.splice(index, 1);
            collection.promptIds.splice(index, 1);
            break;
        }
    }
    saveToLocalStorage();
    updateSavedPromptsList();
}

function deleteCollection(collectionId) {
    if (!confirm('Delete this collection? All prompts in it will be lost.')) return;

    state.collections = state.collections.filter(c => c.id !== collectionId);
    if (state.currentCollectionId === collectionId) {
        showCollectionsList();
    }
    saveToLocalStorage();
    updateCollectionsList();
}

/* ===== Save Prompt Flow ===== */

function updateSavePromptModal() {
    if (!DOM.saveToCollectionSelect) return;

    DOM.saveToCollectionSelect.innerHTML = '';
    if (state.collections.length === 0) {
        DOM.saveToCollectionSelect.innerHTML = '<option value="">No collections - create one first</option>';
    } else {
        state.collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = collection.name;
            DOM.saveToCollectionSelect.appendChild(option);
        });
    }
}

function savePromptToCollection() {
    const collectionId = DOM.saveToCollectionSelect.value;
    if (!collectionId) {
        showToast('Please select or create a collection!');
        return;
    }

    const collection = state.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const entry = {
        id: generateId(),
        workflow: state.workflow,
        model: state.model,
        inputs: { ...state.inputs },
        positivePrompt: state.positivePrompt,
        negativePrompt: state.negativePrompt,
        seed: state.seed,
        nsfw: state.nsfwEnabled,
        weighting: state.weightingEnabled,
        createdAt: new Date().toISOString()
    };

    collection.prompts.push(entry);
    collection.promptIds.push(entry.id);

    saveToLocalStorage();
    hideModal('savePromptModal');
    showToast('Prompt saved!');

    // If we're viewing a collection, update the list
    if (state.currentCollectionId === collectionId) {
        updateSavedPromptsList();
    }
}

/* ===== Template Management ===== */

function updateTemplateEditor() {
    const workflow = DOM.templateWorkflowSelect?.value || state.workflow;
    const template = state.templates[workflow] || DEFAULT_TEMPLATES[workflow];

    if (DOM.positiveTemplate) {
        DOM.positiveTemplate.value = template.positive;
    }
    if (DOM.negativeTemplate) {
        DOM.negativeTemplate.value = template.negative;
    }
}

function saveTemplate() {
    const workflow = DOM.templateWorkflowSelect?.value || state.workflow;
    const positive = DOM.positiveTemplate?.value || '';
    const negative = DOM.negativeTemplate?.value || '';

    state.templates[workflow] = {
        positive: positive,
        negative: negative
    };

    saveToLocalStorage();
    showToast('Template saved!');
}

/* ===== Preset Management ===== */

function updatePresetEditor() {
    if (DOM.presetGenres) DOM.presetGenres.value = (state.presets.genres || []).join(', ');
    if (DOM.presetMoods) DOM.presetMoods.value = (state.presets.moods || []).join(', ');
    if (DOM.presetArtStyles) DOM.presetArtStyles.value = (state.presets.artStyles || []).join(', ');
    if (DOM.presetSettings) DOM.presetSettings.value = (state.presets.settings || []).join(', ');
    if (DOM.presetCharacters) DOM.presetCharacters.value = (state.presets.characters || []).join(', ');
    if (DOM.presetColors) DOM.presetColors.value = (state.presets.colorPalettes || []).join(', ');
    if (DOM.presetCameraAngles) DOM.presetCameraAngles.value = (state.presets.cameraAngles || []).join(', ');
    if (DOM.presetEnvironments) DOM.presetEnvironments.value = (state.presets.environments || []).join(', ');
    if (DOM.presetActions) DOM.presetActions.value = (state.presets.actions || []).join(', ');
    if (DOM.presetCompositions) DOM.presetCompositions.value = (state.presets.compositions || []).join(', ');
}

function savePresets() {
    state.presets = {
        genres: parsePresets(DOM.presetGenres?.value),
        moods: parsePresets(DOM.presetMoods?.value),
        artStyles: parsePresets(DOM.presetArtStyles?.value),
        settings: parsePresets(DOM.presetSettings?.value),
        characters: parsePresets(DOM.presetCharacters?.value),
        colorPalettes: parsePresets(DOM.presetColors?.value),
        cameraAngles: parsePresets(DOM.presetCameraAngles?.value),
        environments: parsePresets(DOM.presetEnvironments?.value),
        actions: parsePresets(DOM.presetActions?.value),
        compositions: parsePresets(DOM.presetCompositions?.value)
    };
    saveToLocalStorage();
    showToast('Presets saved!');
}

/* ===== Local AI Connection ===== */

function buildH3GeneratorProject() {
    const p = StudioCore.project();
    p.duration = Math.max(4, Math.min(15, Number(document.getElementById('generatorDuration')?.value) || 10));
    p.aspect = document.getElementById('generatorAspect')?.value || '16:9';
    p.nsfw = state.nsfwEnabled;
    p.style = [state.inputs.artStyle, state.inputs.genre, state.inputs.mood, state.inputs.colorPalette, state.inputs.composition].filter(Boolean).join(', ') || p.style;
    p.setting = [state.inputs.setting, state.inputs.environment].filter(Boolean).join('. ');
    p.camera = state.inputs.cameraAngle || p.camera;
    if (state.inputs.characters) p.characters.push({name: 'Main subject', description: state.inputs.characters, voice: ''});
    const c = StudioCore.clip();
    c.duration = p.duration;
    c.beat = state.inputs.action || 'The subject moves naturally within the scene';
    c.start = state.workflow === 'image-to-video' ? 'Preserve the actual supplied starting image and develop the action forward from it' : 'Establish the subjects in the scene';
    c.end = 'Reach a natural continuation of the action without an abrupt stop';
    if (state.workflow === 'image-to-video') c.startAsset = 'user-supplied-image';
    p.clips = [c];
    return p;
}

function buildSystemPrompt() {
    if (state.model === 'minimax-h3' && state.workflow !== 'text-to-image') {
        const p = buildH3GeneratorProject();
        return `Write a detailed MiniMax H3 audiovisual prompt for a ${p.duration}-second ${p.aspect} video. Use the structure and intent in this draft: ${StudioCore.prompt(p, 0)}\nKeep a single continuous shot unless the user explicitly asks for cuts. Use natural camera movement, consistent character identity, visible action and synchronized sound. Preserve any supplied first image. Do not invent reference assets or output a negative prompt or seed. Return only the finished prompt.`;
    }
    const isVideo = state.workflow === 'text-to-video' || state.workflow === 'image-to-video';

    const commonInputs = `
Input details:
- Workflow: ${state.workflow}
- Genre: ${state.inputs.genre || 'N/A'}
- Mood: ${state.inputs.mood || 'N/A'}
- Art Style: ${state.inputs.artStyle || 'N/A'}
- Setting: ${state.inputs.setting || 'N/A'}
- Characters: ${state.inputs.characters || 'N/A'}
- Color Palette: ${state.inputs.colorPalette || 'N/A'}
- Camera Angle: ${state.inputs.cameraAngle || 'N/A'}
- Environment: ${state.inputs.environment || 'N/A'}
- Action/Movement: ${state.inputs.action || 'N/A'}
- Composition: ${state.inputs.composition || 'N/A'}
- NSFW Mode: ${state.nsfwEnabled ? 'enabled' : 'disabled'}`;

    if (isVideo) {
        return `You are a professional cinematic prompt writer for AI video generation (model: ${state.model}). Generate a highly detailed, production-quality video prompt for the given workflow and inputs. Your output must be rich, specific, and shot-by-shot.

Structure your output EXACTLY with these labeled sections:

subject_definitions:
Define each subject in extreme detail. <Subject 1> is the primary subject (the character/creature from the inputs): describe their appearance, materials, clothing, equipment, and expression in full physical detail. <Subject 2> is the primary environment/setting: describe its architecture, atmosphere, lighting, and physical properties. Keep each subject numbered and distinct.

summary:
[reference generation] A concise but complete summary: total duration, aspect ratio, genre, and a high-level action throughline that references <Subject 1> and <Subject 2>.

retention_analysis:
List each subject followed by the shots they appear in (e.g. appears in [Shot 1], [Shot 2], [Shot 3]). State that each is fully_preserved, then list the visual properties that must remain strictly consistent (morphology, materials, proportions, lighting, color palette, directional vector).

detailed_description:
Open with the overall style and cinematography: photorealism, aspect ratio, lens rendering (e.g. anamorphic streak flares), shutter speed, depth of field, and atmospheric/water interaction. Then provide [Shot 1], [Shot 2], [Shot 3] each with a timestamp range (e.g. 0.0s - 3.5s) and a rich paragraph describing: exact subject position and action moment by moment, camera movement (track/orbit amplitude, speed, angle), environmental parallax, lighting/holographic/atmospheric effects, and diegetic sound. Break the action into 3 distinct shots across the total duration.

overall_soundscape:
Describe the full audio arc across all shots: the movement, impacts, ambience, and how layered sounds transition.

non_diegetic_music:
Describe the musical score: genre, key instruments, tempo changes, and how it builds tension (e.g. accelerates during descent, drops on the final impact).

Do NOT output a separate negative prompt or a SEED. Only output the structured sections above.
${commonInputs}`;
    }

    // text-to-image
    return `You are a professional prompt writer for AI image generation (model: ${state.model}). Generate a single, highly detailed, production-quality image prompt for the given workflow and inputs. Your output must be rich and specific.

Structure your output EXACTLY with these labeled sections:

subject_definitions:
Define each subject in extreme detail. <Subject 1> is the primary subject (the character/creature from the inputs): appearance, materials, clothing, expression, pose. <Subject 2> is the environment: setting, architecture, atmosphere, lighting, physical detail.

summary:
[reference generation] A single rich sentence describing the full scene: subject, action, environment, mood, style.

detailed_description:
Start with the overall style and quality (photorealistic/cinematic, aspect ratio, lens, depth of field, lighting descriptors such as golden hour, volumetric, chiaroscuro). Then describe the composition in detail: specific camera angle and framing, subject placement, environment detail, the action/movement frozen in the frame, and how the color palette is applied.

overall_visual_style:
List the artistic and quality descriptors as comma-separated tags (e.g. masterpiece, 8k, ultra-detailed, HDR, sharp focus, detailed background, cinematic lighting).

Do NOT output a negative prompt or a SEED. Only output the structured sections above.
${commonInputs}`;
}

async function connectLocalAI() {
    const config = state.aiConfig;
    if (config.backend === 'comfyui') {
        setStatus('ComfyUI requires an API workflow, not a text request. Use Film studio → ComfyUI to import and map your workflow.', 'error');
        return;
    }
    if (!config.enabled || !config.endpoint) {
        showToast('Local AI not configured');
        return;
    }

    // Normalize endpoint: auto-append /chat/completions if it ends with /v1
    let endpoint = config.endpoint;
    if (endpoint.endsWith('/v1')) {
        endpoint = endpoint + '/chat/completions';
    } else if (endpoint.endsWith('/v1/')) {
        endpoint = endpoint + 'chat/completions';
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt();

    setStatus('Generating detailed prompt via local AI...', 'info');
    const originalBtnText = DOM.generateBtn?.textContent;
    if (DOM.generateBtn) {
        DOM.generateBtn.disabled = true;
        DOM.generateBtn.textContent = '⏳ Generating...';
    }

    try {
        let content = '';

        if (config.backend === 'openai') {
            const headers = { 'Content-Type': 'application/json' };
            if (config.apiKey) {
                headers['Authorization'] = 'Bearer ' + config.apiKey;
            }
            const response = await LocalAI.fetchChat(config, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: 'Generate the detailed prompt based on the above details.' }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                let errorBody = '';
                try {
                    const errData = await response.json();
                    errorBody = JSON.stringify(errData);
                } catch (e) {
                    errorBody = await response.text().catch(() => '');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${errorBody}`);
            }

            const data = await response.json();
            content = data.choices?.[0]?.message?.content || '';
        } else if (config.backend === 'comfyui') {
            const headers = { 'Content-Type': 'application/json' };
            if (config.apiKey) {
                headers['Authorization'] = 'Bearer ' + config.apiKey;
            }
            const response = await LocalAI.fetchChat(config, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    prompt: systemPrompt
                })
            });

            if (!response.ok) {
                let errorBody = '';
                try {
                    const errData = await response.json();
                    errorBody = JSON.stringify(errData);
                } catch (e) {
                    errorBody = await response.text().catch(() => '');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${errorBody}`);
            }

            const data = await response.json();
            content = data.response || data.output || JSON.stringify(data);
        }

        if (!content) {
            throw new Error('Empty response from AI. Check model name and endpoint.');
        }

        // Strip markdown code fences if the model wrapped the output
        content = content.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();

        if (!content) {
            throw new Error('AI returned an empty response.');
        }

        parseLocalAIResponse(content);
        setStatus(' Detailed prompt generated. Copy from the Positive Prompt box.', 'success');
        showToast('Prompt generated via local AI!');
    } catch (error) {
        const isNetwork = error instanceof TypeError && error.message === 'Failed to fetch';
        let msg = 'Local AI error: ' + error.message;
        if (isNetwork) {
            msg += '\n\nPossible causes:\n' +
                '1. The AI server (' + endpoint + ') is unreachable or not running.\n' +
                '2. CORS — the AI server must allow cross-origin requests. Serve the app via a local server (python3 -m http.server) instead of file://, and ensure the AI server sends Access-Control-Allow-Origin headers.\n' +
                '3. Wrong endpoint/port.';
        }
        setStatus(msg, 'error');
        showToast('Local AI error: ' + error.message);
    } finally {
        if (DOM.generateBtn) {
            DOM.generateBtn.disabled = false;
            DOM.generateBtn.textContent = originalBtnText || ' Generate Prompt';
        }
    }
}

function parseLocalAIResponse(content) {
    const trimmed = content.trim();

    // Extract seed if the model included one
    const seedMatch = trimmed.match(/SEED:\s*(\d+)/);
    if (seedMatch) {
        state.seed = parseInt(seedMatch[1]);
    }

    // Store the full structured prompt as the positive prompt
    state.positivePrompt = trimmed;

    // Generate a brief negative prompt for image workflows
    const isVideo = state.workflow === 'text-to-video' || state.workflow === 'image-to-video';
    if (isVideo) {
        state.negativePrompt = '';
    } else {
        state.negativePrompt = 'low quality, blurry, deformed, distorted, ugly, disfigured, extra limbs, missing limbs, bad anatomy, watermark, text, signature' +
            (state.nsfwEnabled ? '' : ', ' + NSFW_NEGATIVE_TERMS);
    }

    updateOutput();
    saveToLocalStorage();
}

async function testAiConnection() {
    const config = state.aiConfig;
    if (!config.endpoint) {
        showToast('Please enter an API endpoint');
        return;
    }

    // Normalize endpoint: auto-append /chat/completions if it ends with /v1
    let endpoint = config.endpoint;
    if (endpoint.endsWith('/v1')) {
        endpoint = endpoint + '/chat/completions';
    } else if (endpoint.endsWith('/v1/')) {
        endpoint = endpoint + 'chat/completions';
    }

    DOM.testAiConnectionBtn.textContent = ' Testing...';
    DOM.testAiConnectionBtn.disabled = true;

    try {
        if (config.backend === 'openai') {
            const headers = { 'Content-Type': 'application/json' };
            if (config.apiKey) {
                headers['Authorization'] = 'Bearer ' + config.apiKey;
            }
            const response = await LocalAI.fetchChat(config, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 10
                })
            });

            if (response.ok) {
                showToast('Connection successful!');
            } else {
                let errorBody = '';
                try {
                    const errData = await response.json();
                    errorBody = JSON.stringify(errData);
                } catch (e) {
                    errorBody = await response.text().catch(() => '');
                }
                showToast(`Connection failed: HTTP ${response.status}. ${errorBody}`);
            }
        } else {
            showToast('Use Film studio → ComfyUI to test the render server and map a workflow.');
        }
    } catch (error) {
        showToast('Connection failed: ' + error.message);
    }

    DOM.testAiConnectionBtn.textContent = ' Test Connection';
    DOM.testAiConnectionBtn.disabled = false;
}

/* ===== Model Tips ===== */

function updateModelTips() {
    const model = state.model;
    const tips = MODEL_TIPS[model] || '';

    if (DOM.modelTips) {
        DOM.modelTips.innerHTML = `<strong>Tip:</strong> ${tips}`;
    }
}

/* ===== UI Update Functions ===== */

function updateInputForm() {
    INPUT_FIELDS.forEach(field => {
        const el = document.getElementById(field);
        if (el) el.value = state.inputs[field] || '';
    });

    if (DOM.weightingCheckbox) DOM.weightingCheckbox.checked = state.weightingEnabled;
    if (DOM.randomizeCheckbox) DOM.randomizeCheckbox.checked = state.randomizeEnabled;
    if (DOM.nsfwCheckbox) DOM.nsfwCheckbox.checked = state.nsfwEnabled;
    if (DOM.workflowSelect) DOM.workflowSelect.value = state.workflow;
    if (DOM.modelSelect) DOM.modelSelect.value = state.model;
}

function updateOutput() {
    if (DOM.positivePrompt) DOM.positivePrompt.value = state.positivePrompt;
    if (DOM.negativePrompt) DOM.negativePrompt.value = state.negativePrompt;
    updateSeed();
}

function updateSeed() {
    if (DOM.seedValue) DOM.seedValue.textContent = state.seed;
}

function updateAllUI() {
    updateInputForm();
    updateOutput();
    updateModelTips();
    updateTemplateEditor();
    updatePresetEditor();
    updateCollectionsList();
    updateSettingsPanel();
}

function updateSettingsPanel() {
    if (DOM.aiBackend) DOM.aiBackend.value = state.aiConfig.backend;
    if (DOM.aiEndpoint) DOM.aiEndpoint.value = state.aiConfig.endpoint;
    if (DOM.aiModel) DOM.aiModel.value = state.aiConfig.model;
    if (DOM.aiApiKey) DOM.aiApiKey.value = state.aiConfig.apiKey || '';
    if (DOM.aiEnabled) DOM.aiEnabled.checked = state.aiConfig.enabled;
}

/* ===== Modal Functions ===== */

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/* ===== Data Management ===== */

function exportData() {
    const data = {
        collections: state.collections,
        templates: state.templates,
        presets: state.presets,
        aiConfig: { ...state.aiConfig, apiKey: '' },
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comfyui-prompt-generator-data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!');
}

function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);

            if (data.collections) state.collections = data.collections;
            if (data.templates) state.templates = data.templates;
            if (data.presets) state.presets = data.presets;
            if (data.aiConfig) state.aiConfig = { ...state.aiConfig, ...data.aiConfig, apiKey: '' };

            saveToLocalStorage();
            updateAllUI();
            showToast('Data imported!');
        } catch (error) {
            showToast('Import failed: Invalid JSON file');
        }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
}

function resetAllData() {
    state.collections = [];
    state.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    state.presets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    state.aiConfig = {
        backend: 'openai',
        endpoint: 'http://127.0.0.1:8000/v1',
        model: '',
        apiKey: '',
        enabled: false
    };
    state.inputs = {
        genre: '',
        mood: '',
        artStyle: '',
        setting: '',
        characters: '',
        colorPalette: ''
    };
    state.positivePrompt = '';
    state.negativePrompt = '';
    state.seed = 0;
    state.currentCollection = null;
    state.currentCollectionId = null;

    localStorage.removeItem('comfyui-prompt-generator');
    updateAllUI();
    showToast('All data reset!');
}

/* ===== Storage Functions ===== */

function saveToLocalStorage() {
    try {
        localStorage.setItem('comfyui-prompt-generator', JSON.stringify({...state,aiConfig:{...state.aiConfig,apiKey:''}}));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('comfyui-prompt-generator');
        if (saved) {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed, aiConfig: { ...state.aiConfig, ...parsed.aiConfig, apiKey: '' } };
            state.currentCollection = null;
            state.currentCollectionId = null;
        }
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
    }
}

/* ===== Utility Functions ===== */

function cleanPrompt(text) {
    // Remove extra commas and spaces
    text = text.replace(/,\s*,/g, ',');
    text = text.replace(/^\s*,\s*/g, '');
    text = text.replace(/\s*,\s*$/g, '');
    text = text.replace(/\s+/g, ' ');
    return text.trim();
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleString();
    } catch (e) {
        return dateString;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function parsePresets(text) {
    return text.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

function setStatus(message, type) {
    if (!DOM.genStatus) return;
    DOM.genStatus.hidden = false;
    DOM.genStatus.className = 'gen-status ' + (type || 'info');
    DOM.genStatus.textContent = message;
}

/* ===== Global Functions (for inline onclick) ===== */

window.showCollection = showCollection;
window.deleteCollection = deleteCollection;
window.copySavedPrompt = copySavedPrompt;
window.viewPromptDetail = viewPromptDetail;
window.deleteSavedPrompt = deleteSavedPrompt;
window.copyToClipboard = copyToClipboard;

/* ===== Initialize ===== */

document.addEventListener('DOMContentLoaded', init);
