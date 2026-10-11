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
    name_en?: string | null;
    description?: string;
    description_en?: string | null;
    category: string;
    address?: string;
    website?: string;
    imageUrl?: string;
    imageUrls?: string[];
    latitude: number;
    longitude: number;
    linkClicks: number;
    createdAt: string;
    _count?: {
        viewedBy: number;
        savedBy: number;
    };
};

const t = {
    loading: { he: "טוען נתונים...", en: "Loading data..." },
    myArea: { he: "האזור שלי", en: "My Area" },
    toMap: { he: "למפה", en: "To Map" },
    mySeeds: { he: "הנקודות שלי", en: "My Seeds" },
    history: { he: "היסטוריה", en: "History" },
    saved: { he: "שמורים", en: "Saved" },
    settings: { he: "הגדרות", en: "Settings" }, // 🌟 הוספנו תרגום ללשונית החדשה
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
    deleteAccountConfirm: { he: "האם אתה בטוח? מחיקת החשבון היא פעולה בלתי הפיכה ותמחק את כל הנקודות שיצרת.", en: "Are you sure? Deleting your account is irreversible and will remove all seeds you created." }, // 🌟 אישור מחיקת משתמש
    deleting: { he: "מוחק...", en: "Deleting..." },
    yesDelete: { he: "כן, מחק", en: "Yes, delete" },
    cancel: { he: "ביטול", en: "Cancel" },
    logout: { he: "התנתק", en: "Log Out" },
    deleteAccount: { he: "מחיקת חשבון", en: "Delete Account" }, // 🌟 כפתור מחיקת חשבון
    terms: { he: "קריאת התקנון", en: "Terms of Service" }, // 🌟 כפתור תקנון
    language: { he: "שפת האפליקציה", en: "App Language" }, // 🌟 כפתור שפה
    participants: { he: "משתתפים ביוזמה", en: "Initiative Participants" },
};

