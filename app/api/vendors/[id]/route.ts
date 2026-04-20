export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/auditLogger";
import bcrypt from "bcryptjs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { transactions: true, sourceFiles: true } },
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Calculate stats
    const payin = await prisma.transaction.aggregate({
      where: { vendorId: vendor.id, type: "PAYIN", status: "CONFIRMED" },
      _sum: { amount: true },
    });
    const payout = await prisma.transaction.aggregate({
      where: { vendorId: vendor.id, type: "PAYOUT", status: "CONFIRMED" },
      _sum: { amount: true },
    });

    return NextResponse.json({
      ...vendor,
      stats: {
        payin: payin._sum.amount || 0,
        payout: payout._sum.amount || 0,
        net: (payin._sum.amount || 0) - (payout._sum.amount || 0),
      },
    });
  } catch (error: any) {
    console.error("[VENDOR_GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor", detail: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      address,
      gstin,
      bankName,
      accountNumber,
      ifsc,
      notes,
      isActive,
      resetPassword,
    } = body;

    const before = await prisma.vendor.findUnique({
      where: { id: params.id },
    });

    if (!before) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (gstin !== undefined) updateData.gstin = gstin;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
    if (ifsc !== undefined) updateData.ifsc = ifsc;
    if (notes !== undefined) updateData.notes = notes;
    if (isActive !== undefined) updateData.isActive = isActive;

    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: updateData,
    });

    // If deactivating, also deactivate user accounts
    if (isActive === false) {
      await prisma.user.updateMany({
        where: { vendorId: params.id },
        data: { isActive: false },
      });
    } else if (isActive === true) {
      await prisma.user.updateMany({
        where: { vendorId: params.id },
        data: { isActive: true },
      });
    }

    // Handle password reset
    let newPassword: string | null = null;
    if (resetPassword) {
      newPassword = resetPassword;
      const hashedPassword = await bcrypt.hash(resetPassword, 10);
      await prisma.user.updateMany({
        where: { vendorId: params.id },
        data: { password: hashedPassword },
      });
    }

    await logAudit({
      action: "UPDATE",
      entity: "Vendor",
      entityId: params.id,
      actorId: (session.user as any).id,
      actorName: session.user?.name || "Unknown",
      actorRole: (session.user as any).role,
      before,
      after: vendor,
    });

    return NextResponse.json({
      vendor,
      ...(newPassword ? { newPassword } : {}),
    });
  } catch (error: any) {
    console.error("[VENDOR_PUT] error:", error);
    return NextResponse.json(
      { error: "Failed to update vendor", detail: error.message },
      { status: 500 }
    );
  }
}
