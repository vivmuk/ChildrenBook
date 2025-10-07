require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const VENICE_API_KEY = process.env.VENICE_API_KEY
    || process.env.VENICE_TOKEN
    || process.env.VITE_VENICE_API_KEY
    || process.env.API_KEY
    || 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';

const veniceEnabled = Boolean(VENICE_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const {
    SAFE_IMAGE_MODEL_IDS,
    isAllowedImageModel,
    enforceSafeImageModel,
    buildSafeImagePayload,
    getPromptCharacterLimit,
} = require('./safety-config');

const FALLBACK_TEXT_MODEL = {
    id: 'mock-storyteller',
    model_spec: {
        name: 'Offline Storyteller',
        constraints: {
            promptCharacterLimit: 1000,
        },
    },
};

const FALLBACK_IMAGE_MODEL = {
    id: SAFE_IMAGE_MODEL_IDS[0] || 'venice-sd35',
    model_spec: {
        name: 'Offline Illustrator',
        constraints: {
            promptCharacterLimit: 1000,
        },
    },
};

function escapeForSvg(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createFallbackImage(title, body, width = 1024, height = 1024, paletteIndex = 0) {
    const palettes = [
        ['#FFDFC8', '#FF9AA2', '#FFB7B2'],
        ['#D9F4FF', '#A0E7E5', '#B4F8C8'],
        ['#FFF3B0', '#FFCE6D', '#F6A6B2'],
        ['#E5E0FF', '#C4C1E0', '#A0C4FF'],
    ];
    const palette = palettes[paletteIndex % palettes.length];
    const safeTitle = escapeForSvg(title).slice(0, 80);
    const safeBody = escapeForSvg(body).slice(0, 160);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette[0]}" />
      <stop offset="70%" stop-color="${palette[1]}" />
      <stop offset="100%" stop-color="${palette[2]}" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" rx="48" ry="48" />
  <g fill="#3c2a4d" font-family="'Baloo 2', 'Comic Sans MS', sans-serif" text-anchor="middle">
    <text x="${width / 2}" y="${height / 2 - 40}" font-size="${Math.max(32, width / 18)}" font-weight="700">${safeTitle}</text>
    <text x="${width / 2}" y="${height / 2 + 40}" font-size="${Math.max(24, width / 26)}" opacity="0.75">${safeBody}</text>
  </g>
  <circle cx="${width * 0.2}" cy="${height * 0.8}" r="${Math.max(width, height) * 0.06}" fill="#ffffff55" />
  <circle cx="${width * 0.8}" cy="${height * 0.2}" r="${Math.max(width, height) * 0.05}" fill="#ffffff33" />
  <path d="M${width * 0.2} ${height * 0.25} Q${width * 0.3} ${height * 0.05} ${width * 0.5} ${height * 0.18} T${width * 0.8} ${height * 0.25}" stroke="#ffffff55" stroke-width="14" fill="none" stroke-linecap="round" />
</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildFallbackStory({ prompt = '', language = 'English', gradeLevel = '3', artStyle = 'Classic storybook' }) {
    const cleanedPrompt = prompt || 'a brave young explorer discovering a hidden world';
    const gradeTone = {
        '1': 'short, playful sentences with gentle rhymes',
        '2': 'simple sentences filled with curiosity and friendship',
        '3': 'warm storytelling with a dash of adventure and humour',
        '4': 'imaginative scenes with lively dialogue and problem solving',
        '5': 'rich descriptions, thoughtful emotions, and inspiring lessons',
    };

    const languageOpeners = {
        English: 'Once upon a time',
        Spanish: 'Érase una vez',
        French: 'Il était une fois',
        German: 'Es war einmal',
        Hindi: 'किसी समय की बात है',
        Gujarati: 'એક વખતની વાત છે',
    };

    const languageClosers = {
        English: 'Together they discovered that kindness makes every adventure brighter.',
        Spanish: 'Juntos descubrieron que la bondad hace cada aventura más brillante.',
        French: 'Ensemble, ils découvrirent que la gentillesse rend chaque aventure plus lumineuse.',
        German: 'Gemeinsam entdeckten sie, dass Freundlichkeit jedes Abenteuer heller macht.',
        Hindi: 'साथ मिलकर उन्होंने सीखा कि दया हर रोमांच को उज्ज्वल बनाती है।',
        Gujarati: 'સાથે મળીને તેમણે શીખ્યું કે દયા દરેક સાહસને ઝગમગતું બનાવે છે.',
    };

    const opener = languageOpeners[language] || languageOpeners.English;
    const closer = languageClosers[language] || languageClosers.English;
    const tone = gradeTone[String(gradeLevel)] || gradeTone['3'];

    const title = cleanedPrompt.length > 3
        ? `${cleanedPrompt.replace(/^[a-z]/, c => c.toUpperCase()).replace(/\.$/, '')}`
        : 'A Magical Adventure';

    const summary = `${opener}, a story about ${cleanedPrompt}. Written with ${tone}.`;
    const pages = Array.from({ length: 8 }).map((_, index) => {
        const beat = [
            'meets a surprising friend who understands their dreams',
            'follows sparkling clues that flutter in the air',
            'faces a puzzle that needs courage and creativity',
            'listens to the whispers of the wind for gentle guidance',
            'shares a laugh that echoes like chimes through the trees',
            'helps someone in need and feels their heart glow',
            'sees the path ahead sparkle with possibilities',
            closer,
        ][index];

        return `${opener}! Our hero inspired by ${cleanedPrompt} ${beat}`;
    });

    const coverImageUrl = createFallbackImage(title, artStyle, 1792, 1024, 0);
    const pageImageUrls = pages.map((page, index) =>
        createFallbackImage(`Page ${index + 1}`, page, 1024, 1024, index + 1)
    );
    const endPageImageUrl = createFallbackImage('The End', closer, 1024, 1024, 5);

    return {
        title,
        story: pages,
        coverImageUrl,
        pageImageUrls,
        endPageImageUrl,
        metadata: {
            fallback: true,
            language,
        },
        summary,
    };
}

// Helper function for image generation using NEW Venice.ai API
async function generateImageForText(
    text,
    artStyle,
    imageModel,
    characterDescription,
    isCover = false,
    title = '',
    width = 1024,
    height = 1024
) {
    if (!veniceEnabled) {
        throw new Error('Venice.ai API is not configured.');
    }
    const safeImageModelId = enforceSafeImageModel(imageModel);
    const rawPromptLimit = getPromptCharacterLimit(safeImageModelId);
    const promptLimitBuffer = 50;
    const promptLimit = Math.max(1, rawPromptLimit - promptLimitBuffer);
    
    console.log(`📏 Model "${safeImageModelId}" has prompt limit: ${rawPromptLimit} chars (using ${promptLimit} after buffer)`);
    
    // Create detailed, cohesive prompts
    let enhancedPrompt;
    
    if (isCover) {
        enhancedPrompt = `Beautiful children's book cover in ${artStyle} style. ${title}. ${characterDescription}. ${text}. Vibrant, enchanting, professional book cover design with the main character prominently featured. Warm lighting, inviting atmosphere.`;
    } else {
        enhancedPrompt = `Children's book illustration in ${artStyle} style. ${characterDescription} is the main character. Scene: ${text}. Consistent character design, expressive emotions, detailed background, warm lighting, engaging composition, perfect for children ages 5-10.`;
    }
    
    // Ensure prompt is within limits
    if (enhancedPrompt.length > promptLimit) {
        console.warn(`⚠️  TRUNCATING: Prompt is ${enhancedPrompt.length} chars, exceeds ${safeImageModelId}'s limit of ${promptLimit} chars`);
        enhancedPrompt = enhancedPrompt.substring(0, promptLimit);
        console.log(`✂️  Truncated to ${enhancedPrompt.length} characters`);
    } else {
        console.log(`✅ Prompt length OK (${enhancedPrompt.length}/${promptLimit} chars)`);
    }

    // Build payload for NEW Venice.ai image API
    const imageRequestPayload = {
        model: safeImageModelId,
        prompt: enhancedPrompt,
        negative_prompt: "ugly, deformed, distorted, scary, dark, violent, nsfw, adult content, inappropriate, blurry, low quality",
        width: width,
        height: height,
        variants: 1,
        steps: 25,
        cfg_scale: 7.5,
        format: "webp",
        safe_mode: true,
        hide_watermark: false,
        embed_exif_metadata: false,
        return_binary: false
    };

    console.log(`🚀 Sending to NEW Venice.ai Image API:`, { 
        model: imageRequestPayload.model, 
        dimensions: `${width}x${height}`,
        safe_mode: imageRequestPayload.safe_mode,
        hide_watermark: imageRequestPayload.hide_watermark,
        prompt_length: imageRequestPayload.prompt.length,
        steps: imageRequestPayload.steps
    });

    try {
        const imageResponse = await axios.post('https://api.venice.ai/api/v1/image/generate', imageRequestPayload, {
            headers: { 
                'Authorization': `Bearer ${VENICE_API_KEY}`,
                'Content-Type': 'application/json'
            },
        });

        console.log(`✅ Image generated successfully`);
        
        // The new API returns image URL directly in the response
        if (imageResponse.data && imageResponse.data.url) {
            return imageResponse.data.url;
        } else if (imageResponse.data && imageResponse.data.data && imageResponse.data.data[0]) {
            return imageResponse.data.data[0].url;
        } else {
            throw new Error('Unexpected image API response format');
        }
    } catch (error) {
        console.error('Image generation error:', error.response?.data || error.message);
        throw error;
    }
}

// Routes

// Test route
app.get('/api/test', async (req, res) => {
    try {
        if (req.query.simple === 'true' || !veniceEnabled) {
            return res.json({
                message: veniceEnabled
                    ? 'Render server is working!'
                    : 'Offline fallback mode active. Venice.ai API key not configured.',
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                fallback: !veniceEnabled,
            });
        }

        // Test Venice.ai API connection
        const response = await axios.get('https://api.venice.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            params: { type: 'text' }
        });

        res.json({
            message: 'Venice.ai API is working!',
            modelsCount: response.data.data.length,
            sampleModels: response.data.data.slice(0, 3).map(m => m.id)
        });
    } catch (error) {
        console.error('Test error:', error.message);
        res.status(500).json({ error: 'Test failed', details: error.message });
    }
});

// Get models
app.get('/api/models', async (req, res) => {
    try {
        if (!veniceEnabled) {
            return res.json({
                textModels: [FALLBACK_TEXT_MODEL],
                imageModels: [FALLBACK_IMAGE_MODEL],
                fallback: true,
            });
        }

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
        const availableSafeModels = imageResponse.data.data.filter(m => m.model_spec && !m.model_spec.offline && isAllowedImageModel(m.id));
        const imageModels = SAFE_IMAGE_MODEL_IDS
            .map(id => availableSafeModels.find(model => model.id === id))
            .filter(Boolean);

        res.json({ textModels, imageModels });
    } catch (error) {
        console.error("Failed to fetch models:", error.message);
        if (!veniceEnabled) {
            res.json({
                textModels: [FALLBACK_TEXT_MODEL],
                imageModels: [FALLBACK_IMAGE_MODEL],
                fallback: true,
            });
        } else {
            res.status(500).json({ error: "Could not fetch models from Venice.ai" });
        }
    }
});

// Generate complete story with images (no timeout limits!)
app.post('/api/story', async (req, res) => {
    try {
        const { prompt, gradeLevel, language, artStyle, model, imageModel } = req.body;
        const requestContext = { prompt, gradeLevel, language, artStyle };

        if (!prompt) {
            return res.status(400).json({ error: 'A story prompt is required.' });
        }

        if (!isAllowedImageModel(imageModel)) {
            return res.status(400).json({ error: 'Please select a permitted safe Venice.ai image model.' });
        }

        if (!veniceEnabled) {
            console.warn('Venice.ai API key missing - using offline fallback story.');
            return res.json(buildFallbackStory(requestContext));
        }

        console.log(`Starting complete book generation for: "${prompt}"`);

        const storySystemPrompt = `
You are a world-class children's book author creating a COHESIVE 8-page story. Your story must have a clear beginning, middle, and end that flows naturally from page to page.

**Story Structure (MANDATORY):**
- Page 1: Introduce the main character and their normal world
- Page 2: Something interesting happens that starts the adventure
- Page 3-4: The character faces challenges or explores something new
- Page 5-6: The challenge builds to a climax or turning point
- Page 7: Resolution begins - the character finds a solution
- Page 8: Happy ending - what the character learned or achieved

**Grade Level Adaptations:**
- **1st-2nd Grade:** Simple words, short sentences (5-8 words), repetition, clear emotions
- **3rd-4th Grade:** Richer vocabulary, longer sentences (8-15 words), dialogue, descriptive details
- **5th Grade & Up:** Complex sentences, advanced vocabulary, deeper themes, character growth

**Character Consistency:**
- Keep the SAME main character throughout all 8 pages
- Use the SAME character name consistently
- Describe them the same way each time they appear
- Give them a clear personality and goal

**Language:** ${language}

**Output Format:** Return ONLY a valid JSON object with:
{
  "title": "Story Title Here",
  "story": [
    "Page 1 text - full paragraph introducing character...",
    "Page 2 text - full paragraph continuing the story...",
    ... (exactly 8 pages total)
  ]
}

**CRITICAL:** Each page must connect to the previous page. Use transition words. Make it feel like ONE cohesive story, not 8 separate scenes.
        `;
        
        // 1. Generate Story
        console.log(`Generating story with text model: ${model}...`);

        const createStoryRequest = async (payloadOverrides = {}) => {
            const payload = {
                model: model || 'mistral-31-24b',
                messages: [
                    { role: 'system', content: storySystemPrompt },
                    { role: 'user', content: `The story idea is: ${prompt}` }
                ],
                ...payloadOverrides,
            };

            const response = await axios.post(
                'https://api.venice.ai/api/v1/chat/completions',
                payload,
                { headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` } }
            );

            return response.data.choices[0].message?.content || '';
        };

        const parseStoryJson = (content) => {
            if (!content) {
                throw new Error('No story content received from model.');
            }

            try {
                return JSON.parse(content);
            } catch (error) {
                const jsonMatch = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[1]);
                }
                throw error;
            }
        };

        let storyContent;
        try {
            storyContent = await createStoryRequest({ response_format: { type: 'json_object' } });
        } catch (error) {
            const errorDetails = error.response?.data;
            const detailMessages = [
                ...(errorDetails?.details?._errors || []),
                ...(errorDetails?.issues || []).map(issue => issue?.message).filter(Boolean)
            ].join(' ').toLowerCase();

            if (detailMessages.includes('response_format is not supported')) {
                console.warn(`Model ${model} does not support response_format JSON mode. Falling back to instruction-based parsing.`);
                storyContent = await createStoryRequest();
            } else {
                throw error;
            }
        }

        const storyData = parseStoryJson(storyContent);
        const { title, story } = storyData;
        console.log(`Successfully generated story: "${title}"`);

        // 2. Generate a Consistent Character Description
        console.log("Generating consistent character description...");
        const characterDescSystemPrompt = `You are a character designer for children's books. Based on this story, create a DETAILED, CONSISTENT character description for the main protagonist.

Story Title: ${title}
Story: ${JSON.stringify(story)}

Create a character description that includes:
1. Specific physical appearance (hair color/style, eye color, skin tone, height/build)
2. Age (approximate)
3. Clothing/outfit (specific colors and style)
4. Distinctive features (freckles, glasses, accessories, etc.)
5. Personality traits that show in their appearance

Make it SPECIFIC and DETAILED so an artist can draw the exact same character for every page. Use concrete details, not vague descriptions.

Output ONLY the character description as a single detailed paragraph.`;
        
        const characterResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'mistral-31-24b',
            messages: [{ role: 'system', content: characterDescSystemPrompt }, { role: 'user', content: 'Generate the detailed character description now.' }]
        }, { headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` } });
        const characterDescription = characterResponse.data.choices[0].message.content;
        console.log("📋 Character Description:", characterDescription);

        // 3. Generate all images with the character description
        const safeImageModel = enforceSafeImageModel(imageModel);
        console.log(`✨ User selected image model: ${imageModel}`);
        console.log(`✅ Using validated safe image model: ${safeImageModel}`);
        console.log(`🎨 Generating all illustrations with ${safeImageModel} in "${artStyle}" style...`);
        console.log(`📚 Generating COVER, 8 PAGES, and END PAGE = 10 total images`);
        
        // Generate cover (wider format)
        console.log(`\n🖼️  Generating COVER IMAGE...`);
        const coverPromise = generateImageForText(
            `Book cover for "${title}". ${story[0]}`, 
            artStyle, 
            safeImageModel, 
            characterDescription, 
            true, 
            title, 
            1792, 
            1024
        );
        
        // Generate page images (square format)
        const pageImagePromises = story.map((pageText, index) => {
            console.log(`\n📄 Generating PAGE ${index + 1} IMAGE...`);
            return generateImageForText(
                pageText, 
                artStyle, 
                safeImageModel, 
                characterDescription, 
                false, 
                '', 
                1024, 
                1024
            );
        });
        
        // Generate "The End" page
        console.log(`\n✨ Generating THE END PAGE IMAGE...`);
        const endPagePromise = generateImageForText(
            `"The End" page for the story "${title}". ${characterDescription} celebrating the happy ending. ${story[story.length - 1]}`, 
            artStyle, 
            safeImageModel, 
            characterDescription, 
            false, 
            '', 
            1024, 
            1024
        );
        
        const allImages = await Promise.all([coverPromise, ...pageImagePromises, endPagePromise]);
        const coverImageUrl = allImages[0];
        const pageImageUrls = allImages.slice(1, -1);
        const endPageImageUrl = allImages[allImages.length - 1];
        console.log("\n🎉 All images generated successfully!");
        console.log(`   - Cover: ✅`);
        console.log(`   - Pages 1-8: ✅`);
        console.log(`   - The End: ✅`);

        res.json({ title, story, coverImageUrl, pageImageUrls, endPageImageUrl });

    } catch (error) {
        console.error('Error during book generation:', error.response ? error.response.data : error.message);
        if (!veniceEnabled) {
            return res.status(500).json({ error: 'Failed to generate the book.', details: error.message });
        }

        try {
            console.warn('Falling back to offline story after Venice.ai error.');
            const fallbackStory = buildFallbackStory(req.body || {});
            return res.json(fallbackStory);
        } catch (fallbackError) {
            console.error('Fallback story generation failed:', fallbackError.message);
            res.status(500).json({ error: 'Failed to generate the book.', details: error.message });
        }
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 Children's Book Generator ready!`);
}); 