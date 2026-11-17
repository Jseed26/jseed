"use client";


import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function getFlagEmoji(countryCode: string | null) {
    if (!countryCode) return "🌍";
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

type Log = {
    createdAt: string;
    action: string;
    country: string;
    pointId: number;
};

type PointStat = {
    id: number;
    name: string;
    category: string;
    _count: { viewedBy: number; savedBy: number };
    analytics: { views: number; clicks: number; joins: number } | null;
    linkClicks: number;
};

export default function UserAnalyticsDashboard() {
    const { status } = useSession();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<Log[]>([]);
    const [pointStats, setPointStats] = useState<PointStat[]>([]);
    const [userPoints, setUserPoints] = useState<{ id: number, name: string }[]>([]);

    const [selectedPointId, setSelectedPointId] = useState<string>("ALL");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pointId = params.get("pointId");

        if (pointId) {
            setSelectedPointId(pointId);
        }
    }, []);


    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth");
        } else if (status === "authenticated") {
            fetch("/api/my-points/analytics")
                .then(res => res.json())
                .then(data => {
                    if (!data.error) {
                        setLogs(data.logs || []);
                        setPointStats(data.pointStats || []);
                        setUserPoints(data.userPoints || []);
                    }
                    setIsLoading(false);
                })
                .catch(() => setIsLoading(false));
        }
    }, [status, router]);

    if (isLoading || status === "loading") {
        return (
            <div className="min-h-screen bg-[#070709] flex items-center justify-center font-bold text-blue-400">
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
                <Link href="/my-points?tab=my" className="bg-yellow-500 text-black px-6 py-2 rounded-xl font-bold">חזרה לאזור שלי</Link>
            </div>
        );
    }

    // סינון הנתונים לפי הבחירה
    const filteredLogs = selectedPointId === "ALL"
        ? logs
        : logs.filter(l => l.pointId === Number(selectedPointId));

    const filteredStats = selectedPointId === "ALL"
        ? pointStats
        : pointStats.filter(p => p.id === Number(selectedPointId));

    // חישוב סך הכל
    const totals = filteredStats.reduce((acc, p) => {
        acc.views += (p.analytics?.views || p._count.viewedBy || 0);
        acc.saves += p._count.savedBy;
        acc.clicks += (p.analytics?.clicks || p.linkClicks || 0);
        if (p.category === "chai") {
            acc.joins += (p.analytics?.joins || 0);
        }
        return acc;
    }, { views: 0, saves: 0, clicks: 0, joins: 0 });

    // יצירת הגרף ל-30 יום האחרונים
    const chartData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        const dayLogs = filteredLogs.filter(l => {
            const lDate = new Date(l.createdAt);
            return lDate >= d && lDate < nextD;
        });

        chartData.push({
            dateStr: `${d.getDate()}/${d.getMonth() + 1}`,
            views: dayLogs.filter(l => l.action === "VIEW").length,
            interactions: dayLogs.filter(l => l.action !== "VIEW").length,
            total: dayLogs.length
        });
    }

    const maxChartValue = Math.max(...chartData.map(d => d.total), 1);

    // חישוב מדינות
    const countryCounts: Record<string, number> = {};
    filteredLogs.forEach(l => {
        const c = l.country || "IL";
        countryCounts[c] = (countryCounts[c] || 0) + 1;
    });
    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

    return (
        <div className="min-h-screen bg-[#070709] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-[#070709] to-[#070709] text-white p-4 sm:p-8 pb-32 font-sans" dir="rtl">
            <div className="max-w-5xl mx-auto">

                {/* כותרת עליונה */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-gray-800 pb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-400 flex items-center gap-3">
                            <span className="bg-blue-500/10 p-2 rounded-xl border border-blue-500/30">📊</span>
                            דשבורד ביצועים ונתונים
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">עקוב אחר החשיפה וההשפעה של הגרעינים שלך במפה.</p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select
                            className="bg-black/60 border border-gray-700 text-white p-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 flex-1 sm:flex-none font-bold"
                            value={selectedPointId}
                            onChange={(e) => setSelectedPointId(e.target.value)}
                        >
                            <option value="ALL">כל הגרעינים שלי ({userPoints.length})</option>
                            {userPoints.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <Link href="/my-points?tab=my" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap border border-gray-700">
                            חזרה
                        </Link>
                    </div>
                </div>

                {/* קוביות סיכום */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-gray-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="text-3xl mb-2">👁️</div>
                        <div className="text-gray-400 text-xs font-bold mb-1">סך צפיות (חשיפות)</div>
                        <div className="text-2xl font-black text-white">{totals.views.toLocaleString()}</div>
                    </div>
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-yellow-500/20 p-5 rounded-2xl shadow-lg">
                        <div className="w-8 h-8 mb-2"><img src="/icons/ui/save/active.png" className="w-full h-full object-contain" /></div>
                        <div className="text-gray-400 text-xs font-bold mb-1">שמרו למועדפים</div>
                        <div className="text-2xl font-black text-yellow-500">{totals.saves.toLocaleString()}</div>
                    </div>
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-blue-500/20 p-5 rounded-2xl shadow-lg">
                        <div className="text-3xl mb-2 text-blue-400">🔗</div>
                        <div className="text-gray-400 text-xs font-bold mb-1">שיתופים</div>
                        <div className="text-2xl font-black text-blue-400">{totals.clicks.toLocaleString()}</div>
                    </div>
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-green-500/20 p-5 rounded-2xl shadow-lg">
                        <div className="text-3xl mb-2 text-green-400">🤝</div>
                        <div className="text-gray-400 text-xs font-bold mb-1">השתתפויות מהירות</div>
                        <div className="text-2xl font-black text-green-400">{totals.joins.toLocaleString()}</div>
                    </div>
                </div>

                {/* אזור מרכזי: גרף + מדינות */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                    {/* גרף פעילות 30 יום */}
                    <div className="lg:col-span-2 bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-white mb-1">חשיפה ומעורבות ב-30 הימים האחרונים</h2>
                            <p className="text-xs text-gray-400 mb-6">מציג נתוני צפיות (כחול) ואינטראקציות נוספות (זהב) לאורך זמן.</p>
                        </div>
                        <div className="flex items-end justify-start gap-1 h-56 pt-8 pb-2 px-1 border-b border-gray-800 overflow-x-auto overflow-y-hidden custom-scrollbar">
                            {chartData.map((day, idx) => {
                                const vHeight = Math.max(0, (day.views / maxChartValue) * 100);
                                const iHeight = Math.max(0, (day.interactions / maxChartValue) * 100);

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group min-w-[20px]">
                                        {day.total > 0 && (
                                            <span className="text-[9px] font-bold text-gray-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {day.total}
                                            </span>
                                        )}
                                        <div className="w-full max-w-[24px] flex flex-col justify-end h-full relative cursor-pointer" title={`${day.dateStr}: ${day.views} צפיות, ${day.interactions} אינטראקציות`}>
                                            <div className="w-full bg-yellow-500 rounded-t-sm transition-all hover:brightness-110" style={{ height: `${iHeight}%`, minHeight: iHeight > 0 ? '4px' : '0' }}></div>
                                            <div className="w-full bg-blue-500 rounded-t-sm transition-all hover:brightness-110" style={{ height: `${vHeight}%`, minHeight: vHeight > 0 ? '4px' : '0' }}></div>
                                        </div>
                                        {(idx % 5 === 0 || idx === 29) && (
                                            <span className="text-[9px] text-gray-500 mt-2">{day.dateStr}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* מדינות */}
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-gray-800 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-lg font-bold text-white mb-1">פילוח קהל (מדינות)</h2>
                        <p className="text-xs text-gray-400 mb-6">מאיפה מגיעים המשתמשים שלך?</p>

                        {sortedCountries.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 text-sm">אין עדיין מספיק נתונים.</div>
                        ) : (
                            <div className="space-y-4 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                                {sortedCountries.map(([country, count], i) => (
                                    <div key={country} className="flex items-center justify-between bg-black/40 border border-gray-800 p-3 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{getFlagEmoji(country)}</span>
                                            <span className="text-sm font-bold text-gray-200">{country}</span>
                                        </div>
                                        <div className="text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                                            {count} <span className="text-[10px] font-normal text-gray-400">פעולות</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* טבלת ביצועי גרעינים */}
                {selectedPointId === "ALL" && (
                    <div className="bg-gradient-to-b from-[#141418] to-[#0c0c0f] border border-gray-800 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-lg font-bold text-white mb-4">דירוג הגרעינים שלך</h2>
                        <div className="overflow-x-auto border border-gray-800 rounded-xl">
                            <table className="w-full text-right text-sm border-collapse">
                                <thead>
                                    <tr className="bg-black/60 text-gray-400 border-b border-gray-800 text-xs">
                                        <th className="p-4">שם הגרעין</th>
                                        <th className="p-4 text-center">צפיות בבועה 👀</th>
                                        <th className="p-4 text-center">שמירות 🌟</th>
                                        <th className="p-4 text-center">שיתופים 🔗</th>
                                        <th className="p-4 text-center">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pointStats.sort((a, b) => (b.analytics?.views || b._count.viewedBy) - (a.analytics?.views || a._count.viewedBy)).map((p) => (
                                        <tr key={p.id} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                                            <td className="p-4 font-bold text-white truncate max-w-[200px]">{p.name}</td>
                                            <td className="p-4 text-center font-bold text-blue-300">{p.analytics?.views || p._count.viewedBy || 0}</td>
                                            <td className="p-4 text-center font-bold text-yellow-500">{p._count.savedBy || 0}</td>
                                            <td className="p-4 text-center font-bold text-blue-500">{p.analytics?.clicks || p.linkClicks || 0}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => setSelectedPointId(String(p.id))} className="text-[11px] bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition">
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

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.3); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.6); }
            `}} />
        </div>
    );
}