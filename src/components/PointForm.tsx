"use client";

import { useState, useEffect } from "react";
import imageCompression from "browser-image-compression";

type FormState = {
    name: string;
    description: string;
    address: string;
    website: string;
    images: File[];            
    existingImages: string[];  
    category: string;
};

type Props = {
    mode: "create" | "edit";
    initialData?: Partial<FormState> & {
        lat?: number;
        lng?: number;
        existingImages?: string[]; 
    };
    category?: string | null;
    onClose: () => void;
    onSubmit: (data: { form: FormState }) => any; 
};

const CATEGORIES = [
    { key: "leaf", label: { he: "קהילה", en: "Community" } },
    { key: "star", label: { he: "רוח", en: "Spirit" } },
    { key: "triangle", label: { he: "מורשת", en: "Legacy" } },
    { key: "circle", label: { he: "עסקים", en: "Business" } },
    { key: "chai", label: {he: "חי", en: "Chai"}},
];

const tForm = {
    createTitle: { he: "יצירת גרעין", en: "Create Seed" },
    editTitle: { he: "עריכת גרעין", en: "Edit Seed" },
    namePlaceholder: { he: "שם הגרעין (לדוג: יד ושם...)", en: "Seed Name (e.g., Yad Vashem)" },
    descPlaceholder: { he: "תיאור (לדוג: רשות הזיכרון לשואה ולגבורה)", en: "Description (e.g., The World Holocaust Remembrance Center)" },
    addressPlaceholder: { he: "כתובת (רחוב, מספר ועיר)", en: "Address (Street, number, and city)" },
    websitePlaceholder: { he: "קישור לאתר (לדוג: https://...)", en: "Website Link (e.g., https://...)" },
    addImages: { he: "הוספת תמונות", en: "Add Images" },
    processing: { he: "מעבד...", en: "Processing..." },
    compressing: { he: "מכווץ תמונות...", en: "Compressing images..." },
    maxImages: { he: "הגעת למקסימום 3 תמונות", en: "Maximum 3 images reached" },
    imagesCount: { he: "תמונות נוספו (מקסימום 3)", en: "images added (Max 3)" },
    upTo3: { he: "עד 3 תמונות בסך הכל", en: "Up to 3 images total" },
    cancel: { he: "ביטול", en: "Cancel" },
    create: { he: "צור", en: "Create" },
    save: { he: "שמור", en: "Save" },
    saving: { he: "שומר...", en: "Saving..." },
    chaiWarning: { 
        he: "⏳ שימו לב: גרעיני 'חי' הם זמניים ויופיעו על המפה ל-36 שעות בלבד (אך יישמרו בהיסטוריה שלכם).", 
        en: "⏳ Note: 'Chai' seeds are temporary and will only appear on the map for 36 hours (but remain in your history)." 
    },
};

