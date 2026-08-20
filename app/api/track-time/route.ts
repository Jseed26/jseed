import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        const { platform, visitorId } = await req.json();

        if (session?.user?.id) {
            // 👤 עדכון למשתמש רשום ומחובר
            await prisma.user.update({
                where: { id: session.user.id },
                data: { 
                    timeSpentMins: { increment: 1 },
                    platform: platform 
                }
            });
        } else if (visitorId) {
            // 👻 עדכון לאורח אנונימי (Upsert = אם לא קיים תיצור, אם קיים תעדכן)
            await prisma.visitor.upsert({
                where: { id: visitorId },
                update: {
                    timeSpentMins: { increment: 1 },
                    platform: platform
                },
                create: {
                    id: visitorId,
                    platform: platform,
                    timeSpentMins: 1
                }
            });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error("Tracking error:", error);
        return Response.json({ error: "Failed to update time" }, { status: 500 });
    }
}