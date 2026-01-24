# Lenz - Devpost Submission

## Inspiration
As manga fans, we've all experienced the frustration of waiting months for official translations. Existing translation tools use basic OCR that miss context, emotions, and cultural nuances. We wanted to create something that truly understands manga.

## What it does
Lenz translates Japanese manga pages in real-time using Gemini 3's multimodal AI. Unlike traditional OCR translators, it:
- **Streams translations** bubble-by-bubble as they're processed (~3-5s for first result)
- **Detects emotions** from facial expressions and art effects (shouting, whispering, etc.)
- **Two Modes**: "Fast Mode" for quick reading, and "Quality Mode" for deeper analysis
- **Explains cultural references** with contextual notes for idioms and puns
- **Positions overlays precisely** using AI-detected bounding boxes
- **Resizable & draggable overlays** with PowerPoint-style handles for manual adjustments

## How we built it
We leveraged **Gemini 3 Flash**'s vision capabilities to analyze manga images holistically.
- **Frontend**: A Web Demo (Vanilla JS) and a pure Chrome Extension (Manifest V3) that injects overlays directly into Comic Walker.
- **Backend**: Hosted on **Vercel Serverless Functions** for scalability.
- **Streaming**: Used **Server-Sent Events (SSE)** to stream Gemini's partial responses to the client, making the app feel instant despite complex AI processing.
- **Fallback Strategy**: Implemented a robust fallback to effective HTTP requests if streaming connections fail.

## Challenges we ran into
- **API Rate Limits & Error Handling**: The Gemini API free tier errors were noisy (429, 503, 404). We had to centralize error handling to distinguish between "wait a minute" (RPM limit) and "come back tomorrow" (Daily Quota), and surface friendly toast messages to users instead of crashing.
- **Streaming vs Non-Streaming JSON**: Parsing streaming responses (SSE) is tricky when the AI outputs partial JSON chunks. We built a robust buffering system to reconstruct valid bubbles on the fly, with a seamless fallback to the non-streaming endpoint if connections failed.
- **Dual-Prompt Management**: Balancing "Fast Mode" (speed) and "Quality Mode" (cultural notes) meant managing two distinct prompts and ensuring the frontend could toggle between them without latency penalties.
- **CORS & Security**: Restricting API access to only our specific Chrome Extension ID and web demo required a custom verify-origin middleware, preventing API key exposure while allowing legitimate cross-origin requests.
- **Visual Nuances**: Distinguishing between a "shout" (jagged bubble) and a "whisper" (dashed bubble) purely from vision required heavy prompt engineering, as traditional OCR often misses these subtle context cues.

## Accomplishments that we're proud of
- **Real-Time Experience**: Achieving a "streaming" feel for static image translation changes the UX completely. Users don't wait 30s for the whole page; they start reading in seconds.
- **The UI Polish**: Adding PowerPoint-style resize handles to the overlays makes the tool feel like a professional editor rather than just a demo.
- **Seamless Integration**: The extension works right on top of a legal manga site (Comic Walker) without breaking its layout or functionality.

## What we learned
- **The power of Multimodal AI**: We initially tried to OCR text first, then translate. We learned that letting Gemini see the *image* allows it to capture nuances (like "scary font" or "happy face") that raw text misses.
- **Stream parsing is non-trivial**: Handling JSON streams over SSE taught us a lot about robust error recovery and buffering strategies.
- **User expectations vs. Reality**: Users hate waiting. Even if the total time is the same, showing *something* (the first bubble) in 3 seconds is infinitely better than showing everything in 15 seconds.


## Gemini 3 Features Used
- **Multimodal Vision**: Analyzes images + text context simultaneously to understand "who is speaking" based on tail direction.
- **Streaming API**: `generateContentStream()` allows us to pipe individual bubbles to the frontend as soon as they are detected.
- **Structured Output**: We prompt for specific JSON arrays containing `bbox`, `emotion`, and `culturalNote` fields.

## What's next for Lenz
- Support for more manga platforms 
- Offline caching for previously translated pages
- Community-contributed translation improvements

## Built With
- **Chrome Extension** (Manifest V3)
- **Gemini 3 Flash** (Multimodal Vision API)
- **Node.js** & **Vercel Serverless**
- **Vanilla JS** (No heavy frameworks for speed)
- **Server-Sent Events (SSE)** for streaming
