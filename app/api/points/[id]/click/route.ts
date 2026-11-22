import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST(req: Request, context: any) {
    try {
        const session = await auth();
        const params = await context.params;
        const pointId = Number(params.id);
        
        // 🌍 שולפים את המדינה מה-Headers
        const country = req.headers.get("x-vercel-ip-country") || "IL";

        // עדכון המונה הכולל ב-Point
        const updatedPoint = await prisma.point.update({
            where: { id: pointId },
            data: { linkClicks: { increment: 1 } },
        });
        
        // 🌟 🌟 🌟 עדכון סטטיסטיקת קליקים (Clicks) על הגרעין הספציפי ב-PointAnalytics 🌟 🌟 🌟
        await (prisma as any).pointAnalytics.upsert({
            where: { pointId: pointId },
            update: { clicks: { increment: 1 } },
            create: { pointId: pointId, clicks: 1 }
        });
        
        // 🌟 🌟 🌟 תיעוד הפעולה ביומן המפורט (PointActionLog) 🌟 🌟 🌟
        await (prisma as any).pointActionLog.create({
            data: {
                pointId: pointId,
                action: "CLICK",
                country: country,
                userId: session?.user?.id || null, // יכול להיות גם אורח שלחץ
            }
        });

        // 🌟 🌟 🌟 התראה: מישהו לחץ על הקישור שלך 🌟 🌟 🌟
        if (updatedPoint.userId) {
            // נוודא שהבעלים לא לחץ על הקישור של עצמו (אם הוא מחובר)
            if (!session?.user?.id || session.user.id !== updatedPoint.userId) {
                await prisma.notification.create({
                    data: {
                        userId: updatedPoint.userId, 
                        pointId: pointId,
                        message: `מישהו הרגע נכנס לקישור של הגרעין שלך: "${updatedPoint.name}"! 🔗`,
                    }
                });
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error("Click counting error:", error);
        return Response.json({ error: "Failed to count click" }, { status: 500 });
    }
}