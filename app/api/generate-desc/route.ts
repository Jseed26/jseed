import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, keywords, lang, category } = body;
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // חוזרים למודל המעודכן שלך שעובד!
        const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" }); 
        
        const prompt = `
            You are a professional content writer for a mapping application.
            Your task is to write a short, engaging description for a place, business, or initiative.
            
            Name of the place: "${name}"
            Keywords / User Draft: "${keywords}"
            Category: "${category}"

            Instructions:
            1. Write the description in ${lang === 'he' ? 'Hebrew' : 'English'}.
            2. Keep it short and engaging (maximum 2 to 3 sentences).
            3. Use the user's keywords to build the sentence. If it's a famous or known place, use your knowledge to describe it accurately.
            4. Do NOT use markdown (no asterisks, no bolding). Just plain text.
            5. Output ONLY the description text, nothing else.
        `;

        try {
            const result = await model.generateContent(prompt);
            return NextResponse.json({ description: result.response.text().trim() });
        } catch (aiError: any) {
            // אם גוגל עמוסים כרגע (503) מחזירים שגיאה מסודרת שתקפוץ ללקוח
            if (aiError.message?.includes("503") || aiError.message?.includes("overloaded")) {
                return NextResponse.json(
                    { error: "busy", message: "השרתים של ה-AI קצת עמוסים כרגע, אנא נסה שוב בעוד מספר שניות." }, 
                    { status: 503 }
                );
            }
            throw aiError; // אם זו שגיאה אחרת, נזרוק אותה החוצה
        }

    } catch (error) {
        console.error("AI Generate Error:", error);
        return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
    }
}