import {
  ApiError,
} from "@/server/http/apiError";

import {
  safeString,
} from "@/server/shared/normalize";

import type {
  TestSection,
} from "./testTypes";

function readObject(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

export function getStoredTestSections(
  testData: Record<string, unknown>
): TestSection[] {
  if (
    Array.isArray(
      testData.sections
    )
  ) {
    return testData.sections as TestSection[];
  }

  return [];
}

export function countStoredQuestions(
  testData: Record<string, unknown>
): number {
  const sections =
    getStoredTestSections(
      testData
    );

  if (
    sections.length >
    0
  ) {
    return sections.reduce(
      (
        total,
        section
      ) =>
        total +
        (
          Array.isArray(
            section.questions
          )
            ? section.questions.length
            : 0
        ),
      0
    );
  }

  /*
   * Tương thích dữ liệu cũ trong thời gian migration.
   */
  if (
    Array.isArray(
      testData.questions
    )
  ) {
    return testData.questions.length;
  }

  return 0;
}

export function validateTestForPublishing(
  testData: Record<string, unknown>
): void {
  const title =
    safeString(
      testData.title
    );

  if (!title) {
    throw new ApiError(
      "Đề kiểm tra chưa có tên.",
      400,
      {
        code:
          "TEST_TITLE_REQUIRED",
      }
    );
  }

  const totalQuestions =
    countStoredQuestions(
      testData
    );

  if (
    totalQuestions <=
    0
  ) {
    throw new ApiError(
      "Đề kiểm tra cần ít nhất 1 câu hỏi trước khi xuất bản.",
      400,
      {
        code:
          "TEST_QUESTIONS_REQUIRED",
      }
    );
  }

  const status =
    safeString(
      testData.status
    );

  if (
    status ===
    "archived"
  ) {
    throw new ApiError(
      "Không thể xuất bản một đề đã lưu trữ.",
      400,
      {
        code:
          "ARCHIVED_TEST_CANNOT_BE_PUBLISHED",
      }
    );
  }

  const version =
    readObject(
      testData.version
    );

  const versionStatus =
    safeString(
      version.status
    );

  if (
    status ===
      "published" &&
    versionStatus ===
      "published"
  ) {
    throw new ApiError(
      "Đề kiểm tra đã được xuất bản.",
      409,
      {
        code:
          "TEST_ALREADY_PUBLISHED",
      }
    );
  }
}

export function validateTestForEditing(
  testData: Record<string, unknown>
): void {
  const status =
    safeString(
      testData.status
    ) || "draft";

  if (
    status === "published"
  ) {
    throw new ApiError(
      "Đề đã xuất bản không thể chỉnh sửa trực tiếp. Hãy tạo phiên bản mới.",
      409,
      {
        code:
          "PUBLISHED_TEST_CANNOT_BE_EDITED",
      }
    );
  }

  if (
    status === "archived"
  ) {
    throw new ApiError(
      "Không thể chỉnh sửa đề đã lưu trữ.",
      409,
      {
        code:
          "ARCHIVED_TEST_CANNOT_BE_EDITED",
      }
    );
  }
}