// src/lib/ai.ts
import { pipeline, env } from '@xenova/transformers';

// אנחנו מבטלים חיפוש של מודלים מקומיים כדי שהוא יוריד את המודל ישירות מהענן של Hugging Face
env.allowLocalModels = false;

class AIEngine {
    static task = 'feature-extraction' as const;
    // זהו המודל הרב-לשוני! הוא מבין מעל 50 שפות ברמת שפת אם, כולל עברית, אנגלית, רוסית, ערבית וצ'כית.
    static model = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
    static instance: any = null;

    static async getInstance() {
        if (this.instance === null) {
            console.log("🚀 טוען את מוח ה-AI בפעם הראשונה... (זה ייקח כמה שניות)");
            
            // טוען את המודל לזיכרון של השרת פעם אחת בלבד!
            this.instance = pipeline(this.task, this.model, {
                quantized: true, // משתמש בגרסה מכווצת ומהירה כדי לא להעמיס על השרת
            });
        }
        return this.instance;
    }
}

export default AIEngine;