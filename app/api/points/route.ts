import { prisma } from "@/src/lib/prisma";
import cloudinary from "@/src/lib/cloudinary";
import { auth } from "@/src/lib/auth/auth";
import { normalizeSearchTerm } from "@/src/lib/searchUtils";

/**
 * פונקציית עזר לניקוי מילות מפתח לפני שמירה ב-DB
 */
function cleanKeywords(text: string): string {
  return text
    .replace(/[,\.\n]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1)
    .join(" ");
}

/**
 * GET - שליפת נקודות עם חיפוש חכם
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get("q")?.trim();
  const category = searchParams.get("category");

  // מפצלים את שורת החיפוש למילים נפרדות (למשל "kosher food" -> ["kosher", "food"])
  const rawTerms = qRaw ? qRaw.split(/\s+/).filter(t => t.length > 0) : [];

  // מעבירים כל מילה דרך המילון. נקבל מערך של מערכים (למשל: [ ["כשר", "kosher"], ["אוכל", "food"] ])
  const searchGroups = rawTerms.map(t => normalizeSearchTerm(t));

  // פיצול המילים של המשתמש וניקוי תחיליות (ב', ל', ו', ה')
  const searchTerms = qRaw
    ? qRaw.split(/\s+/).filter(t => t.length > 0).map(t => normalizeSearchTerm(t))
    : [];

  const results = await prisma.point.findMany({
    where: {
      ...(category ? { category } : {}),

      // מחפשים נקודות שכל מילות החיפוש מופיעות באחד השדות שלהן
      AND: searchGroups.map(groupOptions => ({
        // בתוך הקבוצה (למשל "אוכל" או "food"), מספיק שאחד מהם יופיע באחד השדות
        OR: groupOptions.map(option => ({
          OR: [
            { name: { contains: option, mode: "insensitive" } },
            { description: { contains: option, mode: "insensitive" } },
            { address: { contains: option, mode: "insensitive" } },
            { extraInfo: { contains: option, mode: "insensitive" } },
          ]
        }))
      }))
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(results);
}

/**
 * POST - יצירת נקודה חדשה עם מילות מפתח נקיות
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const latitude = Number(formData.get("latitude"));
    const longitude = Number(formData.get("longitude"));
    const address = formData.get("address") as string;
    const website = formData.get("website") as string;
    const file = formData.get("image") as File | null;
    const extraInfo = formData.get("extraInfo") as string | null;



    let imageUrl: string | null = null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadResult: any = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: "points" }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }).end(buffer);
      });
      imageUrl = uploadResult.secure_url;
    }

    let finalLatitude = latitude;
    let finalLongitude = longitude;

    // תיקון: בדיקה מחמירה יותר לכתובת
    // אנחנו מניחים שהכתובת היא "משמעותית" רק אם היא ארוכה מ-3 תווים
    const hasAddress = address && address.trim().length > 3;

    if (hasAddress) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
          headers: { "User-Agent": "JSeed/1.0" },
        });
        const results = await response.json();

        // מעדכנים רק אם באמת נמצאה כתובת חדשה
        if (results && results.length > 0 && results[0].lat && results[0].lon) {
          finalLatitude = Number(results[0].lat);
          finalLongitude = Number(results[0].lon);
        }
      } catch (err) {
        console.error("Geocoding failed, keeping original click coordinates", err);
      }
    }

    console.log({
      latitude,
      longitude,
      finalLatitude,
      finalLongitude,
      address,
    });

    // עכשיו finalLatitude ו-finalLongitude תמיד יהיו הערכים הנכונים
    const newPoint = await prisma.point.create({
      data: {
        name,
        category,
        latitude: finalLatitude,
        longitude: finalLongitude,
        description,
        imageUrl,
        address: hasAddress ? address : null, // אם אין כתובת, נשמור NULL ב-DB
        website,
        extraInfo: extraInfo || null,
        userId: session.user.id,
      },
    });

    return Response.json(newPoint);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create point" }, { status: 500 });
  }
}