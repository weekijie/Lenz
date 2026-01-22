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
            className={cn(
                "absolute flex flex-col items-center justify-center border-2 border-gray-900 bg-white/95 text-center shadow-lg",
                "hover:scale-105 hover:shadow-xl hover:z-[100]",
                "rounded-xl p-2",
                showNote ? "z-[100]" : "z-10"
            )}
            style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${width}%`,
                minHeight: `${height}%`,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                pointerEvents: 'auto',
                transition: "transform 0.2s ease, box-shadow 0.2s ease, z-index 0s"
            }}
        >
            {bubble.speaker && bubble.speaker !== 'unknown' && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur-sm border border-primary/20">
                    {bubble.speaker}
                </span>
            )}

            <p className={cn("select-text text-sm leading-tight break-words w-full", style)}>
                {bubble.english}
            </p>

            {bubble.culturalNote && (
                <div className="absolute -right-3 -top-3 z-50">
                    <button
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md ring-2 ring-white transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                        title="View Cultural Note"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowNote(prev => !prev);
                        }}
                        onMouseDown={(e) => e.stopPropagation()} // Prevent drag/other events
                    >
                        <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                    <AnimatePresence>
                        {showNote && (
                            <motion.div
                                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                className="absolute left-full top-0 ml-2 w-64 rounded-lg border border-border/50 bg-slate-900/95 p-4 text-xs text-slate-100 shadow-2xl backdrop-blur-xl z-[200]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                                    <HelpCircle className="h-3 w-3 text-indigo-400" />
                                    <h4 className="font-semibold text-indigo-300">Cultural Context</h4>
                                </div>
                                <p className="leading-relaxed opacity-90">{bubble.culturalNote}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}
