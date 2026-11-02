import { NextResponse } from "next/server";

// שמירת רשימת המודלים בזיכרון השרת כדי לא לשאול את גוגל בכל לחיצה
let cachedFlashModels: string[] | null = null;

async function getAvailableFlashModels(apiKey: string): Promise<string[]> {
    if (cachedFlashModels && cachedFlashModels.length > 0) {
        return cachedFlashModels;
    }

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

        // מעדיפים מודלים קלים ומהירים (lite) או 3.8-flash
        models.sort((a, b) => {
            if (a.includes("lite") && !b.includes("lite")) return -1;
            if (!a.includes("lite") && b.includes("lite")) return 1;
            if (a === "gemini-3.8-flash") return -1;
            if (b === "gemini-3.8-flash") return 1;
            return 0;
        });

        cachedFlashModels = models.length > 0 ? models : ["gemini-3.8-flash"];
        console.log("📋 Available fast models on your key:", cachedFlashModels);
        return cachedFlashModels;
    } catch {
        return ["gemini-3.8-flash"];
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, keywords, lang, category } = body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
        }

        const prompt = `Write a short, engaging description (max 2 sentences, plain text, no markdown) in ${lang === 'he' ? 'Hebrew' : 'English'} for a place on a map.
Name: "${name}"
Category: "${category}"
Keywords/Draft: "${keywords || ""}"
Output ONLY the description:`;

        const modelsToTry = await getAvailableFlashModels(apiKey);

        // מנסים עד 3 מודלים אמיתיים שקיימים בחשבון שלך, עם סטופר של 7 שניות לכל אחד
        for (const modelName of modelsToTry.slice(0, 3)) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 7000);

            try {
                console.log(`⚡ Trying fast model: ${modelName}`);
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        signal: controller.signal,
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                        }),
                    }
                );

                clearTimeout(timeout);

                if (!response.ok) {
                    console.warn(`⚠️ ${modelName} returned status ${response.status}, switching to next model...`);
                    continue;
                }

                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                if (text) {
                    console.log(`✅ Success with ${modelName}!`);
                    return NextResponse.json({ description: text });
                }
            } catch (err: any) {
                clearTimeout(timeout);
                console.warn(`⚠️ ${modelName} timed out or failed, trying next...`);
            }
        }

        return NextResponse.json(
            { error: "busy", message: "שרתי ה-AI של גוגל עמוסים כרגע, נסי שוב בעוד כמה שניות." },
            { status: 503 }
        );
    } catch (error: any) {
        console.error("AI Generate Fatal Error:", error);
        return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
    }
}