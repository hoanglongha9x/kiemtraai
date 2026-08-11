import {
  MAX_ASSIGNMENT_ATTEMPTS,
  MAX_ASSIGNMENT_CLASSES,
} from "../constants";

import type {
  CreateAssignmentInput,
  CreateAssignmentValidationIssue,
  CreateAssignmentValidationResult,
} from "../types";

function normalizeString(
  value:
    string | undefined
): string {
  return (
    value?.trim() ??
    ""
  );
}

function isValidDate(
  value:
    string
): boolean {
  if (!value) {
    return true;
  }

  return !Number.isNaN(
    new Date(
      value
    ).getTime()
  );
}

export function validateCreateAssignment(
  input:
    CreateAssignmentInput
): CreateAssignmentValidationResult {
  const issues:
    CreateAssignmentValidationIssue[] =
      [];

  const testId =
    normalizeString(
      input.testId
    );

  const classIds =
    Array.from(
      new Set(
        (
          input.classIds ??
          []
        )
          .map(
            (
              classId
            ) =>
              classId.trim()
          )
          .filter(
            Boolean
          )
      )
    );

  const maxAttempts =
    Number(
      input.maxAttempts ??
        1
    );

  const startTime =
    normalizeString(
      input.startTime
    );

  const endTime =
    normalizeString(
      input.endTime
    );

  if (!testId) {
    issues.push({
      field:
        "testId",

      message:
        "Vui lòng chọn đề kiểm tra.",
    });
  }

  if (
    classIds.length ===
    0
  ) {
    issues.push({
      field:
        "classIds",

      message:
        "Vui lòng chọn ít nhất một lớp.",
    });
  }

  if (
    classIds.length >
    MAX_ASSIGNMENT_CLASSES
  ) {
    issues.push({
      field:
        "classIds",

      message:
        `Mỗi lượt giao đề không được vượt quá ${MAX_ASSIGNMENT_CLASSES} lớp.`,
    });
  }

  if (
    !Number.isInteger(
      maxAttempts
    ) ||
    maxAttempts <
      1 ||
    maxAttempts >
      MAX_ASSIGNMENT_ATTEMPTS
  ) {
    issues.push({
      field:
        "maxAttempts",

      message:
        `Số lượt làm bài phải là số nguyên từ 1 đến ${MAX_ASSIGNMENT_ATTEMPTS}.`,
    });
  }

  if (
    startTime &&
    !isValidDate(
      startTime
    )
  ) {
    issues.push({
      field:
        "startTime",

      message:
        "Thời gian mở bài không hợp lệ.",
    });
  }

  if (
    endTime &&
    !isValidDate(
      endTime
    )
  ) {
    issues.push({
      field:
        "endTime",

      message:
        "Thời gian đóng bài không hợp lệ.",
    });
  }

  if (
    startTime &&
    endTime &&
    isValidDate(
      startTime
    ) &&
    isValidDate(
      endTime
    ) &&
    new Date(
      endTime
    ).getTime() <=
      new Date(
        startTime
      ).getTime()
  ) {
    issues.push({
      field:
        "endTime",

      message:
        "Thời gian đóng bài phải sau thời gian mở bài.",
    });
  }

  return {
    valid:
      issues.length ===
      0,

    issues,
  };
}