import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  isApiError,
} from "@/server/http/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type AppsScriptUploadResponse = {
  success?: boolean;
  message?: string;
  data?: {
    fileId?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    imageUrl?: string;
    viewUrl?: string;
    downloadUrl?: string;
  };
};

function getAppsScriptUrl(): string {
  const url = process.env.APPS_SCRIPT_WEB_APP_URL?.trim();

  if (!url) {
    throw new Error(
      "Thiếu biến môi trường APPS_SCRIPT_WEB_APP_URL."
    );
  }

  return url;
}

function arrayBufferToBase64(
  arrayBuffer: ArrayBuffer
): string {
  return Buffer
    .from(arrayBuffer)
    .toString("base64");
}

export async function POST(
  request: NextRequest
) {
  try {
    await getCurrentTeacher(request);

    const formData = await request.formData();

    const fileValue = formData.get("file");
    const questionIdValue =
      formData.get("questionId");

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Không tìm thấy file ảnh.",
        },
        {
          status: 400,
        }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.",
        },
        {
          status: 400,
        }
      );
    }

    if (fileValue.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "File ảnh rỗng.",
        },
        {
          status: 400,
        }
      );
    }

    if (fileValue.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ảnh không được vượt quá 5 MB.",
        },
        {
          status: 413,
        }
      );
    }

    const arrayBuffer =
      await fileValue.arrayBuffer();

    const base64Data =
      arrayBufferToBase64(arrayBuffer);

    const appsScriptResponse = await fetch(
      getAppsScriptUrl(),
      {
        method: "POST",

        /*
         * Không dùng mode: "no-cors".
         * Next.js gọi từ server nên không bị CORS trình duyệt.
         */
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          /*
           * Tên này phải khớp chính xác với
           * case "uploadQuestionImage"
           * trong Apps Script.
           */
          action: "uploadQuestionImage",

          fileName: fileValue.name,
          mimeType: fileValue.type,
          base64Data,

          questionId:
            typeof questionIdValue === "string"
              ? questionIdValue
              : "",
        }),

        cache: "no-store",
        redirect: "follow",
      }
    );

    const rawResponse = await appsScriptResponse.text();

    let result: AppsScriptUploadResponse;

    try {
      result = JSON.parse(
        rawResponse
      ) as AppsScriptUploadResponse;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Apps Script trả về dữ liệu không hợp lệ.",
          debug: {
            status: appsScriptResponse.status,
            finalUrl: appsScriptResponse.url,
            contentType:
              appsScriptResponse.headers.get(
                "content-type"
              ),
            responsePreview:
              rawResponse.slice(0, 1000),
          },
        },
        {
          status: 502,
        }
      );
    }
    if (
      !appsScriptResponse.ok ||
      !result.success ||
      !result.data?.imageUrl
    ) {
      console.error(
        "Google Drive upload failed:",
        result
      );

      return NextResponse.json(
        {
          success: false,
          message:
            result.message ||
            "Không thể tải ảnh lên Google Drive.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          result.message ||
          "Tải ảnh lên thành công.",
        data: {
          fileId: result.data.fileId,
          fileName: result.data.fileName,
          mimeType: result.data.mimeType,
          size: result.data.size,
          imageUrl: result.data.imageUrl,
          viewUrl: result.data.viewUrl,
          downloadUrl:
            result.data.downloadUrl,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/teacher/question-images error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Không thể tải ảnh lên.",
      },
      {
        status: isApiError(error)
          ? error.statusCode
          : 500,
      }
    );
  }
}