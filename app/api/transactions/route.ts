export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/auditLogger";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const sourceFileId = searchParams.get("sourceFileId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "200");

    const where: any = {};

    // Vendor scoping — VENDOR role always sees only their own data
    if ((session.user as any).role === "VENDOR") {
      where.vendorId = (session.user as any).vendorId;
    } else if (vendorId) {
      where.vendorId = vendorId === "admin" ? null : vendorId;
    }

    if (type) where.type = type;
    if (status) where.status = status;
    if (sourceFileId) where.sourceFileId = sourceFileId;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vendor: { select: { name: true } },
          sourceFile: { select: { fileName: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    // Decrypt fields for display
    const decryptedTransactions = transactions.map((tx: any) => ({
      ...tx,
      description: tx.description ? decrypt(tx.description) : tx.description,
      reference: tx.reference ? decrypt(tx.reference) : tx.reference,
    }));

    return NextResponse.json({
      transactions: decryptedTransactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("[TRANSACTIONS_GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions", detail: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Vendor can only create for themselves
    let vendorId = body.vendorId;
    if ((session.user as any).role === "VENDOR") {
      vendorId = (session.user as any).vendorId;
    }

    const transaction = await prisma.transaction.create({
      data: {
        type: body.type,
        amount: typeof body.amount === "number" ? body.amount : parseFloat(body.amount),
        date: new Date(body.date),
        description: body.description ? encrypt(body.description) : encrypt("No description"),
        reference: body.reference ? encrypt(body.reference) : null,
        balance: body.balance ? parseFloat(String(body.balance)) : null,
        cellColor: body.cellColor || null,
        status: body.status || "CONFIRMED",
        vendorId: vendorId || null,
        createdBy: (session.user as any).id,
      },
      include: {
        vendor: { select: { name: true } },
        sourceFile: { select: { fileName: true } },
      },
    });

    // Decrypt for response
    const decryptedTx = {
      ...transaction,
      description: transaction.description ? decrypt(transaction.description) : transaction.description,
      reference: transaction.reference ? decrypt(transaction.reference) : transaction.reference,
    };

    await logAudit({
      action: "CREATE",
      entity: "Transaction",
      entityId: transaction.id,
      actorId: (session.user as any).id,
      actorName: session.user?.name || "Unknown",
      actorRole: (session.user as any).role,
      after: decryptedTx,
    });

    return NextResponse.json(decryptedTx);
  } catch (error: any) {
    console.error("[TRANSACTIONS_POST] error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction", detail: error.message },
      { status: 500 }
    );
  }
}
