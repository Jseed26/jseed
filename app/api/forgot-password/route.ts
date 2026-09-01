import { prisma } from "@/src/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) {
            return Response.json({ success: true });
        }

        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 3600000); 

        await prisma.passwordResetToken.create({
            data: { email, token, expires }
        });

        const url = new URL(req.url);
        const resetLink = `${url.origin}/reset-password?token=${token}`;

        // מגדירים את החיבור ל-Gmail שלנו
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // מעצבים את תוכן המייל שהמשתמש יקבל
        const mailOptions = {
            from: `"JSeed" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "איפוס סיסמה לאפליקציית JSeed 🌱",
            html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                    <div style="background-color: #000; padding: 20px; text-align: center;">
                        <h2 style="color: #FFD700; margin: 0;">JSeed</h2>
                    </div>
                    <div style="padding: 30px; background-color: #fff;">
                        <h3 style="margin-top: 0;">שלום,</h3>
                        <p style="font-size: 16px; line-height: 1.5;">התקבלה בקשה לאיפוס הסיסמה שלך באפליקציית JSeed.</p>
                        <p style="font-size: 16px; line-height: 1.5;">כדי לבחור סיסמה חדשה, לחץ על הכפתור למטה:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="background-color: #FFD700; color: #000; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; font-size: 16px;">אפס סיסמה</a>
                        </div>
                        <p style="font-size: 14px; color: #777;">* הקישור תקף לשעה הקרובה.</p>
                        <p style="font-size: 14px; color: #777;">אם לא ביקשת לאפס את הסיסמה, אפשר להתעלם ממייל זה.</p>
                    </div>
                </div>
            `,
        };

        // שולחים בפועל!
        await transporter.sendMail(mailOptions);

        return Response.json({ success: true });
      
    } catch (error) {
        console.error("Forgot password error:", error);
        return Response.json({ error: "Failed to send email" }, { status: 500 });
    }
}