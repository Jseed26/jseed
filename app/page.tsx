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

  const [compassActive, setCompassActive] = useState(false);
  const [contactActive, setContactActive] = useState(false);

  const categories = [
    { key: "star", label: "Star of David" },
    { key: "triangle", label: "Triangle" },
    { key: "leaf", label: "Leaf" },
    { key: "circle", label: "Circle" },
  ];

  return (
    <main className="relative min-h-screen bg-black text-white flex flex-col items-center justify-between overflow-hidden">

      {/* ================= TOP UI ================= */}
      <div className="absolute top-6 left-0 w-full flex justify-between px-6 z-50">

        {/* Compass - שמאל */}
        <button onClick={() => setCompassActive((v) => !v)}>
          <img
            src={`/icons/ui/compass/${compassActive ? "active" : "default"}.png`}
            className="w-12 h-12"
          />
        </button>

        {/* Contact - ימין */}
        <button onClick={() => setContactActive((v) => !v)}>
          <img
            src={`/icons/ui/contact/${contactActive ? "active" : "default"}.png`}
            className="w-12 h-12"
          />
        </button>

      </div>

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

      {/* ================= CATEGORIES ================= */}
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
                src={`/icons/categories/${cat.key}/${isActive ? "active" : "default"}.png`}
                className="w-16 h-16"
              />
            </button>
          );
        })}
      </div>

    </main>
  );
}