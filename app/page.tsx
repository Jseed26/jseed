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
  chai: { he: "יוזמות", en: "Initiatives" },
  addNewInitiative: { he: "הוסף יוזמה חדשה", en: "Add a new initiative" },
  allChai: { he: "כל היוזמות", en: "All Initiatives" },
  noInitiatives: { he: "אין יוזמות כרגע", en: "No initiatives yet" },
};

// 🌟 הגדרנו טיפוס חדש כדי לשמור גם את השם וגם את כמות המשתתפים!
type InitiativeWithCount = {
  name: string;
  count: number;
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

  // סטייטים לתפריט הנגלל של "חי"
  const [isChaiMenuOpen, setIsChaiMenuOpen] = useState(false);

  // 🌟 מעכשיו שומרים פה אובייקטים עם כמות, ולא רק מחרוזות טיפשות
  const [chaiInitiatives, setChaiInitiatives] = useState<InitiativeWithCount[]>([]);

  // 🌟 הלוגיקה החדשה של הספירה!
  const fetchChaiInitiatives = async () => {
    try {
      const res = await fetch("/api/points?category=chai");
      const data = await res.json();
      if (Array.isArray(data)) {
        // סופרים כמה פעמים כל יוזמה מופיעה
        const counts: Record<string, number> = {};
        data.forEach((p: any) => {
          if (p.name) {
            counts[p.name] = (counts[p.name] || 0) + 1;
          }
        });

        // ממירים למערך של אובייקטים
        const mappedInitiatives = Object.keys(counts).map(name => ({
          name,
          count: counts[name]
        }));

        setChaiInitiatives(mappedInitiatives);
      }
    } catch (err) {
      console.error("Failed to fetch initiatives", err);
    }
  };

  const categories: { key: PointCategory; label: string }[] = [
    { key: "leaf", label: t.community[lang] },
    { key: "triangle", label: t.legacy[lang] },
    { key: "chai", label: t.chai[lang] },
    { key: "star", label: t.spirit[lang] },
    { key: "circle", label: t.business[lang] },

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

        <div className="relative w-52 mx-auto z-40" dir="ltr">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />

          <input
            type="text"
            value={searchQuery}
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

        {/* ================= כפתור השפה ================= */}
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

{/* ================= תפריט קטגוריות תחתון ================= */}
      <div className="shrink-0 w-full flex justify-evenly sm:justify-center items-end px-1 sm:px-0 sm:gap-8 pt-3 pb-5 sm:pb-3 relative z-[1000] bg-black safe-area-bottom">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;
          const isChai = cat.key === "chai";

          return (
            <div key={cat.key} className="relative flex flex-col items-center w-[64px] sm:w-[76px] shrink-0">

              {/* התפריט הנגלל עבור קטגוריית חי (יוזמות) */}
              {isChai && isChaiMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 w-full h-full z-[1100]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsChaiMenuOpen(false);
                    }}
                  />

                  {/* התפריט עצמו */}
                  <div className="absolute bottom-[110%] -right-2 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-56 bg-gray-900 border-2 border-yellow-500 rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.3)] z-[1200] flex flex-col overflow-hidden max-h-72" dir={lang === "he" ? "rtl" : "ltr"}>                    
                    <button
                      onClick={() => {
                        setActiveCategory("chai");
                        setCompassMode(true);
                        setIsChaiMenuOpen(false);
                        setToast(t.selectPoint[lang]);
                        setTimeout(() => setToast(null), 2000);
                      }}
                      className={`p-3 text-sm font-bold text-yellow-500 border-b border-gray-700 hover:bg-gray-800 transition text-${lang === "he" ? "right" : "left"}`}
                    >
                      ➕ {t.addNewInitiative[lang]}
                    </button>

                    <button
                      onClick={() => {
                        setActiveCategory("chai");
                        setSearchQuery("");
                        setIsChaiMenuOpen(false);
                      }}
                      className={`p-3 text-sm font-bold text-white border-b border-gray-700 hover:bg-gray-800 transition flex justify-between items-center text-${lang === "he" ? "right" : "left"}`}
                    >
                      <span>🌍 {t.allChai[lang]}</span>
                      {!searchQuery && isActive && <span className="text-yellow-500 text-xs">✓</span>}
                    </button>

                    <div className="overflow-y-auto custom-scrollbar flex-1">
                      {chaiInitiatives.map((init, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveCategory("chai");
                            setSearchQuery(init.name);
                            setIsChaiMenuOpen(false);
                          }}
                          className={`w-full p-3 text-sm text-gray-300 hover:text-white hover:bg-gray-800 border-b border-gray-800/50 transition flex justify-between items-center text-${lang === "he" ? "right" : "left"}`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden w-full">
                            <span className="truncate">{init.name}</span>
                            <span className="text-[10px] font-bold text-gray-300 bg-gray-800 px-2 py-0.5 rounded-full shrink-0">
                              {init.count}
                            </span>
                          </div>
                          {searchQuery === init.name && <span className="text-yellow-500 text-xs mx-2 shrink-0">✓</span>}
                        </button>
                      ))}
                      {chaiInitiatives.length === 0 && (
                        <div className="p-4 text-xs text-gray-400 text-center bg-gray-800/30">
                          {t.noInitiatives[lang]}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={() => {
                  if (isChai) {
                    if (isActive) {
                      if (isChaiMenuOpen) {
                        setActiveCategory(null);
                        setSearchQuery("");
                        setIsChaiMenuOpen(false);
                      } else {
                        if (chaiInitiatives.length === 0) fetchChaiInitiatives();
                        setIsChaiMenuOpen(true);
                      }
                    } else {
                      if (chaiInitiatives.length === 0) fetchChaiInitiatives();
                      setActiveCategory("chai");
                      setIsChaiMenuOpen(true);
                    }
                  } else {
                    setActiveCategory(isActive ? null : cat.key);
                    setIsChaiMenuOpen(false);
                  }
                }}
                className="flex flex-col items-center justify-end w-full relative z-[1300]"
              >
                {/* מעטפת בגובה קבוע שמבטיחה שהאייקונים תמיד יושבים בבסיס וממורכבים בדיוק מעל הטקסט */}
                <div className="h-12 sm:h-14 flex items-end justify-center w-full">
                  <img
                    src={`/icons/categories/${cat.key}/${isActive ? "active" : "default"}.png`}
                    className={`shrink-0 object-contain transition-transform origin-bottom ${
                      isChai 
                          ? "w-14 h-12 sm:w-16 sm:h-14 scale-[1.2] hover:scale-[1.4]"
                          : "w-10 h-10 sm:w-12 sm:h-12 hover:scale-105"        
                    }`}
                    alt={cat.label}
                  />
                </div>

                <span className="text-[10px] sm:text-xs mt-1 text-yellow-500 text-center leading-tight break-words w-full">
                  {cat.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <MapLightbox />
    </main>
  );
}