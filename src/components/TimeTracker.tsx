"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function TimeTracker() {
    const { status } = useSession();

    useEffect(() => {
        // מפעיל את השעון רק אם המשתמש מחובר
        if (status !== "authenticated") return;

        // מגדיר אינטרוול שרץ כל 60,000 מילישניות (דקה אחת)
        const interval = setInterval(() => {
            fetch("/api/track-time", { method: "POST" }).catch(console.error);
        }, 60000);

        // מנקה את השעון אם המשתמש סוגר את האתר
        return () => clearInterval(interval);
    }, [status]);

    return null; // הקומפוננטה הזו בלתי נראית
}