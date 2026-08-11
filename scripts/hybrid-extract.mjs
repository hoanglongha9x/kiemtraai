import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

const QUESTION_ANCHOR = /^\s*Câu\s+(\d{1,4})\s*[.:]/iu;
const SUPPORTED_IMAGE_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"],
  [".webp", "image/webp"],
  [".emf", "image/x-emf"],
  [".wmf", "image/x-wmf"],
]);

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/hybrid-extract.mjs --pdf <de.pdf> --docx <de.docx> --out <output-dir>",
      "",
      "Output:",
      "  manifest.json  - PDF questions plus DOCX image matches",
      "  questions.json  - question-centric JSON",
      "  pdf-text.txt    - PDF text grouped by detected questions",
      "  assets/         - images extracted from DOCX drawings",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];

    if (!key.startsWith("--")) {
      continue;
    }

    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      args.set(key.slice(2), "true");
      continue;
    }

    args.set(key.slice(2), value);
    index += 1;
  }

  return {
    pdfPath: args.get("pdf"),
    docxPath: args.get("docx"),
    outDir: args.get("out") ?? "output/hybrid-import",
  };
}

function ensureDirectory(path) {
  mkdirSync(path, {
    recursive: true,
  });
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getXmlBlocks(xml, tagName) {
  const pattern = new RegExp(
    `<${escapeRegExp(tagName)}\\b[\\s\\S]*?<\\/${escapeRegExp(tagName)}>`,
    "g"
  );

  return xml.match(pattern) ?? [];
}

function readAttribute(xml, tagName, attributeName) {
  const match = xml.match(
    new RegExp(
      `<${escapeRegExp(tagName)}\\b[^>]*\\b${escapeRegExp(attributeName)}="([^"]*)"`,
      "i"
    )
  );

  return decodeXmlEntities(match?.[1] ?? "");
}

function normalizeWhitespace(value) {
  return value.replace(/[ \t\u00a0]+/g, " ").replace(/\s+\n/g, "\n").trim();
}

function readZipEntries(buffer) {
  const entries = new Map();
  const eocdSignature = 0x06054b50;
  const centralDirectorySignature = 0x02014b50;
  const localFileSignature = 0x04034b50;
  let eocdOffset = -1;

  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("DOCX không có central directory hợp lệ.");
  }

  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralDirectorySignature) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    offset += 46 + fileNameLength + extraLength + commentLength;

    if (buffer.readUInt32LE(localHeaderOffset) !== localFileSignature) {
      continue;
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      entries.set(name, compressed);
    } else if (compressionMethod === 8) {
      entries.set(name, inflateRawSync(compressed));
    }
  }

  return entries;
}

function parseRelationships(xml) {
  const rels = new Map();
  const pattern = /<Relationship\b[^>]*>/g;

  for (const match of xml.matchAll(pattern)) {
    const block = match[0];
    const id = readAttribute(block, "Relationship", "Id");
    const type = readAttribute(block, "Relationship", "Type");
    const target = readAttribute(block, "Relationship", "Target");

    if (id) {
      rels.set(id, {
        id,
        type,
        target,
      });
    }
  }

  return rels;
}

function extractParagraphText(paragraphXml) {
  const parts = [];
  const pattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g;

  for (const match of paragraphXml.matchAll(pattern)) {
    if (match[0].startsWith("<w:tab")) {
      parts.push("\t");
    } else if (match[0].startsWith("<w:br")) {
      parts.push("\n");
    } else {
      parts.push(decodeXmlEntities(match[1] ?? ""));
    }
  }

  return normalizeWhitespace(parts.join(""));
}

function extractDrawingRelationshipIds(paragraphXml) {
  const ids = [];
  const drawingBlocks = getXmlBlocks(paragraphXml, "w:drawing");

  for (const drawingXml of drawingBlocks) {
    for (const match of drawingXml.matchAll(/\br:embed="([^"]+)"/g)) {
      ids.push(match[1]);
    }
  }

  return ids;
}

