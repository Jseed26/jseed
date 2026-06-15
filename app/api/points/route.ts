import { prisma } from "@/src/lib/prisma";

/**
 * GET - כל הנקודות
 */
export async function GET() {
  try {
    const points = await prisma.point.findMany({
      orderBy: { createdAt: "desc" },
    });

    return Response.json(points);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch points" }, { status: 500 });
  }
}

/**
 * POST - יצירת נקודה
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      name,
      category,
      latitude,
      longitude,
      description,
      address,
      website,
    } = body;

    const newPoint = await prisma.point.create({
      data: {
        name,
        category,
        latitude,
        longitude,
        description: description || null,
        address: address || null,
        website: website || null,
      },
    });

    return Response.json(newPoint);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create point" }, { status: 500 });
  }
}