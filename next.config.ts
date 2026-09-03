import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. מונע מ-Next.js לנסות לארוז את מנוע ה-AI הכבד יחד עם שאר האתר
  serverExternalPackages: ["onnxruntime-node", "@xenova/transformers"],

  // 2. פותר שגיאות Webpack הקשורות לנתיבים וקבצים בינאריים של המודל
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;