export default function PointForm({ mode, initialData, onClose, onSubmit, category }: Props) {
    const [lang, setLang] = useState<"en" | "he">("he");

    useEffect(() => {
        const savedLang = localStorage.getItem("jseed_lang") as "en" | "he";
        if (savedLang) setLang(savedLang);
    }, []);

    const [form, setForm] = useState<FormState>({
        name: initialData?.name || "",
        description: initialData?.description || "",
        address: initialData?.address || "",
        website: initialData?.website || "",
        images: [],
        existingImages: initialData?.existingImages || [], 
        category: initialData?.category || category || "", 
    });

    const [isCompressing, setIsCompressing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalImages = form.existingImages.length + form.images.length;

    async function handleSubmit() {
        if (!form.category) {
            alert(lang === "he" ? "נא לבחור קטגוריה לגרעין." : "Please select a category for the seed.");
            return;
        }
        if (!form.name) {
            alert(lang === "he" ? "נא להזין שם לגרעין." : "Please enter a name for the seed.");
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({ form });
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false); 
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
            <div className="bg-gray-900 text-white p-6 rounded-2xl w-full max-w-[400px] max-h-[90vh] overflow-y-auto custom-scrollbar space-y-4 shadow-2xl border border-gray-700" dir={lang === "he" ? "rtl" : "ltr"}>

                <div className="flex justify-between items-center mb-1">
                    <h2 className="text-xl font-bold text-white">
                        {mode === "create" ? tForm.createTitle[lang] : tForm.editTitle[lang]}
                    </h2>
                </div>

                <div className="grid grid-cols-5 gap-1 bg-gray-800/50 p-1.5 rounded-xl border border-gray-700">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.key}
                            type="button"
                            onClick={() => setForm({ ...form, category: cat.key })}
                            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-all ${
                                form.category === cat.key
                                    ? "bg-yellow-500/10 border border-yellow-500/50 scale-105"
                                    : "opacity-50 hover:opacity-100 grayscale hover:grayscale-0 border border-transparent"
                            }`}
                        >
                            <img 
                                src={`/icons/categories/${cat.key}/${form.category === cat.key ? 'active' : 'default'}.png`} 
                                className="w-6 h-6 object-contain mb-1" 
                                alt={cat.label[lang]}
                            />
                            <span className={`text-[9px] font-bold text-center leading-tight ${form.category === cat.key ? "text-yellow-500" : "text-gray-400"}`}>
                                {cat.label[lang]}
                            </span>
                        </button>
                    ))}
                </div>

                {form.category === "chai" && (
                    <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 p-3 rounded-xl text-xs font-medium text-center shadow-inner">
                        {tForm.chaiWarning[lang]}
                    </div>
                )}

                <input
                    placeholder={tForm.namePlaceholder[lang]}
                    className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm focus:outline-none focus:border-yellow-500 placeholder-gray-500 text-white transition-colors"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <textarea
                    placeholder={tForm.descPlaceholder[lang]}
                    className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm focus:outline-none focus:border-yellow-500 resize-none h-20 placeholder-gray-500 text-white transition-colors"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                />

                <input
                    placeholder={tForm.addressPlaceholder[lang]}
                    className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm focus:outline-none focus:border-yellow-500 placeholder-gray-500 text-white transition-colors"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                />

                <input
                    placeholder={tForm.websitePlaceholder[lang]}
                    className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm focus:outline-none focus:border-yellow-500 placeholder-gray-500 text-white transition-colors"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                />

                <div className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl focus-within:border-yellow-500 transition-colors">
                    <label className={`flex items-center w-full ${isCompressing ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}>
                        <span className="bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-600 transition ml-3 shrink-0">
                            {isCompressing ? tForm.processing[lang] : tForm.addImages[lang]}
                        </span>
                        
                        <span className="text-xs truncate text-gray-400">
                            {isCompressing 
                                ? tForm.compressing[lang] 
                                : (totalImages > 0 
                                    ? `${totalImages} ${tForm.imagesCount[lang]}` 
                                    : tForm.upTo3[lang])
                            }
                        </span>

                        <input
                            type="file"
                            accept="image/*, .heic, .heif, .webp"
                            multiple
                            disabled={isCompressing || isSubmitting}
                            className="hidden"
                            onChange={async (e) => {
                                const newFiles = Array.from(e.target.files || []);
                                const availableSlots = 3 - totalImages;

                                if (availableSlots <= 0) {
                                    alert(tForm.maxImages[lang]);
                                    return;
                                }

                                let filesToAdd = newFiles;
                                if (newFiles.length > availableSlots) {
                                    filesToAdd = newFiles.slice(0, availableSlots);
                                }

                                setIsCompressing(true); 

                                try {
                                    const compressedFiles: File[] = [];
                                    const options = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };

                                    for (const file of filesToAdd) {
                                        const compressedFile = await imageCompression(file, options);
                                        compressedFiles.push(compressedFile);
                                    }

                                    setForm(prev => ({ ...prev, images: [...prev.images, ...compressedFiles] }));
                                } catch (error) {
                                    console.error(error);
                                } finally {
                                    setIsCompressing(false); 
                                }
                            }}
                        />
                    </label>

                    {totalImages > 0 && (
                        <div className="flex gap-3 overflow-x-auto pt-3 pb-1 mt-2 border-t border-gray-700 custom-scrollbar" dir="ltr">
                            {form.existingImages.map((url, i) => (
                                <div key={`existing-${i}`} className="relative w-14 h-14 shrink-0">
                                    <img src={url} className="w-full h-full object-cover rounded-lg shadow-sm" />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const newExisting = [...form.existingImages];
                                            newExisting.splice(i, 1);
                                            setForm({ ...form, existingImages: newExisting });
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md transition"
                                    >✕</button>
                                </div>
                            ))}
                            {form.images.map((file, i) => (
                                <div key={`new-${i}`} className="relative w-14 h-14 shrink-0">
                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded-lg shadow-sm opacity-90 border border-gray-500" />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const newImages = [...form.images];
                                            newImages.splice(i, 1);
                                            setForm({ ...form, images: newImages });
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md transition"
                                    >✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-3 pb-2">
                    <button type="button" onClick={onClose} disabled={isCompressing || isSubmitting} className="text-red-400 hover:text-red-300 disabled:opacity-50 text-sm font-bold px-3 py-1.5 transition-colors">
                        {tForm.cancel[lang]}
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isCompressing || isSubmitting} 
                        className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? tForm.saving[lang] : mode === "create" ? tForm.create[lang] : tForm.save[lang]}
                    </button>
                </div>

            </div>
        </div>
    );
}