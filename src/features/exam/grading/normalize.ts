import type {
  ExamAnswerKey,
  ExamAnswers,
  ExamStudentAnswer,
  ExamTrueFalseAnswer,
} from "@/features/exam/types";

import {
  asRecord,
  normalizeAnswerKey,
  safeString,
} from "@/features/exam/utils";

import type {
  GradingQuestion,
  NormalizeAnswersInput,
} from "./types";

const ANSWER_KEYS: ExamAnswerKey[] = [
  "A",
  "B",
  "C",
  "D",
];

function normalizeTrueFalseValue(
  value: unknown
): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }

  const text = safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .trim();

  if (
    text === "true" ||
    text === "1" ||
    text === "yes" ||
    text === "y" ||
    text === "dung"
  ) {
    return true;
  }

  if (
    text === "false" ||
    text === "0" ||
    text === "no" ||
    text === "n" ||
    text === "sai"
  ) {
    return false;
  }

  return undefined;
}

export function normalizeTrueFalseAnswer(
  value: unknown
): ExamTrueFalseAnswer {
  if (Array.isArray(value)) {
    const normalized: ExamTrueFalseAnswer = {};

    value
      .slice(0, ANSWER_KEYS.length)
      .forEach((rawValue, index) => {
        const answerKey = ANSWER_KEYS[index];
        const normalizedValue =
          normalizeTrueFalseValue(rawValue);

        if (
          answerKey &&
          typeof normalizedValue === "boolean"
        ) {
          normalized[answerKey] =
            normalizedValue;
        }
      });

    return normalized;
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return {};
  }

  const record = asRecord(value);
  const normalized: ExamTrueFalseAnswer = {};

  ANSWER_KEYS.forEach((answerKey) => {
    const rawValue =
      record[answerKey] ??
      record[answerKey.toLowerCase()];

    const normalizedValue =
      normalizeTrueFalseValue(rawValue);

    if (
      typeof normalizedValue === "boolean"
    ) {
      normalized[answerKey] =
        normalizedValue;
    }
  });

  return normalized;
}

export function normalizeSingleChoiceAnswer(
  value: unknown
): ExamAnswerKey | "" {
  return normalizeAnswerKey(value);
}

export function normalizeShortAnswer(
  value: unknown
): string {
  return safeString(value);
}

export function normalizeStudentAnswer(
  question: GradingQuestion,
  value: unknown
): ExamStudentAnswer | null {
  switch (question.type) {
    case "single_choice": {
      const answer =
        normalizeSingleChoiceAnswer(value);

      return answer || null;
    }

    case "true_false_group": {
      const answer =
        normalizeTrueFalseAnswer(value);

      return Object.keys(answer).length > 0
        ? answer
        : null;
    }

    case "short_answer": {
      const answer =
        normalizeShortAnswer(value);

      return answer || null;
    }

    default:
      return null;
  }
}

export function normalizeExamAnswers({
  value,
  questions,
}: NormalizeAnswersInput): ExamAnswers {
  const rawAnswers = asRecord(value);
  const normalizedAnswers: ExamAnswers = {};

  questions.forEach(
    (question: GradingQuestion) => {
      const answer = normalizeStudentAnswer(
        question,
        rawAnswers[question.id]
      );

      if (answer !== null) {
        normalizedAnswers[question.id] =
          answer;
      }
    }
  );

  return normalizedAnswers;
}

export function mergeExamAnswers(
  savedAnswers: ExamAnswers,
  requestAnswers: ExamAnswers
): ExamAnswers {
  return {
    ...savedAnswers,
    ...requestAnswers,
  };
}

export function removeUnknownAnswers(
  answers: ExamAnswers,
  questions: GradingQuestion[]
): ExamAnswers {
  const validQuestionIds = new Set(
    questions.map((question) => question.id)
  );

  const normalizedAnswers: ExamAnswers = {};

  Object.entries(answers).forEach(
    ([questionId, answer]) => {
      if (!validQuestionIds.has(questionId)) {
        return;
      }

      normalizedAnswers[questionId] =
        answer;
    }
  );

  return normalizedAnswers;
}

export function hasStudentAnswer(
  question: GradingQuestion,
  answer: ExamStudentAnswer | undefined
): boolean {
  if (
    answer === undefined ||
    answer === null
  ) {
    return false;
  }

  switch (question.type) {
    case "single_choice":
      return Boolean(
        normalizeSingleChoiceAnswer(answer)
      );

    case "true_false_group":
      return (
        Object.keys(
          normalizeTrueFalseAnswer(answer)
        ).length > 0
      );

    case "short_answer":
      return Boolean(
        normalizeShortAnswer(answer)
      );

    default:
      return false;
  }
}

export function normalizeTextForComparison(
  value: unknown,
  caseSensitive = false
): string {
  const normalized = safeString(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

  return caseSensitive
    ? normalized
    : normalized.toLocaleLowerCase();
}

export function normalizeAcceptedAnswers(
  value: unknown
): string[] {
  const candidates = Array.isArray(value)
    ? value
    : [value];

  return Array.from(
    new Set(
      candidates
        .map((item) => safeString(item))
        .filter(Boolean)
    )
  );
}

export function normalizeQuestionScore(
  value: unknown,
  fallback = 0
): number {
  const score = Number(value);

  if (
    !Number.isFinite(score) ||
    score < 0
  ) {
    return fallback;
  }

  return score;
}

export function roundGradingScore(
  value: number,
  digits = 4
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const safeDigits = Math.min(
    10,
    Math.max(
      0,
      Math.floor(digits)
    )
  );

  return Number(
    value.toFixed(safeDigits)
  );
}

export function countAnsweredStatements(
  answer: ExamTrueFalseAnswer
): number {
  return ANSWER_KEYS.reduce(
    (total, answerKey) => {
      return (
        total +
        (typeof answer[answerKey] ===
        "boolean"
          ? 1
          : 0)
      );
    },
    0
  );
}

export function getTrueFalseAnswerKeys(
  answer: ExamTrueFalseAnswer
): ExamAnswerKey[] {
  return ANSWER_KEYS.filter(
    (answerKey) =>
      typeof answer[answerKey] ===
      "boolean"
  );
}
