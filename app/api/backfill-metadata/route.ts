import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prisma } from "@prisma/client"; 

export const dynamic = 'force-dynamic';

// פונקציית עזר להשהיה
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function GET() {
  try {
    // עכשיו ניקח 5 נקודות בכל פעם כדי לחסוך רענונים
    const pointsToUpdate = await prisma.point.findMany({
      where: {
        aiMetadata: { equals: Prisma.DbNull } 
      },
      take: 5, 
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
      console.log(`⏳ Processing point ID ${point.id}: "${point.name}"...`);
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

      let success = false;
      let retries = 3; // ננסה עד 3 פעמים לכל נקודה במקרה של עומס

      while (retries > 0 && !success) {
        try {
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
          success = true;
          console.log(`✅ Successfully enriched point ID ${point.id}!`);
          
          // נמתין שנייה אחת בין נקודה לנקודה כדי למנוע יצירת עומס בעצמנו
          await delay(1000);

        } catch (err: any) {
          if (err.message.includes("503") || err.message.includes("429")) {
            retries--;
            console.log(`⚠️ Server busy (503). Retrying point ${point.id}... (${retries} attempts left)`);
            await delay(3000); // נמתין 3 שניות ונסה שוב
          } else {
            console.error(`❌ Failed to enrich point ID ${point.id}:`, err.message);
            errors.push({ id: point.id, error: err.message });
            break; // שגיאה אחרת שאינה עומס - עוצרים את הניסיונות לנקודה זו
          }
        }
      }

      if (!success && retries === 0) {
         errors.push({ id: point.id, error: "Failed after 3 retries due to server overload." });
      }
    }

    return NextResponse.json({ 
        message: `Successfully enriched ${successCount} point(s) in this batch. Refresh this page to do the next batch!`,
        remainingErrors: errors 
    });

  } catch (error: any) {
    console.error("Backfill Script Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}