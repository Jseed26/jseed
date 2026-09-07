"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type Notification = {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const t = {
  title: { he: "התראות", en: "Notifications" },
  empty: { he: "אין התראות חדשות.", en: "No new notifications." },
  // 🌟 הוספנו את התרגום למילון
  savedSeed: { 
    he: "מישהו הרגע שמר את הגרעין שלך! 🌱", 
    en: "Someone just saved your seed! 🌱" 
  }
};

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  const [lang, setLang] = useState<"en" | "he">("he");

  useEffect(() => {
    const checkLang = () => {
      const savedLang = localStorage.getItem("jseed_lang") as "en" | "he";
      if (savedLang && savedLang !== lang) setLang(savedLang);
    };
    
    checkLang();
    const intervalId = setInterval(checkLang, 1000);
    return () => clearInterval(intervalId);
  }, [lang]);

  useEffect(() => {
    if (!session?.user) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [session]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleOpen = async () => {
    setIsOpen(!isOpen);

    if (!isOpen && unreadCount > 0) {
      try {
        await fetch("/api/notifications/read", { method: "POST" });
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (err) {
        console.error("Failed to mark as read", err);
      }
    }
  };

  if (!session?.user) return null;

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-300 hover:text-yellow-500 transition-colors focus:outline-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hover:scale-110 transition-transform"
          style={{ filter: "drop-shadow(0px 0px 4px rgba(251,191,36,0.4))" }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
            className="absolute mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[9999] overflow-hidden right-0" 
            dir={lang === "he" ? "rtl" : "ltr"}
        >
          <div className="p-3 text-sm font-bold text-yellow-500 border-b border-gray-700 bg-gray-800">
            {t.title[lang]}
          </div>
          <div className={`max-h-64 overflow-y-auto custom-scrollbar ${lang === "he" ? "text-right" : "text-left"}`}>
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-gray-400 text-center">{t.empty[lang]}</div>
            ) : (
              notifications.map((notif) => {
                // 🌟 הטריק הדינמי: מזהים את המשפט של השרת ומתרגמים למשתמש
                const displayMsg = notif.message.includes("שמר את הגרעין") 
                  ? t.savedSeed[lang] 
                  : notif.message;

                return (
                  <div key={notif.id} className="p-3 border-b border-gray-700/50 hover:bg-gray-800 transition-colors text-sm text-gray-200">
                    {displayMsg}
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(notif.createdAt).toLocaleDateString(lang === "he" ? "he-IL" : "en-US")}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}