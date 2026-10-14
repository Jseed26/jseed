import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export const dynamic = 'force-dynamic';

// שליפת היסטוריית הצפיות של המשתמש המחובר
export async function GET() {
    const session = await auth();

    if (!session?.user?.id) {
        return Response.json([], { status: 401 });
    }

    const history = await (prisma as any).viewedPoint.findMany({
        where: {
            userId: session.user.id,
        },
        orderBy: {
            viewedAt: "desc", // מהחדש לישן
        },
        include: {
            point: true, // תביא לי גם את פרטי הנקודה עצמה
        },
        take: 30, // נגביל ל-30 הנקודות האחרונות
    });

    // אנחנו מחזירים רק את מערך הנקודות עצמן מתוך רשומות ההיסטוריה
    const points = history.map((h: any) => h.point);
    return Response.json(points);
}

// שמירת נקודה בהיסטוריה + הפעלת התראת צפייה במפה
export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const pointId = Number(body.pointId);

        // upsert: אם הוא כבר צפה בזה פעם, רק נעדכן את השעה להיום. אם לא, ניצור רשומה.
        await (prisma as any).viewedPoint.upsert({
            where: {
                userId_pointId: {
                    userId: session.user.id,
                    pointId: pointId,
                },
            },
            update: {
                viewedAt: new Date(),
            },
            create: {
                userId: session.user.id,
                pointId: pointId,
            },
        });

        // 🌟 🌟 🌟 התראה: מישהו צפה בנקודה שלך במפה 🌟 🌟 🌟
        try {
            const point = await prisma.point.findUnique({
                where: { id: pointId },
                select: { userId: true, name: true }
            });

            // אם לנקודה יש בעלים, והמשתמש שצופה בה כרגע זה לא הבעלים עצמו
            if (point?.userId && point.userId !== session.user.id) {
                
                // בדיקה שמונעת הצפת התראות: נוודא שלא שלחנו לו התראת צפייה על אותה נקודה ב-24 שעות האחרונות
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const recentNotification = await prisma.notification.findFirst({
                    where: {
                        userId: point.userId,
                        message: `מישהו פתח הרגע את הגרעין שלך: "${point.name}" במפה! 👀`,
                        createdAt: { gte: twentyFourHoursAgo }
                    }
                });

                if (!recentNotification) {
                    await prisma.notification.create({
                        data: {
                            userId: point.userId,
                            message: `מישהו פתח הרגע את הגרעין שלך: "${point.name}" במפה! 👀`
                        }
                    });
                }
            }
        } catch (notifErr) {
            console.error("Failed to create view notification:", notifErr);
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: "Failed to save history" }, { status: 500 });
    }
}