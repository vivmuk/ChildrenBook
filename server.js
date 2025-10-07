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
    
    // Use LLM to intelligently distill the prompt for maximum quality under 1000 chars
    const targetLength = 900; // Target 900 chars to leave buffer room
    let promptGenSystemMessage;
    
    if (isCover) {
        promptGenSystemMessage = `You are an expert at creating concise, high-quality image generation prompts for children's book covers.

Given:
- Title: ${title}
- Art Style: ${artStyle}
- Character Description: ${characterDescription}
- Story Opening: ${text}

Create a DETAILED but CONCISE image prompt (max ${targetLength} characters) that includes:
1. The art style
2. Key character visual details (appearance, clothing, expression)
3. The scene/setting
4. Mood and atmosphere
5. Composition notes

Focus on VISUAL elements. Be specific about colors, lighting, composition. Keep character details consistent.
Output ONLY the prompt, nothing else.`;
    } else {
        promptGenSystemMessage = `You are an expert at creating concise, high-quality image generation prompts for children's book illustrations.

Given:
- Art Style: ${artStyle}
- Character Description: ${characterDescription}
- Scene Text: ${text}

Create a DETAILED but CONCISE image prompt (max ${targetLength} characters) that includes:
1. The art style
2. Key character visual details (MUST match character description for consistency)
3. What's happening in the scene
4. Setting/background details
5. Character expression and pose
6. Lighting and mood

Focus on VISUAL storytelling. Be specific about colors, composition, emotions. Maintain character consistency.
Output ONLY the prompt, nothing else.`;
    }

    // Generate optimized prompt using LLM
    const promptGenResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model: 'mistral-31-24b',
        messages: [
            { role: 'system', content: promptGenSystemMessage },
            { role: 'user', content: 'Generate the optimized image prompt now.' }
        ],
        max_tokens: 500
    }, { headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` } });

    let enhancedPrompt = promptGenResponse.data.choices[0].message.content.trim();
    
    console.log(`🤖 LLM generated prompt: ${enhancedPrompt.length} characters`);
    
    // Final safety check - keep under 1400 to be absolutely safe
    const safeLimit = 1350; // Conservative limit
    if (enhancedPrompt.length > safeLimit) {
        console.warn(`⚠️  TRUNCATING: Prompt is ${enhancedPrompt.length} chars, exceeds safe limit of ${safeLimit} chars`);
        enhancedPrompt = enhancedPrompt.substring(0, safeLimit);
        console.log(`✂️  Truncated to ${enhancedPrompt.length} characters`);
    } else {
        console.log(`✅ Prompt length OK (${enhancedPrompt.length}/${safeLimit} chars)`);
    }

    // Determine optimal steps based on model constraints (from Venice.ai docs)
    const modelStepsMap = {
        'venice-sd35': 30,
        'hidream': 50,
        'flux-dev': 30,
        'flux-dev-uncensored': 30,
        'lustify-sdxl': 50,
        'lustify-v7': 25,
        'qwen-image': 8,
        'wai-Illustrious': 30
    };
    const optimalSteps = modelStepsMap[safeImageModelId] || 25;
    
    // Generate a consistent seed for the entire book (so images have similar style)
    // Use a hash of the character description to make it consistent per character
    const seedHash = characterDescription.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const bookSeed = (seedHash % 999999999) + 1; // Positive seed within range
    
    // Map art styles to Venice.ai style presets when applicable
    const stylePresetMap = {
        'Playful cartoon': '3D Model',
        'Bold comic panels': 'Comic Book',
        'Dreamy watercolour': 'Watercolor',
        'Gentle pencil sketch': 'Line art',
        'Mythic stained glass': 'Stained Glass',
        'Futuristic neon sci-fi': 'Neon Punk'
    };
    const stylePreset = stylePresetMap[artStyle] || null;
    
    // Build payload for NEW Venice.ai image API with enhancements
    const imageRequestPayload = {
        model: safeImageModelId,
        prompt: enhancedPrompt,
        negative_prompt: "ugly, deformed, distorted, scary, dark, violent, nsfw, adult content, inappropriate, blurry, low quality, text, watermark, signature",
        width: width,
        height: height,
        variants: 1,
        steps: optimalSteps,
        cfg_scale: 7.5, // Balance between creativity and adherence to prompt
        seed: bookSeed, // Consistent seed for style consistency across book
        lora_strength: 50, // Medium LoRA strength if model supports it
        format: "webp",
        safe_mode: true,
        hide_watermark: false,
        embed_exif_metadata: true, // Embed generation info for debugging
        return_binary: false
    };
    
    // Add style preset if applicable
    if (stylePreset) {
        imageRequestPayload.style_preset = stylePreset;
    }

    console.log(`🚀 Sending to NEW Venice.ai Image API:`, { 
        model: imageRequestPayload.model, 
        dimensions: `${width}x${height}`,
        steps: optimalSteps,
        cfg_scale: imageRequestPayload.cfg_scale,
        seed: bookSeed,
        lora_strength: imageRequestPayload.lora_strength,
        style_preset: stylePreset || 'none',
        safe_mode: imageRequestPayload.safe_mode,
        hide_watermark: imageRequestPayload.hide_watermark,
        prompt_length: imageRequestPayload.prompt.length
    });

    try {
        const imageResponse = await axios.post('https://api.venice.ai/api/v1/image/generate', imageRequestPayload, {
            headers: { 
                'Authorization': `Bearer ${VENICE_API_KEY}`,
                'Content-Type': 'application/json'
            },
        });

        console.log(`✅ Image generated successfully`);
        console.log(`📦 Raw API response keys:`, Object.keys(imageResponse.data || {}));
        
        let imageUrl = null;
        
        // The new API returns image URL in different possible formats
        if (imageResponse.data) {
            // Try direct url field
            if (imageResponse.data.url) {
                imageUrl = imageResponse.data.url;
                console.log(`🔗 Found image at: data.url`);
            }
            // Try data array format
            else if (imageResponse.data.data && Array.isArray(imageResponse.data.data) && imageResponse.data.data[0]) {
                if (imageResponse.data.data[0].url) {
                    imageUrl = imageResponse.data.data[0].url;
                    console.log(`🔗 Found image at: data.data[0].url`);
                }
                else if (imageResponse.data.data[0].b64_json) {
                    imageUrl = `data:image/webp;base64,${imageResponse.data.data[0].b64_json}`;
                    console.log(`🔗 Found image at: data.data[0].b64_json (converted to data URL)`);
                }
            }
            // Try direct image_url field
            else if (imageResponse.data.image_url) {
                imageUrl = imageResponse.data.image_url;
                console.log(`🔗 Found image at: data.image_url`);
            }
            // Try images array (Venice.ai returns raw base64 here!)
            else if (imageResponse.data.images && Array.isArray(imageResponse.data.images) && imageResponse.data.images[0]) {
                const rawData = imageResponse.data.images[0];
                // Check if it's raw base64 (starts with RIFF for WEBP or other format signatures)
                if (typeof rawData === 'string' && !rawData.startsWith('http') && !rawData.startsWith('data:')) {
                    imageUrl = `data:image/webp;base64,${rawData}`;
                    console.log(`🔗 Found RAW base64 at: data.images[0] - converted to data URL`);
                } else {
                    imageUrl = rawData;
                    console.log(`🔗 Found image at: data.images[0]`);
                }
            }
        }
        
        if (!imageUrl) {
            console.error('❌ Could not extract image URL. Response structure:', JSON.stringify(imageResponse.data, null, 2));
            throw new Error('Could not extract image URL from API response');
        }
        
        console.log(`✅ Image URL extracted: ${imageUrl.substring(0, 100)}...`);
        
        // If it's a remote URL (not base64), download and convert to base64 for reliable display
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            console.log(`📥 Downloading image and converting to base64...`);
            try {
                const imageDownload = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const base64Image = Buffer.from(imageDownload.data, 'binary').toString('base64');
                const dataUrl = `data:image/webp;base64,${base64Image}`;
                console.log(`✅ Converted to base64 data URL (${base64Image.length} bytes)`);
                return dataUrl;
            } catch (downloadError) {
                console.error(`⚠️  Failed to download image, returning original URL:`, downloadError.message);
                return imageUrl; // Fallback to original URL
            }
        }
        
        return imageUrl;
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
You are an award-winning children's book author in the style of Mo Willems, Oliver Jeffers, and Julia Donaldson. Create a MAGICAL, ENGAGING 8-page story that children will want to read again and again.

**Story Crafting Excellence:**
- Make it EMOTIONAL: Joy, wonder, friendship, discovery, courage
- Add SENSORY details: Colors, sounds, smells, feelings
- Include DIALOGUE when appropriate to bring characters to life
- Create MEMORABLE moments: Surprises, humor, touching scenes
- Build ANTICIPATION: Each page should make you want to turn to the next

**Perfect Story Structure:**
- Page 1: Establish character's world with vivid detail
- Page 2: Exciting inciting incident (something wonderful/surprising happens!)
- Page 3: Character takes action, exploration begins
- Page 4: Discovery or new challenge (raise the stakes)
- Page 5: Tension builds, character faces their biggest challenge
- Page 6: Climactic moment (the peak of the adventure!)
- Page 7: Resolution unfolds beautifully
- Page 8: Heartwarming ending with gentle life lesson

**CRITICAL RULES:**
1. ONE character name used consistently throughout
2. FLOWING narrative - each page continues naturally from the last
3. NEVER repeat "Once upon a time" or similar phrases
4. USE transition words: "Then", "Next", "Suddenly", "Meanwhile", "After that"
5. ABSOLUTELY NO MATH: NO equations (like 7+70+200), NO formulas, NO symbols like $$, $, \\frac, ^, =, +, -, *, /, NO LaTeX code, NO calculations
6. NO "Page 1:", "Page 2:" labels in the text itself
7. Write in SIMPLE, BEAUTIFUL prose - this is a STORY, not a math textbook
8. If the story involves counting or numbers, write them out as WORDS: "seven apples" not "7 apples"

**Grade Level ${gradeLevel}:**
- Grades 1-2: Simple words, short sentences (5-8 words), repetition, rhythm
- Grades 3-4: Richer vocabulary, varied sentence length, descriptive language, some dialogue
- Grades 5+: Complex sentences, sophisticated vocabulary, metaphors, deeper themes

**Language:** ${language}

**Output:** JSON only:
{
  "title": "An Engaging, Memorable Title",
  "story": [
    "Page 1 text - vivid opening...",
    "Page 2 text - exciting turn...",
    ... exactly 8 pages
  ]
}

Write like you're creating a TREASURE that families will read together at bedtime. Make every word count. Create magic.
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
        let { title, story } = storyData;
        
        // Clean math formulas and LaTeX from story text
        const cleanMathFromText = (text) => {
            if (!text) return text;
            
            let cleaned = text;
            
            // Remove inline LaTeX: $...$ or $$...$$
            cleaned = cleaned.replace(/\$\$[^\$]+\$\$/g, '');
            cleaned = cleaned.replace(/\$[^\$]+\$/g, '');
            
            // Remove LaTeX commands: \frac{...}{...}, \sqrt{...}, etc.
            cleaned = cleaned.replace(/\\[a-zA-Z]+\{[^}]*\}(\{[^}]*\})*/g, '');
            
            // Remove standalone math expressions with operators
            cleaned = cleaned.replace(/\b\d+[\+\-\*\/\^=]+\d+[\+\-\*\/\^=\d\s]*/g, '');
            
            // Remove mathematical symbols and operators
            cleaned = cleaned.replace(/[∫∑∏√∞≈≠≤≥±×÷]/g, '');
            
            // Clean up extra spaces
            cleaned = cleaned.replace(/\s+/g, ' ').trim();
            
            // Remove "as" followed by nothing or spaces (leftover from formula removal)
            cleaned = cleaned.replace(/\s+as\s*$/gi, '').replace(/\s+as\s+\./gi, '.');
            
            return cleaned;
        };
        
        // Apply cleaning to all story pages
        story = story.map(page => cleanMathFromText(page));
        title = cleanMathFromText(title);
        
        console.log(`Successfully generated story: "${title}"`);

        // 2. Generate a Consistent Character Description
        console.log("Generating consistent character description...");
        const characterDescSystemPrompt = `Based on this story, create a SHORT, VISUAL character description (max 100 words).

Story Title: ${title}
First page: ${story[0]}

Include ONLY visual details:
- Age and gender (use words: "young girl", "boy", NOT numbers like "12-year-old")
- Hair (color, style)
- Eyes (color)
- Clothing (2-3 items with colors)
- One distinctive feature (like a birthmark shape or accessory)

CRITICAL RULES:
- NO NUMBERS AT ALL (not even ages!)
- NO MATH FORMULAS OR EQUATIONS
- NO SYMBOLS like $$, $, \frac, ^, =, +
- ONLY descriptive words about physical appearance
- NO personality traits, NO backstory

Output ONLY the description, nothing else.`;
        
        const characterResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'mistral-31-24b',
            messages: [{ role: 'system', content: characterDescSystemPrompt }, { role: 'user', content: 'Generate SHORT character description now.' }],
            max_tokens: 150
        }, { headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` } });
        let characterDescription = characterResponse.data.choices[0].message.content.trim();
        
        // Clean any math formulas from character description too
        characterDescription = cleanMathFromText(characterDescription);
        
        console.log("📋 Character Description:", characterDescription);

        // 3. Generate all images with the character description
        const safeImageModel = enforceSafeImageModel(imageModel);
        console.log(`✨ User selected image model: ${imageModel}`);
        console.log(`✅ Using validated safe image model: ${safeImageModel}`);
        console.log(`🎨 Generating all illustrations with ${safeImageModel} in "${artStyle}" style...`);
        console.log(`📚 Generating COVER, 8 PAGES, and END PAGE = 10 total images`);
        
        // Generate cover (landscape format - max 1280 width)
        console.log(`\n🖼️  Generating COVER IMAGE...`);
        const coverPromise = generateImageForText(
            `Book cover for "${title}". ${story[0]}`, 
            artStyle, 
            safeImageModel, 
            characterDescription, 
            true, 
            title, 
            1280, 
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