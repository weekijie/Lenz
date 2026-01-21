# 🔍 Manga Lens

> **AI-Powered Manga Translation using Gemini 3** - Hackathon Submission for Gemini 3 Hackathon

Manga Lens translates Japanese manga pages in real-time using Google's Gemini 3 multimodal AI. Unlike traditional OCR-based translators, Manga Lens understands the **visual context** of each panel to provide accurate, emotion-aware translations with **real-time streaming**.

## 🎮 Try It Now!

### 🌐 [Live Web Demo](https://lenz.vercel.app) ← No install needed!

Upload any manga page and watch translations appear **bubble-by-bubble** as Gemini 3 processes them.

### 🧩 Chrome Extension

For the full experience on manga reading sites like [Comic Walker](https://comic-walker.com/):

1. **Download**: Clone this repo or [download ZIP](https://github.com/user/Lenz/archive/refs/heads/main.zip)
2. **Open Chrome**: Navigate to `chrome://extensions`
3. **Enable Developer Mode**: Toggle in top-right corner
4. **Load Extension**: Click "Load unpacked" → Select the `extension` folder
5. **Done!** Click the Manga Lens icon and start translating

![Demo](demo.gif)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| ⚡ **Real-Time Streaming** | Watch translations appear one-by-one as Gemini 3 identifies each bubble |
| 🎭 **Emotion Detection** | AI analyzes facial expressions & art effects to style text (shouting, whispering, etc.) |
| 🔍 **Smart Positioning** | Translations overlay directly on speech bubbles with accurate bounding boxes |
| 📚 **Cultural Notes** | Explains Japanese idioms, puns, and cultural references |
| 🎯 **Context-Aware** | Uses manga title & genre to improve translation accuracy |

---

## 🧠 How It Uses Gemini 3

### Multimodal Understanding

Gemini 3's vision capabilities analyze **both** the image and context simultaneously:

| Visual Input | What Gemini Detects |
|--------------|---------------------|
| 😤 Facial expression | Speaker's emotion |
| 💢 Art effects (speed lines, sweat drops) | Intensity level |
| 🗯️ Bubble shape (jagged, wavy, cloud) | Shouting vs whispering vs thought |
| 📍 Bubble tail direction | Who is speaking |

### Real-Time Streaming Architecture

```
User clicks Translate
        │
        ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│  Chrome Extension │────▶│  Vercel Backend   │────▶│   Gemini 3 API    │
│  (Capture Image)  │     │  (SSE Streaming)  │     │  (Multimodal)     │
└───────────────────┘     └─────────┬─────────┘     └───────────────────┘
                                    │
                          Stream: bubble 1 ──────▶ Render immediately
                          Stream: bubble 2 ──────▶ Render immediately
                          Stream: bubble 3 ──────▶ Render immediately
                                   ...
```

**Result**: First bubble appears in ~3-5 seconds instead of waiting 30+ seconds for all bubbles!

---

## 🏗️ Project Structure

```
Lenz/
├── extension/              # Chrome Extension
│   ├── manifest.json       # Extension config (Manifest V3)
│   ├── popup.html/js/css   # Extension popup UI
│   ├── content.js          # Page capture & overlay rendering
│   ├── overlay.css         # Translation bubble styles
│   └── background.js       # Service worker for tab capture
│
├── api/                    # Vercel Serverless Functions
│   ├── translate.js        # Standard translation endpoint
│   └── translate-stream.js # SSE streaming endpoint
│
├── public/
│   └── index.html          # Web demo page
│
├── vercel.json             # Deployment config (Singapore region)
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Extension** | Chrome Extension (Manifest V3), Vanilla JS |
| **Backend** | Vercel Serverless Functions, Node.js |
| **AI** | Google Gemini 3 Flash (Multimodal) |
| **Streaming** | Server-Sent Events (SSE) |
| **Region** | Singapore (sin1) for low latency |

---

## 🚀 Self-Hosting

### 1. Deploy Backend to Vercel

```bash
# Clone the repo
git clone https://github.com/user/Lenz.git
cd Lenz

# Install dependencies
npm install

# Deploy to Vercel
vercel --prod
```

### 2. Set Environment Variable

In your Vercel dashboard, add:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key at: https://aistudio.google.com/apikey

### 3. Update Extension Backend URL

1. Open the extension popup
2. Enter your Vercel URL (e.g., `https://your-project.vercel.app`)
3. Click Save

---

## 📝 Hackathon Submission

**Event**: [Gemini 3 Hackathon](https://gemini3.devpost.com/)

### Judging Criteria

| Criteria | Weight | How Manga Lens Addresses It |
|----------|--------|----------------------------|
| **Technical Execution** | 40% | Multimodal vision + SSE streaming + accurate overlay positioning |
| **Innovation/Wow Factor** | 30% | Real-time streaming translations, emotion-aware styling |
| **Potential Impact** | 20% | Millions of manga readers worldwide lack official translations |
| **Presentation** | 10% | Interactive web demo, clear documentation |

### What Makes This Different?

| Feature | Google Translate | Manga Lens |
|---------|-----------------|------------|
| Context awareness | ❌ | ✅ Uses manga title, genre |
| Emotion detection | ❌ | ✅ Analyzes expressions & art |
| Bubble positioning | ❌ | ✅ Overlays on exact location |
| Cultural notes | ❌ | ✅ Explains idioms & references |
| Real-time streaming | ❌ | ✅ Progressive rendering |

---

## 📄 License

MIT License - Built with ❤️ for the Gemini 3 Hackathon

---

**Made by**: [Your Name]  
**Powered by**: Google Gemini 3 ✨
