export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "VENDOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendorId = (session.user as any).vendorId;

    // 1. Metric Cards
    const totalPayin = await prisma.transaction.aggregate({
      where: { vendorId, type: "PAYIN", status: "CONFIRMED" },
      _sum: { amount: true },
    });
    const totalPayout = await prisma.transaction.aggregate({
      where: { vendorId, type: "PAYOUT", status: "CONFIRMED" },
      _sum: { amount: true },
    });
    const totalRecords = await prisma.transaction.count({ where: { vendorId } });

    // 2. Line Chart (Last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const monthlyData: any[] = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM(CASE WHEN type = 'PAYIN' THEN amount ELSE 0 END) as payin,
        SUM(CASE WHEN type = 'PAYOUT' THEN amount ELSE 0 END) as payout
      FROM "Transaction"
      WHERE vendorId = ${vendorId} AND date >= ${twelveMonthsAgo} AND status = 'CONFIRMED'
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const serializedMonthlyData = monthlyData.map((m: any) => ({
      month: m.month,
      payin: Number(m.payin || 0),
      payout: Number(m.payout || 0)
    }));

    // 3. Recent Transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: { vendorId },
      take: 10,
      orderBy: { date: "desc" },
      include: {
        sourceFile: { select: { fileName: true } },
      },
    });

    // 4. Source Files
    const recentFiles = await prisma.sourceFile.findMany({
      where: { vendorId },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      metrics: {
        totalPayin: totalPayin._sum.amount || 0,
        totalPayout: totalPayout._sum.amount || 0,
        netBalance: (totalPayin._sum.amount || 0) - (totalPayout._sum.amount || 0),
        totalRecords,
      },
      charts: {
        monthly: serializedMonthlyData,
      },
      recentTransactions,
      recentFiles,
    });
  } catch (error: any) {
    console.error("Vendor Dashboard error:", error);
    return NextResponse.json({ error: "Failed to fetch vendor dashboard stats" }, { status: 500 });
  }
}
