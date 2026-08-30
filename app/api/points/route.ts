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
 * GET - שליפת נקודות עם חיפוש חכם (תומך בצמדי מילים!)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get("q")?.trim();
  const category = searchParams.get("category");

  let searchGroups: string[][] = [];

  if (qRaw) {
    let remainingQuery = qRaw.toLowerCase();

    // 🌟 רשימת צמדי מילים (ביטויים) שאנחנו לא רוצים שהמערכת תפצל בטעות!
    const multiWordPhrases = ["בית כנסת", "בתי כנסת", "בית תפילה"];

    multiWordPhrases.forEach(phrase => {
      if (remainingQuery.includes(phrase)) {
        // אם המשתמש חיפש את הצמד, נכניס אותו בשלמותו למילון ונייצר קבוצת חיפוש
        searchGroups.push(normalizeSearchTerm(phrase));
        // נמחק אותו משורת החיפוש כדי שהמילים לא יפוצלו שוב בהמשך
        remainingQuery = remainingQuery.replace(phrase, " ").trim();
      }
    });

    // 🌟 את מה שנשאר מהחיפוש (המילים הרגילות), נפצל לפי רווחים ונעביר למילון
    const rawTerms = remainingQuery.split(/\s+/).filter(t => t.length > 0);
    rawTerms.forEach(t => {
      searchGroups.push(normalizeSearchTerm(t));
    });
  }

  const results = await prisma.point.findMany({
    where: {
      ...(category ? { category } : {}),

      // מחפשים נקודות שכל מילות החיפוש מופיעות באחד השדות שלהן
      AND: searchGroups.map(groupOptions => ({
        // בתוך הקבוצה (למשל "בתי כנסת" או "synagogue"), מספיק שאחד מהם יופיע באחד השדות
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

    include: {
      _count: {
        select: {
          savedBy: true // סופר כמה אנשים שמרו את הנקודה
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(results);
}

/**
 * POST - יצירת נקודה חדשה עם מילות מפתח נקיות
 */
/**
 * POST - יצירת נקודה חדשה עם תמיכה במספר תמונות
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
    const extraInfo = formData.get("extraInfo") as string | null;

    // 👈 שולפים את כל הקבצים שנשלחו (עד 3)
    const files = formData.getAll("images") as File[];
    let imageUrls: string[] = [];

    // מעלים את כל התמונות ל-Cloudinary במקביל
    if (files && files.length > 0) {
      const uploadPromises = files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadResult: any = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ folder: "points" }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }).end(buffer);
        });
        return uploadResult.secure_url;
      });

      // מחכים שכולן יעלו ומקבלים מערך של לינקים
      imageUrls = await Promise.all(uploadPromises);
    }

    let finalLatitude = latitude;
    let finalLongitude = longitude;

    // גיאוקודינג חכם אם יש כתובת
    const hasAddress = address && address.trim().length > 3;

    if (hasAddress) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
          headers: { "User-Agent": "JSeed/1.0" },
        });
        const results = await response.json();

        if (results && results.length > 0 && results[0].lat && results[0].lon) {
          finalLatitude = Number(results[0].lat);
          finalLongitude = Number(results[0].lon);
        }
      } catch (err) {
        console.error("Geocoding failed, keeping original click coordinates", err);
      }
    }

    const newPoint = await prisma.point.create({
      data: {
        name,
        category,
        latitude: finalLatitude,
        longitude: finalLongitude,
        description,
        
        imageUrls, // 👈 שומרים את כל המערך במסד הנתונים
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : null, // שומרים את התמונה הראשונה גם בשדה הישן לתאימות לאחור
        
        address: hasAddress ? address : null,
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