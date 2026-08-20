import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        
        // 🛡️ הגנה מפני בקשות ריקות (של בוטים או גרסאות ישנות)
        let body = {};
        try {
            body = await req.json();
        } catch (e) {
            // אם מישהו פנה בלי לשלוח JSON, אנחנו פשוט נמשיך הלאה עם אובייקט ריק
            // במקום לזרוק שגיאה אדומה
        }

        // שולפים את הנתונים בבטחה. אם אין פלטפורמה, נניח שזה WEB
        const { platform = "WEB", visitorId } = body as any;

        // 🌍 תופסים את קוד המדינה מ-Vercel
        const country = req.headers.get("x-vercel-ip-country") || "IL";

        if (session?.user?.id) {
            // עדכון משתמש רשום
            await prisma.user.update({
                where: { id: session.user.id },
                data: { 
                    timeSpentMins: { increment: 1 },
                    platform: platform,
                    country: country 
                }
            });
        } else if (visitorId) {
            // עדכון אורח (רק אם באמת יש לנו מזהה אורח, כדי לא לשמור בוטים זמניים)
            await prisma.visitor.upsert({
                where: { id: visitorId },
                update: {
                    timeSpentMins: { increment: 1 },
                    platform: platform,
                    country: country
                },
                create: {
                    id: visitorId,
                    platform: platform,
                    timeSpentMins: 1,
                    country: country 
                }
            });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error("Tracking error:", error);
        return Response.json({ error: "Failed to update time" }, { status: 500 });
    }
}