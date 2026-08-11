import type { Metadata, Viewport } from "next"; // 👈 הוספנו את Viewport
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import TimeTracker from "@/src/components/TimeTracker";
import { Analytics } from "@vercel/analytics/react";
import InstallPrompt from "@/src/components/InstallPrompt"; // או לפי הנתיב המדויק שלך

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 👈 הגדרות צבע לאפליקציה במובייל (הצבע שיופיע למעלה בשורת הסטטוס)
export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "JSeed", // 👈 שיניתי לשם האמיתי
  description: "Global Jewish Connection",
  manifest: "/manifest.json", // 👈 הוספנו את הקישור למניפסט!
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <TimeTracker />
          {children}
          <InstallPrompt />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}