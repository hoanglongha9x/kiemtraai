import type {
  ExamAnswerKey,
  ExamStudentAnswer,
  ExamTrueFalseAnswer,
} from "@/features/exam/types";

import {
  countAnsweredStatements,
  normalizeTrueFalseAnswer,
  roundGradingScore,
} from "./normalize";

import type {
  TrueFalseGradingQuestion,
  TrueFalseResultDetail,
  TrueFalseScoringMode,
} from "./types";

const ANSWER_KEYS: ExamAnswerKey[] = [
  "A",
  "B",
  "C",
  "D",
];

function getCorrectAnswerKeys(
  correctAnswer: ExamTrueFalseAnswer
): ExamAnswerKey[] {
  return ANSWER_KEYS.filter(
    (answerKey) =>
      typeof correctAnswer[
        answerKey
      ] === "boolean"
  );
}

function countCorrectStatements(params: {
  studentAnswer: ExamTrueFalseAnswer;
  correctAnswer: ExamTrueFalseAnswer;
  answerKeys: ExamAnswerKey[];
}): number {
  const {
    studentAnswer,
    correctAnswer,
    answerKeys,
  } = params;

  return answerKeys.reduce(
    (total, answerKey) => {
      const studentValue =
        studentAnswer[answerKey];

      const correctValue =
        correctAnswer[answerKey];

      const isCorrect =
        typeof studentValue ===
          "boolean" &&
        studentValue ===
          correctValue;

      return total +
        (isCorrect ? 1 : 0);
    },
    0
  );
}

function calculateTrueFalseScore(params: {
  correctStatementCount: number;
  totalStatementCount: number;
  maxScore: number;
  scoringMode: TrueFalseScoringMode;
}): number {
  const {
    correctStatementCount,
    totalStatementCount,
    maxScore,
    scoringMode,
  } = params;

  if (
    totalStatementCount <= 0 ||
    maxScore <= 0
  ) {
    return 0;
  }

  if (
    scoringMode ===
    "all_or_nothing"
  ) {
    return correctStatementCount ===
      totalStatementCount
      ? maxScore
      : 0;
  }

  return roundGradingScore(
    maxScore *
      (correctStatementCount /
        totalStatementCount)
  );
}

export function gradeTrueFalseQuestion(
  question: TrueFalseGradingQuestion,
  answer: ExamStudentAnswer | undefined,
  scoringMode: TrueFalseScoringMode =
    "proportional"
): TrueFalseResultDetail {
  const studentAnswer =
    normalizeTrueFalseAnswer(answer);

  const correctAnswer =
    question.correctAnswer;

  const correctAnswerKeys =
    getCorrectAnswerKeys(
      correctAnswer
    );

  const answeredStatementCount =
    countAnsweredStatements(
      studentAnswer
    );

  const totalStatementCount =
    correctAnswerKeys.length;

  const correctStatementCount =
    countCorrectStatements({
      studentAnswer,
      correctAnswer,
      answerKeys:
        correctAnswerKeys,
    });

  const isAnswered =
    answeredStatementCount > 0;

  const isCorrect =
    totalStatementCount > 0 &&
    correctStatementCount ===
      totalStatementCount;

  const score =
    calculateTrueFalseScore({
      correctStatementCount,
      totalStatementCount,
      maxScore: question.score,
      scoringMode,
    });

  return {
    questionId: question.id,

    questionNumber:
      question.questionNumber,

    sectionId:
      question.sectionId,

    sectionTitle:
      question.sectionTitle,

    type: "true_false_group",

    studentAnswer,

    correctAnswer,

    answeredStatementCount,

    correctStatementCount,

    totalStatementCount,

    isAnswered,

    isCorrect,

    score,

    maxScore:
      question.score,
  };
}