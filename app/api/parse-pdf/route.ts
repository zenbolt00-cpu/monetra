import { NextRequest, NextResponse } from "next/server";
import { processPDF } from "@/lib/fileProcessor";
import { TxType } from "@prisma/client";

export const dynamic = "force-dynamic";

// Next.js App Router body size and timeout config
export const maxDuration = 30; 

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const txTypeStr = formData.get("txType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Parse the optional txType override
    let txTypeOverride: TxType | undefined;
    if (txTypeStr === "PAYIN") txTypeOverride = TxType.PAYIN;
    else if (txTypeStr === "PAYOUT") txTypeOverride = TxType.PAYOUT;

    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`[API/PARSE-PDF] Processing ${file.name} (${file.size} bytes)...`);

    // Call the robust local PDF processing engine
    const result = await processPDF(buffer, txTypeOverride);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ 
        error: "Could not extract any transactions from this PDF. Please ensure it's a text-based bank statement." 
      }, { status: 400 });
    }

    // Map rows to include filename as requested
    const transactions = result.rows.map(row => ({
      ...row,
      source_file: file.name
    }));

    // Generate CSV content for the user
    const csvHeaders = ["Date", "Description", "Reference", "Amount", "Type", "Balance", "Mode", "Vendor"];
    const csvRows = transactions.map(t => [
      t.date.toISOString().split('T')[0],
      `"${t.description.replace(/"/g, '""')}"`,
      t.reference || "",
      t.amount,
      t.type,
      t.balance || "",
      t.mode || "",
      `"${(t as any).vendor_name?.replace(/"/g, '""') || ""}"`
    ].join(","));
    const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");

    return NextResponse.json({
      success: true,
      transactions,
      csvContent,
      filename: file.name,
      count: transactions.length
    });

  } catch (error: any) {
    console.error("[API/PARSE-PDF] Global Error:", error);
    
    // Check for specific error messages we threw in the engine
    const errorMessage = error.message || "An unexpected error occurred during PDF parsing.";
    
    return NextResponse.json({ 
      error: errorMessage,
      detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
