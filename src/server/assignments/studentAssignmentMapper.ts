import {
  normalizeBoolean,
  normalizeInteger,
  normalizeNumber,
  removeUndefinedValues,
  safeString,
} from "@/server/shared/normalize";

import {
  resolveAssignmentAccessState,
} from "./assignmentMapper";

import type {
  AssignmentStatus,
} from "./assignmentTypes";

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

function normalizeStatus(
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

function sanitizeStatement(
  value: unknown
) {
  const statement =
    readObject(
      value
    );

  return removeUndefinedValues({
    id:
      safeString(
        statement.id
      ),

    label:
      safeString(
        statement.label
      ),

    statement:
      safeString(
        statement.statement ??
          statement.content ??
          statement.text
      ),

    statementImageId:
      safeString(
        statement.statementImageId
      ),

    statementImageUrl:
      safeString(
        statement.statementImageUrl
      ),
  });
}

function sanitizeQuestion(
  value: unknown,
  fallbackNumber: number
) {
  const question =
    readObject(
      value
    );

  const questionType =
    safeString(
      question.questionType ??
        question.type
    );

  return removeUndefinedValues({
    id:
      safeString(
        question.id
      ),

    bankQuestionId:
      safeString(
        question.bankQuestionId
      ),

    questionNumber:
      normalizeInteger(
        question.questionNumber,
        fallbackNumber
      ),

    questionType,

    section:
      safeString(
        question.section
      ),

    question:
      safeString(
        question.question ??
          question.content ??
          question.text
      ),

    questionImageId:
      safeString(
        question.questionImageId
      ),

    questionImageUrl:
      safeString(
        question.questionImageUrl
      ),

    A:
      safeString(
        question.A
      ),

    AImageId:
      safeString(
        question.AImageId
      ),

    AImageUrl:
      safeString(
        question.AImageUrl
      ),

    B:
      safeString(
        question.B
      ),

    BImageId:
      safeString(
        question.BImageId
      ),

    BImageUrl:
      safeString(
        question.BImageUrl
      ),

    C:
      safeString(
        question.C
      ),

    CImageId:
      safeString(
        question.CImageId
      ),

    CImageUrl:
      safeString(
        question.CImageUrl
      ),

    D:
      safeString(
        question.D
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
            sanitizeStatement
          )
        : [],

    score:
      normalizeNumber(
        question.score,
        0
      ),

    topic:
      safeString(
        question.topic
      ),

    difficulty:
      safeString(
        question.difficulty
      ),

    cognitiveLevel:
      safeString(
        question.cognitiveLevel
      ),
  });
}

function sanitizeSections(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  let globalQuestionNumber =
    0;

  return value.map(
    (
      rawSection
    ) => {
      const section =
        readObject(
          rawSection
        );

      const questions =
        Array.isArray(
          section.questions
        )
          ? section.questions.map(
              (
                question
              ) => {
                globalQuestionNumber +=
                  1;

                return sanitizeQuestion(
                  question,
                  globalQuestionNumber
                );
              }
            )
          : [];

      return {
        id:
          safeString(
            section.id
          ),

        title:
          safeString(
            section.title
          ),

        instructions:
          safeString(
            section.instructions
          ),

        questions,
      };
    }
  );
}

export function mapStudentAssignment(
  assignmentId: string,
  assignmentData: Record<
    string,
    unknown
  >
) {
  const testSnapshot =
    readObject(
      assignmentData.testSnapshot
    );

  const metadata =
    readObject(
      testSnapshot.metadata
    );

  const settings =
    readObject(
      testSnapshot.settings
    );

  const status =
    normalizeStatus(
      assignmentData.status
    );

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

  return removeUndefinedValues({
    id:
      assignmentId,

    assignmentCode:
      safeString(
        assignmentData.assignmentCode
      ),

    title:
      safeString(
        assignmentData.title ??
          testSnapshot.title
      ),

    description:
      safeString(
        assignmentData.description ??
          testSnapshot.description
      ),

    instructions:
      safeString(
        testSnapshot.instructions
      ),

    subject:
      safeString(
        assignmentData.subject ??
          metadata.subject
      ),

    grade:
      safeString(
        assignmentData.grade ??
          metadata.grade
      ),

    durationMinutes:
      normalizeInteger(
        assignmentData.durationMinutes ??
          testSnapshot.durationMinutes,
        45
      ),

    totalQuestions:
      normalizeInteger(
        assignmentData.totalQuestions ??
          testSnapshot.totalQuestions,
        0
      ),

    totalScore:
      normalizeNumber(
        assignmentData.totalScore ??
          testSnapshot.totalScore,
        0
      ),

    maxAttempts:
      normalizeInteger(
        assignmentData.maxAttempts ??
          testSnapshot.maxAttempts,
        1
      ),

    startTime,

    endTime,

    status,

    accessState:
      resolveAssignmentAccessState(
        status,
        startTime,
        endTime
      ),

    hasPassword:
      normalizeBoolean(
        assignmentData.hasPassword,
        false
      ),

    shuffleQuestions:
      normalizeBoolean(
        assignmentData.shuffleQuestions ??
          settings.shuffleQuestions,
        false
      ),

    shuffleOptions:
      normalizeBoolean(
        assignmentData.shuffleOptions ??
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

    testSnapshotId:
      safeString(
        assignmentData.testSnapshotId ??
          testSnapshot.snapshotId
      ),

    testVersionNumber:
      normalizeInteger(
        assignmentData.testVersionNumber ??
          testSnapshot.versionNumber,
        1
      ),

    sections:
      sanitizeSections(
        testSnapshot.sections
      ),
  });
}