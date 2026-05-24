"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = [
    { key: "star", label: "Star of David" },
    { key: "triangle", label: "Triangle" },
    { key: "leaf", label: "Leaf" },
    { key: "circle", label: "Circle" },
  ];

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
      <div className="mb-10 flex gap-6">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;

          return (
            <button
              key={cat.key}
              onClick={() =>
                setActiveCategory(isActive ? null : cat.key)
              }
              className="transition-transform hover:scale-110"
            >
              <img
                src={`/icons/categories/${cat.key}/${isActive ? "active" : "default"
                  }.png`}
                alt={cat.label}
                className="w-16 h-16"
              />
            </button>
          );
        })}
      </div>
    </main>
  );
}