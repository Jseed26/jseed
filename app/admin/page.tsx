import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

// 🌍 פונקציית עזר שהופכת קוד מדינה (כמו IL) לדגל אמוג'י
function getFlagEmoji(countryCode: string | null) {
    if (!countryCode) return "🌍";
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

const CATEGORY_META: Record<string, { label: string; subLabel: string; icon: string; color: string }> = {
    leaf: { label: "קהילה", subLabel: "עלה", icon: "/icons/categories/leaf/active.png", color: "#fbbf24" },
    star: { label: "רוח", subLabel: "מגן דוד", icon: "/icons/categories/star/active.png", color: "#f59e0b" },
    triangle: { label: "מורשת", subLabel: "פירמידה", icon: "/icons/categories/triangle/active.png", color: "#d97706" },
    circle: { label: "עסקים", subLabel: "מטבע", icon: "/icons/categories/circle/active.png", color: "#b45309" },
    chai: { label: "יוזמות", subLabel: "חי", icon: "/icons/categories/chai/active.png", color: "#fde68a" },
};

export default async function AdminDashboard({
    searchParams
}: {
    searchParams: Promise<{ q?: string; sort?: string; cat?: string }>
}) {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/api/auth/signin");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id }
    });

    if (!user?.isAdmin) {
        redirect("/");
    }

    const resolvedSearchParams = await searchParams;
    const searchQuery = resolvedSearchParams?.q?.trim() || "";
    const sortMode = resolvedSearchParams?.sort || ""; // "saved" | "clicks" | "views" | "recent"
    const filterCat = resolvedSearchParams?.cat || "";

    // ==========================================
    // 📊 1. שליפת סטטיסטיקות משתמשים וזמן שהות
    // ==========================================
    const totalUsers = await prisma.user.count();
    const totalVisitors = await prisma.visitor.count();
    const totalSessionsCount = totalUsers + totalVisitors;

    const totalUserTimeResult = await prisma.user.aggregate({ _sum: { timeSpentMins: true } });
    const userTime = totalUserTimeResult._sum.timeSpentMins || 0;

    const totalVisitorTimeResult = await prisma.visitor.aggregate({ _sum: { timeSpentMins: true } });
    const visitorTime = totalVisitorTimeResult._sum.timeSpentMins || 0;

    const totalPlatformTime = userTime + visitorTime;
    const avgSessionMins = totalSessionsCount > 0 ? (totalPlatformTime / totalSessionsCount).toFixed(1) : "0.0";

    const pwaUsersCount = await prisma.user.count({ where: { platform: "PWA" } });
    const pwaVisitorsCount = await prisma.visitor.count({ where: { platform: "PWA" } });
    const totalPwa = pwaUsersCount + pwaVisitorsCount;

    const webUsersCount = await prisma.user.count({ where: { platform: "WEB" } });
    const webVisitorsCount = await prisma.visitor.count({ where: { platform: "WEB" } });
    const totalWeb = webUsersCount + webVisitorsCount;

    // 🟢 חישוב מחוברים כעת (Live) - מי שעדכן זמן ב-5 הדקות האחרונות
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const onlineUsers = await prisma.user.count({
        where: { updatedAt: { gte: fiveMinutesAgo } }
    });
    const onlineVisitors = await prisma.visitor.count({
        where: { updatedAt: { gte: fiveMinutesAgo } }
    });
    const totalOnlineNow = onlineUsers + onlineVisitors;

    // ==========================================
    // 📈 2. משימה 13 + 23: ניתוח גרעינים וקטגוריות
    // ==========================================
    const allPointsWithStats = await prisma.point.findMany({
        include: {
            user: { select: { id: true, name: true, email: true } },
            viewedBy: { select: { userId: true, viewedAt: true } },
            savedBy: { select: { userId: true, savedAt: true } },
            _count: { select: { viewedBy: true, savedBy: true } }
        },
        orderBy: { createdAt: "desc" }
    });

    const totalPointsCount = allPointsWithStats.length;
    let totalViewsAll = 0;
    let totalSavesAll = 0;
    let totalClicksAll = 0;

    const categoryKeys = ["leaf", "star", "triangle", "circle", "chai"];
    const categoryStatsMap: Record<string, {
        key: string;
        pointsCount: number;
        views: number;
        saves: number;
        clicks: number;
        totalInteractions: number;
        uniqueUsersSet: Set<string>;
    }> = {};

    categoryKeys.forEach(k => {
        categoryStatsMap[k] = {
            key: k,
            pointsCount: 0,
            views: 0,
            saves: 0,
            clicks: 0,
            totalInteractions: 0,
            uniqueUsersSet: new Set<string>(),
        };
    });

    allPointsWithStats.forEach(p => {
        const cat = categoryStatsMap[p.category] ? p.category : "leaf";
        const vCount = p._count.viewedBy || 0;
        const sCount = p._count.savedBy || 0;
        const cCount = p.linkClicks || 0;

        totalViewsAll += vCount;
        totalSavesAll += sCount;
        totalClicksAll += cCount;

        categoryStatsMap[cat].pointsCount += 1;
        categoryStatsMap[cat].views += vCount;
        categoryStatsMap[cat].saves += sCount;
        categoryStatsMap[cat].clicks += cCount;
        categoryStatsMap[cat].totalInteractions += (vCount + sCount + cCount);

        if (p.userId) categoryStatsMap[cat].uniqueUsersSet.add(p.userId);
        p.viewedBy.forEach(v => categoryStatsMap[cat].uniqueUsersSet.add(v.userId));
        p.savedBy.forEach(s => categoryStatsMap[cat].uniqueUsersSet.add(s.userId));
    });

    const grandTotalInteractions = totalViewsAll + totalSavesAll + totalClicksAll;

    const categoryStats = categoryKeys.map(k => {
        const item = categoryStatsMap[k];
        // אם אין עדיין אינטראקציות, נחשב אחוז לפי כמות הגרעינים כדי שהגרף תמיד ייראה חי
        const percentage = grandTotalInteractions > 0
            ? Math.round((item.totalInteractions / grandTotalInteractions) * 100)
            : (totalPointsCount > 0 ? Math.round((item.pointsCount / totalPointsCount) * 100) : 0);

        return {
            ...item,
            meta: CATEGORY_META[k],
            uniqueUsers: item.uniqueUsersSet.size,
            percentage,
        };
    });

    // חישוב מקטעים לגרף הטבעת (SVG Donut Chart)
    let cumulativePercent = 0;
    const donutSegments = categoryStats.map(cat => {
        const value = grandTotalInteractions > 0 ? cat.totalInteractions : cat.pointsCount;
        const totalBase = grandTotalInteractions > 0 ? grandTotalInteractions : (totalPointsCount || 1);
        const fraction = totalBase > 0 ? (value / totalBase) * 100 : 0;
        const segment = {
            ...cat,
            strokeDasharray: `${fraction} ${100 - fraction}`,
            strokeDashoffset: 100 - cumulativePercent,
        };
        cumulativePercent += fraction;
        return segment;
    });

    // ==========================================
    // 📅 3. גרף פעילות וכניסות ב-7 הימים האחרונים
    // ==========================================
    const dayNamesHe = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
    const last7Days: { label: string; dateStr: string; count: number }[] = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);

        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        // סופרים פעילות באותו יום: צפיות בגרעינים, שמירות, יצירת גרעינים, וכניסות משתמשים/אורחים
        let dayActivity = 0;
        allPointsWithStats.forEach(p => {
            if (p.createdAt >= d && p.createdAt < nextD) dayActivity++;
            p.viewedBy.forEach(v => { if (v.viewedAt >= d && v.viewedAt < nextD) dayActivity++; });
            p.savedBy.forEach(s => { if (s.savedAt >= d && s.savedAt < nextD) dayActivity++; });
        });

        last7Days.push({
            label: `יום ${dayNamesHe[d.getDay()]}`,
            dateStr: `${d.getDate()}/${d.getMonth() + 1}`,
            count: dayActivity,
        });
    }

    const maxDailyCount = Math.max(...last7Days.map(d => d.count), 1);

    // ==========================================
    // 👥 4. משיכת משתמשים לטבלה (כולל updatedAt למשימה 4!)
    // ==========================================
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            timeSpentMins: true,
            platform: true,
            country: true,
            updatedAt: true,
            _count: { select: { points: true, savedPoints: true, viewedPoints: true } }
        },
        orderBy: [
            { updatedAt: "desc" },
            { timeSpentMins: "desc" }
        ]
    });

    // ==========================================
    // 🔍 5. משימה 20: מנוע חיפוש ודירוג גרעינים למנהלים
    // ==========================================
    let filteredAdminPoints = [...allPointsWithStats];

    if (filterCat) {
        filteredAdminPoints = filteredAdminPoints.filter(p => p.category === filterCat);
    }

    if (searchQuery) {
        const qLower = searchQuery.toLowerCase();
        filteredAdminPoints = filteredAdminPoints.filter(p =>
            p.name.toLowerCase().includes(qLower) ||
            (p.name_en && p.name_en.toLowerCase().includes(qLower)) ||
            (p.description && p.description.toLowerCase().includes(qLower)) ||
            (p.address && p.address.toLowerCase().includes(qLower)) ||
            (p.user?.name && p.user.name.toLowerCase().includes(qLower)) ||
            (p.user?.email && p.user.email.toLowerCase().includes(qLower)) ||
            String(p.id) === qLower
        );
    }

    if (sortMode === "saved") {
        filteredAdminPoints.sort((a, b) => (b._count.savedBy || 0) - (a._count.savedBy || 0));
    } else if (sortMode === "clicks") {
        filteredAdminPoints.sort((a, b) => (b.linkClicks || 0) - (a.linkClicks || 0));
    } else if (sortMode === "views") {
        filteredAdminPoints.sort((a, b) => (b._count.viewedBy || 0) - (a._count.viewedBy || 0));
    } else if (sortMode === "recent") {
        filteredAdminPoints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // אם המנהלת חיפשה או בחרה פילטר דירוג - נציג עד 30 תוצאות, אחרת נציג אוטומטית את 5 המובילים!
    const isFilteringPoints = Boolean(searchQuery || sortMode || filterCat);
    const displayedAdminPoints = isFilteringPoints
        ? filteredAdminPoints.slice(0, 30)
        : [...allPointsWithStats]
            .sort((a, b) => ((b._count.savedBy * 2) + b.linkClicks + b._count.viewedBy) - ((a._count.savedBy * 2) + a.linkClicks + a._count.viewedBy))
            .slice(0, 5);

    // 🌟 פונקציית מחיקה בשרת
    async function deletePointAction(formData: FormData) {
        "use server";
        const currentSession = await auth();
        const adminCheck = await prisma.user.findUnique({ where: { id: currentSession?.user?.id } });
        if (!adminCheck?.isAdmin) return;

        const pointId = Number(formData.get("pointId"));
        if (pointId) {
            await prisma.point.delete({ where: { id: pointId } });
            revalidatePath("/admin");
        }
    }

    // טבעת ממוצע זמן שהייה (עד 15 דקות כ-100% ויזואלי)
    const avgTimeRingPercent = Math.min(100, Math.round((Number(avgSessionMins) / 15) * 100));

    return (
        <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-8 font-sans" dir="rtl">

            {/* ================= HEADER ================= */}
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-yellow-500/20">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                        <img src="/icons/ui/logo/logo2.png" alt="JSeed" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-yellow-300 via-yellow-500 to-yellow-600">
                            JSeed - דשבורד ניהול ובקרה (Admin Dashboard)
                        </h1>
                        <p className="text-gray-400 text-sm mt-0.5">מבט על: מדדי ביצועים גלובליים, התנהגות משתמשים וניתוח גרעינים</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="bg-gray-900 hover:bg-gray-800 border border-yellow-500/40 text-yellow-400 px-4 py-2 rounded-xl text-sm font-bold transition shadow-lg"
                    >
                        🌍 חזרה למפה
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto space-y-8">

                {/* ========================================== */}
                {/* 🌟 שורה 1: מדדי ליבה מרכזיים (בהשראת העיצוב ששלחת) */}
                {/* ========================================== */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

                    {/* כרטיס 1: מחוברים כעת (Live) */}
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-green-500/40 p-5 rounded-2xl relative shadow-[0_0_25px_rgba(34,197,94,0.08)] flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm font-bold">מחוברים כעת (Live)</span>
                            <span className="relative flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
                            </span>
                        </div>
                        <div className="my-3">
                            <span className="text-5xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                                {totalOnlineNow}
                            </span>
                            <span className="text-xs text-gray-400 mr-2">פעילים ב-5 דק׳ האחרונות</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 pt-3 border-t border-gray-800/80">
                            <span>👤 רשומים: <strong className="text-white">{onlineUsers}</strong></span>
                            <span>👀 אורחים: <strong className="text-white">{onlineVisitors}</strong></span>
                        </div>
                    </div>

                    {/* כרטיס 2: כמות כניסות ומשתמשים (Sessions) */}
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.05)] flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm font-bold">סה״כ משתמשים וכניסות</span>
                            <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">Sessions</span>
                        </div>
                        <div className="my-3 flex items-baseline justify-between">
                            <div>
                                <span className="text-4xl font-black text-yellow-400">{totalSessionsCount.toLocaleString()}</span>
                                <p className="text-xs text-gray-400 mt-1">רשומים: <strong className="text-white">{totalUsers}</strong> | אורחים: <strong className="text-white">{totalVisitors}</strong></p>
                            </div>
                            {/* מיני גרף קו דקורטיבי */}
                            <svg className="w-20 h-10 stroke-yellow-500 fill-none" viewBox="0 0 100 40">
                                <polyline strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="5,35 25,22 45,27 65,12 85,18 95,5" />
                            </svg>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 pt-3 border-t border-gray-800/80">
                            <span>📱 אפליקציה (PWA): <strong className="text-yellow-400">{totalPwa}</strong></span>
                            <span>💻 אתר (Web): <strong className="text-white">{totalWeb}</strong></span>
                        </div>
                    </div>

                    {/* כרטיס 3: ממוצע זמן שהות + טבעת */}
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.05)] flex items-center justify-between">
                        <div className="flex flex-col justify-between h-full">
                            <span className="text-gray-300 text-sm font-bold">ממוצע זמן שהות</span>
                            <div className="my-2">
                                <span className="text-3xl font-black text-yellow-400">{avgSessionMins}</span>
                                <span className="text-sm text-gray-300 mr-1">דקות</span>
                            </div>
                            <span className="text-xs text-gray-400">
                                סה״כ מצטבר: <strong className="text-yellow-500">
                                    {totalPlatformTime < 60 ? `${totalPlatformTime} דק׳` : `${(totalPlatformTime / 60).toFixed(1)} שעות`}
                                </strong>
                            </span>
                        </div>
                        {/* טבעת עגולה בסגנון התמונה */}
                        <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#27272a" strokeWidth="3.5" />
                                <circle
                                    cx="18" cy="18" r="15.915"
                                    fill="transparent"
                                    stroke="#fbbf24"
                                    strokeWidth="3.5"
                                    strokeDasharray={`${avgTimeRingPercent} ${100 - avgTimeRingPercent}`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute text-[11px] font-bold text-yellow-400">{avgSessionMins}m</span>
                        </div>
                    </div>

                    {/* כרטיס 4: סה"כ אינטראקציות וגרעינים (Seed Clicks) */}
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.05)] flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm font-bold">אינטראקציות בגרעינים</span>
                            <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                                {totalPointsCount} גרעינים במפה
                            </span>
                        </div>
                        <div className="my-3">
                            <span className="text-4xl font-black text-yellow-400">{grandTotalInteractions.toLocaleString()}</span>
                            <span className="text-xs text-gray-400 mr-2">סה״כ פעולות</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-300 pt-3 border-t border-gray-800/80">
                            <span>👀 צפיות: <strong>{totalViewsAll}</strong></span>
                            <span>🌟 שמירות: <strong className="text-yellow-400">{totalSavesAll}</strong></span>
                            <span>🔗 קליקים: <strong className="text-blue-400">{totalClicksAll}</strong></span>
                        </div>
                    </div>

                </div>

                {/* ========================================== */}
                {/* 🌟 שורה 2: משימה 13 + 23 - גרף עוגה קטגוריות + גרף עמודות יומי */}
                {/* ========================================== */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* פופולריות ואינטראקציה לפי קטגוריות (7 עמודות) */}
                    <div className="lg:col-span-7 bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-yellow-400">פופולריות ואינטראקציה לפי קטגוריות</h2>
                                <p className="text-xs text-gray-400">פילוח משתמשים, שמירות, צפיות וכניסות ללינקים בכל קטגוריה</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
                            {/* Donut Chart SVG */}
                            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 42 42">
                                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#1f2937" strokeWidth="6" />
                                    {donutSegments.map((seg) => (
                                        <circle
                                            key={seg.key}
                                            cx="21"
                                            cy="21"
                                            r="15.915"
                                            fill="transparent"
                                            stroke={seg.meta.color}
                                            strokeWidth="6"
                                            strokeDasharray={seg.strokeDasharray}
                                            strokeDashoffset={seg.strokeDashoffset}
                                        />
                                    ))}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                    <span className="text-2xl font-black text-yellow-400">{totalPointsCount}</span>
                                    <span className="text-[11px] text-gray-400">גרעינים פעילים</span>
                                </div>
                            </div>

                            {/* מקרא קטגוריות מהיר */}
                            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {categoryStats.map((cat) => (
                                    <div key={cat.key} className="bg-black/40 border border-gray-800/80 rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.meta.color }} />
                                            <img src={cat.meta.icon} alt={cat.meta.label} className="w-6 h-6 object-contain" />
                                            <div>
                                                <div className="text-sm font-bold text-white">{cat.meta.label}</div>
                                                <div className="text-[11px] text-gray-400">{cat.pointsCount} גרעינים</div>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <span className="text-lg font-extrabold text-yellow-400">{cat.percentage}%</span>
                                            <div className="text-[10px] text-gray-500">{cat.totalInteractions} פעולות</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* טבלת פירוט מדויקת למשימה 13 */}
                        <div className="overflow-x-auto border border-gray-800/90 rounded-xl">
                            <table className="w-full text-right text-sm border-collapse">
                                <thead>
                                    <tr className="bg-black/60 text-gray-400 border-b border-gray-800 text-xs">
                                        <th className="p-3">קטגוריה</th>
                                        <th className="p-3 text-center">גרעינים 🌱</th>
                                        <th className="p-3 text-center">משתמשים מעורבים 👥</th>
                                        <th className="p-3 text-center">צפיות 👀</th>
                                        <th className="p-3 text-center">שמירות 🌟</th>
                                        <th className="p-3 text-center">כניסות ללינק 🔗</th>
                                        <th className="p-3 text-center">נתח פעילות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoryStats.map((cat) => (
                                        <tr key={cat.key} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                                            <td className="p-3 font-bold flex items-center gap-2">
                                                <img src={cat.meta.icon} alt="" className="w-5 h-5 object-contain" />
                                                <span>{cat.meta.label}</span>
                                                <span className="text-xs text-gray-500">({cat.meta.subLabel})</span>
                                            </td>
                                            <td className="p-3 text-center font-bold text-white">{cat.pointsCount}</td>
                                            <td className="p-3 text-center text-gray-300">{cat.uniqueUsers}</td>
                                            <td className="p-3 text-center text-gray-300">{cat.views}</td>
                                            <td className="p-3 text-center font-bold text-yellow-400">{cat.saves}</td>
                                            <td className="p-3 text-center font-bold text-blue-400">{cat.clicks}</td>
                                            <td className="p-3 text-center">
                                                <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded-full text-xs font-bold">
                                                    {cat.percentage}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* גרף פעילות יומי ב-7 הימים האחרונים (5 עמודות) */}
                    <div className="lg:col-span-5 bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-yellow-400">גרף אינטראקציות ופעילות יומי</h2>
                            <p className="text-xs text-gray-400 mb-6">צפיות, שמירות והוספת גרעינים ב-7 הימים האחרונים</p>
                        </div>

                        {/* עמודות הגרף */}
                        <div className="flex items-end justify-between gap-3 h-56 pt-8 pb-2 px-2 border-b border-gray-800">
                            {last7Days.map((day, idx) => {
                                const heightPercent = Math.max(8, Math.round((day.count / maxDailyCount) * 100));
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                                        <span className="text-xs font-bold text-yellow-400 mb-1.5 opacity-90 group-hover:scale-110 transition-transform">
                                            {day.count}
                                        </span>
                                        <div
                                            className="w-full max-w-[38px] rounded-t-lg bg-gradient-to-t from-yellow-700/60 via-yellow-500 to-yellow-300 shadow-[0_0_12px_rgba(251,191,36,0.25)] transition-all duration-300 group-hover:brightness-125"
                                            style={{ height: `${heightPercent}%` }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* תוויות ימים למטה */}
                        <div className="flex justify-between gap-3 pt-3 px-2 text-center">
                            {last7Days.map((day, idx) => (
                                <div key={idx} className="flex-1">
                                    <div className="text-xs font-bold text-gray-300">{day.label}</div>
                                    <div className="text-[10px] text-gray-500">{day.dateStr}</div>
                                </div>
                            ))}
                        </div>

                        {/* סיכום מהיר מתחת לגרף */}
                        <div className="mt-6 bg-black/40 border border-gray-800/80 rounded-xl p-3.5 flex justify-between items-center text-xs text-gray-400">
                            <span>🔥 סה״כ פעולות השבוע:</span>
                            <strong className="text-yellow-400 text-sm">
                                {last7Days.reduce((acc, cur) => acc + cur.count, 0)} אינטראקציות
                            </strong>
                        </div>
                    </div>

                </div>

                {/* ========================================== */}
                {/* 🌟 שורה 3: משימה 20 - מנוע חיפוש ודירוג גרעינים מלא למנהלים */}
                {/* ========================================== */}
                <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-yellow-400">🔍 מנוע חיפוש ודירוג גרעינים (Data & Seed Explorer)</h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                בדקי איזו נקודה הכי שמרו, איפה הכי הרבה נכנסו ללינק, וצפי בכל המידע המלא (כולל JSON) על כל גרעין
                            </p>
                        </div>

                        {/* כפתורי Quick Filters למיון מהיר */}
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href="/admin?sort=saved"
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${sortMode === "saved" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700 hover:border-yellow-500/50"}`}
                            >
                                🌟 הכי שמורים
                            </Link>
                            <Link
                                href="/admin?sort=clicks"
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${sortMode === "clicks" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700 hover:border-yellow-500/50"}`}
                            >
                                🔗 הכי הרבה כניסות ללינק
                            </Link>
                            <Link
                                href="/admin?sort=views"
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${sortMode === "views" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700 hover:border-yellow-500/50"}`}
                            >
                                👀 הכי נצפים
                            </Link>
                            <Link
                                href="/admin?sort=recent"
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${sortMode === "recent" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700 hover:border-yellow-500/50"}`}
                            >
                                🆕 אחרונים שנוספו
                            </Link>
                        </div>
                    </div>

                    {/* שורת חיפוש חופשי + סינון קטגוריה */}
                    <form method="GET" className="flex flex-col sm:flex-row gap-3 mb-6">
                        <input
                            type="text"
                            name="q"
                            defaultValue={searchQuery}
                            placeholder='חפשי לפי שם גרעין, תיאור, כתובת, אימייל מעלה או ID...'
                            className="flex-1 bg-black/80 border border-gray-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500"
                        />
                        <select
                            name="cat"
                            defaultValue={filterCat}
                            className="bg-black/80 border border-gray-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500"
                        >
                            <option value="">כל הקטגוריות</option>
                            <option value="leaf">קהילה (עלה)</option>
                            <option value="star">רוח (מגן דוד)</option>
                            <option value="triangle">מורשת (פירמידה)</option>
                            <option value="circle">עסקים (מטבע)</option>
                            <option value="chai">יוזמות (חי)</option>
                        </select>
                        <input type="hidden" name="sort" value={sortMode} />
                        <button type="submit" className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-yellow-400 transition">
                            חפש / סנן
                        </button>
                        {isFilteringPoints && (
                            <Link href="/admin" className="bg-gray-800 text-gray-300 px-5 py-3 rounded-xl hover:bg-gray-700 transition flex items-center justify-center text-sm border border-gray-700">
                                איפוס
                            </Link>
                        )}
                    </form>

                    {!isFilteringPoints && (
                        <div className="text-xs text-yellow-500/90 mb-3 font-bold">
                            🏆 מציג כעת את 5 הגרעינים המובילים ביותר במפה (לחצי על הכפתורים למעלה או חפשי כדי לראות עוד):
                        </div>
                    )}

                    {displayedAdminPoints.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">לא נמצאו גרעינים התואמים לחיפוש.</p>
                    ) : (
                        <div className="space-y-4">
                            {displayedAdminPoints.map((p) => {
                                const catMeta = CATEGORY_META[p.category] || CATEGORY_META.leaf;
                                const images = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);

                                return (
                                    <div key={p.id} className="bg-black/50 border border-gray-800 hover:border-yellow-500/40 rounded-2xl p-4 sm:p-5 transition">
                                        <div className="flex flex-col lg:flex-row justify-between gap-4">

                                            {/* צד ימין: תמונה וכל פרטי הגרעין */}
                                            <div className="flex flex-col sm:flex-row gap-4 flex-1">
                                                {images.length > 0 ? (
                                                    <img
                                                        src={images[0]}
                                                        alt={p.name}
                                                        className="w-full sm:w-28 h-28 object-cover rounded-xl border border-gray-700 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-full sm:w-28 h-28 bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center text-gray-600 text-xs shrink-0">
                                                        ללא תמונה
                                                    </div>
                                                )}

                                                <div className="space-y-1.5 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md font-mono">
                                                            #{p.id}
                                                        </span>
                                                        <span className="text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                            <img src={catMeta.icon} alt="" className="w-3.5 h-3.5 object-contain" />
                                                            {catMeta.label}
                                                        </span>
                                                        <h3 className="text-lg font-bold text-white">{p.name}</h3>
                                                        {p.name_en && <span className="text-xs text-gray-500">({p.name_en})</span>}
                                                    </div>

                                                    {p.description && (
                                                        <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
                                                            {p.description}
                                                        </p>
                                                    )}

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-400 pt-1">
                                                        <div>📍 <strong className="text-gray-300">כתובת:</strong> {p.address || "סומן ישירות במפה"}</div>
                                                        <div>🌐 <strong className="text-gray-300">קואורדינטות:</strong> {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</div>
                                                        <div>
                                                            👤 <strong className="text-gray-300">הועלה ע״י:</strong>{" "}
                                                            {p.user ? `${p.user.name || "ללא שם"} (${p.user.email})` : "משתמש לא ידוע"}
                                                        </div>
                                                        <div>
                                                            📅 <strong className="text-gray-300">נוצר בתאריך:</strong>{" "}
                                                            {new Date(p.createdAt).toLocaleDateString("he-IL")}
                                                        </div>
                                                        {p.website && (
                                                            <div className="sm:col-span-2 truncate">
                                                                🔗 <strong className="text-gray-300">קישור חיצוני:</strong>{" "}
                                                                <a href={p.website} target="_blank" rel="noreferrer" className="text-yellow-400 hover:underline">
                                                                    {p.website}
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* צד שמאל: מדדי הגרעין וכפתורי פעולה */}
                                            <div className="flex flex-row lg:flex-col justify-between items-center lg:items-end gap-3 border-t lg:border-t-0 border-gray-800 pt-3 lg:pt-0 shrink-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-gray-900 border border-gray-800 px-3 py-2 rounded-xl text-center min-w-[68px]">
                                                        <div className="text-base font-black text-white">{p._count.viewedBy}</div>
                                                        <div className="text-[10px] text-gray-400">צפיות 👀</div>
                                                    </div>
                                                    <div className="bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 rounded-xl text-center min-w-[68px]">
                                                        <div className="text-base font-black text-yellow-400">{p._count.savedBy}</div>
                                                        <div className="text-[10px] text-yellow-500/80">שמירות 🌟</div>
                                                    </div>
                                                    <div className="bg-blue-500/10 border border-blue-500/30 px-3 py-2 rounded-xl text-center min-w-[68px]">
                                                        <div className="text-base font-black text-blue-400">{p.linkClicks || 0}</div>
                                                        <div className="text-[10px] text-blue-400/80">לינק 🔗</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/?point=${p.id}`}
                                                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                    >
                                                        צפה במפה 📍
                                                    </Link>
                                                    <form action={deletePointAction}>
                                                        <input type="hidden" name="pointId" value={p.id} />
                                                        <button
                                                            type="submit"
                                                            className="bg-red-950/60 border border-red-800/80 text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-900/70 transition text-xs font-bold"
                                                        >
                                                            מחק 🗑️
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>
                                        </div>

                                        {/* תצוגת המבנה הפיזי / AI JSON של הגרעין (כמו בתמונה ששלחת!) */}
                                        <details className="mt-3 pt-2 border-t border-gray-800/60 text-xs">
                                            <summary className="cursor-pointer text-gray-400 hover:text-yellow-400 font-bold select-none">
                                                🧬 הצג מבנה נתונים מלא ו-AI Metadata (JSON)
                                            </summary>
                                            <pre
                                                dir="ltr"
                                                className="mt-2 bg-[#050507] border border-gray-800 p-3 rounded-xl text-[11px] text-yellow-400/90 overflow-x-auto"
                                            >
                                                {JSON.stringify(
                                                    {
                                                        id: p.id,
                                                        name: p.name,
                                                        category: p.category,
                                                        coordinates: { lat: p.latitude, lng: p.longitude },
                                                        stats: {
                                                            views: p._count.viewedBy,
                                                            saves: p._count.savedBy,
                                                            linkClicks: p.linkClicks || 0,
                                                        },
                                                        aiMetadata: p.aiMetadata || "טרם הועשר ע״י ה-AI",
                                                    },
                                                    null,
                                                    2
                                                )}
                                            </pre>
                                        </details>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ========================================== */}
                {/* 🌟 שורה 4: משימה 4 - טבלת משתמשים עם חיווי ירוק למחוברים בפועל */}
                {/* ========================================== */}
                <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-yellow-400">👥 טבלת משתמשים רשומים וסטטוס חיבור</h2>
                            <p className="text-xs text-gray-400">ירוק מהבהב מסמן משתמש שמחובר ופועל באתר כרגע</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-800 rounded-xl">
                        <table className="w-full text-right border-collapse text-sm">
                            <thead>
                                <tr className="bg-black/60 border-b border-gray-800 text-yellow-500 text-xs">
                                    <th className="p-4">סטטוס</th>
                                    <th className="p-4">שם משתמש</th>
                                    <th className="p-4">אימייל</th>
                                    <th className="p-4 text-center">מדינה</th>
                                    <th className="p-4">פלטפורמה</th>
                                    <th className="p-4 text-center">גרעינים שיצר 🌱</th>
                                    <th className="p-4 text-center">שמירות 🌟</th>
                                    <th className="p-4">זמן שהייה</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => {
                                    const isUserOnline = u.updatedAt >= fiveMinutesAgo;

                                    return (
                                        <tr key={u.id} className="border-b border-gray-800/70 hover:bg-white/[0.02]">
                                            <td className="p-4 whitespace-nowrap">
                                                {isUserOnline ? (
                                                    <span className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-1 rounded-full text-xs font-bold">
                                                        <span className="relative flex h-2.5 w-2.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                                        </span>
                                                        מחובר כעת
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-gray-500 text-xs">
                                                        <span className="h-2 w-2 rounded-full bg-gray-600 inline-block"></span>
                                                        לא מקוון
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 font-bold text-white">{u.name || "ללא שם"}</td>
                                            <td className="p-4 text-gray-400">{u.email}</td>
                                            <td className="p-4 text-center text-2xl" title={u.country || "לא ידוע"}>
                                                {getFlagEmoji(u.country)}
                                            </td>
                                            <td className="p-4">
                                                {u.platform === "PWA" ? (
                                                    <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold">📱 אפליקציה</span>
                                                ) : (
                                                    <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs">💻 אתר אינטרנט</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center font-bold text-white">{u._count.points}</td>
                                            <td className="p-4 text-center font-bold text-yellow-400">{u._count.savedPoints}</td>
                                            <td className="p-4 text-gray-300">
                                                {u.timeSpentMins < 60
                                                    ? `${u.timeSpentMins} דקות`
                                                    : `${(u.timeSpentMins / 60).toFixed(1)} שעות`}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}