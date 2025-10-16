const axios = require('axios');

const VENICE_API_KEY = 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';
const {
    isAllowedImageModel,
    enforceSafeImageModel,
    buildSafeImagePayload,
} = require('../../safety-config');

/**
 * Generate a structured image prompt with style, characters, and scene details
 */
async function generateStructuredImagePrompt(text, artStyle, apiKey, characterDescription, isCover = false) {
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
    
    const systemPrompt = `You are an expert art director creating ${isCover ? 'cover' : 'page'} illustrations for a world-class children's book. 

Create a structured JSON prompt with three components:
1. "style": Detailed visual style description incorporating: ${styleDesc}
2. "characters": Precise description of characters in the scene. ALWAYS include: "${characterDescription}"
3. "scene": The setting, composition, mood, lighting, and action happening in this specific moment

The final image must be in the "${artStyle}" style. Be specific, vivid, and paint a complete picture.
Return ONLY valid JSON with these three keys: style, characters, scene.`;

    const userPrompt = isCover 
        ? `Create a stunning book cover composition for: "${text}"`
        : `Create an illustration for this story moment: "${text}"`;

    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model: 'mistral-31-24b',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
    }, { 
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 20000
    });

    return JSON.parse(response.data.choices[0].message.content);
}

/**
 * Generate image from structured prompt
 */
