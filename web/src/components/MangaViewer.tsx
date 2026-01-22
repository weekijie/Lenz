// React import removed

import { BubbleOverlay } from './BubbleOverlay';

interface MangaViewerProps {
    imageSrc: string;
    bubbles: any[];
}

export function MangaViewer({ imageSrc, bubbles }: MangaViewerProps) {
    return (
        <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg shadow-2xl">
            <img
                src={imageSrc}
                alt="Manga page"
                className="block h-auto max-w-full"
            />
            <div className="absolute inset-0 pointer-events-none">
                {bubbles.map((bubble, i) => (
                    <BubbleOverlay key={i} bubble={bubble} />
                ))}
            </div>
        </div>
    );
}
