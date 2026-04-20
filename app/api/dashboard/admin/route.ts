export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Metric Cards
    const totalPayin = await prisma.transaction.aggregate({
      where: { type: "PAYIN", status: "CONFIRMED" },
      _sum: { amount: true },
    });
    const totalPayout = await prisma.transaction.aggregate({
      where: { type: "PAYOUT", status: "CONFIRMED" },
      _sum: { amount: true },
    });
    const totalVendors = await prisma.vendor.count({ where: { isActive: true } });

    // 2. Line Chart (Last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const monthlyData: any[] = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM(CASE WHEN type = 'PAYIN' THEN amount ELSE 0 END) as payin,
        SUM(CASE WHEN type = 'PAYOUT' THEN amount ELSE 0 END) as payout
      FROM "Transaction"
      WHERE date >= ${twelveMonthsAgo} AND status = 'CONFIRMED'
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const serializedMonthlyData = monthlyData.map((m: any) => ({
      month: m.month,
      payin: Number(m.payin || 0),
      payout: Number(m.payout || 0)
    }));

    // 3. Top Vendors
    const topVendors = await prisma.vendor.findMany({
      take: 5,
      include: {
        _count: { select: { transactions: true } },
      },
      // Note: In a real app we'd sort by volume here, but Prisma doesn't support 
      // complex aggregations in findMany easily. We'll do it in memory or with a separate query.
    });

    const vendorsWithVolume = await Promise.all(
      topVendors.map(async (v: any) => {
        const volume = await prisma.transaction.aggregate({
          where: { vendorId: v.id, status: "CONFIRMED" },
          _sum: { amount: true },
        });
        return { ...v, volume: volume._sum.amount || 0 };
      })
    );

    // 4. Recent Transactions
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { date: "desc" },
      include: {
        vendor: { select: { name: true } },
        sourceFile: { select: { fileName: true } },
      },
    });

    return NextResponse.json({
      metrics: {
        totalPayin: totalPayin._sum.amount || 0,
        totalPayout: totalPayout._sum.amount || 0,
        netBalance: (totalPayin._sum.amount || 0) - (totalPayout._sum.amount || 0),
        totalVendors,
      },
      charts: {
        monthly: serializedMonthlyData,
      },
      topVendors: vendorsWithVolume.sort((a, b) => b.volume - a.volume),
      recentTransactions,
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
