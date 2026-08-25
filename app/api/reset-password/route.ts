import { prisma } from "@/src/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const { token, password } = await req.json();

        if (!token || !password) {
            return Response.json({ error: "חסרים נתונים" }, { status: 400 });
        }

        // 1. מחפשים את האסימון במסד הנתונים
        const resetRecord = await prisma.passwordResetToken.findUnique({
            where: { token }
        });

        if (!resetRecord) {
            return Response.json({ error: "קישור לא חוקי או שכבר נעשה בו שימוש" }, { status: 400 });
        }

        // 2. בודקים אם פג תוקף (עברה שעה)
        if (new Date() > resetRecord.expires) {
            // מוחקים את האסימון הישן
            await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } });
            return Response.json({ error: "פג תוקפו של הקישור. אנא בקש קישור חדש." }, { status: 400 });
        }

        // 3. מצפינים את הסיסמה החדשה
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. מעדכנים את המשתמש במסד הנתונים
        await prisma.user.update({
            where: { email: resetRecord.email },
            data: { password: hashedPassword }
        });

        // 5. מוחקים את האסימון כדי שלא יהיה אפשר להשתמש באותו לינק שוב!
        await prisma.passwordResetToken.delete({
            where: { id: resetRecord.id }
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error("Reset password error:", error);
        return Response.json({ error: "שגיאה בעדכון הסיסמה" }, { status: 500 });
    }
}