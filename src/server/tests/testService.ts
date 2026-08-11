import type {
  DocumentData,
} from "firebase-admin/firestore";

import {
  buildPublishedTestSnapshot,
} from "./testSnapshot";

import {
  canEditTest,
  canPublishTest,
  resolveTestOwner,
} from "./testPermissions";

import {
  validateTestForEditing,
  validateTestForPublishing,
} from "./testValidator";

import {
  getCurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  ApiError,
} from "@/server/http/apiError";

import {
  normalizeBoolean,
  normalizeInteger,
  normalizeNumber,
  normalizeStringArray,
  removeUndefinedValues,
  safeString,
} from "@/server/shared/normalize";

import {
  normalizeQuestions,
} from "./questionNormalizer";

import {
  buildTestSections,
  calculateQuestionTypeCounts,
  calculateSectionCounts,
  calculateTotalScore,
} from "./testCalculations";

import {
  mapTestListItem,
} from "./testMapper";

import {
  createTestReference,
  getTestById,
  listAccessibleTests,
  replaceTestById,
  saveTest,
  updateTestById,
} from "./testRepository";

import type {
  NormalizedQuestion,
  TestSettings,
  TestStatus,
  TestVisibility,
} from "./testTypes";

type CreateTestBody = {
  title?: unknown;

  description?: unknown;

  instructions?: unknown;

  subject?: unknown;

  grade?: unknown;

  duration?: unknown;

  durationMinutes?: unknown;

  totalScore?: unknown;

  maxAttempts?: unknown;

  questions?: unknown;

  status?: unknown;

  visibility?: unknown;

  source?: unknown;

  publish?: unknown;

  topics?: unknown;

  tags?: unknown;

  settings?: unknown;

  shuffleQuestions?: unknown;

  shuffleOptions?: unknown;

  allowBackNavigation?: unknown;

  showQuestionNumbers?: unknown;

  showProgress?: unknown;

  autosaveAnswers?: unknown;
};

type UpdateTestBody = {
  title?: unknown;

  description?: unknown;

  instructions?: unknown;

  subject?: unknown;

  grade?: unknown;

  duration?: unknown;

  durationMinutes?: unknown;

  totalScore?: unknown;

  maxAttempts?: unknown;

  questions?: unknown;

  visibility?: unknown;

  source?: unknown;

  topics?: unknown;

  tags?: unknown;

  settings?: unknown;

  shuffleQuestions?: unknown;

  shuffleOptions?: unknown;

  allowBackNavigation?: unknown;

  showQuestionNumbers?: unknown;

  showProgress?: unknown;

  autosaveAnswers?: unknown;
};

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

function normalizeVisibility(
  value: unknown
): TestVisibility {
  const visibility =
    safeString(
      value
    );

  if (
    visibility ===
      "school" ||
    visibility ===
      "public"
  ) {
    return visibility;
  }

  return "private";
}

function normalizeCreateStatus(
  body:
    CreateTestBody
): TestStatus {
  const requestedStatus =
    safeString(
      body.status
    );

  const shouldPublish =
    normalizeBoolean(
      body.publish,
      false
    ) ||
    requestedStatus ===
      "published";

  if (
    shouldPublish
  ) {
    return "published";
  }

  return "draft";
}

function buildSettings(
  body:
    CreateTestBody
): TestSettings {
  const rawSettings =
    readObject(
      body.settings
    );

  return {
    shuffleQuestions:
      normalizeBoolean(
        rawSettings
          .shuffleQuestions ??
          body.shuffleQuestions,
        false
      ),

    shuffleOptions:
      normalizeBoolean(
        rawSettings
          .shuffleOptions ??
          body.shuffleOptions,
        false
      ),

    allowBackNavigation:
      normalizeBoolean(
        rawSettings
          .allowBackNavigation ??
          body.allowBackNavigation,
        true
      ),

    showQuestionNumbers:
      normalizeBoolean(
        rawSettings
          .showQuestionNumbers ??
          body.showQuestionNumbers,
        true
      ),

    showProgress:
      normalizeBoolean(
        rawSettings
          .showProgress ??
          body.showProgress,
        true
      ),

    autosaveAnswers:
      normalizeBoolean(
        rawSettings
          .autosaveAnswers ??
          body.autosaveAnswers,
        true
      ),
  };
}

