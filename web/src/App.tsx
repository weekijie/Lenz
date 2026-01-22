import { useState } from 'react';
import { Sparkles, Zap, Trash2, Github, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UploadZone } from '@/components/UploadZone';
import { MangaViewer } from '@/components/MangaViewer';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Bubble {
  bbox: [number, number, number, number];
  english: string;
  speaker?: string;
  emotion?: 'neutral' | 'shouting' | 'whispering' | 'excited' | 'sad' | 'angry';
  culturalNote?: string;
}

function App() {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [qualityMode, setQualityMode] = useState(false);
  // bubbleCount state removed


  // API endpoint - relative to the served page
  // Since we build to ../public, the API is at /api
  const API_BASE = '';

  const handleImageSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCurrentImage(e.target?.result as string);
      setBubbles([]);
      setStatus('');
      // setBubbleCount(0) removed

    };
    reader.readAsDataURL(file);
  };

  const handleTranslate = async () => {
    if (!currentImage) return;

    setIsLoading(true);
    setBubbles([]);
    // setBubbleCount(0) removed
    setStatus('Initializing Gemini 3...');

    try {
      const response = await fetch(`${API_BASE}/api/translate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: currentImage,
          context: { title: 'Web Demo' },
          mode: qualityMode ? 'quality' : 'fast'
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let count = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'bubble') {
                setBubbles(prev => [...prev, data.bubble]);
                count++;
                // setBubbleCount removed

                setStatus(`Found ${count} bubbles...`);
              } else if (data.type === 'done') {
                setStatus(`Translation complete! (${data.count} bubbles)`);
              } else if (data.type === 'error') {
                throw new Error(data.message || "Streaming error");
              }
            } catch (e) {
              // ignore invalid json chunks
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setStatus('Streaming failed, trying fallback...');
      // Fallback
      try {
        const response = await fetch(`${API_BASE}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: currentImage,
            context: { title: 'Web Demo' },
            mode: qualityMode ? 'quality' : 'fast'
          })
        });

        if (!response.ok) throw new Error("Fallback failed");

        const result = await response.json();
        if (result.bubbles) {
          setBubbles(result.bubbles);
          setStatus(`Translation complete! (${result.bubbles.length} bubbles)`);
        }
      } catch (fallbackError) {
        setStatus('Translation failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = () => {
    setCurrentImage(null);
    setBubbles([]);
    setStatus('');
    // setBubbleCount(0) removed

  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Background Gradients */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/30 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-16 max-w-5xl">
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center justify-center space-x-2 rounded-full border border-white/5 bg-white/5 px-4 py-1.5 mb-6 backdrop-blur-md shadow-lg">
              <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground/80">Powered by Gemini 3</span>
            </div>
            <h1 className="bg-gradient-to-br from-white to-white/50 bg-clip-text text-5xl font-bold tracking-tight text-transparent drop-shadow-sm sm:text-7xl mb-4">
              Lenz
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground/80">
              Experience the future of manga reading. Real-time translation with emotion detection and cultural context, streamed instantly to your device.
            </p>
          </motion.div>
        </header>

        <main className="space-y-8">
          <AnimatePresence mode="wait">
            {!currentImage ? (
              <UploadZone onImageSelected={handleImageSelected} key="upload" />
            ) : (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                {/* Toolbar */}
                <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sticky top-4 z-40 backdrop-blur-xl bg-background/80 border-white/10 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-1">
                      <Button
                        variant={!qualityMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setQualityMode(false)}
                        className={cn("text-xs", !qualityMode && "bg-background shadow-sm")}
                      >
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        Fast Mode
                      </Button>
                      <Button
                        variant={qualityMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setQualityMode(true)}
                        className={cn("text-xs", qualityMode && "bg-background shadow-sm")}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Quality Mode
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground/80 font-medium">
                      {status && (
                        <span className={cn(
                          "flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/30",
                          isLoading ? "animate-pulse" : ""
                        )}>
                          {isLoading && <span className="h-2 w-2 rounded-full bg-primary animate-ping" />}
                          {status}
                        </span>
                      )}
                    </div>
                    <Button onClick={handleTranslate} disabled={isLoading} className="min-w-[120px] shadow-lg shadow-primary/20">
                      {isLoading ? 'Translating...' : 'Translate Page'}
                    </Button>
                    <Button variant="outline" size="icon" onClick={clearAll} title="Clear Image">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>

                {/* Viewer */}
                <MangaViewer imageSrc={currentImage} bubbles={bubbles} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-20 border-t border-white/5 py-12 text-center text-sm text-muted-foreground/60">
          <div className="flex justify-center gap-6 mb-8">
            <a href="https://github.com/weekijie/Lenz" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2">
              <Github className="h-4 w-4" /> GitHub
            </a>
            <a href="#" className="hover:text-primary transition-colors flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Chrome Extension
            </a>
          </div>
          <p>© 2026 Lenz. Built for the Gemini 3 Hackathon.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
