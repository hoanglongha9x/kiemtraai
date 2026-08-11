import {
  archiveTest as archiveTestRepository,
  createTest as createTestRepository,
  deleteTest as deleteTestRepository,
  duplicateTest as duplicateTestRepository,
  getTest as getTestRepository,
  listTests as listTestsRepository,
  restoreTest as restoreTestRepository,
  updateTest as updateTestRepository,
} from "../repositories";

import {
  getAuth,
} from "firebase/auth";

import {
  calculateTestSummary,
  createEmptyTest,
  validateTest,
} from "../utils";

import type {
  CreateDefaultTestInput,
  CreateTestInput,
  DuplicateTestInput,
  ListTestsInput,
  ListTestsResult,
  PublishTestInput,
  SaveTestInput,
  TestData,
  TestServiceErrorCode,
  TestServiceErrorDetails,
  TestServiceResult,
  TestValidationResult,
  UpdateTestInput,
} from "../types";

type PublishTestApiResponse = {
  status: "success";
  testId: string;
  testStatus: "published";
  publishedAt: string;
  snapshotId: string;
  versionNumber: number;
  totalQuestions: number;
  totalScore: number;
  message: string;
};

type PublishTestApiErrorResponse = {
  status?: "error";
  message?: string;
  code?: string;
  error?: string;
};

export class TestServiceError extends Error {
  public readonly code:
    TestServiceErrorCode;

  public readonly originalError?:
    unknown;

  public readonly validation?:
    TestValidationResult;

  constructor({
    code,
    message,
    originalError,
    validation,
  }: TestServiceErrorDetails) {
    super(message);

    this.name =
      "TestServiceError";

    this.code =
      code;

    this.originalError =
      originalError;

    this.validation =
      validation;
  }
}

function assertNonEmpty(
  value: string,
  message: string
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new TestServiceError({
      code:
        "invalid_input",

      message,
    });
  }

  return normalized;
}

function normalizeOptionalString(
  value:
    string | undefined
): string | undefined {
  const normalized =
    value?.trim();

  return normalized
    ? normalized
    : undefined;
}

function normalizeStringArray(
  values:
    string[]
): string[] {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            value.trim()
        )
        .filter(Boolean)
    )
  );
}

function synchronizeTestTotals(
  test:
    TestData
): TestData {
  const summary =
    calculateTestSummary(
      test.sections
    );

  return {
    ...test,

    totalQuestions:
      summary.totalQuestions,

    totalScore:
      summary.totalScore,
  };
}

function normalizeTestData(
  test:
    TestData
): TestData {
  const normalizedTest:
    TestData = {
      ...test,

      title:
        test.title.trim(),

      description:
        normalizeOptionalString(
          test.description
        ),

      instructions:
        normalizeOptionalString(
          test.instructions
        ),

      durationMinutes:
        Number(
          test.durationMinutes
        ),

      metadata: {
        subject:
          test.metadata.subject.trim(),

        grade:
          test.metadata.grade.trim(),

        topics:
          normalizeStringArray(
            test.metadata.topics
          ),

        tags:
          normalizeStringArray(
            test.metadata.tags
          ),
      },

      sections:
        test.sections.map(
          (
            section,
            sectionIndex
          ) => ({
            ...section,

            title:
              section.title.trim(),

            description:
              normalizeOptionalString(
                section.description
              ),

            order:
              sectionIndex,

            scorePerQuestion:
              Number(
                section.scorePerQuestion
              ),

            questions:
              section.questions.map(
                (
                  question,
                  questionIndex
                ) => ({
                  ...question,

                  order:
                    questionIndex,

                  score:
                    Number(
                      question.score
                    ),

                  snapshot: {
                    ...question.snapshot,

                    content:
                      question.snapshot
                        .content
                        .trim(),

                    subject:
                      question.snapshot
                        .subject
                        .trim(),

                    grade:
                      question.snapshot
                        .grade
                        .trim(),

                    topic:
                      normalizeOptionalString(
                        question.snapshot
                          .topic
                      ),

                    tags:
                      question.snapshot
                        .tags
                        ? normalizeStringArray(
                            question.snapshot
                              .tags
                          )
                        : undefined,
                  },
                })
              ),
          })
        ),
    };

  return synchronizeTestTotals(
    normalizedTest
  );
}

