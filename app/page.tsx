"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { PointCategory } from "@/src/types/point";
import Image from "next/image";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const Map = dynamic(() => import("@/src/components/Map"), {
  ssr: false,
});

export default function Home() {
  const [activeCategory, setActiveCategory] =
    useState<PointCategory | null>(null);

  const [isCompassMode, setCompassMode] = useState(false);
  const [contactActive, setContactActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  const router = useRouter();

  const { data: session, status } = useSession();

  const isLoggedIn = status === "authenticated";
  const isLoading = status === "loading";

const categories: { key: PointCategory; label: string }[] = [
    { key: "leaf", label: "Community" },
    { key: "star", label: "Spirit" },
    { key: "triangle", label: "Legacy" }, // או Heritage, לבחירתך
    { key: "circle", label: "Business" },
  ];

  return (
    // 👈 השינוי המרכזי כאן: החלפנו h-screen ב- h-[100dvh]
    <main className="h-[100dvh] w-full bg-black text-white flex flex-col overflow-hidden">

      {/* ================= HEADER ================= */}
      <div className="shrink-0 flex flex-col items-center pt-2 pb-1 gap-2 relative">

        {/* top icons */}
        <div className="absolute top-3 left-0 w-full flex justify-between px-6 z-50">
          <button
            onClick={() => {
              setCompassMode(v => !v);
              setToast(!isCompassMode ? "במצב הוספת נקודה" : null);
              setTimeout(() => setToast(null), 2000);
            }}
          >
            <img
              src={`/icons/ui/compass/${isCompassMode ? "active" : "default"}.png`}
              className="w-10 h-10"
            />
          </button>

          <button
            onClick={() => {
              if (status === "loading") return;

              if (isLoggedIn) {
                router.push("/my-points");
              } else {
                router.push("/auth");
              }
            }}
          >
            <img
              src={`/icons/ui/contact/${isLoggedIn ? "active" : "default"}.png`}
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
          className="relative z-40"
        />

        {/* SEARCH */}
        <div className="relative w-52 mx-auto z-40" dir="rtl">
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

      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white text-black px-3 py-1 rounded-lg z-50 text-sm">
          {toast}
        </div>
      )}
      
      {/* ================= MAP ================= */}
      {/* flex-1 מאלץ את המפה לתפוס רק את המקום שנשאר בין ההדר לקטגוריות */}
      <div className="flex-1 min-h-0 w-full px-2 overflow-hidden relative z-10">
        <Map
          activeCategory={activeCategory}
          isCompassMode={isCompassMode}
          setCompassMode={setCompassMode}
          searchQuery={searchQuery}
          isLoggedIn={isLoggedIn}
        />
      </div>

      {/* ================= CATEGORIES ================= */}
      {/* 👈 הוספנו pb-4 (Padding Bottom) כדי לתת מרווח נשימה מתחתית המסך של הטלפון */}
      <div className="shrink-0 flex justify-center gap-4 sm:gap-6 pt-2 pb-4 sm:pb-2 relative z-40 bg-black">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;

          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(isActive ? null : cat.key)}
              className="flex flex-col items-center"
            >
              <img
                src={`/icons/categories/${cat.key}/${isActive ? "active" : "default"}.png`}
                className="w-12 h-12 sm:w-14 sm:h-14" 
              />

              <span className="text-[10px] sm:text-xs mt-1 text-yellow-500">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

    </main>
  );
}