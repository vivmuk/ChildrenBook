const SAFE_IMAGE_MODEL_IDS = Object.freeze([
    'venice-sd35',
    'hidream',
    'flux-dev',
    'qwen-image',
    'wai-Illustrious',
]);

const SAFE_IMAGE_MODEL_SET = new Set(SAFE_IMAGE_MODEL_IDS);
const DEFAULT_SAFE_IMAGE_MODEL = SAFE_IMAGE_MODEL_IDS[0];

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
        hide_watermark: false,
    };
}

module.exports = {
    SAFE_IMAGE_MODEL_IDS,
    SAFE_IMAGE_MODEL_SET,
    DEFAULT_SAFE_IMAGE_MODEL,
    isAllowedImageModel,
    enforceSafeImageModel,
    buildSafeImagePayload,
};
