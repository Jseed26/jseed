import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  
  // 👇 כיבינו את הקאשינג האגרסיבי שגרם לנעילה
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  
  // 👇 פקודת ההשמדה לגרסאות הישנות שתציל את שאר הטלפונים
  workboxOptions: {
    skipWaiting: true, // מכריח את הטלפון לעבור מיד לגרסה החדשה
    clientsClaim: true, // גורם לגרסה החדשה להשתלט מיד על כל הדפים הפתוחים
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);