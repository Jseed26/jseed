"use client";

import { useState } from "react";

type FormState = {
  name: string;
  description: string;
  address: string;
  website: string;
  image: File | null;
};

type Props = {
  mode: "create" | "edit";
  initialData?: Partial<FormState> & {
    tags?: string[];
    lat?: number;
    lng?: number;
  };

  onClose: () => void;

  onSubmit: (data: {
    form: FormState;
    tags: string[];
  }) => void;
};

const AVAILABLE_TAGS = [
  "בית כנסת",
  "תפילה",
  "קהילה",
  "מורשת",
  "עסק",
  "חנות",
  "אירוע",
  "זיכרון",
  "אומנות",
  "גלריה",
  "שיעור",
  "תורה",
  "אוכל",
];

export default function PointForm({
  mode,
  initialData,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    address: initialData?.address || "",
    website: initialData?.website || "",
    image: null,
  });

  const [tags, setTags] = useState<string[]>(
    initialData?.tags || []
  );

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  }

  function handleSubmit() {
    onSubmit({
      form,
      tags,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white text-black p-6 rounded-xl w-[380px] space-y-3">

        <h2 className="text-lg font-bold">
          {mode === "create" ? "יצירת נקודה" : "עריכת נקודה"}
        </h2>

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

        {/* תגיות */}
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full border text-sm ${
                tags.includes(tag)
                  ? "bg-black text-white"
                  : "bg-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

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