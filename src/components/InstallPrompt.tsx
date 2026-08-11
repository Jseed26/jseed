"use client";

import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. בודק אם האפליקציה כבר מותקנת (אם כן, לא נציג כלום)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // 2. בודק אם זה מכשיר אפל (iOS לא תומך בהקפצה אוטומטית, אז נציג להם הודעת הדרכה)
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setIsIOS(true);
      setShowPrompt(true);
    }

    // 3. תופס את אירוע ההתקנה של אנדרואיד/כרום ושומר אותו אצלנו
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault(); // מונע מהדפדפן להקפיץ את ההודעה המכוערת שלו
      setDeferredPrompt(e); // שומר את האירוע כדי שנוכל להפעיל אותו בלחיצת כפתור
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // מפעיל את חלונית ההתקנה הרשמית של הטלפון
    deferredPrompt.prompt();
    
    // מחכה לראות מה המשתמש בחר (אישר או ביטל)
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] bg-gray-900 border border-yellow-500/50 rounded-2xl p-4 shadow-[0_0_15px_rgba(234,179,8,0.2)] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/icons/ui/app_logo/jseed-logo-small.png" alt="JSeed" className="w-10 h-10 rounded-lg object-cover" />
          <div>
            <h3 className="text-white font-bold text-sm">התקינו את JSeed</h3>
            <p className="text-gray-400 text-xs">לחוויה מהירה ונוחה יותר</p>
          </div>
        </div>
        <button 
          onClick={() => setShowPrompt(false)}
          className="text-gray-500 hover:text-white p-1"
        >
          ✕
        </button>
      </div>

      {isIOS ? (
        <p className="text-yellow-500 text-xs text-center bg-yellow-500/10 p-2 rounded-lg">
          באייפון: לחצו על כפתור השיתוף למטה ⍗<br/>ואז על ״הוסף למסך הבית״ ➕
        </p>
      ) : (
        <button 
          onClick={handleInstallClick}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded-xl text-sm transition-colors shadow-lg"
        >
          התקן אפליקציה
        </button>
      )}
    </div>
  );
}