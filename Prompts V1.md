# Children's Book Generator - Prompts V1

This document contains all the AI prompts used in the Children's Book Generator system.

---

## Table of Contents
1. [Story Generation Prompt](#story-generation-prompt)
2. [Character Description Prompt](#character-description-prompt)
3. [Image Prompt Generation - Cover](#image-prompt-generation---cover)
4. [Image Prompt Generation - Pages](#image-prompt-generation---pages)

---

## Story Generation Prompt

**Model Used:** User-selected text model (default: mistral-31-24b)

**Purpose:** Generate a cohesive 8-page children's story with proper narrative flow

**System Prompt:**
```
You are a children's book author creating a COHESIVE 8-page story that flows naturally.

**Story Structure:**
- Page 1: Introduce main character in their normal world
- Page 2: Adventure begins (something happens)
- Page 3-4: Character explores/faces challenges
- Page 5-6: Climax - biggest challenge or discovery
- Page 7: Resolution and solution
- Page 8: Happy ending with lesson learned

**CRITICAL RULES:**
1. Use the SAME character name throughout (pick ONE name)
2. Each page continues from the previous - NOT a new start
3. DO NOT repeat "Once upon a time" on every page
4. Use transition words: "Then", "Next", "Suddenly", "After that", etc.
5. Keep it ONE continuous story flowing across 8 pages

**Grade Level ${gradeLevel}:**
- Grades 1-2: Short simple sentences, repetition
- Grades 3-4: Descriptive language, some dialogue
- Grades 5+: Rich vocabulary, complex sentences

**Language:** ${language}

**Output:** JSON only:
{
  "title": "Story Title",
  "story": ["Page 1...", "Page 2...", ... 8 pages total]
}

Each page should be 2-4 sentences that CONTINUE the story from the previous page.
```

**User Message:**
```
The story idea is: ${prompt}
```

**Variables:**
- `${gradeLevel}` - Reading level (1-5)
- `${language}` - Target language (English, Spanish, French, German, Hindi, Gujarati)
- `${prompt}` - User's story idea

**Output Format:** JSON object with title and 8-page story array

---

## Character Description Prompt

**Model Used:** mistral-31-24b

**Purpose:** Generate a concise, visual character description for consistent illustrations

**System Prompt:**
```
Based on this story, create a SHORT, VISUAL character description (max 100 words).

Story Title: ${title}
First page: ${story[0]}

Include ONLY visual details:
- Age and gender
- Hair (color, style)
- Eyes (color)
- Clothing (2-3 items with colors)
- One distinctive feature

Keep it simple and visual. NO personality traits, NO backstory, NO math formulas.
Output ONLY the description, nothing else.
```

**User Message:**
```
Generate SHORT character description now.
```

**Max Tokens:** 150

**Variables:**
- `${title}` - Generated story title
- `${story[0]}` - First page of the story

**Output Format:** Plain text, max 100 words, visual details only

**Example Output:**
```
A 10-year-old girl with long wavy brown hair and hazel eyes. She wears a green plaid shirt with rolled-up sleeves, blue shorts, and white sneakers. Around her neck is a small dragon pendant necklace. Her freckled face often lights up with curiosity.
```

---

## Image Prompt Generation - Cover

**Model Used:** mistral-31-24b

**Purpose:** Generate optimized image prompt for book cover (targeting ~900 characters)

**System Prompt:**
```
You are an expert at creating concise, high-quality image generation prompts for children's book covers.

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
Output ONLY the prompt, nothing else.
```

**User Message:**
```
Generate the optimized image prompt now.
```

**Max Tokens:** 500

**Variables:**
- `${title}` - Story title
- `${artStyle}` - Selected art style (e.g., "Classic storybook", "Studio Ghibli inspired")
- `${characterDescription}` - Generated character description
- `${text}` - Book cover text/story opening
- `${targetLength}` - 900 characters

**Target Length:** 900 characters (max 1350 safety limit)

**Image Generation Parameters:**
- Model: User-selected (venice-sd35, hidream, flux-dev, qwen-image, wai-Illustrious)
- Dimensions: 1280x1024 (landscape)
- Negative Prompt: "ugly, deformed, distorted, scary, dark, violent, nsfw, adult content, inappropriate, blurry, low quality"
- Steps: 25
- CFG Scale: 7.5
- Safe Mode: true
- Hide Watermark: false
- Format: webp

---

## Image Prompt Generation - Pages

**Model Used:** mistral-31-24b

**Purpose:** Generate optimized image prompt for story pages (targeting ~900 characters)

**System Prompt:**
```
You are an expert at creating concise, high-quality image generation prompts for children's book illustrations.

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
Output ONLY the prompt, nothing else.
```

**User Message:**
```
Generate the optimized image prompt now.
```

**Max Tokens:** 500

**Variables:**
- `${artStyle}` - Selected art style
- `${characterDescription}` - Generated character description
- `${text}` - Page text content
- `${targetLength}` - 900 characters

**Target Length:** 900 characters (max 1350 safety limit)

**Image Generation Parameters:**
- Model: User-selected (venice-sd35, hidream, flux-dev, qwen-image, wai-Illustrious)
- Dimensions: 1024x1024 (square)
- Negative Prompt: "ugly, deformed, distorted, scary, dark, violent, nsfw, adult content, inappropriate, blurry, low quality"
- Steps: 25
- CFG Scale: 7.5
- Safe Mode: true
- Hide Watermark: false
- Format: webp

---

## Art Style Options

Available art styles that users can select:

1. **Classic storybook** (default)
2. **Dreamy watercolour**
3. **Playful cartoon**
4. **Studio Ghibli inspired**
5. **Bold comic panels**
6. **Cozy pastel picture book**
7. **Whimsical paper cutout**
8. **Vibrant pop art adventure**
9. **Gentle pencil sketch**
10. **Magical night sky**
11. **Retro 80s picture book**
12. **Mythic stained glass**
13. **Futuristic neon sci-fi**
14. **Warm claymation diorama**

---

## Safe Image Models

Only these Venice.ai models are allowed (with safe_mode enforced):

1. **venice-sd35** - Venice SD35 (1500 char limit)
2. **hidream** - HiDream (1500 char limit)
3. **flux-dev** - FLUX Standard (2048 char limit)
4. **qwen-image** - Qwen Image (1500 char limit)
5. **wai-Illustrious** - Anime/WAI (1500 char limit)

---

## Prompt Engineering Best Practices

### Story Generation
- ✅ Clear narrative structure (beginning, middle, end)
- ✅ Explicit rules against repetition
- ✅ Transition words requirement
- ✅ Grade-level appropriate language
- ✅ Character name consistency
- ✅ JSON output format

### Character Description
- ✅ Keep under 100 words
- ✅ Visual details only (no personality/backstory)
- ✅ Specific colors and features
- ✅ Distinctive elements for recognition

### Image Prompts
- ✅ Use LLM to intelligently distill context
- ✅ Target 900 chars, max 1350 for safety
- ✅ Include art style explicitly
- ✅ Reference character description for consistency
- ✅ Focus on visual storytelling
- ✅ Specific colors, lighting, composition
- ✅ Negative prompts to avoid inappropriate content

---

## API Endpoints Used

### Text Generation
- **Endpoint:** `https://api.venice.ai/api/v1/chat/completions`
- **Method:** POST
- **Headers:** `Authorization: Bearer ${VENICE_API_KEY}`

### Image Generation
- **Endpoint:** `https://api.venice.ai/api/v1/image/generate`
- **Method:** POST
- **Headers:** 
  - `Authorization: Bearer ${VENICE_API_KEY}`
  - `Content-Type: application/json`

---

## Changelog

**Version 1.0** - October 7, 2025
- Initial prompt system
- Story generation with 8-page structure
- Short character descriptions (max 100 words)
- LLM-based image prompt optimization
- Multi-format API response handling
- Safe mode enforcement for all images

---

## Notes

- All prompts are designed to work with Venice.ai's API
- Character consistency is maintained across all 10 images (cover + 8 pages + end)
- Prompts are intelligently compressed by LLM to stay under model limits
- Safe mode is enforced on all image generation
- Grade-level adaptation ensures age-appropriate content

