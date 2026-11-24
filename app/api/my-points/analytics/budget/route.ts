import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { isAdmin: true },
        });
        const isAdmin = Boolean(currentUser?.isAdmin);

        const { pointId, budget } = await req.json();
        const numericId = Number(pointId);
        if (!numericId) {
            return NextResponse.json({ error: "Invalid pointId" }, { status: 400 });
        }

        const existing = await prisma.point.findFirst({
            where: isAdmin ? { id: numericId } : { id: numericId, userId: currentUserId },
        });
        if (!existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const parsedBudget =
            budget === null || budget === "" || Number.isNaN(Number(budget))
                ? null
                : Math.max(0, Math.round(Number(budget)));

        await prisma.point.update({
            where: { id: numericId },
            data: { budget: parsedBudget },
        });

        return NextResponse.json({ success: true, budget: parsedBudget });
    } catch (error) {
        console.error("Budget update error:", error);
        return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
    }
}