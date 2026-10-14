import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

// 🌟 חובה להוסיף את זה כדי ש-Next.js לא יתקע לנו גרסה ישנה של ההתראות!
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { 
        userId: session.user.id,
        // 🌟 מחקנו את התנאי של isRead: false, כדי שנראה את כל ההיסטוריה!
      },
      orderBy: { createdAt: "desc" }, // הכי חדש למעלה
      take: 50, // כדאי להגביל ל-50 התראות אחרונות כדי שהדף לא יהיה כבד מדי
    });

    return NextResponse.json(notifications);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // מסמן את כל ההתראות של המשתמש הזה כנקראו
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