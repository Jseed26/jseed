"use function";
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type Notification = {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // משיכת ההתראות מהשרת
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
    // אפשר גם לרענן כל כמה דקות אם רוצים
    const interval = setInterval(fetchNotifications, 60000); 
    return () => clearInterval(interval);
  }, [session]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleOpen = async () => {
    setIsOpen(!isOpen);

    // אם פתחנו את התפריט ויש התראות שלא נקראו, נסמן אותן כנקראות במסד הנתונים
    if (!isOpen && unreadCount > 0) {
      try {
        await fetch("/api/notifications/read", { method: "POST" });
        // מעדכנים את הסטייט המקומי כדי שהנקודה האדומה תיעלם מיד
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (err) {
        console.error("Failed to mark as read", err);
      }
    }
  };

  if (!session?.user) return null; // לא מציגים פעמון לאורחים

  return (
    <div className="relative">
      {/* כפתור הפעמון */}
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-300 hover:text-yellow-500 transition-colors focus:outline-none"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {/* נקודה אדומה אם יש התראות */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* תפריט ההתראות הקופץ */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3 text-sm font-bold text-yellow-500 border-b border-gray-700 bg-gray-800">
            התראות
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar text-right">
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-gray-400 text-center">אין התראות חדשות.</div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="p-3 border-b border-gray-700/50 hover:bg-gray-800 transition-colors text-sm text-gray-200">
                  {notif.message}
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(notif.createdAt).toLocaleDateString("he-IL")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}