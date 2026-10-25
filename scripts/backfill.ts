import { PrismaClient, Prisma } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

// טעינת משתני הסביבה מהקובץ המקומי
dotenv.config({ path: ".env" }); // אם הקובץ שלך נקרא .env.local, שני את זה כאן

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({
  model: "gemini-3.8-flash",
  generationConfig: { responseMimeType: "application/json" },
});

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function main() {
  console.log("🚀 Starting background backfill process...");

  // שולפים את כל הנקודות שחסר להן מידע (ללא הגבלת take)
  const points = await prisma.point.findMany({
    where: { aiMetadata: { equals: Prisma.DbNull } }, 
  });

  if (points.length === 0) {
    console.log("🎉 All points are already enriched!");
    return;
  }

  console.log(`Found ${points.length} points to process. Let's go!`);

  let successCount = 0;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    console.log(`\n[${i + 1}/${points.length}] Processing point ID ${point.id}: "${point.name}"...`);

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

      Return exactly this JSON format:
      {
        "keywords": ["keyword1", "keyword2"],
        "openingHours": "string or null",
        "isOpenOnShabbat": true/false/null,
        "isKosher": "string or null",
        "childFriendly": true/false/null,
        "environment": "indoor" | "outdoor" | null,
        "targetAudience": ["families", "solo"]
      }
    `;

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = result.response.text();
      const aiMetadata = JSON.parse(responseText);

      await prisma.point.update({
        where: { id: point.id },
        data: { aiMetadata: aiMetadata },
      });

      successCount++;
      console.log(`✅ Success!`);
      
      // השהיה קצרה כדי לא לחסום את ה-API של גוגל
      await delay(1500);
    } catch (error: any) {
      console.error(`❌ Failed:`, error.message);
      // אם יש עומס, מחכים קצת יותר לפני שממשיכים לנקודה הבאה
      if (error.message.includes("503") || error.message.includes("429")) {
        console.log("⏳ Server busy, waiting 5 seconds...");
        await delay(5000);
      }
    }
  }

  console.log(`\n🎯 Finished! Successfully updated ${successCount}/${points.length} points.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });