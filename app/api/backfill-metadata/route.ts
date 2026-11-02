import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = 'force-dynamic';

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

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No GEMINI_API_KEY found in .env" }, { status: 500 });
    }

    // שולפים 8 נקודות שאין להן עדיין מטא-דאטה
    const pointsToUpdate = await prisma.point.findMany({
      where: {
        OR: [
          { aiMetadata: { equals: Prisma.DbNull } },
          { aiMetadata: { equals: Prisma.JsonNull } }
        ]
      },
      take: 8,
    });

    if (pointsToUpdate.length === 0) {
      return NextResponse.json({ message: "🎉 כל הנקודות במאגר כבר מועשרות ומעודכנות!" });
    }

    const modelsToTry = await getAvailableFlashModels(apiKey);

    // אורזים את כל הנקודות לבקשה אחת מרוכזת כדי לא לחרוג ממכסת ה-Free Tier!
    const pointsPayload = pointsToUpdate.map(p => ({
      id: p.id,
      name: p.name,
      name_en: p.name_en || "",
      category: p.category,
      description: p.description || "",
      address: p.address || ""
    }));

    const prompt = `
      You are an AI assistant for a Jewish mapping app called JSeed.
      Analyze the following array of locations/initiatives and return a JSON array where each item has the "id" and its "metadata".
      For each item, include 5-8 logical search keywords in BOTH Hebrew and English (synonyms, type of place, city, kosher/restaurant/synagogue/monument terms).

      Input locations:
      ${JSON.stringify(pointsPayload)}

      Return strictly a JSON array in this exact format (no markdown, no backticks):
      [
        {
          "id": 123,
          "metadata": {
            "keywords": ["מילה1", "מילה2", "keyword1", "keyword2"],
            "openingHours": "string or null",
            "isOpenOnShabbat": true,
            "isKosher": true,
            "childFriendly": true,
            "environment": "indoor",
            "targetAudience": ["families", "couples", "groups", "solo"]
          }
        }
      ]
    `;

    let batchResults: any[] | null = null;

    for (const modelName of modelsToTry.slice(0, 3)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20 שניות לכל הקבוצה יחד

      try {
        console.log(`⚡ Enriching batch of ${pointsToUpdate.length} points using ${modelName}...`);
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
        if (!response.ok) {
          console.warn(`⚠️ Model ${modelName} returned ${response.status}, trying next...`);
          continue;
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!rawText) continue;

        const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        batchResults = JSON.parse(cleanJson);
        if (Array.isArray(batchResults)) break;
      } catch (err: any) {
        clearTimeout(timeout);
        console.warn(`⚠️ Batch failed on ${modelName}:`, err.message);
      }
    }

    if (!batchResults || !Array.isArray(batchResults)) {
      return NextResponse.json(
        { error: "All models busy, wait 10 seconds and refresh." },
        { status: 503 }
      );
    }

    let successCount = 0;
    for (const item of batchResults) {
      if (item?.id && item?.metadata) {
        await prisma.point.update({
          where: { id: Number(item.id) },
          data: { aiMetadata: item.metadata }
        });
        successCount++;
        console.log(`✅ Enriched point ID ${item.id}!`);
      }
    }

    const remainingCount = await prisma.point.count({
      where: {
        OR: [
          { aiMetadata: { equals: Prisma.DbNull } },
          { aiMetadata: { equals: Prisma.JsonNull } }
        ]
      }
    });

    return NextResponse.json({
      message: `🎉 עודכנו ${successCount} נקודות בקריאה אחת!`,
      remainingPointsToEnrich: remainingCount
    });

  } catch (error: any) {
    console.error("Backfill Script Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}