async function generateImageFromStructuredPrompt(structuredPrompt, artStyle, apiKey, imageModel, size = "1024x1024") {
    const promptLimit = 1400; // Enforced limit for all models
    
    // Combine structured prompt into a single coherent prompt
    let fullPrompt = `Style: ${structuredPrompt.style}. Characters: ${structuredPrompt.characters}. Scene: ${structuredPrompt.scene}`;
    
    if (fullPrompt.length > promptLimit) {
        console.log(`Truncating image prompt from ${fullPrompt.length} to ${promptLimit} chars...`);
        fullPrompt = fullPrompt.substring(0, promptLimit);
    }

    const safeModel = enforceSafeImageModel(imageModel);
    const payload = buildSafeImagePayload({
        prompt: fullPrompt,
        n: 1,
        size,
        response_format: 'url',
    }, safeModel);

    const imageResponse = await axios.post('https://api.venice.ai/api/v1/images/generations', payload, { 
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 30000
    });
    
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
        console.log('Story generation started...');
        
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is required.' }) };
        }

        const { prompt, gradeLevel, language, artStyle, model, imageModel } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'A story prompt is required.' }) };
        }

        if (!isAllowedImageModel(imageModel)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please select a permitted safe Venice.ai image model.' }) };
        }

        // STEP 1: Use reasoning model to create detailed storyboard
        console.log(`Creating storyboard with reasoning model...`);
        
        const storyboardSystemPrompt = `You are a master children's book editor and storyboard artist. Analyze the user's story idea and create a detailed 8-page storyboard that captures the perfect narrative arc for a children's book.

**Grade Level Guidelines:**
- **1st-2nd Grade (Ages 6-7):** Inspired by Dr. Seuss, Eric Carle, and Mo Willems. Use 2-4 simple sentences per page with rhythmic, repetitive patterns. Vocabulary: 200-400 words total. Focus on basic emotions, colors, animals, family, and friendship. Each page should have ONE clear action or idea.
- **3rd-4th Grade (Ages 8-9):** Inspired by Roald Dahl, Beverly Cleary, and Judy Blume. Use 4-6 sentences per page with varied structure. Vocabulary: 800-1200 words total. Include dialogue, humor, and problem-solving. Characters can face meaningful challenges and learn lessons.
- **5th Grade & Up (Ages 10+):** Inspired by C.S. Lewis, J.K. Rowling, and Madeleine L'Engle. Use 6-8 complex sentences per page. Vocabulary: 1500-2000 words total. Employ literary devices, deeper themes, internal conflict, and moral complexity.

**Critical Requirements:**
1. Create exactly 8 page summaries that form a complete story arc
2. Each page summary should specify: key action, emotional tone, visual elements, and narrative purpose
3. Story must be in ${language}
4. Grade level: ${gradeLevel}

Return a JSON object with:
- "title": Compelling book title
- "pages": Array of 8 detailed page descriptions (each 2-3 sentences explaining what happens)
- "characterDescription": Detailed visual description of the main character (appearance, age, clothing, distinctive features)
- "theme": Core message or lesson`;

        const storyboardResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'llama-3.3-70b', // Using Llama 3.3 70B for storyboard
            messages: [
                { role: 'system', content: storyboardSystemPrompt },
                { role: 'user', content: `Story concept: ${prompt}\nGrade Level: ${gradeLevel}\nLanguage: ${language}` }
            ],
            response_format: { type: 'json_object' }
        }, { 
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            timeout: 60000
        });

        const storyboardData = JSON.parse(storyboardResponse.data.choices[0].message.content);
        console.log(`Storyboard created: "${storyboardData.title}"`);

        // STEP 2: Use mistral-31-24b to write actual story text based on storyboard
        console.log(`Writing story text with mistral-31-24b...`);
        
        const storyWritingSystemPrompt = `You are one of the world's greatest children's book authors. Based on the provided storyboard, write the actual text for each page with masterful prose that perfectly matches the grade level.

**Writing Standards by Grade Level:**

**1st-2nd Grade:**
- Style: Dr. Seuss (rhyming, rhythm, repetition), Eric Carle (simple poetic language), Mo Willems (direct dialogue)
- Sentence length: 5-10 words per sentence
- Sentences per page: 2-4
- Use present tense, active voice
- Repetitive phrases for memorability
- Direct sensory descriptions: "The sun is warm. The grass is green."
- Example quality: "Max loved his red ball. He bounced it high. Bounce, bounce, bounce! The ball went up, up, up into the sky."

**3rd-4th Grade:**
- Style: Roald Dahl (whimsical humor, vivid descriptions), Beverly Cleary (relatable situations), Judy Blume (authentic emotions)
- Sentence length: 10-15 words per sentence
- Sentences per page: 4-6
- Mix simple and compound sentences
- Include dialogue with proper punctuation
- Rich descriptive adjectives: "The mysterious, creaking door slowly opened."
- Example quality: "Maya's heart raced as she approached the old library. 'Anyone there?' she called out, her voice echoing through the dusty halls. Behind a stack of ancient books, something rustled."

**5th Grade & Up:**
- Style: C.S. Lewis (allegory, rich imagery), J.K. Rowling (world-building, complex characters), Madeleine L'Engle (philosophical depth)
- Sentence length: 15-25 words per sentence
- Sentences per page: 6-8
- Complex sentences with subordinate clauses
- Internal character thoughts and motivations
- Literary devices: metaphors, similes, foreshadowing
- Example quality: "As darkness fell over the village, Elena realized that her journey had only just begun. The ancient prophecy her grandmother had whispered about seemed impossible, yet here she stood at the threshold of the enchanted forest, feeling both terrified and strangely alive."

**Critical Instructions:**
- Write for ${gradeLevel}
- Language: ${language}
- Each page must be a complete, polished paragraph appropriate for the grade level
- NO placeholders, NO "-1", NO incomplete sentences
- Make every word count - this should be publication-quality

Return JSON with:
- "story": Array of exactly 8 strings, each containing the complete text for that page`;

        const storyResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'mistral-31-24b',
            messages: [
                { role: 'system', content: storyWritingSystemPrompt },
                { role: 'user', content: `Storyboard:\n${JSON.stringify(storyboardData, null, 2)}\n\nWrite the complete story text for all 8 pages.` }
            ],
            response_format: { type: 'json_object' }
        }, { 
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            timeout: 45000
        });

        const storyTextData = JSON.parse(storyResponse.data.choices[0].message.content);
        const title = storyboardData.title;
        const story = storyTextData.story;
        const characterDescription = storyboardData.characterDescription;
        
        console.log(`Story text completed: "${title}"`);
        console.log(`Character: ${characterDescription}`);

        // STEP 3: Generate images using structured JSON prompts
        const safeImageModel = enforceSafeImageModel(imageModel);
        console.log(`Generating illustrations with ${safeImageModel}...`);
        
        // Cover image
        const coverStructuredPrompt = await generateStructuredImagePrompt(
            `Book cover for "${title}": ${storyboardData.theme}`,
            artStyle,
            VENICE_API_KEY,
            characterDescription,
            true
        );
        
        // Page images
        const pageStructuredPrompts = await Promise.all(
            story.map((pageText, index) => 
                generateStructuredImagePrompt(
                    `${storyboardData.pages[index]}\n\nText: ${pageText}`,
                    artStyle,
                    VENICE_API_KEY,
                    characterDescription,
                    false
                )
            )
        );
        
        // End page
        const endStructuredPrompt = await generateStructuredImagePrompt(
            `"The End" page for "${title}" - ${storyboardData.theme}. Show a satisfying conclusion scene with "The End" integrated naturally.`,
            artStyle,
            VENICE_API_KEY,
            characterDescription,
            false
        );

        console.log('Structured prompts created. Generating images...');

        // Generate all images
        const coverImagePromise = generateImageFromStructuredPrompt(coverStructuredPrompt, artStyle, VENICE_API_KEY, safeImageModel, "1792x1024");
        const pageImagePromises = pageStructuredPrompts.map(prompt => 
            generateImageFromStructuredPrompt(prompt, artStyle, VENICE_API_KEY, safeImageModel, "1024x1024")
        );
        const endImagePromise = generateImageFromStructuredPrompt(endStructuredPrompt, artStyle, VENICE_API_KEY, safeImageModel, "1024x1024");

        const allImages = await Promise.all([coverImagePromise, ...pageImagePromises, endImagePromise]);
        const coverImageUrl = allImages[0];
        const pageImageUrls = allImages.slice(1, -1);
        const endPageImageUrl = allImages[allImages.length - 1];
        
        console.log('All images generated successfully!');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ title, story, coverImageUrl, pageImageUrls, endPageImageUrl }),
        };

    } catch (error) {
        console.error('Error during book generation:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate the book.', details: error.message }),
        };
    }
}; 