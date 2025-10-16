const axios = require('axios');

const VENICE_API_KEY = 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';
const {
    isAllowedImageModel,
    enforceSafeImageModel,
    buildSafeImagePayload,
} = require('../../safety-config');

/**
 * Generate structured image prompt with style, characters, and scene
 */
async function generateStructuredImagePrompt(text, artStyle, characterDescription, isCover, title) {
    const styleDescriptions = {
        'Studio Ghibli': 'lush hand-painted backgrounds, soft watercolor textures, dreamlike lighting, nostalgic and whimsical atmosphere, rich environmental details, gentle character designs',
        'Hayao Miyazaki style': 'magical realism, detailed natural landscapes, expressive character animation, ethereal lighting, organic flowing forms, sense of wonder and adventure',
        'Midcentury American cartoon': 'bold flat colors, clean geometric shapes, limited animation style, retro 1950s-60s aesthetic, simple but expressive characters, minimalist backgrounds',
        'Amar Chitra Katha': 'traditional Indian comic book style, vibrant colors, detailed cultural costumes, narrative panel composition, mythological or historical elements, expressive faces',
        'Chacha Chaudhary': 'simple line art, bold outlines, bright primary colors, comic book panels, expressive cartoon characters, Indian cultural context, humorous visual storytelling',
        'xkcd Comics': 'minimalist stick figure art, simple black line drawings on white background, clever visual metaphors, clean geometric shapes, focus on ideas over detail',
        'Old cartoon': 'vintage 1930s-40s animation style, rubber hose animation, pie-cut eyes, exaggerated expressions, hand-drawn cel animation aesthetic, grainy nostalgic quality',
        'Indian Warli art': 'tribal geometric patterns, white figures on earthy background, stick figure humans and animals, repetitive circular and triangular motifs, folk art simplicity, cultural storytelling'
    };

    const styleDesc = styleDescriptions[artStyle] || styleDescriptions['Studio Ghibli'];
    
    const systemPrompt = `You are an expert art director creating ${isCover ? 'cover' : 'page'} illustrations for a world-class children's book in the "${artStyle}" style.

Create a structured JSON prompt with three components:
1. "style": Detailed visual style incorporating: ${styleDesc}
2. "characters": Precise character descriptions. ALWAYS include: "${characterDescription}"
3. "scene": Setting, composition, mood, lighting, and action

Return ONLY valid JSON with keys: style, characters, scene.`;

    const userPrompt = isCover 
        ? `Create book cover for "${title}": ${text}`
        : `Create illustration for: ${text}`;

    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model: 'mistral-31-24b',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
    }, { 
        headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
        timeout: 20000
    });

    return JSON.parse(response.data.choices[0].message.content);
}

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

        // Generate structured prompt
        const structuredPrompt = await generateStructuredImagePrompt(
            text,
            artStyle,
            characterDescription || 'a friendly children\'s book character',
            isCover || false,
            title || 'Story'
        );

        // Combine into final prompt with 1400 character limit
        const promptLimit = 1400;
        let fullPrompt = `Style: ${structuredPrompt.style}. Characters: ${structuredPrompt.characters}. Scene: ${structuredPrompt.scene}`;
        
        if (fullPrompt.length > promptLimit) {
            console.log(`Truncating prompt from ${fullPrompt.length} to ${promptLimit} chars`);
            fullPrompt = fullPrompt.substring(0, promptLimit);
        }

        // Generate image
        const size = isCover ? "1792x1024" : "1024x1024";
        const safeModel = enforceSafeImageModel(imageModel);
        const payload = buildSafeImagePayload({
            prompt: fullPrompt,
            n: 1,
            size,
            response_format: 'url',
        }, safeModel);

        const imageResponse = await axios.post('https://api.venice.ai/api/v1/images/generations', payload, {
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            timeout: 30000
        });

        const imageUrl = imageResponse.data.data[0].url;
        console.log('Image generated successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ imageUrl, structuredPrompt, finalPrompt: fullPrompt }),
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