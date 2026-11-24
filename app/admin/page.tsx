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
        .split("")
        .map((char) => 127397 + char.charCodeAt(0));
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
    searchParams,
}: {
    searchParams: Promise<{
        q?: string;
        userQ?: string;
        userScope?: string;
        sort?: string;
        cat?: string;
        rangeType?: string;
        offset?: string;
        showUser?: string;
        inspectPoint?: string;
    }>;
}) {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/api/auth/signin");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
    });

    if (!user?.isAdmin) {
        redirect("/");
    }

    const resolvedSearchParams = await searchParams;
    const searchQuery = resolvedSearchParams?.q?.trim() || "";
    const userSearchQuery = resolvedSearchParams?.userQ?.trim() || "";
    const userScope = resolvedSearchParams?.userScope || "period"; // "period" | "all"
    const sortMode = resolvedSearchParams?.sort || "";
    const filterCat = resolvedSearchParams?.cat || "";
    const showUserId = resolvedSearchParams?.showUser || "";
    const inspectPointId = resolvedSearchParams?.inspectPoint ? Number(resolvedSearchParams.inspectPoint) : null;

    const rangeType = resolvedSearchParams?.rangeType || "week";
    const offset = parseInt(resolvedSearchParams?.offset || "0", 10) || 0;

    let periodDays = 7;
    let labelHe = "שבוע";
    if (rangeType === "month") {
        periodDays = 30;
        labelHe = "חודש";
    } else if (rangeType === "year") {
        periodDays = 365;
        labelHe = "שנה";
    }

    const endDate = new Date(Date.now() - offset * periodDays * 24 * 60 * 60 * 1000);
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const userDateFilter = { updatedAt: { gte: startDate, lt: endDate } };
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // פונקציית עזר לבניית קישורים תוך שמירה על כל הפילטרים הפעילים
    const buildUrl = (overrides: Record<string, string | number | null | undefined> = {}, hash = "") => {
        const params = new URLSearchParams();
        const merged: Record<string, string> = {
            rangeType,
            offset: String(offset),
            cat: filterCat,
            sort: sortMode,
            q: searchQuery,
            userQ: userSearchQuery,
            userScope,
            showUser: showUserId,
            inspectPoint: inspectPointId ? String(inspectPointId) : "",
        };

        Object.entries(overrides).forEach(([k, v]) => {
            if (v === null || v === undefined || v === "") {
                delete merged[k];
            } else {
                merged[k] = String(v);
            }
        });

        Object.entries(merged).forEach(([k, v]) => {
            if (v !== "") params.set(k, v);
        });

        const qs = params.toString();
        return `/admin${qs ? `?${qs}` : ""}${hash}`;
    };

    // ================= מודאל פרטי משתמש מלא =================
    let modalUser = null;
    if (showUserId) {
        modalUser = await prisma.user.findUnique({
            where: { id: showUserId },
            include: {
                points: {
                    include: {
                        analytics: true,
                        _count: { select: { viewedBy: true, savedBy: true } },
                    },
                    orderBy: { createdAt: "desc" },
                },
                savedPoints: {
                    include: {
                        point: { select: { id: true, name: true, category: true } },
                    },
                    orderBy: { savedAt: "desc" },
                    take: 10,
                },
                comments: {
                    include: {
                        point: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 10,
                },
                _count: {
                    select: {
                        points: true,
                        savedPoints: true,
                        viewedPoints: true,
                        comments: true,
                    },
                },
            },
        });
    }

    // ================= מדדי ליבה כלליים ובתקופה =================
    const totalAllTimeUsers = await prisma.user.count();
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

    const onlineUsers = await prisma.user.count({ where: { updatedAt: { gte: fiveMinutesAgo } } });
    const onlineVisitors = await prisma.visitor.count({ where: { updatedAt: { gte: fiveMinutesAgo } } });
    const totalOnlineNow = onlineUsers + onlineVisitors;

    // ================= שליפת כל הגרעינים והסטטיסטיקות =================
    const allPointsWithStats = await prisma.point.findMany({
        include: {
            user: { select: { id: true, name: true, email: true } },
            analytics: true,
            _count: { select: { viewedBy: true, savedBy: true } },
            viewedBy: {
                where: { viewedAt: { gte: startDate, lt: endDate } },
                select: { userId: true, viewedAt: true },
            },
            savedBy: {
                where: { savedAt: { gte: startDate, lt: endDate } },
                select: { userId: true, savedAt: true },
            },
            comments: {
                include: { user: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    // העשרת כל גרעין עם ספירת תתי-גרעינים ומדדים מצטברים
    const enrichedPoints = allPointsWithStats.map((p) => {
        const cleanName = (p.name || "").trim().toLowerCase();
        const createdSeeds = allPointsWithStats.filter(
            (other) =>
                other.id !== p.id &&
                other.category === "chai" &&
                (other.parentId === p.id ||
                    (cleanName !== "" && (other.name || "").trim().toLowerCase() === cleanName))
        ).length;

        const allTimeViews = p.analytics?.views || p._count.viewedBy || 0;
        const allTimeSaves = p._count.savedBy || 0;
        const allTimeShares = p.analytics?.shares || 0;
        const allTimeClicks = p.analytics?.clicks || p.linkClicks || 0;
        const allTimeJoins = p.analytics?.joins || 0;

        return {
            ...p,
            createdSeeds,
            allTimeViews,
            allTimeSaves,
            allTimeShares,
            allTimeClicks,
            allTimeJoins,
        };
    });

    // סיכום כללי (כל הזמנים) לכל המערכת
    const nonSupportAllTime = enrichedPoints.filter((p) => p.category !== "chai_support");
    const globalTotals = nonSupportAllTime.reduce(
        (acc, p) => {
            acc.seeds += 1;
            acc.views += p.allTimeViews;
            acc.saves += p.allTimeSaves;
            acc.shares += p.allTimeShares;
            acc.clicks += p.allTimeClicks;
            acc.joins += p.allTimeJoins;
            return acc;
        },
        { seeds: 0, views: 0, saves: 0, shares: 0, clicks: 0, joins: 0 }
    );

    // ================= מודאל פירוט גרעין ספציפי =================
    const inspectedPoint = inspectPointId
        ? enrichedPoints.find((p) => p.id === inspectPointId) || null
        : null;

    let inspectedPointLogs: { createdAt: Date; action: string; country: string | null }[] = [];
    if (inspectedPoint) {
        inspectedPointLogs = await prisma.pointActionLog.findMany({
            where: { pointId: inspectedPoint.id },
            select: { createdAt: true, action: true, country: true },
            orderBy: { createdAt: "asc" },
        });
    }

    // נתוני 30 יום ומדינות עבור הגרעין הנבדק
    const inspectedChart30: { dateStr: string; count: number }[] = [];
    const inspectedCountries: { country: string; count: number; percent: number }[] = [];
    if (inspectedPoint) {
        const baseToday = new Date();
        baseToday.setHours(0, 0, 0, 0);
        for (let i = 29; i >= 0; i--) {
            const d = new Date(baseToday);
            d.setDate(d.getDate() - i);
            const nextD = new Date(d);
            nextD.setDate(d.getDate() + 1);
            const cnt = inspectedPointLogs.filter((l) => l.createdAt >= d && l.createdAt < nextD).length;
            inspectedChart30.push({ dateStr: `${d.getDate()}/${d.getMonth() + 1}`, count: cnt });
        }

        const cMap: Record<string, number> = {};
        inspectedPointLogs.forEach((l) => {
            const c = l.country || "IL";
            cMap[c] = (cMap[c] || 0) + 1;
        });
        const totalL = inspectedPointLogs.length || 1;
        Object.entries(cMap)
            .sort((a, b) => b[1] - a[1])
            .forEach(([country, count]) => {
                inspectedCountries.push({
                    country,
                    count,
                    percent: Math.round((count / totalL) * 100),
                });
            });
    }

    // ================= סיכומי תקופה וקטגוריות =================
    const pointsInDateRange = enrichedPoints.filter((p) => p.createdAt >= startDate && p.createdAt < endDate);
    const totalPointsCount = pointsInDateRange.length;

    let totalViewsAll = 0;
    let totalSavesAll = 0;
    let totalClicksAll = 0;

    const categoryKeys = ["leaf", "star", "triangle", "circle", "chai"];
    const categoryStatsMap: Record<string, any> = {};

    categoryKeys.forEach((k) => {
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

    enrichedPoints.forEach((p) => {
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
        categoryStatsMap[cat].totalInteractions += vCount + sCount + cCount;

        if (p.userId) categoryStatsMap[cat].uniqueUsersSet.add(p.userId);
        p.viewedBy.forEach((v) => categoryStatsMap[cat].uniqueUsersSet.add(v.userId));
        p.savedBy.forEach((s) => categoryStatsMap[cat].uniqueUsersSet.add(s.userId));
    });

    const grandTotalInteractions = totalViewsAll + totalSavesAll + totalClicksAll;

    const categoryStats = categoryKeys.map((k) => {
        const item = categoryStatsMap[k];
        const percentage =
            grandTotalInteractions > 0
                ? Math.round((item.totalInteractions / grandTotalInteractions) * 100)
                : totalPointsCount > 0
                ? Math.round((item.pointsCount / totalPointsCount) * 100)
                : 0;

        return { ...item, meta: CATEGORY_META[k], uniqueUsers: item.uniqueUsersSet.size, percentage };
    });

    // יומן פעילויות בתקופה
    const logsInDateRange = await prisma.pointActionLog.findMany({
        where: { createdAt: { gte: startDate, lt: endDate } },
        select: { createdAt: true, country: true, action: true },
    });

    const dayNamesHe = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
    const chartData: { label: string; dateStr: string; count: number; fullDate: Date }[] = [];

    const currentDayForChart = new Date(startDate);
    currentDayForChart.setHours(0, 0, 0, 0);
    const endDayForChart = new Date(endDate);

    while (currentDayForChart < endDayForChart) {
        const nextD = new Date(currentDayForChart);
        nextD.setDate(currentDayForChart.getDate() + 1);

        let legacyActivity = 0;
        enrichedPoints.forEach((p) => {
            if (p.createdAt >= currentDayForChart && p.createdAt < nextD) legacyActivity++;
            p.viewedBy.forEach((v) => {
                if (v.viewedAt >= currentDayForChart && v.viewedAt < nextD) legacyActivity++;
            });
            p.savedBy.forEach((s) => {
                if (s.savedAt >= currentDayForChart && s.savedAt < nextD) legacyActivity++;
            });
        });

        const logsActivity = logsInDateRange.filter(
            (log) => log.createdAt >= currentDayForChart && log.createdAt < nextD
        ).length;

        chartData.push({
            label: `יום ${dayNamesHe[currentDayForChart.getDay()]}`,
            dateStr: `${currentDayForChart.getDate()}/${currentDayForChart.getMonth() + 1}`,
            fullDate: new Date(currentDayForChart),
            count: legacyActivity + logsActivity,
        });

        currentDayForChart.setDate(currentDayForChart.getDate() + 1);
    }

    const maxDailyCount = Math.max(...chartData.map((d) => d.count), 1);

    const usersInDateRange = await prisma.user.findMany({
        where: userDateFilter,
        select: { country: true },
    });

    const countryCounts: Record<string, number> = {};
    usersInDateRange.forEach((u) => {
        const c = u.country || "IL";
        countryCounts[c] = (countryCounts[c] || 0) + 1;
    });
    logsInDateRange.forEach((log) => {
        const c = log.country || "IL";
        countryCounts[c] = (countryCounts[c] || 0) + 1;
    });

    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
    const top5Countries = sortedCountries.slice(0, 5);
    const otherCountries = sortedCountries.slice(5);

    // ================= שליפת וסינון משתמשים =================
    const shouldFetchAllUsers = userScope === "all" || Boolean(userSearchQuery);
    const users = await prisma.user.findMany({
        where: {
            ...(shouldFetchAllUsers ? {} : userDateFilter),
            ...(userSearchQuery
                ? {
                      OR: [
                          { name: { contains: userSearchQuery, mode: "insensitive" } },
                          { email: { contains: userSearchQuery, mode: "insensitive" } },
                          { country: { contains: userSearchQuery, mode: "insensitive" } },
                      ],
                  }
                : {}),
        },
        select: {
            id: true,
            name: true,
            email: true,
            isAdmin: true,
            timeSpentMins: true,
            platform: true,
            country: true,
            updatedAt: true,
            _count: { select: { points: true, savedPoints: true, viewedPoints: true, comments: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { timeSpentMins: "desc" }],
        take: 100,
    });

    // ================= סינון ודירוג גרעינים =================
    let filteredAdminPoints = [...enrichedPoints];

    if (filterCat) {
        filteredAdminPoints = filteredAdminPoints.filter((p) => p.category === filterCat);
    }

    if (searchQuery) {
        const qLower = searchQuery.toLowerCase();
        filteredAdminPoints = filteredAdminPoints.filter(
            (p) =>
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
        filteredAdminPoints.sort((a, b) => b.allTimeSaves - a.allTimeSaves);
    } else if (sortMode === "clicks") {
        filteredAdminPoints.sort((a, b) => b.allTimeClicks - a.allTimeClicks);
    } else if (sortMode === "shares") {
        filteredAdminPoints.sort((a, b) => b.allTimeShares - a.allTimeShares);
    } else if (sortMode === "views") {
        filteredAdminPoints.sort((a, b) => b.allTimeViews - a.allTimeViews);
    } else if (sortMode === "recent") {
        filteredAdminPoints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const isFilteringPoints = Boolean(searchQuery || sortMode || filterCat);
    const displayedAdminPoints = isFilteringPoints
        ? filteredAdminPoints.slice(0, 40)
        : [...enrichedPoints]
              .filter((p) => p.category !== "chai_support")
              .sort(
                  (a, b) =>
                      b.allTimeSaves * 2 +
                      b.allTimeShares * 2 +
                      b.allTimeClicks +
                      b.allTimeViews -
                      (a.allTimeSaves * 2 + a.allTimeShares * 2 + a.allTimeClicks + a.allTimeViews)
              )
              .slice(0, 6);

    // ================= Server Actions =================
    async function deletePointAction(formData: FormData) {
        "use server";
        const currentSession = await auth();
        const adminCheck = await prisma.user.findUnique({ where: { id: currentSession?.user?.id } });
        if (!adminCheck?.isAdmin) return;

        const pointId = Number(formData.get("pointId"));
        if (pointId) {
            const target = await prisma.point.findUnique({ where: { id: pointId } });
            if (target) {
                await prisma.point.updateMany({
                    where: { parentId: pointId },
                    data: { parentId: target.parentId },
                });
                await prisma.point.delete({ where: { id: pointId } });
            }
            revalidatePath("/admin");
        }
    }

    async function deleteCommentAction(formData: FormData) {
        "use server";
        const currentSession = await auth();
        const adminCheck = await prisma.user.findUnique({ where: { id: currentSession?.user?.id } });
        if (!adminCheck?.isAdmin) return;

        const commentId = Number(formData.get("commentId"));
        if (commentId) {
            await prisma.comment.delete({ where: { id: commentId } });
            revalidatePath("/admin");
        }
    }

    const avgTimeRingPercent = Math.min(100, Math.round((Number(avgSessionMins) / 15) * 100));

    // חישובי סיכום עבור המשתמש שבמודאל
    const modalUserTotals = modalUser
        ? modalUser.points.reduce(
              (acc, mp) => {
                  acc.views += mp.analytics?.views || mp._count.viewedBy || 0;
                  acc.saves += mp._count.savedBy || 0;
                  acc.shares += mp.analytics?.shares || 0;
                  acc.clicks += mp.analytics?.clicks || mp.linkClicks || 0;
                  acc.joins += mp.analytics?.joins || 0;
                  return acc;
              },
              { views: 0, saves: 0, shares: 0, clicks: 0, joins: 0 }
          )
        : null;

    return (
        <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-8 font-sans" dir="rtl">
            {/* ================= HEADER ================= */}
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-6 border-b border-yellow-500/20">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                        <img src="/icons/ui/logo/logo2.png" alt="JSeed" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-yellow-300 via-yellow-500 to-yellow-600">
                            JSeed - דשבורד ניהול ובקרה
                        </h1>
                        <p className="text-gray-400 text-sm mt-0.5">
                            מציג נתונים מ- {startDate.toLocaleDateString("he-IL")} עד {endDate.toLocaleDateString("he-IL")}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            href={buildUrl({ offset: offset + 1 })}
                            className="bg-gray-800 text-yellow-500 px-3 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-bold"
                            title={`ל${labelHe} הקודם`}
                        >
                            ← הקודם
                        </Link>
                        {offset > 0 ? (
                            <Link
                                href={buildUrl({ offset: offset - 1 })}
                                className="bg-gray-800 text-yellow-500 px-3 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-bold"
                                title={`ל${labelHe} הבא`}
                            >
                                הבא →
                            </Link>
                        ) : (
                            <div className="px-3 py-2 rounded-lg text-sm font-bold text-gray-600 cursor-not-allowed">הבא →</div>
                        )}
                    </div>

                    <div className="flex bg-black/60 border border-gray-800 rounded-xl p-1 justify-between shadow-inner overflow-x-auto shrink-0">
                        <Link
                            href={buildUrl({ rangeType: "week", offset: 0 })}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                                rangeType === "week" ? "bg-yellow-500 text-black shadow-md" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            שבוע
                        </Link>
                        <Link
                            href={buildUrl({ rangeType: "month", offset: 0 })}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                                rangeType === "month" ? "bg-yellow-500 text-black shadow-md" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            חודש
                        </Link>
                        <Link
                            href={buildUrl({ rangeType: "year", offset: 0 })}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                                rangeType === "year" ? "bg-yellow-500 text-black shadow-md" : "text-gray-400 hover:text-white"
                            }`}
                        >
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
                {/* 🌟 רצועת מבט-על כללי (כל הזמנים) */}
                <div className="bg-gradient-to-l from-yellow-500/10 via-[#121216] to-[#121216] border border-yellow-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-extrabold text-yellow-400 tracking-wide">
                            🌐 מבט-על כללי על הפלטפורמה (כל הזמנים)
                        </span>
                        <span className="text-[11px] text-gray-400">נתונים מצטברים מכלל הגרעינים והמשתמשים</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center">
                        <div className="bg-black/50 border border-gray-800/80 p-2.5 rounded-xl">
                            <div className="text-lg font-black text-white">{totalAllTimeUsers.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">משתמשים רשומים</div>
                        </div>
                        <div className="bg-black/50 border border-gray-800/80 p-2.5 rounded-xl">
                            <div className="text-lg font-black text-yellow-400">{globalTotals.seeds.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">סה״כ גרעינים</div>
                        </div>
                        <div className="bg-black/50 border border-gray-800/80 p-2.5 rounded-xl">
                            <div className="text-lg font-black text-white">{globalTotals.views.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">👁️ צפיות</div>
                        </div>
                        <div className="bg-black/50 border border-gray-800/80 p-2.5 rounded-xl">
                            <div className="text-lg font-black text-yellow-400">{globalTotals.saves.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">⭐ שמירות</div>
                        </div>
                        <div className="bg-black/50 border border-gray-800/80 p-2.5 rounded-xl">
                            <div className="text-lg font-black text-yellow-200">{globalTotals.shares.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">📤 שיתופים</div>
                        </div>
                        <div className="bg-black/50 border border-gray-800/80 p-2.5 rounded-xl">
                            <div className="text-lg font-black text-blue-400">{globalTotals.clicks.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">🔗 כניסות לאתר</div>
                        </div>
                        <div className="bg-black/50 border border-gray-800/80 p-2.5 rounded-xl col-span-2 sm:col-span-1">
                            <div className="text-lg font-black text-green-400">{globalTotals.joins.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-400">🤝 השתתפויות</div>
                        </div>
                    </div>
                </div>

                {/* 🌟 שורה 1: מדדי ליבה מרכזיים (בתקופה הנבחרת) */}
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
                                <circle
                                    cx="18"
                                    cy="18"
                                    r="15.915"
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

                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.05)] flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm font-bold">אינטראקציות בטווח</span>
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

                {/* 🌟 שורה 2: חלונית מדינות (Top 5 + All) */}
                <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-blue-500/30 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span>🌍</span> תפוצת משתמשים ופעילויות לפי מדינות ({labelHe} נבחר)
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

                {/* 🌟 שורה 3: קטגוריות וגרף דינמי */}
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

                {/* 🌟 שורה 4: מנוע חיפוש ודירוג גרעינים מורחב */}
                <div id="seed-explorer" className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-yellow-400">🔍 חיפוש ודירוג גרעינים (נתונים מלאים לכל גרעין)</h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {isFilteringPoints
                                    ? `מציג ${displayedAdminPoints.length} תוצאות תואמות לחיפוש`
                                    : "מציג את הגרעינים המובילים · חפשי כל גרעין כדי לראות את מלוא הנתונים והתגובות שלו"}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={buildUrl({ sort: "views" }, "#seed-explorer")}
                                scroll={false}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                                    sortMode === "views" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700"
                                }`}
                            >
                                👀 הכי נצפים
                            </Link>
                            <Link
                                href={buildUrl({ sort: "saved" }, "#seed-explorer")}
                                scroll={false}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                                    sortMode === "saved" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700"
                                }`}
                            >
                                🌟 הכי שמורים
                            </Link>
                            <Link
                                href={buildUrl({ sort: "shares" }, "#seed-explorer")}
                                scroll={false}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                                    sortMode === "shares" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700"
                                }`}
                            >
                                📤 הכי משותפים
                            </Link>
                            <Link
                                href={buildUrl({ sort: "clicks" }, "#seed-explorer")}
                                scroll={false}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                                    sortMode === "clicks" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700"
                                }`}
                            >
                                🔗 כניסות לאתר
                            </Link>
                            <Link
                                href={buildUrl({ sort: "recent" }, "#seed-explorer")}
                                scroll={false}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                                    sortMode === "recent" ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/60 text-gray-300 border-gray-700"
                                }`}
                            >
                                🆕 אחרונים
                            </Link>
                        </div>
                    </div>

                    <form method="GET" action="/admin#seed-explorer" className="flex flex-col sm:flex-row gap-3 mb-6">
                        <input type="hidden" name="rangeType" value={rangeType} />
                        <input type="hidden" name="offset" value={offset.toString()} />
                        {userSearchQuery && <input type="hidden" name="userQ" value={userSearchQuery} />}
                        {userScope && <input type="hidden" name="userScope" value={userScope} />}
                        <input
                            type="text"
                            name="q"
                            defaultValue={searchQuery}
                            placeholder="חפשי גרעין לפי שם, תיאור, כתובת, שם מעלה, מייל או ID..."
                            className="flex-1 bg-black/80 border border-gray-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500"
                        />
                        <select
                            name="cat"
                            defaultValue={filterCat}
                            className="bg-black/80 border border-gray-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500"
                        >
                            <option value="">כל הקטגוריות</option>
                            <option value="leaf">קהילה</option>
                            <option value="star">רוח</option>
                            <option value="triangle">מורשת</option>
                            <option value="circle">עסקים</option>
                            <option value="chai">יוזמות</option>
                        </select>
                        <input type="hidden" name="sort" value={sortMode} />
                        <button type="submit" className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-yellow-400 transition">
                            חיפוש
                        </button>
                        {isFilteringPoints && (
                            <Link
                                href={buildUrl({ q: "", cat: "", sort: "" }, "#seed-explorer")}
                                scroll={false}
                                className="bg-gray-800 text-gray-300 px-5 py-3 rounded-xl hover:bg-gray-700 transition flex items-center justify-center text-sm border border-gray-700"
                            >
                                איפוס
                            </Link>
                        )}
                    </form>

                    {displayedAdminPoints.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">לא נמצאו גרעינים תואמים לחיפוש.</p>
                    ) : (
                        <div className="space-y-4">
                            {displayedAdminPoints.map((p) => {
                                const catMeta = CATEGORY_META[p.category] || CATEGORY_META.leaf;
                                const images = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : p.imageUrl ? [p.imageUrl] : [];

                                return (
                                    <div key={p.id} className="bg-black/50 border border-gray-800 hover:border-yellow-500/40 rounded-2xl p-4 sm:p-5 transition">
                                        <div className="flex flex-col xl:flex-row justify-between gap-4">
                                            <div className="flex flex-col sm:flex-row gap-4 flex-1">
                                                {images.length > 0 ? (
                                                    <img
                                                        src={images[0]}
                                                        alt={p.name}
                                                        className="w-full sm:w-24 h-24 object-cover rounded-xl border border-gray-700 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-full sm:w-24 h-24 bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center text-gray-600 text-xs shrink-0">
                                                        ללא תמונה
                                                    </div>
                                                )}
                                                <div className="space-y-1.5 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md font-mono">#{p.id}</span>
                                                        <span className="text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2.5 py-0.5 rounded-full font-bold">
                                                            {catMeta.label}
                                                        </span>
                                                        <h3 className="text-lg font-bold text-white">{p.name}</h3>
                                                    </div>

                                                    {p.description && (
                                                        <p className="text-xs text-gray-400 line-clamp-2 max-w-2xl">{p.description}</p>
                                                    )}

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-400 pt-1">
                                                        <div>📍 {p.address || "סומן במפה"}</div>
                                                        <div>📅 נוצר ב: {new Date(p.createdAt).toLocaleDateString("he-IL")}</div>
                                                        {p.userId ? (
                                                            <Link
                                                                href={buildUrl({ showUser: p.userId }, "#seed-explorer")}
                                                                scroll={false}
                                                                className="text-yellow-400/90 hover:text-yellow-300 underline underline-offset-4 transition flex items-center flex-wrap gap-1 font-bold"
                                                                title="לחצי לצפייה בכל פרטי המשתמש והגרעינים שלו"
                                                            >
                                                                <span>👤 {p.user?.name || "ללא שם"}</span>
                                                                {p.user?.email && <span className="text-gray-400 font-normal">({p.user.email})</span>}
                                                            </Link>
                                                        ) : (
                                                            <div>👤 ללא שם (אורח)</div>
                                                        )}
                                                        {p.website && (
                                                            <a
                                                                href={p.website}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-blue-400 hover:underline truncate"
                                                            >
                                                                🌐 {p.website}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* מדדים מלאים + כפתורי פעולה לכל גרעין */}
                                            <div className="flex flex-col justify-between items-start xl:items-end gap-3 border-t xl:border-t-0 border-gray-800 pt-3 xl:pt-0 shrink-0">
                                                <div className="flex flex-wrap gap-2">
                                                    <div className="bg-gray-900 border border-gray-800 px-2.5 py-1.5 rounded-lg text-center min-w-[54px]" title={`בתקופה: ${p.viewedBy.length}`}>
                                                        <div className="text-sm font-black text-white">{p.allTimeViews}</div>
                                                        <div className="text-[10px] text-gray-400">👀 צפיות</div>
                                                    </div>
                                                    <div className="bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1.5 rounded-lg text-center min-w-[54px]" title={`בתקופה: ${p.savedBy.length}`}>
                                                        <div className="text-sm font-black text-yellow-400">{p.allTimeSaves}</div>
                                                        <div className="text-[10px] text-yellow-500/80">⭐ שמירות</div>
                                                    </div>
                                                    <div className="bg-gray-900 border border-gray-800 px-2.5 py-1.5 rounded-lg text-center min-w-[54px]">
                                                        <div className="text-sm font-black text-yellow-200">{p.allTimeShares}</div>
                                                        <div className="text-[10px] text-gray-400">📤 שיתופים</div>
                                                    </div>
                                                    <div className="bg-gray-900 border border-gray-800 px-2.5 py-1.5 rounded-lg text-center min-w-[54px]">
                                                        <div className="text-sm font-black text-blue-400">{p.allTimeClicks}</div>
                                                        <div className="text-[10px] text-gray-400">🔗 לאתר</div>
                                                    </div>
                                                    {p.category === "chai" && (
                                                        <>
                                                            <div className="bg-green-500/10 border border-green-500/30 px-2.5 py-1.5 rounded-lg text-center min-w-[54px]">
                                                                <div className="text-sm font-black text-green-400">{p.allTimeJoins}</div>
                                                                <div className="text-[10px] text-green-400/80">🤝 השתתפו</div>
                                                            </div>
                                                            <div className="bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1.5 rounded-lg text-center min-w-[54px]">
                                                                <div className="text-sm font-black text-yellow-300">{p.createdSeeds}</div>
                                                                <div className="text-[10px] text-yellow-400/80">🌱 גרעינים</div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                   <Link
                                                        href={`/my-points/analytics?pointId=${p.id}&from=admin`}
                                                        className="bg-yellow-500/15 hover:bg-yellow-500 hover:text-black border border-yellow-500/40 text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                    >
                                                        📊 פירוט גרעין
                                                    </Link>
                                                    <Link
                                                        href={`/?point=${p.id}`}
                                                        className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                    >
                                                        🗺️ במפה
                                                    </Link>
                                                    <form action={deletePointAction}>
                                                        <input type="hidden" name="pointId" value={p.id} />
                                                        <button
                                                            type="submit"
                                                            className="bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                            title="מחק גרעין לצמיתות"
                                                        >
                                                            🗑️ מחיקה
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>
                                        </div>

                                        {p.comments && p.comments.length > 0 ? (
                                            <details className="mt-4 border-t border-gray-800/80 pt-3 group outline-none">
                                                <summary className="text-xs text-yellow-500 font-bold cursor-pointer hover:text-yellow-400 transition outline-none select-none flex items-center gap-1">
                                                    💬 צפה בתגובות ({p.comments.length}) <span className="text-[10px] opacity-70 group-open:rotate-180 transition-transform">▼</span>
                                                </summary>
                                                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                                    {p.comments.map((c) => (
                                                        <div key={c.id} className="bg-black/40 p-2.5 rounded-lg border border-gray-800 flex justify-between items-start gap-3 hover:border-gray-700 transition">
                                                            <div>
                                                                <div className="text-[11px] text-gray-500 mb-0.5">
                                                                    {c.user?.id ? (
                                                                        <Link
                                                                            href={buildUrl({ showUser: c.user.id }, "#seed-explorer")}
                                                                            scroll={false}
                                                                            className="font-bold text-gray-300 hover:text-yellow-400"
                                                                        >
                                                                            {c.user?.name || "ללא שם"}
                                                                        </Link>
                                                                    ) : (
                                                                        <strong className="text-gray-300">{c.user?.name || "ללא שם"}</strong>
                                                                    )}{" "}
                                                                    • {new Date(c.createdAt).toLocaleDateString("he-IL")}{" "}
                                                                    {new Date(c.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                                                                </div>
                                                                <div className="text-sm text-gray-200">{c.content}</div>
                                                            </div>
                                                            <form action={deleteCommentAction}>
                                                                <input type="hidden" name="commentId" value={c.id} />
                                                                <button
                                                                    type="submit"
                                                                    className="text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/50 p-1.5 rounded-md text-xs transition"
                                                                    title="מחק תגובה זו"
                                                                >
                                                                    🗑️ מחיקה
                                                                </button>
                                                            </form>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        ) : (
                                            <div className="mt-4 border-t border-gray-800/50 pt-3 text-xs text-gray-600 flex items-center gap-1">
                                                💬 אין עדיין תגובות לגרעין זה
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 🌟 שורה 5: חיפוש וניהול משתמשים */}
                <div id="users-section" className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                        <div>
                            <h2 className="text-xl font-bold text-yellow-400">
                                👥 {shouldFetchAllUsers ? `משתמשים במערכת (${users.length})` : `משתמשים פעילים בתקופה (${users.length})`}
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">לחצי על שם משתמש כדי לפתוח כרטיס מידע מלא עליו ועל הגרעינים שלו.</p>
                        </div>

                        <div className="flex bg-black/60 border border-gray-800 rounded-xl p-1 text-xs font-bold">
                            <Link
                                href={buildUrl({ userScope: "period" }, "#users-section")}
                                scroll={false}
                                className={`px-3 py-1.5 rounded-lg transition ${
                                    !shouldFetchAllUsers ? "bg-yellow-500 text-black" : "text-gray-400 hover:text-white"
                                }`}
                            >
                                פעילים בתקופה
                            </Link>
                            <Link
                                href={buildUrl({ userScope: "all" }, "#users-section")}
                                scroll={false}
                                className={`px-3 py-1.5 rounded-lg transition ${
                                    shouldFetchAllUsers ? "bg-yellow-500 text-black" : "text-gray-400 hover:text-white"
                                }`}
                            >
                                כל הרשומים ({totalAllTimeUsers})
                            </Link>
                        </div>
                    </div>

                    {/* שורת חיפוש משתמשים */}
                    <form method="GET" action="/admin#users-section" className="flex flex-col sm:flex-row gap-3 mb-5">
                        <input type="hidden" name="rangeType" value={rangeType} />
                        <input type="hidden" name="offset" value={offset.toString()} />
                        {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
                        {filterCat && <input type="hidden" name="cat" value={filterCat} />}
                        {sortMode && <input type="hidden" name="sort" value={sortMode} />}
                        <input type="hidden" name="userScope" value="all" />
                        <input
                            type="text"
                            name="userQ"
                            defaultValue={userSearchQuery}
                            placeholder="חפשי משתמש לפי שם, אימייל או קוד מדינה (למשל IL, US)..."
                            className="flex-1 bg-black/80 border border-gray-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500"
                        />
                        <button type="submit" className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-yellow-400 transition">
                            חיפוש משתמש
                        </button>
                        {userSearchQuery && (
                            <Link
                                href={buildUrl({ userQ: "", userScope: "period" }, "#users-section")}
                                scroll={false}
                                className="bg-gray-800 text-gray-300 px-5 py-3 rounded-xl hover:bg-gray-700 transition flex items-center justify-center text-sm border border-gray-700"
                            >
                                איפוס
                            </Link>
                        )}
                    </form>

                    <div className="overflow-x-auto border border-gray-800 rounded-xl">
                        <table className="w-full text-right border-collapse text-sm">
                            <thead>
                                <tr className="bg-black/60 border-b border-gray-800 text-yellow-500 text-xs">
                                    <th className="p-4">סטטוס</th>
                                    <th className="p-4">שם ומייל</th>
                                    <th className="p-4 text-center">מדינה</th>
                                    <th className="p-4">פלטפורמה</th>
                                    <th className="p-4 text-center">זמן באתר</th>
                                    <th className="p-4 text-center">גרעינים שיצר</th>
                                    <th className="p-4 text-center">שמירות</th>
                                    <th className="p-4 text-center">פרטים</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-gray-500">
                                            לא נמצאו משתמשים תואמים.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u.id} className="border-b border-gray-800/70 hover:bg-white/[0.02]">
                                            <td className="p-4 whitespace-nowrap">
                                                {u.updatedAt >= fiveMinutesAgo ? (
                                                    <span className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-1 rounded-full text-xs font-bold">
                                                        מחובר
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 text-xs">לא מקוון</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <Link
                                                    href={buildUrl({ showUser: u.id }, "#users-section")}
                                                    scroll={false}
                                                    className="hover:text-yellow-400 transition block"
                                                >
                                                    <div className="font-bold text-white flex items-center gap-2">
                                                        <span>{u.name || "ללא שם"}</span>
                                                        {u.isAdmin && (
                                                            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-1.5 py-0.5 rounded">
                                                                מנהל
                                                            </span>
                                                        )}
                                                    </div>
                                                    {u.email && <div className="text-gray-500 text-[11px]">{u.email}</div>}
                                                </Link>
                                            </td>
                                            <td className="p-4 text-center text-xl">{getFlagEmoji(u.country)}</td>
                                            <td className="p-4 text-xs">{u.platform === "PWA" ? "📱 אפליקציה" : "💻 אתר"}</td>
                                            <td className="p-4 text-center text-gray-300 font-mono text-xs">{u.timeSpentMins} דק&apos;</td>
                                            <td className="p-4 text-center font-bold text-white">{u._count.points}</td>
                                            <td className="p-4 text-center font-bold text-yellow-400">{u._count.savedPoints}</td>
                                            <td className="p-4 text-center">
                                                <Link
                                                    href={buildUrl({ showUser: u.id }, "#users-section")}
                                                    scroll={false}
                                                    className="bg-yellow-500/10 hover:bg-yellow-500 hover:text-black border border-yellow-500/40 text-yellow-400 px-3 py-1 rounded-lg text-xs font-bold transition"
                                                >
                                                    כרטיס משתמש
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ================= מודאל 1: כרטיס משתמש מלא ================= */}
            {modalUser && modalUserTotals && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#141418] border border-yellow-500/50 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto shadow-2xl relative p-6 custom-scrollbar space-y-6">
                        <Link
                            href={buildUrl({ showUser: null })}
                            scroll={false}
                            className="sticky top-0 float-left text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-full text-xs font-bold transition z-10"
                        >
                            ✕ סגור
                        </Link>

                        {/* כותרת ופרטי זיהוי */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-gray-800 pb-5">
                            <div className="w-16 h-16 rounded-2xl bg-yellow-500/15 border border-yellow-500/40 flex items-center justify-center text-3xl shrink-0">
                                {modalUser.image ? (
                                    <img src={modalUser.image} alt="" className="w-full h-full object-cover rounded-2xl" />
                                ) : (
                                    getFlagEmoji(modalUser.country)
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-2xl font-extrabold text-yellow-400">{modalUser.name || "ללא שם"}</h3>
                                    {modalUser.isAdmin && (
                                        <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-md font-black">
                                            מנהל מערכת
                                        </span>
                                    )}
                                    {modalUser.updatedAt >= fiveMinutesAgo ? (
                                        <span className="text-xs bg-green-500/15 border border-green-500/40 text-green-400 px-2.5 py-0.5 rounded-full font-bold">
                                            ● מחובר כעת
                                        </span>
                                    ) : (
                                        <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-0.5 rounded-full">
                                            פעילות אחרונה: {new Date(modalUser.updatedAt).toLocaleDateString("he-IL")}{" "}
                                            {new Date(modalUser.updatedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-300">{modalUser.email}</p>
                                <div className="flex flex-wrap gap-3 text-xs text-gray-400 pt-1">
                                    <span>🌍 מדינה: <strong className="text-gray-200">{modalUser.country || "לא ידוע"}</strong></span>
                                    <span>📱 פלטפורמה: <strong className="text-gray-200">{modalUser.platform === "PWA" ? "אפליקציה (PWA)" : "דפדפן (WEB)"}</strong></span>
                                    <span>⏱️ זמן באתר: <strong className="text-yellow-400">{modalUser.timeSpentMins} דקות</strong></span>
                                    <span>🆔 <span className="font-mono text-[11px]">{modalUser.id}</span></span>
                                </div>
                            </div>
                        </div>

                        {/* 6 קוביות סיכום של המשתמש */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-white">{modalUser._count.points}</div>
                                <div className="text-[10px] text-gray-400">גרעינים שיצר</div>
                            </div>
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-yellow-400">{modalUser._count.savedPoints}</div>
                                <div className="text-[10px] text-gray-400">גרעינים ששמר</div>
                            </div>
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-gray-200">{modalUser._count.viewedPoints}</div>
                                <div className="text-[10px] text-gray-400">גרעינים שצפה</div>
                            </div>
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-blue-400">{modalUser._count.comments}</div>
                                <div className="text-[10px] text-gray-400">תגובות שכתב</div>
                            </div>
                            <div className="bg-black/50 border border-yellow-500/20 p-3 rounded-xl">
                                <div className="text-xl font-black text-white">{modalUserTotals.views}</div>
                                <div className="text-[10px] text-gray-400">צפיות בגרעיניו</div>
                            </div>
                            <div className="bg-black/50 border border-yellow-500/20 p-3 rounded-xl">
                                <div className="text-xl font-black text-yellow-300">
                                    {modalUserTotals.saves + modalUserTotals.shares + modalUserTotals.clicks + modalUserTotals.joins}
                                </div>
                                <div className="text-[10px] text-gray-400">אינטראקציות עליו</div>
                            </div>
                        </div>

                        {/* רשימת הגרעינים שהעלה המשתמש */}
                        <div>
                            <h4 className="text-base font-bold text-yellow-400 mb-3">
                                🌱 גרעינים שהעלה ({modalUser.points.length})
                            </h4>

                            {modalUser.points.length === 0 ? (
                                <p className="text-gray-500 text-sm bg-black/30 p-4 rounded-xl border border-gray-800 text-center">
                                    משתמש זה עדיין לא העלה גרעינים.
                                </p>
                            ) : (
                                <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                    {modalUser.points.map((mp) => {
                                        const v = mp.analytics?.views || mp._count.viewedBy || 0;
                                        const s = mp._count.savedBy || 0;
                                        const sh = mp.analytics?.shares || 0;
                                        const cl = mp.analytics?.clicks || mp.linkClicks || 0;
                                        return (
                                            <div
                                                key={mp.id}
                                                className="bg-black/50 border border-gray-800 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-yellow-500/30 transition"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-mono text-gray-500">#{mp.id}</span>
                                                        <span className="font-bold text-white text-sm">{mp.name}</span>
                                                        <span className="text-[11px] bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                                                            {CATEGORY_META[mp.category]?.label || mp.category}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 mt-1">
                                                        נוצר ב: {new Date(mp.createdAt).toLocaleDateString("he-IL")} · 👀 {v} · ⭐ {s} · 📤 {sh} · 🔗 {cl}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Link
                                                        href={`/my-points/analytics?pointId=${mp.id}&from=admin`}
                                                        className="text-xs bg-yellow-500/15 hover:bg-yellow-500 hover:text-black border border-yellow-500/40 text-yellow-400 px-2.5 py-1.5 rounded-lg font-bold transition"
                                                    >
                                                        📊 נתונים
                                                    </Link>
                                                    <Link
                                                        href={`/?point=${mp.id}`}
                                                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1.5 rounded-lg font-bold transition"
                                                    >
                                                        🗺️ מפה
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* גרעינים ששמר ותגובות אחרונות */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-800">
                            <div>
                                <h4 className="text-sm font-bold text-gray-300 mb-2">⭐ שמירות אחרונות ({modalUser.savedPoints.length})</h4>
                                {modalUser.savedPoints.length === 0 ? (
                                    <p className="text-xs text-gray-500 bg-black/30 p-3 rounded-xl">אין גרעינים שמורים.</p>
                                ) : (
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                        {modalUser.savedPoints.map((sp) => (
                                            <div key={sp.id} className="bg-black/40 border border-gray-800/80 px-3 py-2 rounded-lg flex justify-between items-center text-xs">
                                                <span className="text-gray-200 truncate">{sp.point.name}</span>
                                                <Link href={`/?point=${sp.point.id}`} className="text-yellow-400 hover:underline shrink-0 mr-2">
                                                    צפה
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-300 mb-2">💬 תגובות אחרונות ({modalUser.comments.length})</h4>
                                {modalUser.comments.length === 0 ? (
                                    <p className="text-xs text-gray-500 bg-black/30 p-3 rounded-xl">לא כתב תגובות עדיין.</p>
                                ) : (
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                        {modalUser.comments.map((cm) => (
                                            <div key={cm.id} className="bg-black/40 border border-gray-800/80 px-3 py-2 rounded-lg text-xs">
                                                <div className="text-[10px] text-yellow-400/80 font-bold truncate">על: {cm.point.name}</div>
                                                <div className="text-gray-300 truncate">{cm.content}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= מודאל 2: פירוט מלא לגרעין בודד ================= */}
            {inspectedPoint && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#141418] border border-yellow-500/50 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto shadow-2xl relative p-6 custom-scrollbar space-y-6">
                        <Link
                            href={buildUrl({ inspectPoint: null })}
                            scroll={false}
                            className="sticky top-0 float-left text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-full text-xs font-bold transition z-10"
                        >
                            ✕ סגור
                        </Link>

                        <div className="border-b border-gray-800 pb-4 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">#{inspectedPoint.id}</span>
                                <span className="text-xs bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 px-2.5 py-0.5 rounded-full font-bold">
                                    {CATEGORY_META[inspectedPoint.category]?.label || inspectedPoint.category}
                                </span>
                                <h3 className="text-2xl font-extrabold text-white">{inspectedPoint.name}</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                                <span>📍 {inspectedPoint.address || "סומן במפה"}</span>
                                <span>📅 נוצר ב: {new Date(inspectedPoint.createdAt).toLocaleDateString("he-IL")}</span>
                                {inspectedPoint.userId && (
                                    <Link
                                        href={buildUrl({ inspectPoint: null, showUser: inspectedPoint.userId })}
                                        scroll={false}
                                        className="text-yellow-400 hover:underline font-bold"
                                    >
                                        👤 הועלה ע״י: {inspectedPoint.user?.name || inspectedPoint.user?.email || "משתמש"}
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* מדדים מלאים של הגרעין */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-white">{inspectedPoint.allTimeViews}</div>
                                <div className="text-[10px] text-gray-400">👀 צפיות</div>
                            </div>
                            <div className="bg-black/50 border border-yellow-500/25 p-3 rounded-xl">
                                <div className="text-xl font-black text-yellow-400">{inspectedPoint.allTimeSaves}</div>
                                <div className="text-[10px] text-gray-400">⭐ שמירות</div>
                            </div>
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-yellow-200">{inspectedPoint.allTimeShares}</div>
                                <div className="text-[10px] text-gray-400">📤 שיתופים</div>
                            </div>
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-blue-400">{inspectedPoint.allTimeClicks}</div>
                                <div className="text-[10px] text-gray-400">🔗 לאתר</div>
                            </div>
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-green-400">{inspectedPoint.allTimeJoins}</div>
                                <div className="text-[10px] text-gray-400">🤝 השתתפו</div>
                            </div>
                            <div className="bg-black/50 border border-gray-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-yellow-300">{inspectedPoint.createdSeeds}</div>
                                <div className="text-[10px] text-gray-400">🌱 תתי-גרעינים</div>
                            </div>
                        </div>

                        {/* גרף 30 יום + מדינות של הגרעין */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 bg-black/50 border border-gray-800 p-4 rounded-xl">
                                <div className="text-xs font-bold text-yellow-400 mb-3">פעילות ב-30 הימים האחרונים</div>
                                {(() => {
                                    const maxVal = Math.max(...inspectedChart30.map((d) => d.count), 1);
                                    return (
                                        <div className="flex items-end gap-1 h-32 pt-4 border-b border-gray-800">
                                            {inspectedChart30.map((d, idx) => {
                                                const hPct = Math.round((d.count / maxVal) * 100);
                                                return (
                                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
                                                        <div
                                                            className="w-full bg-yellow-400 rounded-t-sm"
                                                            style={{
                                                                height: `${hPct}%`,
                                                                minHeight: d.count > 0 ? "4px" : "2px",
                                                                opacity: d.count > 0 ? 1 : 0.2,
                                                            }}
                                                            title={`${d.dateStr}: ${d.count} פעולות`}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="bg-black/50 border border-gray-800 p-4 rounded-xl">
                                <div className="text-xs font-bold text-yellow-400 mb-3">מאיפה צפו ({inspectedPointLogs.length})</div>
                                {inspectedCountries.length === 0 ? (
                                    <p className="text-xs text-gray-500">אין עדיין לוגים לגרעין זה.</p>
                                ) : (
                                    <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                                        {inspectedCountries.map((c) => (
                                            <div key={c.country} className="flex items-center justify-between text-xs bg-gray-900/70 px-2.5 py-1.5 rounded-lg">
                                                <span>
                                                    {getFlagEmoji(c.country)} {c.country}
                                                </span>
                                                <span className="font-bold text-yellow-400">{c.percent}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* תקציב ותובנת AI אם קיימים */}
                        {(inspectedPoint.budget != null || inspectedPoint.analytics?.aiInsight) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {inspectedPoint.budget != null && (
                                    <div className="bg-black/50 border border-gray-800 p-4 rounded-xl">
                                        <div className="font-bold text-yellow-400 mb-1">💰 תקציב מוגדר</div>
                                        <div className="text-lg font-black text-white">₪{inspectedPoint.budget.toLocaleString()}</div>
                                    </div>
                                )}
                                {inspectedPoint.analytics?.aiInsight && (
                                    <div className="bg-black/50 border border-gray-800 p-4 rounded-xl">
                                        <div className="font-bold text-yellow-400 mb-1">✨ תובנת AI שמורה</div>
                                        <p className="text-gray-300 leading-relaxed">{inspectedPoint.analytics.aiInsight}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                            <Link
                                href={`/?point=${inspectedPoint.id}`}
                                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl text-xs font-extrabold transition"
                            >
                                🗺️ פתח גרעין במפה
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.3); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251,191,36,0.6); }
            `,
                }}
            />
        </div>
    );
}