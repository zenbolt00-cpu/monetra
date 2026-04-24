import { PDFParse } from "pdf-parse";
import fs from "fs";

async function test() {
  const buffer = fs.readFileSync('test_statement.pdf');
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) } as any);
    const textResult = await parser.getText();
    console.log("Text extraction success:", textResult.text?.substring(0, 500));

    const tableResult = await parser.getTable();
    console.log("Tables found:", tableResult.total);
    for (const page of tableResult.pages) {
      for (const table of page.tables) {
        console.log("Table rows:", table.length);
        table.slice(0, 5).forEach((row: string[], i: number) => console.log(`  Row ${i}:`, row));
      }
    }

    await parser.destroy();
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
test();