function normalizeCreateInput(
  input:
    CreateTestInput
): CreateTestInput {
  const summary =
    calculateTestSummary(
      input.sections
    );

  return {
    ...input,

    title:
      input.title.trim(),

    description:
      normalizeOptionalString(
        input.description
      ),

    instructions:
      normalizeOptionalString(
        input.instructions
      ),

    durationMinutes:
      Number(
        input.durationMinutes
      ),

    metadata: {
      subject:
        input.metadata.subject.trim(),

      grade:
        input.metadata.grade.trim(),

      topics:
        normalizeStringArray(
          input.metadata.topics
        ),

      tags:
        normalizeStringArray(
          input.metadata.tags
        ),
    },

    totalQuestions:
      summary.totalQuestions,

    totalScore:
      summary.totalScore,
  };
}

function mapFirebaseErrorCode(
  error:
    unknown
): TestServiceErrorCode {
  if (
    typeof error !==
      "object" ||
    error === null
  ) {
    return "unknown";
  }

  const code =
    "code" in error &&
    typeof error.code ===
      "string"
      ? error.code
      : "";

  switch (code) {
    case "permission-denied":
    case "firestore/permission-denied":
      return "permission_denied";

    case "unauthenticated":
    case "auth/unauthenticated":
      return "unauthenticated";

    case "not-found":
    case "firestore/not-found":
      return "not_found";

    case "unavailable":
    case "firestore/unavailable":
    case "network-request-failed":
    case "auth/network-request-failed":
      return "network_error";

    default:
      return "firestore_error";
  }
}

function mapPublishApiErrorCode(
  code:
    string | undefined
): TestServiceErrorCode {
  switch (code) {
    case "TEST_NOT_FOUND":
      return "not_found";

    case "TEST_PUBLISH_FORBIDDEN":
      return "permission_denied";

    case "UNAUTHENTICATED":
    case "TEACHER_UNAUTHENTICATED":
      return "unauthenticated";

    case "TEST_VALIDATION_FAILED":
      return "validation_failed";

    default:
      return "firestore_error";
  }
}

function getFriendlyErrorMessage(
  code:
    TestServiceErrorCode,
  fallback:
    string
): string {
  switch (code) {
    case "permission_denied":
      return "Bạn không có quyền thực hiện thao tác với đề kiểm tra này.";

    case "unauthenticated":
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

    case "not_found":
      return "Không tìm thấy đề kiểm tra.";

    case "network_error":
      return "Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối Internet.";

    case "cannot_delete_published":
      return "Không thể xóa đề kiểm tra này.";

    case "validation_failed":
      return "Đề kiểm tra chưa đáp ứng đủ điều kiện.";

    case "invalid_input":
      return fallback;

    case "already_published":
      return "Đề kiểm tra đã được xuất bản.";

    case "firestore_error":
      return "Có lỗi xảy ra khi làm việc với dữ liệu đề kiểm tra.";

    case "unknown":
    default:
      return fallback;
  }
}

function convertToServiceError(
  error:
    unknown,
  fallbackMessage:
    string
): TestServiceError {
  if (
    error instanceof
    TestServiceError
  ) {
    return error;
  }

  const code =
    mapFirebaseErrorCode(
      error
    );

  let message =
    getFriendlyErrorMessage(
      code,
      fallbackMessage
    );

  if (
    error instanceof Error &&
    error.message
  ) {
    if (
      error.message.includes(
        "Không tìm thấy đề kiểm tra"
      )
    ) {
      return new TestServiceError({
        code:
          "not_found",

        message:
          getFriendlyErrorMessage(
            "not_found",
            error.message
          ),

        originalError:
          error,
      });
    }

    if (
      error.message.includes(
        "không có quyền"
      )
    ) {
      return new TestServiceError({
        code:
          "permission_denied",

        message:
          getFriendlyErrorMessage(
            "permission_denied",
            error.message
          ),

        originalError:
          error,
      });
    }

    if (
      code ===
      "firestore_error"
    ) {
      message =
        error.message;
    }
  }

  return new TestServiceError({
    code,

    message,

    originalError:
      error,
  });
}

