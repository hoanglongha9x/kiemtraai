import {
  NextResponse,
} from "next/server";

import {
  getAdminDb,
} from "@/lib/firebase/admin";

import {
  buildExamAssignmentInfo,
  safeUpper,
} from "@/features/exam";

export const runtime =
  "nodejs";

class ApiError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400
  ) {
    super(message);

    this.name =
      "ApiError";

    this.statusCode =
      statusCode;
  }
}

async function findAssignmentByCode(
  assignmentCode: string
) {
  const db =
    getAdminDb();

  for (const collectionName of [
    "assignments",
    "testAssignments",
  ]) {
    const snapshot =
      await db
        .collection(
          collectionName
        )
        .where(
          "assignmentCode",
          "==",
          assignmentCode
        )
        .limit(1)
        .get();

    if (!snapshot.empty) {
      return snapshot.docs[0];
    }
  }

  return null;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const assignmentCode =
      safeUpper(
        body.assignmentCode
      );

    if (!assignmentCode) {
      throw new ApiError(
        "Thiếu mã giao đề.",
        400
      );
    }

    const document =
      await findAssignmentByCode(
        assignmentCode
      );

    if (!document) {
      throw new ApiError(
        "Không tìm thấy bài kiểm tra với mã này.",
        404
      );
    }

    const assignment =
      buildExamAssignmentInfo(
        document.id,
        document.data()
      );

    /*
     * Assignment-info vẫn trả thông tin của bài scheduled hoặc closed
     * để frontend hiển thị đúng trạng thái.
     *
     * Chỉ archived bị ẩn hoàn toàn khỏi học sinh.
     */
    if (
      assignment.accessState ===
      "archived"
    ) {
      throw new ApiError(
        assignment.accessMessage,
        404
      );
    }

    return NextResponse.json({
      status:
        "success",

      assignment,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "POST /api/student/assignment-info error:",
      error
    );

    const statusCode =
      error instanceof
      ApiError
        ? error.statusCode
        : 500;

    const message =
      error instanceof Error
        ? error.message
        : "Không lấy được thông tin bài kiểm tra.";

    return NextResponse.json(
      {
        status:
          "error",

        message,
      },
      {
        status:
          statusCode,
      }
    );
  }
}