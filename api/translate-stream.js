// Manga Lens Streaming Translation API
// Vercel Serverless Function - Gemini 3 with Server-Sent Events

import { GoogleGenAI } from '@google/genai';

// Translation prompt template - optimized for speed
const buildPrompt = (context) => `You are a manga translator. Analyze this manga page and translate all speech bubbles.

${context?.title ? `Manga: ${context.title}` : ''}

For each bubble, return ONE JSON object per line (NDJSON format):
{"bbox":[x%,y%,w%,h%],"japanese":"...","english":"...","emotion":"neutral|shouting|whispering|excited|sad|angry|scared","speaker":"...","culturalNote":null}

Output each bubble on its own line as you identify it. No array brackets, just one object per line.`;

export const config = {
    maxDuration: 60,
};

export default async function handler(req, res) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
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

        const { image, context } = req.body;

        if (!image) {
            res.status(400).json({ error: 'No image provided' });
            return;
        }

        console.log('[Manga Lens Stream] Processing translation request');

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

        const prompt = buildPrompt(context);

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
                    
                    console.log(`[Manga Lens Stream] Sent bubble ${bubbleCount}`);
                } catch (e) {
                    // Not valid JSON yet, might be partial
                    console.log('[Manga Lens Stream] Skipping invalid line:', trimmed.substring(0, 50));
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
        console.log(`[Manga Lens Stream] Complete: ${bubbleCount} bubbles`);
        
        res.end();

    } catch (error) {
        console.error('[Manga Lens Stream] Error:', error);
        
        // Try to send error as SSE if headers already sent
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: error.message });
        }
    }
}
