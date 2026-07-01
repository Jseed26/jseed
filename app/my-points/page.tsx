"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import PointForm from "@/src/components/PointForm";

type Point = {
  id: number;
  name: string;
  description?: string;
  category: string;
  address?: string;
  website?: string;
  imageUrl?: string;
  latitude: number;
  longitude: number;
  tags: string[];
};

export default function MyPointsPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);

  const router = useRouter();

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/");
  }

  async function deletePoint(id: number) {
    const res = await fetch(`/api/points/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setPoints((prev) => prev.filter((p) => p.id !== id));
      window.dispatchEvent(new Event("points-updated"));
    }
  }

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/my-points");

      if (res.status === 401) {
        router.push("/auth");
        return;
      }

      const data = await res.json();
      setPoints(data);
    }

    load();
  }, []);

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl mb-6">הנקודות שלי</h1>

      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-white bg-gray-800 px-3 py-2 rounded hover:bg-gray-700"
      >
        ← חזרה למפה
      </button>

      {points.length === 0 ? (
        <p className="text-gray-400 mt-4">אין לך עדיין נקודות</p>
      ) : (
        <div className="space-y-4 mt-4">
          {points.map((p) => (
            <div
              key={p.id}
              className="border border-gray-700 bg-gray-900 p-4 rounded"
            >
              {/* תצוגה רגילה */}
              <h2 className="font-bold text-lg">{p.name}</h2>

              {p.imageUrl && (
                <img
                  src={p.imageUrl}
                  className="w-full h-40 object-cover rounded mt-2"
                />
              )}

              <p className="text-sm text-gray-300 mt-2">
                {p.description}
              </p>

              <div className="text-xs text-gray-400 mt-2 space-y-1">
                <p>📍 קטגוריה: {p.category}</p>
                <p>🏠 כתובת: {p.address || "אין"}</p>
                <p>🌐 אתר: {p.website || "אין"}</p>
                <p>
                  📌 קואורדינטות: {p.latitude}, {p.longitude}
                </p>
              </div>

              {/* תגיות */}
              <div className="flex flex-wrap gap-1 mt-2">
                {p.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-gray-700 px-2 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* כפתורים */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setEditingPoint(p)}
                  className="bg-blue-500 text-black px-3 py-1 rounded"
                >
                  ערוך
                </button>

                <button
                  onClick={() => deletePoint(p.id)}
                  className="bg-red-500 text-black px-3 py-1 rounded"
                >
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🔥 PointForm מאוחד לעריכה */}
      {editingPoint && (
        <PointForm
          mode="edit"
          initialData={{
            name: editingPoint.name,
            description: editingPoint.description,
            address: editingPoint.address,
            website: editingPoint.website,
            tags: editingPoint.tags,
          }}
          onClose={() => setEditingPoint(null)}
          onSubmit={async ({ form, tags }) => {
            const formData = new FormData();

            formData.append("name", form.name);
            formData.append("description", form.description);
            formData.append("address", form.address);
            formData.append("website", form.website);
            formData.append("category", editingPoint.category);
            formData.append("tags", JSON.stringify(tags));

            const res = await fetch(
              `/api/points/${editingPoint.id}`,
              {
                method: "PUT",
                body: formData,
              }
            );

            if (res.ok) {
              const updated = await res.json();

              setPoints((prev) =>
                prev.map((p) =>
                  p.id === updated.id ? updated : p
                )
              );

              window.dispatchEvent(
                new Event("points-updated")
              );

              setEditingPoint(null);
            }
          }}
        />
      )}

      <button
        onClick={handleLogout}
        className="mt-6 bg-red-500 text-black px-4 py-2 rounded"
      >
        התנתק
      </button>
    </div>
  );
}