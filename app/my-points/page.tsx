"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PointForm from "@/src/components/PointForm";
import { signOut, useSession } from "next-auth/react";
import { PointCategory } from "@/src/types/point";

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
    const { data: session, status } = useSession();
    const [tab, setTab] = useState<"my" | "history" | "saved">("my");
    const [savedCategory, setSavedCategory] = useState<PointCategory | null>(null);
    const [points, setPoints] = useState<Point[]>([]);
    const [historyPoints, setHistoryPoints] = useState<Point[]>([]);
    const [savedPoints, setSavedPoints] = useState<Point[]>([]);
    const [editingPoint, setEditingPoint] = useState<Point | null>(null);

    const categoryNames: Record<string, string> = {
        leaf: "קהילה",
        star: "רוח",
        triangle: "מורשת",
        circle: "עסקים"
    };

    const router = useRouter();

    useEffect(() => {
        async function loadData() {
            const resMy = await fetch("/api/my-points");
            if (resMy.status === 401) { router.push("/auth"); return; }
            setPoints(await resMy.json());

            const resHistory = await fetch("/api/history");
            if (resHistory.ok) setHistoryPoints(await resHistory.json());

            const resSaved = await fetch("/api/saved");
            if (resSaved.ok) setSavedPoints(await resSaved.json());
        }
        loadData();
    }, [router]);

    async function handleLogout() {
        await signOut({ redirect: false });
        router.push("/");
    }

    async function deletePoint(id: number) {
        const res = await fetch(`/api/points/${id}`, { method: "DELETE" });
        if (res.ok) {
            setPoints((prev) => prev.filter((p) => p.id !== id));
            window.dispatchEvent(new Event("points-updated"));
        }
    }

    if (status === "loading") {
        return <div className="min-h-screen bg-black text-yellow-500 flex items-center justify-center">טוען נתונים...</div>;
    }

    const userName = session?.user?.name ? session.user.name : "האזור שלי";

    // סינון הנקודות: אם בטאב שמורים ויש קטגוריה, נסנן אותן
    const displayPoints = tab === "my"
        ? points
        : tab === "history"
            ? historyPoints
            : savedCategory
                ? savedPoints.filter(p => p.category === savedCategory)
                : [];

    return (
        <div className="p-6 text-white bg-black min-h-screen" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl">{userName}</h1>
                <button onClick={() => router.push("/")} className="bg-gray-800 px-3 py-2 rounded hover:bg-gray-700">למפה</button>
            </div>

            {/* טאבים לניווט */}
            <div className="flex gap-4 border-b border-gray-800 pb-2 mb-6 text-lg">
                <button onClick={() => { setTab("my"); setSavedCategory(null); }} className={tab === "my" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400"}>הנקודות שלי</button>
                <button onClick={() => { setTab("history"); setSavedCategory(null); }} className={tab === "history" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400"}>היסטוריה</button>
                <button onClick={() => setTab("saved")} className={`flex items-center gap-1.5 pb-1 ${tab === "saved" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400"}`}>
                    שמורים <img src="/icons/ui/plant/active.png" className="w-4 h-4 object-contain" />
                </button>
            </div>

            {/* סינון קטגוריות לטאב שמורים */}
            {tab === "saved" && (
                <div className="flex justify-center gap-3 mb-6">
                    {["leaf", "star", "triangle", "circle"].map((cat) => (
                        <button key={cat} onClick={() => setSavedCategory(savedCategory === cat as PointCategory ? null : cat as PointCategory)} className={`p-2 rounded-full border ${savedCategory === cat ? "border-yellow-500 bg-yellow-500/20" : "border-gray-700 bg-gray-800"}`}>
                            <img src={`/icons/categories/${cat}/${savedCategory === cat ? "active" : "default"}.png`} className="w-8 h-8" />
                        </button>
                    ))}
                </div>
            )}

            {/* רשימת נקודות */}
            {displayPoints.length === 0 ?
                <p className="text-gray-400">
                    {tab === "saved" && !savedCategory
                        ? "בחרי קטגוריה כדי לראות נקודות שמורות"
                        : "אין כאן נקודות להצגה..."
                    }
                </p>
                : (

                    <div className="space-y-4">
                        {displayPoints.map((p) => (
                            <div key={p.id} className="border border-gray-700 bg-gray-900 p-4 rounded">
                                <h2 className="font-bold text-lg">{p.name}</h2>
                                {p.imageUrl && <img src={p.imageUrl} className="w-full h-40 object-cover rounded mt-2" />}
                                <p className="text-sm text-gray-300 mt-2">{p.description}</p>
                                <div className="text-xs text-gray-400 mt-2 space-y-1">
                                    <p>📍 קטגוריה: {categoryNames[p.category] || p.category}</p>
                                    <p>🏠 כתובת: {p.address || "אין"}</p>
                                    <p>🌐 אתר: {p.website ? <a href={p.website} target="_blank" className="text-blue-400 underline">למעבר לאתר</a> : "אין"}</p>
                                </div>

                                {tab === "my" && (
                                    <div className="flex justify-around mt-4 pt-3 border-t border-gray-800 text-xs text-gray-400">
                                        <span>👁️ {p._count?.viewedBy || 0} צפיות</span>
                                        <span>❤️ {p._count?.savedBy || 0} שמירות</span>
                                        {p.website && <span>🔗 {p.linkClicks || 0} קליקים</span>}
                                    </div>
                                )}

                                {tab === "my" && (
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => setEditingPoint(p)} className="bg-blue-500 text-black px-3 py-1 rounded">ערוך</button>
                                        <button onClick={() => deletePoint(p.id)} className="bg-red-500 text-black px-3 py-1 rounded">מחק</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

            {/* PointForm... */}
            <button onClick={handleLogout} className="mt-8 bg-red-500 text-black px-4 py-2 rounded">התנתק</button>
        </div>
    );
}