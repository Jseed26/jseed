import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST() {
    const session = await auth();
    
    // אם אין משתמש מחובר, אין מה לספור
    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { timeSpentMins: { increment: 1 } }
        });
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: "Failed to update time" }, { status: 500 });
    }
}