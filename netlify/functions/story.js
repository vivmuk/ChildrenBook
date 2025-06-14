const axios = require('axios');

const VENICE_API_KEY = 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';

async function generateImageForText(text, artStyle, apiKey, imageModel, characterDescription, size = "1024x1024") {
    const promptLimit = imageModel && imageModel.includes('flux') ? 2000 : 1400;
    let imagePromptSystem = `You are an expert art director creating illustrations for a children's book. Create a rich, detailed, and imaginative image prompt for an AI model. The prompt must generate a vibrant, friendly, and colorful image in a playful cartoon style. It should capture the essence of the following text. Focus on scene, characters, emotion, and lighting. The final output should be a single, descriptive paragraph. The requested art style is a suggestion, but the final image MUST be a cartoon. The main character MUST match this description: "${characterDescription}". Art Style: ${artStyle}.`;
    if (artStyle.toLowerCase().includes('ghibli')) {
        imagePromptSystem = `You are an expert art director specializing in the Studio Ghibli aesthetic for a children's book. Create a rich, detailed, and imaginative image prompt that captures the provided text in a playful cartoon style inspired by Ghibli. Emphasize lush, painterly backgrounds, whimsical scenery, and the interplay of light and nature. The final image MUST be a cartoon that evokes the feeling of a Ghibli film. The final output must be a single, descriptive paragraph. Art Style: ${artStyle}. The main character MUST match this description: "${characterDescription}".`;
    }
    const promptGenResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model: 'mistral-31-24b',
        messages: [{ role: 'system', content: imagePromptSystem }, { role: 'user', content: `Text: "${text}"` }]
    }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    let imagePrompt = promptGenResponse.data.choices[0].message.content;
    if (imagePrompt.length > promptLimit) {
        console.log(`Truncating long image prompt to ${promptLimit} chars...`);
        imagePrompt = imagePrompt.substring(0, promptLimit);
    }
    const imageResponse = await axios.post('https://api.venice.ai/api/v1/images/generations', {
        model: imageModel || 'venice-sd35',
        prompt: imagePrompt,
        n: 1,
        size: size,
        response_format: 'url'
    }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    return imageResponse.data.data[0].url;
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
        console.log('Function called with event:', JSON.stringify(event, null, 2));
        
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is required.' }) };
        }

        const { prompt, gradeLevel, language, artStyle, model, imageModel } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'A story prompt is required.' }) };
        }

        const storySystemPrompt = `
You are a world-class children's book author. Your task is to write a unique, captivating, and emotionally resonant 8-page story based on a user's prompt. You must emulate the masters of children's literature, adapting your style to the requested grade level.
**Grade Level Adaptations:**
- **1st-2nd Grade:** Write in the style of authors like Dr. Seuss or Eric Carle. Use simple, rhyming language, short sentences, and clear, foundational themes like friendship or discovery.
- **3rd-4th Grade:** Write in the style of authors like Roald Dahl or Beverly Cleary. Use more complex sentences, richer vocabulary, introduce humor, and explore themes of overcoming challenges or understanding others.
- **5th Grade & Up:** Write in the style of authors like C.S. Lewis or J.K. Rowling. Use sophisticated language, complex sentence structures, metaphors, and allegories. Tackle deeper themes like courage, morality, and the complexities of life.
**CRITICAL INSTRUCTIONS:**
1.  Create a compelling title for the story.
2.  The story MUST be exactly 8 pages long. Do not provide less or more.
3.  The story must be written in ${language}.
4.  You MUST return a valid JSON object with two keys: "title" and "story".
5.  ABSOLUTELY DO NOT use placeholder text like "-1" or fail to complete a page. Each of the 8 strings in the 'story' array must be a complete paragraph for that page.
    `;
        
        // 1. Generate Story
        console.log(`Generating story with text model: ${model}...`);
        const storyResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: model || 'mistral-31-24b',
            messages: [{ role: 'system', content: storySystemPrompt }, { role: 'user', content: `The story idea is: ${prompt}` }],
            response_format: { type: 'json_object' }
        }, { 
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            timeout: 30000 // 30 second timeout
        });

        const storyData = JSON.parse(storyResponse.data.choices[0].message.content);
        const { title, story } = storyData;
        console.log(`Successfully generated story: "${title}"`);

        // 2. Generate a Consistent Character Description
        console.log("Generating consistent character description...");
        const characterDescSystemPrompt = `Based on the following children's story, create a single, detailed character description for the main protagonist. Describe their appearance, gender, age, and clothing in a consistent manner. This description will be used to generate all illustrations. Output ONLY the description as a single paragraph. Story: ${JSON.stringify(storyData)}`;
        const characterResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'mistral-31-24b',
            messages: [{ role: 'system', content: characterDescSystemPrompt }, { role: 'user', content: 'Generate the character description.' }]
        }, { 
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            timeout: 30000 // 30 second timeout
        });
        const characterDescription = characterResponse.data.choices[0].message.content;
        console.log("Character Description:", characterDescription);

        // 3. Generate all images with the character description
        console.log(`Generating all illustrations with image model: ${imageModel}...`);
        const coverPromise = generateImageForText(`A beautiful book cover for a story titled "${title}"`, artStyle, VENICE_API_KEY, imageModel, characterDescription, "1792x1024");
        const pageImagePromises = story.map(pageText => generateImageForText(pageText, artStyle, VENICE_API_KEY, imageModel, characterDescription, "1024x1024"));
        const [coverImageUrl, ...pageImageUrls] = await Promise.all([coverPromise, ...pageImagePromises]);
        console.log("All images generated successfully.");

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ title, story, coverImageUrl, pageImageUrls }),
        };

    } catch (error) {
        console.error('An error occurred during book generation:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate the book.', details: error.message }),
        };
    }
}; 