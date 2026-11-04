import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();

    const allPoints = await prisma.point.findMany({
      include: { _count: { select: { savedBy: true, viewedBy: true } } },
    });

    let finalPoints = [];

    if (session?.user?.id) {
      const userId = session.user.id;
      const savedPoints = await prisma.savedPoint.findMany({ where: { userId }, include: { point: true } });
      const viewedPoints = await prisma.viewedPoint.findMany({ where: { userId }, include: { point: true } }).catch(() => []);

      const interactedIds = new Set([
        ...savedPoints.map(s => s.pointId),
        ...viewedPoints.map(v => v.pointId)
      ]);

      const categoryCounts: Record<string, number> = {};
      [...savedPoints, ...viewedPoints].forEach(item => {
        const cat = item.point?.category;
        if (cat) {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      });

      const favoriteCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

      // 🌟 השינוי הגדול: אנחנו לא חותכים שום דבר! 
      // קבוצה א': גרעינים מומלצים שעדיין לא ראינו
      const recommended = allPoints.filter(p => favoriteCategories.includes(p.category) && !interactedIds.has(p.id));
      // קבוצה ב': כל שאר הגרעינים (אלה שכבר ראינו, או מקטגוריות אחרות)
      const theRest = allPoints.filter(p => !(favoriteCategories.includes(p.category) && !interactedIds.has(p.id)));

      // מערבבים כל קבוצה בפני עצמה
      recommended.sort(() => 0.5 - Math.random());
      theRest.sort(() => 0.5 - Math.random());

      // מחברים את שתי הקבוצות (המומלצים למעלה, כל השאר למטה)
      finalPoints = [...recommended, ...theRest];
    } else {
      // משתמש לא מחובר רואה את כל הגרעינים מעורבבים
      finalPoints = [...allPoints].sort(() => 0.5 - Math.random());
    }

    // מפצלים לנקודות עם ובלי תמונות (תוך כדי שמירה על הסדר של האלגוריתם!)
    const withImages = finalPoints.filter(p => (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl);
    const withoutImages = finalPoints.filter(p => !((p.imageUrls && p.imageUrls.length > 0) || p.imageUrl));

    // 🌟 מחזירים את כל הגרעינים בעולם ללא שום חיתוך. 
    // גרעינים עם תמונה תמיד יופיעו קודם, ובתוכם המומלצים יהיו למעלה!
    const finalSorted = [...withImages, ...withoutImages];
    
    return NextResponse.json(finalSorted);

  } catch (error) {
    console.error("Suggestions API Error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}