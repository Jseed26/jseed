import { prisma } from "@/src/lib/prisma";
import AIEngine from "@/src/lib/ai"; 
import { getDictionaryConcepts, cleanTextForMatching } from "@/src/lib/searchUtils";
import cloudinary from "@/src/lib/cloudinary";
import { auth } from "@/src/lib/auth/auth";
import translate from "google-translate-api-x"; 

function containsConcept(text: string, concept: string) {
    if (!concept || concept.length < 2) return false;
    const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[\\s,.\\-!?])([בלוהמכש]{0,3})${escaped}([\\s,.\\-!?]|$)`, 'i');
    return regex.test(text);
}

const hasHebrew = (str: string) => /[\u0590-\u05FF]/.test(str);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get("q")?.trim();
  const category = searchParams.get("category");

  // 🌟 הגדרת חלון הזמן: 36 שעות אחורה
  const thirtySixHoursAgo = new Date(Date.now() - 1 * 60 * 1000);

  try {
    if (!qRaw) {
      const results = await prisma.point.findMany({
        where: { 
            ...(category ? { category } : {}),
            // 🌟 הנה הסינון: תביא את הכל, אבל אם זה chai - רק מה שנוצר ב-36 שעות האחרונות!
            OR: [
                { category: { not: "chai" } },
                { category: "chai", createdAt: { gte: thirtySixHoursAgo } }
            ]
        },
        include: { _count: { select: { savedBy: true } } },
        orderBy: { createdAt: "desc" },
      });
      return Response.json(results);
    }

    const cleanUserQuery = cleanTextForMatching(qRaw);
    const bonusConcepts = getDictionaryConcepts(qRaw);

    let aiQuery = qRaw.toLowerCase();
    const typos: Record<string, string> = { "כנסט": "כנסת", "כנסות": "כנסת", "מקוה": "מקווה", "חבד": "חב\"ד", "ביט": "בית" };
    for (const [bad, good] of Object.entries(typos)) {
        aiQuery = aiQuery.replace(new RegExp(bad, 'g'), good);
    }

    const extractor = await AIEngine.getInstance();
    const output = await extractor(aiQuery, { pooling: 'mean', normalize: true });
    const queryEmbeddingArray = Array.from(output.data);
    const embeddingString = `[${queryEmbeddingArray.join(',')}]`;

    // 🌟 הוספנו את "createdAt" ל-SELECT, והוספנו תנאי SQL לסינון 36 שעות
    let searchResults = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        id, name, name_en, description, description_en, category, "extraInfo", "extraInfo_en", address, website, latitude, longitude, "imageUrl", "imageUrls", "createdAt",
        1 - (embedding <=> $1::vector) AS score
      FROM "Point"
      WHERE embedding IS NOT NULL
      ${category ? `AND category = '${category}'` : ""}
      AND (category != 'chai' OR "createdAt" >= NOW() - INTERVAL '36 hours')
      ORDER BY embedding <=> $1::vector
      LIMIT 100; 
    `, embeddingString);

    searchResults = searchResults.map(point => {
        const rawText = `${point.name} ${point.description || ""} ${point.category} ${point.extraInfo || ""}`;
        const cleanPointText = cleanTextForMatching(rawText);

        let textBoost = 0;
        let foundSynonym = false;

        if (containsConcept(cleanPointText, cleanUserQuery)) {
            textBoost += 0.15; 
        }

        bonusConcepts.forEach(concept => {
            if (concept.length > 2 && concept !== cleanUserQuery) {
                if (containsConcept(cleanPointText, concept)) {
                    foundSynonym = true;
                    textBoost += 0.20; 
                }
            }
        });

        if (foundSynonym) {
            textBoost += 0.25; 
        }

        return { ...point, score: point.score + textBoost };
    });

    const finalResults = searchResults
        .filter(p => p.score >= 0.65) 
        .sort((a, b) => b.score - a.score)
        .map(p => {
            const { score, ...pointData } = p;
            return pointData;
        });
    
    return Response.json(finalResults);

  } catch (error) {
    console.error("GET Points Error:", error);
    return Response.json([]);
  }
}

// ... כאן נשארת פונקציית ה-POST כפי שהיא ...

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

    // =========================================
    // 🌟 תרגום חכם דו-כיווני! (מזהה שפה אוטומטית)
    // =========================================
    let final_name_he = name;
    let final_name_en = name;
    let final_desc_he = description;
    let final_desc_en = description;
    let final_extra_he = extraInfo;
    let final_extra_en = extraInfo;

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

        if (extraInfo) {
            if (hasHebrew(extraInfo)) {
                final_extra_en = (await translate(extraInfo, { to: 'en' })).text;
            } else {
                final_extra_he = (await translate(extraInfo, { to: 'he' })).text;
            }
        }
    } catch (translateError) {
        console.error("Translation API limit/error, skipping translation:", translateError);
    }
    // =========================================

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
        extraInfo: final_extra_he || null,
        extraInfo_en: final_extra_en || null, 
        userId: session.user.id,
      },
    });

    try {
      const textToAnalyze = `${newPoint.name} ${newPoint.description || ""} ${newPoint.category} ${newPoint.extraInfo || ""} ${newPoint.address || ""}`;
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

    return Response.json(newPoint);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create point" }, { status: 500 });
  }
}