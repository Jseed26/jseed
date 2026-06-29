"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister() {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      alert("נרשמת! עכשיו התחברי");
      setMode("login");
    } else {
      alert("שגיאה בהרשמה");
    }
  }

  async function handleLogin() {
    await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/",
    });
  }

  return (
    <div className="h-screen flex items-center justify-center bg-black text-white">
      <div className="flex flex-col gap-3 w-72">

        <h1 className="text-xl">
          {mode === "login" ? "התחברות" : "הרשמה"}
        </h1>

        <input
          placeholder="email"
          className="p-2 text-white"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="password"
          type="password"
          className="p-2 text-white"
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === "login" ? (
          <button onClick={handleLogin} className="bg-yellow-500 text-black p-2">
            התחבר
          </button>
        ) : (
          <button onClick={handleRegister} className="bg-green-500 text-black p-2">
            הירשם
          </button>
        )}

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="text-sm underline"
        >
          {mode === "login" ? "אין לך חשבון? הירשם" : "יש לך חשבון? התחבר"}
        </button>

      </div>
    </div>
  );
}