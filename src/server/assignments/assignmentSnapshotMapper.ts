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

import type {
  PublishedTestQuestion,
  PublishedTestSection,
  TestMetadata,
  TestOwner,
  TestSettings,
  TestSectionId,
} from "@/server/tests/testTypes";

import type {
  AssignmentTestSnapshot,
} from "./assignmentTypes";

type UnknownRecord =
  Record<string, unknown>;

type OptionId =
  | "A"
  | "B"
  | "C"
  | "D";

function readObject(
  value: unknown
): UnknownRecord {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return {};
}

function normalizeDateValue(
  value: unknown
): string {
  if (
    typeof value === "string"
  ) {
    return value.trim();
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const timestamp =
      value as {
        toDate?: () => Date;
        seconds?: number;
        _seconds?: number;
      };

    if (
      typeof timestamp.toDate ===
      "function"
    ) {
      const date =
        timestamp.toDate();

      if (
        date instanceof Date &&
        !Number.isNaN(
          date.getTime()
        )
      ) {
        return date.toISOString();
      }
    }

    const seconds =
      typeof timestamp.seconds ===
      "number"
        ? timestamp.seconds
        : timestamp._seconds;

    if (
      typeof seconds === "number"
    ) {
      return new Date(
        seconds * 1000
      ).toISOString();
    }
  }

  return "";
}

function normalizeOwner(
  value: unknown
): TestOwner {
  const owner =
    readObject(value);

  const uid =
    safeString(
      owner.uid
    );

  const email =
    safeString(
      owner.email
    ).toLowerCase();

  if (
    !uid &&
    !email
  ) {
    throw new ApiError(
      "Snapshot đề không có thông tin chủ sở hữu.",
      400,
      {
        code:
          "PUBLISHED_SNAPSHOT_OWNER_REQUIRED",
      }
    );
  }

  return {
    uid,

    email,

    name:
      safeString(
        owner.name
      ) || email,

    schoolId:
      safeString(
        owner.schoolId
      ) || "fpt",
  };
}

function normalizeMetadata(
  value: unknown
): TestMetadata {
  const metadata =
    readObject(value);

  return {
    subject:
      safeString(
        metadata.subject
      ),

    grade:
      safeString(
        metadata.grade
      ),

    topics:
      normalizeStringArray(
        metadata.topics
      ),

    tags:
      normalizeStringArray(
        metadata.tags
      ),
  };
}

function normalizeSettings(
  value: unknown
): TestSettings {
  const settings =
    readObject(value);

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
    safeString(value);

  if (
    sectionId === "part_1" ||
    sectionId === "part_2" ||
    sectionId === "part_3"
  ) {
    return sectionId;
  }

  return null;
}

function getQuestionSnapshot(
  question: UnknownRecord
): UnknownRecord {
  return readObject(
    question.snapshot
  );
}

function getQuestionSource(
  question: UnknownRecord
): UnknownRecord {
  const snapshot =
    getQuestionSnapshot(
      question
    );

  if (
    Object.keys(
      snapshot
    ).length === 0
  ) {
    return question;
  }

  return {
    ...snapshot,
    ...question,
  };
}

function getOptionObject(
  question: UnknownRecord,
  optionId: OptionId
): UnknownRecord {
  const source =
    getQuestionSource(
      question
    );

  if (
    !Array.isArray(
      source.options
    )
  ) {
    return {};
  }

  const rawOption =
    source.options.find(
      optionValue => {
        const option =
          readObject(
            optionValue
          );

        return (
          safeString(
            option.id ??
              option.label ??
              option.key
          ).toUpperCase() ===
          optionId
        );
      }
    );

  return readObject(
    rawOption
  );
}

function getOptionContent(
  question: UnknownRecord,
  optionId: OptionId
): string {
  const source =
    getQuestionSource(
      question
    );

  const directContent =
    safeString(
      source[
        optionId
      ]
    );

  if (
    directContent
  ) {
    return directContent;
  }

  const option =
    getOptionObject(
      question,
      optionId
    );

  return safeString(
    option.content ??
      option.text ??
      option.value
  );
}

function getOptionImageId(
  question: UnknownRecord,
  optionId: OptionId
): string {
  const source =
    getQuestionSource(
      question
    );

  const directImageId =
    safeString(
      source[
        `${optionId}ImageId`
      ]
    );

  if (
    directImageId
  ) {
    return directImageId;
  }

  const option =
    getOptionObject(
      question,
      optionId
    );

  return safeString(
    option.imageId ??
      option.optionImageId
  );
}

function getOptionImageUrl(
  question: UnknownRecord,
  optionId: OptionId
): string {
  const source =
    getQuestionSource(
      question
    );

  const directImageUrl =
    safeString(
      source[
        `${optionId}ImageUrl`
      ]
    );

  if (
    directImageUrl
  ) {
    return directImageUrl;
  }

  const option =
    getOptionObject(
      question,
      optionId
    );

  return safeString(
    option.imageUrl ??
      option.optionImageUrl
  );
}

