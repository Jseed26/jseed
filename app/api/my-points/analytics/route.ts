import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();

    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 1. נשלוף את כל הגרעינים שהמשתמש הזה יצר
        const userPoints = await prisma.point.findMany({
            where: { userId: session.user.id },
            select: { id: true, name: true, category: true }
        });

        const pointIds = userPoints.map(p => p.id);

        // אם אין לו גרעינים בכלל, נחזיר דאטה ריק
        if (pointIds.length === 0) {
            return Response.json({ logs: [], pointStats: [] });
        }

        // 2. נשלוף את כל הפעולות (Logs) שקרו בחודשיים האחרונים עבור הגרעינים שלו
        const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        
        const logs = await prisma.pointActionLog.findMany({
            where: {
                pointId: { in: pointIds },
                createdAt: { gte: twoMonthsAgo }
            },
            orderBy: { createdAt: "asc" }
        });

        // 3. נביא גם את הסטטיסטיקות המלאות והעדכניות של כל גרעין בנפרד (לטובת דירוג)
        const pointStats = await prisma.point.findMany({
            where: { id: { in: pointIds } },
            include: {
                _count: { select: { viewedBy: true, savedBy: true } },
                analytics: true
            },
            orderBy: { createdAt: "desc" }
        });

        return Response.json({ logs, pointStats, userPoints });
    } catch (error) {
        console.error("Failed to fetch user analytics:", error);
        return Response.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}