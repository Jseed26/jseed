"use client";

import { useState } from "react";
import imageCompression from "browser-image-compression"; // 👈 הייבוא החדש

type FormState = {
    name: string;
    description: string;
    address: string;
    website: string;
    images: File[];
    existingImages: string[];
    extraInfo: string;
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
    onSubmit: (data: { form: FormState }) => void;
};

export default function PointForm({
    mode,
    initialData,
    onClose,
    onSubmit,
    category,
}: Props) {
    const [form, setForm] = useState<FormState>({
        name: initialData?.name || "",
        description: initialData?.description || "",
        address: initialData?.address || "",
        website: initialData?.website || "",
        images: [],
        existingImages: initialData?.existingImages || [],
        extraInfo: initialData?.extraInfo || "",
    });

    // 🌟 סטייט חדש שבודק אם אנחנו באמצע כיווץ תמונות
    const [isCompressing, setIsCompressing] = useState(false);

    const totalImages = form.existingImages.length + form.images.length;

    function handleSubmit() {
        onSubmit({ form });
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <div className="bg-gray-100 text-black p-6 rounded-2xl w-[380px] space-y-3 shadow-2xl border border-gray-300">

                <div className="flex justify-between items-center mb-3" dir="rtl">
                    <h2 className="text-lg font-bold text-right text-gray-800">
                        {mode === "create" ? "יצירת גרעין" : "עריכת גרעין"}
                    </h2>

                    {category ? (
                        <div className="flex items-center gap-2">
                            <img
                                src={`/icons/categories/${category}/active.png`}
                                className="w-8 h-8"
                            />
                        </div>
                    ) : (
                        <div className="text-xs text-red-500 font-medium">
                            No category
                        </div>
                    )}
                </div>

                <input
                    placeholder="שם הגרעין (לדוג: יד ושם...)"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 placeholder-gray-400"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <textarea
                    placeholder="תיאור (לדוג: רשות הזיכרון לשואה ולגבורה"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 resize-none h-20 placeholder-gray-400"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                />

                <textarea
                    placeholder="מידע נוסף (לדוג: מורשת, אתר הנצחה, שעות פתיחה...)"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 resize-none h-16 placeholder-gray-400"
                    value={form.extraInfo}
                    onChange={(e) => setForm({ ...form, extraInfo: e.target.value })}
                />

                <input
                    placeholder="כתובת (רחוב, מספר ועיר, ללא מדינה...)"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 placeholder-gray-400"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                />

                <input
                    placeholder="קישור (לדוגמא: https://www.yadvashem.org/he)"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 placeholder-gray-400"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                />

                {/* --- אזור בחירת תמונות חכם --- */}
                <div className="w-full bg-white border border-gray-300 p-2 rounded-xl focus-within:border-gray-500 transition">
                    <label className={`flex items-center w-full ${isCompressing ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}>
                        <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs hover:bg-gray-300 transition ml-3 shrink-0">
                            {isCompressing ? "מעבד..." : "הוספת תמונות"}
                        </span>

                        <span className="text-sm truncate text-gray-400">
                            {isCompressing
                                ? "מכווץ תמונות, אנא המתן..."
                                : (totalImages > 0
                                    ? `יש ${totalImages} תמונות (מתוך 3)`
                                    : "עד 3 תמונות סך הכל")
                            }
                        </span>

                        <input
                            type="file"
                            accept="image/*, .heic, .heif, .webp"
                            multiple
                            disabled={isCompressing}
                            className="hidden"
                            onChange={async (e) => {
                                const newFiles = Array.from(e.target.files || []);
                                const availableSlots = 3 - totalImages;

                                if (availableSlots <= 0) {
                                    alert("הגעת למקסימום של 3 תמונות. יש למחוק תמונות קיימות כדי להוסיף חדשות.");
                                    return;
                                }

                                let filesToAdd = newFiles;
                                if (newFiles.length > availableSlots) {
                                    alert(`ניתן להוסיף עוד ${availableSlots} תמונות בלבד.`);
                                    filesToAdd = newFiles.slice(0, availableSlots);
                                }

                                setIsCompressing(true); // מתחילים כיווץ!

                                try {
                                    const compressedFiles: File[] = [];
                                    // 🌟 הגדרות הכיווץ שלנו
                                    const options = {
                                        maxSizeMB: 1, // הגבלת משקל התמונה למקסימום 1 מגה
                                        maxWidthOrHeight: 1280, // הקטנת הרזולוציה
                                        useWebWorker: true,
                                    };

                                    for (const file of filesToAdd) {
                                        // כיווץ התמונה
                                        const compressedFile = await imageCompression(file, options);
                                        compressedFiles.push(compressedFile);
                                    }

                                    // מוסיף את התמונות המכווצות לסטייט
                                    setForm(prev => ({ ...prev, images: [...prev.images, ...compressedFiles] }));
                                } catch (error) {
                                    console.error("Error compressing images:", error);
                                    alert("אירעה שגיאה בעיבוד התמונה. נסה תמונה אחרת.");
                                } finally {
                                    setIsCompressing(false); // סיימנו כיווץ!
                                }
                            }}
                        />
                    </label>

                    {/* גלריית תצוגה מקדימה ומחיקת תמונות */}
                    {totalImages > 0 && (
                        <div className="flex gap-3 overflow-x-auto pt-3 pb-1 mt-2 border-t border-gray-200 custom-scrollbar" dir="rtl">

                            {form.existingImages.map((url, i) => (
                                <div key={`existing-${i}`} className="relative w-14 h-14 shrink-0">
                                    <img src={url} className="w-full h-full object-cover rounded-lg shadow-sm" />
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const newExisting = [...form.existingImages];
                                            newExisting.splice(i, 1);
                                            setForm({ ...form, existingImages: newExisting });
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}

                            {form.images.map((file, i) => (
                                <div key={`new-${i}`} className="relative w-14 h-14 shrink-0">
                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded-lg shadow-sm opacity-90 border-2 border-dashed border-gray-300" />
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const newImages = [...form.images];
                                            newImages.splice(i, 1);
                                            setForm({ ...form, images: newImages });
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}

                        </div>
                    )}
                </div>

                {/* כפתורים */}
                <div className="flex justify-between items-center pt-3">
                    <button onClick={onClose} disabled={isCompressing} className="text-red-500 hover:text-red-700 disabled:opacity-50 text-sm font-medium px-3 py-1.5">
                        ביטול
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={isCompressing} // 🌟 חוסם שמירה עד שהכיווץ מסתיים
                        className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {mode === "create" ? "צור" : "שמור"}
                    </button>
                </div>

            </div>
        </div>
    );
}