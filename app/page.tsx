"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { PointCategory } from "@/src/types/point";
import Image from "next/image";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import MapLightbox from "@/src/components/MapLightbox";

import NotificationBell from "@/src/components/NotificationBell";

const Map = dynamic(() => import("@/src/components/Map"), {
  ssr: false,
});

const t = {
  search: { he: "חיפוש seed", en: "Search seed" },
  cancel: { he: "ביטול", en: "Cancel" },
  addSeed: { he: "הוסף נקודה חדשה", en: "Add a new seed" },
  selectPoint: { he: "בחר נקודה על המפה", en: "Select a point on the map" },
  notifications: { he: "התראות", en: "Notifications" },
  myProfile: { he: "הפרופיל שלי", en: "My Profile" },
  logIn: { he: "התחבר", en: "Log In" },
  community: { he: "קהילה", en: "Community" },
  spirit: { he: "רוח", en: "Spirit" },
  legacy: { he: "מורשת", en: "Legacy" },
  business: { he: "עסקים", en: "Business" },
  chai: { he: "חי", en: "Chai" },
};

export default function Home() {
  const [lang, setLang] = useState<"en" | "he">("he");
  const [isLangOpen, setIsLangOpen] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("jseed_lang") as "en" | "he";
    if (savedLang) setLang(savedLang);
  }, []);

  const changeLanguage = (newLang: "en" | "he") => {
    setLang(newLang);
    localStorage.setItem("jseed_lang", newLang);
    setIsLangOpen(false);
  };

  const [activeCategory, setActiveCategory] = useState<PointCategory | null>(null);
  const [isCompassMode, setCompassMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  const router = useRouter();
  const { data: session, status } = useSession();

  const isLoggedIn = status === "authenticated";

  const categories: { key: PointCategory; label: string }[] = [
    { key: "leaf", label: t.community[lang] },
    { key: "star", label: t.spirit[lang] },
    { key: "triangle", label: t.legacy[lang] },
    { key: "circle", label: t.business[lang] },
    { key: "chai", label: t.chai[lang] },
  ];

  const userFirstName = session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")[0] || "User";

  return (
    <main className="h-[100dvh] w-full bg-black text-white flex flex-col overflow-hidden fixed inset-0">

      {/* ================= HEADER ================= */}
      <div className="shrink-0 flex flex-col items-center pt-2 pb-1 gap-2 relative z-[9999]">

        <div className="absolute top-3 w-full flex justify-between px-6 z-[9999] pointer-events-none" dir="ltr">

          <button
            className="pointer-events-auto flex items-center justify-center p-2 rounded-full transition-all"
            style={{
              background: isCompassMode ? "rgba(251, 191, 36, 0.15)" : "transparent",
              border: isCompassMode ? "1px solid rgba(251, 191, 36, 0.4)" : "1px solid transparent"
            }}
            title={isCompassMode ? t.cancel[lang] : t.addSeed[lang]}
            onClick={() => {
              setCompassMode(v => !v);
              setToast(!isCompassMode ? t.selectPoint[lang] : null);
              setTimeout(() => setToast(null), 2000);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26" height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: "all 0.3s ease",
                filter: isCompassMode ? "drop-shadow(0px 0px 8px rgba(251,191,36,0.6))" : "none",
                transform: isCompassMode ? "scale(1.1)" : "scale(1)"
              }}
            >
              <circle cx="12" cy="12" r="10" fill={isCompassMode ? "rgba(17,24,39,0.8)" : "none"} />
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="20" y1="12" x2="22" y2="12" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={isCompassMode ? "rgba(251,191,36,0.2)" : "none"} />
              <line x1="7.76" y1="16.24" x2="16.24" y2="7.76" />
            </svg>
          </button>

          <div className="flex items-center gap-3 pointer-events-auto">
            <div title={t.notifications[lang]} className="flex items-center">
              <NotificationBell />
            </div>

            <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-700/50 rounded-full py-1 pr-1 pl-3 backdrop-blur-sm">
              {isLoggedIn && (
                <span className="text-xs text-gray-300 font-medium hidden sm:block">
                  Hi, {userFirstName}
                </span>
              )}
              <button
                title={isLoggedIn ? t.myProfile[lang] : t.logIn[lang]}
                onClick={() => {
                  if (status === "loading") return;
                  if (isLoggedIn) {
                    router.push("/my-points");
                  } else {
                    router.push("/auth");
                  }
                }}
                className="hover:scale-105 transition-transform"
              >
                <img
                  src={`/icons/ui/contact/${isLoggedIn ? "active" : "default"}.png`}
                  className="w-8 h-8 object-cover rounded-full"
                  alt="Profile"
                />
              </button>
            </div>
          </div>
        </div>

        <Image
          src="/icons/ui/logo/logo2.png"
          alt="JSeed"
          width={90}
          height={60}
          className="relative z-40"
        />

        {/* 🌟 שינוי: ה-dir קבוע ל-ltr כדי שזכוכית המגדלת תמיד תישאר בצד שמאל */}
        <div className="relative w-52 mx-auto z-40" dir="ltr">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />

          <input
            type="text"
            placeholder={t.search[lang]}
            className="w-full py-1.5 pl-8 pr-3 text-center text-sm rounded-lg bg-black text-white border border-gray-600 placeholder-gray-500 focus:outline-none focus:border-gray-400 focus:ring-0"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {toast && (
        <div className="absolute top-[130px] left-1/2 -translate-x-1/2 bg-white text-black px-4 py-1.5 rounded-lg z-[99999] text-sm font-bold shadow-2xl pointer-events-none border border-yellow-500">
          {toast}
        </div>
      )}

      <div className="flex-1 min-h-0 w-full px-2 relative">
        <Map
          activeCategory={activeCategory}
          isCompassMode={isCompassMode}
          setCompassMode={setCompassMode}
          searchQuery={searchQuery}
          isLoggedIn={isLoggedIn}
          lang={lang}
        />

        {/* ================= כפתור השפה צף קבוע משמאל ================= */}
        <div className="absolute bottom-6 left-[125px] z-[400]">
          <div className="relative pointer-events-auto">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center justify-center gap-1.5 border border-gray-600 text-yellow-500 px-3 py-2 rounded-full hover:bg-gray-800 transition text-xs font-bold bg-gray-900 shadow-lg"
            >
              🌐 {lang === "he" ? "עברית" : "English"}
            </button>

            {isLangOpen && (
              <div className="absolute bottom-full mb-2 w-24 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden left-0">
                <button
                  onClick={() => changeLanguage("he")}
                  className={`px-4 py-2 text-sm text-center hover:bg-gray-800 transition ${lang === "he" ? "text-yellow-500 font-bold bg-gray-800" : "text-gray-300"}`}
                >
                  עברית
                </button>
                <button
                  onClick={() => changeLanguage("en")}
                  className={`px-4 py-2 text-sm text-center hover:bg-gray-800 transition ${lang === "en" ? "text-yellow-500 font-bold bg-gray-800" : "text-gray-300"}`}
                >
                  English
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 w-full flex justify-center gap-4 sm:gap-6 pt-3 pb-5 sm:pb-3 relative z-40 bg-black safe-area-bottom">
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
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain transition-transform hover:scale-105"
                alt={cat.label}
              />

              <span className="text-[10px] sm:text-xs mt-1 text-yellow-500">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <MapLightbox />
    </main>
  );
}