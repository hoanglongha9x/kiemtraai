import {
  NextResponse,
} from "next/server";

import {
  getApiErrorResponse,
} from "@/server/http/apiError";

import {
  createTeacherAssignment,
  listTeacherAssignments,
} from "@/server/assignments/assignmentService";

export const runtime =
  "nodejs";

export async function GET(
  request: Request
) {
  try {
    const assignments =
      await listTeacherAssignments(
        request
      );

    return NextResponse.json({
      status:
        "success",

      assignments,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "GET /api/teacher/assignments error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không tải được danh sách bài giao."
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
      await createTeacherAssignment(
        request,
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
      "POST /api/teacher/assignments error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không giao được bài kiểm tra."
    );
  }
}