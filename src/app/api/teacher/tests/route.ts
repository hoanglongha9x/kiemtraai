import {
  NextResponse,
} from "next/server";

import {
  getApiErrorResponse,
} from "@/server/http/apiError";

import {
  createTeacherTest,
  listTeacherTests,
} from "@/server/tests/testService";

export const runtime =
  "nodejs";

export async function GET(
  request: Request
) {
  try {
    const tests =
      await listTeacherTests(
        request
      );

    return NextResponse.json({
      status:
        "success",

      tests,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "GET /api/teacher/tests error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không tải được danh sách đề."
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const result =
      await createTeacherTest(
        request,
        body
      );

    const {
      status: testStatus,
      ...responseData
    } = result;

    return NextResponse.json({
      status: "success",
      testStatus,
      ...responseData,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "POST /api/teacher/tests error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không tạo được bài kiểm tra."
    );
  }
}