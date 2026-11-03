import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export const dynamic = 'force-dynamic';

// פונקציה לחישוב מרחק אווירי (Haversine formula) בקילומטרים
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // רדיוס כדור הארץ בק"מ
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    
    // קבלת מיקום המשתמש (אם אישר מיקום בדפדפן)
    const userLat = searchParams.get("lat");
    const userLng = searchParams.get("lng");

    // כל הנקודות במאגר
    const allPoints = await prisma.point.findMany({
      include: { _count: { select: { savedBy: true, viewedBy: true } } },
    });

    let suggestedPoints = [];

    // אם המשתמש מחובר, נבנה לו פרופיל העדפות
    if (session?.user?.id) {
      const userId = session.user.id;

      // משיכת הנקודות שהמשתמש שמר וראה
      const savedPoints = await prisma.savedPoint.findMany({ where: { userId }, include: { point: true } });
      const viewedPoints = await prisma.viewedPoint.findMany({ where: { userId }, include: { point: true } });

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

      // אם אין לו היסטוריה או שאין נקודות חדשות בקטגוריות שלו, פשוט ניקח נקודות שהוא לא ראה
      if (suggestedPoints.length === 0) {
        suggestedPoints = allPoints.filter(p => !interactedIds.has(p.id));
      }
    } else {
      // משתמש לא מחובר - פשוט נציע לו נקודות אקראיות / חדשות
      suggestedPoints = [...allPoints];
    }

    // אם יש לנו את המיקום של המשתמש, נחשב מרחק לכל נקודה ונמיין מהקרוב לרחוק!
    if (userLat && userLng) {
      const lat = parseFloat(userLat);
      const lng = parseFloat(userLng);

      const pointsWithDistance = suggestedPoints.map(p => ({
        ...p,
        distanceKm: getDistanceFromLatLonInKm(lat, lng, p.latitude, p.longitude)
      }));

      // מיון מהקרוב לרחוק (לוקחים את ה-15 הכי קרובים ורלוונטיים)
      const sortedByDistance = pointsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 15);
      return NextResponse.json(sortedByDistance);
    }

    // אם אין מיקום, פשוט נחזיר 15 נקודות רלוונטיות מעורבבות (בלי מרחק)
    const shuffled = suggestedPoints.sort(() => 0.5 - Math.random()).slice(0, 15);
    return NextResponse.json(shuffled);

  } catch (error) {
    console.error("Suggestions API Error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}