export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/auditLogger";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    const before = await prisma.transaction.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Protection: Vendors can only edit their own transactions
    if ((session.user as any).role === "VENDOR") {
      if (before.vendorId !== (session.user as any).vendorId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Vendors can only edit description and date, and it sets status to PENDING
      const { description, date } = body;
      const transaction = await prisma.transaction.update({
        where: { id },
        data: {
          description,
          date: date ? new Date(date) : undefined,
          status: "PENDING",
          updatedBy: (session.user as any).id,
        },
        include: {
          vendor: { select: { name: true } },
          sourceFile: { select: { fileName: true } },
        },
      });

      await logAudit({
        action: "UPDATE",
        entity: "Transaction",
        entityId: id,
        actorId: (session.user as any).id,
        actorName: session.user?.name || "Unknown",
        actorRole: (session.user as any).role,
        before,
        after: transaction,
      });

      return NextResponse.json(transaction);
    }

    // Admin can edit everything
    const updateData: any = { ...body };
    if (body.date) updateData.date = new Date(body.date);
    if (body.amount)
      updateData.amount =
        typeof body.amount === "number"
          ? body.amount
          : parseFloat(String(body.amount));
    if (body.balance !== undefined)
      updateData.balance = body.balance
        ? parseFloat(String(body.balance))
        : null;
    updateData.updatedBy = (session.user as any).id;

    // Don't overwrite vendorId if not explicitly passed
    if (body.vendorId === undefined) {
      delete updateData.vendorId;
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
      include: {
        vendor: { select: { name: true } },
        sourceFile: { select: { fileName: true } },
      },
    });

    await logAudit({
      action: "UPDATE",
      entity: "Transaction",
      entityId: id,
      actorId: (session.user as any).id,
      actorName: session.user?.name || "Unknown",
      actorRole: (session.user as any).role,
      before,
      after: transaction,
    });

    return NextResponse.json(transaction);
  } catch (error: any) {
    console.error("[TRANSACTION_PUT] error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction", detail: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const before = await prisma.transaction.findUnique({ where: { id } });

    if (!before) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    await prisma.transaction.delete({ where: { id } });

    await logAudit({
      action: "DELETE",
      entity: "Transaction",
      entityId: id,
      actorId: (session.user as any).id,
      actorName: session.user?.name || "Unknown",
      actorRole: (session.user as any).role,
      before,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[TRANSACTION_DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction", detail: error.message },
      { status: 500 }
    );
  }
}
