import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
        include: { points: true, savedPoints: true, viewedPoints: true, accounts: true }
    });

    const emailMap = new Map<string, typeof users>();
    for (const u of users) {
        if (!u.email) continue;
        const lower = u.email.toLowerCase();
        if (!emailMap.has(lower)) emailMap.set(lower, []);
        emailMap.get(lower)!.push(u);
    }

    let mergedCount = 0;

    for (const [lowerEmail, duplicates] of emailMap.entries()) {
        if (duplicates.length > 1) {
            // ממיינים כדי לקחת את המשתמש הראשון (הכי ישן) כמשתמש המרכזי
            duplicates.sort((a, b) => a.id.localeCompare(b.id)); 
            const primary = duplicates[0];
            const others = duplicates.slice(1);

            // מוודאים שהמשתמש הראשי הוא עם מייל קטן
            await prisma.user.update({ where: { id: primary.id }, data: { email: lowerEmail } });

            for (const oldUser of others) {
                // 1. העברת הגרעינים שהעלה ליוזר הראשי
                await prisma.point.updateMany({
                    where: { userId: oldUser.id },
                    data: { userId: primary.id }
                });

                // 2. העברת שמירות (תוך מניעת התנגשויות)
                for (const saved of oldUser.savedPoints) {
                    const exists = await prisma.savedPoint.findUnique({
                        where: { userId_pointId: { userId: primary.id, pointId: saved.pointId } }
                    });
                    if (!exists) {
                        await prisma.savedPoint.update({ where: { id: saved.id }, data: { userId: primary.id } });
                    } else {
                        await prisma.savedPoint.delete({ where: { id: saved.id } });
                    }
                }

                // 3. העברת צפיות
                for (const viewed of oldUser.viewedPoints) {
                    const exists = await prisma.viewedPoint.findUnique({
                        where: { userId_pointId: { userId: primary.id, pointId: viewed.pointId } }
                    });
                    if (!exists) {
                        await prisma.viewedPoint.update({ where: { id: viewed.id }, data: { userId: primary.id } });
                    } else {
                        await prisma.viewedPoint.delete({ where: { id: viewed.id } });
                    }
                }

                // 4. העברת חשבונות חברתיים (Google/GitHub)
                await prisma.account.updateMany({ where: { userId: oldUser.id }, data: { userId: primary.id } });

                // 5. מחיקת היוזר המפוצל
                await prisma.user.delete({ where: { id: oldUser.id } });
            }
            mergedCount++;
        } else if (duplicates.length === 1 && duplicates[0].email !== lowerEmail) {
            // אם יש רק יוזר אחד אבל המייל שלו עם אות גדולה, נתקן לקטנה
            await prisma.user.update({ where: { id: duplicates[0].id }, data: { email: lowerEmail } });
        }
    }

    return NextResponse.json({ success: true, message: `Merged ${mergedCount} duplicated accounts and normalized all emails to lowercase.` });
  } catch (e) {
      console.error(e);
      return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}