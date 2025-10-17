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
async function generateStructuredImagePrompt(text, artStyle, apiKey, characterDescription, isCover = false, gradeLevel = '3') {
    // Detailed style specifications that MUST be followed
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
    
    // Age-appropriate character guidelines
    const gradeNum = parseInt(gradeLevel);
    let ageGuidance = '';
    if (gradeNum <= 2) {
        ageGuidance = 'If adult characters are present, they should be clearly adults (mature faces, adult proportions, taller). If child characters are present, they should be small children aged 6-7 (shorter, rounder faces, childlike proportions, innocent expressions).';
    } else if (gradeNum <= 4) {
        ageGuidance = 'If adult characters are present, they should be clearly adults (mature features, adult body proportions). If child characters are present, they should be children aged 8-9 (pre-teen proportions, youthful faces, energetic poses).';
    } else {
        ageGuidance = 'If adult characters are present, they should be clearly adults with mature features. If child/teen characters are present, they should be pre-teens/early teens aged 10-12 (taller than young children, developing features, more sophisticated proportions).';
    }
    
    const systemPrompt = `You are a MASTER art director who PERFECTLY replicates artistic styles for children's books. 

CRITICAL STYLE REQUIREMENT: The image MUST authentically match the "${artStyle}" style. Study this description and follow it EXACTLY:

${styleDesc}

Create a structured JSON prompt with three components:

1. "style": START with "${artStyle} style:" then describe the visual style using the specifications above. Include specific details about colors, linework, textures, lighting, and composition that define this exact style.

2. "characters": Describe ALL characters in the scene with PRECISE age-appropriate details. ${ageGuidance} ALWAYS include: "${characterDescription}" Specify exact ages, proportions, facial features, clothing, and expressions appropriate for their age.

3. "scene": Describe the setting, composition, mood, lighting, specific actions, and background elements in the "${artStyle}" aesthetic.

Return ONLY valid JSON with keys: style, characters, scene.`;

    const userPrompt = isCover 
        ? `Create a stunning book cover in authentic "${artStyle}" style for: "${text}"`
        : `Create an illustration in pure "${artStyle}" style for: "${text}"`;

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
- "characterDescription": DETAILED visual description of ALL main characters (protagonist AND any adults/family members). ${gradeNum <= 2 ? 'If there are adults (parents/teachers), describe them as CLEARLY ADULT (mature face, adult height, parental age 30-40). Child character should be 6-7 years old (small, round face, childlike).' : gradeNum <= 4 ? 'If there are adults, describe them as CLEARLY ADULT (mature features, tall, parental age 30-40). Child character should be 8-9 years old (pre-teen proportions).' : 'If there are adults, describe them as CLEARLY ADULT (fully mature, adult proportions, age 35-45). Main character should be 10-12 years old (pre-teen/early teen).'} Include specific ages, facial features, body proportions, hair, clothing, and how to distinguish adults from children.
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
            true,
            gradeLevel
        );
        
        // Page images
        const pageStructuredPrompts = await Promise.all(
            story.map((pageText, index) => 
                generateStructuredImagePrompt(
                    `${storyboardData.pages[index]}\n\nText: ${pageText}`,
                    artStyle,
                    VENICE_API_KEY,
                    characterDescription,
                    false,
                    gradeLevel
                )
            )
        );
        
        // End page
        const endStructuredPrompt = await generateStructuredImagePrompt(
            `"The End" page for "${title}" - ${storyboardData.theme}. Show a satisfying conclusion scene with "The End" integrated naturally.`,
            artStyle,
            VENICE_API_KEY,
            characterDescription,
            false,
            gradeLevel
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