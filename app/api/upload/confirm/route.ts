export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/auditLogger";
import { FileStatus, TxStatus, TxType } from "@prisma/client";
import { encrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { file, transactions } = body;

    if (!file || !transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "Missing file or transactions data" },
        { status: 400 }
      );
    }

    // Filter out excluded rows
    const activeTransactions = transactions.filter(
      (tx: any) => !tx.isExcluded
    );

    if (activeTransactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions to import (all rows excluded)" },
        { status: 400 }
      );
    }

    // Check if sourceFile already exists (created during upload)
    let sourceFileId = file.id;

    if (!sourceFileId) {
      // Fallback: create SourceFile if not created during upload
      const sourceFile = await prisma.sourceFile.create({
        data: {
          fileName: file.fileName,
          fileType: file.fileType,
          fileUrl: file.fileUrl,
          fileSize: file.fileSize,
          vendorId: file.vendorId,
          uploadedBy: (session.user as any).id,
          status: FileStatus.DONE,
          totalRows: transactions.length,
          parsedRows: activeTransactions.length,
        },
      });
      sourceFileId = sourceFile.id;
    }

    // Create Transaction records
    let totalPayin = 0;
    let totalPayout = 0;

    const createdTransactions = await prisma.$transaction(
      activeTransactions.map((tx: any) => {
        const amount =
          typeof tx.amount === "number"
            ? tx.amount
            : parseFloat(String(tx.amount).replace(/[^0-9.]/g, ""));

        const txType: TxType = tx.type === "PAYOUT" ? TxType.PAYOUT : TxType.PAYIN;

        if (txType === "PAYIN") totalPayin += amount;
        else totalPayout += amount;

        const encryptedDescription = tx.description ? encrypt(tx.description) : encrypt("No description");
        const encryptedReference = tx.reference ? encrypt(tx.reference) : null;

        return prisma.transaction.create({
          data: {
            type: txType,
            amount: isNaN(amount) ? 0 : amount,
            date: new Date(tx.date),
            description: encryptedDescription,
            reference: encryptedReference,
            balance:
              tx.balance !== undefined && tx.balance !== null
                ? typeof tx.balance === "number"
                  ? tx.balance
                  : parseFloat(String(tx.balance).replace(/[^0-9.]/g, ""))
                : null,
            rowIndex: tx.rowIndex || null,
            cellColor: tx.cellColor || null,
            rawData: tx.rawData || null,
            status: TxStatus.CONFIRMED,
            vendorId: file.vendorId || null,
            sourceFileId,
            createdBy: (session.user as any).id,
          },
        });
      })
    );

    // Recompute totals from the actual created records
    totalPayin = 0;
    totalPayout = 0;
    createdTransactions.forEach((tx: any) => {
      if (tx.type === "PAYIN") totalPayin += tx.amount;
      else totalPayout += tx.amount;
    });

    // Update SourceFile status
    await prisma.sourceFile.update({
      where: { id: sourceFileId },
      data: {
        status: FileStatus.DONE,
        parsedRows: createdTransactions.length,
        totalRows: transactions.length,
      },
    });

    // Write AuditLog
    await logAudit({
      action: "UPLOAD",
      entity: "SourceFile",
      entityId: sourceFileId,
      actorId: (session.user as any).id,
      actorName: session.user?.name || "Unknown",
      actorRole: (session.user as any).role,
      after: {
        fileName: file.fileName,
        transactionCount: createdTransactions.length,
        totalPayin,
        totalPayout,
      },
    });

    return NextResponse.json({
      success: true,
      sourceFileId,
      transactionCount: createdTransactions.length,
      count: createdTransactions.length,
      totalPayin,
      totalPayout,
    });
  } catch (error: any) {
    console.error("[UPLOAD_CONFIRM] error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to confirm import",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
