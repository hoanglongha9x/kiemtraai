import mammoth from "mammoth";
import {
  inflateRawSync,
} from "node:zlib";

import type {
  QuestionTableBlock,
  QuestionTableCell,
} from "@/types/question-content";

type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
  name: string;
};

const WORD_DOCUMENT_PATH =
  "word/document.xml";

const WORD_RELATIONSHIPS_PATH =
  "word/_rels/document.xml.rels";

const FORMULA_PLACEHOLDER_PREFIX =
  "__KIEMTRA_FORMULA_";

const DOCX_ASSET_MARKER_PREFIX =
  "__KIEMTRA_DOCX_ASSET_";

export type DocxTableImportAsset = {
  kind: "table";
  marker: string;
  table: QuestionTableBlock;
};

export type DocxImageImportAsset = {
  kind: "image";
  marker: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export type DocxImportAsset =
  | DocxTableImportAsset
  | DocxImageImportAsset;

export type ParsedDocxContent = {
  rawText: string;
  assets: DocxImportAsset[];
};

function createAssetMarker(
  index: number
): string {
  return `${DOCX_ASSET_MARKER_PREFIX}${index}__`;
}

function decodeXmlEntities(
  value: string
): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeRegExp(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function stripXmlTags(
  value: string
): string {
  return decodeXmlEntities(
    value.replace(
      /<[^>]+>/g,
      ""
    )
  ).trim();
}

function getXmlBlocks(
  xml: string,
  tagName: string
): string[] {
  const regex =
    new RegExp(
      `<${escapeRegExp(tagName)}\\b[\\s\\S]*?<\\/${escapeRegExp(tagName)}>`,
      "g"
    );

  return xml.match(regex) ?? [];
}

function getFirstXmlBlock(
  xml: string,
  tagName: string
): string {
  return getXmlBlocks(
    xml,
    tagName
  )[0] ?? "";
}

function getOmmlText(
  xml: string
): string {
  const values: string[] = [];
  const textRegex =
    /<m:t\b[^>]*>([\s\S]*?)<\/m:t>/g;

  for (
    const match of
    xml.matchAll(textRegex)
  ) {
    values.push(
      decodeXmlEntities(
        match[1]
      )
    );
  }

  if (values.length > 0) {
    return values.join("");
  }

  return stripXmlTags(xml);
}

function convertOmmlExpression(
  xml: string
): string {
  const fraction =
    getFirstXmlBlock(
      xml,
      "m:f"
    );

  if (fraction) {
    const numerator =
      convertOmmlExpression(
        getFirstXmlBlock(
          fraction,
          "m:num"
        )
      );
    const denominator =
      convertOmmlExpression(
        getFirstXmlBlock(
          fraction,
          "m:den"
        )
      );

    return `\\frac{${numerator}}{${denominator}}`;
  }

  const superscript =
    getFirstXmlBlock(
      xml,
      "m:sSup"
    );

  if (superscript) {
    const base =
      convertOmmlExpression(
        getFirstXmlBlock(
          superscript,
          "m:e"
        )
      );
    const power =
      convertOmmlExpression(
        getFirstXmlBlock(
          superscript,
          "m:sup"
        )
      );

    return `${base}^{${power}}`;
  }

  const subscript =
    getFirstXmlBlock(
      xml,
      "m:sSub"
    );

  if (subscript) {
    const base =
      convertOmmlExpression(
        getFirstXmlBlock(
          subscript,
          "m:e"
        )
      );
    const index =
      convertOmmlExpression(
        getFirstXmlBlock(
          subscript,
          "m:sub"
        )
      );

    return `${base}_{${index}}`;
  }

  const subSup =
    getFirstXmlBlock(
      xml,
      "m:sSubSup"
    );

  if (subSup) {
    const base =
      convertOmmlExpression(
        getFirstXmlBlock(
          subSup,
          "m:e"
        )
      );
    const index =
      convertOmmlExpression(
        getFirstXmlBlock(
          subSup,
          "m:sub"
        )
      );
    const power =
      convertOmmlExpression(
        getFirstXmlBlock(
          subSup,
          "m:sup"
        )
      );

    return `${base}_{${index}}^{${power}}`;
  }

  const radical =
    getFirstXmlBlock(
      xml,
      "m:rad"
    );

  if (radical) {
    const degree =
      convertOmmlExpression(
        getFirstXmlBlock(
          radical,
          "m:deg"
        )
      );
    const value =
      convertOmmlExpression(
        getFirstXmlBlock(
          radical,
          "m:e"
        )
      );

    if (degree) {
      return `\\sqrt[${degree}]{${value}}`;
    }

    return `\\sqrt{${value}}`;
  }

  const functionBlock =
    getFirstXmlBlock(
      xml,
      "m:func"
    );

  if (functionBlock) {
    return [
      convertOmmlExpression(
        getFirstXmlBlock(
          functionBlock,
          "m:fName"
        )
      ),
      convertOmmlExpression(
        getFirstXmlBlock(
          functionBlock,
          "m:e"
        )
      ),
    ]
      .filter(Boolean)
      .join("");
  }

  const delimiter =
    getFirstXmlBlock(
      xml,
      "m:d"
    );

  if (delimiter) {
    return convertOmmlExpression(
      getFirstXmlBlock(
        delimiter,
        "m:e"
      )
    );
  }

  const runs =
    getXmlBlocks(
      xml,
      "m:r"
    );

  if (runs.length > 0) {
    return runs
      .map(getOmmlText)
      .join("");
  }

  return getOmmlText(xml);
}

function convertOmmlToLatex(
  xml: string
): string {
  const expressions =
    getXmlBlocks(
      xml,
      "m:oMath"
    );

  const latex =
    (
      expressions.length > 0
        ? expressions
        : [xml]
    )
      .map(convertOmmlExpression)
      .filter(Boolean)
      .join(" ");

  return latex
    ? `\\(${latex}\\)`
    : "";
}

function readZipEntries(
  buffer: Buffer
): Map<string, Buffer> {
  const entries =
    new Map<string, Buffer>();
  const eocdSignature =
    0x06054b50;
  const centralDirectorySignature =
    0x02014b50;
  const localFileSignature =
    0x04034b50;

  let eocdOffset = -1;

  for (
    let offset =
      buffer.length - 22;
    offset >= 0;
    offset -= 1
  ) {
    if (
      buffer.readUInt32LE(
        offset
      ) === eocdSignature
    ) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset === -1) {
    return entries;
  }

  const centralDirectoryOffset =
    buffer.readUInt32LE(
      eocdOffset + 16
    );
  const entryCount =
    buffer.readUInt16LE(
      eocdOffset + 10
    );

  let offset =
    centralDirectoryOffset;

  for (
    let index = 0;
    index < entryCount;
    index += 1
  ) {
    if (
      buffer.readUInt32LE(
        offset
      ) !==
      centralDirectorySignature
    ) {
      break;
    }

    const fileNameLength =
      buffer.readUInt16LE(
        offset + 28
      );
    const extraLength =
      buffer.readUInt16LE(
        offset + 30
      );
    const commentLength =
      buffer.readUInt16LE(
        offset + 32
      );

    const entry: ZipEntry = {
      compressionMethod:
        buffer.readUInt16LE(
          offset + 10
        ),
      compressedSize:
        buffer.readUInt32LE(
          offset + 20
        ),
      name:
        buffer
          .subarray(
            offset + 46,
            offset +
              46 +
              fileNameLength
          )
          .toString("utf8"),
      localHeaderOffset:
        buffer.readUInt32LE(
          offset + 42
        ),
    };

    offset +=
      46 +
      fileNameLength +
      extraLength +
      commentLength;

    if (
      buffer.readUInt32LE(
        entry.localHeaderOffset
      ) !== localFileSignature
    ) {
      continue;
    }

    const localNameLength =
      buffer.readUInt16LE(
        entry.localHeaderOffset + 26
      );
    const localExtraLength =
      buffer.readUInt16LE(
        entry.localHeaderOffset + 28
      );
    const dataStart =
      entry.localHeaderOffset +
      30 +
      localNameLength +
      localExtraLength;
    const compressed =
      buffer.subarray(
        dataStart,
        dataStart +
          entry.compressedSize
      );

    if (
      entry.compressionMethod === 0
    ) {
      entries.set(
        entry.name,
        compressed
      );
    } else if (
      entry.compressionMethod === 8
    ) {
      entries.set(
        entry.name,
        inflateRawSync(
          compressed
        )
      );
    }
  }

  return entries;
}

function parseDocxXmlText(
  xml: string
): string {
  const formulaMap =
    new Map<string, string>();
  let formulaIndex = 0;

  const xmlWithFormulaPlaceholders =
    xml.replace(
      /<m:oMathPara\b[\s\S]*?<\/m:oMathPara>|<m:oMath\b[\s\S]*?<\/m:oMath>/g,
      (match) => {
        const placeholder =
          `${FORMULA_PLACEHOLDER_PREFIX}${formulaIndex}__`;

        formulaIndex += 1;
        formulaMap.set(
          placeholder,
          convertOmmlToLatex(
            match
          )
        );

        return placeholder;
      }
    );

  const paragraphs =
    getXmlBlocks(
      xmlWithFormulaPlaceholders,
      "w:p"
    );

  return paragraphs
    .map((paragraph) => {
      const text =
        paragraph
          .replace(
            /<w:tab\b[^>]*\/>/g,
            "\t"
          )
          .replace(
            /<w:br\b[^>]*\/>/g,
            "\n"
          );

      const parts: string[] =
        [];
      const textPattern =
        new RegExp(
          `${FORMULA_PLACEHOLDER_PREFIX}\\d+__|<w:t\\b[^>]*>([\\s\\S]*?)<\\/w:t>|\\n|\\t`,
          "g"
        );

      for (
        const match of
        text.matchAll(textPattern)
      ) {
        const token =
          match[0];

        if (
          formulaMap.has(token)
        ) {
          parts.push(
            formulaMap.get(token) ?? ""
          );
          continue;
        }

        if (token === "\n" || token === "\t") {
          parts.push(token);
          continue;
        }

        parts.push(
          decodeXmlEntities(
            match[1] ?? ""
          )
        );
      }

      return parts
        .join("")
        .replace(/\s+\n/g, "\n")
        .trim();
    })
    .filter(Boolean)
    .join("\n");
}

function readDocxDocumentXmlText(
  buffer: Buffer
): string {
  const documentXml =
    readZipEntries(buffer).get(
      WORD_DOCUMENT_PATH
    );

  if (!documentXml) {
    return "";
  }

  return parseDocxXmlText(
    documentXml.toString("utf8")
  );
}

function readAttribute(
  xml: string,
  tagName: string,
  attributeName: string
): string {
  const match = xml.match(
    new RegExp(
      `<${escapeRegExp(tagName)}\\b[^>]*\\b${escapeRegExp(attributeName)}="([^"]*)"`,
      "i"
    )
  );

  return decodeXmlEntities(
    match?.[1] ?? ""
  );
}

function parsePositiveInteger(
  value: string,
  fallback = 1
): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

type ParsedTableCell = {
  cell: QuestionTableCell;
  columnIndex: number;
  columnSpan: number;
  startsVerticalMerge: boolean;
  continuesVerticalMerge: boolean;
};

function parseTableCell(
  cellXml: string,
  columnIndex: number
): ParsedTableCell {
  const columnSpan =
    parsePositiveInteger(
      readAttribute(
        cellXml,
        "w:gridSpan",
        "w:val"
      )
    );
  const horizontalAlignment =
    readAttribute(
      cellXml,
      "w:jc",
      "w:val"
    );
  const verticalAlignment =
    readAttribute(
      cellXml,
      "w:vAlign",
      "w:val"
    );
  const verticalMergeMatch =
    cellXml.match(
      /<w:vMerge\b([^>]*)\/?\s*>/i
    );
  const verticalMergeValue =
    verticalMergeMatch?.[1]
      ?.match(
        /w:val="([^"]*)"/i
      )?.[1]
      ?.toLowerCase() ?? "";
  const hasVerticalMerge =
    Boolean(verticalMergeMatch);

  const align =
    horizontalAlignment ===
      "center"
      ? "center"
      : horizontalAlignment ===
          "right" ||
        horizontalAlignment ===
          "end"
        ? "right"
        : "left";
  const verticalAlign =
    verticalAlignment ===
      "center"
      ? "center"
      : verticalAlignment ===
          "bottom"
        ? "bottom"
        : "top";

  return {
    columnIndex,
    columnSpan,
    startsVerticalMerge:
      hasVerticalMerge &&
      verticalMergeValue ===
        "restart",
    continuesVerticalMerge:
      hasVerticalMerge &&
      verticalMergeValue !==
        "restart",
    cell: {
      content:
        parseDocxXmlText(
          cellXml
        ),
      colSpan:
        columnSpan > 1
          ? columnSpan
          : undefined,
      bold:
        /<w:b\b/i.test(
          cellXml
        ) || undefined,
      italic:
        /<w:i\b/i.test(
          cellXml
        ) || undefined,
      align,
      verticalAlign,
    },
  };
}

function findVerticalMergeOwner(
  rows: ParsedTableCell[][],
  columnIndex: number
): ParsedTableCell | undefined {
  for (
    let rowIndex =
      rows.length - 1;
    rowIndex >= 0;
    rowIndex -= 1
  ) {
    const owner = rows[
      rowIndex
    ].find(
      (candidate) =>
        candidate.startsVerticalMerge &&
        candidate.columnIndex <=
          columnIndex &&
        candidate.columnIndex +
          candidate.columnSpan >
          columnIndex
    );

    if (owner) {
      return owner;
    }
  }

  return undefined;
}

function parseDocxTable(
  tableXml: string
): QuestionTableBlock {
  const parsedRows:
    ParsedTableCell[][] = [];

  for (const rowXml of getXmlBlocks(
    tableXml,
    "w:tr"
  )) {
    const parsedCells:
      ParsedTableCell[] = [];
    let columnIndex = 0;

    for (const cellXml of getXmlBlocks(
      rowXml,
      "w:tc"
    )) {
      const parsedCell =
        parseTableCell(
          cellXml,
          columnIndex
        );

      if (
        parsedCell.continuesVerticalMerge
      ) {
        const owner =
          findVerticalMergeOwner(
            parsedRows,
            columnIndex
          );

        if (owner) {
          owner.cell.rowSpan =
            (owner.cell.rowSpan ?? 1) +
            1;
        }
      } else {
        parsedCells.push(
          parsedCell
        );
      }

      columnIndex +=
        parsedCell.columnSpan;
    }

    parsedRows.push(
      parsedCells
    );
  }

  const columnWidths =
    Array.from(
      tableXml.matchAll(
        /<w:gridCol\b[^>]*\/?\s*>/gi
      )
    )
      .map((match) =>
        match[0]
      )
      .map((gridColumn) =>
        Number(
          readAttribute(
            gridColumn,
            "w:gridCol",
            "w:w"
          )
        )
      )
      .filter(
        (width) =>
          Number.isFinite(
            width
          ) && width > 0
      );

  return {
    type: "table",
    rows:
      parsedRows.map(
        (row) => ({
          cells:
            row.map(
              (item) =>
                item.cell
            ),
        })
      ),
    columnWidths:
      columnWidths.length > 0
        ? columnWidths
        : undefined,
  };
}

