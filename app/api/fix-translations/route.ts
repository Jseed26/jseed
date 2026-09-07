import { prisma } from "@/src/lib/prisma";
import translate from "google-translate-api-x";
import { NextResponse } from "next/server";

const hasHebrew = (str: string) => /[\u0590-\u05FF]/.test(str);

// פונקציית עזר להשהייה כדי שגוגל לא יחסום אותנו
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
    try {
        // שולפים את כל הגרעינים ממסד הנתונים
        const allPoints = await prisma.point.findMany();
        let updatedCount = 0;

        for (const point of allPoints) {
            // בודקים אם הגרעין צריך תרגום:
            // אם אין לו name_en, או שה-name_en שלו זהה ל-name (מה שאומר שהוא לא תורגם מעולם)
            if (!point.name_en || point.name === point.name_en) {
                
                let final_name_he = point.name;
                let final_name_en = point.name;
                let final_desc_he = point.description || "";
                let final_desc_en = point.description || "";
                let final_extra_he = point.extraInfo || "";
                let final_extra_en = point.extraInfo || "";

                try {
                    // תרגום חכם לשם
                    if (point.name) {
                        if (hasHebrew(point.name)) {
                            final_name_en = (await translate(point.name, { to: 'en' })).text;
                        } else {
                            final_name_he = (await translate(point.name, { to: 'he' })).text;
                        }
                    }
                    
                    // תרגום חכם לתיאור
                    if (point.description) {
                        if (hasHebrew(point.description)) {
                            final_desc_en = (await translate(point.description, { to: 'en' })).text;
                        } else {
                            final_desc_he = (await translate(point.description, { to: 'he' })).text;
                        }
                    }

                    // תרגום חכם למידע נוסף
                    if (point.extraInfo) {
                        if (hasHebrew(point.extraInfo)) {
                            final_extra_en = (await translate(point.extraInfo, { to: 'en' })).text;
                        } else {
                            final_extra_he = (await translate(point.extraInfo, { to: 'he' })).text;
                        }
                    }

                    // עדכון במסד הנתונים
                    await prisma.point.update({
                        where: { id: point.id },
                        data: {
                            name: final_name_he,
                            name_en: final_name_en,
                            description: final_desc_he,
                            description_en: final_desc_en,
                            extraInfo: final_extra_he,
                            extraInfo_en: final_extra_en,
                        }
                    });

                    updatedCount++;
                    console.log(`✅ Translated: ${final_name_he} | ${final_name_en}`);
                    
                    // ממתינים שנייה וחצי לפני התרגום הבא כדי למנוע חסימה מה-API החינמי
                    await sleep(1500); 

                } catch (err) {
                    console.error(`❌ Failed to translate point ID ${point.id}`, err);
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Successfully translated ${updatedCount} legacy points!` 
        });

    } catch (error) {
        console.error("Migration Error:", error);
        return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
    }
}