function getSectionFromText(text, currentSection) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalized.includes("phan i")) {
    return "I";
  }

  if (normalized.includes("phan ii")) {
    return "II";
  }

  if (normalized.includes("phan iii")) {
    return "III";
  }

  return currentSection;
}

function extractDocxDrawingAssets(docxPath, outDir) {
  const entries = readZipEntries(readFileSync(docxPath));
  const documentXml = entries.get("word/document.xml")?.toString("utf8") ?? "";
  const relXml = entries.get("word/_rels/document.xml.rels")?.toString("utf8") ?? "";
  const rels = parseRelationships(relXml);
  const assetsDir = join(outDir, "assets");
  const paragraphs = getXmlBlocks(documentXml, "w:p");
  const assets = [];
  let currentQuestion = null;
  let currentSourceQuestion = null;
  let currentSection = "";
  let assetIndex = 0;
  let questionCount = 0;

  ensureDirectory(assetsDir);

  for (const paragraphXml of paragraphs) {
    const text = extractParagraphText(paragraphXml);
    currentSection = getSectionFromText(text, currentSection);

    const questionMatch = QUESTION_ANCHOR.exec(text);

    if (questionMatch) {
      questionCount += 1;
      currentSourceQuestion = questionCount;
      currentQuestion = Number(questionMatch[1]);
    }

    const drawingRelIds = extractDrawingRelationshipIds(paragraphXml);

    for (const relId of drawingRelIds) {
      const rel = rels.get(relId);

      if (!rel || !rel.type.includes("/image")) {
        continue;
      }

      const sourcePath = rel.target.startsWith("/")
        ? rel.target.slice(1)
        : `word/${rel.target}`;
      const sourceBuffer = entries.get(sourcePath);
      const extension = extname(sourcePath).toLowerCase();
      const mimeType = SUPPORTED_IMAGE_TYPES.get(extension) ?? "application/octet-stream";

      if (!sourceBuffer) {
        continue;
      }

      assetIndex += 1;

      const fileName = [
        `q${currentQuestion ?? "unknown"}`,
        String(assetIndex).padStart(3, "0"),
        basename(sourcePath).replace(/[^a-z0-9._-]/gi, "_"),
      ].join("-");
      const outputPath = join(assetsDir, fileName);

      writeFileSync(outputPath, sourceBuffer);

      assets.push({
        id: `docx-image-${assetIndex}`,
        source: "docx_drawing",
        sourceNumber: currentSourceQuestion,
        questionNumber: currentQuestion,
        section: currentSection,
        paragraphText: text,
        relationshipId: relId,
        originalPath: sourcePath,
        outputPath,
        relativePath: `assets/${fileName}`,
        mimeType,
        byteLength: sourceBuffer.length,
      });
    }
  }

  return assets;
}

async function extractPdfLines(pdfPath) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
  });
  const document = await loadingTask.promise;
  const lines = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({
      scale: 1,
    });
    const content = await page.getTextContent({
      includeMarkedContent: false,
    });
    const grouped = new Map();

    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) {
        continue;
      }

      const transform = item.transform;
      const x = transform[4];
      const y = viewport.height - transform[5];
      const key = Math.round(y * 2) / 2;
      const bucket = grouped.get(key) ?? [];

      bucket.push({
        text: item.str,
        x,
        y,
        width: item.width ?? 0,
        height: item.height ?? 0,
      });
      grouped.set(key, bucket);
    }

    for (const [y, items] of grouped) {
      const sorted = items.sort((left, right) => left.x - right.x);
      const text = normalizeWhitespace(sorted.map((item) => item.text).join(" "));
      const minX = Math.min(...sorted.map((item) => item.x));
      const maxX = Math.max(...sorted.map((item) => item.x + item.width));
      const maxHeight = Math.max(...sorted.map((item) => item.height));

      if (text) {
        lines.push({
          pageNumber,
          text,
          x: minX,
          y: Number(y),
          width: maxX - minX,
          height: maxHeight,
        });
      }
    }
  }

  return lines.sort((left, right) => left.pageNumber - right.pageNumber || left.y - right.y || left.x - right.x);
}

