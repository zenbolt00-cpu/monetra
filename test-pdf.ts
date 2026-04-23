import PDFParse from "pdf-parse";
import fs from "fs";

async function test() {
  const buffer = fs.readFileSync('test_statement.pdf');
  try {
      const parser = new (PDFParse as any).PDFParse({ data: buffer });
      const textResult = await parser.getText();
      console.log("Success with .PDFParse:", textResult.text);
  } catch (e) {
      console.log("Failed with .PDFParse", e.message);
      try {
        const parser2 = new (PDFParse as any)({ data: buffer });
        const res2 = await parser2.getText();
        console.log("Success with direct new:", res2.text);
      } catch (e2) {
        console.log("Failed direct new", e2.message);
      }
  }
}
test();
