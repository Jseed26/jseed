import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { isAdmin: true },
        });
        const isAdmin = Boolean(currentUser?.isAdmin);

        const { pointId, question, forceRefresh } = await req.json();
        const isAll = !pointId || pointId === "ALL";
        const numericId = !isAll ? Number(pointId) : null;

        const points = await prisma.point.findMany({
            where: isAdmin && numericId
                ? { id: numericId }
                : {
                      userId: currentUserId,
                      ...(numericId ? { id: numericId } : {}),
                  },
            include: {
                _count: { select: { viewedBy: true, savedBy: true } },
                analytics: true,
            },
        });

        if (points.length === 0) {
            return NextResponse.json({ error: "No points found" }, { status: 404 });
        }

        // אם זו תובנה כללית לגרעין בודד וכבר קיימת תובנה מהשבוע האחרון — נחזיר מהמטמון
        if (!isAll && !question && !forceRefresh && points[0].analytics?.aiInsight && points[0].analytics?.aiInsightAt) {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            if (new Date(points[0].analytics.aiInsightAt).getTime() > sevenDaysAgo) {
                return NextResponse.json({
                    insight: points[0].analytics.aiInsight,
                    cached: true,
                });
            }
        }

        const logs = await prisma.pointActionLog.findMany({
            where: { pointId: { in: points.map((p) => p.id) } },
            orderBy: { createdAt: "desc" },
            take: 300,
        });

        const summary = points.map((p) => ({
            name: p.name,
            category: p.category,
            address: p.address,
            views: p.analytics?.views || p._count.viewedBy || 0,
            saves: p._count.savedBy || 0,
            shares: p.analytics?.shares || 0,
            clicks: p.analytics?.clicks || p.linkClicks || 0,
            joins: p.analytics?.joins || 0,
        }));

        const countryMap: Record<string, number> = {};
        logs.forEach((l) => {
            const c = l.country || "IL";
            countryMap[c] = (countryMap[c] || 0) + 1;
        });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
        }

        const prompt = question
            ? `אתה אנליסט נתונים חכם של פלטפורמת JSeed. ענה בעברית קצרה, ברורה ומעשית (עד 3 משפטים) על שאלת המשתמש בהתבסס על הנתונים שלו בלבד.
נתוני הגרעינים: ${JSON.stringify(summary)}
התפלגות מדינות: ${JSON.stringify(countryMap)}
שאלת המשתמש: "${question}"`
            : `אתה אנליסט נתונים חכם של פלטפורמת JSeed. כתוב סיכום שבועי קצר וממוקד בעברית (2-3 משפטים) עם תובנה אחת והמלצה מעשית לשיפור החשיפה או ההשתתפות.
נתוני הגרעינים: ${JSON.stringify(summary)}
התפלגות מדינות: ${JSON.stringify(countryMap)}`;

        const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        const aiData = await aiRes.json();
        const text =
            aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            "לא הצלחנו להפיק תובנה כרגע, נסי שוב בעוד רגע.";

        // שמירה במסד עבור גרעין ספציפי
        if (!isAll && numericId && !question) {
            await prisma.pointAnalytics.upsert({
                where: { pointId: numericId },
                update: { aiInsight: text, aiInsightAt: new Date() },
                create: { pointId: numericId, aiInsight: text, aiInsightAt: new Date() },
            });
        }

        return NextResponse.json(question ? { answer: text } : { insight: text });
    } catch (error) {
        console.error("AI Insight Error:", error);
        return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
    }
}