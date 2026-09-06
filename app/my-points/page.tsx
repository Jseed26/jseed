"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PointForm from "@/src/components/PointForm";
import { signOut, useSession } from "next-auth/react";
import { PointCategory } from "@/src/types/point";
import ImageGallery from "@/src/components/ImageGallery";

type Point = {
    id: number;
    name: string;
    description?: string;
    category: string;
    address?: string;
    website?: string;
    imageUrl?: string;
    imageUrls?: string[];
    latitude: number;
    longitude: number;
    extraInfo?: string;
    linkClicks: number;
    _count?: {
        viewedBy: number;
        savedBy: number;
    };
};

const t = {
    loading: { he: "טוען נתונים...", en: "Loading data..." },
    myArea: { he: "האזור שלי", en: "My Area" },
    toMap: { he: "למפה", en: "To Map" },
    language: { he: "שפה", en: "Language" },
    mySeeds: { he: "הנקודות שלי", en: "My Seeds" },
    history: { he: "היסטוריה", en: "History" },
    saved: { he: "שמורים", en: "Saved" },
    selectCategory: { he: "בחרי קטגוריה כדי לראות נקודות שמורות", en: "Select a category to view saved seeds" },
    noSeeds: { he: "אין כאן נקודות להצגה...", en: "No seeds to display here..." },
    category: { he: "קטגוריה:", en: "Category:" },
    address: { he: "כתובת:", en: "Address:" },
    none: { he: "אין", en: "None" },
    website: { he: "אתר:", en: "Website:" },
    visitSite: { he: "למעבר לאתר", en: "Visit Site" },
    views: { he: "צפיות", en: "Views" },
    saves: { he: "שמירות", en: "Saves" },
    clicks: { he: "קליקים", en: "Clicks" },
    edit: { he: "ערוך", en: "Edit" },
    delete: { he: "מחק", en: "Delete" },
    viewOnMap: { he: "צפה במפה", en: "View on Map" },
    deleteConfirm: { he: "האם אתה בטוח שברצונך למחוק גרעין זה?", en: "Are you sure you want to delete this seed?" },
    deleting: { he: "מוחק...", en: "Deleting..." },
    yesDelete: { he: "כן, מחק", en: "Yes, delete" },
    cancel: { he: "ביטול", en: "Cancel" },
    logout: { he: "התנתק", en: "Log Out" },
};

