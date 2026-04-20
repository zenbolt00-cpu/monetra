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

    const { searchParams } = new URL(req.url);
    const actorId = searchParams.get("actorId");
    const action = searchParams.get("action");
    const entity = searchParams.get("entity");

    const where: any = {};
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to recent 100 for performance
    });

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
