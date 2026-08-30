"use client";

import { useState } from "react";

type Props = {
    images: string[];
};

export default function ImageGallery({ images }: Props) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    if (!images || images.length === 0) return null;

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex + 1) % images.length);
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
        }
    };

    return (
        <>
            {/* התצוגה הרגילה - ריבועים קטנים */}
            <div className="mt-4 flex flex-wrap gap-3">
                {images.map((src, i) => (
                    <div 
                        key={i} 
                        onClick={() => setSelectedIndex(i)}
                        className="w-24 h-24 sm:w-28 sm:h-28 bg-black rounded-xl overflow-hidden border border-gray-700 shadow-md shrink-0 cursor-pointer group relative"
                    >
                        <img 
                            src={src} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                            alt={`תמונה ${i + 1}`}
                        />
                        {/* אייקון זכוכית מגדלת שמופיע במעבר עכבר */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-2xl">⛶</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* חלון מסך מלא (Lightbox) */}
            {selectedIndex !== null && (
                <div 
                    className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex items-center justify-center"
                    onClick={() => setSelectedIndex(null)}
                    dir="ltr" // באנגלית יותר קל לסדר את החצים משמאל לימין
                >
                    {/* כפתור סגירה */}
                    <button 
                        onClick={() => setSelectedIndex(null)}
                        className="absolute top-6 right-6 text-white bg-gray-800 hover:bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors z-50 shadow-lg"
                    >
                        ✕
                    </button>

                    {/* תמונה מרכזית */}
                    <img 
                        src={images[selectedIndex]} 
                        className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] select-none"
                        alt="Full screen"
                        onClick={(e) => e.stopPropagation()} // מונע סגירה אם לוחצים בטעות על התמונה עצמה
                    />

                    {/* חיצים לניווט (רק אם יש יותר מתמונה אחת) */}
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
                        </>
                    )}
                    
                    {/* ספירת תמונות למטה */}
                    {images.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-300 text-sm font-medium bg-black/60 px-4 py-1.5 rounded-full border border-gray-700">
                            {selectedIndex + 1} / {images.length}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}