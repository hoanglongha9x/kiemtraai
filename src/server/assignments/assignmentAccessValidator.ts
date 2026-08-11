import {
  verifyPassword,
} from "@/lib/security/password";

import {
  ApiError,
} from "@/server/http/apiError";

import {
  normalizeBoolean,
  safeString,
} from "@/server/shared/normalize";

import {
  resolveAssignmentAccessState,
} from "./assignmentMapper";

import type {
  AssignmentStatus,
} from "./assignmentTypes";

function readAssignmentStatus(
  value: unknown
): AssignmentStatus {
  const status =
    safeString(
      value
    );

  if (
    status === "draft" ||
    status === "scheduled" ||
    status === "active" ||
    status === "closed" ||
    status === "locked" ||
    status === "archived"
  ) {
    return status;
  }

  return "draft";
}

export function validateAssignmentAccess(
  assignmentData: Record<
    string,
    unknown
  >,
  password?: unknown
): void {
  const status =
    readAssignmentStatus(
      assignmentData.status
    );

  if (
    status === "draft"
  ) {
    throw new ApiError(
      "Bài kiểm tra này chưa được mở cho học sinh.",
      403,
      {
        code:
          "ASSIGNMENT_NOT_RELEASED",
      }
    );
  }

  const startTime =
    safeString(
      assignmentData.startTime
    ) ||
    undefined;

  const endTime =
    safeString(
      assignmentData.endTime
    ) ||
    undefined;

  const accessState =
    resolveAssignmentAccessState(
      status,
      startTime,
      endTime
    );

  if (
    accessState === "scheduled"
  ) {
    throw new ApiError(
      "Bài kiểm tra chưa đến thời gian bắt đầu.",
      403,
      {
        code:
          "ASSIGNMENT_NOT_STARTED",

        details: {
          startTime,
        },
      }
    );
  }

  if (
    accessState === "closed"
  ) {
    throw new ApiError(
      "Bài kiểm tra đã kết thúc.",
      403,
      {
        code:
          "ASSIGNMENT_CLOSED",

        details: {
          endTime,
        },
      }
    );
  }

  if (
    accessState === "locked"
  ) {
    throw new ApiError(
      "Bài kiểm tra đang bị khóa.",
      403,
      {
        code:
          "ASSIGNMENT_LOCKED",
      }
    );
  }

  if (
    accessState === "archived"
  ) {
    throw new ApiError(
      "Bài kiểm tra không còn khả dụng.",
      403,
      {
        code:
          "ASSIGNMENT_ARCHIVED",
      }
    );
  }

  const hasPassword =
    normalizeBoolean(
      assignmentData.hasPassword,
      false
    );

  if (!hasPassword) {
    return;
  }

  const enteredPassword =
    safeString(
      password
    );

  if (!enteredPassword) {
    throw new ApiError(
      "Vui lòng nhập mật khẩu bài kiểm tra.",
      401,
      {
        code:
          "ASSIGNMENT_PASSWORD_REQUIRED",
      }
    );
  }

  const storedPasswordHash =
    safeString(
      assignmentData.passwordHash
    );

  if (!storedPasswordHash) {
    throw new ApiError(
      "Cấu hình mật khẩu bài kiểm tra không hợp lệ.",
      500,
      {
        code:
          "ASSIGNMENT_PASSWORD_CONFIG_INVALID",
      }
    );
  }

  if (
    !verifyPassword(
      enteredPassword,
      storedPasswordHash
    )
  ) {
    throw new ApiError(
      "Mật khẩu bài kiểm tra không đúng.",
      401,
      {
        code:
          "ASSIGNMENT_PASSWORD_INVALID",
      }
    );
  }
}