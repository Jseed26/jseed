//C:\Users\hadar\Desktop\jseed\jseed-web\app\page.tsx
"use client";

import dynamic from "next/dynamic";

const Globe = dynamic(() => import("@/src/components/Globe"), {
  ssr: false,
});


export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between overflow-hidden">
      
      {/* Title */}
      <h1 className="mt-8 text-5xl md:text-7xl font-light tracking-wide text-yellow-500">
        Jseed
      </h1>

      {/* Globe */}
      <div className="w-full flex-1 flex items-center justify-center">
        <div className="w-full h-[70vh]">
          <Globe />
        </div>
      </div>

      {/* Plant Button */}
      <button
        className="
          mb-10
          w-36
          h-36
          rounded-full
          border
          border-yellow-500
          text-yellow-500
          text-3xl
          font-light
          transition-all
          duration-300
          hover:scale-105
          hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]
        "
      >
        plant
      </button>
    </main>
  );
}