import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import cloudinary from "@/src/lib/cloudinary";
import { auth } from "@/src/lib/auth/auth";
import translate from "google-translate-api-x";

export const dynamic = 'force-dynamic';

const hasHebrew = (str: string) => /[\u0590-\u05FF]/.test(str);

let cachedFlashModels: string[] | null = null;

async function getAvailableFlashModels(apiKey: string): Promise<string[]> {
  if (cachedFlashModels && cachedFlashModels.length > 0) return cachedFlashModels;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) return ["gemini-3.8-flash"];
    const data = await res.json();
    const models: string[] = (data.models || [])
      .filter((m: any) =>
        m.supportedGenerationMethods?.includes("generateContent") &&
        m.name?.includes("flash") &&
        !m.name?.includes("image") &&
        !m.name?.includes("tts") &&
        !m.name?.includes("audio") &&
        !m.name?.includes("thinking")
      )
      .map((m: any) => m.name.replace("models/", ""));

    models.sort((a, b) => {
      if (a.includes("lite") && !b.includes("lite")) return -1;
      if (!a.includes("lite") && b.includes("lite")) return 1;
      if (a === "gemini-3.8-flash") return -1;
      if (b === "gemini-3.8-flash") return 1;
      return 0;
    });

    cachedFlashModels = models.length > 0 ? models : ["gemini-3.8-flash"];
    return cachedFlashModels;
  } catch {
    return ["gemini-3.8-flash"];
  }
}

