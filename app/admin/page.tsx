import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
    circle: { label: "עסקים", subLabel: "מטבע", icon: "/icons/categories/circle/active.png", color: "#fde047" },
    chai: { label: "יוזמות", subLabel: "חי", icon: "/icons/categories/chai/active.png", color: "#b45309" },
};

export default async function AdminDashboard({
    searchParams
}: {
    searchParams: Promise<{ q?: string; sort?: string; cat?: string; rangeType?: string; offset?: string }>
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
    const sortMode = resolvedSearchParams?.sort || "";
    const filterCat = resolvedSearchParams?.cat || "";
    
    // 🌟 סוג הטווח והאופסט (היסטוריה אחורה)
    const rangeType = resolvedSearchParams?.rangeType || "week"; // week, month, year
    const offset = parseInt(resolvedSearchParams?.offset || "0", 10) || 0;

    // 🌟 חישוב תאריכים לפי הטווח והאופסט
    let periodDays = 7;
    let labelHe = "שבוע";
    if (rangeType === "month") { periodDays = 30; labelHe = "חודש"; }
    else if (rangeType === "year") { periodDays = 365; labelHe = "שנה"; }

    const endDate = new Date(Date.now() - (offset * periodDays * 24 * 60 * 60 * 1000));
    const startDate = new Date(endDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));

    // מסננים לפי תאריך יצירה ועדכון
    const pointDateFilter = { createdAt: { gte: startDate, lt: endDate } };
    const userDateFilter = { updatedAt: { gte: startDate, lt: endDate } };

    // 🌟 סטטיסטיקות משתמשים וזמנים
    const totalUsers = await prisma.user.count({ where: userDateFilter });
    const totalVisitors = await prisma.visitor.count({ where: userDateFilter });
    const totalSessionsCount = totalUsers + totalVisitors;

    const totalUserTimeResult = await prisma.user.aggregate({ _sum: { timeSpentMins: true } });
    const userTime = totalUserTimeResult._sum.timeSpentMins || 0;

    const totalVisitorTimeResult = await prisma.visitor.aggregate({ _sum: { timeSpentMins: true } });
    const visitorTime = totalVisitorTimeResult._sum.timeSpentMins || 0;

    const totalPlatformTime = userTime + visitorTime;
    const avgSessionMins = totalSessionsCount > 0 ? (totalPlatformTime / totalSessionsCount).toFixed(1) : "0.0";

    const pwaUsersCount = await prisma.user.count({ where: { platform: "PWA", ...userDateFilter } });
    const pwaVisitorsCount = await prisma.visitor.count({ where: { platform: "PWA", ...userDateFilter } });
    const totalPwa = pwaUsersCount + pwaVisitorsCount;

    const webUsersCount = await prisma.user.count({ where: { platform: "WEB", ...userDateFilter } });
    const webVisitorsCount = await prisma.visitor.count({ where: { platform: "WEB", ...userDateFilter } });
    const totalWeb = webUsersCount + webVisitorsCount;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsers = await prisma.user.count({ where: { updatedAt: { gte: fiveMinutesAgo } } });
    const onlineVisitors = await prisma.visitor.count({ where: { updatedAt: { gte: fiveMinutesAgo } } });
    const totalOnlineNow = onlineUsers + onlineVisitors;

    // 🌟 שליפת גרעינים (רק שמירות וצפיות מהתקופה הזו נספרות)
    const allPointsWithStats = await prisma.point.findMany({
        include: {
            user: { select: { id: true, name: true, email: true } },
            viewedBy: { 
                where: { viewedAt: { gte: startDate, lt: endDate } },
                select: { userId: true, viewedAt: true } 
            },
            savedBy: { 
                where: { savedAt: { gte: startDate, lt: endDate } },
                select: { userId: true, savedAt: true } 
            },
        },
        orderBy: { createdAt: "desc" }
    });

    const pointsInDateRange = allPointsWithStats.filter(p => p.createdAt >= startDate && p.createdAt < endDate);
    const totalPointsCount = pointsInDateRange.length;
    
    let totalViewsAll = 0;
    let totalSavesAll = 0;
    let totalClicksAll = 0;

    const categoryKeys = ["leaf", "star", "triangle", "circle", "chai"];
    const categoryStatsMap: Record<string, any> = {};

    categoryKeys.forEach(k => {
        categoryStatsMap[k] = { key: k, pointsCount: 0, views: 0, saves: 0, clicks: 0, totalInteractions: 0, uniqueUsersSet: new Set<string>() };
    });

    allPointsWithStats.forEach(p => {
        const cat = categoryStatsMap[p.category] ? p.category : "leaf";
        const vCount = p.viewedBy.length;
        const sCount = p.savedBy.length;
        const cCount = p.linkClicks || 0;

        totalViewsAll += vCount;
        totalSavesAll += sCount;
        totalClicksAll += cCount;

        if (p.createdAt >= startDate && p.createdAt < endDate) {
            categoryStatsMap[cat].pointsCount += 1;
        }
        
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
        const percentage = grandTotalInteractions > 0
            ? Math.round((item.totalInteractions / grandTotalInteractions) * 100)
            : (totalPointsCount > 0 ? Math.round((item.pointsCount / totalPointsCount) * 100) : 0);

        return { ...item, meta: CATEGORY_META[k], uniqueUsers: item.uniqueUsersSet.size, percentage };
    });

    // 🌟 בניית הגרף (מחזור על הימים בטווח)
    const dayNamesHe = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
    const chartData: { label: string; dateStr: string; count: number; fullDate: Date }[] = [];
    
    let currentDayForChart = new Date(startDate);
    currentDayForChart.setHours(0, 0, 0, 0);
    const endDayForChart = new Date(endDate);

    while (currentDayForChart < endDayForChart) {
        const nextD = new Date(currentDayForChart);
        nextD.setDate(currentDayForChart.getDate() + 1);

        let dayActivity = 0;
        allPointsWithStats.forEach(p => {
            if (p.createdAt >= currentDayForChart && p.createdAt < nextD) dayActivity++;
            p.viewedBy.forEach(v => { if (v.viewedAt >= currentDayForChart && v.viewedAt < nextD) dayActivity++; });
            p.savedBy.forEach(s => { if (s.savedAt >= currentDayForChart && s.savedAt < nextD) dayActivity++; });
        });

        chartData.push({
            label: `יום ${dayNamesHe[currentDayForChart.getDay()]}`,
            dateStr: `${currentDayForChart.getDate()}/${currentDayForChart.getMonth() + 1}`,
            fullDate: new Date(currentDayForChart),
            count: dayActivity,
        });

        currentDayForChart.setDate(currentDayForChart.getDate() + 1);
    }
    
    const maxDailyCount = Math.max(...chartData.map(d => d.count), 1);

    // 🌟 יצירת נתוני מדינות 
    const usersInDateRange = await prisma.user.findMany({
        where: userDateFilter,
        select: { country: true }
    });
    
    const countryCounts: Record<string, number> = {};
    usersInDateRange.forEach(u => {
        const c = u.country || "לא ידוע";
        countryCounts[c] = (countryCounts[c] || 0) + 1;
    });

    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
    const top5Countries = sortedCountries.slice(0, 5);
    const otherCountries = sortedCountries.slice(5);

    // 🌟 שליפת משתמשים לטבלה
    const users = await prisma.user.findMany({
        where: userDateFilter,
        select: {
            id: true, name: true, email: true, timeSpentMins: true, platform: true, country: true, updatedAt: true,
            _count: { select: { points: true, savedPoints: true, viewedPoints: true } }
        },
        orderBy: [{ updatedAt: "desc" }, { timeSpentMins: "desc" }]
    });

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
        filteredAdminPoints.sort((a, b) => b.savedBy.length - a.savedBy.length);
    } else if (sortMode === "clicks") {
        filteredAdminPoints.sort((a, b) => (b.linkClicks || 0) - (a.linkClicks || 0));
    } else if (sortMode === "views") {
        filteredAdminPoints.sort((a, b) => b.viewedBy.length - a.viewedBy.length);
    } else if (sortMode === "recent") {
        filteredAdminPoints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const isFilteringPoints = Boolean(searchQuery || sortMode || filterCat);
    const displayedAdminPoints = isFilteringPoints
        ? filteredAdminPoints.slice(0, 30)
        : [...allPointsWithStats]
            .sort((a, b) => ((b.savedBy.length * 2) + b.linkClicks + b.viewedBy.length) - ((a.savedBy.length * 2) + a.linkClicks + a.viewedBy.length))
            .slice(0, 5);

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

    // פונקציות ליצירת קישורים (URL Builders)
    const getRangeUrl = (newRange: string) => `/admin?rangeType=${newRange}&offset=0&cat=${filterCat}&sort=${sortMode}&q=${encodeURIComponent(searchQuery)}`;
    const getOffsetUrl = (newOffset: number) => `/admin?rangeType=${rangeType}&offset=${newOffset}&cat=${filterCat}&sort=${sortMode}&q=${encodeURIComponent(searchQuery)}`;

    const avgTimeRingPercent = Math.min(100, Math.round((Number(avgSessionMins) / 15) * 100));

    return (
        <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-8 font-sans" dir="rtl">
            {/* ================= HEADER ================= */}
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 pb-6 border-b border-yellow-500/20">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                        <img src="/icons/ui/logo/logo2.png" alt="JSeed" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-yellow-300 via-yellow-500 to-yellow-600">
                            JSeed - דשבורד ניהול ובקרה
                        </h1>
                        <p className="text-gray-400 text-sm mt-0.5">מציג נתונים מ- {startDate.toLocaleDateString('he-IL')} עד {endDate.toLocaleDateString('he-IL')}</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    {/* חצי ניווט היסטוריה אחורה וקדימה */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Link href={getOffsetUrl(offset + 1)} className="bg-gray-800 text-yellow-500 px-3 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-bold" title={`ל${labelHe} הקודם`}>
                            ← הקודם
                        </Link>
                        {offset > 0 ? (
                            <Link href={getOffsetUrl(offset - 1)} className="bg-gray-800 text-yellow-500 px-3 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-bold" title={`ל${labelHe} הבא`}>
                                הבא →
                            </Link>
                        ) : (
                            <div className="px-3 py-2 rounded-lg text-sm font-bold text-gray-600 cursor-not-allowed">הבא →</div>
                        )}
                    </div>

                    <div className="flex bg-black/60 border border-gray-800 rounded-xl p-1 justify-between shadow-inner overflow-x-auto shrink-0">
                        <Link href={getRangeUrl("week")} className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition ${rangeType === "week" ? "bg-yellow-500 text-black shadow-md" : "text-gray-400 hover:text-white"}`}>
                            שבוע
                        </Link>
                        <Link href={getRangeUrl("month")} className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition ${rangeType === "month" ? "bg-yellow-500 text-black shadow-md" : "text-gray-400 hover:text-white"}`}>
                            חודש
                        </Link>
                        <Link href={getRangeUrl("year")} className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition ${rangeType === "year" ? "bg-yellow-500 text-black shadow-md" : "text-gray-400 hover:text-white"}`}>
                            שנה
                        </Link>
                    </div>

                    <Link
                        href="/"
                        className="text-center bg-gray-900 hover:bg-gray-800 border border-yellow-500/40 text-yellow-400 px-4 py-2 rounded-xl text-sm font-bold transition shadow-lg shrink-0"
                    >
                        🌍 חזרה למפה
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto space-y-8">
                {/* ========================================== */}
                {/* 🌟 שורה 1: מדדי ליבה מרכזיים */}
                {/* ========================================== */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-green-500/40 p-5 rounded-2xl relative shadow-[0_0_25px_rgba(34,197,94,0.08)] flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm font-bold">מחוברים כעת (Live)</span>
                            <span className="relative flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
                            </span>
                        </div>
                        <div className="my-3">
                            <span className="text-5xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">{totalOnlineNow}</span>
                            <span className="text-xs text-gray-400 mr-2">פעילים כעת</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 pt-3 border-t border-gray-800/80">
                            <span>👤 רשומים: <strong className="text-white">{onlineUsers}</strong></span>
                            <span>👀 אורחים: <strong className="text-white">{onlineVisitors}</strong></span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.05)] flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm font-bold">מבקרים בטווח הנבחר</span>
                        </div>
                        <div className="my-3 flex items-baseline justify-between">
                            <div>
                                <span className="text-4xl font-black text-yellow-400">{totalSessionsCount.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 pt-3 border-t border-gray-800/80">
                            <span>📱 אפליקציה: <strong className="text-yellow-400">{totalPwa}</strong></span>
                            <span>💻 אתר: <strong className="text-white">{totalWeb}</strong></span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.05)] flex items-center justify-between">
                        <div className="flex flex-col justify-between h-full">
                            <span className="text-gray-300 text-sm font-bold">ממוצע שהות (כולל)</span>
                            <div className="my-2">
                                <span className="text-3xl font-black text-yellow-400">{avgSessionMins}</span>
                                <span className="text-sm text-gray-300 mr-1">דקות</span>
                            </div>
                        </div>
                        <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#27272a" strokeWidth="3.5" />
                                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#fbbf24" strokeWidth="3.5" strokeDasharray={`${avgTimeRingPercent} ${100 - avgTimeRingPercent}`} strokeLinecap="round" />
                            </svg>
                            <span className="absolute text-[11px] font-bold text-yellow-400">{avgSessionMins}m</span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.05)] flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm font-bold">אינטראקציות בגרעינים</span>
                        </div>
                        <div className="my-3">
                            <span className="text-4xl font-black text-yellow-400">{grandTotalInteractions.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-300 pt-3 border-t border-gray-800/80">
                            <span>👀 צפיות: <strong>{totalViewsAll}</strong></span>
                            <span>🌟 שמירות: <strong className="text-yellow-400">{totalSavesAll}</strong></span>
                        </div>
                    </div>
                </div>

                {/* ========================================== */}
                {/* 🌟 שורה 2: חלונית מדינות (Top 5 + All) */}
                {/* ========================================== */}
                <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-blue-500/30 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span>🌍</span> תפוצת משתמשים לפי מדינות ({labelHe} נבחר)
                    </h2>
                    
                    {top5Countries.length === 0 ? (
                        <p className="text-gray-400 text-sm">אין נתוני משתמשים בטווח זמן זה.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {top5Countries.map(([country, count]) => (
                                    <div key={country} className="bg-black/50 border border-gray-800 p-3 rounded-xl flex items-center justify-between shadow-sm">
                                        <span className="text-xl mr-2">{getFlagEmoji(country)}</span>
                                        <span className="text-sm font-bold text-gray-300 truncate">{country}</span>
                                        <span className="text-lg font-black text-blue-400 ml-2">{count}</span>
                                    </div>
                                ))}
                            </div>
                            
                            {otherCountries.length > 0 && (
                                <details className="mt-4 border-t border-gray-800/60 pt-3 text-sm group">
                                    <summary className="cursor-pointer text-gray-400 hover:text-blue-400 font-bold select-none transition">
                                        הצג את כל המדינות ({otherCountries.length} נוספות)
                                    </summary>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-4">
                                        {otherCountries.map(([country, count]) => (
                                            <div key={country} className="bg-black/30 border border-gray-800/80 p-2.5 rounded-lg flex items-center justify-between hover:border-gray-600 transition">
                                                <span className="text-base mr-2">{getFlagEmoji(country)}</span>
                                                <span className="text-xs text-gray-400 truncate flex-1 text-right">{country}</span>
                                                <span className="text-sm font-bold text-blue-400 ml-2">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </>
                    )}
                </div>

                {/* ========================================== */}
                {/* 🌟 שורה 3: קטגוריות וגרף דינמי */}
                {/* ========================================== */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between overflow-hidden">
                        <div>
                            <h2 className="text-lg font-bold text-yellow-400 mb-1">פופולריות לפי קטגוריות</h2>
                            <p className="text-xs text-gray-400 mb-6">סיכום גרעינים, צפיות ושמירות בתקופה הנבחרת</p>
                        </div>
                        <div className="overflow-x-auto border border-gray-800/90 rounded-xl">
                            <table className="w-full text-right text-sm border-collapse">
                                <thead>
                                    <tr className="bg-black/60 text-gray-400 border-b border-gray-800 text-xs">
                                        <th className="p-3">קטגוריה</th>
                                        <th className="p-3 text-center">גרעינים 🌱</th>
                                        <th className="p-3 text-center">משתמשים 👥</th>
                                        <th className="p-3 text-center">צפיות 👀</th>
                                        <th className="p-3 text-center">שמירות 🌟</th>
                                        <th className="p-3 text-center">קליקים 🔗</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoryStats.map((cat) => (
                                        <tr key={cat.key} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                                            <td className="p-3 font-bold flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.meta.color }} />
                                                <img src={cat.meta.icon} alt="" className="w-5 h-5 object-contain" />
                                                <span>{cat.meta.label}</span>
                                            </td>
                                            <td className="p-3 text-center font-bold text-white">{cat.pointsCount}</td>
                                            <td className="p-3 text-center text-gray-300">{cat.uniqueUsers}</td>
                                            <td className="p-3 text-center text-gray-300">{cat.views}</td>
                                            <td className="p-3 text-center font-bold text-yellow-400">{cat.saves}</td>
                                            <td className="p-3 text-center font-bold text-blue-400">{cat.clicks}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-5 bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-yellow-400">גרף אינטראקציות יומי</h2>
                            <p className="text-xs text-gray-400 mb-6">צפיות ושמירות לאורך התקופה ({chartData.length} ימים)</p>
                        </div>

                        {/* תוספת: overflow-x-auto לגרף כדי לאפשר גלילה במקרה של שנה שלמה */}
                        <div className="flex items-end justify-start gap-1 h-56 pt-8 pb-2 px-1 border-b border-gray-800 overflow-x-auto overflow-y-hidden snap-x custom-scrollbar">
                            {chartData.map((day, idx) => {
                                const heightPercent = Math.max(8, Math.round((day.count / maxDailyCount) * 100));
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group min-w-[14px] sm:min-w-[20px] snap-center">
                                        {(periodDays <= 31 || idx % Math.ceil(periodDays / 15) === 0 || day.count === maxDailyCount) && (
                                            <span className="text-[9px] font-bold text-yellow-400 mb-1.5 opacity-90">
                                                {day.count > 0 ? day.count : ""}
                                            </span>
                                        )}
                                        <div
                                            title={`${day.dateStr}: ${day.count} פעולות`}
                                            className="w-full max-w-[38px] rounded-t-sm bg-gradient-to-t from-yellow-700/60 via-yellow-500 to-yellow-300 shadow-[0_0_12px_rgba(251,191,36,0.25)] transition-all duration-300 hover:brightness-125 cursor-pointer"
                                            style={{ height: `${heightPercent}%` }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ========================================== */}
                {/* 🌟 שורה 4: מנוע חיפוש ודירוג גרעינים (Data Explorer) */}
                {/* ========================================== */}
                <div id="seed-explorer" className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-yellow-400">🔍 דירוג גרעינים</h2>
                            <p className="text-xs text-gray-400 mt-0.5">הנתונים המופיעים כאן חושבו רק לתקופה שבחרת.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link href={getRangeUrl(rangeType).replace(`sort=${sortMode}`, "sort=saved")} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${sortMode === "saved" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700"}`}>🌟 הכי שמורים</Link>
                            <Link href={getRangeUrl(rangeType).replace(`sort=${sortMode}`, "sort=views")} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${sortMode === "views" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700"}`}>👀 הכי נצפים</Link>
                            <Link href={getRangeUrl(rangeType).replace(`sort=${sortMode}`, "sort=recent")} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${sortMode === "recent" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700"}`}>🆕 אחרונים</Link>
                        </div>
                    </div>

                    <form method="GET" action="/admin#seed-explorer" className="flex flex-col sm:flex-row gap-3 mb-6">
                        <input type="hidden" name="rangeType" value={rangeType} />
                        <input type="hidden" name="offset" value={offset.toString()} />
                        <input type="text" name="q" defaultValue={searchQuery} placeholder='חפשי לפי שם, תיאור, כתובת, מייל או ID...' className="flex-1 bg-black/80 border border-gray-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500" />
                        <select name="cat" defaultValue={filterCat} className="bg-black/80 border border-gray-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500">
                            <option value="">כל הקטגוריות</option>
                            <option value="leaf">קהילה</option>
                            <option value="star">רוח</option>
                            <option value="triangle">מורשת</option>
                            <option value="circle">עסקים</option>
                            <option value="chai">יוזמות</option>
                        </select>
                        <input type="hidden" name="sort" value={sortMode} />
                        <button type="submit" className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-yellow-400 transition">חיפוש</button>
                        {isFilteringPoints && (
                            <Link href={`/admin?rangeType=${rangeType}&offset=${offset}#seed-explorer`} className="bg-gray-800 text-gray-300 px-5 py-3 rounded-xl hover:bg-gray-700 transition flex items-center justify-center text-sm border border-gray-700">איפוס</Link>
                        )}
                    </form>

                    {displayedAdminPoints.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">לא נמצאו גרעינים או פעילות בטווח זה.</p>
                    ) : (
                        <div className="space-y-4">
                            {displayedAdminPoints.map((p) => {
                                const catMeta = CATEGORY_META[p.category] || CATEGORY_META.leaf;
                                const images = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);

                                return (
                                    <div key={p.id} className="bg-black/50 border border-gray-800 hover:border-yellow-500/40 rounded-2xl p-4 transition">
                                        <div className="flex flex-col lg:flex-row justify-between gap-4">
                                            <div className="flex flex-col sm:flex-row gap-4 flex-1">
                                                {images.length > 0 ? (
                                                    <img src={images[0]} alt={p.name} className="w-full sm:w-24 h-24 object-cover rounded-xl border border-gray-700 shrink-0" />
                                                ) : (
                                                    <div className="w-full sm:w-24 h-24 bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center text-gray-600 text-xs shrink-0">ללא תמונה</div>
                                                )}
                                                <div className="space-y-1 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md font-mono">#{p.id}</span>
                                                        <span className="text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2.5 py-0.5 rounded-full font-bold">{catMeta.label}</span>
                                                        <h3 className="text-lg font-bold text-white">{p.name}</h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-400 pt-1">
                                                        <div>📍 {p.address || "סומן במפה"}</div>
                                                        <div>👤 {p.user?.name || "ללא שם"}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-end gap-3 border-t lg:border-t-0 border-gray-800 pt-3 lg:pt-0 shrink-0">
                                                <div className="flex gap-2">
                                                    <div className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg text-center min-w-[55px]">
                                                        <div className="text-sm font-black text-white">{p.viewedBy.length}</div>
                                                        <div className="text-[10px] text-gray-400">צפיות</div>
                                                    </div>
                                                    <div className="bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-lg text-center min-w-[55px]">
                                                        <div className="text-sm font-black text-yellow-400">{p.savedBy.length}</div>
                                                        <div className="text-[10px] text-yellow-500/80">שמירות</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ========================================== */}
                {/* 🌟 שורה 5: טבלת משתמשים */}
                {/* ========================================== */}
                <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xl font-bold text-yellow-400 mb-4">👥 משתמשים פעילים בתקופה</h2>
                    <div className="overflow-x-auto border border-gray-800 rounded-xl">
                        <table className="w-full text-right border-collapse text-sm">
                            <thead>
                                <tr className="bg-black/60 border-b border-gray-800 text-yellow-500 text-xs">
                                    <th className="p-4">סטטוס</th>
                                    <th className="p-4">שם</th>
                                    <th className="p-4 text-center">מדינה</th>
                                    <th className="p-4">פלטפורמה</th>
                                    <th className="p-4 text-center">גרעינים שיצר</th>
                                    <th className="p-4 text-center">שמירות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="border-b border-gray-800/70 hover:bg-white/[0.02]">
                                        <td className="p-4 whitespace-nowrap">
                                            {u.updatedAt >= fiveMinutesAgo ? (
                                                <span className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-1 rounded-full text-xs font-bold">מחובר</span>
                                            ) : (
                                                <span className="text-gray-500 text-xs">לא מקוון</span>
                                            )}
                                        </td>
                                        <td className="p-4 font-bold text-white">{u.name || "ללא שם"}</td>
                                        <td className="p-4 text-center text-xl">{getFlagEmoji(u.country)}</td>
                                        <td className="p-4 text-xs">{u.platform === "PWA" ? "📱 אפליקציה" : "💻 אתר"}</td>
                                        <td className="p-4 text-center font-bold text-white">{u._count.points}</td>
                                        <td className="p-4 text-center font-bold text-yellow-400">{u._count.savedPoints}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.3); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251,191,36,0.6); }
            `}} />
        </div>
    );
}