function assignQuestionIds(
  questions:
    NormalizedQuestion[],
  testId: string,
  now: string,
  teacherUid: string,
  teacherEmail: string
) {
  return questions.map(
    (
      question,
      index
    ) => ({
      ...question,

      id:
        question.id ||
        `${testId}-q-${index + 1}`,

      questionNumber:
        index + 1,

      createdAt:
        now,

      updatedAt:
        now,

      createdBy:
        teacherUid,

      updatedBy:
        teacherUid,

      createdByEmail:
        teacherEmail,

      updatedByEmail:
        teacherEmail,
    })
  );
}

function extractQuestionsFromStoredTest(
  testData: Record<string, unknown>
): unknown[] {
  if (
    Array.isArray(
      testData.sections
    )
  ) {
    return testData.sections.flatMap(
      (
        rawSection
      ) => {
        const section =
          readObject(
            rawSection
          );

        return Array.isArray(
          section.questions
        )
          ? section.questions
          : [];
      }
    );
  }

  if (
    Array.isArray(
      testData.questions
    )
  ) {
    return testData.questions;
  }

  return [];
}

function preserveQuestionIds(
  questions: NormalizedQuestion[],
  existingQuestions: unknown[],
  testId: string,
  now: string,
  teacherUid: string,
  teacherEmail: string
) {
  const existingQuestionMap =
    new Map<
      string,
      Record<string, unknown>
    >();

  existingQuestions.forEach(
    (
      rawQuestion
    ) => {
      const question =
        readObject(
          rawQuestion
        );

      const id =
        safeString(
          question.id
        );

      if (id) {
        existingQuestionMap.set(
          id,
          question
        );
      }
    }
  );

  return questions.map(
    (
      question,
      index
    ) => {
      const existingQuestion =
        question.id
          ? existingQuestionMap.get(
              question.id
            )
          : undefined;

      const questionId =
        question.id ||
        `${testId}-q-${index + 1}`;

      return {
        ...question,

        id:
          questionId,

        questionNumber:
          index + 1,

        createdAt:
          safeString(
            existingQuestion?.createdAt
          ) || now,

        updatedAt:
          now,

        createdBy:
          safeString(
            existingQuestion?.createdBy
          ) || teacherUid,

        updatedBy:
          teacherUid,

        createdByEmail:
          safeString(
            existingQuestion?.createdByEmail
          ) || teacherEmail,

        updatedByEmail:
          teacherEmail,
      };
    }
  );
}

export async function listTeacherTests(
  request: Request
) {
  const teacher =
    await getCurrentTeacher(
      request
    );

  const documents =
    await listAccessibleTests(
      teacher
    );

  return documents
    .map(
      (
        document
      ) =>
        mapTestListItem(
          document.id,
          document.data
        )
    )
    .filter(
      (
        test
      ) =>
        test.status !==
        "deleted"
    )
    .sort(
      (
        first,
        second
      ) =>
        second.createdAt.localeCompare(
          first.createdAt
        )
    );
}

