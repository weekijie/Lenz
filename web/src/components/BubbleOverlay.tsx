import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
// Popover imports removed

// I'll create a simple inline Popover implementation or just use absolute positioning for now to save complexity
// since I didn't create the Popover component yet. I'll stick to a simple toggle for now or interactive tooltip.

interface Bubble {
    bbox: [number, number, number, number]; // x, y, w, h in %
    english: string;
    speaker?: string;
    emotion?: 'neutral' | 'shouting' | 'whispering' | 'excited' | 'sad' | 'angry';
    culturalNote?: string;
}

interface BubbleOverlayProps {
    bubble: Bubble;
}

export function BubbleOverlay({ bubble }: BubbleOverlayProps) {
    const [x, y, width, height] = bubble.bbox;
    const [showNote, setShowNote] = useState(false);

    const emotionStyles = {
        neutral: "font-comic text-gray-900",
        shouting: "font-comic font-black uppercase text-red-600 tracking-wide",
        whispering: "font-comic italic text-gray-500 text-xs",
        excited: "font-comic font-bold text-orange-500",
        sad: "font-comic italic text-blue-500",
        angry: "font-comic font-bold text-red-800",
    };

    const style = emotionStyles[bubble.emotion || 'neutral'] || emotionStyles.neutral;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute flex flex-col items-center justify-center border-2 border-gray-900 bg-white/95 text-center shadow-lg transition-all hover:z-50 hover:scale-105 hover:shadow-xl rounded-[50%] p-2"
            style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${width}%`,
                minHeight: `${height}%`,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
        >
            {bubble.speaker && bubble.speaker !== 'unknown' && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur-sm">
                    {bubble.speaker}
                </span>
            )}

            <p className={cn("select-text text-[clamp(8px,1.5cqw,16px)] leading-tight", style)}>
                {bubble.english}
            </p>

            {bubble.culturalNote && (
                <div className="absolute -right-2 -top-2">
                    <button
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md ring-2 ring-white transition-transform hover:scale-110"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowNote(!showNote)
                        }}
                    >
                        <HelpCircle className="h-3 w-3" />
                    </button>
                    <AnimatePresence>
                        {showNote && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                className="absolute right-0 top-6 z-50 w-48 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-xl"
                            >
                                <h4 className="mb-1 font-semibold text-primary">Cultural Note</h4>
                                {bubble.culturalNote}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}
