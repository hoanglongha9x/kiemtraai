import type {
  ExamAnswerKey,
  ExamAnswers,
  ExamQuestionType,
  ExamStudentAnswer,
  ExamTrueFalseAnswer,
} from "@/features/exam/types";

export type GradingQuestionBase = {
  id: string;
  type: ExamQuestionType;
  questionNumber: number;
  sectionId: string;
  sectionTitle: string;
  score: number;
};

export type SingleChoiceGradingQuestion =
  GradingQuestionBase & {
    type: "single_choice";
    correctAnswer: ExamAnswerKey | "";
  };

export type TrueFalseGradingQuestion =
  GradingQuestionBase & {
    type: "true_false_group";
    correctAnswer: ExamTrueFalseAnswer;
  };

export type ShortAnswerGradingQuestion =
  GradingQuestionBase & {
    type: "short_answer";
    acceptedAnswers: string[];
    caseSensitive: boolean;
  };

export type GradingQuestion =
  | SingleChoiceGradingQuestion
  | TrueFalseGradingQuestion
  | ShortAnswerGradingQuestion;

export type SingleChoiceResultDetail = {
  questionId: string;
  questionNumber: number;
  sectionId: string;
  sectionTitle: string;
  type: "single_choice";

  studentAnswer: ExamAnswerKey | "";
  correctAnswer: ExamAnswerKey | "";

  isAnswered: boolean;
  isCorrect: boolean;

  score: number;
  maxScore: number;
};

export type TrueFalseResultDetail = {
  questionId: string;
  questionNumber: number;
  sectionId: string;
  sectionTitle: string;
  type: "true_false_group";

  studentAnswer: ExamTrueFalseAnswer;
  correctAnswer: ExamTrueFalseAnswer;

  answeredStatementCount: number;
  correctStatementCount: number;
  totalStatementCount: number;

  isAnswered: boolean;
  isCorrect: boolean;

  score: number;
  maxScore: number;
};

export type ShortAnswerResultDetail = {
  questionId: string;
  questionNumber: number;
  sectionId: string;
  sectionTitle: string;
  type: "short_answer";

  studentAnswer: string;
  acceptedAnswers: string[];

  caseSensitive: boolean;
  gradingMethod: "exact_match";

  isAnswered: boolean;
  isCorrect: boolean;

  score: number;
  maxScore: number;
};

export type GradingResultDetail =
  | SingleChoiceResultDetail
  | TrueFalseResultDetail
  | ShortAnswerResultDetail;

export type GradingSummary = {
  detail: GradingResultDetail[];
  answers: ExamAnswers;

  totalQuestions: number;
  answeredQuestionCount: number;
  unansweredQuestionCount: number;

  correctQuestionCount: number;
  incorrectQuestionCount: number;

  answeredStatementCount: number;
  correctStatementCount: number;
  totalStatementCount: number;

  earnedRawScore: number;
  maximumRawScore: number;
};

export type NormalizeAnswersInput = {
  value: unknown;
  questions: GradingQuestion[];
};

export type GradeQuestionInput = {
  question: GradingQuestion;
  answer?: ExamStudentAnswer;
};

export type GradeExamInput = {
  questions: GradingQuestion[];
  answers: ExamAnswers;
};

export type GradingScoreConfig = {
  assignmentTotalScore: number;
  earnedRawScore: number;
  maximumRawScore: number;
  correctQuestionCount: number;
  totalQuestions: number;
};

export type GradingScoreResult = {
  score: number;
  totalScore: number;
  percentage: number;
};

export type TrueFalseScoringMode =
  | "proportional"
  | "all_or_nothing";

export type GradingConfig = {
  trueFalseScoringMode: TrueFalseScoringMode;
  shortAnswerCaseSensitive: boolean;
  defaultQuestionScore: number;
};