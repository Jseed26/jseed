"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        setError("");

        if (!token) {
            setError("קישור לא תקין. אנא בקש קישור חדש מיומן ההתחברות.");
            return;
        }

        if (password.length < 6) {
            setError("הסיסמה חייבת להיות לפחות בת 6 תווים.");
            return;
        }

        if (password !== confirmPassword) {
            setError("הסיסמאות אינן תואמות.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                body: JSON.stringify({ token, password })
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                // מעביר להתחברות אחרי 3 שניות
                setTimeout(() => {
                    router.push("/auth");
                }, 3000);
            } else {
                setError(data.error || "אירעה שגיאה. נסה שוב.");
            }
        } catch (err) {
            setError("שגיאה בתקשורת עם השרת.");
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    ✓
                </div>
                <h2 className="text-2xl font-bold text-white">הסיסמה עודכנה בהצלחה!</h2>
                <p className="text-gray-400">מעביר אותך למסך ההתחברות...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="text-center space-y-2 mb-4">
                <h1 className="text-2xl font-bold tracking-wide text-yellow-500">בחירת סיסמה חדשה</h1>
                <p className="text-sm text-gray-400">אנא הקלד את הסיסמה החדשה שלך למטה.</p>
            </div>

            {error && (
                <div className="bg-red-950/50 border border-red-500 text-red-200 text-sm p-3 rounded-lg text-center">
                    {error}
                </div>
            )}

            <input
                placeholder="סיסמה חדשה"
                type="password"
                value={password}
                className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                onChange={(e) => setPassword(e.target.value)}
            />

            <input
                placeholder="אימות סיסמה חדשה"
                type="password"
                value={confirmPassword}
                className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold p-3 rounded-lg disabled:opacity-50 transition-all mt-4"
            >
                {loading ? "מעדכן סיסמה..." : "עדכן סיסמה"}
            </button>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4" dir="rtl">
            <div className="flex flex-col gap-6 w-full max-w-sm p-8 bg-[#0a0a0a] border border-gray-800 rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-yellow-500 opacity-50 blur-[10px]"></div>
                
                {/* 🌟 עטפנו את הקומפוננטה ב-Suspense כדי ש-Next.js יוכל לקרוא נתונים מה-URL בצורה תקינה */}
                <Suspense fallback={<div className="text-center text-yellow-500">טוען...</div>}>
                    <ResetPasswordForm />
                </Suspense>
                
            </div>
        </div>
    );
}