export async function createTeacherTest(
  request: Request,
  rawBody: unknown
) {
  const teacher =
    await getCurrentTeacher(
      request
    );

  const body =
    readObject(
      rawBody
    ) as CreateTestBody;

  const title =
    safeString(
      body.title
    );

  const description =
    safeString(
      body.description
    );

  const instructions =
    safeString(
      body.instructions
    );

  const subject =
    safeString(
      body.subject
    ) ||
    safeString(
      teacher.subject
    );

  const grade =
    safeString(
      body.grade
    );

  const durationMinutes =
    normalizeNumber(
      body.durationMinutes ??
        body.duration,
      0
    );

  const requestedTotalScore =
    normalizeNumber(
      body.totalScore,
      10
    );

  const maxAttempts =
    normalizeInteger(
      body.maxAttempts,
      1
    );

  if (
    !title
  ) {
    throw new ApiError(
      "Vui lòng nhập tên bài kiểm tra.",
      400
    );
  }

  if (
    !subject
  ) {
    throw new ApiError(
      "Vui lòng chọn môn học.",
      400
    );
  }

  if (
    durationMinutes <=
    0
  ) {
    throw new ApiError(
      "Thời gian làm bài không hợp lệ.",
      400
    );
  }

  if (
    requestedTotalScore <=
    0
  ) {
    throw new ApiError(
      "Tổng điểm không hợp lệ.",
      400
    );
  }

  if (
    maxAttempts <=
    0
  ) {
    throw new ApiError(
      "Số lượt làm bài không hợp lệ.",
      400
    );
  }

  const normalizedQuestions =
    normalizeQuestions(
      body.questions,
      subject,
      grade
    );

  const calculatedScore =
    calculateTotalScore(
      normalizedQuestions
    );

  if (
    Math.abs(
      calculatedScore -
        requestedTotalScore
    ) >
    0.01
  ) {
    throw new ApiError(
      `Tổng điểm các câu là ${calculatedScore}, không khớp tổng điểm đề là ${requestedTotalScore}.`,
      400
    );
  }

  const testReference =
    createTestReference();

  const now =
    new Date()
      .toISOString();

  const status =
    normalizeCreateStatus(
      body
    );

  const publishedAt =
    status ===
    "published"
      ? now
      : undefined;

  const questions =
    assignQuestionIds(
      normalizedQuestions,
      testReference.id,
      now,
      teacher.uid,
      teacher.email
    );

  /*
   * buildTestSections chỉ phân nhóm câu hỏi.
   * Các field ảnh như questionImageId/questionImageUrl
   * và statementImageId/statementImageUrl được giữ nguyên.
   */
  const sections =
    buildTestSections(
      questions
    );

  const questionTypeCounts =
    calculateQuestionTypeCounts(
      questions
    );

  const sectionCounts =
    calculateSectionCounts(
      questions
    );

  const topics =
    normalizeStringArray(
      body.topics
    );

  const tags =
    normalizeStringArray(
      body.tags
    );

  const visibility =
    normalizeVisibility(
      body.visibility
    );

  const settings =
    buildSettings(
      body
    );

  const owner = {
    uid:
      teacher.uid,

    email:
      teacher.email,

    name:
      teacher.name,

    schoolId:
      teacher.schoolId,
  };

const baseTestData =
  removeUndefinedValues({
    id:
      testReference.id,

    title,

    description,

    instructions,

    durationMinutes,

    totalQuestions:
      questions.length,

    totalScore:
      requestedTotalScore,

    calculatedScore,

    maxAttempts,

    status,

    visibility,

    owner,

    metadata: {
      subject,

      grade,

      topics,

      tags,
    },

    sections,

    settings,

    version: {
      number:
        1,

      status:
        status ===
        "published"
          ? "published"
          : "draft",

      createdAt:
        now,

      updatedAt:
        now,

      publishedAt,
    },

    source:
      safeString(
        body.source
      ) ||
      "manual",

    schemaVersion:
      3,

    testFormat:
      "three_part",

    questionTypeCounts,

    sectionCounts,

    createdAt:
      now,

    updatedAt:
      now,

    publishedAt,

    createdBy:
      teacher.uid,

    updatedBy:
      teacher.uid,

    /*
     * Tương thích dữ liệu cũ.
     */
    teacherEmail:
      teacher.email,

    teacherName:
      teacher.name,

    schoolId:
      teacher.schoolId,

    subject,

    grade,

    duration:
      durationMinutes,

    questionCount:
      questions.length,
  }) as Record<
    string,
    unknown
  >;

const publishedSnapshot =
  status ===
  "published"
    ? buildPublishedTestSnapshot(
        testReference.id,
        baseTestData,
        now
      )
    : undefined;

const testData =
  removeUndefinedValues({
    ...baseTestData,

    publishedSnapshot,

    publishedSnapshotId:
      publishedSnapshot
        ?.snapshotId,

    publishedVersionNumber:
      publishedSnapshot
        ?.versionNumber,
  }) as DocumentData;

  /*
   * Không ghi collection("questions").
   * Không ghi top-level questions.
   *
   * Nguồn dữ liệu chính thức:
   * tests/{testId}.sections[].questions[]
   */
  await saveTest(
    testReference,
    testData
  );

  return {
    testId:
      testReference.id,

    questionCount:
      questions.length,

    totalQuestions:
      questions.length,

    questionTypeCounts,

    sectionCounts,

    calculatedScore,

    status,

    test:
      mapTestListItem(
        testReference.id,
        testData as Record<
          string,
          unknown
        >
      ),

    message:
      status ===
      "published"
        ? "Đã tạo và xuất bản bài kiểm tra thành công."
        : "Đã tạo bản nháp bài kiểm tra thành công.",
  };
}

