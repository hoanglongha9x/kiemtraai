import {
  resolveAntiCheatState,
} from "@/features/exam/anti-cheat";

import {
  buildGradingQuestions,
  calculateGradingScore,
  gradeExam,
  normalizeExamAnswers,
} from "@/features/exam/grading";

import {
  calculateTimeSpentSeconds,
  resolveAssignmentSettings,
} from "./assignment-settings";

import {
  validateStudentAccess,
} from "./student-access";

import type {
  PreparedSubmit,
} from "./submit-types";

export type PrepareSubmitInput = {
  studentId: string;
  studentCode: string;

  attempt:
    Record<string, unknown>;

  assignment:
    Record<string, unknown>;

  student:
    Record<string, unknown>;

  requestAnswers:
    unknown;

  requestAntiCheat:
    unknown;

  submittedAt:
    Date;
};

export function prepareSubmit({
  studentId,
  studentCode,
  attempt,
  assignment,
  student,
  requestAnswers,
  requestAntiCheat,
  submittedAt,
}: PrepareSubmitInput): PreparedSubmit {
  const studentAccess =
    validateStudentAccess({
      studentId,
      studentCode,
      student,
      assignment,
    });

  /*
   * Student grading source:
   *
   * assignment.testSnapshot.sections
   *
   * Không đọc question bank.
   * Không đọc tests.questions.
   */
  const gradingQuestions =
    buildGradingQuestions(
      assignment
    );

  const savedAnswers =
    normalizeExamAnswers({
      value:
        attempt.answers,

      questions:
        gradingQuestions,
    });

  const submittedAnswers =
    normalizeExamAnswers({
      value:
        requestAnswers,

      questions:
        gradingQuestions,
    });

  /*
   * Answer gửi lúc submit được ưu tiên
   * hơn dữ liệu autosave trước đó.
   */
  const answers = {
    ...savedAnswers,
    ...submittedAnswers,
  };

  const gradingSummary =
    gradeExam(
      {
        questions:
          gradingQuestions,

        answers,
      },
      {
        trueFalseScoringMode:
          "proportional",
      }
    );

  const assignmentSettings =
    resolveAssignmentSettings({
      assignment,
    });

  const gradingScore =
    calculateGradingScore({
      assignmentTotalScore:
        assignmentSettings
          .totalScore,

      earnedRawScore:
        gradingSummary
          .earnedRawScore,

      maximumRawScore:
        gradingSummary
          .maximumRawScore,

      correctQuestionCount:
        gradingSummary
          .correctQuestionCount,

      totalQuestions:
        gradingSummary
          .totalQuestions,
    });

  const antiCheat =
    resolveAntiCheatState({
      savedAntiCheat:
        attempt.antiCheat,

      requestAntiCheat,
    });

  const timeSpentSeconds =
    calculateTimeSpentSeconds({
      startedAt:
        attempt.startedAt,

      submittedAt,
    });

  return {
    studentAccess,

    answers,

    gradingSummary,

    gradingScore,

    antiCheat,

    assignmentSettings,

    timeSpentSeconds,
  };
}