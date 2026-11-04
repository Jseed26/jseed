import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();

    // שולפים את כל הנקודות במאגר
    const allPoints = await prisma.point.findMany({
      include: { _count: { select: { savedBy: true, viewedBy: true } } },
    });

    let suggestedPoints = [];

    // אם המשתמש מחובר, נבנה לו פרופיל העדפות
    if (session?.user?.id) {
      const userId = session.user.id;

      // 🌟 התיקון: שימוש ב-ViewedPoint במקום ViewHistory
      const savedPoints = await prisma.savedPoint.findMany({ where: { userId }, include: { point: true } });
      const viewedPoints = await prisma.viewedPoint.findMany({ where: { userId }, include: { point: true } }).catch(() => []);

      const interactedIds = new Set([
        ...savedPoints.map(s => s.pointId),
        ...viewedPoints.map(v => v.pointId)
      ]);

      // ספירת הקטגוריות האהובות עליו
      const categoryCounts: Record<string, number> = {};
      [...savedPoints, ...viewedPoints].forEach(item => {
        const cat = item.point?.category;
        if (cat) {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      });

      // מיון הקטגוריות מהאהובה ביותר לפחות
      const favoriteCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

      // סינון נקודות: רק קטגוריות אהובות, ורק נקודות שהוא *עוד לא ראה* או שמר
      suggestedPoints = allPoints.filter(p => 
        favoriteCategories.includes(p.category) && !interactedIds.has(p.id)
      );

      // אם אין לו היסטוריה או שאין נקודות חדשות בקטגוריות שלו, פשוט ניקח נקודות רנדומליות שהוא טרם ראה
      if (suggestedPoints.length === 0) {
        suggestedPoints = allPoints.filter(p => !interactedIds.has(p.id));
      }
    } else {
      // משתמש לא מחובר - הכל פתוח
      suggestedPoints = [...allPoints];
    }

    // 🌟 הקסם הממכר: ערבוב רנדומלי מוחלט (Shuffle) ולקיחת 15 תוצאות לכל משיכה
    const shuffled = suggestedPoints.sort(() => 0.5 - Math.random()).slice(0, 15);
    
    return NextResponse.json(shuffled);

  } catch (error) {
    console.error("Suggestions API Error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}