const SAFE_IMAGE_MODELS = Object.freeze({
    'qwen-image': {
        promptCharacterLimit: 1400,
        label: 'Qwen Image',
    },
    'venice-sd35': {
        promptCharacterLimit: 1400,
        label: 'Venice SD35',
    },
    'hidream': {
        promptCharacterLimit: 1400,
        label: 'HiDream',
    },
});

const SAFE_IMAGE_MODEL_IDS = Object.freeze(Object.keys(SAFE_IMAGE_MODELS));

const SAFE_IMAGE_MODEL_SET = new Set(SAFE_IMAGE_MODEL_IDS);
const DEFAULT_SAFE_IMAGE_MODEL = 'qwen-image'; // Set Qwen Image as default
const DEFAULT_PROMPT_CHARACTER_LIMIT = SAFE_IMAGE_MODEL_IDS.reduce((limit, modelId) => {
    const modelLimit = SAFE_IMAGE_MODELS[modelId]?.promptCharacterLimit || limit;
    return Math.min(limit, modelLimit);
}, Infinity);

function normalizeModelId(modelId) {
    return typeof modelId === 'string' ? modelId.trim() : '';
}

function isAllowedImageModel(modelId) {
    const normalized = normalizeModelId(modelId);
    return SAFE_IMAGE_MODEL_SET.has(normalized);
}

function enforceSafeImageModel(modelId) {
    return isAllowedImageModel(modelId) ? normalizeModelId(modelId) : DEFAULT_SAFE_IMAGE_MODEL;
}

function buildSafeImagePayload(payload = {}, requestedModelId) {
    const safeModel = enforceSafeImageModel(requestedModelId);
    return {
        ...payload,
        model: safeModel,
        safe_mode: true,
        hide_watermark: false, // keep watermark visible on every generated image
    };
}

function getPromptCharacterLimit(modelId) {
    const normalized = normalizeModelId(modelId);
    const configuredLimit = SAFE_IMAGE_MODELS[normalized]?.promptCharacterLimit;
    if (typeof configuredLimit === 'number' && Number.isFinite(configuredLimit)) {
        return configuredLimit;
    }
    return Number.isFinite(DEFAULT_PROMPT_CHARACTER_LIMIT)
        ? DEFAULT_PROMPT_CHARACTER_LIMIT
        : 1400;
}

module.exports = {
    SAFE_IMAGE_MODELS,
    SAFE_IMAGE_MODEL_IDS,
    SAFE_IMAGE_MODEL_SET,
    DEFAULT_SAFE_IMAGE_MODEL,
    isAllowedImageModel,
    enforceSafeImageModel,
    buildSafeImagePayload,
    getPromptCharacterLimit,
};
