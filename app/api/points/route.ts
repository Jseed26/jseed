import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import cloudinary from "@/src/lib/cloudinary";
import { auth } from "@/src/lib/auth/auth";
import translate from "google-translate-api-x";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

const hasHebrew = (str: string) => /[\u0590-\u05FF]/.test(str);

// ==========================================
// 🌟 סוכן ההעשרה של JSeed
// ==========================================
async function enrichPointWithAI(point: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.8-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const isInitiative = point.category === "chai";

    const prompt = `
      You are an AI assistant for a Jewish mapping app called JSeed.
      Analyze the following location/initiative and output a strict JSON object with metadata.
      
      Name: "${point.name}"
      Description: "${point.description || 'No description'}"
      Category: "${point.category}"
      Address: "${point.address || 'No address'}"
      Coordinates: ${point.latitude}, ${point.longitude}

      ${isInitiative
        ? `This is a community initiative. Extract logical Hebrew search keywords and target audience based on Name and Description.`
        : `This is a physical place or business. Determine its opening hours, whether it is kosher, open on Shabbat, and child-friendly.`}

      Return strictly this JSON format:
      {
        "keywords": ["keyword1", "keyword2", "keyword3"],
        "openingHours": "string or null",
        "isOpenOnShabbat": true/false/null,
        "isKosher": "string or true/false/null",
        "childFriendly": true/false/null,
        "environment": "indoor" | "outdoor" | "nature" | "urban" | null,
        "targetAudience": ["families", "couples", "groups", "solo"]
      }
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const aiMetadata = JSON.parse(result.response.text());

    await prisma.point.update({
      where: { id: point.id },
      data: { aiMetadata: aiMetadata }
    });

    return aiMetadata;
  } catch (error) {
    console.error("AI Enrichment Failed:", error);
    return null;
  }
}

// ==========================================
// 🌟 מנוע החיפוש המקומי המהיר
// ==========================================
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
      const exactChai = allPoints.filter(p => p.name.trim() === qRaw);
      if (exactChai.length > 0) return NextResponse.json(exactChai);
    }

    const queryLower = qRaw.toLowerCase();
    
    const asksForShabbat = queryLower.includes("שבת") || queryLower.includes("פתוח");
    const asksForKids = queryLower.includes("ילדים") || queryLower.includes("משפחה") || queryLower.includes("טיול") || queryLower.includes("לטייל");
    const asksForIsrael = queryLower.includes("בישראל") || queryLower.includes("בארץ");
    const isMemorialQuery = queryLower.includes("זכר") || queryLower.includes("הנצחה") || queryLower.includes("זיכרון") || queryLower.includes("נר");

    const stopWords = ["איפה", "אפשר", "אני", "היכן", "להיות", "ללכת", "לטייל", "באיזה", "מה", "עם", "ב", "ל", "ה", "של", "את", "בישראל", "ישראל", "בארץ", "מקומות", "מקום", "פתוחים", "פתוח"];
    
    const queryWords = queryLower
      .split(/\s+/)
      .map(w => w.replace(/^(ב|ל|ו|ה|מ|כ|שה)/, ""))
      .filter(w => w.length > 1 && !stopWords.includes(w));

    const filteredPoints = allPoints.filter(point => {
      const meta = (point.aiMetadata as any) || {};
      const pointText = `${point.name} ${point.name_en || ""} ${point.description || ""} ${point.address || ""} ${(meta.keywords || []).join(" ")}`.toLowerCase();

      if (asksForIsrael) {
        const isInIsrael = point.latitude >= 29.4 && point.latitude <= 33.4 && point.longitude >= 34.1 && point.longitude <= 35.9;
        if (!isInIsrael) return false;
      }

      if ((asksForKids || asksForShabbat || queryWords.length > 0) && !isMemorialQuery) {
        if (point.name.includes("נר לזכרם") || point.description?.includes("נר לזכרם")) {
          return false;
        }
      }

      if (asksForShabbat) {
        if (meta.isOpenOnShabbat === true) return true;
        if (meta.isOpenOnShabbat === false) return false;
      }

      if (asksForKids) {
        if (meta.childFriendly === true) return true;
        if (meta.childFriendly === false) return false;
      }

      if (queryWords.length === 0) {
        return asksForKids || asksForShabbat;
      }

      const matchesKeyword = queryWords.some(word => pointText.includes(word));
      const matchesFullName = pointText.includes(queryLower);

      return matchesKeyword || matchesFullName;
    });

    return NextResponse.json(filteredPoints);

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
      console.error("Translation error:", translateError);
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
        parentId: parentId,
      },
    });

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

    // 🌟 התיקון הקריטי: מזהים אם המיקום סומן במפורש מהמפה!
    if (reqLat && reqLat !== "null" && reqLat !== "undefined") {
        latitude = Number(reqLat);
        isMapPicked = true;
    }
    if (reqLng && reqLng !== "null" && reqLng !== "undefined") {
        longitude = Number(reqLng);
        isMapPicked = true;
    }

    // 🌟 אם סומן מהמפה, בחיים לא נריץ המרת כתובת (Geocode) כדי למנוע דריסה!
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