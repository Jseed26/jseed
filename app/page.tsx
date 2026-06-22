"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { PointCategory } from "@/src/types/point";
import Image from "next/image";
import { Search } from "lucide-react";

const Map = dynamic(() => import("@/src/components/Map"), {
  ssr: false,
});

export default function Home() {
  const [activeCategory, setActiveCategory] =
    useState<PointCategory | null>(null);

  const [isCompassMode, setCompassMode] = useState(false);
  const [contactActive, setContactActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const categories: { key: PointCategory; label: string }[] = [
    { key: "leaf", label: "קהילה" },
    { key: "star", label: "רוח" },
    { key: "triangle", label: "מורשת" },
    { key: "circle", label: "עסקים" },
  ];

  return (
    <main className="h-screen bg-black text-white flex flex-col overflow-hidden">

      {/* ================= TOP ICONS ================= */}
      <div className="absolute top-4 left-0 w-full flex justify-between px-6 z-50">
        <button onClick={() => setCompassMode(v => !v)}>
          <img
            src={`/icons/ui/compass/${isCompassMode ? "active" : "default"}.png`}
            className="w-12 h-12"
          />
        </button>

        <button onClick={() => setContactActive(v => !v)}>
          <img
            src={`/icons/ui/contact/${contactActive ? "active" : "default"}.png`}
            className="w-12 h-12"
          />
        </button>
      </div>

      {/* ================= HEADER (LOGO + SEARCH) ================= */}
      <div className="flex flex-col items-center pt-2 gap-2">

        {/* LOGO */}
        <Image
          src="/icons/ui/logo/logo.png"
          alt="JSeed"
          width={100}
          height={80}
        />

        {/* SEARCH */}
        <div className="relative w-64" dir="rtl">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500"
          />

          <input
            type="text"
            placeholder="חיפוש seed"
            className="
              w-full
              p-2
              pr-10
              rounded-xl
              bg-black
              text-white
              border
              border-yellow-500
              placeholder-gray-400
              focus:outline-none
              focus:ring-2
              focus:ring-yellow-500
              text-right
            "
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ================= MAP ================= */}
      <div className="flex-1 w-full px-2">
        <Map
          activeCategory={activeCategory}
          isCompassMode={isCompassMode}
          searchQuery={searchQuery}
        />
      </div>

      {/* ================= CATEGORIES ================= */}
      <div className="flex justify-center gap-6 py-3">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;

          return (
            <button
              key={cat.key}
              onClick={() =>
                setActiveCategory(isActive ? null : cat.key)
              }
              className="flex flex-col items-center transition-transform hover:scale-110"
            >
              <img
                src={`/icons/categories/${cat.key}/${isActive ? "active" : "default"}.png`}
                className="w-14 h-14"
              />

              <span className="text-xs mt-1 text-yellow-500">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

    </main>
  );
}