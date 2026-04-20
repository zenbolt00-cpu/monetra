export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/auditLogger";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendors = await prisma.vendor.findMany({
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Add quick stats for each vendor
    const vendorsWithStats = await Promise.all(
      vendors.map(async (vendor: any) => {
        const payin = await prisma.transaction.aggregate({
          where: {
            vendorId: vendor.id,
            type: "PAYIN",
            status: "CONFIRMED",
          },
          _sum: { amount: true },
        });
        const payout = await prisma.transaction.aggregate({
          where: {
            vendorId: vendor.id,
            type: "PAYOUT",
            status: "CONFIRMED",
          },
          _sum: { amount: true },
        });

        return {
          ...vendor,
          stats: {
            payin: payin._sum.amount || 0,
            payout: payout._sum.amount || 0,
            net: (payin._sum.amount || 0) - (payout._sum.amount || 0),
          },
        };
      })
    );

    return NextResponse.json(vendorsWithStats);
  } catch (error: any) {
    console.error("[VENDORS_GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors", detail: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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
      password,
    } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Hash password
    const loginPassword = password || "Vendor@123";
    const hashedPassword = await bcrypt.hash(loginPassword, 10);

    const vendor = await prisma.vendor.create({
      data: {
        name,
        email,
        phone: phone || null,
        address: address || null,
        gstin: gstin || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        ifsc: ifsc || null,
        notes: notes || null,
        users: {
          create: {
            email,
            name,
            password: hashedPassword,
            role: "VENDOR",
          },
        },
      },
    });

    await logAudit({
      action: "CREATE",
      entity: "Vendor",
      entityId: vendor.id,
      actorId: (session.user as any).id,
      actorName: session.user?.name || "Unknown",
      actorRole: (session.user as any).role,
      after: vendor,
    });

    return NextResponse.json({
      vendor,
      user: {
        email,
        tempPassword: loginPassword,
      },
    });
  } catch (error: any) {
    console.error("[VENDORS_POST] error:", error);

    // Handle unique constraint (duplicate email)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A vendor with this email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create vendor", detail: error.message },
      { status: 500 }
    );
  }
}
