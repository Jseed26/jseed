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

  // מחזירים רק את אובייקט ה-point עצמו כדי שיתאים לפורמט של שאר הדפים
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

    // בדיקה אם המשתמש כבר שמר את הנקודה הזו בעבר
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
      return Response.json({ saved: true });
    }
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update favorites" }, { status: 500 });
  }
}