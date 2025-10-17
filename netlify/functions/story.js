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

        // STEP 1: Use Llama 3.3 70B to create detailed storyboard
        console.log(`Creating storyboard with Llama 3.3 70B...`);
        
        const storyboardSystemPrompt = `You are a master children's book editor and storyboard artist with 30 years of experience. Analyze the user's story idea and create a detailed 8-page storyboard that captures the perfect narrative arc.

**GRADE LEVEL SPECIFICATIONS (STRICTLY ADHERE TO THESE):**

**1st-2nd Grade (Ages 6-7):**
- Style: Dr. Seuss, Eric Carle, Mo Willems
- Sentence count: 2-4 SHORT sentences per page (MAX 10 words per sentence)
- Total word count: 150-300 words for ENTIRE 8-page story
- Vocabulary: ONE syllable words primarily (cat, dog, run, jump, see, play)
- Structure: Repetitive patterns ("I see a...", "Can you...?", "Where is...?")
- Themes: Colors, counting, animals, family, basic emotions (happy, sad, scared)
- NO complex plots - simple cause-and-effect only

**3rd-4th Grade (Ages 8-9):**
- Style: Roald Dahl, Beverly Cleary, Judy Blume, Ramona Quimby
- Sentence count: 4-6 sentences per page (10-15 words per sentence)
- Total word count: 600-900 words for ENTIRE 8-page story
- Vocabulary: Two-syllable words, some three-syllable (adventure, discover, mystery)
- Structure: Mix of simple and compound sentences, dialogue with quotation marks
- Themes: Friendship challenges, small adventures, overcoming fears, learning lessons
- Include: Clear problem and solution, character growth

**5th Grade & Up (Ages 10+):**
- Style: C.S. Lewis, J.K. Rowling, Madeleine L'Engle, Rick Riordan
- Sentence count: 6-10 sentences per page (15-25 words per sentence)
- Total word count: 1200-1800 words for ENTIRE 8-page story
- Vocabulary: Complex multi-syllable words, rich adjectives, varied verbs
- Structure: Complex sentences with clauses, varied paragraph lengths, internal dialogue
- Themes: Identity, courage, ethics, sacrifice, complex emotions
- Include: Subplots, foreshadowing, character depth, moral complexity

**Critical Requirements:**
1. Create exactly 8 page summaries forming a complete arc (setup → conflict → resolution)
2. Each page summary: key action, emotional tone, visual scene, narrative purpose
3. Language: ${language}
4. Grade level: ${gradeLevel}

Return JSON:
- "title": Compelling, age-appropriate book title
- "pages": Array of 8 detailed page descriptions
- "characterDescription": Detailed visual description of main character
- "theme": Core message`;

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
        
        const gradeNumber = parseInt(gradeLevel);
        let gradeInstructions = '';
        
        if (gradeNumber <= 2) {
            gradeInstructions = `**1st-2nd Grade Writing Rules:**
- Write EXACTLY like Dr. Seuss, Eric Carle, or Mo Willems
- Each page: 2-4 sentences MAXIMUM
- Each sentence: 5-10 words MAXIMUM
- Use ONE-syllable words: cat, dog, run, see, go, big, red, fun
- Repeat key phrases: "I can...", "Look at...", "Where is...?"
- NO complex words, NO long descriptions
- Example: "Sam has a red hat. The hat is big. Sam likes his hat. It is fun!"`;
        } else if (gradeNumber <= 4) {
            gradeInstructions = `**3rd-4th Grade Writing Rules:**
- Write like Roald Dahl, Beverly Cleary, or Judy Blume
- Each page: 4-6 sentences
- Each sentence: 10-15 words average
- Use dialogue: "Let's go!" said Max.
- Mix sentence types: simple, compound
- Clear problem and solution structure
- Example: "Mia couldn't find her backpack anywhere. She looked under her bed and behind the door. 'Mom, have you seen it?' she called. Just then, her little brother walked in wearing it!"`;
        } else {
            gradeInstructions = `**5th Grade+ Writing Rules:**
- Write like C.S. Lewis, J.K. Rowling, or Rick Riordan
- Each page: 6-10 sentences
- Each sentence: 15-25 words, vary structure
- Use complex sentences with clauses
- Include internal thoughts, rich descriptions
- Literary devices: metaphors, foreshadowing
- Example: "The ancient map trembled in Elena's hands as she stood before the gateway, knowing that once she stepped through, there would be no turning back. Her grandmother's warnings echoed in her mind, but the pull of destiny was stronger than her fear."`;
        }
        
        const storyWritingSystemPrompt = `You are one of the world's BEST children's book authors. Write the actual text based on the storyboard. FOLLOW THE GRADE LEVEL RULES EXACTLY.

${gradeInstructions}

**CRITICAL REQUIREMENTS:**
- Write in ${language}
- Grade level: ${gradeLevel}
- Each page MUST be appropriate for the grade level
- NO placeholders, NO "-1", NO incomplete sentences
- This is for publication - make it PERFECT

Return JSON with:
- "story": Array of exactly 8 strings (one complete text per page)`;

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
        
        // Cover image with embedded title
        const coverStructuredPrompt = await generateStructuredImagePrompt(
            `Book cover for "${title}". IMPORTANT: The title "${title}" MUST be prominently displayed in the image in large, fun, cartoon-style lettering that matches the ${artStyle} aesthetic. The title should be integrated naturally into the scene as if it's part of the illustration - floating in the sky, carved in wood, made of clouds, etc. Theme: ${storyboardData.theme}`,
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