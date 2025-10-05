const axios = require('axios');

const VENICE_API_KEY = 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';
const {
    isAllowedImageModel,
    enforceSafeImageModel,
    buildSafeImagePayload,
} = require('../../safety-config');

exports.handler = async function (event, context) {
    // Add CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        console.log('Image generation started');
        
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is required.' }) };
        }

        const { text, artStyle, imageModel, characterDescription, isCover, title } = JSON.parse(event.body);

        if (!text) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text is required for image generation.' }) };
        }

        if (!isAllowedImageModel(imageModel)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please select a permitted safe Venice.ai image model.' }) };
        }

        // Generate image prompt
        const promptLimit = imageModel && imageModel.includes('flux') ? 2000 : 1400;
        let imagePromptSystem;
        
        if (isCover) {
            imagePromptSystem = `You are an expert art director creating a book cover illustration. Create a rich, detailed, and imaginative image prompt for an AI model. The prompt must generate a vibrant, friendly, and colorful book cover in a playful cartoon style. Focus on the title "${title}" and make it visually appealing. The requested art style is a suggestion, but the final image MUST be a cartoon. The main character MUST match this description: "${characterDescription}". Art Style: ${artStyle}.`;
        } else {
            imagePromptSystem = `You are an expert art director creating illustrations for a children's book. Create a rich, detailed, and imaginative image prompt for an AI model. The prompt must generate a vibrant, friendly, and colorful image in a playful cartoon style. It should capture the essence of the following text. Focus on scene, characters, emotion, and lighting. The final output should be a single, descriptive paragraph. The requested art style is a suggestion, but the final image MUST be a cartoon. The main character MUST match this description: "${characterDescription}". Art Style: ${artStyle}.`;
        }

        if (artStyle.toLowerCase().includes('ghibli')) {
            imagePromptSystem = `You are an expert art director specializing in the Studio Ghibli aesthetic for a children's book. Create a rich, detailed, and imaginative image prompt that captures the provided text in a playful cartoon style inspired by Ghibli. Emphasize lush, painterly backgrounds, whimsical scenery, and the interplay of light and nature. The final image MUST be a cartoon that evokes the feeling of a Ghibli film. The final output must be a single, descriptive paragraph. Art Style: ${artStyle}. The main character MUST match this description: "${characterDescription}".`;
        }

        const promptGenResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'mistral-31-24b',
            messages: [{ role: 'system', content: imagePromptSystem }, { role: 'user', content: `Text: "${text}"` }]
        }, { 
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            timeout: 15000
        });

        let imagePrompt = promptGenResponse.data.choices[0].message.content;
        if (imagePrompt.length > promptLimit) {
            console.log(`Truncating long image prompt to ${promptLimit} chars...`);
            imagePrompt = imagePrompt.substring(0, promptLimit);
        }

        // Generate the actual image
        const size = isCover ? "1792x1024" : "1024x1024";
        const safeModel = enforceSafeImageModel(imageModel);
        const payload = buildSafeImagePayload({
            prompt: imagePrompt,
            n: 1,
            size,
            response_format: 'url',
        }, safeModel);

        const imageResponse = await axios.post('https://api.venice.ai/api/v1/images/generations', payload, {
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            timeout: 20000
        });

        const imageUrl = imageResponse.data.data[0].url;
        console.log('Image generated successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ imageUrl, imagePrompt }),
        };

    } catch (error) {
        console.error('Error generating image:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate image.', details: error.message }),
        };
    }
}; 