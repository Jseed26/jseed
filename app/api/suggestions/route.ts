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

    let suggestedPoints = [];

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

      suggestedPoints = allPoints.filter(p => 
        favoriteCategories.includes(p.category) && !interactedIds.has(p.id)
      );

      if (suggestedPoints.length === 0) {
        suggestedPoints = allPoints.filter(p => !interactedIds.has(p.id));
      }
    } else {
      suggestedPoints = [...allPoints];
    }

    // 🌟 פיצול וסידור: קודם נקודות עם תמונות, ואז נקודות ללא תמונות!
    let withImages = suggestedPoints.filter(p => (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl);
    let withoutImages = suggestedPoints.filter(p => !((p.imageUrls && p.imageUrls.length > 0) || p.imageUrl));

    // ערבוב רנדומלי פנימי של כל קבוצה (כדי שלא נראה תמיד את אותן תמונות)
    withImages = withImages.sort(() => 0.5 - Math.random());
    withoutImages = withoutImages.sort(() => 0.5 - Math.random());

    // מחברים את שתי הקבוצות (תמונות קודם) ולוקחים 20 תוצאות
    const finalShuffled = [...withImages, ...withoutImages].slice(0, 20);
    
    return NextResponse.json(finalShuffled);

  } catch (error) {
    console.error("Suggestions API Error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}