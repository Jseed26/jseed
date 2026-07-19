import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // מסמן את כל ההתראות של המשתמש הזה כ-isRead: true
    await prisma.notification.updateMany({
      where: { 
        userId: session.user.id,
        isRead: false
      },
      data: { isRead: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}