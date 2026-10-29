"use client";

import { useEffect } from "react";

export default function SecurityShield() {
    useEffect(() => {
        // חסימת קליק ימני
        const handleContextMenu = (e: MouseEvent) => e.preventDefault();
        
        // חסימת מקשים (F12, Ctrl+Shift+I/J/C, Ctrl+U)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key === "F12" ||
                (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
                (e.ctrlKey && (e.key === "U" || e.key === "u"))
            ) {
                e.preventDefault();
            }
        };

        document.addEventListener("contextmenu", handleContextMenu);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("contextmenu", handleContextMenu);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return null;
}