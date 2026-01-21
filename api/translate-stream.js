// Lenz Streaming Translation API
// Vercel Serverless Function - Gemini 3 with Server-Sent Events

import { GoogleGenAI } from '@google/genai';

// Fast prompt - optimized for speed
const buildFastPrompt = (context) => `You are a manga translator. Analyze this manga page and translate all speech bubbles.

${context?.title ? `Manga: ${context.title}` : ''}

For each bubble, return ONE JSON object per line (NDJSON format):
{"bbox":[x%,y%,w%,h%],"japanese":"...","english":"...","emotion":"neutral|shouting|whispering|excited|sad|angry|scared","speaker":"...","culturalNote":null}

Output each bubble on its own line as you identify it. No array brackets, just one object per line.`;

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
Return ONE JSON object per line (NDJSON format), no array brackets:
{"bbox":[x,y,width,height],"japanese":"original text","english":"translated text","emotion":"emotion","speaker":"name","culturalNote":"explanation or null"}

Output each bubble on its own line as you identify it.`;

export const config = {
    maxDuration: 90,
};

// Allowed origins for CORS
const allowedOrigins = [
    'https://lenz-iota.vercel.app',
    'https://lenz-bgukzdj3u-weekijies-projects.vercel.app',
    'https://comic-walker.com'
];

export default async function handler(req, res) {
    // Handle CORS
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        // Return early for preflight if origin not allowed
        if (!origin || !allowedOrigins.includes(origin)) {
            res.status(403).end();
            return;
        }
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        if (!process.env.GEMINI_API_KEY) {
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
        const prompt = qualityMode ? buildQualityPrompt(context) : buildFastPrompt(context);
        
        console.log(`[Lenz Stream] Processing translation request (mode: ${qualityMode ? 'quality' : 'fast'})`);

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Extract base64 data
        let imageData = image;
        let mimeType = 'image/jpeg';

        if (image.startsWith('data:')) {
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                imageData = matches[2];
            }
        }

        // Use streaming API
        const streamResponse = await genAI.models.generateContentStream({
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
                maxOutputTokens: 16384
            }
        });

        let buffer = '';
        let bubbleCount = 0;

        // Process stream chunks
        for await (const chunk of streamResponse) {
            const text = chunk.text || '';
            buffer += text;

            // Try to extract complete JSON objects from buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',') continue;

                // Remove trailing comma if present
                const cleanLine = trimmed.replace(/,\s*$/, '');

                try {
                    const bubble = JSON.parse(cleanLine);
                    
                    // Validate and clean bubble
                    const cleanBubble = {
                        bbox: Array.isArray(bubble.bbox) ? bubble.bbox.map(Number) : [0, 0, 10, 5],
                        japanese: String(bubble.japanese || ''),
                        english: String(bubble.english || bubble.translation || ''),
                        emotion: String(bubble.emotion || 'neutral'),
                        speaker: String(bubble.speaker || 'unknown'),
                        culturalNote: bubble.culturalNote || null
                    };

                    bubbleCount++;
                    
                    // Send as SSE event
                    res.write(`data: ${JSON.stringify({ type: 'bubble', bubble: cleanBubble })}\n\n`);
                    
                    console.log(`[Lenz Stream] Sent bubble ${bubbleCount}`);
                } catch (e) {
                    // Not valid JSON yet, might be partial
                    console.log('[Lenz Stream] Skipping invalid line:', trimmed.substring(0, 50));
                }
            }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
            const cleanLine = buffer.trim().replace(/,\s*$/, '').replace(/^\[/, '').replace(/\]$/, '');
            if (cleanLine && cleanLine !== '[' && cleanLine !== ']') {
                try {
                    const bubble = JSON.parse(cleanLine);
                    const cleanBubble = {
                        bbox: Array.isArray(bubble.bbox) ? bubble.bbox.map(Number) : [0, 0, 10, 5],
                        japanese: String(bubble.japanese || ''),
                        english: String(bubble.english || bubble.translation || ''),
                        emotion: String(bubble.emotion || 'neutral'),
                        speaker: String(bubble.speaker || 'unknown'),
                        culturalNote: bubble.culturalNote || null
                    };
                    bubbleCount++;
                    res.write(`data: ${JSON.stringify({ type: 'bubble', bubble: cleanBubble })}\n\n`);
                } catch (e) {
                    // Ignore final parse errors
                }
            }
        }

        // Send completion event
        res.write(`data: ${JSON.stringify({ type: 'done', count: bubbleCount })}\n\n`);
        console.log(`[Lenz Stream] Complete: ${bubbleCount} bubbles`);
        
        res.end();

    } catch (error) {
        console.error('[Lenz Stream] Error:', error);
        
        // Handle specific Gemini API errors
        const errorMessage = error.message || 'Translation failed';
        const statusCode = error.status || error.statusCode || 500;
        
        // Build error response based on error type
        let errorResponse = { type: 'error', message: errorMessage, code: 'INTERNAL_ERROR' };
        let httpStatus = 500;
        
        // Check for rate limit errors (429)
        if (statusCode === 429 || errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('quota')) {
            httpStatus = 429;
            errorResponse = {
                type: 'error',
                code: 'RATE_LIMIT',
                message: 'Too many requests. This demo uses Gemini API free tier with limited quota. Please wait a moment and try again.',
                retryAfter: 60
            };
        }
        // Check for service unavailable (503)
        else if (statusCode === 503 || errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded') || errorMessage.toLowerCase().includes('unavailable')) {
            httpStatus = 503;
            errorResponse = {
                type: 'error',
                code: 'SERVICE_UNAVAILABLE',
                message: 'Gemini API is temporarily unavailable or overloaded. Please try again in a few seconds.'
            };
        }
        // Check for not found (404)
        else if (statusCode === 404 || errorMessage.includes('404') || errorMessage.toLowerCase().includes('not found')) {
            httpStatus = 404;
            errorResponse = {
                type: 'error',
                code: 'NOT_FOUND',
                message: 'The requested model or endpoint was not found. Please try again later.'
            };
        }
        
        // Try to send error as SSE if headers already sent
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
            res.end();
        } else {
            res.status(httpStatus).json(errorResponse);
        }
    }
}
