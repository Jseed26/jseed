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
            <div className="bg-gray-400 text-black p-6 rounded-2xl w-[380px] space-y-3 shadow-2xl border border-gray-300">

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
                    placeholder="שם הנקודה"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500"
                    value={form.name}
                    onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                    }
                />

                {/* תיאור - שדה לבן */}
                <textarea
                    placeholder="תיאור"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 resize-none h-20"
                    value={form.description}
                    onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                    }
                />

                {/* מלל חופשי - שדה לבן */}
                <textarea
                    placeholder="תוספות / מידע נוסף"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500 resize-none h-16"
                    value={form.extraInfo}
                    onChange={(e) => setForm({ ...form, extraInfo: e.target.value })}
                />

                {/* כתובת - שדה לבן */}
                <input
                    placeholder="כתובת"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500"
                    value={form.address}
                    onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                    }
                />

                {/* אתר - שדה לבן */}
                <input
                    placeholder="קישור"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-xl text-sm focus:outline-none focus:border-gray-500"
                    value={form.website}
                    onChange={(e) =>
                        setForm({ ...form, website: e.target.value })
                    }
                />

                {/* תמונה - אזור לבן לבחירת קובץ */}
                <input
                    type="file"
                    accept="image/*"
                    className="w-full bg-white border border-gray-300 p-2 rounded-xl text-xs text-gray-600 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
                    onChange={(e) =>
                        setForm({
                            ...form,
                            image: e.target.files?.[0] || null,
                        })
                    }
                />

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