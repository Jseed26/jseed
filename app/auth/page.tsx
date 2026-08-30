"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
    const [mode, setMode] = useState<"login" | "register">("login");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // 🌟 סטייטים חדשים עבור חלון איפוס הסיסמה
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMessage, setForgotMessage] = useState("");
    const [forgotError, setForgotError] = useState("");

    async function handleRegister() {
        setError(null);

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

        setLoading(true);

        const res = await fetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
        });

        setLoading(false);

        if (res.ok) {
            setError("נרשמת בהצלחה! עכשיו אפשר להתחבר");
            setMode("login");
            setTermsAccepted(false);
            setPassword("");
        } else {
            const data = await res.json();
            if (data.error === "user exists") {
                setError("כתובת האימייל הזו כבר רשומה במערכת. אנא עבור למסך ההתחברות כדי להיכנס.");
            } else {
                setError("אירעה שגיאה בהרשמה. אנא נסה שוב מאוחר יותר.");
            }
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

    function handleSocialLogin(provider: string) {
        signIn(provider, { callbackUrl: "/" });
    }

    function isValidEmail(email: string) {
        return /\S+@\S+\.\S+/.test(email);
    }

    // 🌟 הפונקציה ששולחת את בקשת שחזור הסיסמה לשרת
    async function handleForgotPassword() {
        setForgotError("");
        setForgotMessage("");

        if (!isValidEmail(forgotEmail)) {
            setForgotError("אנא הזן כתובת אימייל תקינה");
            return;
        }

        setForgotLoading(true);
        try {
            // 👇 כאן התיקון! הורדנו את המילה auth מהנתיב
            const res = await fetch("/api/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email: forgotEmail })
            });

            if (res.ok) {
                setForgotMessage("אם האימייל קיים במערכת, נשלח אליו כעת קישור לאיפוס סיסמה.");
            } else {
                setForgotError("אירעה שגיאה. אנא נסה שוב מאוחר יותר.");
            }
        } catch (err) {
            setForgotError("אירעה שגיאה בתקשורת. אנא נסה שוב.");
        } finally {
            setForgotLoading(false);
        }
    }

    const isTermsMissing = !termsAccepted;

    const router = useRouter();

    return (

        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4 relative" dir="rtl">

            {/* 🌟 הכפתור החדש: בולט, באנגלית, ממוקם למעלה בצד ימין של המסך */}
            <button
                onClick={() => router.push("/")}
                className="absolute top-6 right-6 flex items-center gap-2 text-sm font-bold text-gray-300 hover:text-yellow-500 bg-gray-900 border border-gray-700 hover:border-yellow-500 px-5 py-2 rounded-full transition-all z-50 shadow-lg"
                dir="ltr"
            >
                Back to Map
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
            </button>

            <div className="flex flex-col gap-6 w-full max-w-sm p-8 bg-[#0a0a0a] border border-gray-800 rounded-2xl shadow-[0_0_25px_rgba(255,215,0,0.03)] relative overflow-hidden">

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
                    <div className="bg-red-950/50 border border-red-500 text-red-200 text-sm p-3 rounded-lg text-center transition-all">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-4">
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

                    <div className="flex flex-col gap-1.5">
                        <input
                            placeholder="סיסמה"
                            type="password"
                            value={password}
                            className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        {/* 🌟 קישור שכחתי סיסמה (מופיע רק במצב התחברות) */}
                        {mode === "login" && (
                            <div className="flex justify-start px-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForgotEmail(email); // מעתיק את האימייל אם הוא כבר הקליד
                                        setShowForgotModal(true);
                                    }}
                                    className="text-xs text-yellow-500 hover:text-yellow-400 transition"
                                >
                                    שכחתי סיסמה
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`p-4 rounded-xl border transition-colors duration-300 ${isTermsMissing
                    ? "border-red-900/50 bg-red-950/20"
                    : "border-green-900/50 bg-green-950/20"
                    }`}>
                    <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            id="terms"
                            checked={termsAccepted}
                            onChange={(e) => {
                                setTermsAccepted(e.target.checked);
                                if (e.target.checked) setError(null);
                            }}
                            className="w-5 h-5 mt-0.5 accent-yellow-500 cursor-pointer rounded shrink-0"
                        />
                        <label htmlFor="terms" className="text-sm text-gray-300 cursor-pointer leading-relaxed">
                            אני מאשר/ת שקראתי והבנתי את
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setShowTermsModal(true);
                                }}
                                className="text-yellow-500 hover:text-yellow-400 font-bold underline underline-offset-2 mx-1 transition-colors"
                            >
                                תקנון האתר
                            </button>
                            ומסכים/ה לתנאיו במלואם.
                        </label>
                    </div>
                </div>

                <button
                    onClick={mode === "login" ? handleLogin : handleRegister}
                    disabled={loading || isTermsMissing}
                    className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_10px_rgba(255,215,0,0.2)]"
                >
                    {loading ? "טוען..." : mode === "login" ? "התחברות באמצעות אימייל" : "הרשמה באמצעות אימייל"}
                </button>

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-800"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-600 text-sm">או</span>
                    <div className="flex-grow border-t border-gray-800"></div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => handleSocialLogin("github")}
                        disabled={isTermsMissing}
                        className={`flex items-center justify-center gap-3 border p-3 rounded-lg transition-all duration-300 ${isTermsMissing
                            ? "border-gray-800 bg-[#111] text-gray-600 opacity-50 cursor-not-allowed grayscale"
                            : "border-gray-700 bg-[#111] text-white hover:bg-gray-800"
                            }`}
                    >
                        <img
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"
                            className={`w-5 h-5 ${isTermsMissing ? "opacity-50" : "invert"}`}
                            alt="GitHub"
                        />
                        <span className="text-sm">המשך עם GitHub</span>
                    </button>

                    <button
                        onClick={() => handleSocialLogin("google")}
                        disabled={isTermsMissing}
                        className={`flex items-center justify-center gap-3 border p-3 rounded-lg transition-all duration-300 ${isTermsMissing
                            ? "border-gray-600 bg-gray-300 text-gray-500 opacity-50 cursor-not-allowed grayscale"
                            : "border-gray-300 bg-white text-black hover:bg-gray-100"
                            }`}
                    >
                        <img
                            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            className={`w-5 h-5 ${isTermsMissing ? "opacity-50 grayscale" : ""}`}
                            alt="Google"
                        />
                        <span className="text-sm font-medium">המשך עם Google</span>
                    </button>
                </div>

                <div className="text-center mt-2">
                    <button
                        onClick={() => {
                            setMode(mode === "login" ? "register" : "login");
                            setError(null);
                        }}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        {mode === "login" ? "אין לך חשבון? צור חשבון חדש" : "כבר יש לך חשבון? התחבר כאן"}
                    </button>
                </div>
            </div>

            {/* 🌟 חלון מודאל: שכחתי סיסמה */}
            {showForgotModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-[#111] border border-gray-800 p-8 rounded-2xl w-full max-w-sm shadow-2xl relative">
                        <button
                            onClick={() => {
                                setShowForgotModal(false);
                                setForgotMessage("");
                                setForgotError("");
                            }}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl"
                        >
                            ✕
                        </button>

                        <h2 className="text-2xl font-bold text-yellow-500 mb-2">איפוס סיסמה</h2>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            הכנס את כתובת האימייל איתה נרשמת, ואנחנו נשלח לך קישור מאובטח לבחירת סיסמה חדשה.
                        </p>

                        {forgotMessage ? (
                            <div className="bg-green-950/50 border border-green-500 text-green-200 text-sm p-4 rounded-lg text-center mb-4">
                                {forgotMessage}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <input
                                    placeholder="אימייל"
                                    type="email"
                                    value={forgotEmail}
                                    className="p-3 w-full bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                />
                                {forgotError && <p className="text-red-500 text-xs px-1">{forgotError}</p>}

                                <button
                                    onClick={handleForgotPassword}
                                    disabled={forgotLoading}
                                    className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold p-3 rounded-lg disabled:opacity-50 transition-all shadow-md mt-2"
                                >
                                    {forgotLoading ? "שולח בקשה..." : "שלח קישור לאיפוס"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* מודאל תקנון דו-לשוני עברית ואנגלית */}
            {showTermsModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111] border border-gray-800 p-6 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
                        {/* השארתי את תוכן התקנון כרגיל... */}
                        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2 shrink-0">
                            <h2 className="text-xl font-bold text-yellow-500">תקנון האתר / Terms of Service</h2>
                        </div>
                        <div className="text-gray-300 text-sm leading-relaxed mb-6 overflow-y-auto custom-scrollbar flex-grow pr-4">
                            <div dir="rtl" className="text-right space-y-4">
                                <p className="font-semibold text-white text-base text-center">תקנון ותנאי שימוש באפליקציית JSeed</p>
                                <p>ברוכים הבאים לאפליקציית JSeed...</p>
                                <p className="text-yellow-500/80 italic mt-6 text-center">הערה: השימוש בשירות מהווה אישור...</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowTermsModal(false)}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium p-3 rounded-lg transition-colors mt-auto shrink-0"
                        >
                            סגירה
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}