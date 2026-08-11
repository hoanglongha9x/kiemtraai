import {
  NextResponse,
} from "next/server";

import {
  getApiErrorResponse,
} from "@/server/http/apiError";

import {
  publishTeacherTest,
} from "@/server/tests/testService";

export const runtime =
  "nodejs";

type RouteContext = {
  params: Promise<{
    testId: string;
  }>;
};

export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      testId,
    } = await context.params;

    const result =
      await publishTeacherTest(
        request,
        testId
      );

    return NextResponse.json({
      status:
        "success",

      ...result,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "PUT /api/teacher/tests/[testId]/publish error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không xuất bản được đề kiểm tra."
    );
  }
}