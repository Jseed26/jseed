import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function DELETE(req: Request) {
  try {
    const session = await auth();

    // מוודאים שהמשתמש באמת מחובר
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prisma מוחק את המשתמש לפי האימייל שלו
    // בזכות ה-Cascade, מחיקת המשתמש תמחק אוטומטית גם את כל הנקודות שלו!
    await prisma.user.delete({
      where: {
        email: session.user.email,
      },
    });

    return NextResponse.json({ success: true, message: "Account and all related data deleted successfully." });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}