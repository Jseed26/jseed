import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function AdminDashboard() {
    const session = await auth();

    // 1. האם בכלל יש משתמש מחובר?
    if (!session?.user?.id) {
        redirect("/api/auth/signin"); 
    }

    // 2. שליפת המשתמש מה-DB כדי לבדוק את הסטטוס שלו
    const user = await prisma.user.findUnique({
        where: { id: session.user.id }
    });

    // 3. 🔒 האבטחה האמיתית: בודקים אם isAdmin הוא true
    if (!user?.isAdmin) {
        redirect("/"); 
    }
    
    // 📊 שליפת סטטיסטיקות קיימות
    const totalUsers = await prisma.user.count();
    const totalPoints = await prisma.point.count();
    
    // ⏳ חישוב הזמן הכולל של כל המשתמשים יחד
    const totalTimeResult = await prisma.user.aggregate({
        _sum: { timeSpentMins: true }
    });
    const totalPlatformTime = totalTimeResult._sum.timeSpentMins || 0;

    // 📱 שליפת סטטיסטיקות פלטפורמה (מי הוריד ומי בדפדפן)
    const pwaUsersCount = await prisma.user.count({ where: { platform: "PWA" } });
    const webUsersCount = await prisma.user.count({ where: { platform: "WEB" } });
    
    // משיכת כל המשתמשים + הפלטפורמה שלהם
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            timeSpentMins: true,
            platform: true, // 👈 משכנו את הפלטפורמה
            _count: { select: { points: true } }
        },
        orderBy: { timeSpentMins: "desc" }
    });

    return (
        <div className="min-h-screen bg-black text-white p-8" dir="rtl">
            <h1 className="text-3xl font-bold text-yellow-500 mb-8">לוח בקרה - מנהלת (Admin)</h1>
            
            {/* שורת קוביות הסטטיסטיקה */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">סה"כ משתמשים</h2>
                    <p className="text-4xl font-bold text-white mt-2">{totalUsers}</p>
                </div>
                
                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">זמן שהייה כולל</h2>
                    <p className="text-4xl font-bold text-yellow-500 mt-2">
                        {totalPlatformTime < 60 
                            ? `${totalPlatformTime} דק'` 
                            : `${(totalPlatformTime / 60).toFixed(1)} שעות`}
                    </p>
                </div>

                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">התקנות אפליקציה (PWA)</h2>
                    <p className="text-4xl font-bold text-white mt-2">{pwaUsersCount}</p>
                </div>

                <div className="bg-[#111] border border-gray-800 p-6 rounded-xl text-center">
                    <h2 className="text-gray-400 text-lg">גולשי אינטרנט (Web)</h2>
                    <p className="text-4xl font-bold text-white mt-2">{webUsersCount}</p>
                </div>
            </div>

            <h2 className="text-xl font-bold mb-4">טבלת משתמשים פעילים</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-gray-900 border-b border-gray-800">
                            <th className="p-4 text-yellow-500">שם משתמש</th>
                            <th className="p-4 text-yellow-500">אימייל</th>
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