/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const { PDFParse } = require("pdf-parse");

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error("A PDF file path is required.");
  }

  const data = fs.readFileSync(filePath);
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    process.stdout.write(result.text || "");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
