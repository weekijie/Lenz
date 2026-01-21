// Manga Lens Translation API
// Vercel Serverless Function - Gemini 3 Integration

import { GoogleGenAI } from '@google/genai';

// Translation prompt template - optimized for speed
const buildPrompt = (context) => `You are a manga translator. Analyze this manga page and translate all speech bubbles.

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
                console.log('[Manga Lens API] Response structure:', responseStr.substring(0, 1000));
                
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
                console.error('[Manga Lens API] Could not extract text from response');
            }
        } catch (extractError) {
            console.error('[Manga Lens API] Error extracting text:', extractError);
            text = null;
        }

        console.log('[Manga Lens API] Raw response:', text?.substring?.(0, 300));

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
                console.log('[Manga Lens API] Initial parse failed, attempting repair...');
                
                if (jsonText.startsWith('[')) {
                    // Strategy 1: Find last complete object and close array
                    const lastCompleteObject = findLastCompleteObject(jsonText);
                    if (lastCompleteObject) {
                        try {
                            bubbles = JSON.parse(lastCompleteObject);
                            console.log('[Manga Lens API] Repaired JSON (strategy 1): found', bubbles.length, 'complete bubbles');
                        } catch (repairError) {
                            // Strategy 2: Try to find any valid JSON array
                            const match = jsonText.match(/\[[\s\S]*?\}/);
                            if (match) {
                                try {
                                    bubbles = JSON.parse(match[0] + ']');
                                    console.log('[Manga Lens API] Repaired JSON (strategy 2): found', bubbles.length, 'bubbles');
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
            console.error('[Manga Lens API] Failed to parse response:', parseError);
            console.error('[Manga Lens API] Raw text:', text?.substring?.(0, 500) || 'null');

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