function mapStatement(
  value: unknown,
  statementIndex: number
) {
  const statement =
    readObject(value);

  const fallbackId =
    (
      [
        "A",
        "B",
        "C",
        "D",
      ] as const
    )[
      statementIndex
    ] ?? "";

  const correct =
    normalizeBoolean(
      statement.correct ??
        statement.correctAnswer ??
        statement.answer ??
        statement.isCorrect,
      false
    );

  return removeUndefinedValues({
    ...statement,

    id:
      safeString(
        statement.id ??
          statement.label
      ) || fallbackId,

    label:
      safeString(
        statement.label ??
          statement.id
      ) || fallbackId,

    statement:
      safeString(
        statement.statement ??
          statement.content ??
          statement.text
      ),

    statementImageId:
      safeString(
        statement.statementImageId ??
          statement.imageId
      ),

    statementImageUrl:
      safeString(
        statement.statementImageUrl ??
          statement.imageUrl
      ),

    correct,
    correctAnswer:
      correct,
  });
}

function mapQuestion(
  value: unknown,
  questionIndex: number,
  sectionId: TestSectionId
): PublishedTestQuestion {
  const question =
    readObject(value);

  const source =
    getQuestionSource(
      question
    );

  const questionType =
    safeString(
      source.questionType ??
        source.type
    );

  if (
    questionType !==
      "single_choice" &&
    questionType !==
      "true_false_group" &&
    questionType !==
      "short_answer"
  ) {
    throw new ApiError(
      `Câu ${questionIndex + 1} trong snapshot có loại câu hỏi không hợp lệ.`,
      400,
      {
        code:
          "INVALID_SNAPSHOT_QUESTION_TYPE",
      }
    );
  }

  const questionId =
    safeString(
      question.id ??
        question.questionId
    );

  if (
    !questionId
  ) {
    throw new ApiError(
      `Câu ${questionIndex + 1} trong snapshot chưa có id.`,
      400,
      {
        code:
          "SNAPSHOT_QUESTION_ID_REQUIRED",
      }
    );
  }

  return removeUndefinedValues({
    ...question,

    id:
      questionId,

    questionNumber:
      normalizeInteger(
        source.questionNumber ??
          source.number ??
          question.order,
        questionIndex + 1
      ),

    questionType,

    section:
      sectionId,

    bankQuestionId:
      safeString(
        question.bankQuestionId ??
          question.questionBankId ??
          source.originalQuestionId
      ),

    question:
      safeString(
        source.question ??
          source.content ??
          source.text
      ),

    questionImageId:
      safeString(
        question.questionImageId ??
          source.questionImageId ??
          source.imageId
      ),

    questionImageUrl:
      safeString(
        question.questionImageUrl ??
          source.questionImageUrl ??
          source.imageUrl
      ),

    A:
      getOptionContent(
        question,
        "A"
      ),

    AImageId:
      getOptionImageId(
        question,
        "A"
      ),

    AImageUrl:
      getOptionImageUrl(
        question,
        "A"
      ),

    B:
      getOptionContent(
        question,
        "B"
      ),

    BImageId:
      getOptionImageId(
        question,
        "B"
      ),

    BImageUrl:
      getOptionImageUrl(
        question,
        "B"
      ),

    C:
      getOptionContent(
        question,
        "C"
      ),

    CImageId:
      getOptionImageId(
        question,
        "C"
      ),

    CImageUrl:
      getOptionImageUrl(
        question,
        "C"
      ),

    D:
      getOptionContent(
        question,
        "D"
      ),

    DImageId:
      getOptionImageId(
        question,
        "D"
      ),

    DImageUrl:
      getOptionImageUrl(
        question,
        "D"
      ),

    statements:
      Array.isArray(
        source.statements
      )
        ? source.statements.map(
            (
              statement,
              statementIndex
            ) =>
              mapStatement(
                statement,
                statementIndex
              )
          )
        : [],

    correctOptionId:
      safeString(
        source.correctOptionId
      ),

    correct:
      safeString(
        source.correct ??
          source.correctAnswer ??
          source.correctOptionId
      ).toUpperCase(),

    expectedAnswer:
      safeString(
        source.expectedAnswer ??
          source.correctAnswer ??
          source.answer
      ),

    acceptedAnswers:
      normalizeStringArray(
        source.acceptedAnswers
      ),

    answerTolerance:
      normalizeNumber(
        source.answerTolerance,
        0
      ),

    caseSensitive:
      normalizeBoolean(
        source.caseSensitive,
        false
      ),

    trimWhitespace:
      normalizeBoolean(
        source.trimWhitespace,
        true
      ),

    explanation:
      safeString(
        source.explanation
      ),

    topic:
      safeString(
        source.topic
      ),

    knowledgeUnit:
      safeString(
        source.knowledgeUnit
      ),

    skill:
      safeString(
        source.skill
      ),

    learningOutcome:
      safeString(
        source.learningOutcome
      ),

    cognitiveLevel:
      safeString(
        source.cognitiveLevel
      ) ||
      "understanding",

    difficulty:
      safeString(
        source.difficulty
      ) ||
      "medium",

    tags:
      normalizeStringArray(
        source.tags
      ),

    subject:
      safeString(
        source.subject
      ),

    grade:
      safeString(
        source.grade
      ),

    score:
      normalizeNumber(
        question.score ??
          source.score,
        0
      ),
  }) as unknown as PublishedTestQuestion;
}

