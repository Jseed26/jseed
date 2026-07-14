"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function AuthPage() {
    const [mode, setMode] = useState<"login" | "register">("login");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    // סטייטים חדשים עבור התקנון
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        setError(null);

        // 👈 ולידציה לשם
        if (name.trim().length < 2) {
            setError("יש להזין שם (לפחות 2 אותיות)");
            return;
        }

        if (!isValidEmail(email)) {
            setError("האימייל שהוזן לא תקין");
            return;
        }

        if (password.length < 6) {
            setError("סיסמה חייבת להיות לפחות 6 תווים");
            return;
        }

        // ולידציה של התקנון
        if (!termsAccepted) {
            setError("יש לאשר את התקנון כדי להירשם");
            return;
        }

        setLoading(true);

        const res = await fetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
        });

        setLoading(false);

        if (res.ok) {
            setError("נרשמת בהצלחה! עכשיו אפשר להתחבר");
            setMode("login");
            setTermsAccepted(false); // איפוס הסימון
            setPassword(""); // מחיקת הסיסמה מהשדה ליתר ביטחון
        } else {
            setError("שגיאה בהרשמה, ייתכן שהאימייל כבר קיים");
        }
    }

    async function handleLogin() {
        setError(null);
        setLoading(true);

        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
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
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4" dir="rtl">

            {/* הכרטיס המרכזי */}
            <div className="flex flex-col gap-6 w-full max-w-sm p-8 bg-[#0a0a0a] border border-gray-800 rounded-2xl shadow-[0_0_25px_rgba(255,215,0,0.03)] relative overflow-hidden">

                {/* רקע זוהר עדין מאחורי הכרטיס */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-yellow-500 opacity-50 blur-[10px]"></div>

                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold tracking-wide">
                        {mode === "login" ? "ברוכים השבים" : "יצירת משתמש"}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {mode === "login" ? "התחברו כדי להמשיך ל-JSeed" : "הצטרפו לקהילת JSeed"}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-950/50 border border-red-500 text-red-200 text-sm p-3 rounded-lg text-center">
                        {error}
                    </div>
                )}


                <div className="flex flex-col gap-4">

                    {/* 👈 השדה החדש שמופיע רק בהרשמה */}
                    {mode === "register" && (
                        <input
                            placeholder="שם מלא / כינוי"
                            type="text"
                            value={name}
                            className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                            onChange={(e) => setName(e.target.value)}
                        />
                    )}


                    <input
                        placeholder="אימייל"
                        type="email"
                        value={email}
                        className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <input
                        placeholder="סיסמה"
                        type="password"
                        value={password}
                        className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    {/* תיבת אישור תקנון - מופיעה רק בהרשמה */}
                    {mode === "register" && (
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="checkbox"
                                id="terms"
                                checked={termsAccepted}
                                onChange={(e) => setTermsAccepted(e.target.checked)}
                                className="w-4 h-4 accent-yellow-500 cursor-pointer rounded"
                            />
                            <label htmlFor="terms" className="text-sm text-gray-400 cursor-pointer">
                                קראתי ואני מסכים/ה ל
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setShowTermsModal(true);
                                    }}
                                    className="text-yellow-500 hover:text-yellow-400 underline underline-offset-2 mr-1 mr-1"
                                >
                                    תקנון
                                </button>
                            </label>
                        </div>
                    )}
                </div>

                <button
                    onClick={mode === "login" ? handleLogin : handleRegister}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold p-3 rounded-lg disabled:opacity-50 transition-all shadow-[0_0_10px_rgba(255,215,0,0.2)]"
                >
                    {loading ? "טוען..." : mode === "login" ? "התחברות" : "הרשמה"}
                </button>

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-800"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-600 text-sm">או</span>
                    <div className="flex-grow border-t border-gray-800"></div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => signIn("github", { callbackUrl: "/" })}
                        className="flex items-center justify-center gap-3 border border-gray-700 bg-[#111] text-white p-3 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <img
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"
                            className="w-5 h-5 invert"
                            alt="GitHub"
                        />
                        <span className="text-sm">המשך עם GitHub</span>
                    </button>

                    <button
                        onClick={() => signIn("google", { callbackUrl: "/" })}
                        className="flex items-center justify-center gap-3 border border-gray-300 bg-white text-black p-3 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <img
                            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            className="w-5 h-5"
                            alt="Google"
                        />
                        <span className="text-sm font-medium">המשך עם Google</span>
                    </button>
                </div>

                <div className="text-center mt-2">
                    <button
                        onClick={() => {
                            setMode(mode === "login" ? "register" : "login");
                            setError(null); // איפוס שגיאות במעבר
                        }}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        {mode === "login" ? "אין לך חשבון? צור חשבון חדש" : "כבר יש לך חשבון? התחבר כאן"}
                    </button>
                </div>
            </div>

            {/* מודאל תקנון */}
            {showTermsModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111] border border-gray-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-yellow-500 mb-4 border-b border-gray-800 pb-2">תקנון האתר</h2>
                        <div className="text-gray-300 text-sm leading-relaxed mb-6 min-h-[100px]">
                            התקנון של JSEED. בהמשך נוסיף תנאים אמיתיים.
                        </div>
                        <button
                            onClick={() => setShowTermsModal(false)}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium p-2 rounded-lg transition-colors"
                        >
                            סגירה
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}