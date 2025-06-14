const axios = require('axios');

const VENICE_API_KEY = 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';

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
        console.log('Story text generation started');
        
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is required.' }) };
        }

        const { prompt, gradeLevel, language, model } = JSON.parse(event.body);

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
6.  Also create a brief character description for the main character that will be used for consistent illustrations.
7.  Return JSON with keys: "title", "story", "characterDescription"
        `;
        
        // Generate Story Text Only
        console.log(`Generating story text with model: ${model || 'mistral-31-24b'}...`);
        const storyResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: model || 'mistral-31-24b',
            messages: [{ role: 'system', content: storySystemPrompt }, { role: 'user', content: `The story idea is: ${prompt}` }],
            response_format: { type: 'json_object' }
        }, { 
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            timeout: 25000 // 25 second timeout
        });

        const storyData = JSON.parse(storyResponse.data.choices[0].message.content);
        console.log(`Successfully generated story text: "${storyData.title}"`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(storyData),
        };

    } catch (error) {
        console.error('Error generating story text:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate story text.', details: error.message }),
        };
    }
}; 