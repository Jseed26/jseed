import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST(req: Request, context: any) {
    try {
        const session = await auth();
        const params = await context.params;
        const pointId = Number(params.id);

        const updatedPoint = await prisma.point.update({
            where: { id: pointId },
            data: { linkClicks: { increment: 1 } },
        });

        // 🌟 🌟 🌟 התראה: מישהו לחץ על הקישור שלך 🌟 🌟 🌟
        if (updatedPoint.userId) {
            // נוודא שהבעלים לא לחץ על הקישור של עצמו (אם הוא מחובר)
            if (!session?.user?.id || session.user.id !== updatedPoint.userId) {
                await prisma.notification.create({
                    data: {
                        userId: updatedPoint.userId, 
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