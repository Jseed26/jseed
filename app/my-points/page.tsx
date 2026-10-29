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
    contactUs: { he: "ליצירת קשר ניתן לפנות אלינו:", en: "For contact, you can reach us at:" },
    locationTitle: { he: "שירותי מיקום מפה (GPS)", en: "Map Location Services (GPS)" },
    locationDesc: { he: "שימוש במיקום כדי להציג מרחקים ולנווט", en: "Use location to show distances and navigate" },
};

export default function MyPointsPage() {
    const { data: session, status } = useSession();
    
    const [lang, setLang] = useState<"en" | "he">("he");
    
    const [gpsEnabled, setGpsEnabled] = useState(true);

    useEffect(() => {
        const savedLang = localStorage.getItem("jseed_lang") as "en" | "he";
        if (savedLang) setLang(savedLang);

        const isGpsDisabled = localStorage.getItem("jseed_gps_disabled") === "true";
        setGpsEnabled(!isGpsDisabled);
    }, []);

    const changeLanguage = (newLang: "en" | "he") => {
        setLang(newLang);
        localStorage.setItem("jseed_lang", newLang);
        window.dispatchEvent(new Event("language-changed")); 
    };

    const toggleGps = () => {
        const newVal = !gpsEnabled;
        setGpsEnabled(newVal);
        if (!newVal) {
            localStorage.setItem("jseed_gps_disabled", "true");
        } else {
            localStorage.removeItem("jseed_gps_disabled");
        }
        window.dispatchEvent(new Event("gps-setting-changed")); 
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
        return (
            <div className="min-h-screen bg-[#070709] text-yellow-500 flex items-center justify-center font-bold">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
                    {t.loading[lang]}
                </div>
            </div>
        );
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
        <div className="min-h-screen bg-[#070709] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/20 via-[#070709] to-[#070709] text-zinc-100 p-4 sm:p-8 pb-32 relative font-sans selection:bg-yellow-500/30" dir={lang === "he" ? "rtl" : "ltr"}>
            
            {/* Header & Back Button */}
            <div className="max-w-3xl mx-auto flex justify-between items-center mb-8 pt-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-yellow-300 to-yellow-600 truncate pr-2">
                    {userName}
                </h1>
                
                <button 
                    onClick={() => router.push("/")} 
                    className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-yellow-500 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:bg-zinc-800 hover:border-yellow-500/50 shadow-lg flex items-center gap-2"
                    dir="ltr"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    {t.toMap[lang]}
                </button>
            </div>

            {/* Modern Tabs Navigation */}
            <div className="max-w-3xl mx-auto mb-8">
                <div className="flex gap-2 bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-800/50 overflow-x-auto custom-scrollbar snap-x">
                    {[
                        { id: "my", label: t.mySeeds[lang] },
                        { id: "history", label: t.history[lang] },
                        { id: "saved", label: <span className="flex items-center gap-1.5">{t.saved[lang]} <img src="/icons/ui/save/active.png" className="w-3.5 h-3.5 object-contain" /></span> },
                        { id: "notifications", label: <span className="flex items-center gap-1.5 relative">{t.notifications[lang]} 🔔 {unreadCount > 0 && isLoggedIn && <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>}</span> },
                        { id: "settings", label: <span className="flex items-center gap-1.5">{t.settings[lang]} ⚙️</span> }
                    ].map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => { handleTabChange(item.id as any); setSavedCategory(null); }} 
                            className={`flex-1 min-w-max px-4 py-2.5 rounded-xl text-sm font-bold transition-all snap-center ${
                                tab === item.id 
                                ? "bg-zinc-800 text-yellow-400 shadow-md border border-zinc-700/50" 
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-3xl mx-auto">
                {!isLoggedIn && tab !== "settings" ? (
                    <div className="flex flex-col items-center justify-center mt-24 space-y-6 px-4 text-center bg-zinc-900/20 py-16 rounded-3xl border border-zinc-800/50">
                        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-2 border border-yellow-500/20">
                            <span className="text-3xl">🔒</span>
                        </div>
                        <p className="text-zinc-300 text-lg font-bold">{t.mustLogin[lang]}</p>
                        <button 
                            onClick={() => router.push("/auth")}
                            className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-black px-8 py-3 rounded-xl font-bold shadow-[0_4px_14px_0_rgba(251,191,36,0.39)] hover:shadow-[0_6px_20px_rgba(251,191,36,0.23)] hover:-translate-y-0.5 transition-all"
                        >
                            {t.loginNow[lang]}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Notifications */}
                        {tab === "notifications" && (
                            <div className="space-y-3">
                                {notifications.length === 0 ? (
                                    <div className="text-center py-16 text-zinc-500 flex flex-col items-center gap-3">
                                        <span className="text-4xl opacity-50">📭</span>
                                        <p>{t.noNotifications[lang]}</p>
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div key={notif.id} className={`p-4 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${notif.isRead ? "bg-zinc-900/30 border-zinc-800/60" : "bg-yellow-500/5 border-yellow-500/30 shadow-md"}`}>
                                            <p className={`text-sm ${notif.isRead ? "text-zinc-400" : "text-zinc-100 font-bold"}`}>
                                                {notif.message}
                                            </p>
                                            <span className="text-[11px] font-mono text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md w-fit">
                                                {new Date(notif.createdAt).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Settings */}
                        {tab === "settings" && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                
                                {/* Language */}
                                <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 p-6 rounded-3xl shadow-xl">
                                    <div className="flex items-center gap-3 text-zinc-400 mb-5">
                                        <div className="bg-zinc-800 p-2 rounded-lg text-yellow-500"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg></div>
                                        <h2 className="text-sm font-bold tracking-wide">{t.language[lang]}</h2>
                                    </div>
                                    <div className="flex gap-3 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800/50">
                                        <button 
                                            onClick={() => changeLanguage("he")} 
                                            className={`flex-1 py-2.5 rounded-xl font-bold transition-all duration-300 text-sm ${lang === "he" ? "bg-zinc-800 text-yellow-400 shadow-md" : "text-zinc-500 hover:text-zinc-300"}`}
                                        >
                                            עברית
                                        </button>
                                        <button 
                                            onClick={() => changeLanguage("en")} 
                                            className={`flex-1 py-2.5 rounded-xl font-bold transition-all duration-300 text-sm ${lang === "en" ? "bg-zinc-800 text-yellow-400 shadow-md" : "text-zinc-500 hover:text-zinc-300"}`}
                                        >
                                            English
                                        </button>
                                    </div>
                                </div>

                                {/* Location Services */}
                                <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 p-6 rounded-3xl shadow-xl">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3 text-zinc-400">
                                            <div className="bg-zinc-800 p-2 rounded-lg text-yellow-500"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                                            <div>
                                                <h2 className="text-sm font-bold tracking-wide">{t.locationTitle[lang]}</h2>
                                                <p className="text-xs text-zinc-500 mt-0.5">{t.locationDesc[lang]}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={toggleGps} 
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${gpsEnabled ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                                            dir="ltr"
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-zinc-900 transition-transform ${gpsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Terms & Contact */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => router.push("/terms")} 
                                        className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-3xl shadow-lg flex justify-between items-center group hover:border-yellow-500/50 hover:bg-zinc-800/50 transition-all duration-300"
                                    >
                                        <div className="flex items-center gap-3 text-zinc-300 group-hover:text-yellow-400 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                                            <span className="font-bold text-sm">{t.terms[lang]}</span>
                                        </div>
                                        <span className="text-zinc-600 group-hover:text-yellow-500 transition-colors">{lang === "he" ? "❮" : "❯"}</span>
                                    </button>
                                    
                                    <div className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-3xl shadow-lg flex flex-col justify-center">
                                        <p className="text-zinc-500 text-xs font-bold mb-1">{t.contactUs[lang]}</p>
                                        <a href="mailto:jseedglobal@gmail.com" className="text-yellow-400 hover:text-yellow-300 font-bold text-sm truncate">
                                            jseedglobal@gmail.com
                                        </a>
                                    </div>
                                </div>

                                {isLoggedIn ? (
                                    <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button 
                                            onClick={handleLogout} 
                                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-6 py-3.5 rounded-2xl hover:bg-zinc-800 hover:text-white transition-all font-bold flex justify-center items-center gap-2 text-sm shadow-md"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                            {t.logout[lang]}
                                        </button>
                                        <button 
                                            onClick={() => setShowDeleteAccountModal(true)} 
                                            className="bg-red-500/5 border border-red-900/40 text-red-400 px-6 py-3.5 rounded-2xl hover:bg-red-500/10 hover:border-red-500/50 transition-all font-bold flex justify-center items-center gap-2 text-sm shadow-md"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                            {t.deleteAccount[lang]}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-8">
                                        <button 
                                            onClick={() => router.push("/auth")} 
                                            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black px-6 py-3.5 rounded-2xl transition-all font-bold shadow-[0_4px_14px_0_rgba(251,191,36,0.39)]"
                                        >
                                            {t.loginNow[lang]}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Points Lists (My/History/Saved) */}
                        {["my", "history", "saved"].includes(tab) && (
                            <>
                                {tab === "saved" && (
                                    <div className="flex justify-center gap-3 mb-8 bg-zinc-900/30 p-3 rounded-2xl border border-zinc-800/50 w-fit mx-auto">
                                        {["leaf", "star", "triangle", "circle", "chai"].map((cat) => (
                                            <button 
                                                key={cat} 
                                                onClick={() => setSavedCategory(savedCategory === cat as PointCategory ? null : cat as PointCategory)} 
                                                className={`p-2 rounded-xl transition-all duration-300 ${savedCategory === cat ? "bg-zinc-800 shadow-inner border border-zinc-700" : "hover:bg-zinc-800/50 border border-transparent"}`}
                                            >
                                                <img src={`/icons/categories/${cat}/${savedCategory === cat ? "active" : "default"}.png`} className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-md" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {displayPoints.length === 0 ? (
                                    <div className="text-center py-16 text-zinc-500 flex flex-col items-center gap-3">
                                        <span className="text-4xl opacity-50">🌱</span>
                                        <p>
                                            {tab === "saved" && !savedCategory
                                                ? t.selectCategory[lang]
                                                : t.noSeeds[lang]
                                            }
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {displayPoints.map((p) => {
                                            const pointImages = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
                                            const displayName = lang === "en" && p.name_en ? p.name_en : p.name;
                                            const displayDesc = lang === "en" && p.description_en ? p.description_en : p.description;
                                            const isChai = p.category === "chai";
                                            const participantsCount = isChai ? Math.max(1, allChaiPoints.filter(cp => cp.name === p.name).length) : 0;

                                            return (
                                            <div key={p.id} className="relative bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 p-5 sm:p-6 rounded-3xl shadow-xl hover:border-yellow-500/20 transition-all group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <h2 className="font-extrabold text-xl sm:text-2xl text-zinc-100">{displayName}</h2>
                                                    <span className="bg-zinc-950 border border-zinc-800 text-zinc-400 px-2.5 py-1 rounded-lg text-xs font-mono shrink-0 shadow-inner">
                                                        #{p.id}
                                                    </span>
                                                </div>
                                                
                                                <ImageGallery images={pointImages} />
                                                
                                                {displayDesc && <p className="text-sm text-zinc-300 mt-4 leading-relaxed whitespace-pre-wrap">{displayDesc}</p>}
                                                
                                                <div className="mt-5 space-y-2.5 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 text-sm">
                                                    <div className="flex items-start gap-3">
                                                        <span className="shrink-0 text-lg">📍</span>
                                                        <span className="text-zinc-400 pt-0.5"><strong className="text-zinc-300 font-medium">{t.category[lang]}</strong> {categoryNames[p.category] || p.category}</span>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <span className="shrink-0 text-lg">🏠</span>
                                                        <span className="text-zinc-400 pt-0.5"><strong className="text-zinc-300 font-medium">{t.address[lang]}</strong> {p.address || t.none[lang]}</span>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <span className="shrink-0 text-lg">🌐</span>
                                                        <span className="text-zinc-400 pt-0.5">
                                                            <strong className="text-zinc-300 font-medium">{t.website[lang]}</strong> {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-yellow-500 hover:text-yellow-400 font-medium transition-colors underline decoration-yellow-500/30 underline-offset-4">{t.visitSite[lang]}</a> : t.none[lang]}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {tab === "my" && (
                                                    <div className="flex flex-wrap justify-between mt-5 bg-zinc-900 p-3.5 rounded-2xl border border-zinc-800 text-xs font-medium text-zinc-400 shadow-inner gap-2">
                                                        <span className="flex items-center gap-1.5"><span className="text-base">👁️</span> {p._count?.viewedBy || 0} {t.views[lang]}</span>
                                                        <span className="flex items-center gap-1.5">
                                                            <img src="/icons/ui/save/active.png" alt="Saves" className="w-4 h-4 object-contain opacity-80" />
                                                            {p._count?.savedBy || 0} {t.saves[lang]}
                                                        </span>
                                                        {p.website && <span className="flex items-center gap-1.5"><span className="text-base">🔗</span> {p.linkClicks || 0} {t.clicks[lang]}</span>}
                                                        
                                                        {isChai && (
                                                            <span className="flex items-center gap-1.5 text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-lg border border-yellow-500/20">
                                                                <span className="text-base">🤝</span> {participantsCount} {t.participants[lang]}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mt-6 gap-3">
                                                    <div className="flex gap-2 w-full sm:w-auto">
                                                        {tab === "my" && (
                                                            <>
                                                                <button onClick={() => setEditingPoint(p)} className="flex-1 sm:flex-none bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-200 px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm">{t.edit[lang]}</button>
                                                                <button onClick={() => setPointToDelete(p.id)} className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm">{t.delete[lang]}</button>
                                                            </>
                                                        )}
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => router.push(`/?point=${p.id}`)}
                                                        className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-yellow-400 text-black px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] shadow-md"
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
                    </>
                )}
            </div>

            {/* Delete Point Modal */}
            {pointToDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] px-4">
                    <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-500/20 text-3xl">🗑️</div>
                        <h3 className="text-lg font-bold text-zinc-100">{t.deleteConfirm[lang]}</h3>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setPointToDelete(null)} 
                                disabled={isDeleting}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-bold transition disabled:opacity-50"
                            >
                                {t.cancel[lang]}
                            </button>
                            <button 
                                onClick={executeDelete} 
                                disabled={isDeleting}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition disabled:opacity-50 shadow-lg shadow-red-500/20"
                            >
                                {isDeleting ? t.deleting[lang] : t.yesDelete[lang]}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Modal */}
            {showDeleteAccountModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] px-4">
                    <div className="bg-zinc-950 border border-red-900/50 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-500/20 text-red-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <h3 className="text-xl font-extrabold text-red-400">{t.deleteAccount[lang]}</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed px-2">{t.deleteAccountConfirm[lang]}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowDeleteAccountModal(false)} 
                                disabled={isDeletingAccount}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-bold transition disabled:opacity-50"
                            >
                                {t.cancel[lang]}
                            </button>
                            <button 
                                onClick={handleDeleteAccount} 
                                disabled={isDeletingAccount}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold transition disabled:opacity-50 shadow-lg shadow-red-600/20"
                            >
                                {isDeletingAccount ? t.deleting[lang] : t.yesDelete[lang]}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Point Modal */}
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
                    onPickLocation={(currentFormState) => {
                        const draftToSave = {
                            ...currentFormState,
                            images: []
                        };
                        localStorage.setItem("jseed_edit_draft", JSON.stringify({
                            pointId: editingPoint.id,
                            form: draftToSave
                        }));
                        router.push(`/?editPoint=${editingPoint.id}&action=pick_location`);
                    }}
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
            
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.2); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251,191,36,0.4); }
            `}} />
        </div>
    );
}