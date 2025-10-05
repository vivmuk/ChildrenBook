const axios = require('axios');

const VENICE_API_KEY = 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';
const {
    SAFE_IMAGE_MODEL_IDS,
    isAllowedImageModel,
} = require('../../safety-config');

exports.handler = async function (event, context) {
    // Add CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const textModelPromise = axios.get('https://api.venice.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            params: { type: 'text' }
        });

        const imageModelPromise = axios.get('https://api.venice.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            params: { type: 'image' }
        });

        const [textResponse, imageResponse] = await Promise.all([textModelPromise, imageModelPromise]);

        const textModels = textResponse.data.data.filter(m => m.model_spec && !m.model_spec.offline);
        const availableSafeModels = imageResponse.data.data.filter(
            m => m.model_spec && !m.model_spec.offline && isAllowedImageModel(m.id)
        );
        const imageModels = SAFE_IMAGE_MODEL_IDS
            .map(id => availableSafeModels.find(model => model.id === id))
            .filter(Boolean);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ textModels, imageModels }),
        };
    } catch (error) {
        console.error("Failed to fetch models:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Could not fetch models from Venice.ai" }),
        };
    }
}; 