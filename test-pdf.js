const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function test() {
  const buffer = fs.readFileSync('test_statement.pdf');
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    console.log(textResult.text);
    await parser.destroy();
  } catch (e) {
    console.error(e);
  }
}
test();