async function readJsonResponse(
  response:
    Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readApiErrorResponse(
  value:
    unknown
): PublishTestApiErrorResponse {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return {};
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  return {
    status:
      record.status ===
      "error"
        ? "error"
        : undefined,

    message:
      typeof record.message ===
      "string"
        ? record.message
        : undefined,

    code:
      typeof record.code ===
      "string"
        ? record.code
        : undefined,

    error:
      typeof record.error ===
      "string"
        ? record.error
        : undefined,
  };
}

function isPublishTestApiResponse(
  value:
    unknown
): value is PublishTestApiResponse {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return false;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  return (
    record.status ===
      "success" &&
    typeof record.testId ===
      "string" &&
    record.testStatus ===
      "published" &&
    typeof record.publishedAt ===
      "string" &&
    typeof record.snapshotId ===
      "string" &&
    typeof record.versionNumber ===
      "number" &&
    typeof record.totalQuestions ===
      "number" &&
    typeof record.totalScore ===
      "number" &&
    typeof record.message ===
      "string"
  );
}

export async function createDefaultTest(
  input:
    CreateDefaultTestInput
): Promise<
  TestServiceResult<TestData>
> {
  try {
    const ownerUid =
      assertNonEmpty(
        input.owner.uid,
        "Không xác định được giáo viên tạo đề."
      );

    const ownerEmail =
      assertNonEmpty(
        input.owner.email,
        "Tài khoản giáo viên chưa có địa chỉ email."
      );

    const emptyTest =
      createEmptyTest({
        owner: {
          ...input.owner,

          uid:
            ownerUid,

          email:
            ownerEmail.toLowerCase(),
        },

        subject:
          input.subject?.trim() ??
          "",

        grade:
          input.grade?.trim() ??
          "10",

        includeDefaultSections:
          input.includeDefaultSections ??
          true,
      });

    const createInput:
      CreateTestInput = {
      ...emptyTest,

      title:
        input.title?.trim() ||
        emptyTest.title,
    };

    const createdTest =
      await createTestRepository(
        normalizeCreateInput(
          createInput
        )
      );

    return {
      data:
        createdTest,

      message:
        "Đã tạo đề kiểm tra mới.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể tạo đề kiểm tra."
    );
  }
}

export async function createTest(
  input:
    CreateTestInput
): Promise<
  TestServiceResult<TestData>
> {
  try {
    assertNonEmpty(
      input.owner.uid,
      "Không xác định được giáo viên tạo đề."
    );

    assertNonEmpty(
      input.owner.email,
      "Tài khoản giáo viên chưa có địa chỉ email."
    );

    const normalizedInput =
      normalizeCreateInput(
        input
      );

    const createdTest =
      await createTestRepository(
        normalizedInput
      );

    return {
      data:
        createdTest,

      message:
        "Đã tạo đề kiểm tra.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể tạo đề kiểm tra."
    );
  }
}

export async function getTest(
  testId:
    string,
  ownerUid:
    string
): Promise<TestData> {
  try {
    const normalizedTestId =
      assertNonEmpty(
        testId,
        "Thiếu mã đề kiểm tra."
      );

    const normalizedOwnerUid =
      assertNonEmpty(
        ownerUid,
        "Không xác định được giáo viên."
      );

    return await getTestRepository(
      normalizedTestId,
      normalizedOwnerUid
    );
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể tải đề kiểm tra."
    );
  }
}

export async function listTests(
  input:
    ListTestsInput
): Promise<ListTestsResult> {
  try {
    const ownerUid =
      assertNonEmpty(
        input.ownerUid,
        "Không xác định được giáo viên."
      );

    return await listTestsRepository({
      ...input,

      ownerUid,

      filters: {
        ...input.filters,

        search:
          input.filters?.search
            ?.trim() ??
          "",

        subject:
          input.filters?.subject
            ?.trim() ??
          "",

        grade:
          input.filters?.grade
            ?.trim() ??
          "",
      },
    });
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể tải danh sách đề kiểm tra."
    );
  }
}

export async function saveTest({
  test,
  validateBeforeSave =
    false,
}: SaveTestInput): Promise<
  TestServiceResult<TestData>
