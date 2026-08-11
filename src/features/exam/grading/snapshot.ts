import type {
  ExamAnswerKey,
  ExamQuestionType,
  ExamTrueFalseAnswer,
} from "@/features/exam/types";

import {
  asRecord,
  normalizeAnswerKey,
  safeNumber,
  safeString,
} from "@/features/exam/utils";

import {
  normalizeAcceptedAnswers,
  normalizeQuestionScore,
  normalizeTrueFalseAnswer,
} from "./normalize";

import type {
  GradingQuestion,
  GradingQuestionBase,
} from "./types";

class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

const ANSWER_KEYS: ExamAnswerKey[] = [
  "A",
  "B",
  "C",
  "D",
];

function isExamQuestionType(
  value: unknown
): value is ExamQuestionType {
  return (
    value === "single_choice" ||
    value === "true_false_group" ||
    value === "short_answer"
  );
}

function normalizeQuestionTypeLabel(
  value: unknown
): string {
  return safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveExamQuestionType(
  value: unknown
): ExamQuestionType | null {
  if (isExamQuestionType(value)) {
    return value;
  }

  const normalized =
    normalizeQuestionTypeLabel(value);

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("dung sai") ||
    normalized.includes("true false") ||
    normalized.includes("truefalse")
  ) {
    return "true_false_group";
  }

  if (
    normalized.includes("tra loi ngan") ||
    normalized.includes("short answer") ||
    normalized.includes("shortanswer")
  ) {
    return "short_answer";
  }

  if (
    normalized.includes("trac nghiem") ||
    normalized.includes("nhieu lua chon") ||
    normalized.includes("single choice") ||
    normalized.includes("multiple choice") ||
    normalized.includes("choice")
  ) {
    return "single_choice";
  }

  return null;
}

function normalizeQuestionType(
  questionType: unknown,
  sectionType: unknown,
  sectionTitle?: unknown
): ExamQuestionType | null {
  return (
    resolveExamQuestionType(questionType) ??
    resolveExamQuestionType(sectionType) ??
    resolveExamQuestionType(sectionTitle)
  );
}

function buildQuestionId(
  question: Record<string, unknown>,
  sectionId: string,
  questionIndex: number
): string {
  return (
    safeString(
      question.id ??
        question.questionId ??
        question.bankQuestionId
    ) ||
    `${sectionId}-q-${questionIndex + 1}`
  );
}

function ensureUniqueQuestionId(
  baseQuestionId: string,
  usedQuestionIds: Set<string>
): string {
  if (!usedQuestionIds.has(baseQuestionId)) {
    usedQuestionIds.add(baseQuestionId);

    return baseQuestionId;
  }

  let duplicateIndex = 2;
  let questionId =
    `${baseQuestionId}-${duplicateIndex}`;

  while (usedQuestionIds.has(questionId)) {
    duplicateIndex += 1;
    questionId =
      `${baseQuestionId}-${duplicateIndex}`;
  }

  usedQuestionIds.add(questionId);

  return questionId;
}

function normalizeCorrectSingleChoiceAnswer(
  question: Record<string, unknown>
): ExamAnswerKey | "" {
  const snapshot =
    asRecord(question.snapshot);
  const source =
    Object.keys(snapshot).length > 0
      ? {
          ...question,
          ...snapshot,
        }
      : question;

  return normalizeAnswerKey(
    source.correctOptionId ??
      source.correctAnswer ??
      source.correct ??
      source.answer
  );
}

function normalizeCorrectTrueFalseFromStatements(
  question: Record<string, unknown>
): ExamTrueFalseAnswer {
  const statements = Array.isArray(
    question.statements
  )
    ? question.statements
    : Array.isArray(
          question.trueFalseStatements
        )
      ? question.trueFalseStatements
      : [];

  const answer: ExamTrueFalseAnswer = {};

  statements
    .slice(0, ANSWER_KEYS.length)
    .forEach(
      (
        rawStatement,
        statementIndex
      ) => {
        const statement =
          asRecord(rawStatement);

        const answerKey =
          normalizeAnswerKey(
            statement.id ??
              statement.statementId ??
              statement.key
          ) ||
          ANSWER_KEYS[statementIndex];

        if (!answerKey) {
          return;
        }

        const correctValue =
          statement.correctAnswer ??
          statement.correct ??
          statement.answer ??
          statement.isCorrect;

        const normalizedValue =
          normalizeTrueFalseAnswer({
            [answerKey]:
              correctValue,
          })[answerKey];

        if (typeof normalizedValue === "boolean") {
          answer[answerKey] =
            normalizedValue;
        }
      }
    );

  return answer;
}

function normalizeCorrectTrueFalseAnswer(
  question: Record<string, unknown>
): ExamTrueFalseAnswer {
  const snapshot =
    asRecord(question.snapshot);
  const source =
    Object.keys(snapshot).length > 0
      ? {
          ...question,
          ...snapshot,
        }
      : question;

  const directAnswer =
    normalizeTrueFalseAnswer(
      source.correctAnswer ??
        source.correctAnswers ??
        source.answer ??
        source.correct
    );

  if (
    Object.keys(directAnswer).length >
    0
  ) {
    return directAnswer;
  }

  return normalizeCorrectTrueFalseFromStatements(
    source
  );
}

