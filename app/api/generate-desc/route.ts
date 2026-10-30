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

        // רשימת המודלים שלנו (לפי סדר עדיפות)
        const modelsToTry = ["gemini-3.8-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`Trying model: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName }); 
                const result = await model.generateContent(prompt);
                const text = result.response.text().trim();
                
                // אם הגענו לכאן, המודל הצליח! נחזיר את התשובה ונסיים את הפונקציה.
                console.log(`Success with model: ${modelName}`);
                return NextResponse.json({ description: text });
                
            } catch (err: any) {
                console.warn(`Model ${modelName} failed. Error: ${err.message?.substring(0, 50)}...`);
                lastError = err; // שומרים את השגיאה ועוברים למודל הבא בלולאה
            }
        }

        // אם הגענו לפה, זה אומר ש*כל* המודלים נכשלו. נחזיר שגיאה ללקוח.
        console.error("All models failed. Last error:", lastError);
        return NextResponse.json(
            { error: "busy", message: "כל השרתים עמוסים כרגע, נסה שוב." }, 
            { status: 503 }
        );

    } catch (error: any) {
        console.error("AI Generate Fatal Error:", error);
        return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
    }
}