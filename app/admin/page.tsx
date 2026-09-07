import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// 🌍 פונקציית עזר קטנה שהופכת קוד מדינה (כמו IL) לדגל אמוג'י
function getFlagEmoji(countryCode: string | null) {
    if (!countryCode) return "🌍";
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

// 🌟 התיקון כאן: אנחנו מודיעים למערכת שזה Promise
export default async function AdminDashboard({
    searchParams
}: {
    searchParams: Promise<{ q?: string }>
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
    
    // 📊 שליפת סטטיסטיקות כלליות
    const totalUsers = await prisma.user.count();
    const totalVisitors = await prisma.visitor.count();
    
    const totalUserTimeResult = await prisma.user.aggregate({ _sum: { timeSpentMins: true } });
    const userTime = totalUserTimeResult._sum.timeSpentMins || 0;
    
    const totalVisitorTimeResult = await prisma.visitor.aggregate({ _sum: { timeSpentMins: true } });
    const visitorTime = totalVisitorTimeResult._sum.timeSpentMins || 0;
    
    const totalPlatformTime = userTime + visitorTime;

    const pwaUsersCount = await prisma.user.count({ where: { platform: "PWA" } });
    const pwaVisitorsCount = await prisma.visitor.count({ where: { platform: "PWA" } });
    const totalPwa = pwaUsersCount + pwaVisitorsCount;

    const webUsersCount = await prisma.user.count({ where: { platform: "WEB" } });
    const webVisitorsCount = await prisma.visitor.count({ where: { platform: "WEB" } });
    const totalWeb = webUsersCount + webVisitorsCount;

    // 🟢 חישוב מחוברים כעת (Live) - מי שעידכן זמן ב-5 הדקות האחרונות
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const onlineUsers = await prisma.user.count({
        where: { updatedAt: { gte: fiveMinutesAgo } }
    });
    const onlineVisitors = await prisma.visitor.count({
        where: { updatedAt: { gte: fiveMinutesAgo } }
    });
    const totalOnlineNow = onlineUsers + onlineVisitors;
    
    // משיכת משתמשים לטבלה
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            timeSpentMins: true,
            platform: true, 
            country: true, 
            _count: { select: { points: true } }
        },
        orderBy: { timeSpentMins: "desc" }
    });

    // ==========================================
    // 🌟 אזור חדש: ניהול וחיפוש גרעינים
    // ==========================================
    
    // 🌟 התיקון השני: אנחנו ממתינים (await) כדי לחלץ את מילת החיפוש
    const resolvedSearchParams = await searchParams;
    const searchQuery = resolvedSearchParams?.q || "";
    
    let searchedPoints: any[] = [];

    // אם המנהל חיפש משהו, נמשוך את כל הגרעינים שדומים לשם הזה
    if (searchQuery) {
        searchedPoints = await prisma.point.findMany({
            where: { 
                name: { contains: searchQuery, mode: "insensitive" } 
            },
            include: {
                user: { select: { name: true, email: true } }, // מי העלה
                _count: { select: { viewedBy: true, savedBy: true } } // סטטיסטיקות
            },
            orderBy: { createdAt: "desc" }
        });
    }

    // 🌟 פונקציית מחיקה שתרוץ ישירות על השרת (Server Action)
    async function deletePointAction(formData: FormData) {
        "use server";
        
        // מוודאים שוב שזה באמת המנהל שמנסה למחוק
        const currentSession = await auth();
        const adminCheck = await prisma.user.findUnique({ where: { id: currentSession?.user?.id } });
        if (!adminCheck?.isAdmin) return;

        const pointId = Number(formData.get("pointId"));
        if (pointId) {
            await prisma.point.delete({ where: { id: pointId } });
            revalidatePath("/admin"); // מרענן את הדף אוטומטית אחרי המחיקה!
        }
    }

    return (
        <div className="min-h-screen bg-black text-white p-8" dir="rtl">
            <h1 className="text-3xl font-bold text-yellow-500 mb-8">לוח בקרה - מנהלת (Admin)</h1>
            
            {/* 🌟 רשת הקוביות - סודרה ב-3 עמודות */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <div className="bg-[#111] border border-green-900/50 p-6 rounded-xl text-center relative shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        <span className="relative flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                        </span>
                    </div>
                    <h2 className="text-gray-400 text-lg">מחוברים כעת (Live)</h2>
                    <p className="text-5xl font-bold text-green-500 mt-2">{totalOnlineNow}</p>
                </div>

                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">סה"כ רשומים</h2>
                    <p className="text-4xl font-bold text-white mt-2">{totalUsers}</p>
                </div>

                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">סה"כ אורחים</h2>
                    <p className="text-4xl font-bold text-gray-400 mt-2">{totalVisitors}</p>
                </div>

                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">התקנות אפליקציה (PWA)</h2>
                    <p className="text-4xl font-bold text-white mt-2">{totalPwa}</p>
                </div>

                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">גולשי אינטרנט (Web)</h2>
                    <p className="text-4xl font-bold text-white mt-2">{totalWeb}</p>
                </div>
                
                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">זמן שהייה (כולל אורחים)</h2>
                    <p className="text-4xl font-bold text-yellow-500 mt-2">
                        {totalPlatformTime < 60 
                            ? `${totalPlatformTime} דק'` 
                            : `${(totalPlatformTime / 60).toFixed(1)} שעות`}
                    </p>
                </div>
            </div>

            {/* ========================================== */}
            {/* 🌟 אזור חדש: מנוע חיפוש ומחיקת גרעינים */}
            {/* ========================================== */}
            <div className="mb-12">
                <h2 className="text-xl font-bold mb-4 text-yellow-500">חיפוש וניהול גרעינים</h2>
                <div className="bg-[#111] p-6 rounded-xl border border-gray-800">
                    <form method="GET" className="flex gap-4 mb-6">
                        <input 
                            type="text" 
                            name="q" 
                            defaultValue={searchQuery}
                            placeholder='הקלידי שם גרעין לחיפוש (לדוגמה: "בית חב"ד מנילה")...' 
                            className="flex-1 bg-gray-900 border border-gray-700 p-3 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        />
                        <button type="submit" className="bg-yellow-500 text-black px-8 py-3 rounded-xl font-bold hover:bg-yellow-400 transition">
                            חפש גרעין
                        </button>
                        {searchQuery && (
                            <a href="/admin" className="bg-gray-800 text-gray-300 px-6 py-3 rounded-xl hover:bg-gray-700 transition flex items-center border border-gray-600">
                                נקה
                            </a>
                        )}
                    </form>

                    {searchQuery && searchedPoints.length === 0 && (
                        <p className="text-gray-400 text-center py-4">לא נמצאו גרעינים התואמים לחיפוש "{searchQuery}".</p>
                    )}

                    {searchedPoints.length > 0 && (
                        <div className="overflow-x-auto border border-gray-800 rounded-xl">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="bg-gray-900 border-b border-gray-800">
                                        <th className="p-4 text-yellow-500">שם הגרעין</th>
                                        <th className="p-4 text-yellow-500">קטגוריה</th>
                                        <th className="p-4 text-yellow-500">הועלה ע"י</th>
                                        <th className="p-4 text-yellow-500">צפיות 👀</th>
                                        <th className="p-4 text-yellow-500">שמירות 🌟</th>
                                        <th className="p-4 text-yellow-500 text-center">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchedPoints.map((p) => (
                                        <tr key={p.id} className="border-b border-gray-800 hover:bg-[#1a1a1a]">
                                            <td className="p-4 font-bold text-white">{p.name}</td>
                                            <td className="p-4 text-gray-400">{p.category}</td>
                                            <td className="p-4">
                                                {p.user ? (
                                                    <div>
                                                        <div className="text-white">{p.user.name}</div>
                                                        <div className="text-xs text-gray-500">{p.user.email}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-600 text-sm">משתמש לא ידוע</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-gray-300">{p._count.viewedBy}</td>
                                            <td className="p-4 text-gray-300">{p._count.savedBy}</td>
                                            <td className="p-4 text-center">
                                                <form action={deletePointAction}>
                                                    <input type="hidden" name="pointId" value={p.id} />
                                                    <button 
                                                        type="submit" 
                                                        className="bg-red-900/40 border border-red-800 text-red-400 px-4 py-2 rounded-lg hover:bg-red-900/60 transition text-sm font-bold"
                                                    >
                                                        מחק מן המפה
                                                    </button>
                                                </form>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <h2 className="text-xl font-bold mb-4">טבלת משתמשים פעילים</h2>
            <div className="overflow-x-auto border border-gray-800 rounded-xl mb-12">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-gray-900 border-b border-gray-800">
                            <th className="p-4 text-yellow-500">שם משתמש</th>
                            <th className="p-4 text-yellow-500">אימייל</th>
                            <th className="p-4 text-yellow-500 text-center">מדינה</th>
                            <th className="p-4 text-yellow-500">פלטפורמה</th>
                            <th className="p-4 text-yellow-500">נקודות שיצר</th>
                            <th className="p-4 text-yellow-500">זמן שהייה (בדקות)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-b border-gray-800 hover:bg-[#111]">
                                <td className="p-4">{u.name || "ללא שם"}</td>
                                <td className="p-4 text-gray-400">{u.email}</td>
                                
                                <td className="p-4 text-center text-2xl" title={u.country || "לא ידוע"}>
                                    {getFlagEmoji(u.country)}
                                </td>

                                <td className="p-4">
                                    {u.platform === "PWA" ? (
                                        <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-sm">📱 אפליקציה</span>
                                    ) : (
                                        <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">💻 אתר אינטרנט</span>
                                    )}
                                </td>
                                <td className="p-4 font-bold">{u._count.points}</td>
                                <td className="p-4">
                                    {u.timeSpentMins < 60 
                                        ? `${u.timeSpentMins} דקות` 
                                        : `${(u.timeSpentMins / 60).toFixed(1)} שעות`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}