// Manga Lens Translation API
// Vercel Serverless Function - Gemini 3 Integration

import { GoogleGenAI } from '@google/genai';

// Translation prompt template
const buildPrompt = (context) => `You are a professional manga translator specializing in Japanese to English translation.

**MANGA CONTEXT:**
${context?.title ? `- Title: ${context.title}` : ''}
${context?.synopsis ? `- Synopsis: ${context.synopsis}` : ''}
${context?.tags?.length ? `- Genre/Tags: ${context.tags.join(', ')}` : ''}

**YOUR TASK:**
Analyze the attached manga page image carefully. For each speech bubble or text box you find:

1. **LOCATE**: Identify the bounding box as percentage coordinates [x%, y%, width%, height%] relative to the image dimensions. x,y is the top-left corner.

2. **READ**: Extract the original Japanese text inside the bubble.

3. **TRANSLATE**: Provide a natural, contextual English translation that:
   - Matches the character's personality and the scene's mood
   - Uses appropriate tone (casual, formal, dramatic, etc.)
   - Preserves any humor or wordplay when possible

4. **DETECT EMOTION**: Analyze the speaker's emotion by looking at:
   - Facial expression in the panel
   - Speech bubble style (jagged = shouting, wavy = scared, cloud = thought)
   - Art effects (speed lines, sweat drops, anger symbols)
   - Choose from: neutral, shouting, whispering, excited, sad, angry, scared

5. **IDENTIFY SPEAKER**: If you can determine who is speaking based on:
   - The bubble's tail pointing to a character
   - Visual context in the panel
   - Provide the character name or "unknown"

6. **CULTURAL NOTE**: If the text contains any of the following, add an explanation:
   - Japanese idioms that don't translate directly
   - Puns or wordplay (explain the original joke)
   - Cultural references a Western reader might miss
   - Honorifics usage that affects meaning

**IMPORTANT RULES:**
- Return ONLY valid JSON, no markdown code blocks
- If no speech bubbles are found, return an empty array: []
- Bounding box values must be percentages (0-100)
- Be accurate with bubble positions - they will be used for overlays

**OUTPUT FORMAT:**
Return a JSON array with this exact structure:
[
  {
    "bbox": [x, y, width, height],
    "japanese": "original Japanese text",
    "english": "translated English text",
    "emotion": "detected emotion",
    "speaker": "character name or unknown",
    "culturalNote": "explanation if applicable, or null"
  }
]`;

import Cors from 'cors';

// Initialize the cors middleware
const cors = Cors({
    methods: ['GET', 'POST', 'OPTIONS'],
    origin: '*', // Allow all origins
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: false // Important: must be false when origin is "*"
});

// Helper method to wait for a middleware to execute before continuing
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

export default async function handler(req, res) {
    // Run the middleware
    try {
        await runMiddleware(req, res, cors);
    } catch (e) {
        console.error('CORS Middleware Error:', e);
        return res.status(500).json({ error: 'Internal Server Error (CORS)' });
    }

    // Only accept POST
    if (req.method !== 'POST') {
        // OPTIONS is handled by cors middleware automatically (returns 204)
        // If we get here, it's likely a GET or other method
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        // Check for API key
        if (!process.env.GEMINI_API_KEY) {
            console.error('[Manga Lens API] GEMINI_API_KEY not set');
            res.status(500).json({ error: 'API key not configured' });
            return;
        }

        const { image, context } = req.body;

        if (!image) {
            res.status(400).json({ error: 'No image provided' });
            return;
        }

        console.log('[Manga Lens API] Processing translation request');
        console.log('[Manga Lens API] Context:', context?.title || 'No context');

        // Initialize Gemini client
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Extract base64 data from data URL if needed
        let imageData = image;
        let mimeType = 'image/jpeg';

        if (image.startsWith('data:')) {
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                imageData = matches[2];
            }
        }

        // Build the prompt with context
        const prompt = buildPrompt(context);

        // Call Gemini 3 API with multimodal input
        const response = await genAI.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: imageData
                            }
                        }
                    ]
                }
            ],
            config: {
                temperature: 0.3,
                topP: 0.8,
                maxOutputTokens: 4096
            }
        });

        const text = response.text;

        console.log('[Manga Lens API] Raw response:', text?.substring(0, 200));

        // Parse the JSON response
        let bubbles;
        try {
            // Try to extract JSON from the response (handle potential markdown wrapping)
            let jsonText = (text || '').trim();

            // Remove markdown code blocks if present
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            bubbles = JSON.parse(jsonText);

            // Validate structure
            if (!Array.isArray(bubbles)) {
                throw new Error('Response is not an array');
            }

            // Validate and clean each bubble
            bubbles = bubbles.map((bubble, index) => ({
                bbox: Array.isArray(bubble.bbox) ? bubble.bbox.map(Number) : [0, 0, 10, 5],
                japanese: String(bubble.japanese || ''),
                english: String(bubble.english || bubble.translation || ''),
                emotion: String(bubble.emotion || 'neutral'),
                speaker: String(bubble.speaker || 'unknown'),
                culturalNote: bubble.culturalNote || bubble.cultural_note || null
            }));

        } catch (parseError) {
            console.error('[Manga Lens API] Failed to parse response:', parseError);
            console.error('[Manga Lens API] Raw text:', text);

            // Return empty bubbles on parse error
            bubbles = [];
        }

        console.log('[Manga Lens API] Found', bubbles.length, 'bubbles');

        res.status(200).json({
            success: true,
            bubbles: bubbles,
            context: context?.title || null
        });

    } catch (error) {
        console.error('[Manga Lens API] Error:', error);

        res.status(500).json({
            error: error.message || 'Translation failed',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
