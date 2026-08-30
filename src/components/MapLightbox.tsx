"use client";

import { useEffect, useState } from "react";

export default function MapLightbox() {
    const [images, setImages] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // מאזינים לצעקה מהמפה
        const handleOpen = (e: Event) => {
            const customEvent = e as CustomEvent<{ images: string[], index: number }>;
            setImages(customEvent.detail.images);
            setCurrentIndex(customEvent.detail.index);
            setIsOpen(true);
        };

        window.addEventListener("open-map-lightbox", handleOpen);
        return () => window.removeEventListener("open-map-lightbox", handleOpen);
    }, []);

    if (!isOpen || images.length === 0) return null;

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <div 
            className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-md flex items-center justify-center"
            onClick={() => setIsOpen(false)}
            dir="ltr" 
        >
            <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-6 right-6 text-white bg-gray-800 hover:bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors z-50 shadow-lg"
            >
                ✕
            </button>

            <img 
                src={images[currentIndex]} 
                className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl select-none"
                alt="Full screen map image"
                onClick={(e) => e.stopPropagation()} 
            />

            {images.length > 1 && (
                <>
                    <button 
                        onClick={handlePrev}
                        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white bg-black/60 hover:bg-black/90 rounded-full w-12 h-12 flex items-center justify-center text-3xl transition-all border border-gray-700"
                    >
                        ‹
                    </button>
                    <button 
                        onClick={handleNext}
                        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white bg-black/60 hover:bg-black/90 rounded-full w-12 h-12 flex items-center justify-center text-3xl transition-all border border-gray-700"
                    >
                        ›
                    </button>
                    
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-300 text-sm font-medium bg-black/60 px-4 py-1.5 rounded-full border border-gray-700">
                        {currentIndex + 1} / {images.length}
                    </div>
                </>
            )}
        </div>
    );
}