export async function updateTeacherTest(
  request: Request,
  testId: string,
  rawBody: unknown
) {
  const teacher =
    await getCurrentTeacher(
      request
    );

  const normalizedTestId =
    safeString(
      testId
    );

  if (
    !normalizedTestId
  ) {
    throw new ApiError(
      "Thiếu mã đề kiểm tra.",
      400,
      {
        code:
          "TEST_ID_REQUIRED",
      }
    );
  }

  const storedTest =
    await getTestById(
      normalizedTestId
    );

  if (
    !storedTest
  ) {
    throw new ApiError(
      "Không tìm thấy đề kiểm tra.",
      404,
      {
        code:
          "TEST_NOT_FOUND",
      }
    );
  }

  if (
    !canEditTest(
      teacher,
      storedTest.data
    )
  ) {
    throw new ApiError(
      "Bạn không có quyền chỉnh sửa đề kiểm tra này.",
      403,
      {
        code:
          "TEST_EDIT_FORBIDDEN",
      }
    );
  }

  validateTestForEditing(
    storedTest.data
  );

  const body =
    readObject(
      rawBody
    ) as UpdateTestBody;

  const storedMetadata =
    readObject(
      storedTest.data.metadata
    );

  const title =
    safeString(
      body.title
    ) ||
    safeString(
      storedTest.data.title
    );

  const description =
    body.description !== undefined
      ? safeString(
          body.description
        )
      : safeString(
          storedTest.data.description
        );

  const instructions =
    body.instructions !== undefined
      ? safeString(
          body.instructions
        )
      : safeString(
          storedTest.data.instructions
        );

  const subject =
    safeString(
      body.subject
    ) ||
    safeString(
      storedMetadata.subject
    ) ||
    safeString(
      storedTest.data.subject
    ) ||
    safeString(
      teacher.subject
    );

  const grade =
    body.grade !== undefined
      ? safeString(
          body.grade
        )
      : safeString(
          storedMetadata.grade ??
            storedTest.data.grade
        );

  const durationMinutes =
    body.durationMinutes !== undefined ||
    body.duration !== undefined
      ? normalizeNumber(
          body.durationMinutes ??
            body.duration,
          0
        )
      : normalizeNumber(
          storedTest.data.durationMinutes ??
            storedTest.data.duration,
          0
        );

  const requestedTotalScore =
    body.totalScore !== undefined
      ? normalizeNumber(
          body.totalScore,
          0
        )
      : normalizeNumber(
          storedTest.data.totalScore,
          10
        );

  const maxAttempts =
    body.maxAttempts !== undefined
      ? normalizeInteger(
          body.maxAttempts,
          1
        )
      : normalizeInteger(
          storedTest.data.maxAttempts,
          1
        );

  if (
    !title
  ) {
    throw new ApiError(
      "Vui lòng nhập tên bài kiểm tra.",
      400
    );
  }

  if (
    !subject
  ) {
    throw new ApiError(
      "Vui lòng chọn môn học.",
      400
    );
  }

  if (
    durationMinutes <= 0
  ) {
    throw new ApiError(
      "Thời gian làm bài không hợp lệ.",
      400
    );
  }

  if (
    requestedTotalScore <= 0
  ) {
    throw new ApiError(
      "Tổng điểm không hợp lệ.",
      400
    );
  }

  if (
    maxAttempts <= 0
  ) {
    throw new ApiError(
      "Số lượt làm bài không hợp lệ.",
      400
    );
  }

  const existingQuestions =
    extractQuestionsFromStoredTest(
      storedTest.data
    );

  const sourceQuestions =
    body.questions !== undefined
      ? body.questions
      : existingQuestions;

  const normalizedQuestions =
    normalizeQuestions(
      sourceQuestions,
      subject,
      grade
    );

  const calculatedScore =
    calculateTotalScore(
      normalizedQuestions
    );

  if (
    Math.abs(
      calculatedScore -
        requestedTotalScore
    ) > 0.01
  ) {
    throw new ApiError(
      `Tổng điểm các câu là ${calculatedScore}, không khớp tổng điểm đề là ${requestedTotalScore}.`,
      400,
      {
        code:
          "TEST_SCORE_MISMATCH",
      }
    );
  }

  const now =
    new Date()
      .toISOString();

  const questions =
    preserveQuestionIds(
      normalizedQuestions,
      existingQuestions,
      normalizedTestId,
      now,
      teacher.uid,
      teacher.email
    );

  const sections =
    buildTestSections(
      questions
    );

  const questionTypeCounts =
    calculateQuestionTypeCounts(
      questions
    );

  const sectionCounts =
    calculateSectionCounts(
      questions
    );

  const storedSettings =
    readObject(
      storedTest.data.settings
    );

  const settings =
    buildSettings({
      settings: {
        ...storedSettings,
        ...readObject(
          body.settings
        ),
      },

      shuffleQuestions:
        body.shuffleQuestions,

      shuffleOptions:
        body.shuffleOptions,

      allowBackNavigation:
        body.allowBackNavigation,

      showQuestionNumbers:
        body.showQuestionNumbers,

      showProgress:
        body.showProgress,

      autosaveAnswers:
        body.autosaveAnswers,
    });

  const topics =
    body.topics !== undefined
      ? normalizeStringArray(
          body.topics
        )
      : normalizeStringArray(
          storedMetadata.topics
        );

  const tags =
    body.tags !== undefined
      ? normalizeStringArray(
          body.tags
        )
      : normalizeStringArray(
          storedMetadata.tags
        );

  const visibility =
    body.visibility !== undefined
      ? normalizeVisibility(
          body.visibility
        )
      : normalizeVisibility(
          storedTest.data.visibility
        );

  const existingVersion =
    readObject(
      storedTest.data.version
    );

  const versionNumber =
    normalizeInteger(
      existingVersion.number,
      1
    );

  const updateData =
    removeUndefinedValues({
      title,

      description,

      instructions,

      durationMinutes,

      duration:
        durationMinutes,

      totalQuestions:
        questions.length,

      questionCount:
        questions.length,

      totalScore:
        requestedTotalScore,

      calculatedScore,

      maxAttempts,

      visibility,

      metadata: {
        subject,

        grade,

        topics,

        tags,
      },

      subject,

      grade,

      sections,

      settings,

      questionTypeCounts,

      sectionCounts,

      source:
        body.source !== undefined
          ? safeString(
              body.source
            ) || "manual"
          : safeString(
              storedTest.data.source
            ) || "manual",

      schemaVersion: 3,

      testFormat:
        "three_part",

      status:
        "draft",

      updatedAt:
        now,

      updatedBy:
        teacher.uid,

      version: {
        ...existingVersion,

        number:
          versionNumber,

        status:
          "draft",

        createdAt:
          safeString(
            existingVersion.createdAt
          ) ||
          safeString(
            storedTest.data.createdAt
          ) ||
          now,

        updatedAt:
          now,
      },
    }) as DocumentData;

  /*
   * Không ghi owner vào updateData.
   * owner hiện tại được giữ nguyên trong Firestore.
   *
   * Không ghi top-level questions.
   * Không tạo collection questions.
   */
  await replaceTestById(
    normalizedTestId,
    updateData
  );

  const updatedTestData = {
    ...storedTest.data,
    ...updateData,
  };

  return {
    testId:
      normalizedTestId,

    testStatus:
      "draft" as const,

    questionCount:
      questions.length,

    totalQuestions:
      questions.length,

    totalScore:
      requestedTotalScore,

    calculatedScore,

    questionTypeCounts,

    sectionCounts,

    test:
      mapTestListItem(
        normalizedTestId,
        updatedTestData
      ),

    message:
      "Đã cập nhật đề kiểm tra thành công.",
  };
}


