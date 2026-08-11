import {
  ApiError,
} from "@/server/http/apiError";

import {
  safeString,
} from "@/server/shared/normalize";

const GOOGLE_DRIVE_FILE_ID_PATTERN =
  /^[a-zA-Z0-9_-]{10,200}$/;

const ALLOWED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    "image/avif",
  ]);

export function normalizeQuestionImageFileId(
  value: unknown
): string {
  const fileId =
    safeString(
      value
    );

  if (
    !fileId ||
    !GOOGLE_DRIVE_FILE_ID_PATTERN.test(
      fileId
    )
  ) {
    throw new ApiError(
      "Mã hình ảnh không hợp lệ.",
      400,
      {
        code:
          "INVALID_QUESTION_IMAGE_ID",
      }
    );
  }

  return fileId;
}

function buildGoogleDriveImageUrls(
  fileId: string
): string[] {
  const encodedFileId =
    encodeURIComponent(
      fileId
    );

  return [
    `https://drive.google.com/uc?export=view&id=${encodedFileId}`,

    `https://drive.usercontent.google.com/download?id=${encodedFileId}&export=view&confirm=t`,

    `https://lh3.googleusercontent.com/d/${encodedFileId}`,
  ];
}

function normalizeContentType(
  value: string | null
): string {
  return (
    value
      ?.split(";")[0]
      ?.trim()
      .toLowerCase() ??
    ""
  );
}

function isAllowedImageType(
  contentType: string
): boolean {
  return (
    ALLOWED_IMAGE_TYPES.has(
      contentType
    ) ||
    contentType.startsWith(
      "image/"
    )
  );
}

async function fetchImageFromUrl(
  url: string
): Promise<Response | null> {
  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          redirect:
            "follow",

          cache:
            "no-store",

          headers: {
            Accept:
              "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",

            "User-Agent":
              "KIEMTRA-AI-Image-Proxy/1.0",
          },
        }
      );

    if (
      !response.ok
    ) {
      return null;
    }

    const contentType =
      normalizeContentType(
        response.headers.get(
          "content-type"
        )
      );

    if (
      !isAllowedImageType(
        contentType
      )
    ) {
      return null;
    }

    return response;
  } catch {
    return null;
  }
}

export type ProxiedQuestionImage = {
  body: ArrayBuffer;

  contentType: string;

  contentLength?: string;

  etag?: string;

  lastModified?: string;
};

export async function loadQuestionImage(
  rawFileId: unknown
): Promise<ProxiedQuestionImage> {
  const fileId =
    normalizeQuestionImageFileId(
      rawFileId
    );

  const candidateUrls =
    buildGoogleDriveImageUrls(
      fileId
    );

  for (
    const url of
    candidateUrls
  ) {
    const response =
      await fetchImageFromUrl(
        url
      );

    if (
      !response
    ) {
      continue;
    }

    const body =
      await response.arrayBuffer();

    if (
      body.byteLength ===
      0
    ) {
      continue;
    }

    return {
      body,

      contentType:
        normalizeContentType(
          response.headers.get(
            "content-type"
          )
        ) ||
        "image/jpeg",

      contentLength:
        response.headers.get(
          "content-length"
        ) ||
        undefined,

      etag:
        response.headers.get(
          "etag"
        ) ||
        undefined,

      lastModified:
        response.headers.get(
          "last-modified"
        ) ||
        undefined,
    };
  }

  throw new ApiError(
    "Không tải được hình ảnh câu hỏi. Hãy kiểm tra quyền chia sẻ của tệp.",
    404,
    {
      code:
        "QUESTION_IMAGE_NOT_FOUND",
    }
  );
}