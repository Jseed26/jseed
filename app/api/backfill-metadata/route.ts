import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prisma } from "@prisma/client"; 

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. שולפים רק 3 נקודות בכל פעם כדי לא לעבור את מגבלת ה-5 בקשות לדקה של גוגל
    const pointsToUpdate = await prisma.point.findMany({
      where: {
        aiMetadata: { equals: Prisma.DbNull } 
      },
      take: 3, 
    });

    if (pointsToUpdate.length === 0) {
      return NextResponse.json({ message: "🎉 All points are already enriched! No more work needed." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No GEMINI_API_KEY found in .env" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.8-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    let successCount = 0;
    const errors = [];

    for (const point of pointsToUpdate) {
      try {
        const isInitiative = point.category === "chai";
        
        const prompt = `
          You are an AI assistant for a Jewish mapping app called JSeed.
          Your job is to analyze the following location/initiative and output a strict JSON object with metadata.
          
          Name: "${point.name}"
          Description: "${point.description || 'No description'}"
          Category: "${point.category}"
          Address: "${point.address || 'No address'}"

          ${isInitiative 
            ? `This is a local community initiative. DO NOT search the internet. Just read the Name and Description, and extract logical search keywords (in Hebrew) and target audience.` 
            : `This is a physical place or business. Find its real opening hours, phone number, and whether it is kosher or open on Shabbat.`}

          Return exactly this JSON format (no markdown, no extra text):
          {
            "keywords": ["keyword1", "keyword2", "keyword3"],
            "openingHours": "string or null",
            "isOpenOnShabbat": true/false/null,
            "isKosher": "string with kashrut type or true/false/null",
            "childFriendly": true/false/null,
            "environment": "indoor" | "outdoor" | "nature" | "urban" | null,
            "targetAudience": ["families", "couples", "groups", "solo"]
          }
        `;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const responseText = result.response.text();
        const aiMetadata = JSON.parse(responseText);

        await prisma.point.update({
            where: { id: point.id },
            data: { aiMetadata: aiMetadata }
        });

        successCount++;
        
        // 🌟 השהיה של 12 שניות שלמות בין נקודה לנקודה כדי להישאר בבטחה מתחת למכסה (5 לדקה)
        await new Promise(resolve => setTimeout(resolve, 12000));

      } catch (err: any) {
        console.error(`Failed to enrich point ID ${point.id}:`, err.message);
        errors.push({ id: point.id, error: err.message });
      }
    }

    return NextResponse.json({ 
        message: `Successfully enriched ${successCount} points. Refresh this page to do the next batch.`,
        remainingErrors: errors 
    });

  } catch (error: any) {
    console.error("Backfill Script Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}