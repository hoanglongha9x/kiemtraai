import type {
  SubmitGradingScore,
  SubmitGradingSummary,
} from "./submit-types";

import type {
  ResolvedAntiCheatState,
} from "@/features/exam/anti-cheat";

import type {
  ValidatedStudentAccess,
} from "./student-access";



import {
  asRecord,
  normalizeStringArray,
  safeNumber,
  safeString,
} from "@/features/exam/utils";

export type BuildResultPayloadInput = {
  attemptId: string;
  assignmentId: string;

  attempt: Record<string, unknown>;
  assignment: Record<string, unknown>;

  studentAccess: ValidatedStudentAccess;

  answers: Record<string, unknown>;

  gradingSummary:
  SubmitGradingSummary;

gradingScore:
  SubmitGradingScore;
  antiCheat: ResolvedAntiCheatState;

  durationMinutes: number;
  timeSpentSeconds: number;

  submittedAtIso: string;
  autoSubmit: boolean;
};

export type ExamResultPayload =
  Record<string, unknown>;

function resolveTestId(
  assignment: Record<string, unknown>,
  attempt: Record<string, unknown>,
  testSnapshot: Record<string, unknown>
): string {
  return (
    safeString(
      assignment.testId
    ) ||
    safeString(
      attempt.testId
    ) ||
    safeString(
      testSnapshot.id
    )
  );
}

function resolveTestTitle(
  assignment: Record<string, unknown>,
  testSnapshot: Record<string, unknown>
): string {
  return (
    safeString(
      assignment.testTitle
    ) ||
    safeString(
      testSnapshot.title
    )
  );
}

function resolveSubject(
  assignment: Record<string, unknown>,
  testSnapshot: Record<string, unknown>
): string {
  return (
    safeString(
      assignment.subject
    ) ||
    safeString(
      testSnapshot.subject
    )
  );
}

function resolveGrade(
  assignment: Record<string, unknown>,
  testSnapshot: Record<string, unknown>
): string {
  return (
    safeString(
      assignment.grade
    ) ||
    safeString(
      testSnapshot.grade
    )
  );
}

function resolveAssignmentCode(
  assignment: Record<string, unknown>,
  attempt: Record<string, unknown>
): string {
  return (
    safeString(
      assignment.assignmentCode
    ) ||
    safeString(
      attempt.assignmentCode
    )
  );
}

function resolveTestVersionNumber(
  assignment: Record<string, unknown>,
  testSnapshot: Record<string, unknown>
): number {
  return Math.max(
    0,
    safeNumber(
      testSnapshot.versionNumber ??
        assignment.versionNumber,
      0
    )
  );
}

export function buildResultPayload({
  attemptId,
  assignmentId,
  attempt,
  assignment,
  studentAccess,
  answers,
  gradingSummary,
  gradingScore,
  antiCheat,
  durationMinutes,
  timeSpentSeconds,
  submittedAtIso,
  autoSubmit,
}: BuildResultPayloadInput): ExamResultPayload {
  const testSnapshot =
    asRecord(
      assignment.testSnapshot
    );

  return {
    attemptId,

    attemptNumber:
      Math.max(
        1,
        safeNumber(
          attempt.attemptNumber,
          1
        )
      ),

    assignmentId,

    assignmentCode:
      resolveAssignmentCode(
        assignment,
        attempt
      ),

    testId:
      resolveTestId(
        assignment,
        attempt,
        testSnapshot
      ),

    testTitle:
      resolveTestTitle(
        assignment,
        testSnapshot
      ),

    testVersionNumber:
      resolveTestVersionNumber(
        assignment,
        testSnapshot
      ),

    subject:
      resolveSubject(
        assignment,
        testSnapshot
      ),

    grade:
      resolveGrade(
        assignment,
        testSnapshot
      ),

    classIds:
      studentAccess
        .allowedClassIds,

    classNames:
      studentAccess
        .allowedClassNames,

    classCount:
      studentAccess
        .allowedClassIds
        .length,

    classId:
      studentAccess
        .studentClassId,

    className:
      studentAccess
        .studentClassName,

    studentId:
      studentAccess
        .studentId,

    studentCode:
      studentAccess
        .studentCode,

    studentName:
      studentAccess
        .studentName,

    teacherEmail:
      safeString(
        assignment.teacherEmail
      ),

    teacherName:
      safeString(
        assignment.teacherName
      ),

    schoolId:
      safeString(
        assignment.schoolId
      ),

    answers,

    detail:
      gradingSummary.detail,

    bookmarkedQuestionIds:
      normalizeStringArray(
        attempt.bookmarkedQuestionIds
      ),

    totalQuestions:
      gradingSummary
        .totalQuestions,

    answeredQuestionCount:
      gradingSummary
        .answeredQuestionCount,

    unansweredQuestionCount:
      gradingSummary
        .unansweredQuestionCount,

    correctQuestionCount:
      gradingSummary
        .correctQuestionCount,

    incorrectQuestionCount:
      gradingSummary
        .incorrectQuestionCount,

    /*
     * Legacy aliases consumed by teacher result screens.
     * Keep these in sync so old and new result APIs show the same counts.
     */
    correctCount:
      gradingSummary
        .correctQuestionCount,

    wrongCount:
      gradingSummary
        .incorrectQuestionCount,

    blankCount:
      gradingSummary
        .unansweredQuestionCount,

    answeredStatementCount:
      gradingSummary
        .answeredStatementCount,

    correctStatementCount:
      gradingSummary
        .correctStatementCount,

    totalStatementCount:
      gradingSummary
        .totalStatementCount,

    earnedRawScore:
      gradingSummary
        .earnedRawScore,

    maximumRawScore:
      gradingSummary
        .maximumRawScore,

    score:
      gradingScore.score,

    totalScore:
      gradingScore.totalScore,

    percentage:
      gradingScore.percentage,

    duration:
      durationMinutes,

    durationMinutes,

    timeSpentSeconds,

    startedAt:
      safeString(
        attempt.startedAt
      ),

    expiresAt:
      safeString(
        attempt.expiresAt
      ),

    submittedAt:
      submittedAtIso,

    status:
      "submitted",

    autoSubmit,

    antiCheat: {
      visibilityLostCount:
        antiCheat
          .visibilityLostCount,

      focusLostCount:
        antiCheat
          .focusLostCount,

      suspiciousEventCount:
        antiCheat
          .suspiciousEventCount,

      suspiciousEvents:
        antiCheat
          .suspiciousEvents,
    },

    visibilityLostCount:
      antiCheat
        .visibilityLostCount,

    focusLostCount:
      antiCheat
        .focusLostCount,

    suspiciousEventCount:
      antiCheat
        .suspiciousEventCount,

    hasSuspiciousActivity:
      antiCheat
        .hasSuspiciousActivity,

    createdAt:
      submittedAtIso,

    updatedAt:
      submittedAtIso,
  };
}