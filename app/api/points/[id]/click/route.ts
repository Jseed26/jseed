import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request, context: any) {
    try {
        const params = await context.params;
        const pointId = Number(params.id);

        await prisma.point.update({
            where: { id: pointId },
            data: { linkClicks: { increment: 1 } },
        });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: "Failed to count click" }, { status: 500 });
    }
}