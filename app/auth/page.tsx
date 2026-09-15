"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// מילון תרגומים מלא למסך ההתחברות
const tAuth = {
    backToMap: { he: "חזרה למפה", en: "Back to Map" },
    welcome: { he: "ברוכים השבים", en: "Welcome Back" },
    createAccount: { he: "יצירת משתמש", en: "Create Account" },
    loginDesc: { he: "התחברו כדי להמשיך ל-JSeed", en: "Log in to continue to JSeed" },
    registerDesc: { he: "הצטרפו לקהילת JSeed", en: "Join the JSeed community" },
    namePlaceholder: { he: "שם מלא / כינוי", en: "Full Name / Nickname" },
    emailPlaceholder: { he: "אימייל", en: "Email" },
    passPlaceholder: { he: "סיסמה", en: "Password" },
    forgotPass: { he: "שכחתי סיסמה", en: "Forgot Password" },
    loading: { he: "טוען...", en: "Loading..." },
    loginBtn: { he: "התחברות באמצעות אימייל", en: "Log in with Email" },
    registerBtn: { he: "הרשמה באמצעות אימייל", en: "Sign up with Email" },
    or: { he: "או", en: "or" },
    continueGithub: { he: "המשך עם GitHub", en: "Continue with GitHub" },
    continueGoogle: { he: "המשך עם Google", en: "Continue with Google" },
    noAccount: { he: "אין לך חשבון? צור חשבון חדש", en: "Don't have an account? Create one" },
    haveAccount: { he: "כבר יש לך חשבון? התחבר כאן", en: "Already have an account? Log in here" },
    resetTitle: { he: "איפוס סיסמה", en: "Reset Password" },
    resetDesc: { he: "הכנס את כתובת האימייל איתה נרשמת, ואנחנו נשלח לך קישור מאובטח לבחירת סיסמה חדשה.", en: "Enter your registered email address, and we will send you a secure link to choose a new password." },
    sending: { he: "שולח בקשה...", en: "Sending request..." },
    sendReset: { he: "שלח קישור לאיפוס", en: "Send reset link" },
    close: { he: "סגירה", en: "Close" },

    // תקנון וכללים חדשים
    rulesIntro: {
        he: "הפלטפורמה שלנו מבוססת על חיבור, כבוד ותחושת שייכות. כדי לשמור על ערכים אלו, כל משתמש מתבקש לקרוא ולאשר את כללי הפרסום הבאים לפני העלאת תוכן:",
        en: "Our platform is built on connection, respect, and a sense of belonging. To maintain these values, every user is requested to read and approve the following publishing guidelines:"
    },
    box1Full: {
        he: "אני מאשר/ת כי ידוע לי שחל איסור לפרסם בפלטפורמה תוכן פוליטי, מפלגתי או תעמולתי.",
        en: "I confirm that I am aware it is strictly prohibited to publish political, partisan, or propagandist content."
    },
    box2Full: {
        he: "אני מאשר/ת כי לא אפרסם תוכן אנטישמי, גזעני, מסית, מאיים, משפיל, מפלה או פוגעני כלפי אדם או קבוצה.",
        en: "I confirm that I will not publish antisemitic, racist, inciting, threatening, degrading, discriminatory, or offensive content against any individual or group."
    },
    box3Full: {
        he: "אני מתחייב/ת לשמור על תוכן מכבד ולהימנע מדברי שנאה או תוכן המעודד אלימות.",
        en: "I commit to maintaining respectful content and avoiding hate speech or content that encourages violence."
    },
    box4Full: {
        he: "אני מאשר/ת כי אני אחראי/ת לתוכן שאעלה לפלטפורמה וכי לא אפרסם תוכן המפר חוק, זכויות יוצרים, פרטיות או זכויות של צד שלישי.",
        en: "I confirm that I am responsible for the content I upload and that I will not publish content that violates laws, copyrights, privacy, or third-party rights."
    },
    box5Full: {
        he: "אני מאשר/ת כי ידוע לי שמנהלי הפלטפורמה רשאים לבדוק, להסתיר, להגביל או להסיר תוכן שאינו עומד בנהלים או שאינו תואם את מטרות וערכי הפלטפורמה.",
        en: "I confirm that I am aware platform administrators reserve the right to review, hide, limit, or remove content that does not comply with the guidelines or align with the platform's goals and values."
    },
    box6Full: {
        he: "אני מאשר/ת כי ידוע לי שהפרה של הנהלים, ובפרט הפרות חוזרות או חמורות, עשויה להביא להגבלת אפשרות הפרסום, להשעיית החשבון או לחסימתו.",
        en: "I confirm that I am aware that violating the guidelines, especially repeated or severe violations, may result in restricted publishing privileges, account suspension, or banning."
    },
    box7Before: { he: "אישור סופי: אני מאשר/ת שקראתי והבנתי את הנהלים ואת ", en: "Final Confirmation: I confirm that I have read and understood the guidelines and the " },
    box7Link: { he: "תקנון האתר", en: "Terms of Service" },
    box7After: { he: ", ואני מסכים/ה לפעול בהתאם להם.", en: ", and I agree to comply with them." },

    // שגיאות
    errName: { he: "יש להזין שם (לפחות 2 אותיות)", en: "Name must be at least 2 characters" },
    errEmail: { he: "האימייל שהוזן לא תקין", en: "Invalid email address" },
    errPass: { he: "סיסמה חייבת להיות לפחות 6 תווים", en: "Password must be at least 6 characters" },
    successReg: { he: "נרשמת בהצלחה! עכשיו אפשר להתחבר", en: "Successfully registered! You can now log in" },
    errUserExists: { he: "כתובת האימייל הזו כבר רשומה במערכת. אנא עבור למסך ההתחברות כדי להיכנס.", en: "This email is already registered. Please go to the login screen to sign in." },
    errRegDetails: { he: "אירעה שגיאה בהרשמה. אנא נסה שוב מאוחר יותר.", en: "An error occurred during registration. Please try again later." },
    errLogin: { he: "אימייל או סיסמה לא נכונים", en: "Incorrect email or password" },
    msgResetSent: { he: "אם האימייל קיים במערכת, נשלח אליו כעת קישור לאיפוס סיסמה.", en: "If the email exists in the system, a password reset link has been sent." },
    errGen: { he: "אירעה שגיאה. אנא נסה שוב מאוחר יותר.", en: "An error occurred. Please try again later." },
    errComm: { he: "אירעה שגיאה בתקשורת. אנא נסה שוב.", en: "Communication error. Please try again." },
};

