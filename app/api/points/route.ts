import { prisma } from "@/src/lib/prisma";

/**
 * GET - מחזיר את כל הנקודות
 */
export async function GET() {
  const points = await prisma.point.findMany();

  return Response.json(points);
}

/**
 * POST - מוסיף נקודה חדשה
 */
export async function POST(req: Request) {
  const body = await req.json();

  const { name, category, latitude, longitude } = body;

  const newPoint = await prisma.point.create({
    data: {
      name,
      category,
      latitude,
      longitude,
    },
  });

  return Response.json(newPoint);
}