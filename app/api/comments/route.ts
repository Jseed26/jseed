import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export const dynamic = 'force-dynamic';

// שליפת תגובות לפי pointId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");

  if (!pointId) {
    return NextResponse.json({ error: "Missing pointId" }, { status: 400 });
  }

  try {
    const comments = await prisma.comment.findMany({
      where: { pointId: Number(pointId) },
      include: {
        user: { select: { id: true, name: true, image: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(comments);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// הוספת תגובה חדשה
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { pointId, content } = await req.json();

    if (!pointId || !content || !content.trim()) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const newComment = await prisma.comment.create({
      data: {
        content: content.trim(),
        pointId: Number(pointId),
        userId: session.user.id
      },
      include: {
        user: { select: { id: true, name: true, image: true } }
      }
    });

    return NextResponse.json(newComment);
  } catch (error) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}