export default function AuthPage() {
    const [lang, setLang] = useState<"en" | "he">("he");

    useEffect(() => {
        const savedLang = localStorage.getItem("jseed_lang") as "en" | "he";
        if (savedLang) setLang(savedLang);
    }, []);

    const [mode, setMode] = useState<"login" | "register">("login");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    const [showTermsModal, setShowTermsModal] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMessage, setForgotMessage] = useState("");
    const [forgotError, setForgotError] = useState("");

    // 🌟 7 סטייטים לאישורים
    const [agreements, setAgreements] = useState({
        box1: false,
        box2: false,
        box3: false,
        box4: false,
        box5: false,
        box6: false,
        box7: false,
    });

    const isTermsMissing = !(
        agreements.box1 && agreements.box2 && agreements.box3 &&
        agreements.box4 && agreements.box5 && agreements.box6 && agreements.box7
    );

    const handleCheckboxChange = (boxId: keyof typeof agreements) => {
        setAgreements((prev) => {
            const newState = { ...prev, [boxId]: !prev[boxId] };
            if (Object.values(newState).every(Boolean)) setError(null);
            return newState;
        });
    };

    // המערך של תיבות הסימון
    const checkboxesData = [
        { id: "box1", textBefore: tAuth.box1Full[lang], linkText: "", textAfter: "", onClick: null, isBold: false },
        { id: "box2", textBefore: tAuth.box2Full[lang], linkText: "", textAfter: "", onClick: null, isBold: false },
        { id: "box3", textBefore: tAuth.box3Full[lang], linkText: "", textAfter: "", onClick: null, isBold: false },
        { id: "box4", textBefore: tAuth.box4Full[lang], linkText: "", textAfter: "", onClick: null, isBold: false },
        { id: "box5", textBefore: tAuth.box5Full[lang], linkText: "", textAfter: "", onClick: null, isBold: false },
        { id: "box6", textBefore: tAuth.box6Full[lang], linkText: "", textAfter: "", onClick: null, isBold: false },
        {
            id: "box7",
            textBefore: tAuth.box7Before[lang],
            linkText: tAuth.box7Link[lang],
            textAfter: tAuth.box7After[lang],
            onClick: () => setShowTermsModal(true),
            isBold: true // סימון כדי להדגיש את התיבה האחרונה
        },
    ] as const;

    async function handleRegister() {
        setError(null);

        if (name.trim().length < 2) {
            setError(tAuth.errName[lang]);
            return;
        }

        if (!isValidEmail(email)) {
            setError(tAuth.errEmail[lang]);
            return;
        }

        if (password.length < 6) {
            setError(tAuth.errPass[lang]);
            return;
        }

        setLoading(true);

        const res = await fetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
        });

        setLoading(false);

        if (res.ok) {
            setError(tAuth.successReg[lang]);
            setMode("login");
            setAgreements({ box1: false, box2: false, box3: false, box4: false, box5: false, box6: false, box7: false });
            setPassword("");
        } else {
            const data = await res.json();
            if (data.error === "user exists") {
                setError(tAuth.errUserExists[lang]);
            } else {
                setError(tAuth.errRegDetails[lang]);
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
            setError(tAuth.errLogin[lang]);
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

    async function handleForgotPassword() {
        setForgotError("");
        setForgotMessage("");

        if (!isValidEmail(forgotEmail)) {
            setForgotError(tAuth.errEmail[lang]);
            return;
        }

        setForgotLoading(true);
        try {
            const res = await fetch("/api/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email: forgotEmail })
            });

            if (res.ok) {
                setForgotMessage(tAuth.msgResetSent[lang]);
            } else {
                setForgotError(tAuth.errGen[lang]);
            }
        } catch (err) {
            setForgotError(tAuth.errComm[lang]);
        } finally {
            setForgotLoading(false);
        }
    }

    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4 relative" dir={lang === "he" ? "rtl" : "ltr"}>

            <button
                onClick={() => router.push("/")}
                className={`absolute top-6 ${lang === "he" ? "right-6" : "left-6"} flex items-center gap-2 text-sm font-bold text-gray-300 hover:text-yellow-500 bg-gray-900 border border-gray-700 hover:border-yellow-500 px-5 py-2 rounded-full transition-all z-50 shadow-lg`}
                dir="ltr"
            >
                {lang === "he" ? tAuth.backToMap.he : tAuth.backToMap.en}
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${lang === "en" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
            </button>

            <div className="flex flex-col gap-5 w-full max-w-sm p-8 bg-[#0a0a0a] border border-gray-800 rounded-2xl shadow-[0_0_25px_rgba(255,215,0,0.03)] relative overflow-hidden">

                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-yellow-500 opacity-50 blur-[10px]"></div>

                <div className="text-center space-y-1">
                    <h1 className="text-2xl font-bold tracking-wide">
                        {mode === "login" ? tAuth.welcome[lang] : tAuth.createAccount[lang]}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {mode === "login" ? tAuth.loginDesc[lang] : tAuth.registerDesc[lang]}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-950/50 border border-red-500 text-red-200 text-sm p-3 rounded-lg text-center transition-all">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    {mode === "register" && (
                        <input
                            placeholder={tAuth.namePlaceholder[lang]}
                            type="text"
                            value={name}
                            className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all text-sm"
                            onChange={(e) => setName(e.target.value)}
                        />
                    )}

                    <input
                        placeholder={tAuth.emailPlaceholder[lang]}
                        type="email"
                        value={email}
                        className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all text-sm"
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <div className="flex flex-col gap-1.5">
                        <input
                            placeholder={tAuth.passPlaceholder[lang]}
                            type="password"
                            value={password}
                            className="p-3 w-full bg-[#111] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all text-sm"
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        {mode === "login" && (
                            <div className="flex justify-start px-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForgotEmail(email);
                                        setShowForgotModal(true);
                                    }}
                                    className="text-xs text-yellow-500 hover:text-yellow-400 transition"
                                >
                                    {tAuth.forgotPass[lang]}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 🌟 אזור הנהלים הנגלל (מכיל את הטקסט המקדים ואת 7 התיבות) */}
                <div className={`p-4 rounded-xl border transition-colors duration-300 ${isTermsMissing
                    ? "border-red-900/50 bg-red-950/20"
                    : "border-green-900/50 bg-green-950/20"
                    }`}>

                    <p className="text-[11px] text-gray-400 leading-relaxed mb-3 text-justify">
                        {tAuth.rulesIntro[lang]}
                    </p>

                    <div className="flex flex-col gap-4 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                        {checkboxesData.map((box) => (
                            <div key={box.id} className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id={box.id}
                                    checked={agreements[box.id as keyof typeof agreements]}
                                    onChange={() => handleCheckboxChange(box.id as keyof typeof agreements)}
                                    className="w-4 h-4 mt-0.5 accent-yellow-500 cursor-pointer rounded shrink-0"
                                />
                                <label
                                    htmlFor={box.id}
                                    className={`text-xs cursor-pointer leading-relaxed ${box.isBold ? "text-white font-bold" : "text-gray-300"}`}
                                >
                                    {box.textBefore}
                                    {box.linkText && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                box.onClick?.();
                                            }}
                                            className="text-yellow-500 hover:text-yellow-400 font-bold underline underline-offset-2 transition-colors mx-1"
                                        >
                                            {box.linkText}
                                        </button>
                                    )}
                                    {box.textAfter}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={mode === "login" ? handleLogin : handleRegister}
                    disabled={loading || isTermsMissing}
                    className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_10px_rgba(255,215,0,0.2)]"
                >
                    {loading ? tAuth.loading[lang] : mode === "login" ? tAuth.loginBtn[lang] : tAuth.registerBtn[lang]}
                </button>

                <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-gray-800"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-600 text-sm">{tAuth.or[lang]}</span>
                    <div className="flex-grow border-t border-gray-800"></div>
                </div>

                <div className="flex flex-col gap-2.5">
                    <button
                        onClick={() => handleSocialLogin("github")}
                        disabled={isTermsMissing}
                        className={`flex items-center justify-center gap-3 border p-2.5 rounded-lg transition-all duration-300 ${isTermsMissing
                            ? "border-gray-800 bg-[#111] text-gray-600 opacity-50 cursor-not-allowed grayscale"
                            : "border-gray-700 bg-[#111] text-white hover:bg-gray-800"
                            }`}
                    >
                        <img
                            src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"
                            className={`w-5 h-5 ${isTermsMissing ? "opacity-50" : "invert"}`}
                            alt="GitHub"
                        />
                        <span className="text-sm">{tAuth.continueGithub[lang]}</span>
                    </button>

                    <button
                        onClick={() => handleSocialLogin("google")}
                        disabled={isTermsMissing}
                        className={`flex items-center justify-center gap-3 border p-2.5 rounded-lg transition-all duration-300 ${isTermsMissing
                            ? "border-gray-600 bg-gray-300 text-gray-500 opacity-50 cursor-not-allowed grayscale"
                            : "border-gray-300 bg-white text-black hover:bg-gray-100"
                            }`}
                    >
                        <img
                            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            className={`w-5 h-5 ${isTermsMissing ? "opacity-50 grayscale" : ""}`}
                            alt="Google"
                        />
                        <span className="text-sm font-medium">{tAuth.continueGoogle[lang]}</span>
                    </button>
                </div>

                <div className="text-center mt-1">
                    <button
                        onClick={() => {
                            setMode(mode === "login" ? "register" : "login");
                            setError(null);
                        }}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        {mode === "login" ? tAuth.noAccount[lang] : tAuth.haveAccount[lang]}
                    </button>
                </div>
            </div>

            {/* חלון מודאל: שכחתי סיסמה */}
            {showForgotModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-[#111] border border-gray-800 p-8 rounded-2xl w-full max-w-sm shadow-2xl relative">
                        <button
                            onClick={() => {
                                setShowForgotModal(false);
                                setForgotMessage("");
                                setForgotError("");
                            }}
                            className={`absolute top-4 ${lang === "he" ? "left-4" : "right-4"} text-gray-500 hover:text-white text-xl`}
                        >
                            ✕
                        </button>

                        <h2 className="text-2xl font-bold text-yellow-500 mb-2">{tAuth.resetTitle[lang]}</h2>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            {tAuth.resetDesc[lang]}
                        </p>

                        {forgotMessage ? (
                            <div className="bg-green-950/50 border border-green-500 text-green-200 text-sm p-4 rounded-lg text-center mb-4">
                                {forgotMessage}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <input
                                    placeholder={tAuth.emailPlaceholder[lang]}
                                    type="email"
                                    value={forgotEmail}
                                    className="p-3 w-full bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all text-sm"
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                />
                                {forgotError && <p className="text-red-500 text-xs px-1">{forgotError}</p>}

                                <button
                                    onClick={handleForgotPassword}
                                    disabled={forgotLoading}
                                    className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold p-3 rounded-lg disabled:opacity-50 transition-all shadow-md mt-2"
                                >
                                    {forgotLoading ? tAuth.sending[lang] : tAuth.sendReset[lang]}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* מודאל תקנון */}
            {showTermsModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111] border border-gray-800 p-6 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
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
                            {tAuth.close[lang]}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}