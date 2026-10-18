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

type Notification = {
    id: number;
    message: string;
    isRead: boolean;
    createdAt: string;
};

const t = {
    loading: { he: "טוען נתונים...", en: "Loading data..." },
    myArea: { he: "האזור שלי", en: "My Area" },
    toMap: { he: "למפה", en: "To Map" },
    mySeeds: { he: "הנקודות שלי", en: "My Seeds" },
    history: { he: "היסטוריה", en: "History" },
    saved: { he: "שמורים", en: "Saved" },
    settings: { he: "הגדרות", en: "Settings" },
    notifications: { he: "התראות", en: "Notifications" },
    selectCategory: { he: "בחרי קטגוריה כדי לראות נקודות שמורות", en: "Select a category to view saved seeds" },
    noSeeds: { he: "אין כאן נקודות להצגה...", en: "No seeds to display here..." },
    noNotifications: { he: "אין לך התראות כרגע.", en: "You have no notifications yet." },
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
    deleteAccountConfirm: { he: "האם אתה בטוח? מחיקת החשבון היא פעולה בלתי הפיכה ותמחק את כל הנקודות שיצרת.", en: "Are you sure? Deleting your account is irreversible and will remove all seeds you created." },
    deleting: { he: "מוחק...", en: "Deleting..." },
    yesDelete: { he: "כן, מחק", en: "Yes, delete" },
    cancel: { he: "ביטול", en: "Cancel" },
    logout: { he: "התנתק", en: "Log Out" },
    deleteAccount: { he: "מחיקת חשבון", en: "Delete Account" },
    terms: { he: "קריאת התקנון", en: "Terms of Service" },
    language: { he: "שפת האפליקציה", en: "App Language" },
    participants: { he: "משתתפים ביוזמה", en: "Initiative Participants" },
    mustLogin: { he: "יש להתחבר על מנת לראות", en: "Please log in to view" },
    loginNow: { he: "התחבר עכשיו", en: "Log In Now" },
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
        window.dispatchEvent(new Event("language-changed"));
    };

    const [tab, setTab] = useState<"my" | "history" | "saved" | "notifications" | "settings">("my");
    const [savedCategory, setSavedCategory] = useState<PointCategory | null>(null);

    const [points, setPoints] = useState<Point[]>([]);
    const [historyPoints, setHistoryPoints] = useState<Point[]>([]);
    const [savedPoints, setSavedPoints] = useState<Point[]>([]);
    const [allChaiPoints, setAllChaiPoints] = useState<Point[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const [editingPoint, setEditingPoint] = useState<Point | null>(null);
    const [pointToDelete, setPointToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const isLoggedIn = status === "authenticated";
    const router = useRouter();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (tabParam && ["my", "history", "saved", "notifications", "settings"].includes(tabParam)) {
            setTab(tabParam as any);
        }
    }, []);

    const handleTabChange = (newTab: "my" | "history" | "saved" | "notifications" | "settings") => {
        setTab(newTab);
        window.history.replaceState(null, '', `?tab=${newTab}`);
    };

    useEffect(() => {
        async function loadData() {
            if (status === "loading") return;

            try {
                const resChai = await fetch("/api/points?category=chai", { cache: "no-store" });
                if (resChai.ok) setAllChaiPoints(await resChai.json());

                if (status === "authenticated") {
                    const resMy = await fetch("/api/my-points", { cache: "no-store" });
                    if (resMy.ok) setPoints(await resMy.json());

                    const resHistory = await fetch("/api/history", { cache: "no-store" });
                    if (resHistory.ok) setHistoryPoints(await resHistory.json());

                    const resSaved = await fetch("/api/saved", { cache: "no-store" });
                    if (resSaved.ok) setSavedPoints(await resSaved.json());

                    const resNotif = await fetch("/api/notifications", { cache: "no-store" });
                    if (resNotif.ok) setNotifications(await resNotif.json());
                }
            } catch (err) { console.error(err); }
        }
        loadData();
    }, [status]);

    useEffect(() => {
        if (isLoggedIn && tab === "notifications" && notifications.some(n => !n.isRead)) {
            fetch("/api/notifications", { method: "POST" })
                .then(() => {
                    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                })
                .catch(console.error);
        }
    }, [tab, notifications, isLoggedIn]);

    async function handleLogout() {
        await signOut({ redirect: false });
        router.push("/");
    }

    async function handleDeleteAccount() {
        if (isDeletingAccount) return;
        setIsDeletingAccount(true);
        try {
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

    const userName = isLoggedIn && session?.user?.name ? session.user.name : t.myArea[lang];

    const displayPoints = tab === "my"
        ? points
        : tab === "history"
            ? historyPoints
            : savedCategory
                ? savedPoints.filter(p => p.category === savedCategory)
                : savedPoints;

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const categoryNames: Record<string, string> = {
        leaf: "Community",
        star: "Spirit",
        triangle: "Legacy",
        circle: "Business",
        chai: "Chai",
    };

    return (
        // הוספנו pb-32 (padding-bottom) כדי לאפשר גלילה מעבר לבאנר של אפל/אנדרואיד
        <div className="p-4 sm:p-6 pb-32 text-white bg-black min-h-screen" dir={lang === "he" ? "rtl" : "ltr"}>

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-xl sm:text-2xl font-bold truncate pr-2">{userName}</h1>

                <button onClick={() => router.push("/")} className="bg-gray-800 px-4 py-1.5 rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors border border-gray-700 shrink-0">
                    {t.toMap[lang]}
                </button>
            </div>

            <div className="flex gap-4 sm:gap-6 border-b border-gray-800 pb-2 mb-6 text-base sm:text-lg overflow-x-auto custom-scrollbar whitespace-nowrap">
                <button onClick={() => { handleTabChange("my"); setSavedCategory(null); }} className={`pb-1 px-1 transition-colors ${tab === "my" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.mySeeds[lang]}
                </button>
                <button onClick={() => { handleTabChange("history"); setSavedCategory(null); }} className={`pb-1 px-1 transition-colors ${tab === "history" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.history[lang]}
                </button>
                <button onClick={() => handleTabChange("saved")} className={`flex items-center gap-1.5 pb-1 px-1 transition-colors ${tab === "saved" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.saved[lang]} <img src="/icons/ui/save/active.png" className="w-4 h-4 object-contain" />
                </button>
                <button onClick={() => { handleTabChange("notifications"); setSavedCategory(null); }} className={`flex items-center gap-1.5 pb-1 px-1 transition-colors relative ${tab === "notifications" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.notifications[lang]} 🔔
                    {unreadCount > 0 && isLoggedIn && (
                        <span className={`absolute -top-1 ${lang === "he" ? "-left-2" : "-right-2"} bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full`}>
                            {unreadCount}
                        </span>
                    )}
                </button>
                <button onClick={() => { handleTabChange("settings"); setSavedCategory(null); }} className={`pb-1 px-1 transition-colors ${tab === "settings" ? "text-yellow-500 font-bold border-b-2 border-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                    {t.settings[lang]} ⚙️
                </button>
            </div>

            {/* ===================== מנגנון אורח (משתמש לא מחובר) ===================== */}
            {!isLoggedIn && tab !== "settings" ? (
                <div className="flex flex-col items-center justify-center mt-32 space-y-6 px-4 text-center">
                    <p className="text-gray-400 text-lg font-bold">{t.mustLogin[lang]}</p>
                    <button
                        onClick={() => router.push("/auth")}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-xl font-bold shadow-lg transition"
                    >
                        {t.loginNow[lang]}
                    </button>
                </div>
            ) : (
                <>
                    {/* ===================== לשונית התראות ===================== */}
                    {tab === "notifications" && (
                        <div className="space-y-3 max-w-2xl mx-auto">
                            {notifications.length === 0 ? (
                                <p className="text-gray-400 text-center mt-10">{t.noNotifications[lang]}</p>
                            ) : (
                                notifications.map((notif) => (
                                    <div key={notif.id} className={`p-4 rounded-xl border transition-colors ${notif.isRead ? "bg-gray-900/50 border-gray-800" : "bg-yellow-500/10 border-yellow-500/50 shadow-md"}`}>
                                        <p className={`text-sm sm:text-base ${notif.isRead ? "text-gray-300" : "text-white font-bold"}`}>
                                            {notif.message}
                                        </p>
                                        <span className="text-[10px] text-gray-500 mt-2 block">
                                            {new Date(notif.createdAt).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ===================== לשונית הגדרות (מעוצב מחדש) ===================== */}
                    {tab === "settings" && (
                        <div className="space-y-6 max-w-md mx-auto mt-8 animate-in fade-in duration-300">

                            {/* שפה */}
                            <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-2xl shadow-lg">
                                <div className="flex items-center gap-2 text-gray-400 mb-5">
                                    {/* אייקון גלובוס נקי */}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
                                    <h2 className="text-sm font-bold uppercase tracking-widest">{t.language[lang]}</h2>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => changeLanguage("he")}
                                        className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 ${lang === "he" ? "bg-gradient-to-r from-yellow-600 to-yellow-500 text-black shadow-[0_0_15px_rgba(251,191,36,0.2)] border-transparent" : "bg-black border border-gray-700 text-gray-400 hover:border-gray-500"}`}
                                    >
                                        עברית
                                    </button>
                                    <button
                                        onClick={() => changeLanguage("en")}
                                        className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 ${lang === "en" ? "bg-gradient-to-r from-yellow-600 to-yellow-500 text-black shadow-[0_0_15px_rgba(251,191,36,0.2)] border-transparent" : "bg-black border border-gray-700 text-gray-400 hover:border-gray-500"}`}
                                    >
                                        English
                                    </button>
                                </div>
                            </div>

                            {/* קישורים / מידע */}
                            <button
                                onClick={() => router.push("/terms")}
                                className="w-full bg-gray-900/40 border border-gray-800 p-6 rounded-2xl shadow-lg flex justify-between items-center group hover:border-yellow-500/50 transition-all duration-300"
                            >
                                <div className="flex items-center gap-3 text-gray-300 group-hover:text-yellow-500 transition-colors">
                                    {/* אייקון מסמך נקי */}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>
                                    <span className="font-bold text-base">{t.terms[lang]}</span>
                                </div>
                                <span className="text-gray-600 group-hover:text-yellow-500 transition-colors">{lang === "he" ? "❮" : "❯"}</span>
                            </button>

                            {/* אזור סכנה (רק למחוברים) או כפתור התחברות */}
                            {isLoggedIn ? (
                                <div className="pt-6 space-y-4">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full bg-black border border-gray-800 text-gray-300 px-6 py-4 rounded-2xl hover:bg-gray-900 hover:text-white transition-all font-bold flex justify-center items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                        {t.logout[lang]}
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteAccountModal(true)}
                                        className="w-full bg-black border border-red-900/30 text-red-500/80 px-6 py-4 rounded-2xl hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/50 transition-all font-bold flex justify-center items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                        {t.deleteAccount[lang]}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-gray-900/40 border border-gray-800 p-8 rounded-2xl shadow-lg mt-10 text-center">
                                    <p className="text-gray-400 text-sm font-bold mb-6">{t.mustLogin[lang]}</p>
                                    <button
                                        onClick={() => router.push("/auth")}
                                        className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black px-6 py-4 rounded-xl transition-all font-bold shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                                    >
                                        {t.loginNow[lang]}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===================== לשוניות נקודות (שלי/היסטוריה/שמורים) ===================== */}
                    {["my", "history", "saved"].includes(tab) && (
                        <>
                            {tab === "saved" && (
                                <div className="flex justify-center gap-4 mb-6 flex-wrap">
                                    {["leaf", "star", "triangle", "circle", "chai"].map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => setSavedCategory(savedCategory === cat as PointCategory ? null : cat as PointCategory)}
                                            className={`p-1 transition-all duration-300 ${savedCategory === cat ? "scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "opacity-60 hover:opacity-100"}`}
                                        >
                                            <img src={`/icons/categories/${cat}/${savedCategory === cat ? "active" : "default"}.png`} className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
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
                                        )
                                    })}
                                </div>
                            )}
                        </>
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

            {/* ===================== מודל מחיקת חשבון ===================== */}
            {showDeleteAccountModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
                    <div className="bg-gray-900 border border-red-800 p-6 rounded-2xl w-[320px] text-center space-y-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-red-400 flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            {t.deleteAccount[lang]}
                        </h3>
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