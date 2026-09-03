// import { NextResponse } from "next/server";
// import { prisma } from "@/src/lib/prisma";
// import AIEngine from "@/src/lib/ai";

// export async function GET() {
//   try {
//     // 1. שולפים ישירות מ-Neon את כל הנקודות שאין להן עדיין טביעת משמעות
//     const pointsWithoutEmbeddings = await prisma.$queryRawUnsafe<any[]>(`
//       SELECT id, name, description, category, "extraInfo", address
//       FROM "Point"
//       WHERE embedding IS NULL
//     `);

//     if (pointsWithoutEmbeddings.length === 0) {
//       return NextResponse.json({ message: "איזה יופי! לכל הנקודות במפה כבר יש טביעת משמעות." });
//     }

//     console.log(`⏳ מתחיל סנכרון של ${pointsWithoutEmbeddings.length} נקודות ישנות...`);
    
//     // מעלים את ה-AI לזיכרון פעם אחת בשביל התהליך
//     const extractor = await AIEngine.getInstance();
//     let updatedCount = 0;

//     // 2. עוברים נקודה-נקודה, מייצרים לה וקטור ושומרים
//     for (const point of pointsWithoutEmbeddings) {
//       const textToAnalyze = `${point.name} ${point.description || ""} ${point.category} ${point.extraInfo || ""} ${point.address || ""}`;
      
//       const output = await extractor(textToAnalyze, { pooling: 'mean', normalize: true });
//       const embeddingArray = Array.from(output.data);
//       const embeddingString = `[${embeddingArray.join(',')}]`;

//       await prisma.$executeRawUnsafe(
//           `UPDATE "Point" SET embedding = $1::vector WHERE id = $2`,
//           embeddingString,
//           point.id
//       );
      
//       updatedCount++;
//       console.log(`✅ עודכן (${updatedCount}/${pointsWithoutEmbeddings.length}): ${point.name}`);
//     }

//     return NextResponse.json({ 
//         message: "הסנכרון הסתיים בהצלחה! 🎉",
//         updatedPoints: updatedCount
//     });

//   } catch (error) {
//     console.error("Sync Error:", error);
//     return NextResponse.json({ error: "שגיאה במהלך הסנכרון" }, { status: 500 });
//   }
// }