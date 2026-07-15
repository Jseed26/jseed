// טופס הוספת נקודות, אפשר למחוק אחרי הוספה.
// להיכנס לקישור ולבדוק שהוסף
// http://localhost:3000/api/seed

// import { prisma } from "@/src/lib/prisma";
// import { NextResponse } from "next/server";

// export async function GET() {
//     // המייל של המשתמש שייקבל את הבעלות על הנקודות
//     const USER_EMAIL = "natai2020@icloud.com"; 

//     try {
//         // מוודאים שהמשתמש קיים במערכת
//         const user = await prisma.user.findUnique({ 
//             where: { email: USER_EMAIL } 
//         });

//         if (!user) {
//             return NextResponse.json(
//                 { error: `המשתמש ${USER_EMAIL} לא נמצא! תוודאי שהוא נרשם לאתר קודם.` }, 
//                 { status: 404 }
//             );
//         }

//         // רשימת הנקודות של בתי חב"ד באוסטרליה
//         const dummyPoints = [
//             {
//                 name: "בית חב״ד אוסטרליה - סידני",
//                 description: "Chabad Rose Bay",
//                 category: "triangle",
//                 address: "427 Old South Head Rd, Rose Bay NSW 2029",
//                 latitude: -33.8767,
//                 longitude: 151.2763,
//                 userId: user.id, // 👈 התיקון כאן!
//                 linkClicks: 0
//             },
//             {
//                 name: "בית חב״ד הראשי של סידני",
//                 description: "Chabad NSW HQ",
//                 category: "triangle",
//                 address: "36a Flood St, Bondi Beach NSW 2026",
//                 latitude: -33.8899,
//                 longitude: 151.2612,
//                 userId: user.id, // 👈 התיקון כאן!
//                 linkClicks: 0
//             },
//             {
//                 name: "בית חב״ד קווינסלנד",
//                 description: "Chabad Gold Coast",
//                 category: "triangle",
//                 address: "48 The Corso, Surfers Paradise QLD 4217",
//                 latitude: -28.0051,
//                 longitude: 153.4244,
//                 userId: user.id, // 👈 התיקון כאן!
//                 linkClicks: 0
//             },
//             {
//                 name: "בית חב״ד מערב אוסטרליה",
//                 description: "Chabad WA (Coolbinia)",
//                 category: "triangle",
//                 address: "118 Coolbinia Dr, Coolbinia WA 6050",
//                 latitude: -31.9169,
//                 longitude: 115.8458,
//                 userId: user.id, // 👈 התיקון כאן!
//                 linkClicks: 0
//             }
//         ];

//         // מכניסים את כל הנקודות ל-DB
//         for (const point of dummyPoints) {
//             await prisma.point.create({
//                 data: point
//             });
//         }

//         return NextResponse.json({ message: "4 נקודות של בתי חב״ד נוספו בהצלחה!" });

//     } catch (error) {
//         console.error(error);
//         return NextResponse.json({ error: "משהו השתבש..." }, { status: 500 });
//     }
// }