"use client";

import { useState } from "react";

type FormState = {
    name: string;
    description: string;
    address: string;
    website: string;
    image: File | null;
    keywords: string;
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
        keywords: initialData?.keywords || "",
    });

    function handleSubmit() {
        onSubmit({ form });
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white text-black p-6 rounded-xl w-[380px] space-y-3">


                <div className="flex justify-between items-center mb-3" dir="rtl">

                    {/* כותרת - ימין */}
                    <h2 className="text-lg font-bold text-right">
                        {mode === "create" ? "יצירת נקודה" : "עריכת נקודה"}
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
                        <div className="text-xs text-red-500">
                            ללא קטגוריה
                        </div>
                    )}
                </div>



                {/* שם */}
                <input
                    placeholder="שם הנקודה"
                    className="w-full border p-2 rounded"
                    value={form.name}
                    onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                    }
                />


                {/* תיאור */}
                <textarea
                    placeholder="תיאור"
                    className="w-full border p-2 rounded"
                    value={form.description}
                    onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                    }
                />

                {/* מילות חיפוש */}
                <textarea
                    placeholder="ניתן להוסיף מילות חיפוש"
                    className="w-full border p-2 rounded bg-gray-50"
                    value={form.keywords}
                    onChange={(e) =>
                        setForm({ ...form, keywords: e.target.value })
                    }
                />

                {/* כתובת */}
                <input
                    placeholder="כתובת"
                    className="w-full border p-2 rounded"
                    value={form.address}
                    onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                    }
                />

                {/* אתר */}
                <input
                    placeholder="קישור"
                    className="w-full border p-2 rounded"
                    value={form.website}
                    onChange={(e) =>
                        setForm({ ...form, website: e.target.value })
                    }
                />

                {/* תמונה */}
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                        setForm({
                            ...form,
                            image: e.target.files?.[0] || null,
                        })
                    }
                />

                {/* כפתורים */}
                <div className="flex justify-between pt-2">
                    <button onClick={onClose} className="text-red-500">
                        ביטול
                    </button>

                    <button
                        onClick={handleSubmit}
                        className="bg-black text-white px-3 py-1 rounded"
                    >
                        {mode === "create" ? "צור" : "שמור"}
                    </button>
                </div>

            </div>
        </div>
    );
}