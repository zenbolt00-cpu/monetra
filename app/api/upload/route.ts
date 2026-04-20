export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processExcel, processPDF } from "@/lib/fileProcessor";
import { FileType, FileStatus, TxType } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
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

    // Save file locally
    const uploadDir =
      process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const uniqueFileName = `${Date.now()}-${fileName.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${uniqueFileName}`;

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
      .filter((ref: any) => ref && String(ref).trim().length > 0);

    const existingTransactions = await prisma.transaction.findMany({
      where: {
        reference: { in: references },
      },
      select: { reference: true },
    });

    const existingRefs = new Set(existingTransactions.map((t) => t.reference));
    const fileRefs = new Set();
    const fileDupes = new Set();

    references.forEach((ref: string) => {
      if (fileRefs.has(ref)) fileDupes.add(ref);
      fileRefs.add(ref);
    });

    // Mark rows with errors
    parsedData.rows = parsedData.rows.map((row: any) => {
      const errors: string[] = [];
      const ref = row.reference ? String(row.reference).trim() : null;

      if (ref) {
        if (existingRefs.has(ref)) {
          errors.push("Duplicate UTR (already in database)");
        }
        if (fileDupes.has(ref)) {
          errors.push("Duplicate UTR (repeated in this file)");
        }
      } else {
        // If UTR is mandatory, flag it
        // errors.push("Missing UTR/Reference");
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