> {
  try {
    const normalizedTest =
      normalizeTestData(
        test
      );

    if (
      validateBeforeSave
    ) {
      const validation =
        validateTest(
          normalizedTest
        );

      if (
        !validation.valid
      ) {
        throw new TestServiceError({
          code:
            "validation_failed",

          message:
            "Đề kiểm tra còn lỗi và chưa thể lưu theo chế độ xác thực nghiêm ngặt.",

          validation,
        });
      }
    }

    const updateInput:
      UpdateTestInput = {
      ...normalizedTest,

      id:
        normalizedTest.id,
    };

    const savedTest =
      await updateTestRepository(
        updateInput,
        normalizedTest.owner.uid
      );

    return {
      data:
        savedTest,

      message:
        "Đã lưu đề kiểm tra.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể lưu đề kiểm tra."
    );
  }
}

export async function updateTest(
  input:
    UpdateTestInput,
  ownerUid:
    string
): Promise<
  TestServiceResult<TestData>
> {
  try {
    const normalizedOwnerUid =
      assertNonEmpty(
        ownerUid,
        "Không xác định được giáo viên."
      );

    const normalizedInput:
      UpdateTestInput = {
      ...input,

      id:
        assertNonEmpty(
          input.id,
          "Thiếu mã đề kiểm tra."
        ),

      title:
        input.title?.trim(),

      description:
        normalizeOptionalString(
          input.description
        ),

      instructions:
        normalizeOptionalString(
          input.instructions
        ),

      durationMinutes:
        input.durationMinutes ===
        undefined
          ? undefined
          : Number(
              input.durationMinutes
            ),

      metadata:
        input.metadata
          ? {
              subject:
                input.metadata
                  .subject
                  .trim(),

              grade:
                input.metadata
                  .grade
                  .trim(),

              topics:
                normalizeStringArray(
                  input.metadata
                    .topics
                ),

              tags:
                normalizeStringArray(
                  input.metadata
                    .tags
                ),
            }
          : undefined,
    };

    const updatedTest =
      await updateTestRepository(
        normalizedInput,
        normalizedOwnerUid
      );

    return {
      data:
        updatedTest,

      message:
        "Đã cập nhật đề kiểm tra.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể cập nhật đề kiểm tra."
    );
  }
}

export async function duplicateTest(
  input:
    DuplicateTestInput
): Promise<
  TestServiceResult<TestData>
> {
  try {
    assertNonEmpty(
      input.testId,
      "Thiếu mã đề kiểm tra cần nhân bản."
    );

    assertNonEmpty(
      input.owner.uid,
      "Không xác định được giáo viên."
    );

    const duplicatedTest =
      await duplicateTestRepository({
        ...input,

        testId:
          input.testId.trim(),

        title:
          normalizeOptionalString(
            input.title
          ),
      });

    return {
      data:
        duplicatedTest,

      message:
        "Đã nhân bản đề kiểm tra.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể nhân bản đề kiểm tra."
    );
  }
}

export async function archiveTest(
  testId:
    string,
  ownerUid:
    string
): Promise<
  TestServiceResult<TestData>
> {
  try {
    const archivedTest =
      await archiveTestRepository(
        assertNonEmpty(
          testId,
          "Thiếu mã đề kiểm tra."
        ),

        assertNonEmpty(
          ownerUid,
          "Không xác định được giáo viên."
        )
      );

    return {
      data:
        archivedTest,

      message:
        "Đã lưu trữ đề kiểm tra.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể lưu trữ đề kiểm tra."
    );
  }
}

export async function restoreTest(
  testId:
    string,
  ownerUid:
    string
): Promise<
  TestServiceResult<TestData>
> {
  try {
    const restoredTest =
      await restoreTestRepository(
        assertNonEmpty(
          testId,
          "Thiếu mã đề kiểm tra."
        ),

        assertNonEmpty(
          ownerUid,
          "Không xác định được giáo viên."
        )
      );

    return {
      data:
        restoredTest,

      message:
        "Đã khôi phục đề kiểm tra về trạng thái bản nháp.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể khôi phục đề kiểm tra."
    );
  }
}

export async function deleteTest(
  testId:
    string,
  ownerUid:
    string
): Promise<
  TestServiceResult<null>
> {
  try {
    await deleteTestRepository(
      assertNonEmpty(
        testId,
        "Thiếu mã đề kiểm tra."
      ),

      assertNonEmpty(
        ownerUid,
        "Không xác định được giáo viên."
      )
    );

    return {
      data:
        null,

      message:
        "Đã xóa đề kiểm tra.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể xóa đề kiểm tra."
    );
  }
}

