const axios = require('axios');

const VENICE_API_KEY = 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';

exports.handler = async function (event, context) {
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
        const imageModels = imageResponse.data.data.filter(m => m.model_spec && !m.model_spec.offline);

        return {
            statusCode: 200,
            body: JSON.stringify({ textModels, imageModels }),
        };
    } catch (error) {
        console.error("Failed to fetch models:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Could not fetch models from Venice.ai" }),
        };
    }
}; 