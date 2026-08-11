import {
  ImportFileError,
  validateImportFile,
} from "../lib/importFileValidation";

import {
  parseDocxFileWithAssets,
  type DocxImportAsset,
} from "./parseDocxFile";

import {
  parseTxtFile,
} from "./parseTxtFile";

export type ParsedImportFile = {
  fileName: string;
  extension:
    | "docx"
    | "pdf"
    | "txt";
  rawText: string;
  docxAssets?:
    DocxImportAsset[];
  docxAssetFileName?: string;
  docxAssetPlacements?: Array<{
    marker: string;
    sourceNumber: number;
  }>;
};

function buildDocxAssetPlacements(
  rawText: string
): Array<{
  marker: string;
  sourceNumber: number;
}> {
  const placements: Array<{
    marker: string;
    sourceNumber: number;
  }> = [];
  let sourceNumber = 0;

  rawText
    .split(/\n+/)
    .forEach((line) => {
      if (
        /^\s*Câu\s+\d{1,4}\s*[.:]/iu.test(
          line
        )
      ) {
        sourceNumber += 1;
      }

      for (const match of line.matchAll(
        /__KIEMTRA_DOCX_ASSET_\d+__/g
      )) {
        if (sourceNumber > 0) {
          placements.push({
            marker:
              match[0],
            sourceNumber,
          });
        }
      }
    });

  return placements;
}

export async function parseImportFile(
  file: File,
  options: {
    docxAssetFile?: File;
  } = {}
): Promise<ParsedImportFile> {
  const extension =
    validateImportFile(
      file
    );

  let rawText: string;
  let docxAssets:
    DocxImportAsset[] |
    undefined;
  let docxAssetFileName:
    string | undefined;
  let docxAssetPlacements:
    ParsedImportFile["docxAssetPlacements"];

  if (extension === "pdf") {
    if (
      options.docxAssetFile
    ) {
      const assetExtension =
        validateImportFile(
          options.docxAssetFile
        );

      if (
        assetExtension !==
        "docx"
      ) {
        throw new ImportFileError(
          "File phụ để lấy ảnh phải là file .docx.",
          400
        );
      }

      const parsedAssetDocx =
        await parseDocxFileWithAssets(
          options.docxAssetFile
        );

      docxAssets =
        parsedAssetDocx.assets;
      docxAssetFileName =
        options.docxAssetFile.name;
      docxAssetPlacements =
        buildDocxAssetPlacements(
          parsedAssetDocx.rawText
        );
    }

    return {
      fileName:
        file.name,
      extension,
      rawText: "",
      docxAssets,
      docxAssetFileName,
      docxAssetPlacements,
    };
  }

  if (extension === "txt") {
    rawText =
      await parseTxtFile(
        file
      );
  } else {
    const parsedDocx =
      await parseDocxFileWithAssets(
        file
      );

    rawText =
      parsedDocx.rawText;
    docxAssets =
      parsedDocx.assets;
  }

  const normalizedText =
    rawText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();

  if (!normalizedText) {
    throw new ImportFileError(
      "Không đọc được nội dung văn bản trong file.",
      422
    );
  }

  return {
    fileName:
      file.name,
    extension,
    rawText:
      normalizedText,
    docxAssets,
    docxAssetFileName,
    docxAssetPlacements,
  };
}
