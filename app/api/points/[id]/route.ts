import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function PUT(req: Request, context: any) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { params } = context;
  const { id } = await params; // 🔥 חשוב מאוד

  const pointId = Number(id);
  const body = await req.json();

  const existing = await prisma.point.findFirst({
    where: {
      id: pointId,
      userId: session.user.id,
    },
  });

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.point.update({
    where: { id: pointId },
    data: {
      name: body.name,
      description: body.description,
      category: body.category,
    },
  });

  return Response.json(updated);
}