export async function publishTeacherTest(
  request: Request,
  testId: string
) {
  const teacher =
    await getCurrentTeacher(
      request
    );

  const normalizedTestId =
    safeString(
      testId
    );

  if (
    !normalizedTestId
  ) {
    throw new ApiError(
      "Thiếu mã đề kiểm tra.",
      400,
      {
        code:
          "TEST_ID_REQUIRED",
      }
    );
  }

  const storedTest =
    await getTestById(
      normalizedTestId
    );

  if (
    !storedTest
  ) {
    throw new ApiError(
      "Không tìm thấy đề kiểm tra.",
      404,
      {
        code:
          "TEST_NOT_FOUND",
      }
    );
  }

  const resolvedOwner =
    resolveTestOwner(
      storedTest.data
    );

  const allowedToPublish =
    canPublishTest(
      teacher,
      storedTest.data
    );

  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    console.log(
      "PUBLISH TEST PERMISSION",
      {
        testId:
          normalizedTestId,

        teacher: {
          uid:
            teacher.uid,

          email:
            teacher.email,

          name:
            teacher.name,

          role:
            teacher.role,

          schoolId:
            teacher.schoolId,
        },

        owner:
          resolvedOwner,

        checks: {
          uidMatches:
            Boolean(
              teacher.uid &&
                resolvedOwner.uid &&
                teacher.uid ===
                  resolvedOwner.uid
            ),

          schoolMatches:
            Boolean(
              teacher.schoolId &&
                resolvedOwner.schoolId &&
                teacher.schoolId ===
                  resolvedOwner.schoolId
            ),

          allowedToPublish,
        },
      }
    );
  }

  if (
    !allowedToPublish
  ) {
throw new ApiError(
  "Bạn không có quyền xuất bản đề kiểm tra này.",
  403,
  {
    code:
      "TEST_PUBLISH_FORBIDDEN",

    details: {
      testId:
        normalizedTestId,
    },
  }
);
  }

  validateTestForPublishing(
    storedTest.data
  );

  const now =
    new Date()
      .toISOString();

  const existingVersion =
    readObject(
      storedTest.data.version
    );

  const currentVersionNumber =
    normalizeInteger(
      existingVersion.number,
      1
    );

  const existingPublishedSnapshot =
    readObject(
      storedTest.data
        .publishedSnapshot
    );

  const hasPreviousSnapshot =
    Object.keys(
      existingPublishedSnapshot
    ).length > 0;

  /*
   * Lần xuất bản đầu tiên giữ version hiện tại.
   * Các lần xuất bản lại tăng version.
   */
  const nextVersionNumber =
    hasPreviousSnapshot
      ? currentVersionNumber + 1
      : currentVersionNumber;

  const nextVersion = {
    ...existingVersion,

    number:
      nextVersionNumber,

    status:
      "published",

    createdAt:
      safeString(
        existingVersion.createdAt
      ) ||
      safeString(
        storedTest.data.createdAt
      ) ||
      now,

    updatedAt:
      now,

    publishedAt:
      now,
  };

  const snapshotSource =
    removeUndefinedValues({
      ...storedTest.data,

      status:
        "published",

      version:
        nextVersion,

      publishedAt:
        now,

      updatedAt:
        now,

      updatedBy:
        teacher.uid,
    }) as Record<
      string,
      unknown
    >;

  const publishedSnapshot =
    buildPublishedTestSnapshot(
      normalizedTestId,
      snapshotSource,
      now
    );

  const updateData =
    removeUndefinedValues({
      status:
        "published",

      publishedAt:
        now,

      updatedAt:
        now,

      updatedBy:
        teacher.uid,

      version:
        nextVersion,

      publishedSnapshot,

      publishedSnapshotId:
        publishedSnapshot
          .snapshotId,

      publishedVersionNumber:
        publishedSnapshot
          .versionNumber,
    }) as DocumentData;

  await updateTestById(
    normalizedTestId,
    updateData
  );

  const updatedData = {
    ...storedTest.data,
    ...updateData,
  };

  return {
    testId:
      normalizedTestId,

    testStatus:
      "published" as const,

    publishedAt:
      now,

    snapshotId:
      publishedSnapshot
        .snapshotId,

    versionNumber:
      publishedSnapshot
        .versionNumber,

    totalQuestions:
      publishedSnapshot
        .totalQuestions,

    totalScore:
      publishedSnapshot
        .totalScore,

    test:
      mapTestListItem(
        normalizedTestId,
        updatedData
      ),

    message:
      "Đã xuất bản đề kiểm tra và tạo snapshot thành công.",
  };
}