export async function publishTest({
  testId,
  ownerUid,
}: PublishTestInput): Promise<
  TestServiceResult<TestData>
> {
  try {
    const normalizedTestId =
      assertNonEmpty(
        testId,
        "Thiếu mã đề kiểm tra."
      );

    const normalizedOwnerUid =
      assertNonEmpty(
        ownerUid,
        "Không xác định được giáo viên."
      );

    /*
     * Đọc đề hiện tại để validate phía client
     * và cập nhật giao diện sau khi backend xuất bản.
     */
    const currentTest =
      normalizeTestData(
        await getTestRepository(
          normalizedTestId,
          normalizedOwnerUid
        )
      );

    const validation =
      validateTest(
        currentTest
      );

    if (
      !validation.valid
    ) {
      throw new TestServiceError({
        code:
          "validation_failed",

        message:
          "Đề kiểm tra còn lỗi và chưa thể xuất bản.",

        validation,
      });
    }

    /*
     * Không cập nhật trạng thái published trực tiếp
     * bằng Firestore client.
     *
     * Backend chịu trách nhiệm:
     * - kiểm tra quyền;
     * - cập nhật trạng thái;
     * - tạo publishedSnapshot;
     * - lưu snapshot ID và version.
     */
    const auth =
  getAuth();

const currentUser =
  auth.currentUser;

if (!currentUser) {
  throw new TestServiceError({
    code:
      "unauthenticated",

    message:
      "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.",
  });
}

let idToken:
  string;

try {
  idToken =
    await currentUser.getIdToken();
} catch (
  tokenError
) {
  throw new TestServiceError({
    code:
      "unauthenticated",

    message:
      "Không thể xác thực phiên đăng nhập. Vui lòng đăng nhập lại.",

    originalError:
      tokenError,
  });
}

const response =
  await fetch(
    `/api/teacher/tests/${encodeURIComponent(
      normalizedTestId
    )}/publish`,
    {
      method:
        "PUT",

      headers: {
        Authorization:
          `Bearer ${idToken}`,

        Accept:
          "application/json",
      },

      credentials:
        "include",

      cache:
        "no-store",
    }
  );
    const rawResult =
      await readJsonResponse(
        response
      );

    if (
      !response.ok
    ) {
      const apiError =
        readApiErrorResponse(
          rawResult
        );

      throw new TestServiceError({
        code:
          mapPublishApiErrorCode(
            apiError.code
          ),

        message:
          apiError.message ||
          apiError.error ||
          "Không thể xuất bản đề kiểm tra.",
      });
    }

    if (
      !isPublishTestApiResponse(
        rawResult
      )
    ) {
      throw new TestServiceError({
        code:
          "firestore_error",

        message:
          "Phản hồi xuất bản đề không hợp lệ.",
      });
    }

    const publishedTest:
      TestData = {
      ...currentTest,

      status:
        "published",

      publishedAt:
        rawResult.publishedAt,

      updatedAt:
        rawResult.publishedAt,

      totalQuestions:
        rawResult.totalQuestions,

      totalScore:
        rawResult.totalScore,

      version: {
        ...currentTest.version,

        number:
          rawResult.versionNumber,

        status:
          "published",

        publishedAt:
          rawResult.publishedAt,
      },
    };

    return {
      data:
        publishedTest,

      message:
        rawResult.message ||
        "Đã xuất bản đề kiểm tra.",
    };
  } catch (
    error
  ) {
    throw convertToServiceError(
      error,
      "Không thể xuất bản đề kiểm tra."
    );
  }
}

export function validateTestForPublish(
  test:
    TestData
): TestValidationResult {
  const normalizedTest =
    normalizeTestData(
      test
    );

  return validateTest(
    normalizedTest
  );
}

export function isTestServiceError(
  error:
    unknown
): error is TestServiceError {
  return (
    error instanceof
    TestServiceError
  );
}

export function getTestServiceErrorMessage(
  error:
    unknown,
  fallback =
    "Đã xảy ra lỗi không xác định."
): string {
  if (
    error instanceof
    TestServiceError
  ) {
    return error.message;
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}