import { prisma } from "@/src/lib/prisma";

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

        // 🌟 הטריק שלנו: מדפיסים את הלינק לטרמינל במקום לשלוח למייל כרגע
        console.log("===========================================");
        console.log("🔗 RESET LINK:", resetLink);
        console.log("===========================================");

        return Response.json({ success: true });
    } catch (error) {
        console.error("Forgot password error:", error);
        return Response.json({ error: "Failed to send email" }, { status: 500 });
    }
}