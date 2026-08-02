"use client";

import { useState } from "react";

type FormState = {
    name: string;
    description: string;
    address: string;
    website: string;
    image: File | null;
    extraInfo: string;
};

type Props = {
    mode: "create" | "edit";
    initialData?: Partial<FormState> & {
        lat?: number;
        lng?: number;
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
        image: null,
        extraInfo: initialData?.extraInfo || "",
    });

    function handleSubmit() {
        onSubmit({ form });
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
            {/* שינינו את הרקע של החלונית לאפור בהיר מאוד bg-gray-100 */}
            <div className="bg-gray-100 text-black p-6 rounded-2xl w-[380px] space-y-3 shadow-2xl border border-gray-300">

                <div className="flex justify-between items-center mb-3" dir="rtl">
                    {/* כותרת - ימין */}
                    <h2 className="text-lg font-bold text-right text-gray-800">
                        {mode === "create" ? "יצירת גרעין" : "עריכת גרעין"}
                    </h2>

                    {/* קטגוריה - שמאל */}
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

{/* שם - שדה לבן */}
                <input
                    placeholder="שם הגרעין (לדוג: יד ושם...)"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 placeholder-gray-400"
                    value={form.name}
                    onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                    }
                />

                {/* תיאור - שדה לבן */}
                <textarea
                    placeholder="תיאור (לדוג: רשות הזיכרון לשואה ולגבורה"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 resize-none h-20 placeholder-gray-400"
                    value={form.description}
                    onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                    }
                />

                {/* מלל חופשי - שדה לבן */}
                <textarea
                    placeholder="מידע נוסף (לדוג: מורשת, אתר הנצחה, שעות פתיחה...)"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 resize-none h-16 placeholder-gray-400"
                    value={form.extraInfo}
                    onChange={(e) => setForm({ ...form, extraInfo: e.target.value })}
                />

                {/* כתובת - שדה לבן */}
                <input
                    placeholder="כתובת (רחוב, מספר ועיר, ללא מדינה...)"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 placeholder-gray-400"
                    value={form.address}
                    onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                    }
                />

                {/* אתר - שדה לבן */}
                <input
                    placeholder="קישור (לדוגמא: https://www.yadvashem.org/he)"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 placeholder-gray-400"
                    value={form.website}
                    onChange={(e) =>
                        setForm({ ...form, website: e.target.value })
                    }
                />

                {/* תמונה - אזור מותאם אישית לבחירת קובץ */}
                <div className="w-full bg-white border border-gray-300 p-2 rounded-xl focus-within:border-gray-500 transition">
                    <label className="flex items-center cursor-pointer w-full">
                        {/* הכפתור המעוצב ("בחר קובץ") */}
                        <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs hover:bg-gray-300 transition ml-3 shrink-0">
                            בחירת תמונה
                        </span>

                        {/* האינפוט המקורי - מוחבא לגמרי, אבל מופעל שלוחצים על ה-label */}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    image: e.target.files?.[0] || null,
                                })
                            }
                        />
                    </label>
                </div>

                {/* כפתורים */}
                <div className="flex justify-between items-center pt-3">
                    <button onClick={onClose} className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1.5">
                        ביטול
                    </button>

                    <button
                        onClick={handleSubmit}
                        className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
                    >
                        {mode === "create" ? "צור" : "שמור"}
                    </button>
                </div>

            </div>
        </div>
    );
}