function getDocumentBodyBlocks(
  documentXml: string
): string[] {
  const body =
    documentXml.match(
      /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/i
    )?.[1] ?? documentXml;

  return Array.from(
    body.matchAll(
      /<w:(p|tbl)\b[\s\S]*?<\/w:\1>/gi
    )
  ).map((match) => match[0]);
}

function getRelationshipTargets(
  relationshipsXml: string
): Map<string, string> {
  const targets =
    new Map<string, string>();

  for (const match of
    relationshipsXml.matchAll(
      /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/gi
    )) {
    targets.set(
      match[1],
      decodeXmlEntities(
        match[2]
      )
    );
  }

  return targets;
}

function getImageMimeType(
  fileName: string
): string {
  const extension =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase();

  if (extension === "jpg" ||
      extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "gif") {
    return "image/gif";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "svg") {
    return "image/svg+xml";
  }

  return "image/png";
}

function resolveWordTarget(
  target: string
): string {
  return `word/${target}`
    .replace(/\\/g, "/")
    .replace(
      /\/\.\//g,
      "/"
    )
    .replace(
      /word\/\.\.\//g,
      ""
    );
}

export function parseDocxDocumentContent(
  documentXml: string,
  entries:
    Map<string, Buffer> =
      new Map(),
  relationshipsXml = ""
): ParsedDocxContent {
  const assets:
    DocxImportAsset[] = [];
  const outputLines:
    string[] = [];
  const relationshipTargets =
    getRelationshipTargets(
      relationshipsXml
    );

  const addAsset = (
    asset:
      Omit<
        DocxTableImportAsset,
        "marker"
      > |
      Omit<
        DocxImageImportAsset,
        "marker"
      >
  ) => {
    const marker =
      createAssetMarker(
        assets.length
      );

    assets.push({
      ...asset,
      marker,
    } as DocxImportAsset);
    outputLines.push(marker);
  };

  for (const blockXml of
    getDocumentBodyBlocks(
      documentXml
    )) {
    if (
      /^<w:tbl\b/i.test(
        blockXml
      )
    ) {
      addAsset({
        kind: "table",
        table:
          parseDocxTable(
            blockXml
          ),
      });
      continue;
    }

    const paragraphText =
      parseDocxXmlText(
        blockXml
      );

    if (paragraphText) {
      outputLines.push(
        paragraphText
      );
    }

    const relationshipIds =
      Array.from(
        blockXml.matchAll(
          /r:embed="([^"]+)"/gi
        )
      ).map((match) =>
        match[1]
      );

    for (const relationshipId of
      relationshipIds) {
      const target =
        relationshipTargets.get(
          relationshipId
        );

      if (!target) {
        continue;
      }

      const entryPath =
        resolveWordTarget(
          target
        );
      const buffer =
        entries.get(entryPath);

      if (!buffer) {
        continue;
      }

      const fileName =
        entryPath
          .split("/")
          .pop() ||
        `image-${assets.length + 1}.png`;

      addAsset({
        kind: "image",
        fileName,
        mimeType:
          getImageMimeType(
            fileName
          ),
        buffer,
      });
    }
  }

  return {
    rawText:
      outputLines
        .filter(Boolean)
        .join("\n")
        .trim(),
    assets,
  };
}

export async function parseDocxFileWithAssets(
  file: File
): Promise<ParsedDocxContent> {
  const arrayBuffer =
    await file.arrayBuffer();
  const buffer =
    Buffer.from(
      arrayBuffer
    );
  const entries =
    readZipEntries(buffer);
  const documentXml =
    entries.get(
      WORD_DOCUMENT_PATH
    )?.toString("utf8") ?? "";
  const relationshipsXml =
    entries.get(
      WORD_RELATIONSHIPS_PATH
    )?.toString("utf8") ?? "";

  if (documentXml) {
    const parsed =
      parseDocxDocumentContent(
        documentXml,
        entries,
        relationshipsXml
      );

    if (parsed.rawText) {
      return parsed;
    }
  }

  const result =
    await mammoth.extractRawText({
      buffer,
    });

  return {
    rawText:
      result.value,
    assets: [],
  };
}

export async function parseDocxFile(
  file: File
): Promise<string> {
  const arrayBuffer =
    await file.arrayBuffer();
  const buffer =
    Buffer.from(
      arrayBuffer
    );
  const result =
    await mammoth.extractRawText({
      buffer,
    });
  const xmlText =
    readDocxDocumentXmlText(
      buffer
    );

  return xmlText || result.value;
}
