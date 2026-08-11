import {
  ApiError,
} from "@/server/http/apiError";

import {
  safeString,
} from "@/server/shared/normalize";

import {
  getAssignmentByCode,
} from "./assignmentRepository";

import {
  validateAssignmentAccess,
} from "./assignmentAccessValidator";

import {
  mapStudentAssignment,
} from "./studentAssignmentMapper";

function readObject(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

export async function openStudentAssignment(
  rawBody: unknown
) {
  const body =
    readObject(
      rawBody
    );

  const assignmentCode =
    safeString(
      body.assignmentCode ??
        body.code
    ).toUpperCase();

  const password =
    safeString(
      body.password
    );

  if (!assignmentCode) {
    throw new ApiError(
      "Vui lòng nhập mã bài kiểm tra.",
      400,
      {
        code:
          "ASSIGNMENT_CODE_REQUIRED",
      }
    );
  }

  const storedAssignment =
    await getAssignmentByCode(
      assignmentCode
    );

  if (!storedAssignment) {
    throw new ApiError(
      "Không tìm thấy bài kiểm tra với mã đã nhập.",
      404,
      {
        code:
          "ASSIGNMENT_NOT_FOUND",
      }
    );
  }

  validateAssignmentAccess(
    storedAssignment.data,
    password
  );

  const testSnapshot =
    readObject(
      storedAssignment.data
        .testSnapshot
    );

  if (
    Object.keys(
      testSnapshot
    ).length === 0
  ) {
    throw new ApiError(
      "Bài giao chưa có snapshot đề kiểm tra hợp lệ.",
      409,
      {
        code:
          "ASSIGNMENT_SNAPSHOT_MISSING",
      }
    );
  }

  const sections =
    testSnapshot.sections;

  if (
    !Array.isArray(
      sections
    ) ||
    sections.length === 0
  ) {
    throw new ApiError(
      "Bài giao chưa có dữ liệu câu hỏi.",
      409,
      {
        code:
          "ASSIGNMENT_QUESTIONS_MISSING",
      }
    );
  }

  const assignment =
    mapStudentAssignment(
      storedAssignment.id,
      storedAssignment.data
    );

  return {
    assignment,

    message:
      "Đã mở bài kiểm tra thành công.",
  };
}