import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        const { platform, visitorId } = await req.json();

        // 🌍 תופסים את קוד המדינה מ-Vercel (ברירת מחדל IL אם את מריצה במחשב שלך)
        const country = req.headers.get("x-vercel-ip-country") || "IL";

        if (session?.user?.id) {
            // עדכון משתמש רשום
            await prisma.user.update({
                where: { id: session.user.id },
                data: { 
                    timeSpentMins: { increment: 1 },
                    platform: platform,
                    country: country // 👈 שומר את המדינה
                }
            });
        } else if (visitorId) {
            // עדכון אורח
            await prisma.visitor.upsert({
                where: { id: visitorId },
                update: {
                    timeSpentMins: { increment: 1 },
                    platform: platform,
                    country: country // 👈 שומר את המדינה
                },
                create: {
                    id: visitorId,
                    platform: platform,
                    timeSpentMins: 1,
                    country: country // 👈 שומר את המדינה
                }
            });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error("Tracking error:", error);
        return Response.json({ error: "Failed to update time" }, { status: 500 });
    }
}