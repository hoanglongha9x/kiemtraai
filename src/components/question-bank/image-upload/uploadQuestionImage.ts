import type {
  QuestionImageUploadResult,
} from "./types";

type QuestionImageUploadResponse = {
  success?: boolean;
  status?: string;
  message?: string;

  data?: {
    fileId?: string;
    imageId?: string;

    imageUrl?: string;
    url?: string;

    viewUrl?: string;
    fileName?: string;
  };

  fileId?: string;
  imageId?: string;

  imageUrl?: string;
  url?: string;

  viewUrl?: string;
  fileName?: string;
};

function readText(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

export async function uploadQuestionImage(
  file: File,
  options?: {
    questionId?: string;
    idToken?: string;
  }
): Promise<QuestionImageUploadResult> {
  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  if (
    options?.questionId
  ) {
    formData.append(
      "questionId",
      options.questionId
    );
  }

  const headers =
    new Headers();

  if (
    options?.idToken
  ) {
    headers.set(
      "Authorization",
      `Bearer ${options.idToken}`
    );
  }

  const response =
    await fetch(
      "/api/teacher/question-images",
      {
        method: "POST",
        headers,
        body: formData,
      }
    );

  let result:
    QuestionImageUploadResponse;

  try {
    result =
      await response.json() as
        QuestionImageUploadResponse;
  } catch {
    throw new Error(
      "Máy chủ trả về dữ liệu tải ảnh không hợp lệ."
    );
  }

  if (
    !response.ok
  ) {
    throw new Error(
      readText(
        result.message
      ) ||
      "Không thể tải hình ảnh lên."
    );
  }

  const imageId =
    readText(
      result.data?.fileId ??
      result.data?.imageId ??
      result.fileId ??
      result.imageId
    );

  const returnedImageUrl =
    readText(
      result.data?.imageUrl ??
      result.data?.url ??
      result.imageUrl ??
      result.url
    );

  if (
    !imageId &&
    !returnedImageUrl
  ) {
    throw new Error(
      "API không trả về imageId hoặc imageUrl."
    );
  }

  /*
   * Ưu tiên proxy nội bộ khi có fileId.
   * Không lưu route /api/teacher/... vì học sinh
   * không có quyền truy cập route giáo viên.
   */
  const imageUrl =
    imageId
      ? `/api/question-images/${encodeURIComponent(
          imageId
        )}`
      : returnedImageUrl;

  return {
    imageId,
    imageUrl,

    viewUrl:
      readText(
        result.data?.viewUrl ??
        result.viewUrl
      ) ||
      undefined,

    fileName:
      readText(
        result.data?.fileName ??
        result.fileName
      ) ||
      undefined,
  };
}