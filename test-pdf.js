const fs = require('fs');
const pdfLib = require('pdf-parse');

async function test() {
  const buffer = fs.readFileSync('test_statement.pdf');
  try {
      const parser = new pdfLib.PDFParse({ data: buffer });
      const textResult = await parser.getText();
      console.log(textResult.text);
  } catch (e) {
      console.error(e);
  }
}
test();