function mapSections(
  value: unknown
): PublishedTestSection[] {
  if (
    !Array.isArray(value)
  ) {
    throw new ApiError(
      "Snapshot đề không có sections hợp lệ.",
      400,
      {
        code:
          "PUBLISHED_SNAPSHOT_SECTIONS_REQUIRED",
      }
    );
  }

  const sections =
    value
      .map(
        rawSection => {
          const section =
            readObject(
              rawSection
            );

          const sectionId =
            normalizeSectionId(
              section.id ??
                section.sectionId
            );

          if (
            !sectionId
          ) {
            return null;
          }

          const questions =
            Array.isArray(
              section.questions
            )
              ? section.questions.map(
                  (
                    question,
                    questionIndex
                  ) =>
                    mapQuestion(
                      question,
                      questionIndex,
                      sectionId
                    )
                )
              : [];

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
          section !== null
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
      "Snapshot đề chưa có câu hỏi.",
      400,
      {
        code:
          "PUBLISHED_SNAPSHOT_EMPTY",
      }
    );
  }

  return sections;
}

export function getPublishedSnapshot(
  testData: UnknownRecord
): UnknownRecord {
  const rawSnapshot =
    testData.publishedSnapshot;

  if (
    !rawSnapshot ||
    typeof rawSnapshot !==
      "object" ||
    Array.isArray(
      rawSnapshot
    )
  ) {
    throw new ApiError(
      "Đề chưa có bản snapshot đã xuất bản.",
      409,
      {
        code:
          "PUBLISHED_SNAPSHOT_NOT_FOUND",
      }
    );
  }

  const snapshot =
    rawSnapshot as UnknownRecord;

  if (
    Object.keys(
      snapshot
    ).length === 0
  ) {
    throw new ApiError(
      "Bản snapshot đã xuất bản đang trống.",
      409,
      {
        code:
          "PUBLISHED_SNAPSHOT_EMPTY_OBJECT",
      }
    );
  }

  return snapshot;
}

export function mapAssignmentTestSnapshot(
  testId: string,
  testData: UnknownRecord
): AssignmentTestSnapshot {
  const publishedSnapshot =
    getPublishedSnapshot(
      testData
    );

  const snapshotTestId =
    safeString(
      publishedSnapshot.testId
    ) || testId;

  if (
    snapshotTestId !== testId
  ) {
    throw new ApiError(
      "Snapshot không thuộc đề kiểm tra được chọn.",
      409,
      {
        code:
          "PUBLISHED_SNAPSHOT_TEST_MISMATCH",
      }
    );
  }

  const snapshotId =
    safeString(
      publishedSnapshot.snapshotId
    );

  if (
    !snapshotId
  ) {
    throw new ApiError(
      "Snapshot đề chưa có snapshotId.",
      400,
      {
        code:
          "PUBLISHED_SNAPSHOT_ID_REQUIRED",
      }
    );
  }

  const sections =
    mapSections(
      publishedSnapshot.sections
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

  const calculatedScore =
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

  const normalizedTotalScore =
    normalizeNumber(
      publishedSnapshot.totalScore,
      calculatedScore
    );

  return removeUndefinedValues({
    snapshotId,

    testId:
      snapshotTestId,

    title:
      safeString(
        publishedSnapshot.title
      ),

    description:
      safeString(
        publishedSnapshot.description
      ),

    instructions:
      safeString(
        publishedSnapshot.instructions
      ),

    durationMinutes:
      normalizeNumber(
        publishedSnapshot.durationMinutes,
        45
      ),

    totalQuestions,

    totalScore:
      normalizedTotalScore > 0
        ? normalizedTotalScore
        : calculatedScore,

    maxAttempts:
      normalizeInteger(
        publishedSnapshot.maxAttempts,
        1
      ),

    owner:
      normalizeOwner(
        publishedSnapshot.owner
      ),

    metadata:
      normalizeMetadata(
        publishedSnapshot.metadata
      ),

    sections,

    settings:
      normalizeSettings(
        publishedSnapshot.settings
      ),

    versionNumber:
      normalizeInteger(
        publishedSnapshot.versionNumber,
        1
      ),

    schemaVersion:
      normalizeInteger(
        publishedSnapshot.schemaVersion,
        3
      ),

    publishedAt:
      normalizeDateValue(
        publishedSnapshot.publishedAt
      ),
  }) as AssignmentTestSnapshot;
}
