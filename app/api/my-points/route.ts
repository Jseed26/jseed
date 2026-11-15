import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function GET() {
    const session = await auth();

    if (!session?.user?.id) {
        return Response.json([], { status: 401 });
    }

    // בתוך קובץ app/api/my-points/route.ts
    const points = await prisma.point.findMany({
        where: { userId: session.user.id },
        include: {
            _count: {
                select: {
                    viewedBy: true,
                    savedBy: true,
                }
            },
            // 🌟 זו התוספת שלנו! השרת יביא עכשיו גם את מודל הסטטיסטיקות שיצרנו
            analytics: true 
        },
        orderBy: { createdAt: "desc" },
    });

    return Response.json(points);
}