function normalizeShortAnswerAcceptedAnswers(
  question: Record<string, unknown>
): string[] {
  const candidates: unknown[] = [];

  if (
    Array.isArray(
      question.acceptedAnswers
    )
  ) {
    candidates.push(
      ...question.acceptedAnswers
    );
  }

  if (
    Array.isArray(
      question.correctAnswers
    )
  ) {
    candidates.push(
      ...question.correctAnswers
    );
  }

  candidates.push(
    question.correctAnswer,
    question.answer,
    question.correct
  );

  return normalizeAcceptedAnswers(
    candidates
  );
}

function buildBaseQuestion(params: {
  question: Record<string, unknown>;
  questionId: string;
  questionType: ExamQuestionType;
  questionNumber: number;
  sectionId: string;
  sectionTitle: string;
  defaultQuestionScore: number;
}): GradingQuestionBase {
  const {
    question,
    questionId,
    questionType,
    questionNumber,
    sectionId,
    sectionTitle,
    defaultQuestionScore,
  } = params;

  const snapshot =
    asRecord(question.snapshot);
  const source =
    Object.keys(snapshot).length > 0
      ? {
          ...question,
          ...snapshot,
        }
      : question;

  return {
    id: questionId,

    type: questionType,

    questionNumber,

    sectionId,

    sectionTitle,

    score: normalizeQuestionScore(
      question.score ??
        question.points ??
        source.score ??
        source.points,
      defaultQuestionScore
    ),
  };
}

export function buildGradingQuestions(
  assignment: Record<string, unknown>,
  defaultQuestionScore = 0
): GradingQuestion[] {
  const testSnapshot = asRecord(
    assignment.testSnapshot
  );

  if (
    !Array.isArray(
      testSnapshot.sections
    )
  ) {
    throw new SnapshotError(
      "Bản đề đã xuất bản không có dữ liệu sections."
    );
  }

  const questions: GradingQuestion[] =
    [];

  const usedQuestionIds =
    new Set<string>();

  let globalQuestionNumber = 1;

  testSnapshot.sections.forEach(
    (
      rawSection,
      sectionIndex
    ) => {
      const section =
        asRecord(rawSection);

      const sectionId =
        safeString(
          section.id ??
            section.sectionId
        ) ||
        `part_${sectionIndex + 1}`;

      const sectionTitle =
        safeString(
          section.title ??
            section.sectionTitle ??
            section.name
        ) ||
        `Phần ${sectionIndex + 1}`;

      const sectionType =
        section.type;

      const sectionQuestions =
        Array.isArray(
          section.questions
        )
          ? section.questions
          : [];

      sectionQuestions.forEach(
        (
          rawQuestion,
          questionIndex
        ) => {
          const question =
            asRecord(rawQuestion);

          const snapshot =
            asRecord(question.snapshot);

          const questionContent =
            Object.keys(snapshot).length > 0
              ? snapshot
              : question;

          const questionType =
            normalizeQuestionType(
              questionContent.type ??
                questionContent.questionType ??
                question.type ??
                question.questionType,
              sectionType,
              sectionTitle
            );

          if (!questionType) {
            throw new SnapshotError(
              `Câu hỏi ${
                questionIndex + 1
              } trong "${sectionTitle}" chưa có loại hợp lệ.`
            );
          }

          const baseQuestionId =
            buildQuestionId(
              question,
              sectionId,
              questionIndex
            );

          const questionId =
            ensureUniqueQuestionId(
              baseQuestionId,
              usedQuestionIds
            );

          const questionNumber =
            Math.max(
              1,
              Math.floor(
                safeNumber(
                  question.questionNumber,
                  globalQuestionNumber
                )
              )
            );

          const baseQuestion =
            buildBaseQuestion({
              question,
              questionId,
              questionType,
              questionNumber,
              sectionId,
              sectionTitle,
              defaultQuestionScore,
            });

          switch (questionType) {
            case "single_choice": {
              questions.push({
                ...baseQuestion,

                type:
                  "single_choice",

                correctAnswer:
                  normalizeCorrectSingleChoiceAnswer(
                    question
                  ),
              });

              break;
            }

            case "true_false_group": {
              questions.push({
                ...baseQuestion,

                type:
                  "true_false_group",

                correctAnswer:
                  normalizeCorrectTrueFalseAnswer(
                    question
                  ),
              });

              break;
            }

            case "short_answer": {
              questions.push({
                ...baseQuestion,

                type:
                  "short_answer",

                acceptedAnswers:
                  normalizeShortAnswerAcceptedAnswers(
                    question
                  ),

                caseSensitive:
                  question.caseSensitive ===
                  true,
              });

              break;
            }
          }

          globalQuestionNumber += 1;
        }
      );
    }
  );

  if (questions.length === 0) {
    throw new SnapshotError(
      "Đề kiểm tra chưa có câu hỏi."
    );
  }

  return questions;
}

export function countSnapshotQuestions(
  assignment: Record<string, unknown>
): number {
  const testSnapshot = asRecord(
    assignment.testSnapshot
  );

  if (
    !Array.isArray(
      testSnapshot.sections
    )
  ) {
    return 0;
  }

  return testSnapshot.sections.reduce(
    (
      total,
      rawSection
    ) => {
      const section =
        asRecord(rawSection);

      const sectionQuestions =
        Array.isArray(
          section.questions
        )
          ? section.questions
          : [];

      return (
        total +
        sectionQuestions.length
      );
    },
    0
  );
}
