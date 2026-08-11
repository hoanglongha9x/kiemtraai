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
  resolveTestOwner,
} from "./testPermissions";

import type {
  PublishedTestSection,
  PublishedTestSnapshot,
  TestSectionId,
  TestSettings,
  TestVisibility,
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

function normalizeVisibility(
  value: unknown
): TestVisibility {
  const visibility =
    safeString(
      value
    );

  if (
    visibility === "school" ||
    visibility === "public"
  ) {
    return visibility;
  }

  return "private";
}

function normalizeSettings(
  value: unknown
): TestSettings {
  const settings =
    readObject(
      value
    );

  return {
    shuffleQuestions:
      normalizeBoolean(
        settings.shuffleQuestions,
        false
      ),

    shuffleOptions:
      normalizeBoolean(
        settings.shuffleOptions,
        false
      ),

    allowBackNavigation:
      normalizeBoolean(
        settings.allowBackNavigation,
        true
      ),

    showQuestionNumbers:
      normalizeBoolean(
        settings.showQuestionNumbers,
        true
      ),

    showProgress:
      normalizeBoolean(
        settings.showProgress,
        true
      ),

    autosaveAnswers:
      normalizeBoolean(
        settings.autosaveAnswers,
        true
      ),
  };
}

function normalizeSectionId(
  value: unknown
): TestSectionId | null {
  const sectionId =
    safeString(
      value
    ).toLowerCase();

  if (
    sectionId === "part_1" ||
    sectionId === "part_2" ||
    sectionId === "part_3"
  ) {
    return sectionId;
  }

  if (
    sectionId === "single_choice" ||
    sectionId === "single-choice"
  ) {
    return "part_1";
  }

  if (
    sectionId === "true_false_group" ||
    sectionId === "true-false-group" ||
    sectionId === "true_false" ||
    sectionId === "true-false"
  ) {
    return "part_2";
  }

  if (
    sectionId === "short_answer" ||
    sectionId === "short-answer" ||
    sectionId === "shortanswer"
  ) {
    return "part_3";
  }

  return null;
}

function resolveSectionId(
  section: Record<string, unknown>
): TestSectionId | null {
  const directSectionId =
    normalizeSectionId(
      section.id
    ) ||
    normalizeSectionId(
      section.type
    ) ||
    normalizeSectionId(
      section.questionType
    );

  if (directSectionId) {
    return directSectionId;
  }

  const questions =
    Array.isArray(
      section.questions
    )
      ? section.questions
      : [];

  for (const rawQuestion of questions) {
    const question =
      readObject(
        rawQuestion
      );

    const snapshot =
      readObject(
        question.snapshot
      );

    const questionSectionId =
      normalizeSectionId(
        question.section
      ) ||
      normalizeSectionId(
        question.questionType
      ) ||
      normalizeSectionId(
        question.type
      ) ||
      normalizeSectionId(
        snapshot.type
      ) ||
      normalizeSectionId(
        snapshot.questionType
      );

    if (questionSectionId) {
      return questionSectionId;
    }
  }

  return null;
}

function buildSnapshotSections(
  value: unknown
): PublishedTestSection[] {
  if (
    !Array.isArray(value)
  ) {
    throw new ApiError(
      "Đề kiểm tra chưa có cấu trúc sections hợp lệ.",
      400,
      {
        code:
          "TEST_SECTIONS_REQUIRED",
      }
    );
  }

  const sections =
    value
      .map(
        (
          rawSection
        ) => {
          const section =
            readObject(
              rawSection
            );

          const sectionId =
            resolveSectionId(
              section
            );

          if (!sectionId) {
            return null;
          }

          const rawQuestions =
            Array.isArray(
              section.questions
            )
              ? section.questions
              : [];

          const questions =
            rawQuestions.map(
              (
                rawQuestion,
                questionIndex
              ) => {
                const question =
                  readObject(
                    rawQuestion
                  );

                const questionSnapshot =
                  readObject(
                    question.snapshot
                  );

                const questionSource =
                  Object.keys(
                    questionSnapshot
                  ).length > 0
                    ? questionSnapshot
                    : question;

                return removeUndefinedValues({
                  ...question,

                  id:
                    safeString(
                      question.id
                    ),

                  questionNumber:
                    normalizeInteger(
                      question.questionNumber,
                      questionIndex + 1
                    ),

                  questionImageId:
                    safeString(
                      question.questionImageId ??
                        questionSource.questionImageId
                    ),

                  questionImageUrl:
                    safeString(
                      question.questionImageUrl ??
                        questionSource.questionImageUrl
                    ),

                  AImageId:
                    safeString(
                      question.AImageId
                    ),

                  AImageUrl:
                    safeString(
                      question.AImageUrl
                    ),

                  BImageId:
                    safeString(
                      question.BImageId
                    ),

                  BImageUrl:
                    safeString(
                      question.BImageUrl
                    ),

                  CImageId:
                    safeString(
                      question.CImageId
                    ),

                  CImageUrl:
                    safeString(
                      question.CImageUrl
                    ),

                  DImageId:
                    safeString(
                      question.DImageId
                    ),

                  DImageUrl:
                    safeString(
                      question.DImageUrl
                    ),

                  statements:
                    Array.isArray(
                      question.statements
                    )
                      ? question.statements.map(
                          (
                            rawStatement
                          ) => {
                            const statement =
                              readObject(
                                rawStatement
                              );

                            return {
                              ...statement,

                              statementImageId:
                                safeString(
                                  statement.statementImageId
                                ),

                              statementImageUrl:
                                safeString(
                                  statement.statementImageUrl
                                ),
                            };
                          }
                        )
                      : [],
                });
              }
            );

          return {
            id:
              sectionId,

            title:
              safeString(
                section.title
              ),

            instructions:
              safeString(
                section.instructions
              ),

            questions,
          } as PublishedTestSection;
        }
      )
      .filter(
        (
          section
        ): section is PublishedTestSection =>
          Boolean(section)
      );

  const totalQuestions =
    sections.reduce(
      (
        total,
        section
      ) =>
        total +
        section.questions.length,
      0
    );

  if (
    totalQuestions <= 0
  ) {
    throw new ApiError(
      "Đề kiểm tra chưa có câu hỏi để tạo snapshot.",
      400,
      {
        code:
          "TEST_SNAPSHOT_QUESTIONS_REQUIRED",
      }
    );
  }

  return sections;
}

export function buildPublishedTestSnapshot(
  testId: string,
  testData: Record<
    string,
    unknown
  >,
  publishedAt: string
): PublishedTestSnapshot {
  const owner =
    resolveTestOwner(
      testData
    );

  if (
    !owner.uid &&
    !owner.email
  ) {
    throw new ApiError(
      "Không xác định được chủ sở hữu đề kiểm tra.",
      400,
      {
        code:
          "TEST_OWNER_REQUIRED",
      }
    );
  }

  const metadata =
    readObject(
      testData.metadata
    );

  const version =
    readObject(
      testData.version
    );

  const sections =
    buildSnapshotSections(
      testData.sections
    );

  const totalQuestions =
    sections.reduce(
      (
        total,
        section
      ) =>
        total +
        section.questions.length,
      0
    );

  const calculatedTotalScore =
    sections.reduce(
      (
        sectionTotal,
        section
      ) =>
        sectionTotal +
        section.questions.reduce(
          (
            questionTotal,
            question
          ) =>
            questionTotal +
            normalizeNumber(
              question.score,
              0
            ),
          0
        ),
      0
    );

  const versionNumber =
    normalizeInteger(
      version.number,
      1
    );

  return removeUndefinedValues({
    snapshotId:
      `${testId}-v${versionNumber}`,

    testId,

    title:
      safeString(
        testData.title
      ),

    description:
      safeString(
        testData.description
      ),

    instructions:
      safeString(
        testData.instructions
      ),

    durationMinutes:
      normalizeNumber(
        testData.durationMinutes ??
          testData.duration,
        45
      ),

    totalQuestions,

    totalScore:
      normalizeNumber(
        testData.totalScore,
        calculatedTotalScore
      ),

    maxAttempts:
      normalizeInteger(
        testData.maxAttempts,
        1
      ),

    visibility:
      normalizeVisibility(
        testData.visibility
      ),

    owner,

    metadata: {
      subject:
        safeString(
          metadata.subject ??
            testData.subject
        ),

      grade:
        safeString(
          metadata.grade ??
            testData.grade
        ),

      topics:
        normalizeStringArray(
          metadata.topics
        ),

      tags:
        normalizeStringArray(
          metadata.tags
        ),
    },

    sections,

    settings:
      normalizeSettings(
        testData.settings
      ),

    versionNumber,

    schemaVersion:
      normalizeInteger(
        testData.schemaVersion,
        3
      ),

    publishedAt,
  }) as PublishedTestSnapshot;
}