import type {
  ExamStudentAnswer,
} from "@/features/exam/types";

import {
  normalizeSingleChoiceAnswer,
} from "./normalize";

import type {
  SingleChoiceGradingQuestion,
  SingleChoiceResultDetail,
} from "./types";

export function gradeSingleChoiceQuestion(
  question: SingleChoiceGradingQuestion,
  answer: ExamStudentAnswer | undefined
): SingleChoiceResultDetail {
  const studentAnswer =
    normalizeSingleChoiceAnswer(answer);

  const isAnswered =
    Boolean(studentAnswer);

  const isCorrect =
    isAnswered &&
    Boolean(question.correctAnswer) &&
    studentAnswer ===
      question.correctAnswer;

  return {
    questionId: question.id,

    questionNumber:
      question.questionNumber,

    sectionId:
      question.sectionId,

    sectionTitle:
      question.sectionTitle,

    type: "single_choice",

    studentAnswer,

    correctAnswer:
      question.correctAnswer,

    isAnswered,

    isCorrect,

    score: isCorrect
      ? question.score
      : 0,

    maxScore:
      question.score,
  };
}