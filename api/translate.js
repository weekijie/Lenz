// Lenz Translation API
// Vercel Serverless Function - Gemini 3 Integration

import { GoogleGenAI } from '@google/genai';

// Fast prompt - optimized for speed
const buildFastPrompt = (context) => `You are a manga translator. Analyze this manga page and translate all speech bubbles.

${context?.title ? `Manga: ${context.title}` : ''}

For each bubble, return:
- bbox: [x%, y%, width%, height%] position relative to image
- japanese: original text
- english: natural English translation
- emotion: neutral|shouting|whispering|excited|sad|angry|scared
- speaker: character name or "unknown"
- culturalNote: brief explanation if needed, else null

Return ONLY a JSON array, no markdown:
[{"bbox":[x,y,w,h],"japanese":"...","english":"...","emotion":"...","speaker":"...","culturalNote":null}]`;

// Quality prompt - detailed analysis with cultural notes
const buildQualityPrompt = (context) => `You are a professional manga translator specializing in Japanese to English translation.

**MANGA CONTEXT:**
${context?.title ? `- Title: ${context.title}` : ''}
${context?.synopsis ? `- Synopsis: ${context.synopsis}` : ''}
${context?.tags?.length ? `- Genre/Tags: ${context.tags.join(', ')}` : ''}

**YOUR TASK:**
Analyze the attached manga page image carefully. For each speech bubble or text box:

1. **LOCATE**: Identify the bounding box as percentage coordinates [x%, y%, width%, height%] relative to the image dimensions.

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

5. **IDENTIFY SPEAKER**: Based on bubble tail direction and visual context, provide character name or "unknown"

6. **CULTURAL NOTE**: If the text contains Japanese idioms, puns, wordplay, or cultural references a Western reader might miss, add a brief explanation. Otherwise, set to null.

**OUTPUT FORMAT:**
Return ONLY a valid JSON array, no markdown code blocks:
[{"bbox":[x,y,width,height],"japanese":"original text","english":"translated text","emotion":"emotion","speaker":"name","culturalNote":"explanation or null"}]`;

import Cors from 'cors';

export const config = {
    maxDuration: 90,
};

// Allowed origins for CORS
const allowedOrigins = [
    'https://lenz-iota.vercel.app',
    'https://lenz-bgukzdj3u-weekijies-projects.vercel.app',
    'https://comic-walker.com'
];

