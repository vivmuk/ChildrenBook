const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const VENICE_API_KEY = process.env.VENICE_API_KEY
    || process.env.VENICE_TOKEN
    || process.env.VITE_VENICE_API_KEY
    || process.env.API_KEY
    || '';

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

// Helper function for image generation
async function generateImageForText(
    text,
    artStyle,
    imageModel,
    characterDescription,
    isCover = false,
    title = '',
    size = "1024x1024"
) {
    if (!veniceEnabled) {
        throw new Error('Venice.ai API is not configured.');
    }
    const safeImageModelId = enforceSafeImageModel(imageModel);
    const rawPromptLimit = getPromptCharacterLimit(safeImageModelId);
    const promptLimitBuffer = 50;
    const promptLimit = Math.max(1, rawPromptLimit - promptLimitBuffer);
    let imagePromptSystem;
    
    if (isCover) {
        imagePromptSystem = `You are an expert art director creating a book cover illustration. Create a rich, detailed, and imaginative image prompt for an AI model. The prompt must generate a vibrant, friendly, and colorful book cover in a playful cartoon style. CRITICAL: The image MUST prominently display the title text "${title}" as readable text integrated into the cover design - this could be on a sign, banner, building, or stylized lettering that fits the scene. The title text should be large, clear, and easily readable. The requested art style is a suggestion, but the final image MUST be a cartoon. The main character MUST match this description: "${characterDescription}". Art Style: ${artStyle}.`;
    } else {
        imagePromptSystem = `You are an expert art director creating illustrations for a children's book. Create a rich, detailed, and imaginative image prompt for an AI model. The prompt must generate a vibrant, friendly, and colorful image in a playful cartoon style. It should capture the essence of the following text. Focus on scene, characters, emotion, and lighting. The final output should be a single, descriptive paragraph. The requested art style is a suggestion, but the final image MUST be a cartoon. The main character MUST match this description: "${characterDescription}". Art Style: ${artStyle}.`;
    }

    if (artStyle.toLowerCase().includes('ghibli')) {
        if (isCover) {
            imagePromptSystem = `You are an expert art director specializing in the Studio Ghibli aesthetic for a children's book cover. Create a rich, detailed, and imaginative image prompt that captures a playful cartoon style inspired by Ghibli. CRITICAL: The image MUST prominently display the title text "${title}" as readable text integrated into the cover design - this could be on a wooden sign, magical banner, or stylized lettering that fits the Ghibli aesthetic. The title text should be large, clear, and easily readable. Emphasize lush, painterly backgrounds, whimsical scenery, and the interplay of light and nature. The final image MUST be a cartoon that evokes the feeling of a Ghibli film. Art Style: ${artStyle}. The main character MUST match this description: "${characterDescription}".`;
        } else {
            imagePromptSystem = `You are an expert art director specializing in the Studio Ghibli aesthetic for a children's book. Create a rich, detailed, and imaginative image prompt that captures the provided text in a playful cartoon style inspired by Ghibli. Emphasize lush, painterly backgrounds, whimsical scenery, and the interplay of light and nature. The final image MUST be a cartoon that evokes the feeling of a Ghibli film. The final output must be a single, descriptive paragraph. Art Style: ${artStyle}. The main character MUST match this description: "${characterDescription}".`;
        }
    }

    const promptGenResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model: 'mistral-31-24b',
        messages: [{ role: 'system', content: imagePromptSystem }, { role: 'user', content: `Text: "${text}"` }]
    }, { headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` } });

    let imagePrompt = promptGenResponse.data.choices[0].message.content;
    if (imagePrompt.length > promptLimit) {
        console.log(`Truncating long image prompt to ${promptLimit} chars to respect ${safeImageModelId}'s ${rawPromptLimit}-character limit.`);
        imagePrompt = imagePrompt.substring(0, promptLimit);
    }

    const imageRequestPayload = buildSafeImagePayload({
        prompt: imagePrompt,
        n: 1,
        size,
        response_format: 'url',
    }, safeImageModelId);

    const imageResponse = await axios.post('https://api.venice.ai/api/v1/images/generations', imageRequestPayload, {
        headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
    });

    return imageResponse.data.data[0].url;
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
        const characterDescSystemPrompt = `Based on the following children's story, create a single, detailed character description for the main protagonist. Describe their appearance, gender, age, and clothing in a consistent manner. This description will be used to generate all illustrations. Output ONLY the description as a single paragraph. Story: ${JSON.stringify(storyData)}`;
        const characterResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'mistral-31-24b',
            messages: [{ role: 'system', content: characterDescSystemPrompt }, { role: 'user', content: 'Generate the character description.' }]
        }, { headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` } });
        const characterDescription = characterResponse.data.choices[0].message.content;
        console.log("Character Description:", characterDescription);

        // 3. Generate all images with the character description
        const safeImageModel = enforceSafeImageModel(imageModel);
        console.log(`Generating all illustrations with image model: ${safeImageModel}...`);
        const coverPromise = generateImageForText(`A beautiful book cover for a story titled "${title}"`, artStyle, safeImageModel, characterDescription, true, title, "1792x1024");
        const pageImagePromises = story.map(pageText => generateImageForText(pageText, artStyle, safeImageModel, characterDescription, false, '', "1024x1024"));
        const endPagePromise = generateImageForText(`A beautiful "The End" illustration that matches the theme and style of the story "${title}". Show a magical, whimsical "The End" sign or text integrated naturally into a scene that reflects the story's mood and setting.`, artStyle, safeImageModel, characterDescription, false, '', "1024x1024");
        const allImages = await Promise.all([coverPromise, ...pageImagePromises, endPagePromise]);
        const coverImageUrl = allImages[0];
        const pageImageUrls = allImages.slice(1, -1);
        const endPageImageUrl = allImages[allImages.length - 1];
        console.log("All images generated successfully.");

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