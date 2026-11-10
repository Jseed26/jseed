import type { Metadata, Viewport } from "next"; // 👈 הוספנו את Viewport
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import TimeTracker from "@/src/components/TimeTracker";
import { Analytics } from "@vercel/analytics/react";
import InstallPrompt from "@/src/components/InstallPrompt"; 
import SecurityShield from "@/src/components/SecurityShield";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'JSeed',
  description: 'מפת היוזמות, הקהילות והעסקים. גלו ושתפו נקודות עניין סביבכם.',
  openGraph: {
    title: 'JSeed',
    description: 'מפת היוזמות, הקהילות והעסקים. גלו ושתפו נקודות עניין סביבכם.',
    url: 'https://jseedglobal.com', // תחליפי לדומיין האמיתי שלכם
    siteName: 'JSeed',
    images: [
      {
        // כאן שמים את הנתיב לתמונה שאת רוצה שתוצג בוואטסאפ
        url: '/icons/ui/logo/logo2.png', 
        width: 1200,
        height: 630,
        alt: 'JSeed Logo',
      },
    ],
    locale: 'he_IL',
    type: 'website',
  },
}


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
          {/* <SecurityShield /> */}
          //צריך להחזיר כשאני מסיימת
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}