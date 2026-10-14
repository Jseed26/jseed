import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // מביא את 50 ההתראות האחרונות, גם אם נקראו וגם אם לא
    const notifications = await prisma.notification.findMany({
      where: { 
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50 
    });

    return NextResponse.json(notifications);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}