// Initialize the cors middleware
const cors = Cors({
    methods: ['GET', 'POST', 'OPTIONS'],
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true
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
            console.error('[Lenz API] GEMINI_API_KEY not set');
            res.status(500).json({ error: 'API key not configured' });
            return;
        }

        const { image, context, mode } = req.body;

        if (!image) {
            res.status(400).json({ error: 'No image provided' });
            return;
        }

        // Select prompt based on mode (default: fast)
        const qualityMode = mode === 'quality';
        
        console.log(`[Lenz API] Processing translation request (mode: ${qualityMode ? 'quality' : 'fast'})`);
        console.log('[Lenz API] Context:', context?.title || 'No context');

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
        const prompt = qualityMode ? buildQualityPrompt(context) : buildFastPrompt(context);

        // Call Gemini API with multimodal input
        // Using the @google/genai SDK v1.x pattern
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
                maxOutputTokens: 16384  // Increased to handle pages with many bubbles
            }
        });

        // Extract text from response - @google/genai SDK v1.x
        let text;
        try {
            // The SDK v1.x returns response with different structures depending on version
            // Try multiple access patterns
            if (typeof response.text === 'string') {
                text = response.text;
            } else if (typeof response.text === 'function') {
                text = response.text();
            } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
                text = response.candidates[0].content.parts[0].text;
            } else if (response.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
                text = response.response.candidates[0].content.parts[0].text;
            } else {
                // Log full structure for debugging (truncated)
                const responseStr = JSON.stringify(response, null, 2);
                console.log('[Lenz API] Response structure:', responseStr.substring(0, 1000));
                
                // Try to find text in the response object recursively
                const findText = (obj, depth = 0) => {
                    if (depth > 5 || !obj) return null;
                    if (typeof obj === 'string' && obj.startsWith('[')) return obj;
                    if (typeof obj !== 'object') return null;
                    for (const key of Object.keys(obj)) {
                        if (key === 'text' && typeof obj[key] === 'string') return obj[key];
                        const found = findText(obj[key], depth + 1);
                        if (found) return found;
                    }
                    return null;
                };
                text = findText(response);
            }

            if (!text) {
                console.error('[Lenz API] Could not extract text from response');
            }
        } catch (extractError) {
            console.error('[Lenz API] Error extracting text:', extractError);
            text = null;
        }

        console.log('[Lenz API] Raw response:', text?.substring?.(0, 300));

        // Parse the JSON response
        let bubbles;
        try {
            // Try to extract JSON from the response (handle potential markdown wrapping)
            let jsonText = (text || '').trim();

            // Remove markdown code blocks if present
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            // Try parsing directly first
            try {
                bubbles = JSON.parse(jsonText);
            } catch (e) {
                // Attempt to repair truncated JSON
                console.log('[Lenz API] Initial parse failed, attempting repair...');
                
                if (jsonText.startsWith('[')) {
                    // Strategy 1: Find last complete object and close array
                    const lastCompleteObject = findLastCompleteObject(jsonText);
                    if (lastCompleteObject) {
                        try {
                            bubbles = JSON.parse(lastCompleteObject);
                            console.log('[Lenz API] Repaired JSON (strategy 1): found', bubbles.length, 'complete bubbles');
                        } catch (repairError) {
                            // Strategy 2: Try to find any valid JSON array
                            const match = jsonText.match(/\[[\s\S]*?\}/);
                            if (match) {
                                try {
                                    bubbles = JSON.parse(match[0] + ']');
                                    console.log('[Lenz API] Repaired JSON (strategy 2): found', bubbles.length, 'bubbles');
                                } catch {
                                    throw e; // Throw original error
                                }
                            } else {
                                throw e;
                            }
                        }
                    } else {
                        throw e;
                    }
                } else {
                    throw e;
                }
            }

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
            console.error('[Lenz API] Failed to parse response:', parseError);
            console.error('[Lenz API] Raw text:', text?.substring?.(0, 500) || 'null');

            // Return empty bubbles on parse error
            bubbles = [];
        }

        console.log('[Lenz API] Found', bubbles.length, 'bubbles');

        res.status(200).json({
            success: true,
            bubbles: bubbles,
            context: context?.title || null
        });

    } catch (error) {
        console.error('[Lenz API] Error:', error);

        // Handle specific Gemini API errors
        const errorMessage = error.message || 'Translation failed';
        const statusCode = error.status || error.statusCode || 500;
        
        // Check for rate limit errors (429)
        if (statusCode === 429 || errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('quota')) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                code: 'RATE_LIMIT',
                message: 'Too many requests. This demo uses Gemini API free tier with limited quota. Please wait a moment and try again.',
                retryAfter: 60
            });
        }
        
        // Check for service unavailable (503)
        if (statusCode === 503 || errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded') || errorMessage.toLowerCase().includes('unavailable')) {
            return res.status(503).json({
                error: 'Service unavailable',
                code: 'SERVICE_UNAVAILABLE',
                message: 'Gemini API is temporarily unavailable or overloaded. Please try again in a few seconds.'
            });
        }
        
        // Check for not found (404)
        if (statusCode === 404 || errorMessage.includes('404') || errorMessage.toLowerCase().includes('not found')) {
            return res.status(404).json({
                error: 'Not found',
                code: 'NOT_FOUND',
                message: 'The requested model or endpoint was not found. Please try again later.'
            });
        }

        res.status(500).json({
            error: errorMessage,
            code: 'INTERNAL_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

// Helper function to find the last complete JSON object in a truncated array
function findLastCompleteObject(jsonText) {
    // Count brackets to find where valid objects end
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let lastValidEnd = -1;
    
    for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];
        
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        
        if (char === '\\' && inString) {
            escapeNext = true;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
            continue;
        }
        
        if (inString) continue;
        
        if (char === '[' || char === '{') {
            depth++;
        } else if (char === ']' || char === '}') {
            depth--;
            // If we're back to depth 1 (inside the main array) after closing an object
            if (depth === 1 && char === '}') {
                lastValidEnd = i;
            }
        }
    }
    
    if (lastValidEnd > 0) {
        return jsonText.substring(0, lastValidEnd + 1) + ']';
    }
    
    return null;
}
