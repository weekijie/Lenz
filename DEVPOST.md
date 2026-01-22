# Lenz - Devpost Submission

## Inspiration
As manga fans, we've all experienced the frustration of waiting months for official translations. Existing translation tools use basic OCR that miss context, emotions, and cultural nuances. We wanted to create something that truly understands manga.

## What it does
Lenz translates Japanese manga pages in real-time using Gemini 3's multimodal AI. Unlike traditional OCR translators, it:
- **Streams translations** bubble-by-bubble as they're processed (~3-5s for first result)
- **Detects emotions** from facial expressions and art effects (shouting, whispering, etc.)
- **Explains cultural references** with contextual notes for idioms and puns
- **Positions overlays precisely** using AI-detected bounding boxes

## How we built it
We leveraged Gemini 3's vision capabilities to analyze manga images holistically. The backend streams responses via SSE, rendering bubbles progressively. The Chrome extension integrates seamlessly with Comic Walker (a free, legal manga platform).

## Gemini 3 Features Used
- **Multimodal Vision**: Analyzes images + text context simultaneously
- **Streaming API**: `generateContentStream()` for real-time progressive output
- **Structured Output**: JSON schema for bounding boxes, translations, emotions

## What's next
Support for more manga platforms, offline caching, and community-contributed translation improvements.
