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
    // 👈 סטייט חדש ששומר את המזהה של הנקודה שאנחנו רוצים למחוק (כדי להציג את הודעת האישור)
    const [pointToDelete, setPointToDelete] = useState<number | null>(null);

    const categoryNames: Record<string, string> = {
        leaf: "Community",
        star: "Spirit",
        triangle: "Legacy",
        circle: "Business"
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

    // 👈 פונקציית המחיקה החדשה שמופעלת רק בלחיצה על "כן"
    async function executeDelete() {
        if (!pointToDelete) return;

        const res = await fetch(`/api/points/${pointToDelete}`, { method: "DELETE" });
        if (res.ok) {
            setPoints((prev) => prev.filter((p) => p.id !== pointToDelete));
            window.dispatchEvent(new Event("points-updated"));
        }
        setPointToDelete(null); // סגירת חלונית האישור
    }

    if (status === "loading") {
        return <div className="min-h-screen bg-black text-yellow-500 flex items-center justify-center">טוען נתונים...</div>;
    }

    const userName = session?.user?.name ? session.user.name : "האזור שלי";

    const displayPoints = tab === "my"
        ? points
        : tab === "history"
            ? historyPoints
            : savedCategory
                ? savedPoints.filter(p => p.category === savedCategory)
                : savedPoints;

    return (
        <div className="p-6 text-white bg-black min-h-screen" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl">{userName}</h1>
                <button onClick={() => router.push("/")} className="bg-gray-800 px-3 py-2 rounded hover:bg-gray-700">למפה</button>
            </div>

            {/* טאבים לניווט */}
            <div className="flex gap-4 border-b border-gray-800 pb-2 mb-6 text-lg">
                <button onClick={() => {setTab("my"); setSavedCategory(null);}} className={tab === "my" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400"}>הנקודות שלי</button>
                <button onClick={() => {setTab("history"); setSavedCategory(null);}} className={tab === "history" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400"}>היסטוריה</button>
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
            {displayPoints.length === 0 ? (
                <p className="text-gray-400">
                    {tab === "saved" && !savedCategory
                        ? "בחרי קטגוריה כדי לראות נקודות שמורות"
                        : "אין כאן נקודות להצגה..."
                    }
                </p>
            ) : (
                <div className="space-y-4">
                    {displayPoints.map((p) => (
                        <div key={p.id} className="border border-gray-700 bg-gray-900 p-4 rounded">
                            <h2 className="font-bold text-lg">{p.name}</h2>
                            {p.imageUrl && <img src={p.imageUrl} className="w-full h-40 object-cover rounded mt-2" />}
                            <p className="text-sm text-gray-300 mt-2">{p.description}</p>
                            <div className="text-xs text-gray-400 mt-2 space-y-1">
                                <p>📍 קטגוריה: {categoryNames[p.category] || p.category}</p>
                                <p>🏠 כתובת: {p.address || "אין"}</p>
                                <p>🌐 אתר: {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-blue-400 underline">למעבר לאתר</a> : "אין"}</p>
                            </div>
                            
                            {/* שורת הסטטיסטיקות עם אייקון הצמח */}
                            {tab === "my" && (
                                <div className="flex justify-around mt-4 pt-3 border-t border-gray-800 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">👁️ {p._count?.viewedBy || 0} צפיות</span>
                                    
                                    <span className="flex items-center gap-1">
                                        <img src="/icons/ui/plant/active.png" alt="שמירות" className="w-4 h-4 object-contain" />
                                        {p._count?.savedBy || 0} שמירות
                                    </span>
                                    
                                    {p.website && <span className="flex items-center gap-1">🔗 {p.linkClicks || 0} קליקים</span>}
                                </div>
                            )}
                            
                            {/* שורת הפעולות בתחתית הכרטיסיה */}
                            <div className="flex justify-between items-center mt-4">
                                
                                {/* צד ימין: כפתורי עריכה ומחיקה (רק אם זה הנקודות שלי) */}
                                <div className="flex gap-2">
                                    {tab === "my" && (
                                        <>
                                            <button onClick={() => setEditingPoint(p)} className="bg-blue-500 hover:bg-blue-600 text-black px-3 py-1.5 rounded text-sm transition">ערוך</button>
                                            <button onClick={() => setPointToDelete(p.id)} className="bg-red-500 hover:bg-red-600 text-black px-3 py-1.5 rounded text-sm transition">מחק</button>
                                        </>
                                    )}
                                </div>

                                {/* צד שמאל: כפתור קטן וחמוד למפה (מופיע תמיד) */}
                                <button 
                                    onClick={() => router.push(`/?point=${p.id}`)}
                                    className="bg-gray-800 hover:bg-gray-700 text-yellow-500 border border-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition"
                                >
                                    📍 למפה
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 👈 חלונית אישור מחיקה (Modal) */}
            {pointToDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
                    <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl w-[320px] text-center space-y-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-white">האם אתה בטוח שברצונך למחוק?</h3>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={executeDelete} 
                                className="bg-red-500 hover:bg-red-600 text-black px-6 py-2 rounded-lg font-bold transition"
                            >
                                כן
                            </button>
                            <button 
                                onClick={() => setPointToDelete(null)} 
                                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-bold transition"
                            >
                                לא
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* טופס עריכה */}
            {editingPoint && (
                <PointForm
                    mode="edit"
                    category={editingPoint.category as PointCategory}
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
                        if (form.extraInfo) formData.append("extraInfo", form.extraInfo);
                        if (form.image) formData.append("image", form.image);

                        const res = await fetch(`/api/points/${editingPoint.id}`, {
                            method: "PUT",
                            body: formData,
                        });

                        if (res.ok) {
                            const updated = await res.json();
                            setPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                            window.dispatchEvent(new Event("points-updated"));
                            setEditingPoint(null);
                        }
                    }}
                />
            )}

            <button onClick={handleLogout} className="mt-8 bg-red-500 text-black px-4 py-2 rounded">התנתק</button>
        </div>
    );
}