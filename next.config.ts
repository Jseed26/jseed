import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development", // 👈 מכבה את ה-PWA בזמן פיתוח
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);