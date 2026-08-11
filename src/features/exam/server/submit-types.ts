import type {
  ResolvedAntiCheatState,
} from "@/features/exam/anti-cheat";

import {
  calculateGradingScore,
  gradeExam,
} from "@/features/exam/grading";

import type {
  AssignmentSettings,
} from "./assignment-settings";

import type {
  ValidatedStudentAccess,
} from "./student-access";

export type ExamAnswers =
  Record<string, unknown>;

export type SubmitGradingSummary =
  ReturnType<
    typeof gradeExam
  >;

export type SubmitGradingScore =
  ReturnType<
    typeof calculateGradingScore
  >;

export type PreparedSubmit = {
  studentAccess:
    ValidatedStudentAccess;

  answers:
    ExamAnswers;

  gradingSummary:
    SubmitGradingSummary;

  gradingScore:
    SubmitGradingScore;

  antiCheat:
    ResolvedAntiCheatState;

  assignmentSettings:
    AssignmentSettings;

  timeSpentSeconds:
    number;
};

export type SubmitTransactionResult = {
  resultId: string;
  alreadySubmitted: boolean;
};

export type SubmitSummaryResponse = {
  score: number;
  totalScore: number;
  percentage: number;

  totalQuestions: number;
  answeredQuestionCount: number;
  correctQuestionCount: number;

  answeredStatementCount: number;
  correctStatementCount: number;
  totalStatementCount: number;
};

export type SubmitAnswerReviewItem = {
  questionId: string;
  questionNumber: number;
  sectionTitle: string;
  type: "single_choice" | "true_false_group" | "short_answer";
  isCorrect: boolean;
  score: number;
  maxScore: number;
  studentAnswer: unknown;
  correctAnswer?: unknown;
  acceptedAnswers?: string[];
};