export default function MyPointsPage() {
    const { data: session, status } = useSession();
    
    // 🌟 ברירת מחדל: עברית
    const [lang, setLang] = useState<"en" | "he">("he");
    const [isLangOpen, setIsLangOpen] = useState(false);

    const [tab, setTab] = useState<"my" | "history" | "saved">("my");
    const [savedCategory, setSavedCategory] = useState<PointCategory | null>(null);
    const [points, setPoints] = useState<Point[]>([]);
    const [historyPoints, setHistoryPoints] = useState<Point[]>([]);
    const [savedPoints, setSavedPoints] = useState<Point[]>([]);
    
    const [editingPoint, setEditingPoint] = useState<Point | null>(null);
    const [pointToDelete, setPointToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    async function executeDelete() {
        if (!pointToDelete || isDeleting) return; 
        
        setIsDeleting(true); 

        try {
            const res = await fetch(`/api/points/${pointToDelete}`, { method: "DELETE" });
            if (res.ok) {
                setPoints((prev) => prev.filter((p) => p.id !== pointToDelete));
                window.dispatchEvent(new Event("points-updated"));
            }
        } catch (error) {
            console.error("Error deleting point:", error);
        } finally {
            setIsDeleting(false); 
            setPointToDelete(null); 
        }
    }

    if (status === "loading") {
        return <div className="min-h-screen bg-black text-yellow-500 flex items-center justify-center">{t.loading[lang]}</div>;
    }

    const userName = session?.user?.name ? session.user.name : t.myArea[lang];

    const displayPoints = tab === "my"
        ? points
        : tab === "history"
            ? historyPoints
            : savedCategory
                ? savedPoints.filter(p => p.category === savedCategory)
                : savedPoints;

    return (
        <div className="p-6 text-white bg-black min-h-screen" dir={lang === "he" ? "rtl" : "ltr"}>
            
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">{userName}</h1>
                
                <div className="flex items-center gap-3">
                    {/* 🌟 תפריט בחירת שפה נפתח */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsLangOpen(!isLangOpen)}
                            className="flex items-center gap-1.5 border border-yellow-500 text-yellow-500 px-3 py-1.5 rounded-lg hover:bg-yellow-500/10 transition text-sm font-bold"
                        >
                            🌐 {t.language[lang]}
                        </button>
                        
                        {isLangOpen && (
                            <div className={`absolute top-full mt-2 w-28 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden ${lang === "he" ? "right-0" : "left-0"}`}>
                                <button 
                                    onClick={() => { setLang("he"); setIsLangOpen(false); }}
                                    className={`px-4 py-2 text-sm text-center hover:bg-gray-800 transition ${lang === "he" ? "text-yellow-500 font-bold bg-gray-800" : "text-gray-300"}`}
                                >
                                    עברית
                                </button>
                                <button 
                                    onClick={() => { setLang("en"); setIsLangOpen(false); }}
                                    className={`px-4 py-2 text-sm text-center hover:bg-gray-800 transition ${lang === "en" ? "text-yellow-500 font-bold bg-gray-800" : "text-gray-300"}`}
                                >
                                    English
                                </button>
                            </div>
                        )}
                    </div>

                    <button onClick={() => router.push("/")} className="bg-gray-800 px-4 py-1.5 rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors border border-gray-700">
                        {t.toMap[lang]}
                    </button>
                </div>
            </div>

            <div className="flex gap-4 border-b border-gray-800 pb-2 mb-6 text-lg">
                <button onClick={() => {setTab("my"); setSavedCategory(null);}} className={tab === "my" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400"}>
                    {t.mySeeds[lang]}
                </button>
                <button onClick={() => {setTab("history"); setSavedCategory(null);}} className={tab === "history" ? "text-yellow-500 font-bold border-b-2 border-yellow-500 pb-1" : "text-gray-400"}>
                    {t.history[lang]}
                </button>
                <button onClick={() => setTab("saved")} className={`flex items-center gap-1.5 pb-1 ${tab === "saved" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400"}`}>
                    {t.saved[lang]} <img src="/icons/ui/plant/active.png" className="w-4 h-4 object-contain" />
                </button>
            </div>

            {tab === "saved" && (
                <div className="flex justify-center gap-3 mb-6">
                    {["leaf", "star", "triangle", "circle"].map((cat) => (
                        <button key={cat} onClick={() => setSavedCategory(savedCategory === cat as PointCategory ? null : cat as PointCategory)} className={`p-2 rounded-full border ${savedCategory === cat ? "border-yellow-500 bg-yellow-500/20" : "border-gray-700 bg-gray-800"}`}>
                            <img src={`/icons/categories/${cat}/${savedCategory === cat ? "active" : "default"}.png`} className="w-8 h-8" />
                        </button>
                    ))}
                </div>
            )}

            {displayPoints.length === 0 ? (
                <p className="text-gray-400">
                    {tab === "saved" && !savedCategory
                        ? t.selectCategory[lang]
                        : t.noSeeds[lang]
                    }
                </p>
            ) : (
                <div className="space-y-4">
                    {displayPoints.map((p) => {
                        const pointImages = p.imageUrls && p.imageUrls.length > 0 
                            ? p.imageUrls 
                            : (p.imageUrl ? [p.imageUrl] : []);
                        
                        return (
                        <div key={p.id} className="border border-gray-800 bg-gray-900/50 p-4 rounded-xl shadow-lg">
                            <h2 className="font-bold text-xl">{p.name}</h2>
                            
                            <ImageGallery images={pointImages} />
                            
                            <p className="text-sm text-gray-300 mt-3">{p.description}</p>
                            
                            <div className="text-xs text-gray-400 mt-3 space-y-1.5 bg-black/40 p-3 rounded-lg border border-gray-800">
                                <p>📍 {t.category[lang]} {categoryNames[p.category] || p.category}</p>
                                <p>🏠 {t.address[lang]} {p.address || t.none[lang]}</p>
                                <p>🌐 {t.website[lang]} {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-yellow-500 hover:underline">{t.visitSite[lang]}</a> : t.none[lang]}</p>
                            </div>
                            
                            {tab === "my" && (
                                <div className="flex justify-around mt-4 pt-4 border-t border-gray-800 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">👁️ {p._count?.viewedBy || 0} {t.views[lang]}</span>
                                    <span className="flex items-center gap-1">
                                        <img src="/icons/ui/plant/active.png" alt="Saves" className="w-4 h-4 object-contain" />
                                        {p._count?.savedBy || 0} {t.saves[lang]}
                                    </span>
                                    {p.website && <span className="flex items-center gap-1">🔗 {p.linkClicks || 0} {t.clicks[lang]}</span>}
                                </div>
                            )}
                            
                            <div className="flex justify-between items-center mt-5">
                                <div className="flex gap-2">
                                    {tab === "my" && (
                                        <>
                                            <button onClick={() => setEditingPoint(p)} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">{t.edit[lang]}</button>
                                            <button onClick={() => setPointToDelete(p.id)} className="bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-200 px-4 py-2 rounded-lg text-sm transition">{t.delete[lang]}</button>
                                        </>
                                    )}
                                </div>
                                <button 
                                    onClick={() => router.push(`/?point=${p.id}`)}
                                    className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition shadow-lg"
                                >
                                    📍 {t.viewOnMap[lang]}
                                </button>
                            </div>
                        </div>
                    )})}
                </div>
            )}

            {pointToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
                    <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-[320px] text-center space-y-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-white">{t.deleteConfirm[lang]}</h3>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={executeDelete} 
                                disabled={isDeleting}
                                className="bg-red-500 hover:bg-red-600 text-black px-8 py-2.5 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? t.deleting[lang] : t.yesDelete[lang]}
                            </button>
                            <button 
                                onClick={() => setPointToDelete(null)} 
                                disabled={isDeleting}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-2.5 rounded-xl font-bold transition disabled:opacity-50"
                            >
                                {t.cancel[lang]}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        existingImages: editingPoint.imageUrls && editingPoint.imageUrls.length > 0 
                            ? editingPoint.imageUrls 
                            : (editingPoint.imageUrl ? [editingPoint.imageUrl] : [])
                    }}
                    onClose={() => setEditingPoint(null)}
                    onSubmit={async ({ form }) => {
                        const formData = new FormData();
                        formData.append("name", form.name);
                        formData.append("description", form.description);
                        formData.append("address", form.address);
                        formData.append("website", form.website);
                        formData.append("category", form.category || editingPoint.category);
                        if (form.extraInfo) formData.append("extraInfo", form.extraInfo);
                        
                        if (form.images && form.images.length > 0) {
                            form.images.forEach(img => {
                                formData.append("images", img);
                            });
                        }

                        if (form.existingImages && form.existingImages.length > 0) {
                            form.existingImages.forEach(url => {
                                formData.append("existingImages", url);
                            });
                        }

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

            <button onClick={handleLogout} className="mt-8 bg-red-900/30 border border-red-800 text-red-400 px-6 py-2 rounded-lg hover:bg-red-900/50 transition">
                {t.logout[lang]}
            </button>
        </div>
    );
}