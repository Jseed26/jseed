"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type Point = {
    id: number;
    name: string;
    description?: string;
    category: string;
};

export default function MyPointsPage() {
    const [points, setPoints] = useState<Point[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "",
    });

    const router = useRouter();

    async function handleLogout() {
        await signOut({
            redirect: false,
        });

        router.push("/");
    }

    function startEdit(point: Point) {
        setEditingId(point.id);
        setForm({
            name: point.name || "",
            description: point.description || "",
            category: point.category || "",
        });
    }

    async function saveEdit() {
        if (editingId === null) return;

        const res = await fetch(`/api/points/${editingId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(form),
        });

        console.log("status:", res.status);

        if (res.ok) {
            const updated = await res.json();

            setPoints((prev) =>
                prev.map((p) => (p.id === updated.id ? updated : p))
            );

            setEditingId(null);

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

            {points.length === 0 ? (
                <p className="text-gray-400">אין לך עדיין נקודות</p>
            ) : (
                <div className="space-y-4">
                    {points.map((p) => (
                        <div
                            key={p.id}
                            className="border border-gray-700 bg-gray-900 p-4 rounded"
                        >
                            {editingId === p.id ? (
                                // ✏️ מצב עריכה
                                <div className="space-y-3">

                                    {/* שם */}
                                    <div>
                                        <label className="text-xs text-gray-400">
                                            שם הנקודה
                                        </label>
                                        <input
                                            className="block w-full bg-gray-800 text-white p-2 rounded"
                                            value={form.name}
                                            onChange={(e) =>
                                                setForm({ ...form, name: e.target.value })
                                            }
                                        />
                                    </div>

                                    {/* קטגוריה */}
                                    <div>
                                        <label className="text-xs text-gray-400">
                                            קטגוריה
                                        </label>
                                        <input
                                            className="block w-full bg-gray-800 text-white p-2 rounded"
                                            value={form.category}
                                            onChange={(e) =>
                                                setForm({ ...form, category: e.target.value })
                                            }
                                        />
                                    </div>

                                    {/* תיאור */}
                                    <div>
                                        <label className="text-xs text-gray-400">
                                            תיאור
                                        </label>
                                        <textarea
                                            className="block w-full bg-gray-800 text-white p-2 rounded"
                                            value={form.description}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    description: e.target.value,
                                                })
                                            }
                                        />
                                    </div>

                                    {/* כפתורים */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={saveEdit}
                                            className="bg-green-500 text-black px-3 py-1 rounded"
                                        >
                                            שמור
                                        </button>

                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="bg-gray-600 px-3 py-1 rounded"
                                        >
                                            ביטול
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // 👁️ מצב תצוגה
                                <div>
                                    <h2 className="font-bold text-lg">{p.name}</h2>
                                    <p className="text-sm text-gray-300">
                                        {p.description}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        קטגוריה: {p.category}
                                    </p>

                                    <button
                                        onClick={() => startEdit(p)}
                                        className="mt-3 bg-blue-500 text-black px-3 py-1 rounded"
                                    >
                                        ערוך
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
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