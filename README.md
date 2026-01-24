# Lenz

> **AI-Powered Manga Translation using Gemini 3** - Submission for [Gemini 3 Hackathon](https://gemini3.devpost.com/)

Lenz translates Japanese manga pages in real-time using Google's Gemini 3 multimodal AI. Unlike traditional OCR-based translators, Lenz understands the **visual context** of each panel to provide accurate, emotion-aware translations with **real-time streaming**.

## Demo Video

[Watch Demo on YouTube](https://youtu.be/E0tIR11XZP0)

## Try It Now!

### [Live Web Demo](https://lenz-iota.vercel.app) - No install needed!

Upload any manga page and watch translations appear **bubble-by-bubble** as Gemini 3 processes them.

### Chrome Extension

The extension was built with [Comic Walker](https://comic-walker.com/) in mind - a **free and legal** manga reading platform. This makes it perfect for demo/testing purposes without copyright concerns.

1. **Download**: Clone this repo or [download ZIP](https://github.com/weekijie/Lenz/archive/refs/heads/main.zip)
2. **Open Chrome**: Navigate to `chrome://extensions`
3. **Enable Developer Mode**: Toggle in top-right corner
4. **Load Extension**: Click "Load unpacked" and select the `extension` folder
5. **Done!** Visit [Comic Walker](https://comic-walker.com/), open any manga, and click the Lenz icon to translate

<!-- TODO: Add demo.gif showing the extension in action -->
---

## Features

| Feature | Description |
|---------|-------------|
| **Real-Time Streaming** | Watch translations appear one-by-one as Gemini 3 identifies each bubble |
| **Emotion Detection** | AI analyzes facial expressions & art effects to style text (shouting, whispering, etc.) |
| **Smart Positioning** | Translations overlay directly on speech bubbles with accurate bounding boxes |
| **Resizable & Draggable** | Adjust overlay positions and sizes with PowerPoint-style resize handles |
| **Cultural Notes** | Explains Japanese idioms, puns, and cultural references |
| **Context-Aware** | Uses manga title & genre to improve translation accuracy |

---

## How It Uses Gemini 3

### Gemini 3 Features Used

| Feature | Implementation |
|---------|----------------|
| **Multimodal Vision** | Analyzes manga images to detect speech bubbles, text, emotions, and visual context |
| **Streaming API** | Uses `generateContentStream()` for real-time bubble-by-bubble translation via SSE |
| **Structured Output** | Prompts for JSON schema with bounding boxes, translations, emotions, and cultural notes |
| **Context Understanding** | Leverages manga metadata (title, genre) for improved translation accuracy |

### Visual Understanding

Gemini 3's vision capabilities analyze **both** the image and context simultaneously:

| Visual Input | What Gemini Detects |
|--------------|---------------------|
| Facial expression | Speaker's emotion |
| Art effects (speed lines, sweat drops) | Intensity level |
| Bubble shape (jagged, wavy, cloud) | Shouting vs whispering vs thought |
| Bubble tail direction | Who is speaking |

---

## Architecture

<img width="1024" height="1536" alt="LenzDiagram" src="https://github.com/user-attachments/assets/1a156ba9-8b83-487f-a00e-060c290b9774" />

### Streaming Flow

```
User clicks Translate
        │
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Client (Browser)│────▶│ Vercel Backend  │────▶│  Gemini 3 API   │
│                 │     │ (SSE Stream)    │     │  (Multimodal)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                       Stream: bubble 1 ──────▶ Render immediately
                       Stream: bubble 2 ──────▶ Render immediately  
                       Stream: bubble 3 ──────▶ Render immediately
                                ...
```

**Result**: First bubble appears in ~3-5 seconds instead of waiting 30+ seconds for all bubbles!

---

## Project Structure

```
Lenz/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── manifest.json       # Extension configuration
│   ├── popup.html/js/css   # Extension popup UI
│   ├── content.js          # Page capture & overlay rendering
│   ├── overlay.css         # Translation bubble styles
│   └── background.js       # Service worker for tab capture
│
├── api/                    # Vercel Serverless Functions
│   ├── translate.js        # Standard translation endpoint (Backup/Fallback)
│   └── translate-stream.js # SSE streaming endpoint
│
├── public/
│   └── index.html          # Web demo page
│
├── vercel.json             # Deployment config
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Extension** | Chrome Extension (Manifest V3), Vanilla JS |
| **Web Demo** | Vanilla HTML/CSS/JS |
| **Backend** | Vercel Serverless Functions, Node.js |
| **AI** | Google Gemini 3 Flash (Multimodal) |
| **Streaming** | Server-Sent Events (SSE) |

---

## Third-Party Integrations

As required by hackathon rules, here are the third-party tools and libraries used:

| Integration | Purpose | License |
|-------------|---------|---------|
| [@google/genai](https://www.npmjs.com/package/@google/genai) | Google Gemini AI SDK for API calls | Apache-2.0 |
| [cors](https://www.npmjs.com/package/cors) | CORS middleware for Express/Vercel | MIT |
| [Vercel](https://vercel.com) | Serverless deployment platform | - |
| [Chrome Extensions API](https://developer.chrome.com/docs/extensions/) | Browser extension platform | - |

All dependencies are used in accordance with their respective licenses.

---

## Backend Options

### Option 1: Use Hosted Backend (Quick Start)

The extension comes pre-configured to use the hosted backend:

```
https://lenz-iota.vercel.app
```

> [!NOTE]
> **Free Tier Limits Apply** - The hosted backend uses Gemini API's free tier with limited quota. You may experience rate limits (HTTP 429) during high traffic. If you need unlimited usage, self-host with your own API key.

---

### Option 2: Self-Host Your Own Backend

For unlimited usage or custom modifications:

#### 1. Deploy Backend to Vercel

```bash
# Clone the repo
git clone https://github.com/weekijie/Lenz.git
cd Lenz

# Install dependencies
npm install

# Deploy to Vercel
vercel --prod
```

#### 2. Set Environment Variable

In your Vercel dashboard, add:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key at: https://aistudio.google.com/apikey

#### 3. Update Extension Backend URL

1. Open the extension popup
2. Go to Settings
3. Enter your Vercel URL (e.g., `https://your-project.vercel.app`)
4. Click Save

---

## Hackathon Submission

**Event**: [Gemini 3 Hackathon](https://gemini3.devpost.com/)

### Judging Criteria Alignment

| Criteria | Weight | How Lenz Addresses It |
|----------|--------|----------------------------|
| **Technical Execution** | 40% | Multimodal vision + SSE streaming + accurate overlay positioning + robust error handling |
| **Innovation/Wow Factor** | 30% | Real-time streaming translations, emotion-aware styling, cultural context |
| **Potential Impact** | 20% | Millions of manga readers worldwide lack official translations |
| **Presentation** | 10% | Interactive web demo, video walkthrough, comprehensive documentation |

### What Makes This Different?

| Feature | Traditional Translators | Lenz |
|---------|------------------------|------------|
| Context awareness | No | Uses manga title, genre, visual context |
| Emotion detection | No | Analyzes expressions & art effects |
| Bubble positioning | No | Overlays on exact location |
| Cultural notes | No | Explains idioms & references |
| Real-time streaming | No | Progressive bubble-by-bubble rendering |

---

## Rate Limits Notice

The hosted demo at [lenz-iota.vercel.app](https://lenz-iota.vercel.app) uses Gemini API's **free tier** with limited quota:

| Limit | Value | What Happens |
|-------|-------|--------------|
| **Requests per minute (RPM)** | 5 | Wait ~1 minute and try again |
| **Requests per day (RPD)** | 20 | Wait until midnight PT, or self-host with your own API key |

The app displays specific error messages for each limit type so you know whether to wait a minute or try again tomorrow.

---

## API Security (CORS)

The backend **strictly restricts** API access to browser requests from whitelisted domains only:

| Allowed Origin | Purpose |
|----------------|---------|
| `https://lenz-iota.vercel.app` | Web demo |
| `https://comic-walker.com` | Chrome extension |

**Blocked:**
- ❌ curl / Postman requests
- ❌ Server-side code (Node.js, Python, etc.)
- ❌ Other websites

Requests without an `Origin` header or from non-whitelisted domains receive **403 Forbidden**. If you self-host, update the `allowedOrigins` array in `api/translate.js` and `api/translate-stream.js`.

---

## License

MIT License - Built for the Gemini 3 Hackathon

---

**Made by**: [Ki Jie](https://github.com/weekijie)  
**Powered by**: Google Gemini 3
