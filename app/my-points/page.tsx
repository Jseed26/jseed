"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function MyPointsPage() {
  const router = useRouter();

  async function handleLogout() {
    await signOut({
      redirect: false,
    });

    router.push("/"); // חזרה לעמוד הבית
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white gap-6">
      <h1 className="text-2xl font-bold">
        הנקודות שלי
      </h1>

      <button
        onClick={handleLogout}
        className="bg-red-500 text-black px-4 py-2 rounded"
      >
        התנתק
      </button>
    </div>
  );
}