function buildPdfQuestions(lines) {
  const questions = [];
  let current = null;
  let currentSection = "";

  for (const line of lines) {
    currentSection = getSectionFromText(line.text, currentSection);

    const questionMatch = QUESTION_ANCHOR.exec(line.text);

    if (questionMatch) {
      current = {
        sourceNumber: questions.length + 1,
        printedNumber: Number(questionMatch[1]),
        section: currentSection,
        startPage: line.pageNumber,
        endPage: line.pageNumber,
        lines: [],
      };
      questions.push(current);
    }

    if (current) {
      current.lines.push(line);
      current.endPage = line.pageNumber;
    }
  }

  return questions.map((question) => ({
    ...question,
    text: question.lines.map((line) => line.text).join("\n").trim(),
  }));
}

function attachAssetsToQuestions(questions, assets) {
  const assetsByQuestion = new Map();

  for (const asset of assets) {
    if (!asset.sourceNumber) {
      continue;
    }

    const group = assetsByQuestion.get(asset.sourceNumber) ?? [];
    group.push(asset);
    assetsByQuestion.set(asset.sourceNumber, group);
  }

  return questions.map((question) => ({
    sourceNumber: question.sourceNumber,
    printedNumber: question.printedNumber,
    section: question.section,
    startPage: question.startPage,
    endPage: question.endPage,
    text: question.text,
    assets: assetsByQuestion.get(question.sourceNumber) ?? [],
  }));
}

async function main() {
  const { pdfPath, docxPath, outDir } = parseArgs(process.argv.slice(2));

  if (!pdfPath || !docxPath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const resolvedPdf = resolve(pdfPath);
  const resolvedDocx = resolve(docxPath);
  const resolvedOut = resolve(outDir);

  if (!existsSync(resolvedPdf)) {
    throw new Error(`Không tìm thấy PDF: ${resolvedPdf}`);
  }

  if (!existsSync(resolvedDocx)) {
    throw new Error(`Không tìm thấy DOCX: ${resolvedDocx}`);
  }

  ensureDirectory(resolvedOut);

  const [pdfLines, docxAssets] = await Promise.all([
    extractPdfLines(resolvedPdf),
    Promise.resolve(extractDocxDrawingAssets(resolvedDocx, resolvedOut)),
  ]);
  const pdfQuestions = buildPdfQuestions(pdfLines);
  const questions = attachAssetsToQuestions(pdfQuestions, docxAssets);
  const manifest = {
    createdAt: new Date().toISOString(),
    pdfPath: resolvedPdf,
    docxPath: resolvedDocx,
    outputDir: resolvedOut,
    counts: {
      pdfLines: pdfLines.length,
      pdfQuestions: pdfQuestions.length,
      docxDrawingAssets: docxAssets.length,
      questionsWithAssets: questions.filter((question) => question.assets.length > 0).length,
    },
    questions,
    docxAssets,
  };

  writeFileSync(join(resolvedOut, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(resolvedOut, "questions.json"), `${JSON.stringify(questions, null, 2)}\n`);
  writeFileSync(
    join(resolvedOut, "pdf-text.txt"),
    questions
      .map((question) => {
        const assetLines = question.assets.map((asset) => `[DOCX_IMAGE: ${asset.relativePath}]`);

        return [`Câu ${question.printedNumber}.`, question.text, ...assetLines].join("\n");
      })
      .join("\n\n---\n\n")
  );

  console.log(`PDF lines: ${pdfLines.length}`);
  console.log(`PDF questions: ${pdfQuestions.length}`);
  console.log(`DOCX drawing assets: ${docxAssets.length}`);
  console.log(`Questions with DOCX assets: ${manifest.counts.questionsWithAssets}`);
  console.log(`Output: ${resolvedOut}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
