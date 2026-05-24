"use client";

import dynamic from "next/dynamic";

/*
================================================================================
🌍 Jseed Home Page
================================================================================

📌 מה יש פה?
זה עמוד הבית של האפליקציה שמציג:
✔ כותרת מותג
✔ מפה אינטראקטיבית
✔ כפתור פעולה ראשי ("plant")

📌 למה משתמשים ב-dynamic import?
Leaflet משתמש ב-DOM ולכן חייבים:
ssr: false → כדי שלא ירוץ בצד שרת

================================================================================
*/

const Map = dynamic(() => import("@/src/components/Map"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between overflow-hidden">

      {/* ================= TITLE ================= */}
      <h1 className="mt-8 text-5xl md:text-7xl font-light tracking-wide text-yellow-500">
        Jseed
      </h1>

      {/* ================= MAP ================= */}
      <div className="w-full flex-1 flex items-center justify-center">
        <div className="w-full h-[70vh]">
          <Map />
        </div>
      </div>

      {/* ================= ACTION BUTTON ================= */}
      <button
        className="
          mb-10
          w-36
          h-36
          rounded-full
          border
          border-yellow-500
          text-yellow-500
          text-3xl
          font-light
          transition-all
          duration-300
          hover:scale-105
          hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]
        "
      >
        plant
      </button>
    </main>
  );
}