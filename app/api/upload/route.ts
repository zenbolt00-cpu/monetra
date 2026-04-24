export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processExcel, processPDF } from "@/lib/fileProcessor";
import { FileType, FileStatus, TxType } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const vendorId = formData.get("vendorId") as string;
    const txTypeStr = formData.get("txType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Parse the optional txType override
    let txTypeOverride: TxType | undefined;
    if (txTypeStr === "PAYIN") txTypeOverride = TxType.PAYIN;
    else if (txTypeStr === "PAYOUT") txTypeOverride = TxType.PAYOUT;

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const fileExtension = path.extname(fileName).toLowerCase();
    const fileSize = file.size;

    let fileType: FileType;
    if (fileExtension === ".xlsx") fileType = FileType.XLSX;
    else if (fileExtension === ".xls") fileType = FileType.XLS;
    else if (fileExtension === ".pdf") fileType = FileType.PDF;
    else if (fileExtension === ".csv") fileType = FileType.CSV;
    else {
      return NextResponse.json(
        { error: "Unsupported file type. Only PDF, XLSX, XLS and CSV are supported." },
        { status: 400 }
      );
    }

    // Save file locally (use /tmp on Vercel)
    const isVercel = process.env.VERCEL === "1";
    const uploadDir =
      process.env.UPLOAD_DIR || (isVercel ? os.tmpdir() : path.join(process.cwd(), "public", "uploads"));
    
    if (!isVercel) {
      await mkdir(uploadDir, { recursive: true });
    }

    const uniqueFileName = `${Date.now()}-${fileName.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    await writeFile(filePath, buffer);

    const fileUrl = isVercel ? `/api/file/${uniqueFileName}` : `/uploads/${uniqueFileName}`;

    // Resolved vendor ID
    const resolvedVendorId =
      !vendorId || vendorId === "admin" ? null : vendorId;

    // Create SourceFile record in PROCESSING state
    const sourceFile = await prisma.sourceFile.create({
      data: {
        fileName,
        fileType,
        fileUrl,
        fileSize,
        vendorId: resolvedVendorId,
        uploadedBy: (session.user as any).id,
        status: FileStatus.PROCESSING,
      },
    });

    // Process file
    let parsedData;
    try {
      if (fileType === FileType.PDF) {
        parsedData = await processPDF(buffer, txTypeOverride);
      } else {
        parsedData = await processExcel(buffer, fileType, txTypeOverride);
      }
    } catch (parseError: any) {
      // Mark source file as error
      await prisma.sourceFile.update({
        where: { id: sourceFile.id },
        data: {
          status: FileStatus.ERROR,
          errorLog: parseError.message || "Parse failed",
        },
      });
      throw parseError;
    }

    // Update source file with row counts
    await prisma.sourceFile.update({
      where: { id: sourceFile.id },
      data: {
        totalRows: parsedData.rows.length,
      },
    });

    // Validation: Check for duplicate UTRs (references)
    const references = parsedData.rows
      .map((r: any) => r.reference)
      .filter((ref: any) => ref && String(ref).trim().length > 0)
      .map((ref: any) => String(ref).trim());

    // Since references are encrypted with random IVs, we must decrypt all existing refs to compare
    let existingRefSet = new Set<string>();
    if (references.length > 0) {
      const { decrypt } = await import("@/lib/encryption");
      const existingTransactions = await prisma.transaction.findMany({
        where: { reference: { not: null } },
        select: { reference: true },
      });
      for (const tx of existingTransactions) {
        if (tx.reference) {
          const decryptedRef = decrypt(tx.reference);
          existingRefSet.add(decryptedRef.toLowerCase().trim());
        }
      }
    }

    // Track duplicates within the file itself
    const fileRefs = new Set<string>();
    const fileDupes = new Set<string>();

    references.forEach((ref: string) => {
      const refKey = ref.toLowerCase();
      if (fileRefs.has(refKey)) fileDupes.add(refKey);
      fileRefs.add(refKey);
    });

    // Mark rows with errors
    parsedData.rows = parsedData.rows.map((row: any) => {
      const errors: string[] = [];
      const ref = row.reference ? String(row.reference).trim() : null;

      if (ref) {
        const refKey = ref.toLowerCase();
        if (existingRefSet.has(refKey)) {
          errors.push("Duplicate UTR (already in database)");
        }
        if (fileDupes.has(refKey)) {
          errors.push("Duplicate UTR (repeated in this file)");
        }
      }

      return {
        ...row,
        errors: errors.length > 0 ? errors : undefined,
      };
    });

    return NextResponse.json({
      success: true,
      fileId: sourceFile.id,
      file: {
        id: sourceFile.id,
        fileName,
        fileType,
        fileUrl,
        fileSize,
        vendorId: resolvedVendorId,
      },
      parsedData,
    });
  } catch (error: any) {
    console.error("[UPLOAD] error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to process file",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
