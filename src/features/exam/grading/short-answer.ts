import type {
  ExamStudentAnswer,
} from "@/features/exam/types";

import {
  normalizeShortAnswer,
  normalizeTextForComparison,
} from "./normalize";

import type {
  ShortAnswerGradingQuestion,
  ShortAnswerResultDetail,
} from "./types";

function isAcceptedAnswer(params: {
  studentAnswer: string;
  acceptedAnswers: string[];
  caseSensitive: boolean;
}): boolean {
  const {
    studentAnswer,
    acceptedAnswers,
    caseSensitive,
  } = params;

  const normalizedStudentAnswer =
    normalizeTextForComparison(
      studentAnswer,
      caseSensitive
    );

  if (!normalizedStudentAnswer) {
    return false;
  }

  return acceptedAnswers.some(
    (acceptedAnswer) =>
      normalizeTextForComparison(
        acceptedAnswer,
        caseSensitive
      ) ===
      normalizedStudentAnswer
  );
}

export function gradeShortAnswerQuestion(
  question: ShortAnswerGradingQuestion,
  answer: ExamStudentAnswer | undefined
): ShortAnswerResultDetail {
  const studentAnswer =
    normalizeShortAnswer(answer);

  const isAnswered =
    Boolean(studentAnswer);

  const isCorrect =
    isAnswered &&
    isAcceptedAnswer({
      studentAnswer,
      acceptedAnswers:
        question.acceptedAnswers,
      caseSensitive:
        question.caseSensitive,
    });

  return {
    questionId: question.id,

    questionNumber:
      question.questionNumber,

    sectionId:
      question.sectionId,

    sectionTitle:
      question.sectionTitle,

    type: "short_answer",

    studentAnswer,

    acceptedAnswers:
      question.acceptedAnswers,

    caseSensitive:
      question.caseSensitive,

    gradingMethod:
      "exact_match",

    isAnswered,

    isCorrect,

    score: isCorrect
      ? question.score
      : 0,

    maxScore:
      question.score,
  };
}