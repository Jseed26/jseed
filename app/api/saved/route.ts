import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

/**
 * GET - שליפת כל הנקודות השמורות של המשתמש
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const saved = await prisma.savedPoint.findMany({
    where: { userId: session.user.id },
    include: { point: true },
    orderBy: { savedAt: "desc" }
  });

  return Response.json(saved.map(s => s.point));
}

/**
 * POST - הוספה/הסרה מהמועדפים (Toggle)
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { pointId } = await req.json();
    if (!pointId) return Response.json({ error: "Missing pointId" }, { status: 400 });

    const pId = Number(pointId);

    const existing = await prisma.savedPoint.findUnique({
      where: {
        userId_pointId: {
          userId: session.user.id,
          pointId: pId
        }
      }
    });

    if (existing) {
      // אם כבר שמור - נסיר מהשמורים
      await prisma.savedPoint.delete({
        where: { id: existing.id }
      });
      return Response.json({ saved: false });
    } else {
      // אם לא שמור - נוסיף לשמורים
      await prisma.savedPoint.create({
        data: {
          userId: session.user.id,
          pointId: pId
        }
      });

      // 🔔 יצירת התראה
      try {
        const point = await prisma.point.findUnique({
          where: { id: pId },
          select: { userId: true }
        });

        if (point?.userId && point.userId !== session.user.id) {
          await prisma.notification.create({
            data: {
              userId: point.userId, 
              message: "מישהו הרגע שמר את הגרעין שלך! 🌱",
            }
          });
        }
      } catch (err) {
        console.error("Notification creation failed:", err);
      }

      return Response.json({ saved: true });
    }
    
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update favorites" }, { status: 500 });
  }
}