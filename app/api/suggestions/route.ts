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

    // מפצלים לנקודות עם ובלי תמונות
    let withImages = suggestedPoints.filter(p => (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl);
    let withoutImages = suggestedPoints.filter(p => !((p.imageUrls && p.imageUrls.length > 0) || p.imageUrl));

    // מערבבים כל קבוצה בנפרד
    withImages = withImages.sort(() => 0.5 - Math.random());
    withoutImages = withoutImages.sort(() => 0.5 - Math.random());

    // 🌟 מחזירים את כל התוצאות (קודם עם תמונות), ללא חיתוך של .slice(0, 20)!
    const finalShuffled = [...withImages, ...withoutImages];
    
    return NextResponse.json(finalShuffled);

  } catch (error) {
    console.error("Suggestions API Error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}