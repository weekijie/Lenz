import React, { useRef, useState } from 'react';
import { Upload, FileImage } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface UploadZoneProps {
    onImageSelected: (file: File) => void;
}

export function UploadZone({ onImageSelected }: UploadZoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            onImageSelected(file);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImageSelected(file);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card
                className={cn(
                    "group relative cursor-pointer overflow-hidden border-2 border-dashed transition-all duration-300 hover:border-primary/50",
                    isDragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25 bg-muted/50"
                )}
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="relative mb-6">
                        <div className={cn(
                            "absolute -inset-4 rounded-full bg-primary/20 blur-xl opacity-0 transition-opacity duration-300",
                            (isDragOver || "group-hover:opacity-100") && "opacity-100" // simpler logic
                        )} />
                        <div className="relative rounded-full bg-background p-4 shadow-sm ring-1 ring-white/10">
                            {isDragOver ? (
                                <FileImage className="h-10 w-10 text-primary animate-bounce" />
                            ) : (
                                <Upload className="h-10 w-10 text-muted-foreground transition-colors group-hover:text-primary" />
                            )}
                        </div>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight">
                        Upload Manga Page
                    </h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                        Drag and drop or click to browse
                    </p>
                    <div className="flex gap-3">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">JPG</span>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">PNG</span>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">WebP</span>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleChange}
                    />
                </div>
            </Card>
        </motion.div>
    );
}
