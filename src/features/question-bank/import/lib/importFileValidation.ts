export const MAX_IMPORT_FILE_SIZE =
  10 * 1024 * 1024;

export const SUPPORTED_IMPORT_EXTENSIONS =
  [
    "docx",
    "pdf",
    "txt",
  ] as const;

export type SupportedImportExtension =
  (typeof SUPPORTED_IMPORT_EXTENSIONS)[number];

const supportedExtensionSet =
  new Set<string>(
    SUPPORTED_IMPORT_EXTENSIONS
  );

export class ImportFileError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number
  ) {
    super(message);

    this.name =
      "ImportFileError";

    this.status = status;
  }
}

export function getFileExtension(
  fileName: string
): string {
  const normalizedFileName =
    fileName.trim();

  const lastDotIndex =
    normalizedFileName.lastIndexOf(
      "."
    );

  if (
    lastDotIndex === -1 ||
    lastDotIndex ===
      normalizedFileName.length -
        1
  ) {
    return "";
  }

  return normalizedFileName
    .slice(lastDotIndex + 1)
    .toLocaleLowerCase();
}

export function isSupportedImportExtension(
  extension: string
): extension is SupportedImportExtension {
  return supportedExtensionSet.has(
    extension
  );
}

export function validateImportFile(
  file: File
): SupportedImportExtension {
  const extension =
    getFileExtension(
      file.name
    );

  if (
    !isSupportedImportExtension(
      extension
    )
  ) {
    throw new ImportFileError(
      "Định dạng chưa được hỗ trợ. Vui lòng sử dụng file .docx, .pdf hoặc .txt.",
      400
    );
  }

  if (file.size === 0) {
    throw new ImportFileError(
      "File đang trống.",
      400
    );
  }

  if (
    file.size >
    MAX_IMPORT_FILE_SIZE
  ) {
    throw new ImportFileError(
      "Dung lượng file vượt quá 10 MB.",
      413
    );
  }

  return extension;
}
