import type {
  ExamAnswers,
} from "@/features/exam/types";

import {
  gradeShortAnswerQuestion,
} from "./short-answer";

import {
  gradeSingleChoiceQuestion,
} from "./single-choice";

import {
  gradeTrueFalseQuestion,
} from "./true-false-group";

import type {
  GradeExamInput,
  GradingConfig,
  GradingResultDetail,
  GradingSummary,
} from "./types";

import {
  roundGradingScore,
} from "./normalize";

const DEFAULT_GRADING_CONFIG: GradingConfig = {
  trueFalseScoringMode: "proportional",
  shortAnswerCaseSensitive: false,
  defaultQuestionScore: 0,
};

function gradeQuestion(
  question: GradeExamInput["questions"][number],
  answers: ExamAnswers,
  config: GradingConfig
): GradingResultDetail {
  const answer = answers[question.id];

  switch (question.type) {
    case "single_choice":
      return gradeSingleChoiceQuestion(
        question,
        answer
      );

    case "true_false_group":
      return gradeTrueFalseQuestion(
        question,
        answer,
        config.trueFalseScoringMode
      );

    case "short_answer":
      return gradeShortAnswerQuestion(
        {
          ...question,

          caseSensitive:
            question.caseSensitive ??
            config.shortAnswerCaseSensitive,
        },
        answer
      );

    default: {
      const exhaustiveCheck: never =
        question;

      throw new Error(
        `Loại câu hỏi không được hỗ trợ: ${String(
          exhaustiveCheck
        )}`
      );
    }
  }
}

export function gradeExam(
  input: GradeExamInput,
  config: Partial<GradingConfig> = {}
): GradingSummary {
  const resolvedConfig: GradingConfig = {
    ...DEFAULT_GRADING_CONFIG,
    ...config,
  };

  const detail =
    input.questions.map(
      (question) =>
        gradeQuestion(
          question,
          input.answers,
          resolvedConfig
        )
    );

  const totalQuestions =
    detail.length;

  const answeredQuestionCount =
    detail.filter(
      (item) => item.isAnswered
    ).length;

  const unansweredQuestionCount =
    totalQuestions -
    answeredQuestionCount;

  const correctQuestionCount =
    detail.filter(
      (item) => item.isCorrect
    ).length;

  const incorrectQuestionCount =
    detail.filter(
      (item) =>
        item.isAnswered &&
        !item.isCorrect
    ).length;

  const answeredStatementCount =
    detail.reduce(
      (total, item) => {
        if (
          item.type !==
          "true_false_group"
        ) {
          return total;
        }

        return (
          total +
          item.answeredStatementCount
        );
      },
      0
    );

  const correctStatementCount =
    detail.reduce(
      (total, item) => {
        if (
          item.type !==
          "true_false_group"
        ) {
          return total;
        }

        return (
          total +
          item.correctStatementCount
        );
      },
      0
    );

  const totalStatementCount =
    detail.reduce(
      (total, item) => {
        if (
          item.type !==
          "true_false_group"
        ) {
          return total;
        }

        return (
          total +
          item.totalStatementCount
        );
      },
      0
    );

  const earnedRawScore =
    roundGradingScore(
      detail.reduce(
        (total, item) =>
          total + item.score,
        0
      )
    );

  const maximumRawScore =
    roundGradingScore(
      detail.reduce(
        (total, item) =>
          total + item.maxScore,
        0
      )
    );

  return {
    detail,

    answers:
      input.answers,

    totalQuestions,

    answeredQuestionCount,

    unansweredQuestionCount,

    correctQuestionCount,

    incorrectQuestionCount,

    answeredStatementCount,

    correctStatementCount,

    totalStatementCount,

    earnedRawScore,

    maximumRawScore,
  };
}