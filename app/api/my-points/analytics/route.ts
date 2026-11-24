import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const { searchParams } = new URL(req.url);
    const requestedPointId = searchParams.get("pointId");
    const numericPointId =
        requestedPointId && requestedPointId !== "ALL" && !Number.isNaN(Number(requestedPointId))
            ? Number(requestedPointId)
            : null;

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { isAdmin: true },
        });
        const isAdmin = Boolean(currentUser?.isAdmin);

        // אם מנהל ביקש לראות גרעין ספציפי — נשלוף אותו גם אם הוא שייך למשתמש אחר
        let userPoints = await prisma.point.findMany({
            where: isAdmin && numericPointId ? { id: numericPointId } : { userId: currentUserId },
            select: { id: true, name: true, category: true },
        });

        // גיבוי למקרה שמנהל נכנס עם pointId שלא קיים
        if (userPoints.length === 0 && !isAdmin) {
            return Response.json({
                logs: [],
                pointStats: [],
                userPoints: [],
                benchmarkPoints: [],
                globalStats: null,
            });
        }

        const pointIds = userPoints.map((p) => p.id);

        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

        const logs = pointIds.length > 0
            ? await prisma.pointActionLog.findMany({
                  where: {
                      pointId: { in: pointIds },
                      createdAt: { gte: oneYearAgo },
                  },
                  orderBy: { createdAt: "asc" },
              })
            : [];

        const rawPointStats = pointIds.length > 0
            ? await prisma.point.findMany({
                  where: { id: { in: pointIds } },
                  include: {
                      _count: { select: { viewedBy: true, savedBy: true } },
                      analytics: true,
                  },
                  orderBy: { createdAt: "desc" },
              })
            : [];

        const allSystemPoints = await prisma.point.findMany({
            select: {
                id: true,
                name: true,
                userId: true,
                category: true,
                parentId: true,
                latitude: true,
                longitude: true,
                createdAt: true,
                linkClicks: true,
                _count: { select: { viewedBy: true, savedBy: true } },
                analytics: {
                    select: { views: true, clicks: true, shares: true, joins: true },
                },
            },
        });

        const pointStats = rawPointStats.map((p) => {
            const cleanName = (p.name || "").trim().toLowerCase();
            const createdSeeds = allSystemPoints.filter(
                (other) =>
                    other.id !== p.id &&
                    other.category === "chai" &&
                    (other.parentId === p.id ||
                        (cleanName !== "" && (other.name || "").trim().toLowerCase() === cleanName))
            ).length;

            return {
                ...p,
                createdSeeds,
            };
        });

        const nonSupportPoints = allSystemPoints.filter((p) => p.category !== "chai_support");

        const benchmarkPoints = nonSupportPoints.map((p) => {
            const views = p.analytics?.views || p._count.viewedBy || 0;
            const saves = p._count.savedBy || 0;
            const interactions =
                saves +
                (p.analytics?.shares || 0) +
                (p.analytics?.clicks || p.linkClicks || 0) +
                (p.analytics?.joins || 0);

            return {
                id: p.id,
                category: p.category,
                latitude: p.latitude,
                longitude: p.longitude,
                views,
                saves,
                interactions,
                isMine: p.userId === currentUserId,
            };
        });

        const allGlobalLogs = await prisma.pointActionLog.findMany({
            select: { country: true, createdAt: true, pointId: true },
        });

        const uniqueCountries = new Set<string>();
        allGlobalLogs.forEach((l) => {
            if (l.country) uniqueCountries.add(l.country.toUpperCase());
        });
        if (uniqueCountries.size === 0) uniqueCountries.add("IL");

        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;

        const pointCategoryMap = new Map<number, string>();
        nonSupportPoints.forEach((p) => pointCategoryMap.set(p.id, p.category));

        const categoryActivity: Record<string, { total: number; recent30: number; prev30: number }> = {
            leaf: { total: 0, recent30: 0, prev30: 0 },
            star: { total: 0, recent30: 0, prev30: 0 },
            triangle: { total: 0, recent30: 0, prev30: 0 },
            circle: { total: 0, recent30: 0, prev30: 0 },
            chai: { total: 0, recent30: 0, prev30: 0 },
        };

        let totalGlobalParticipants = 0;
        nonSupportPoints.forEach((p) => {
            const ptsActivity =
                (p.analytics?.views || p._count.viewedBy || 0) +
                (p._count.savedBy || 0) +
                (p.analytics?.joins || 0) +
                (p.analytics?.shares || 0) +
                (p.analytics?.clicks || p.linkClicks || 0);
            totalGlobalParticipants += ptsActivity;
            if (categoryActivity[p.category]) {
                categoryActivity[p.category].total += Math.max(1, ptsActivity);
            }
        });

        allGlobalLogs.forEach((l) => {
            const cat = pointCategoryMap.get(l.pointId);
            if (!cat || !categoryActivity[cat]) return;
            const ts = new Date(l.createdAt).getTime();
            if (ts >= thirtyDaysAgo) categoryActivity[cat].recent30 += 1;
            else if (ts >= sixtyDaysAgo) categoryActivity[cat].prev30 += 1;
        });

        const categoryTrends = Object.entries(categoryActivity)
            .map(([category, stats]) => ({
                category,
                total: stats.total,
                isTrendingUp: stats.recent30 >= stats.prev30,
            }))
            .sort((a, b) => b.total - a.total);

        const recentPointsCount = nonSupportPoints.filter(
            (p) => new Date(p.createdAt).getTime() >= sixtyDaysAgo
        ).length;
        const olderPointsCount = Math.max(1, nonSupportPoints.length - recentPointsCount);
        const annualGrowthPct = Math.min(
            240,
            Math.max(12, Math.round((recentPointsCount / olderPointsCount) * 100))
        );

        const globalStats = {
            year: new Date().getFullYear(),
            totalParticipants: totalGlobalParticipants,
            countriesCount: uniqueCountries.size,
            totalSeeds: nonSupportPoints.length,
            totalInitiatives: nonSupportPoints.filter((p) => p.category === "chai").length,
            leadingCategory: categoryTrends[0]?.category || "chai",
            annualGrowthPct,
            categoryTrends,
        };

        return Response.json({
            logs,
            pointStats,
            userPoints,
            benchmarkPoints,
            globalStats,
        });
    } catch (error) {
        console.error("Failed to fetch user analytics:", error);
        return Response.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}