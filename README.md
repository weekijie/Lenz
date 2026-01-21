# 🔍 Manga Lens

> **AI-Powered Manga Translation using Gemini 3** - Hackathon Submission for Gemini 3 Hackathon

Manga Lens is a Chrome Extension that translates Japanese manga pages in real-time using Google's Gemini 3 multimodal AI. Unlike traditional OCR-based translators, Manga Lens understands the **visual context** of each panel to provide accurate, emotion-aware translations.

![Demo](demo.gif)

## ✨ Features

- 🎯 **Context-Aware Translation** - Uses manga synopsis, character info, and genre to improve translation quality
- 🎭 **Emotion Detection** - Analyzes facial expressions and art effects to style text appropriately
- 📚 **Cultural Notes** - Explains Japanese idioms, puns, and cultural references
- 🔄 **Auto-Translate** - Automatically translates when you turn pages
- 🎨 **Beautiful Overlays** - Clean, readable translation bubbles that match the manga aesthetic

## 🚀 Quick Start

### 1. Deploy the Backend

```bash
cd server
npm install
vercel --prod
```

Set your Gemini API key as an environment variable in Vercel:
```
GEMINI_API_KEY=your_api_key_here
```

### 2. Install the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer Mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension` folder

### 3. Configure & Use

1. Click the Manga Lens icon in your toolbar
2. Enter your backend URL (e.g., `https://manga-lens.vercel.app`)
3. Navigate to [Comic Walker](https://comic-walker.com/)
4. Open any manga chapter
5. Click **Translate Page** 🎉

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Content Script │───▶│  Backend Proxy  │───▶│   Gemini 3 API  │
│  (Capture Page) │    │  (Vercel)       │    │  (Multimodal)   │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │◀─────────────────────┼──────────────────────┘
         │                      │
         ▼                      │
┌─────────────────┐             │
│ Render Overlays │◀────────────┘
│ (Translation)   │  JSON: bubbles + translations
└─────────────────┘
```

## 🧠 How It Works

### Multimodal Understanding

Gemini 3 analyzes **both** the image and page context:

| Input | What Gemini Sees |
|-------|------------------|
| 😤 Facial expression | Speaker's emotion |
| 💢 Art effects | Intensity (angry, scared) |
| 🗯️ Bubble shape | Shouting vs whispering |
| 📖 Manga context | Genre, character relationships |

### Context-Aware Translation

```javascript
// Standard translator
"しょうがない" → "It can't be helped"

// Manga Lens (with context)
"しょうがない" → "There is no other way."
// + Cultural Note: "Shikata ga nai - accepting the inevitable"
```

## 📁 Project Structure

```
Lenz/
├── extension/           # Chrome Extension
│   ├── manifest.json    # Extension config
│   ├── popup.html/js/css # Extension popup UI
│   ├── content.js       # Page interaction & overlays
│   ├── overlay.css      # Translation bubble styles
│   ├── background.js    # Service worker
│   └── icons/           # Extension icons
│
├── server/              # Backend Proxy
│   ├── api/translate.js # Gemini 3 API integration
│   ├── package.json
│   └── vercel.json      # Deployment config
│
└── README.md
```

## 🛠️ Tech Stack

- **Frontend**: Chrome Extension (Manifest V3), Vanilla JS/CSS
- **Backend**: Vercel Serverless Functions, Node.js
- **AI**: Google Gemini 3 Pro (Multimodal)
- **Target Site**: Comic Walker (comic-walker.com)

## 📝 Hackathon Details

**Submission for**: [Gemini 3 Hackathon](https://gemini3.devpost.com/)

**Judging Criteria Addressed**:
- ✅ **Technical Execution (40%)**: Multimodal image analysis + structured JSON output + overlay rendering
- ✅ **Innovation (30%)**: Character-aware, emotion-detecting translation (Google Lens can't do this!)
- ✅ **Potential Impact (20%)**: Millions of manga readers worldwide
- ✅ **Presentation (10%)**: Visual, interactive demo

## 📄 License

MIT License - Built with ❤️ for the Gemini 3 Hackathon

---

**Made by**: Ki Jie  
**Powered by**: Google Gemini 3 ✨