export default function MyPointsPage() {
    const { data: session, status } = useSession();
    
    const [lang, setLang] = useState<"en" | "he">("he");

    useEffect(() => {
        const savedLang = localStorage.getItem("jseed_lang") as "en" | "he";
        if (savedLang) setLang(savedLang);
    }, []);

    const changeLanguage = (newLang: "en" | "he") => {
        setLang(newLang);
        localStorage.setItem("jseed_lang", newLang);
        window.dispatchEvent(new Event("language-changed")); // יודיע גם לשאר האפליקציה אם צריך
    };

    // 🌟 הוספנו את 'settings' ללשוניות
    const [tab, setTab] = useState<"my" | "history" | "saved" | "settings">("my");
    const [savedCategory, setSavedCategory] = useState<PointCategory | null>(null);
    const [points, setPoints] = useState<Point[]>([]);
    const [historyPoints, setHistoryPoints] = useState<Point[]>([]);
    const [savedPoints, setSavedPoints] = useState<Point[]>([]);
    const [allChaiPoints, setAllChaiPoints] = useState<Point[]>([]);
    
    const [editingPoint, setEditingPoint] = useState<Point | null>(null);
    const [pointToDelete, setPointToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // 🌟 סטייט חדש לאישור מחיקת חשבון
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const categoryNames: Record<string, string> = {
        leaf: "Community",
        star: "Spirit",
        triangle: "Legacy",
        circle: "Business",
        chai: "Chai", 
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

            const resChai = await fetch("/api/points?category=chai");
            if (resChai.ok) setAllChaiPoints(await resChai.json());
        }
        loadData();
    }, [router]);

    async function handleLogout() {
        await signOut({ redirect: false });
        router.push("/");
    }

    async function handleDeleteAccount() {
        if (isDeletingAccount) return;
        setIsDeletingAccount(true);
        try {
            // קריאה לשרת למחוק את היוזר שמחובר כרגע. נצטרך לוודא שיש לך נתיב כזה ב-API!
            const res = await fetch("/api/user", { method: "DELETE" });
            if (res.ok) {
                await signOut({ redirect: false });
                router.push("/");
            } else {
                alert("Failed to delete account. Please try again.");
            }
        } catch (error) {
            console.error("Error deleting account:", error);
        } finally {
            setIsDeletingAccount(false);
            setShowDeleteAccountModal(false);
        }
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
        <div className="p-4 sm:p-6 text-white bg-black min-h-screen" dir={lang === "he" ? "rtl" : "ltr"}>
            
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-xl sm:text-2xl font-bold truncate pr-2">{userName}</h1>
                
                <button onClick={() => router.push("/")} className="bg-gray-800 px-4 py-1.5 rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors border border-gray-700 shrink-0">
                    {t.toMap[lang]}
                </button>
            </div>

            {/* 🌟 שורת הלשוניות עודכנה עם גלילה אופקית (כדי שלא ישבר במסכים קטנים בגלל שהוספנו עוד לשונית) */}
            <div className="flex gap-4 sm:gap-6 border-b border-gray-800 pb-2 mb-6 text-base sm:text-lg overflow-x-auto custom-scrollbar whitespace-nowrap">
                <button onClick={() => {setTab("my"); setSavedCategory(null);}} className={`pb-1 px-1 transition-colors ${tab === "my" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.mySeeds[lang]}
                </button>
                <button onClick={() => {setTab("history"); setSavedCategory(null);}} className={`pb-1 px-1 transition-colors ${tab === "history" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.history[lang]}
                </button>
                <button onClick={() => setTab("saved")} className={`flex items-center gap-1.5 pb-1 px-1 transition-colors ${tab === "saved" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.saved[lang]} <img src="/icons/ui/plant/active.png" className="w-4 h-4 object-contain" />
                </button>
                <button onClick={() => {setTab("settings"); setSavedCategory(null);}} className={`pb-1 px-1 transition-colors ${tab === "settings" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.settings[lang]} ⚙️
                </button>
            </div>

            {/* ===================== לשונית הגדרות ===================== */}
            {tab === "settings" ? (
                <div className="space-y-6 max-w-md mx-auto mt-8">
                    
                    {/* שפה */}
                    <div className="bg-gray-900/50 border border-gray-800 p-5 rounded-xl shadow-lg">
                        <h2 className="text-gray-400 text-sm mb-3 font-bold">{t.language[lang]}</h2>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => changeLanguage("he")} 
                                className={`flex-1 py-2 rounded-lg font-bold transition-colors ${lang === "he" ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
                            >
                                עברית
                            </button>
                            <button 
                                onClick={() => changeLanguage("en")} 
                                className={`flex-1 py-2 rounded-lg font-bold transition-colors ${lang === "en" ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
                            >
                                English
                            </button>
                        </div>
                    </div>

                    {/* קישורים / מידע */}
                    <div className="bg-gray-900/50 border border-gray-800 p-5 rounded-xl shadow-lg">
                        <button 
                            onClick={() => router.push("/terms")} 
                            className="w-full text-start flex justify-between items-center py-2 text-gray-300 hover:text-yellow-500 transition-colors"
                        >
                            <span className="font-bold">📜 {t.terms[lang]}</span>
                            <span>{lang === "he" ? "❮" : "❯"}</span>
                        </button>
                    </div>

                    {/* אזור סכנה */}
                    <div className="bg-red-900/10 border border-red-900/30 p-5 rounded-xl shadow-lg mt-10">
                        <button 
                            onClick={handleLogout} 
                            className="w-full bg-gray-800 border border-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition font-bold mb-4"
                        >
                            🚪 {t.logout[lang]}
                        </button>
                        <button 
                            onClick={() => setShowDeleteAccountModal(true)} 
                            className="w-full bg-red-900/40 border border-red-800 text-red-200 px-6 py-3 rounded-lg hover:bg-red-900/60 transition font-bold"
                        >
                            ⚠️ {t.deleteAccount[lang]}
                        </button>
                    </div>
                </div>
            ) : (
                /* ===================== לשוניות נקודות (שלי/היסטוריה/שמורים) ===================== */
                <>
                    {tab === "saved" && (
                        <div className="flex justify-center gap-3 mb-6 flex-wrap">
                            {["leaf", "star", "triangle", "circle", "chai"].map((cat) => (
                                <button key={cat} onClick={() => setSavedCategory(savedCategory === cat as PointCategory ? null : cat as PointCategory)} className={`p-2 rounded-full border transition-colors ${savedCategory === cat ? "border-yellow-500 bg-yellow-500/20 shadow-[0_0_10px_rgba(251,191,36,0.3)]" : "border-gray-700 bg-gray-800 hover:bg-gray-700"}`}>
                                    <img src={`/icons/categories/${cat}/${savedCategory === cat ? "active" : "default"}.png`} className="w-7 h-7 sm:w-8 sm:h-8" />
                                </button>
                            ))}
                        </div>
                    )}

                    {displayPoints.length === 0 ? (
                        <p className="text-gray-400 text-center mt-10">
                            {tab === "saved" && !savedCategory
                                ? t.selectCategory[lang]
                                : t.noSeeds[lang]
                            }
                        </p>
                    ) : (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            {displayPoints.map((p) => {
                                const pointImages = p.imageUrls && p.imageUrls.length > 0 
                                    ? p.imageUrls 
                                    : (p.imageUrl ? [p.imageUrl] : []);
                                
                                const displayName = lang === "en" && p.name_en ? p.name_en : p.name;
                                const displayDesc = lang === "en" && p.description_en ? p.description_en : p.description;

                                const isChai = p.category === "chai";
                                const participantsCount = isChai ? Math.max(1, allChaiPoints.filter(cp => cp.name === p.name).length) : 0;

                                return (
                                <div key={p.id} className="relative border border-gray-800 bg-gray-900/50 p-4 rounded-xl shadow-lg overflow-hidden">
                                    <h2 className="font-bold text-xl">{displayName}</h2>
                                    
                                    <ImageGallery images={pointImages} />
                                    
                                    <p className="text-sm text-gray-300 mt-3">{displayDesc}</p>
                                    
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
                                            
                                            {isChai && (
                                                <span className="flex items-center gap-1 text-yellow-500 font-bold">
                                                    🤝 {participantsCount} {t.participants[lang]}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-center mt-5">
                                        <div className="flex gap-2">
                                            {tab === "my" && (
                                                <>
                                                    <button onClick={() => setEditingPoint(p)} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm transition">{t.edit[lang]}</button>
                                                    <button onClick={() => setPointToDelete(p.id)} className="bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-200 px-3 sm:px-4 py-2 rounded-lg text-sm transition">{t.delete[lang]}</button>
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
                </>
            )}

            {/* ===================== מודל מחיקת גרעין ===================== */}
            {pointToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
                    <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-[320px] text-center space-y-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-white">{t.deleteConfirm[lang]}</h3>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={executeDelete} 
                                disabled={isDeleting}
                                className="bg-red-500 hover:bg-red-600 text-black px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? t.deleting[lang] : t.yesDelete[lang]}
                            </button>
                            <button 
                                onClick={() => setPointToDelete(null)} 
                                disabled={isDeleting}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50"
                            >
                                {t.cancel[lang]}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== מודל מחיקת חשבון 🌟 ===================== */}
            {showDeleteAccountModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
                    <div className="bg-gray-900 border border-red-800 p-6 rounded-2xl w-[320px] text-center space-y-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-red-400">⚠️ {t.deleteAccount[lang]}</h3>
                        <p className="text-sm text-gray-300 leading-tight">{t.deleteAccountConfirm[lang]}</p>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={handleDeleteAccount} 
                                disabled={isDeletingAccount}
                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                            >
                                {isDeletingAccount ? t.deleting[lang] : t.yesDelete[lang]}
                            </button>
                            <button 
                                onClick={() => setShowDeleteAccountModal(false)} 
                                disabled={isDeletingAccount}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50 flex-1"
                            >
                                {t.cancel[lang]}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== טופס עריכה ===================== */}
            {editingPoint && (
                <PointForm
                    mode="edit"
                    category={editingPoint.category as PointCategory}
                    initialData={{
                        name: editingPoint.name,
                        description: editingPoint.description,
                        address: editingPoint.address,
                        website: editingPoint.website,
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
        </div>
    );
}