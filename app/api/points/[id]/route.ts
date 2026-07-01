import { auth } from "@/src/lib/auth/auth";
import { prisma } from "@/src/lib/prisma";

export async function PUT(req: Request, context: any) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const pointId = Number(id);

  const formData = await req.formData();

  const name = (formData.get("name") as string) || "";
  const description = (formData.get("description") as string) || "";
  const category = (formData.get("category") as string) || "";
  const address = (formData.get("address") as string) || "";
  const website = (formData.get("website") as string) || "";

  const tagsRaw = formData.get("tags");
  const tags = tagsRaw ? JSON.parse(tagsRaw as string) : [];

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
      name,
      description,
      category,
      address,
      website,
      tags,
    },
  });

  return Response.json(updated);
}