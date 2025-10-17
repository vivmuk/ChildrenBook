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
    // Detailed style specifications matching story.js
    const styleDescriptions = {
        'Studio Ghibli': `AUTHENTIC Studio Ghibli animation style: soft watercolor painted backgrounds with incredible depth, gentle hand-painted textures, characters with large expressive eyes and rosy cheeks, flowing natural hair movement, detailed clothing folds, warm golden lighting filtering through scenes, lush environmental details (grass blades, tree leaves, clouds), nostalgic peaceful atmosphere, painterly brushstrokes visible, color palette of soft pastels with rich accent colors, characters integrated naturally into detailed backgrounds, dreamlike quality reminiscent of My Neighbor Totoro, Spirited Away, and Kiki's Delivery Service`,
        
        'Hayao Miyazaki style': `Hayao Miyazaki's distinctive animation aesthetic: incredibly detailed natural environments (forests, meadows, skies), magical realism elements seamlessly integrated, characters with expressive large eyes and gentle features, dynamic cloud formations, glowing atmospheric lighting, sense of movement in hair and clothing, organic flowing shapes, rich color gradients, hand-painted watercolor backgrounds, depth through multiple layers, whimsical yet grounded character designs, environmental storytelling through background details, sense of wonder and adventure`,
        
        'Midcentury American cartoon': `1950s-60s midcentury American cartoon style: bold flat colors without gradients, clean geometric simplified shapes, limited color palette (primary colors dominant), thick black outlines around all elements, minimalist backgrounds with simple patterns, characters with simple rounded features, retro typography influences, sharp angular design elements, vintage advertising aesthetic, Chuck Jones / UPA animation influence, stylized proportions, graphic design sensibility`,
        
        'Amar Chitra Katha': `Traditional Indian Amar Chitra Katha comic book illustration style: vibrant saturated colors, detailed traditional Indian clothing (saris, dhotis, jewelry), expressive faces with defined features, narrative comic panel composition, cultural and mythological visual elements, decorative borders and patterns, rich skin tones, detailed architecture (temples, palaces), dramatic poses and gestures, clear linework with color fills, educational illustration quality, authentic Indian cultural representation`,
        
        'Chacha Chaudhary': `Chacha Chaudhary Indian comic style: simple bold line art, thick black outlines, bright primary colors (red, yellow, blue), comic book panel layout, expressive cartoon faces with exaggerated features, simple backgrounds, Indian cultural elements (turbans, traditional clothing, Indian settings), humorous visual storytelling, clear readable compositions, cartoon proportions, retro Indian comic aesthetic from the 1970s-80s`,
        
        'xkcd Comics': `xkcd minimalist stick figure comic style: extremely simple black line drawings on pure white background, stick figure characters made of basic lines and circles, no color except black lines, no shading or gradients, clean geometric shapes, clever visual metaphors, mathematical or scientific diagram influence, minimalist environment suggestions, focus on ideas and concepts over visual detail, Randall Munroe's distinctive simple aesthetic`,
        
        'Old cartoon': `Vintage 1930s-1940s classic animation style: rubber hose animation limbs (bendy, flowing), pie-cut eyes (wedge-shaped), white gloves on hands, exaggerated expressions and movements, grainy film texture, limited color palette (sepia tones or early Technicolor), hand-drawn cel animation aesthetic with visible ink lines, bouncy personality poses, vintage cartoon physics, classic Disney/Fleischer Studios influence, nostalgic aged appearance`,
        
        'Indian Warli art': `Authentic Indian Warli tribal art style: white figures on earthy brown/terracotta background, stick figure humans and animals made of simple circles, triangles, and lines, repetitive geometric patterns, circular dance formations (tarpa dance), ritualistic compositions, folk art simplicity, no perspective or depth, flat two-dimensional, symbolic representation over realism, tribal cultural storytelling, traditional Indian rural life themes, minimalist geometric aesthetic`
    };

    const styleDesc = styleDescriptions[artStyle] || styleDescriptions['Studio Ghibli'];
    
    const systemPrompt = `You are a MASTER art director who PERFECTLY replicates artistic styles for children's books.

CRITICAL STYLE REQUIREMENT: The image MUST authentically match the "${artStyle}" style. Study this description and follow it EXACTLY:

${styleDesc}

Create a structured JSON prompt with three components:

1. "style": START with "${artStyle} style:" then describe the visual style using the specifications above. Include specific details about colors, linework, textures, lighting, and composition that define this exact style.

2. "characters": Describe ALL characters in the scene with PRECISE age-appropriate details. If adults are present, they should be CLEARLY adults (mature faces, adult proportions, taller, parental age). If children are present, specify their approximate age and childlike proportions. ALWAYS include: "${characterDescription}" Specify exact ages, proportions, facial features, clothing, and expressions.

3. "scene": Describe the setting, composition, mood, lighting, specific actions, and background elements in the "${artStyle}" aesthetic.

Return ONLY valid JSON with keys: style, characters, scene.`;

    const userPrompt = isCover 
        ? `Create a stunning book cover in authentic "${artStyle}" style for "${title}": ${text}`
        : `Create an illustration in pure "${artStyle}" style for: ${text}`;

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