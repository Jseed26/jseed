"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function TimeTracker() {
    const { status } = useSession();

    useEffect(() => {
        // 🌟 מחקנו את השורה שעוצרת אורחים! עכשיו כולם נכנסים למעקב

        const checkPlatform = () => {
            const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;
            return isPWA ? "PWA" : "WEB";
        };

        const pingServer = () => {
            // 🌟 שולפים או מייצרים מזהה אנונימי לאורח
            let visitorId = localStorage.getItem("jseed_visitor_id");
            if (!visitorId) {
                visitorId = crypto.randomUUID(); // מייצר ID ייחודי
                localStorage.setItem("jseed_visitor_id", visitorId);
            }

            fetch("/api/track-time", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    platform: checkPlatform(),
                    visitorId: visitorId // שולחים גם את מזהה האורח
                })
            }).catch(console.error);
        };

        pingServer(); // דיווח ראשון בפתיחת האפליקציה
        const interval = setInterval(pingServer, 60000); // דיווח כל דקה

        return () => clearInterval(interval);
    }, [status]);

    return null;
}