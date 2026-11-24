import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST(req: Request, context: any) {
    try {
        const session = await auth();
        const params = await context.params;
        const pointId = Number(params.id);

        const body = await req.json().catch(() => ({}));
        const type: "SHARE" | "CLICK" = body?.type === "SHARE" ? "SHARE" : "CLICK";

        const country = req.headers.get("x-vercel-ip-country") || "IL";

        if (type === "SHARE") {
            const point = await prisma.point.findUnique({
                where: { id: pointId },
                select: { userId: true, name: true },
            });

            await prisma.pointAnalytics.upsert({
                where: { pointId },
                update: { shares: { increment: 1 } },
                create: { pointId, shares: 1 },
            });

            await prisma.pointActionLog.create({
                data: {
                    pointId,
                    action: "SHARE",
                    country,
                    userId: session?.user?.id || null,
                },
            });

            if (point?.userId && (!session?.user?.id || session.user.id !== point.userId)) {
                await prisma.notification.create({
                    data: {
                        userId: point.userId,
                        pointId,
                        message: `מישהו הרגע שיתף את הגרעין שלך: "${point.name}"! 📤`,
                    },
                });
            }

            return Response.json({ success: true, type: "SHARE" });
        }

        // ברירת מחדל: CLICK (כניסה לקישור האתר)
        const updatedPoint = await prisma.point.update({
            where: { id: pointId },
            data: { linkClicks: { increment: 1 } },
        });

        await prisma.pointAnalytics.upsert({
            where: { pointId },
            update: { clicks: { increment: 1 } },
            create: { pointId, clicks: 1 },
        });

        await prisma.pointActionLog.create({
            data: {
                pointId,
                action: "CLICK",
                country,
                userId: session?.user?.id || null,
            },
        });

        if (updatedPoint.userId && (!session?.user?.id || session.user.id !== updatedPoint.userId)) {
            await prisma.notification.create({
                data: {
                    userId: updatedPoint.userId,
                    pointId,
                    message: `מישהו הרגע נכנס לקישור של הגרעין שלך: "${updatedPoint.name}"! 🔗`,
                },
            });
        }

        return Response.json({ success: true, type: "CLICK" });
    } catch (error) {
        console.error("Click/Share counting error:", error);
        return Response.json({ error: "Failed to count action" }, { status: 500 });
    }
}