"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function getFlagEmoji(countryCode: string | null) {
    if (!countryCode) return "🌍";
    const codePoints = countryCode
        .toUpperCase()
        .split("")
        .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Log = {
    createdAt: string;
    action: string;
    country: string;
    pointId: number;
    userId?: string | null;
};

type PointStat = {
    id: number;
    name: string;
    category: string;
    address?: string | null;
    latitude: number;
    longitude: number;
    budget?: number | null;
    createdSeeds?: number;
    _count: { viewedBy: number; savedBy: number };
    analytics: {
        views: number;
        clicks: number;
        shares?: number;
        joins: number;
        aiInsight?: string | null;
        aiInsightAt?: string | null;
    } | null;
    linkClicks: number;
};

type BenchmarkPoint = {
    id: number;
    category: string;
    latitude: number;
    longitude: number;
    views: number;
    saves: number;
    interactions: number;
    isMine: boolean;
};

type GlobalStats = {
    year: number;
    totalParticipants: number;
    countriesCount: number;
    totalSeeds: number;
    totalInitiatives: number;
    leadingCategory: string;
    annualGrowthPct: number;
    categoryTrends: { category: string; total: number; isTrendingUp: boolean }[];
};

const categoryLabels: Record<string, string> = {
    leaf: "קהילה",
    star: "רוח",
    triangle: "מורשת",
    circle: "עסקים",
    chai: "יוזמות",
};

const hebrewMonths = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

