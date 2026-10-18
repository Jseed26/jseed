"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const t = {
    title: { he: "תקנון האתר", en: "Terms of Service" },
    back: { he: "חזרה", en: "Back" },
    genderNote: { 
        he: "התקנון מנוסח במין זכר אך פונה לשני המינים כאחד.", 
        en: "The terms are formulated in the masculine gender but address both genders equally." 
    },
};

export default function TermsPage() {
    const router = useRouter();
    const [lang, setLang] = useState<"en" | "he">("he");

    useEffect(() => {
        const savedLang = localStorage.getItem("jseed_lang") as "en" | "he";
        if (savedLang) setLang(savedLang);
    }, []);

    return (
        <div className="min-h-screen bg-black text-gray-300 p-6 sm:p-10 font-sans" dir={lang === "he" ? "rtl" : "ltr"}>
            <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl relative">
                
                {/* כפתור חזרה */}
                <button
                    onClick={() => router.back()}
                    className={`absolute top-6 ${lang === "he" ? "left-6" : "right-6"} flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-yellow-500 bg-black border border-gray-700 px-4 py-2 rounded-lg transition-colors`}
                    dir="ltr"
                >
                    {t.back[lang]}
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${lang === "en" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </button>

                <h1 className="text-3xl font-bold text-yellow-500 mb-8 border-b border-gray-800 pb-4 pr-2">
                    {t.title[lang]}
                </h1>

                {lang === "he" ? (
                    <div className="space-y-6 text-base leading-relaxed pl-4">
                        <p>ברוכים הבאים לאפליקציית JSeed. השימוש באפליקציה ובתכנים המוצגים בה כפוף לתנאים המפורטים בתקנון זה. השימוש באפליקציה מעיד על הסכמתך המלאה לתנאים אלו, ועל כן אנו ממליצים לקרוא אותם בעיון.</p>
                        
                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">1. בעלות ותוכן משתמשים</h3>
                            <ul className="list-disc list-inside space-y-2 pr-2">
                                <li><strong className="text-white">אחריות בלעדית:</strong> כל תוכן שיועלה לאפליקציה על ידי המשתמש הוא באחריותו הבלעדית של המשתמש בלבד.</li>
                                <li><strong className="text-white">קניין רוחני:</strong> המשתמש מצהיר ומתחייב כי כל תוכן המועלה על ידו הינו בבעלותו המלאה או שבידיו מלוא ההרשאות הנדרשות.</li>
                                <li><strong className="text-white">הסרת אחריות:</strong> JSeed אינם נושאים באחריות בגין הפרת זכויות יוצרים או כל נזק שייגרם כתוצאה מתוכן שהעלה משתמש. המשתמש מתחייב לשפות את JSeed בגין כל תביעה בנושא זה.</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">2. התנהלות הקהילה ושימוש בטוח</h3>
                            <ul className="list-disc list-inside space-y-2 pr-2">
                                <li><strong className="text-white">איסור פגיעה:</strong> אין להעלות תכנים פוגעניים, מסיתים, גזעניים או כל תוכן העלול לפגוע באחר.</li>
                                <li><strong className="text-white text-red-400">איסור מיסיונריות:</strong> חל איסור מוחלט על פרסום, העלאה או שיתוף של תוכן בעל אופי מיסיונרי המעודד המרת דת או פעילות מיסיונרית מכל סוג שהוא.</li>
                                <li><strong className="text-white">שימוש הוגן:</strong> אין להשתמש באפליקציה לצרכים מסחריים שאינם מאושרים או לבצע סריקת נתונים (Scraping).</li>
                                <li><strong className="text-white">קטינים:</strong> השימוש באפליקציה מותר למשתמשים העומדים בתנאי הגיל המוגדרים בחוק.</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">3. מדיניות דיווח והסרת תוכן (Notice and Takedown)</h3>
                            <ul className="list-disc list-inside space-y-2 pr-2">
                                <li><strong className="text-white">מנגנון דיווח:</strong> ניתן לדווח על תוכן מפר זכויות באמצעות כפתור הדיווח באפליקציה.</li>
                                <li><strong className="text-white">טיפול:</strong> JSeed שומרת את הזכות להסיר תוכן בהתאם לשיקול דעתה ללא הודעה מוקדמת. פעולת ההסרה אינה הכרה באחריות משפטית.</li>
                                <li><strong className="text-white">אמינות דיווח:</strong> דיווחים שקריים או זדוניים יטופלו בחומרה ועלולים להוביל לחסימת המשתמש.</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">4. פרטיות המשתמש</h3>
                            <p className="pr-2">המידע האישי שנאסף באפליקציה נשמר בהתאם למדיניות הפרטיות שלנו. השימוש באפליקציה מהווה הסכמה לאיסוף ושמירה של נתונים טכניים ותוכן שהועלה לטובת תפעול המערכת.</p>
                        </div>

                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">5. סמכות שיפוט וסיום התקשרות</h3>
                            <ul className="list-disc list-inside space-y-2 pr-2">
                                <li>JSeed שומרת לעצמה את הזכות לחסום משתמש בכל עת במקרה של חשש להפרת התקנון.</li>
                                <li>על תקנון זה יחולו חוקי מדינת ישראל בלבד. כל סכסוך משפטי יתברר בבתי המשפט המוסמכים במחוז הרלוונטי.</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 text-base leading-relaxed pr-4">
                        <p>Welcome to the JSeed app. The use of the app and its content is subject to the terms detailed in these Terms of Service. Using the app indicates your full agreement to these terms, and therefore we recommend reading them carefully.</p>
                        
                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">1. Ownership and User Content</h3>
                            <ul className="list-disc list-inside space-y-2 pl-2">
                                <li><strong className="text-white">Sole Responsibility:</strong> Any content uploaded to the app by the user is the sole responsibility of the user.</li>
                                <li><strong className="text-white">Intellectual Property:</strong> The user declares and warrants that all content uploaded by them is fully owned by them or that they have all the required permissions.</li>
                                <li><strong className="text-white">Platform Disclaimer:</strong> JSeed bears no responsibility for any copyright infringement or damage caused by user content. The user agrees to indemnify JSeed for any claim related to this section.</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">2. Community Conduct and Safe Use</h3>
                            <ul className="list-disc list-inside space-y-2 pl-2">
                                <li><strong className="text-white">No Harmful Content:</strong> Do not upload offensive, inciting, racist, or harmful content.</li>
                                <li><strong className="text-white text-red-400">Strict Prohibition on Missionary Content:</strong> It is strictly forbidden to publish or share content of a missionary nature encouraging religious conversion.</li>
                                <li><strong className="text-white">Fair Use:</strong> Do not use the app for unapproved commercial purposes or perform data scraping.</li>
                                <li><strong className="text-white">Minors:</strong> Use of the app is permitted for users meeting the legally defined age requirements.</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">3. Notice and Takedown Policy</h3>
                            <ul className="list-disc list-inside space-y-2 pl-2">
                                <li><strong className="text-white">Reporting Mechanism:</strong> Users can report violating content using the "Report" button in the app.</li>
                                <li><strong className="text-white">Handling Reports:</strong> JSeed reserves the right to remove content at its sole discretion without prior notice.</li>
                                <li><strong className="text-white">Reporting Integrity:</strong> False or malicious reports will be treated severely and may lead to the reporting user being banned.</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">4. User Privacy</h3>
                            <p className="pl-2">Personal information collected in the app is kept in accordance with our Privacy Policy. Use of the app constitutes consent to the collection and storage of technical data and content for system operation purposes.</p>
                        </div>

                        <div>
                            <h3 className="font-bold text-yellow-500 text-lg mb-2">5. Jurisdiction and Termination</h3>
                            <ul className="list-disc list-inside space-y-2 pl-2">
                                <li>JSeed reserves the right to block a user or terminate access to the app at any time if there is a suspected violation of the terms.</li>
                                <li>These terms shall be governed solely by the laws of the State of Israel.</li>
                            </ul>
                        </div>
                    </div>
                )}
                
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-5 rounded-xl text-center mt-12 space-y-2">
                    <p className="text-yellow-500 italic font-medium">{lang === "he" ? "הערה: השימוש בשירות מהווה אישור כי קראת והבנת את תנאי התקנון." : "Note: Use of the service constitutes confirmation that you have read and understood the terms of service."}</p>
                    <p className="text-gray-400 text-xs">{lang === "he" ? "JSeed רשאית לעדכן את התקנון מעת לעת, ועדכון זה יחייב את המשתמשים מרגע פרסומו." : "JSeed may update these terms from time to time, and this update will bind users from the moment of its publication."}</p>
                    <p className="text-gray-400 text-xs font-semibold pt-2 border-t border-yellow-500/10">{t.genderNote[lang]}</p>
                </div>
            </div>
        </div>
    );
}