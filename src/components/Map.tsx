"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/*
================================================================================
🗺️ Leaflet Map Setup – Jseed Project
================================================================================

📌 מה הקובץ הזה עושה?
זה קומפוננטת מפה שטוחה מבוססת Leaflet + OpenStreetMap.

המפה מאפשרת:
✔ הצגת מפה אינטראקטיבית
✔ זום פנימה והחוצה עד רמת רחובות
✔ הוספת סימונים (Markers)
✔ פתיחת Popup לכל נקודה

================================================================================
📍 תיקון בעיית האייקונים של Leaflet ב-Next.js
================================================================================

ברירת המחדל של Leaflet היא לטעון תמונות marker מהנתיב הפנימי שלו,
אבל ב-Next.js זה לא עובד → ולכן צריך להגדיר ידנית את הנתיבים.

התמונות נמצאות כאן בפרויקט:
public/leaflet/images/

קבצים:
- marker-icon.png        → האייקון הראשי של הסיכה 📍
- marker-icon-2x.png     → גרסה חדה למסכי Retina
- marker-shadow.png      → הצל של הסיכה

================================================================================
*/

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/images/marker-icon-2x.png",
  iconUrl: "/leaflet/images/marker-icon.png",
  shadowUrl: "/leaflet/images/marker-shadow.png",
});

export default function Map() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    /*
    =====================================================================
    🛑 מניעת יצירה כפולה של המפה
    =====================================================================

    Next.js (במצב dev) לפעמים מרנדר קומפוננטות פעמיים.
    Leaflet לא מאפשר ליצור מפה פעמיים על אותו DOM element.

    לכן אנחנו בודקים אם כבר קיימת מפה ומונעים יצירה נוספת.
    */
    if ((mapRef.current as any)._leaflet_id) return;

    /*
    =====================================================================
    🌍 יצירת המפה עצמה
    =====================================================================

    setView:
    [latitude, longitude] + zoom level

    כאן אנחנו ממקמים את המפה על ישראל כברירת מחדל.
    */
    const map = L.map(mapRef.current).setView(
      [31.7683, 35.2137],
      8
    );

    /*
    =====================================================================
    🗺️ שכבת המפה (Tiles)
    =====================================================================

    אנחנו משתמשים ב-OpenStreetMap שהוא חינמי.

    כל ריבוע במפה הוא tile שמגיע משרת חיצוני:
    https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
    */
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
      }
    ).addTo(map);

    /*
    =====================================================================
    📍 הוספת Marker לדוגמה
    =====================================================================

    זה סימון בסיסי על המפה.
    בעתיד זה יגיע מה-DB (נ"צים של משתמשים / עצים וכו').
    */
    L.marker([31.7683, 35.2137])
      .addTo(map)
      .bindPopup("Jseed 🌱");

    /*
    =====================================================================
    🧹 ניקוי (Cleanup)
    =====================================================================

    כשעוברים דפים / הקומפוננטה יורדת → אנחנו מוחקים את המפה
    כדי למנוע זליגת זיכרון (memory leak).
    */
    return () => {
      map.remove();
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "70vh",
        borderRadius: "24px",
        overflow: "hidden",
      }}
    />
  );
}