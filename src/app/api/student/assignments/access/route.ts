import {
  NextResponse,
} from "next/server";

import {
  getApiErrorResponse,
} from "@/server/http/apiError";

import {
  openStudentAssignment,
} from "@/server/assignments/studentAssignmentService";

export const runtime =
  "nodejs";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const result =
      await openStudentAssignment(
        body
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
      "POST /api/student/assignments/access error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không mở được bài kiểm tra."
    );
  }
}