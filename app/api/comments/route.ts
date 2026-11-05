import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");
  const all = searchParams.get("all");

  try {
    if (all === "true") {
      const session = await auth();
      if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const adminCheck = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!adminCheck?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const comments = await prisma.comment.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          point: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      });
      return NextResponse.json(comments);
    }

    if (!pointId) {
      return NextResponse.json({ error: "Missing pointId" }, { status: 400 });
    }

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

    // 1. יצירת התגובה במסד הנתונים
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

    // 2. מציאת בעל הגרעין כדי לשלוח לו התראה
    const point = await prisma.point.findUnique({
      where: { id: Number(pointId) },
      select: { userId: true, name: true }
    });

    // 3. יצירת התראה רק אם יש בעלים והוא שונה מהמשתמש שהגיב עכשיו
    if (point?.userId && point.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: point.userId,
          message: `מישהו הרגע הגיב לגרעין שלך: "${point.name}"! 💬`,
          isRead: false,
        }
      });
    }

    return NextResponse.json(newComment);
  } catch (error) {
    console.error("Failed to add comment & notification:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const commentId = searchParams.get("id");
  if (!commentId) return NextResponse.json({ error: "Missing comment id" }, { status: 400 });

  try {
    const comment = await prisma.comment.findUnique({ where: { id: Number(commentId) } });
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (comment.userId !== session.user.id && !user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.comment.delete({ where: { id: Number(commentId) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { commentId, content } = await req.json();
    if (!commentId || !content || !content.trim()) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const comment = await prisma.comment.findUnique({ where: { id: Number(commentId) } });
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    if (comment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.comment.update({
      where: { id: Number(commentId) },
      data: { content: content.trim() },
      include: { user: { select: { id: true, name: true, image: true } } }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}