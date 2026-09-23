import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import AIEngine from "@/src/lib/ai"; 
import cloudinary from "@/src/lib/cloudinary";
import { auth } from "@/src/lib/auth/auth";
import translate from "google-translate-api-x"; 
import { getDictionaryConcepts, cleanTextForMatching } from "@/src/lib/searchUtils";

export const dynamic = 'force-dynamic'; 

const hasHebrew = (str: string) => /[\u0590-\u05FF]/.test(str);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get("q")?.trim() || "";
  const category = searchParams.get("category");

  try {
    const baseWhere: any = category ? { category } : {};

    // 1. אם אין חיפוש, מחזירים הכל רגיל
    if (!qRaw) {
      const results = await prisma.point.findMany({
        where: baseWhere,
        include: { _count: { select: { savedBy: true, viewedBy: true } } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(results);
    }

    // 🌟 התיקון שלנו: חסימת AI ליוזמות (קליק מהתפריט הנגלל)
    // קודם כל בודקים אם השם שהוקלד זהה *בדיוק* לאחת היוזמות בדאטה-בייס
    const exactNameMatches = await prisma.point.findMany({
      where: {
        ...baseWhere,
        name: qRaw
      },
      include: { _count: { select: { savedBy: true, viewedBy: true } } }
    });

    // אם אנחנו בקטגוריית 'חי' (יוזמות) ויש התאמה מדויקת לשם:
    // אנחנו מחזירים *רק* אותה ויוצאים החוצה מיד! ה-AI לא ירוץ בכלל.
    if (category === 'chai' && exactNameMatches.length > 0) {
        return NextResponse.json(exactNameMatches);
    }


    // ====== מכאן והלאה: חיפוש טקסט חופשי (לא לחיצה מהתפריט) ======
    // (פה ה-AI והמילונים ממשיכים לעבוד כרגיל בשביל המשתמשים שמקלידים)
    const extractor = await AIEngine.getInstance();
    const output = await extractor(qRaw.toLowerCase(), { pooling: 'mean', normalize: true });
    const queryEmbeddingArray = Array.from(output.data);
    const embeddingString = `[${queryEmbeddingArray.join(',')}]`;

    const rawPoints = await prisma.$queryRawUnsafe<{ id: number, score: number }[]>(`
      SELECT id, 
             CASE WHEN embedding IS NULL THEN 0 ELSE 1 - (embedding <=> $1::vector) END AS score
      FROM "Point"
      WHERE 1=1
      ${category ? `AND category = '${category}'` : ""}
    `, embeddingString);

    if (rawPoints.length === 0) {
        return NextResponse.json([]);
    }

    const pointIds = rawPoints.map(p => p.id);
    const fullPoints = await prisma.point.findMany({
        where: { id: { in: pointIds } },
        include: { _count: { select: { savedBy: true, viewedBy: true } } }
    });

    const cleanUserQuery = cleanTextForMatching(qRaw);
    let dictionaryConcepts = getDictionaryConcepts(qRaw);

    // חגורת בטיחות למילון זיכרון
    if (qRaw.includes("זכר") || qRaw.includes("זיכרו") || qRaw === "remember" || qRaw === "memory") {
        dictionaryConcepts.push("זכר", "לזכרם", "נר", "נזכור");
    }

    const allTermsToSearch = Array.from(new Set([cleanUserQuery, ...dictionaryConcepts]));

    const searchResults = fullPoints.map(point => {
        let aiScore = rawPoints.find(rp => rp.id === point.id)?.score || 0;
        const rawText = `${point.name} ${point.description || ""} ${point.category}`;
        const cleanPointText = cleanTextForMatching(rawText);

        let isTextMatch = false;

        for (const term of allTermsToSearch) {
            if (term && term.length > 1) {
                if (cleanPointText.includes(term)) {
                    isTextMatch = true;
                    break;
                }
            }
        }

        const finalScore = isTextMatch ? 100 : aiScore;
        return { ...point, totalScore: finalScore };
    });

    const finalResults = searchResults
        .filter(p => p.totalScore >= 0.55) 
        .sort((a, b) => b.totalScore - a.totalScore)
        .map(({ totalScore, ...pointData }) => pointData);
    
    return NextResponse.json(finalResults);

  } catch (error) {
    console.error("GET Points Error:", error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const latitude = Number(formData.get("latitude"));
    const longitude = Number(formData.get("longitude"));
    const address = formData.get("address") as string;
    const website = formData.get("website") as string;

    let final_name_he = name;
    let final_name_en = name;
    let final_desc_he = description;
    let final_desc_en = description;

    try {
      if (name) {
        if (hasHebrew(name)) {
          final_name_en = (await translate(name, { to: 'en' })).text;
        } else {
          final_name_he = (await translate(name, { to: 'he' })).text;
        }
      }

      if (description) {
        if (hasHebrew(description)) {
          final_desc_en = (await translate(description, { to: 'en' })).text;
        } else {
          final_desc_he = (await translate(description, { to: 'he' })).text;
        }
      }
    } catch (translateError) {
      console.error("Translation API limit/error, skipping translation:", translateError);
    }

    const files = formData.getAll("images") as File[];
    let imageUrls: string[] = [];

    if (files && files.length > 0) {
      const uploadPromises = files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadResult: any = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ folder: "points" }, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          }).end(buffer);
        });
        return uploadResult.secure_url;
      });

      imageUrls = await Promise.all(uploadPromises);
    }

    let finalLatitude = latitude;
    let finalLongitude = longitude;
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
        console.error("Geocoding failed", err);
      }
    }

    const newPoint = await prisma.point.create({
      data: {
        name: final_name_he,
        name_en: final_name_en,
        category,
        latitude: finalLatitude,
        longitude: finalLongitude,
        description: final_desc_he,
        description_en: final_desc_en,
        imageUrls,
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
        address: hasAddress ? address : null,
        website,
        userId: session.user.id,
      },
    });

    try {
      const textToAnalyze = `${newPoint.name} ${newPoint.description || ""} ${newPoint.category || ""} ${newPoint.address || ""}`;
      const extractor = await AIEngine.getInstance();
      const output = await extractor(textToAnalyze, { pooling: 'mean', normalize: true });
      const embeddingArray = Array.from(output.data);
      const embeddingString = `[${embeddingArray.join(',')}]`;

      await prisma.$executeRawUnsafe(
        `UPDATE "Point" SET embedding = $1::vector WHERE id = $2`,
        embeddingString, newPoint.id
      );
    } catch (aiError) {
      console.error("AI Embedding Error:", aiError);
    }

    return NextResponse.json(newPoint);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create point" }, { status: 500 });
  }
}