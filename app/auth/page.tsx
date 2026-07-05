"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function AuthPage() {
    const [mode, setMode] = useState<"login" | "register">("login");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        setError(null);

        if (!isValidEmail(email)) {
            setError("האימייל שהוזן לא תקין");
            return;
        }

        if (password.length < 6) {
            setError("סיסמה חייבת להיות לפחות 6 תווים");
            return;
        }

        setLoading(true);

        const res = await fetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });

        setLoading(false);

        if (res.ok) {
            setError("נרשמת בהצלחה! עכשיו אפשר להתחבר");
            setMode("login");
        } else {
            setError("שגיאה בהרשמה, נסה שוב");
        }
    }

    async function handleLogin() {
        setError(null);
        setLoading(true);

        const res = await signIn("credentials", {
            email,
            password,
            redirect: false, // 👈 חשוב כדי לקבל תשובה
        });

        setLoading(false);

        if (!res || res.error) {
            setError("אימייל או סיסמה לא נכונים");
            return;
        }

        window.location.href = "/";
    }

    function isValidEmail(email: string) {
        return /\S+@\S+\.\S+/.test(email);
    }

    return (
        <div className="h-screen flex items-center justify-center bg-black text-white">
            <div className="flex flex-col gap-3 w-72">

                {error && (
                    <div className="bg-red-500 text-white text-sm p-2 rounded">
                        {error}
                    </div>
                )}

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
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="bg-yellow-500 text-black p-2 disabled:opacity-50"
                    >
                        {loading ? "טוען..." : "התחבר"}
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