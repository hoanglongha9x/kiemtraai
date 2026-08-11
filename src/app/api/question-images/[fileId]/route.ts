import {
  NextResponse,
} from "next/server";

import {
  getApiErrorResponse,
} from "@/server/http/apiError";

import {
  loadQuestionImage,
} from "@/server/question-images/questionImage";

export const runtime =
  "nodejs";

type RouteContext = {
  params: Promise<{
    fileId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      fileId,
    } =
      await context.params;

    const image =
      await loadQuestionImage(
        fileId
      );

    const headers =
      new Headers();

    headers.set(
      "Content-Type",
      image.contentType
    );

    headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    );

    headers.set(
      "X-Content-Type-Options",
      "nosniff"
    );

    if (
      image.contentLength
    ) {
      headers.set(
        "Content-Length",
        image.contentLength
      );
    }

    if (
      image.etag
    ) {
      headers.set(
        "ETag",
        image.etag
      );
    }

    if (
      image.lastModified
    ) {
      headers.set(
        "Last-Modified",
        image.lastModified
      );
    }

    return new NextResponse(
      image.body,
      {
        status:
          200,

        headers,
      }
    );
  } catch (
    error: unknown
  ) {
    console.error(
      "GET /api/question-images/[fileId] error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không tải được hình ảnh."
    );
  }
}