async function safeTranslate(text: string, to: "en" | "he"): Promise<string> {
  if (!text || !text.trim()) return text;
  try {
    const res: any = await Promise.race([
      translate(text, { to }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Translate timeout")), 2500))
    ]);
    return res?.text || text;
  } catch {
    return text;
  }
}

async function enrichPointWithAI(point: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const isInitiative = point.category === "chai";
    const prompt = `
      Analyze this location for JSeed and output a strict JSON object:
      Name: "${point.name}"
      Name (EN): "${point.name_en || ''}"
      Description: "${point.description || 'No description'}"
      Category: "${point.category}"
      Address: "${point.address || 'No address'}"

      ${isInitiative
        ? `Extract 5-8 logical search keywords in BOTH Hebrew and English and target audience.`
        : `Extract 5-8 search keywords in BOTH Hebrew and English, and determine opening hours, kosher, open on Shabbat, child-friendly.`}

      Return strictly this JSON format (no markdown, no backticks):
      {
        "keywords": ["מילה1", "מילה2", "keyword1", "keyword2"],
        "openingHours": "string or null",
        "isOpenOnShabbat": true/false/null,
        "isKosher": "string or true/false/null",
        "childFriendly": true/false/null,
        "environment": "indoor" | "outdoor" | "nature" | "urban" | null,
        "targetAudience": ["families", "couples", "groups", "solo"]
      }
    `;

    const modelsToTry = await getAvailableFlashModels(apiKey);

    for (const modelName of modelsToTry.slice(0, 3)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
            }),
          }
        );

        clearTimeout(timeout);
        if (!response.ok) continue;

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!rawText) continue;

        const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const aiMetadata = JSON.parse(cleanJson);

        await prisma.point.update({
          where: { id: point.id },
          data: { aiMetadata }
        });

        return aiMetadata;
      } catch {
        clearTimeout(timeout);
      }
    }
    return null;
  } catch (error) {
    console.error("AI Enrichment Failed:", error);
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get("q")?.trim() || "";
  const category = searchParams.get("category");

  try {
    const baseWhere: any = category ? { category } : {};

    const allPoints = await prisma.point.findMany({
      where: baseWhere,
      include: { _count: { select: { savedBy: true, viewedBy: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (!qRaw) {
      return NextResponse.json(allPoints);
    }

    if (category === "chai") {
      const exactChai = allPoints.filter(p => p.name.trim().toLowerCase() === qRaw.toLowerCase());
      if (exactChai.length > 0) return NextResponse.json(exactChai);
    }

    const queryLower = qRaw.toLowerCase();

    const categoryAliases: Record<string, string[]> = {
      leaf: ["קהילה", "community", "בית כנסת", "synagogue", "חבד", "חב\"ד", "chabad", "מרכז יהודי"],
      star: ["רוח", "spirit", "קבר", "צדיק", "אוהל", "תפילה", "מקווה", "לימוד", "ישיבה"],
      triangle: ["מורשת", "legacy", "מוזיאון", "museum", "אנדרטה", "הנצחה", "זיכרון", "שואה", "היסטוריה", "memorial"],
      circle: ["עסקים", "business", "מסעדה", "אוכל", "כשר", "kosher", "קפה", "מאפייה", "חנות", "מלון", "restaurant", "food"],
      chai: ["יוזמות", "initiatives", "התנדבות", "עזרה", "מפגש", "אירוע", "פרויקט"]
    };

    const asksForShabbat = queryLower.includes("שבת") || queryLower.includes("shabbat");
    const asksForKids = queryLower.includes("ילדים") || queryLower.includes("משפחה") || queryLower.includes("משפחות") || queryLower.includes("kids") || queryLower.includes("family");
    const asksForKosher = queryLower.includes("כשר") || queryLower.includes("מהדרין") || queryLower.includes("kosher");
    const asksForIsrael = queryLower.includes("בישראל") || queryLower.includes("בארץ") || queryLower.includes("ישראל") || queryLower.includes("israel");
    const isMemorialQuery = queryLower.includes("זכר") || queryLower.includes("הנצחה") || queryLower.includes("זיכרון") || queryLower.includes("נר") || queryLower.includes("memorial");

    const stopWords = ["איפה", "אפשר", "אני", "היכן", "להיות", "ללכת", "לטייל", "באיזה", "מה", "עם", "ב", "ל", "ה", "של", "את", "בישראל", "בארץ", "מקומות", "מקום", "פתוחים", "פתוח", "יש", "למצוא", "מחפש", "מחפשת", "in", "at", "the", "for", "near"];

    const rawWords = queryLower
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.includes(w));

    const strippedWords = rawWords.map(w => w.length > 3 ? w.replace(/^(ב|ל|ו|ה|מ|כ|שה)/, "") : w);

    const scoredPoints = allPoints
      .map(point => {
        const meta = (point.aiMetadata as any) || {};
        const keywordsStr = Array.isArray(meta.keywords) ? meta.keywords.join(" ") : "";
        const audienceStr = Array.isArray(meta.targetAudience) ? meta.targetAudience.join(" ") : "";
        const catKeywords = (categoryAliases[point.category] || []).join(" ");

        const searchableText = [
          point.name,
          point.name_en,
          point.description,
          point.description_en,
          point.address,
          keywordsStr,
          audienceStr,
          meta.environment || "",
          meta.isKosher ? "כשר kosher" : "",
          catKeywords
        ].filter(Boolean).join(" ").toLowerCase();

        if (asksForIsrael) {
          const isInIsrael = point.latitude >= 29.4 && point.latitude <= 33.4 && point.longitude >= 34.1 && point.longitude <= 35.9;
          if (!isInIsrael) return { point, score: 0 };
        }

        if ((asksForKids || asksForShabbat || rawWords.length > 0) && !isMemorialQuery) {
          if (point.name.includes("נר לזכרם") || point.description?.includes("נר לזכרם")) {
            return { point, score: 0 };
          }
        }

        if (asksForShabbat && meta.isOpenOnShabbat === false) {
          return { point, score: 0 };
        }

        let score = 0;

        if ((point.name || "").toLowerCase().includes(queryLower) || (point.name_en || "").toLowerCase().includes(queryLower)) {
          score += 50;
        } else if (searchableText.includes(queryLower)) {
          score += 30;
        }

        if (asksForShabbat && (meta.isOpenOnShabbat === true || searchableText.includes("שבת") || point.category === "leaf" || point.category === "star")) {
          score += 15;
        }
        if (asksForKids && (meta.childFriendly === true || audienceStr.includes("families") || searchableText.includes("ילדים") || searchableText.includes("משפח"))) {
          score += 15;
        }
        if (asksForKosher && (meta.isKosher === true || typeof meta.isKosher === "string" || searchableText.includes("כשר") || searchableText.includes("kosher"))) {
          score += 15;
        }

        for (let i = 0; i < rawWords.length; i++) {
          const rawW = rawWords[i];
          const cleanW = strippedWords[i] || rawW;

          if ((point.name || "").toLowerCase().includes(rawW) || (point.name_en || "").toLowerCase().includes(rawW)) {
            score += 20;
          } else if (searchableText.includes(rawW)) {
            score += 10;
          } else if (cleanW.length >= 2 && searchableText.includes(cleanW)) {
            score += 8;
          }
        }

        return { point, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.point);

    return NextResponse.json(scoredPoints);

  } catch (error) {
    console.error("Search Error:", error);
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

    const parentIdStr = formData.get("parentId") as string;
    const parentId = parentIdStr && parentIdStr !== "null" ? parseInt(parentIdStr) : null;

    let final_name_he = name;
    let final_name_en = name;
    let final_desc_he = description;
    let final_desc_en = description;

    const [translatedName, translatedDesc] = await Promise.all([
      name ? safeTranslate(name, hasHebrew(name) ? "en" : "he") : Promise.resolve(name),
      description ? safeTranslate(description, hasHebrew(description) ? "en" : "he") : Promise.resolve(description)
    ]);

    if (name) {
      if (hasHebrew(name)) final_name_en = translatedName;
      else final_name_he = translatedName;
    }
    if (description) {
      if (hasHebrew(description)) final_desc_en = translatedDesc;
      else final_desc_he = translatedDesc;
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

    if (hasAddress && (!finalLatitude || !finalLongitude)) {
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
        parentId: parentId,
      },
    });

    // 🌟 🌟 🌟 מנגנון שליחת התראות לכל משתתפי היוזמה (בקטגוריה chai) 🌟 🌟 🌟
    if (category === "chai") {
      try {
        // נמצא את כל הנקודות ששייכות לאותה יוזמה (לפי parentId או לפי שם זהה)
        const relatedPoints = await prisma.point.findMany({
          where: {
            category: "chai",
            OR: [
              ...(parentId ? [{ id: parentId }, { parentId: parentId }] : []),
              { name: { equals: name, mode: "insensitive" } }
            ]
          },
          select: { userId: true }
        });

        // נאסוף את כל ה-userId הייחודיים של מי שהשתתף ביוזמה
        const participantUserIds = new Set<string>();
        relatedPoints.forEach(p => {
          if (p.userId) participantUserIds.add(p.userId);
        });

        // נוסיף גם את היוצר המקורי של יוזמת האב אם קיים
        if (parentId) {
          const parentPoint = await prisma.point.findUnique({
            where: { id: parentId },
            select: { userId: true }
          });
          if (parentPoint?.userId) participantUserIds.add(parentPoint.userId);
        }

        // ניצור התראה לכל מי שמשתתף ביוזמה, חוץ מהמשתמש הנוכחי שהוסיף את הנקודה
        const notificationsData = [];
        for (const uid of participantUserIds) {
          if (uid !== session.user.id) {
            notificationsData.push({
              userId: uid,
              message: `מישהו נוסף הצטרף ליוזמה "${name}"! 🌱`,
              isRead: false
            });
          }
        }

        if (notificationsData.length > 0) {
          await prisma.notification.createMany({
            data: notificationsData
          });
        }
      } catch (notifErr) {
        console.error("Failed to send initiative notifications:", notifErr);
      }
    }

    enrichPointWithAI(newPoint).catch(console.error);

    return NextResponse.json(newPoint);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create point" }, { status: 500 });
  }
}

async function geocodeAddress(address: string) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "jseed-app" } }
    );
    const data = await res.json();
    if (data?.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (e) {
    console.error("Geocode error:", e);
    return null;
  }
}

export async function PUT(req: Request, context: any) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const pointId = Number(id);

    const formData = await req.formData();
    const name = (formData.get("name") as string) || "";
    const description = (formData.get("description") as string) || "";
    const category = (formData.get("category") as string) || "";
    const address = (formData.get("address") as string) || "";
    const website = (formData.get("website") as string) || "";

    const existing = await prisma.point.findFirst({
      where: { id: pointId, userId: session.user.id },
    });

    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const reqLat = formData.get("latitude");
    const reqLng = formData.get("longitude");

    let latitude = existing.latitude;
    let longitude = existing.longitude;
    let isMapPicked = false;

    if (reqLat && reqLat !== "null" && reqLat !== "undefined") {
        latitude = Number(reqLat);
        isMapPicked = true;
    }
    if (reqLng && reqLng !== "null" && reqLng !== "undefined") {
        longitude = Number(reqLng);
        isMapPicked = true;
    }

    if (address && address !== existing.address && address !== "" && !isMapPicked) {
      const geo = await geocodeAddress(address);
      if (geo) {
        latitude = geo.lat;
        longitude = geo.lng;
      }
    }

    const updated = await prisma.point.update({
      where: { id: pointId },
      data: {
        name, description, category, address, website, latitude, longitude,
      },
    });

    enrichPointWithAI(updated).catch(console.error);

    return Response.json(updated);
  } catch (error) {
    console.error("PUT Error:", error);
    return Response.json({ error: "Failed to update point" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: any) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const pointId = Number(id);

  const existing = await prisma.point.findFirst({
    where: { id: pointId, userId: session.user.id },
  });

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.point.delete({ where: { id: pointId } });
  return Response.json({ success: true });
}