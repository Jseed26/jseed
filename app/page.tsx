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

      {/* ================= HEADER ================= */}
      <div className="shrink-0 flex flex-col items-center pt-2 gap-2 relative">

        {/* top icons */}
        <div className="absolute top-3 left-0 w-full flex justify-between px-6 z-50">
          <button onClick={() => setCompassMode(v => !v)}>
            <img
              src={`/icons/ui/compass/${isCompassMode ? "active" : "default"}.png`}
              className="w-10 h-10"
            />
          </button>

          <button onClick={() => setContactActive(v => !v)}>
            <img
              src={`/icons/ui/contact/${contactActive ? "active" : "default"}.png`}
              className="w-10 h-10"
            />
          </button>
        </div>

        {/* LOGO */}
        <Image
          src="/icons/ui/logo/logo.png"
          alt="JSeed"
          width={90}
          height={60}
        />

        {/* SEARCH */}
        <div className="relative w-52 mx-auto" dir="rtl">
          <Search
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="חיפוש seed"
            className="
      w-full
      py-1.5
      px-8
      text-center
      text-sm
      rounded-lg
      bg-black
      text-white
      border
      border-gray-600
      placeholder-gray-500
      focus:outline-none
      focus:border-gray-400
      focus:ring-0
    "
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ================= MAP ================= */}
      <div className="flex-1 min-h-0 w-full px-2 overflow-hidden">
        <Map
          activeCategory={activeCategory}
          isCompassMode={isCompassMode}
          searchQuery={searchQuery}
        />
      </div>

      {/* ================= CATEGORIES ================= */}
      <div className="shrink-0 flex justify-center gap-6 py-2">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;

          return (
            <button
              key={cat.key}
              onClick={() =>
                setActiveCategory(isActive ? null : cat.key)
              }
              className="flex flex-col items-center"
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