export default function UserAnalyticsDashboard() {
    const { status } = useSession();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<Log[]>([]);
    const [pointStats, setPointStats] = useState<PointStat[]>([]);
    const [userPoints, setUserPoints] = useState<{ id: number; name: string }[]>([]);
    const [benchmarkPoints, setBenchmarkPoints] = useState<BenchmarkPoint[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
    const [selectedPointId, setSelectedPointId] = useState<string>("ALL");

    const [isFromAdmin, setIsFromAdmin] = useState(false);

    // מצבי AI
    const [aiInsight, setAiInsight] = useState<string>("");
    const [isLoadingInsight, setIsLoadingInsight] = useState(false);
    const [aiQuestion, setAiQuestion] = useState("");
    const [aiAnswer, setAiAnswer] = useState("");
    const [isAskingAi, setIsAskingAi] = useState(false);

    // מצבי תקציב ו-ROI
    const [budgetInput, setBudgetInput] = useState<string>("");
    const [isSavingBudget, setIsSavingBudget] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth");
            return;
        }
        if (status !== "authenticated") return;

        const params = new URLSearchParams(window.location.search);
        const pointIdParam = params.get("pointId");
        const fromAdminParam = params.get("from") === "admin";

        if (pointIdParam) setSelectedPointId(pointIdParam);
        if (fromAdminParam) setIsFromAdmin(true);

        const apiUrl = pointIdParam
            ? `/api/my-points/analytics?pointId=${encodeURIComponent(pointIdParam)}`
            : "/api/my-points/analytics";

        fetch(apiUrl)
            .then((res) => res.json())
            .then((data) => {
                if (!data.error) {
                    setLogs(data.logs || []);
                    setPointStats(data.pointStats || []);
                    setUserPoints(data.userPoints || []);
                    setBenchmarkPoints(data.benchmarkPoints || []);
                    setGlobalStats(data.globalStats || null);
                }
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, [status, router]);

    useEffect(() => {
        setAiAnswer("");
        if (selectedPointId === "ALL") {
            setBudgetInput("");
            setAiInsight("");
        } else {
            const found = pointStats.find((p) => p.id === Number(selectedPointId));
            setBudgetInput(found?.budget != null ? String(found.budget) : "");
            setAiInsight(found?.analytics?.aiInsight || "");
        }
    }, [selectedPointId, pointStats]);

    async function generateInsight(forceRefresh = false) {
        setIsLoadingInsight(true);
        try {
            const res = await fetch("/api/my-points/analytics/ai-insight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pointId: selectedPointId, forceRefresh }),
            });
            const data = await res.json();
            if (data.insight) {
                setAiInsight(data.insight);
                if (selectedPointId !== "ALL") {
                    setPointStats((prev) =>
                        prev.map((p) =>
                            p.id === Number(selectedPointId)
                                ? {
                                    ...p,
                                    analytics: {
                                        views: p.analytics?.views || 0,
                                        clicks: p.analytics?.clicks || 0,
                                        shares: p.analytics?.shares || 0,
                                        joins: p.analytics?.joins || 0,
                                        aiInsight: data.insight,
                                        aiInsightAt: new Date().toISOString(),
                                    },
                                }
                                : p
                        )
                    );
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingInsight(false);
        }
    }

    async function handleAskAi(e: React.FormEvent) {
        e.preventDefault();
        if (!aiQuestion.trim() || isAskingAi) return;
        setIsAskingAi(true);
        try {
            const res = await fetch("/api/my-points/analytics/ai-insight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pointId: selectedPointId, question: aiQuestion }),
            });
            const data = await res.json();
            if (data.answer) setAiAnswer(data.answer);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAskingAi(false);
        }
    }

    async function handleSaveBudget() {
        if (selectedPointId === "ALL" || isSavingBudget) return;
        setIsSavingBudget(true);
        try {
            const res = await fetch("/api/my-points/analytics/budget", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pointId: Number(selectedPointId), budget: budgetInput }),
            });
            const data = await res.json();
            if (res.ok) {
                setPointStats((prev) =>
                    prev.map((p) =>
                        p.id === Number(selectedPointId) ? { ...p, budget: data.budget } : p
                    )
                );
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingBudget(false);
        }
    }

    if (isLoading || status === "loading") {
        return (
            <div className="min-h-screen bg-[#070709] flex items-center justify-center font-bold text-yellow-500">
                טוען נתונים...
            </div>
        );
    }

    if (userPoints.length === 0) {
        return (
            <div className="min-h-screen bg-[#070709] text-white p-8 font-sans flex flex-col items-center justify-center" dir="rtl">
                <div className="text-6xl mb-4">🌱</div>
                <h1 className="text-2xl font-bold mb-2">אין נתונים להצגה</h1>
                <p className="text-gray-400 mb-6">עדיין לא יצרת גרעינים במערכת. צור את הגרעין הראשון שלך כדי לראות נתונים!</p>
                <Link href="/my-points?tab=my" className="bg-yellow-500 text-black px-6 py-2 rounded-xl font-bold">
                    חזרה לאזור שלי
                </Link>
            </div>
        );
    }

    const filteredLogs = selectedPointId === "ALL"
        ? logs
        : logs.filter((l) => l.pointId === Number(selectedPointId));

    const filteredStats = selectedPointId === "ALL"
        ? pointStats
        : pointStats.filter((p) => p.id === Number(selectedPointId));

    const selectedPointObj = selectedPointId !== "ALL"
        ? pointStats.find((p) => p.id === Number(selectedPointId))
        : null;

    const totals = filteredStats.reduce(
        (acc, p) => {
            acc.views += p.analytics?.views || p._count.viewedBy || 0;
            acc.saves += p._count.savedBy;
            acc.shares += p.analytics?.shares || 0;
            acc.clicks += p.analytics?.clicks || p.linkClicks || 0;
            acc.budget += p.budget || 0;
            if (p.category === "chai") {
                acc.joins += p.analytics?.joins || 0;
                acc.createdSeeds += p.createdSeeds || 0;
            }
            return acc;
        },
        { views: 0, saves: 0, shares: 0, clicks: 0, joins: 0, createdSeeds: 0, budget: 0 }
    );

    // גרף 30 יום + חישוב צמיחה ומשתמשים חוזרים (כרטיס 3)
    const chartData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        const dayLogs = filteredLogs.filter((l) => {
            const lDate = new Date(l.createdAt);
            return lDate >= d && lDate < nextD;
        });

        chartData.push({
            dateStr: `${d.getDate()}/${d.getMonth() + 1}`,
            views: dayLogs.filter((l) => l.action === "VIEW").length,
            interactions: dayLogs.filter((l) => l.action !== "VIEW").length,
            total: dayLogs.length,
        });
    }
    const maxChartValue = Math.max(...chartData.map((d) => d.total), 1);

    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgoMs = Date.now() - 60 * 24 * 60 * 60 * 1000;

    const last30Logs = filteredLogs.filter((l) => new Date(l.createdAt).getTime() >= thirtyDaysAgoMs);
    const prev30Logs = filteredLogs.filter((l) => {
        const t = new Date(l.createdAt).getTime();
        return t >= sixtyDaysAgoMs && t < thirtyDaysAgoMs;
    });

    const activeLast30 = last30Logs.length;
    const growthPct = prev30Logs.length > 0
        ? Math.round(((activeLast30 - prev30Logs.length) / prev30Logs.length) * 100)
        : activeLast30 > 0
            ? 100
            : 0;

    const userActionCounts: Record<string, number> = {};
    last30Logs.forEach((l) => {
        if (l.userId) {
            userActionCounts[l.userId] = (userActionCounts[l.userId] || 0) + 1;
        }
    });
    const uniqueLoggedUsers = Object.keys(userActionCounts).length;
    const returningLoggedUsers = Object.values(userActionCounts).filter((c) => c > 1).length;
    const returningPct = uniqueLoggedUsers > 0
        ? Math.round((returningLoggedUsers / uniqueLoggedUsers) * 100)
        : 0;

    // צפיות לפי שעה ביום (0-23)
    const hourlyViews = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    filteredLogs.forEach((l) => {
        const h = new Date(l.createdAt).getHours();
        if (hourlyViews[h]) hourlyViews[h].count += 1;
    });
    const maxHourly = Math.max(...hourlyViews.map((h) => h.count), 1);

    // פילוח מדינות באחוזים
    const countryCounts: Record<string, number> = {};
    filteredLogs.forEach((l) => {
        const c = l.country || "IL";
        countryCounts[c] = (countryCounts[c] || 0) + 1;
    });
    const totalCountryLogs = filteredLogs.length || 1;
    const sortedCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([country, count]) => ({
            country,
            count,
            percent: Math.round((count / totalCountryLogs) * 100),
        }));

    // עומק מעורבות (כרטיס 10) + 12 חודשים עונתיים
    const safeViews = Math.max(totals.views, 1);
    const saveRate = Math.min(100, Math.round((totals.saves / safeViews) * 100));
    const shareRate = Math.min(100, Math.round((totals.shares / safeViews) * 100));
    const clickRate = Math.min(100, Math.round((totals.clicks / safeViews) * 100));
    const joinRate = Math.min(100, Math.round((totals.joins / safeViews) * 100));
    const createdRate = Math.min(100, Math.round((totals.createdSeeds / safeViews) * 100));
    const engagementScore = totals.views === 0
        ? 0
        : Math.min(
            100,
            Math.round(
                saveRate * 0.3 +
                shareRate * 0.2 +
                clickRate * 0.15 +
                joinRate * 0.2 +
                createdRate * 0.15 +
                (totals.views > 10 ? 20 : 5)
            )
        );

    const monthlySeasonal = Array.from({ length: 12 }, (_, mIdx) => ({
        monthIndex: mIdx,
        label: hebrewMonths[mIdx],
        count: 0,
    }));
    filteredLogs.forEach((l) => {
        const m = new Date(l.createdAt).getMonth();
        if (monthlySeasonal[m]) monthlySeasonal[m].count += 1;
    });
    const maxSeasonal = Math.max(...monthlySeasonal.map((m) => m.count), 1);

    // נתוני התפשטות יוזמות (כרטיס 2)
    const initiativeStats = filteredStats.filter((p) => p.category === "chai");
    const initViews = initiativeStats.reduce((s, p) => s + (p.analytics?.views || p._count.viewedBy || 0), 0);
    const initJoins = initiativeStats.reduce((s, p) => s + (p.analytics?.joins || 0), 0);
    const initCreated = initiativeStats.reduce((s, p) => s + (p.createdSeeds || 0), 0);
    const initConversionPct = initViews > 0 ? Math.min(100, Math.round(((initJoins + initCreated) / initViews) * 100)) : 0;

    // חישובי ROI
    const totalInteractions = totals.saves + totals.shares + totals.clicks + totals.joins + totals.createdSeeds;
    const costPerParticipant = totals.budget > 0 && totalInteractions > 0
        ? (totals.budget / totalInteractions).toFixed(1)
        : "0";
    const costPerView = totals.budget > 0 && totals.views > 0
        ? (totals.budget / totals.views).toFixed(1)
        : "0";

    // חישובי כרטיס 4 (רדיוס 5/10/25 ק"מ) וכרטיס 9 (מפת פערים)
    const anchorPoint = selectedPointObj || pointStats[0];
    const anchorLat = Number(anchorPoint?.latitude || 31.7683);
    const anchorLng = Number(anchorPoint?.longitude || 35.2137);
    const anchorLabel = selectedPointObj
        ? selectedPointObj.address || selectedPointObj.name
        : anchorPoint?.address || anchorPoint?.name || "האזור המרכזי שלך";

    const pointsWithDistance = benchmarkPoints.map((bp) => ({
        ...bp,
        distKm: getDistanceKm(anchorLat, anchorLng, Number(bp.latitude), Number(bp.longitude)),
    }));

    const r5 = pointsWithDistance.filter((p) => p.distKm <= 5);
    const r10 = pointsWithDistance.filter((p) => p.distKm <= 10);
    const r25 = pointsWithDistance.filter((p) => p.distKm <= 25);

    const r5Views = r5.reduce((s, p) => s + p.views, 0);
    const r10Views = r10.reduce((s, p) => s + p.views, 0);
    const r25Views = r25.reduce((s, p) => s + p.views, 0);

    const quadrants = [
        { name: "צפון-מזרח", check: (p: BenchmarkPoint) => p.latitude >= anchorLat && p.longitude >= anchorLng },
        { name: "צפון-מערב", check: (p: BenchmarkPoint) => p.latitude >= anchorLat && p.longitude < anchorLng },
        { name: "דרום-מזרח", check: (p: BenchmarkPoint) => p.latitude < anchorLat && p.longitude >= anchorLng },
        { name: "דרום-מערב", check: (p: BenchmarkPoint) => p.latitude < anchorLat && p.longitude < anchorLng },
    ];
    const emptyQuadrants = quadrants.filter(
        (q) => !r25.some((p) => p.distKm > 0.2 && q.check(p))
    );

    const nearbyCommunitiesToConnect = r25.filter(
        (p) => !p.isMine && (p.category === "leaf" || p.category === "chai")
    );
    const nearbyLegacySpirit = r25.filter(
        (p) => !p.isMine && (p.category === "triangle" || p.category === "star")
    );

    // חישובי כרטיס 7 (השוואה אנונימית)
    const targetCategory = selectedPointObj?.category || null;
    const sameCategoryPeers = benchmarkPoints.filter(
        (p) => !p.isMine && (!targetCategory || p.category === targetCategory)
    );
    const comparisonPool = sameCategoryPeers.length > 0 ? sameCategoryPeers : benchmarkPoints;

    const mySeedCount = Math.max(filteredStats.length, 1);
    const myAvgInteractions = totalInteractions / mySeedCount;
    const myAvgViews = totals.views / mySeedCount;
    const myConversionRate = totals.views > 0 ? (totalInteractions / totals.views) * 100 : 0;
    const mySaveConversionRate = totals.views > 0 ? (totals.saves / totals.views) * 100 : 0;

    const peerAvgInteractions =
        comparisonPool.reduce((s, p) => s + p.interactions, 0) / Math.max(comparisonPool.length, 1);
    const peerAvgViews =
        comparisonPool.reduce((s, p) => s + p.views, 0) / Math.max(comparisonPool.length, 1);
    const peerAvgConversion =
        comparisonPool.reduce((s, p) => s + (p.views > 0 ? (p.interactions / p.views) * 100 : 0), 0) /
        Math.max(comparisonPool.length, 1);
    const peerAvgSaveRate =
        comparisonPool.reduce((s, p) => s + (p.views > 0 ? (p.saves / p.views) * 100 : 0), 0) /
        Math.max(comparisonPool.length, 1);

    const multiplierNum = peerAvgInteractions > 0 ? myAvgInteractions / peerAvgInteractions : myAvgInteractions > 0 ? 1.5 : 1;
    const multiplierLabel = `${Math.max(0.1, multiplierNum).toFixed(1)}x`;

    const lowerPeersCount = comparisonPool.filter((p) => p.interactions <= myAvgInteractions).length;
    const percentileRank = comparisonPool.length > 0
        ? Math.min(99, Math.max(10, Math.round((lowerPeersCount / comparisonPool.length) * 100)))
        : 50;

    const benchmarkBars = [
        {
            label: "המרה להשתתפות",
            myVal: myConversionRate,
            peerVal: peerAvgConversion,
            maxScale: Math.max(myConversionRate, peerAvgConversion, 25),
        },
        {
            label: "שיעור שמירות",
            myVal: mySaveConversionRate,
            peerVal: peerAvgSaveRate,
            maxScale: Math.max(mySaveConversionRate, peerAvgSaveRate, 25),
        },
        {
            label: "חשיפה ממוצעת",
            myVal: myAvgViews,
            peerVal: peerAvgViews,
            maxScale: Math.max(myAvgViews, peerAvgViews, 10),
        },
    ];

    const handleShareTransparentReport = () => {
        const title = selectedPointObj ? selectedPointObj.name : "כל הגרעינים שלי ב-JSeed";
        const reportText = `📊 דוח שקיפות והשפעה — ${title}\n👁️ צפיות: ${totals.views}\n⭐ שמירות: ${totals.saves}\n📤 שיתופים: ${totals.shares}\n🔗 כניסות לאתר: ${totals.clicks}\n🤝 השתתפויות: ${totals.joins}\n🌱 יצרו גרעין: ${totals.createdSeeds}${totals.budget > 0 ? `\n💰 תקציב: ₪${totals.budget.toLocaleString()} (₪${costPerParticipant} לכל פעולה)` : ""}`;
        if (navigator.share) {
            navigator.share({ title: `דוח JSeed - ${title}`, text: reportText }).catch(() => { });
        } else {
            navigator.clipboard.writeText(reportText);
            alert("דוח השקיפות הועתק ללוח!");
        }
    };

    return (
        <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-8 pb-32 font-sans" dir="rtl">
            <div className="max-w-5xl mx-auto">

                {/* כותרת עליונה */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-zinc-800 pb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-yellow-400 flex items-center gap-3">
                            <span className="bg-yellow-500/10 p-2 rounded-xl border border-yellow-500/30">📊</span>
                            JSeed Dashboard
                        </h1>
                        <p className="text-zinc-400 text-sm mt-1">
                            {selectedPointObj ? `נתונים עבור: ${selectedPointObj.name}` : "כל הנתונים במצטבר, בלי חשיפת פרטי משתתפים."}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto print:hidden">
                        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto print:hidden">
                            {!isFromAdmin ? (
                                <select
                                    className="bg-zinc-950 border border-zinc-700 text-white p-2.5 rounded-xl text-sm focus:outline-none focus:border-yellow-500 flex-1 sm:flex-none font-bold"
                                    value={selectedPointId}
                                    onChange={(e) => setSelectedPointId(e.target.value)}
                                >
                                    <option value="ALL">כל הגרעינים שלי ({userPoints.length})</option>
                                    {userPoints.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-3 py-2 rounded-xl text-xs font-bold">
                                    תצוגת מנהל · גרעין #{selectedPointId}
                                </span>
                            )}
                            <button
                                onClick={() => window.print()}
                                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap"
                            >
                                📄 הפק דוח (PDF)
                            </button>
                            <Link
                                href={isFromAdmin ? "/admin#seed-explorer" : "/my-points?tab=my"}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap border border-zinc-700"
                            >
                                {isFromAdmin ? "חזרה לאדמין" : "חזרה"}
                            </Link>
                        </div>

                    </div>
                </div>

                {/* קוביות סיכום */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
                        <div className="text-zinc-400 text-xs font-bold mb-1">👁️ צפיות</div>
                        <div className="text-2xl font-black text-white">{totals.views.toLocaleString()}</div>
                    </div>
                    <div className="bg-zinc-900/60 border border-yellow-500/20 p-4 rounded-2xl">
                        <div className="text-zinc-400 text-xs font-bold mb-1">⭐ שמירות</div>
                        <div className="text-2xl font-black text-yellow-400">{totals.saves.toLocaleString()}</div>
                    </div>
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
                        <div className="text-zinc-400 text-xs font-bold mb-1">📤 שיתופים</div>
                        <div className="text-2xl font-black text-yellow-200">{totals.shares.toLocaleString()}</div>
                    </div>
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
                        <div className="text-zinc-400 text-xs font-bold mb-1">🔗 כניסות לאתר</div>
                        <div className="text-2xl font-black text-yellow-300">{totals.clicks.toLocaleString()}</div>
                    </div>
                    <div className="bg-zinc-900/60 border border-yellow-500/20 p-4 rounded-2xl">
                        <div className="text-zinc-400 text-xs font-bold mb-1">🤝 השתתפויות</div>
                        <div className="text-2xl font-black text-yellow-500">{totals.joins.toLocaleString()}</div>
                    </div>
                    <div className="bg-zinc-900/60 border border-yellow-500/20 p-4 rounded-2xl">
                        <div className="text-zinc-400 text-xs font-bold mb-1">🌱 יצרו גרעין</div>
                        <div className="text-2xl font-black text-yellow-400">{totals.createdSeeds.toLocaleString()}</div>
                    </div>
                </div>

                {/* כרטיס 2: התפשטות יוזמות (מוצג כשיש יוזמות בבחירה) */}
                {initiativeStats.length > 0 && (
                    <div className="bg-zinc-900/60 border border-yellow-500/20 rounded-2xl p-6 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                                <h2 className="text-base font-bold text-yellow-400">יוזמה · התפשטות בעולם</h2>
                                <p className="text-xs text-zinc-400">
                                    {selectedPointObj ? selectedPointObj.name : `${initiativeStats.length} יוזמות פעילות שלך`}
                                </p>
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-xl text-xs font-bold text-yellow-400 w-fit">
                                המרה לצפייה: {initConversionPct}%
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                                <div className="text-xl font-black text-white">{initViews.toLocaleString()}</div>
                                <div className="text-[11px] text-zinc-400 mt-0.5">צפו</div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                                <div className="text-xl font-black text-yellow-400">{initJoins.toLocaleString()}</div>
                                <div className="text-[11px] text-zinc-400 mt-0.5">השתתפו</div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                                <div className="text-xl font-black text-yellow-300">{initCreated.toLocaleString()}</div>
                                <div className="text-[11px] text-zinc-400 mt-0.5">יצרו גרעין</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* צפיות לפי שעה + עומק מעורבות (כולל 4 שלבי משפך + 12 חודשים עונתיים) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
                        <div>
                            <h2 className="text-base font-bold text-yellow-400 mb-1">צפיות לפי שעה ביום</h2>
                            <p className="text-xs text-zinc-400 mb-5">באילו שעות הקהל הכי פעיל על הגרעין</p>
                        </div>
                        <div className="flex items-end gap-1 h-48 pt-4 border-b border-zinc-800">
                            {hourlyViews.map((h) => {
                                const heightPct = Math.round((h.count / maxHourly) * 100);
                                return (
                                    <div key={h.hour} className="flex-1 flex flex-col items-center h-full justify-end group">
                                        <div
                                            className="w-full bg-yellow-500/80 hover:bg-yellow-400 rounded-t-sm transition-all"
                                            style={{ height: `${heightPct}%`, minHeight: h.count > 0 ? "4px" : "2px", opacity: h.count > 0 ? 1 : 0.2 }}
                                            title={`${String(h.hour).padStart(2, "0")}:00 — ${h.count} פעולות`}
                                        />
                                        {h.hour % 6 === 0 && (
                                            <span className="text-[9px] text-zinc-500 mt-1.5">{h.hour}:00</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* כרטיס 10: עומק מעורבות + שיאים עונתיים (12 חודשים) */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-yellow-400">עומק מעורבות</h2>
                                <p className="text-xs text-zinc-400">ציון מעורבות ומחזוריות לאורך השנה</p>
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/40 px-4 py-2 rounded-2xl text-center">
                                <div className="text-2xl font-black text-yellow-400">{engagementScore}</div>
                                <div className="text-[10px] text-zinc-400">מתוך 100</div>
                            </div>
                        </div>

                        <div className="space-y-2.5 text-xs">
                            {[
                                { label: "צפו", pct: totals.views > 0 ? 100 : 0 },
                                { label: "שמרו", pct: saveRate },
                                { label: "הצטרפו", pct: joinRate },
                                { label: "יצרו גרעין", pct: createdRate },
                            ].map((row) => (
                                <div key={row.label} className="flex items-center gap-3">
                                    <span className="w-24 text-zinc-300 font-bold">{row.label}</span>
                                    <div className="flex-1 bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                                        <div
                                            className="bg-gradient-to-l from-yellow-400 to-yellow-600 h-full rounded-full transition-all"
                                            style={{ width: `${row.pct}%` }}
                                        />
                                    </div>
                                    <span className="w-10 text-left font-mono text-yellow-400 font-bold">{row.pct}%</span>
                                </div>
                            ))}
                        </div>

                        {/* גרף שיאים עונתיים (12 חודשים) */}
                        <div className="pt-2 border-t border-zinc-800/80">
                            <div className="text-[11px] text-zinc-400 font-bold mb-2">שיאים עונתיים (חגים ומועדים)</div>
                            <div className="flex items-end gap-1.5 h-20">
                                {monthlySeasonal.map((m) => {
                                    const hPct = Math.round((m.count / maxSeasonal) * 100);
                                    return (
                                        <div key={m.monthIndex} className="flex-1 flex flex-col items-center h-full justify-end">
                                            <div
                                                className="w-full bg-yellow-400/80 hover:bg-yellow-300 rounded-t-sm transition-all"
                                                style={{
                                                    height: `${hPct}%`,
                                                    minHeight: m.count > 0 ? "4px" : "2px",
                                                    opacity: m.count > 0 ? 1 : 0.2,
                                                }}
                                                title={`${m.label}: ${m.count} פעולות`}
                                            />
                                            <span className="text-[8px] text-zinc-500 mt-1">{m.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* כרטיס 3: 30 ימים אחרונים (עם פעילים, חוזרים וצמיחה) + מאיפה צפו */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-bold text-yellow-400 mb-1">חשיפה ומעורבות ב-30 הימים האחרונים</h2>
                                <p className="text-xs text-zinc-400">צפיות (זהב בהיר) ואינטראקציות נוספות (זהב כהה).</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center shrink-0">
                                <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                                    <div className="text-sm font-black text-white">{activeLast30.toLocaleString()}</div>
                                    <div className="text-[9px] text-zinc-400">פעילים</div>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                                    <div className="text-sm font-black text-yellow-400">{returningPct}%</div>
                                    <div className="text-[9px] text-zinc-400">חוזרים</div>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                                    <div className={`text-sm font-black ${growthPct >= 0 ? "text-yellow-300" : "text-red-400"}`}>
                                        {growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`}
                                    </div>
                                    <div className="text-[9px] text-zinc-400">צמיחה</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-end justify-start gap-1 h-44 pt-4 pb-2 px-1 border-b border-zinc-800 overflow-x-auto overflow-y-hidden">
                            {chartData.map((day, idx) => {
                                const vHeight = Math.max(0, (day.views / maxChartValue) * 100);
                                const iHeight = Math.max(0, (day.interactions / maxChartValue) * 100);
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group min-w-[18px]">
                                        <div
                                            className="w-full max-w-[20px] flex flex-col justify-end h-full cursor-pointer"
                                            title={`${day.dateStr}: ${day.views} צפיות, ${day.interactions} אינטראקציות`}
                                        >
                                            <div className="w-full bg-yellow-600 rounded-t-sm" style={{ height: `${iHeight}%`, minHeight: iHeight > 0 ? "4px" : "0" }} />
                                            <div className="w-full bg-yellow-400 rounded-t-sm" style={{ height: `${vHeight}%`, minHeight: vHeight > 0 ? "4px" : "0" }} />
                                        </div>
                                        {(idx % 5 === 0 || idx === 29) && (
                                            <span className="text-[9px] text-zinc-500 mt-2">{day.dateStr}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                        <h2 className="text-base font-bold text-yellow-400 mb-1">מאיפה צפו</h2>
                        <p className="text-xs text-zinc-400 mb-5">פילוח קהל לפי מדינה</p>

                        {sortedCountries.length === 0 ? (
                            <div className="text-center py-10 text-zinc-500 text-sm">אין עדיין מספיק נתונים.</div>
                        ) : (
                            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                                {sortedCountries.map(({ country, count, percent }) => (
                                    <div key={country} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xl">{getFlagEmoji(country)}</span>
                                            <span className="text-sm font-bold text-zinc-200">{country}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-zinc-500">({count})</span>
                                            <span className="text-sm font-black text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-lg">
                                                {percent}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* כרטיס 4 (אזור / עיר לפי רדיוס) + כרטיס 9 (מפת פערים והזדמנויות) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                        <div>
                            <h2 className="text-base font-bold text-yellow-400">אזור / עיר · לפי רדיוס</h2>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">{anchorLabel}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 text-center">
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-base font-black text-white">5 ק״מ</div>
                                <div className="text-xs font-bold text-yellow-400 mt-0.5">{r5.length} גרעינים</div>
                                <div className="text-[10px] text-zinc-500">{r5Views.toLocaleString()} צפיות</div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-base font-black text-white">10 ק״מ</div>
                                <div className="text-xs font-bold text-yellow-400 mt-0.5">{r10.length} גרעינים</div>
                                <div className="text-[10px] text-zinc-500">{r10Views.toLocaleString()} צפיות</div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-base font-black text-white">25 ק״מ</div>
                                <div className="text-xs font-bold text-yellow-400 mt-0.5">{r25.length} גרעינים</div>
                                <div className="text-[10px] text-zinc-500">{r25Views.toLocaleString()} צפיות</div>
                            </div>
                        </div>

                        <div className="relative h-32 bg-zinc-950 border border-zinc-800/80 rounded-2xl flex items-center justify-center overflow-hidden">
                            <div className="w-28 h-28 rounded-full border border-yellow-500/20 bg-yellow-500/[0.03] flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full border border-yellow-500/35 bg-yellow-500/[0.06] flex items-center justify-center">
                                    <div className="w-11 h-11 rounded-full border border-yellow-500/50 bg-yellow-500/15 flex items-center justify-center">
                                        <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_12px_#fbbf24]" />
                                    </div>
                                </div>
                            </div>
                            <span className="absolute top-2.5 right-3 text-[10px] text-zinc-500 font-mono">25km</span>
                            <span className="absolute bottom-2.5 left-3 text-[10px] text-yellow-400/80 font-bold">
                                {r25.length} נקודות במרחב
                            </span>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-yellow-400 font-bold">הזדמנויות:</span>
                            <span className="text-zinc-300">
                                {emptyQuadrants.length} גזרות ללא נוכחות · {nearbyCommunitiesToConnect.length} קהילות קרובות
                            </span>
                        </div>
                    </div>

                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                        <div>
                            <h2 className="text-base font-bold text-yellow-400">מפת פערים</h2>
                            <p className="text-xs text-zinc-400 mt-0.5">מה עדיין לא מכוסה בטווח 25 ק״מ ואיפה כדאי לחבר</p>
                        </div>

                        <div className="relative h-32 bg-zinc-950 border border-zinc-800/80 rounded-2xl flex items-center justify-around px-6 overflow-hidden">
                            <div className="w-16 h-16 rounded-full border border-yellow-500/40 bg-yellow-500/10 flex items-center justify-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                            </div>
                            <div className="flex-1 border-t border-dashed border-yellow-500/40 mx-2 relative">
                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-yellow-400/80 whitespace-nowrap">
                                    פוטנציאל חיבור
                                </span>
                            </div>
                            <div className="w-16 h-16 rounded-full border border-dashed border-zinc-600 bg-zinc-900/60 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-zinc-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 text-center">
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-white">{emptyQuadrants.length}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">אזורים ריקים</div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-yellow-400">{nearbyCommunitiesToConnect.length}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">קהילות לחיבור</div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-xl font-black text-yellow-200">{nearbyLegacySpirit.length}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">מורשת ורוח באזור</div>
                            </div>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 rounded-xl text-xs text-zinc-300">
                            {emptyQuadrants.length > 0 ? (
                                <span>
                                    כיוונים פנויים להרחבה:{" "}
                                    <strong className="text-yellow-400">
                                        {emptyQuadrants.map((q) => q.name).join(", ")}
                                    </strong>
                                </span>
                            ) : (
                                <span className="text-yellow-400 font-bold">כיסוי מלא בכל 4 הכיוונים בטווח 25 ק״מ!</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* כרטיס 7: השוואה אנונימית מול גרעינים דומים */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h2 className="text-base font-bold text-yellow-400">השוואה אנונימית</h2>
                            <p className="text-xs text-zinc-400">
                                מול גרעינים דומים {targetCategory ? `בקטגוריית ${categoryLabels[targetCategory] || targetCategory}` : "בפלטפורמה"} · קבוצה של {comparisonPool.length} גרעינים
                            </p>
                        </div>
                        <span className="text-[11px] text-zinc-400 bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-lg w-fit">
                            הסמן הלבן = ממוצע הקבוצה · בלי שמות
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                            <div className="text-2xl font-black text-yellow-400">{percentileRank}%</div>
                            <div className="text-xs text-zinc-400 mt-0.5">אחוזון כללי</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                            <div className="text-2xl font-black text-white">{multiplierLabel}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">מהממוצע</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                            <div className="text-2xl font-black text-yellow-200">{comparisonPool.length}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">גרעינים דומים</div>
                        </div>
                    </div>

                    <div className="space-y-3 text-xs">
                        {benchmarkBars.map((bar) => {
                            const myPct = Math.min(100, Math.round((bar.myVal / bar.maxScale) * 100));
                            const peerPct = Math.min(98, Math.max(4, Math.round((bar.peerVal / bar.maxScale) * 100)));
                            return (
                                <div key={bar.label} className="flex items-center gap-3">
                                    <span className="w-28 text-zinc-300 font-bold shrink-0">{bar.label}</span>
                                    <div className="flex-1 bg-zinc-950 h-3 rounded-full relative border border-zinc-800 overflow-visible">
                                        <div
                                            className="bg-gradient-to-l from-yellow-400 to-yellow-600 h-full rounded-full transition-all"
                                            style={{ width: `${myPct}%` }}
                                        />
                                        <div
                                            className="absolute -top-1 bottom-[-4px] w-0.5 bg-white shadow-[0_0_6px_#fff]"
                                            style={{ right: `${peerPct}%` }}
                                            title={`ממוצע הקבוצה: ${bar.peerVal.toFixed(1)}`}
                                        />
                                    </div>
                                    <span className="w-12 text-left font-mono text-yellow-400 font-bold shrink-0">
                                        {bar.label === "חשיפה ממוצעת" ? Math.round(bar.myVal) : `${Math.round(bar.myVal)}%`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* תובנות חכמות (AI) + עלות מול השפעה (ROI) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h2 className="text-base font-bold text-yellow-400">תובנות חכמות</h2>
                                <p className="text-xs text-zinc-400">סיכום שבועי · תחזית · שאלה חופשית</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => generateInsight(true)}
                                disabled={isLoadingInsight}
                                className="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                            >
                                {isLoadingInsight ? "מנתח..." : "✨ הפק תובנה"}
                            </button>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-xs leading-relaxed text-zinc-200 flex items-start gap-2.5">
                            <span className="bg-yellow-500 text-black font-black text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                                AI
                            </span>
                            <p>
                                {aiInsight ||
                                    "לחצי על 'הפק תובנה' כדי שה-AI ינתח את מגמות הצפייה, ההצטרפות והמדינות וימליץ על הצעד הבא."}
                            </p>
                        </div>

                        <form onSubmit={handleAskAi} className="space-y-2.5">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={aiQuestion}
                                    onChange={(e) => setAiQuestion(e.target.value)}
                                    placeholder="שאלי שאלה חופשית על הנתונים..."
                                    className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-yellow-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={isAskingAi || !aiQuestion.trim()}
                                    className="bg-zinc-800 hover:bg-yellow-500 hover:text-black text-yellow-400 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                                >
                                    {isAskingAi ? "..." : "שאל"}
                                </button>
                            </div>

                            {aiAnswer && (
                                <div className="bg-yellow-500/5 border border-yellow-500/30 p-3.5 rounded-xl text-xs text-zinc-200 leading-relaxed flex items-start gap-2">
                                    <span className="bg-yellow-500 text-black font-black text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                                        AI
                                    </span>
                                    <p>{aiAnswer}</p>
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h2 className="text-base font-bold text-yellow-400">עלות מול השפעה</h2>
                                <p className="text-xs text-zinc-400">ROI לתורמים וניהול תקציב</p>
                            </div>
                            {selectedPointId !== "ALL" && (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="0"
                                        value={budgetInput}
                                        onChange={(e) => setBudgetInput(e.target.value)}
                                        placeholder="תקציב ₪"
                                        className="w-24 bg-zinc-950 border border-zinc-700 focus:border-yellow-500 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSaveBudget}
                                        disabled={isSavingBudget}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-yellow-400 px-2.5 py-1 rounded-lg text-xs font-bold transition"
                                    >
                                        {isSavingBudget ? "..." : "שמור"}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 text-center">
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-lg font-black text-white">₪{totals.budget.toLocaleString()}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">תקציב / תרומה</div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-lg font-black text-yellow-400">₪{costPerParticipant}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">לכל אינטראקציה</div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                <div className="text-lg font-black text-yellow-200">₪{costPerView}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">לכל צפייה</div>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between text-zinc-400">
                                <span>יחס השפעה (אינטראקציות מתוך צפיות)</span>
                                <span className="font-mono text-yellow-400 font-bold">
                                    {totals.views > 0 ? Math.min(100, Math.round((totalInteractions / totals.views) * 100)) : 0}%
                                </span>
                            </div>
                            <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                                <div
                                    className="bg-yellow-500 h-full rounded-full transition-all"
                                    style={{
                                        width: `${totals.views > 0 ? Math.min(100, Math.round((totalInteractions / totals.views) * 100)) : 0}%`,
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleShareTransparentReport}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-2.5 rounded-xl text-xs font-extrabold transition"
                        >
                            שתף דוח שקוף
                        </button>
                    </div>
                </div>

                {/* 🌟 כרטיס 5 (הרשת העולמית · מבט מקרו) + כרטיס 12 (מצב העולם היהודי · דוח שנתי) */}
                {globalStats && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* כרטיס 5: הרשת העולמית */}
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                            <div>
                                <h2 className="text-base font-bold text-yellow-400">הרשת העולמית</h2>
                                <p className="text-xs text-zinc-400 mt-0.5">מקרו · מפת העולם היהודי</p>
                            </div>

                            {/* מפת נקודות מופשטת */}
                            <div className="relative h-28 bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden flex items-center justify-center">
                                <div className="grid grid-cols-12 gap-2.5 opacity-85 px-4">
                                    {Array.from({ length: 36 }).map((_, idx) => {
                                        const isBright = [2, 5, 7, 13, 14, 15, 19, 20, 26, 27, 31].includes(idx);
                                        return (
                                            <span
                                                key={idx}
                                                className={`w-1.5 h-1.5 rounded-full ${isBright
                                                        ? "bg-yellow-400 shadow-[0_0_8px_#fbbf24]"
                                                        : "bg-yellow-500/25"
                                                    }`}
                                            />
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[11px] text-zinc-400 font-bold">מגמות פעילות בפלטפורמה</div>
                                <div className="flex flex-wrap gap-2">
                                    {globalStats.categoryTrends.map((ct) => (
                                        <span
                                            key={ct.category}
                                            className="bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-lg text-xs font-bold text-yellow-300"
                                        >
                                            {categoryLabels[ct.category] || ct.category}{" "}
                                            <span className="text-yellow-400">{ct.isTrendingUp ? "↑" : "→"}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs">
                                <span className="text-zinc-400">פריסה גלובלית פעילה</span>
                                <span className="font-bold text-yellow-400">
                                    {globalStats.totalSeeds.toLocaleString()} גרעינים ב-{globalStats.countriesCount} מדינות
                                </span>
                            </div>
                        </div>

                        {/* כרטיס 12: מצב העולם היהודי · דוח שנתי מצטבר */}
                        <div className="bg-zinc-900/60 border border-yellow-500/25 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-yellow-400">מצב העולם היהודי</h2>
                                    <p className="text-xs text-zinc-400 mt-0.5">דוח שנתי מצטבר · מתנה לכל יוצר בפלטפורמה</p>
                                </div>
                                <span className="bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 font-black text-base px-3.5 py-1 rounded-xl">
                                    {globalStats.year}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5 text-center">
                                <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                                    <div className="text-xl font-black text-white">
                                        {globalStats.totalParticipants.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 mt-0.5">אינטראקציות</div>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                                    <div className="text-xl font-black text-yellow-400">{globalStats.countriesCount}</div>
                                    <div className="text-[10px] text-zinc-400 mt-0.5">מדינות</div>
                                </div>
                                <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                                    <div className="text-xl font-black text-yellow-200">
                                        {globalStats.totalInitiatives.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 mt-0.5">יוזמות פעילות</div>
                                </div>
                            </div>

                            <div className="space-y-2 text-xs bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-400">הנושא המוביל</span>
                                    <span className="font-bold text-yellow-400">
                                        {categoryLabels[globalStats.leadingCategory] || globalStats.leadingCategory}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-400">צמיחה שנתית</span>
                                    <span className="font-bold text-yellow-300">+{globalStats.annualGrowthPct}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* טבלת דירוג גרעינים */}
                {selectedPointId === "ALL" && (
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                        <h2 className="text-base font-bold text-yellow-400 mb-4">הגרעינים המובילים שלך</h2>
                        <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                            <table className="w-full text-right text-sm border-collapse">
                                <thead>
                                    <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 text-xs">
                                        <th className="p-4">שם הגרעין</th>
                                        <th className="p-4 text-center">צפיות 👀</th>
                                        <th className="p-4 text-center">שמירות ⭐</th>
                                        <th className="p-4 text-center">שיתופים 📤</th>
                                        <th className="p-4 text-center">כניסות לאתר 🔗</th>
                                        <th className="p-4 text-center">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pointStats
                                        .sort((a, b) => (b.analytics?.views || b._count.viewedBy) - (a.analytics?.views || a._count.viewedBy))
                                        .map((p) => (
                                            <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-white/[0.02]">
                                                <td className="p-4 font-bold text-white truncate max-w-[200px]">{p.name}</td>
                                                <td className="p-4 text-center font-bold text-zinc-200">{p.analytics?.views || p._count.viewedBy || 0}</td>
                                                <td className="p-4 text-center font-bold text-yellow-400">{p._count.savedBy || 0}</td>
                                                <td className="p-4 text-center font-bold text-yellow-200">{p.analytics?.shares || 0}</td>
                                                <td className="p-4 text-center font-bold text-yellow-300">{p.analytics?.clicks || p.linkClicks || 0}</td>
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={() => setSelectedPointId(String(p.id))}
                                                        className="text-xs bg-zinc-800 hover:bg-yellow-500 hover:text-black text-white px-3 py-1.5 rounded-lg font-bold transition"
                                                    >
                                                        פילוח מלא
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}