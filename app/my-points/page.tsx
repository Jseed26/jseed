"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PointForm from "@/src/components/PointForm";
import { signOut, useSession } from "next-auth/react";

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
    extraInfo?: string;
    linkClicks: number;
    _count?: {
        viewedBy: number;
        savedBy: number;
    };
};

export default function MyPointsPage() {
    // 1. כל ה-Hooks חייבים להיות למעלה
    const { data: session, status } = useSession();
    const [tab, setTab] = useState<"my" | "history" | "saved">("my");
    const [points, setPoints] = useState<Point[]>([]);
    const [historyPoints, setHistoryPoints] = useState<Point[]>([]);
    const [savedPoints, setSavedPoints] = useState<Point[]>([]);
    const [editingPoint, setEditingPoint] = useState<Point | null>(null);

    const router = useRouter();

    useEffect(() => {
        if (session) {
            console.log("Current Session Data:", session);
        }
    }, [session]);

    useEffect(() => {
        async function loadData() {
            const resMy = await fetch("/api/my-points");
            if (resMy.status === 401) {
                router.push("/auth");
                return;
            }
            const myData = await resMy.json();
            setPoints(myData);

            const resHistory = await fetch("/api/history");
            if (resHistory.ok) {
                const historyData = await resHistory.json();
                setHistoryPoints(historyData);
            }

            const resSaved = await fetch("/api/saved");
            if (resSaved.ok) {
                const savedData = await resSaved.json();
                setSavedPoints(savedData);
            }
        }

        loadData();
    }, [router]);

    // 2. פונקציות רגילות
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

    // 3. 👈 עכשיו, אחרי שכל ה-Hooks הוגדרו בבטחה, אפשר לעשות בדיקות ו-Returns מוקדמים!
    if (status === "loading") {
        return (
            <div className="min-h-screen bg-black text-yellow-500 flex items-center justify-center">
                טוען נתונים...
            </div>
        );
    }

    const userName = session?.user?.name ? session.user.name : "";

    const displayPoints =
        tab === "my"
            ? points
            : tab === "history"
                ? historyPoints
                : savedPoints;

    return (
        <div className="p-6 text-white bg-black min-h-screen" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl">האזור האישי של {userName}</h1>
                <button
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 text-white bg-gray-800 px-3 py-2 rounded hover:bg-gray-700"
                >
                    ← חזרה למפה
                </button>
            </div>

            {/* טאבים לניווט */}
            <div className="flex gap-4 border-b border-gray-800 pb-2 mb-6 text-lg">
                <button
                    onClick={() => setTab("my")}
                    className={tab === "my" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400 hover:text-gray-200"}
                >
                    הנקודות שלי
                </button>
                <button
                    onClick={() => setTab("history")}
                    className={tab === "history" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400 hover:text-gray-200"}
                >
                    היסטוריית צפיות
                </button>
                <button
                    onClick={() => setTab("saved")}
                    className={tab === "saved" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400 hover:text-gray-200"}
                >
                    שמורים ❤️
                </button>
            </div>

            {displayPoints.length === 0 ? (
                <p className="text-gray-400 mt-4">
                    {tab === "my"
                        ? "אין לך עדיין נקודות שיצרת"
                        : tab === "history"
                            ? "טרם צפית בנקודות"
                            : "אין לך עדיין נקודות שמורות"}
                </p>
            ) : (
                <div className="space-y-4 mt-4">
                    {displayPoints.map((p) => (
                        <div
                            key={p.id}
                            className="border border-gray-700 bg-gray-900 p-4 rounded"
                        >
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
                            </div>

                            {tab === "my" && (
                                <div className="flex justify-around items-center mt-4 pt-3 border-t border-gray-800 text-sm text-gray-400 bg-black/30 p-2 rounded-lg">
                                    <div className="flex flex-col items-center">
                                        <span className="text-lg">👁️</span>
                                        <span>{p._count?.viewedBy || 0} צפיות</span>
                                    </div>
                                    <div className="w-px h-8 bg-gray-700"></div>

                                    <div className="flex flex-col items-center">
                                        <span className="text-lg">❤️</span>
                                        <span>{p._count?.savedBy || 0} שמירות</span>
                                    </div>

                                    {p.website && (
                                        <>
                                            <div className="w-px h-8 bg-gray-700"></div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg">🔗</span>
                                                <span>{p.linkClicks || 0} קליקים</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {tab === "my" && (
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
                            )}
                        </div>
                    ))}
                </div>
            )}

            {editingPoint && (
                <PointForm
                    mode="edit"
                    initialData={{
                        name: editingPoint.name,
                        description: editingPoint.description,
                        address: editingPoint.address,
                        website: editingPoint.website,
                        extraInfo: editingPoint.extraInfo,
                        lat: editingPoint.latitude,
                        lng: editingPoint.longitude,
                    }}
                    onClose={() => setEditingPoint(null)}
                    onSubmit={async ({ form }) => {
                        const formData = new FormData();
                        formData.append("name", form.name);
                        formData.append("description", form.description);
                        formData.append("address", form.address);
                        formData.append("website", form.website);
                        formData.append("category", editingPoint.category);

                        if (form.extraInfo) {
                            formData.append("extraInfo", form.extraInfo);
                        }

                        if (form.image) {
                            formData.append("image", form.image);
                        }

                        const res = await fetch(`/api/points/${editingPoint.id}`, {
                            method: "PUT",
                            body: formData,
                        });

                        if (res.ok) {
                            const updated = await res.json();
                            setPoints((prev) =>
                                prev.map((p) => (p.id === updated.id ? updated : p))
                            );
                            window.dispatchEvent(new Event("points-updated"));
                            setEditingPoint(null);
                        }
                    }}
                />
            )}

            <button
                onClick={handleLogout}
                className="mt-8 bg-red-500 text-black px-4 py-2 rounded animate-pulse"
            >
                התנתק
            </button>
        </div>
    );
}