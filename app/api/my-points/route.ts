import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function GET() {
    const session = await auth();

    if (!session?.user?.id) {
        return Response.json([], { status: 401 });
    }

    const points = await prisma.point.findMany({
        where: { userId: session.user.id },
        include: {
            _count: { select: { viewedBy: true, savedBy: true } },
            analytics: true,
            comments: {
                orderBy: { createdAt: "desc" },
                include: { user: { select: { name: true } } }
            }
        }
    });

    return Response.json(points);
}