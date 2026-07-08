import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

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

// שמירת נקודה בהיסטוריה
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

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: "Failed to save history" }, { status: 500 });
    }
}