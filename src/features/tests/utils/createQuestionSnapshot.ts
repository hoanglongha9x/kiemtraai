import type {
  QuestionCardData,
} from "@/components/question-bank/types";

import type {
  CreateQuestionSnapshotOptions,
  TestQuestionSnapshot,
} from "../types";

function cleanOptionalString(
  value: string | undefined
): string | undefined {
  const normalized =
    value?.trim();

  return normalized
    ? normalized
    : undefined;
}

function cleanTags(
  tags: string[] | undefined
): string[] | undefined {
  if (!tags) {
    return undefined;
  }

  const normalizedTags =
    Array.from(
      new Set(
        tags
          .map((tag) =>
            tag.trim()
          )
          .filter(Boolean)
      )
    );

  return normalizedTags.length >
    0
    ? normalizedTags
    : undefined;
}

export function createQuestionSnapshot(
  question:
    QuestionCardData,

  options:
    CreateQuestionSnapshotOptions =
      {}
): TestQuestionSnapshot {
  const snapshotCreatedAt =
    options.snapshotCreatedAt ??
    new Date().toISOString();

  const source =
    options.source ??
    "question_bank";

  const commonSnapshot = {
    originalQuestionId:
      question.id,

    content:
      question.content.trim(),

    contentBlocks:
      question.contentBlocks,

    questionImageId:
      cleanOptionalString(
        question.questionImageId
      ),

    questionImageUrl:
      cleanOptionalString(
        question.questionImageUrl
      ),

    subject:
      question.subject.trim(),

    grade:
      question.grade.trim(),

    topic:
      cleanOptionalString(
        question.topic
      ),

    knowledgeUnit:
      cleanOptionalString(
        question.knowledgeUnit
      ),

    skill:
      cleanOptionalString(
        question.skill
      ),

    learningOutcome:
      cleanOptionalString(
        question.learningOutcome
      ),

    explanation:
      cleanOptionalString(
        question.explanation
      ),

    difficulty:
      question.difficulty,

    cognitiveLevel:
      question.cognitiveLevel,

    tags:
      cleanTags(
        question.tags
      ),

    source,

    originalUpdatedAt:
      question.updatedAt,

    snapshotCreatedAt,
  };

  if (
    question.type ===
    "single_choice"
  ) {
    return {
      ...commonSnapshot,

      type:
        "single_choice",

      options:
        question.options.map(
          (option) => ({
            ...option,
          })
        ),

      correctOptionId:
        question.correctOptionId,
    };
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    return {
      ...commonSnapshot,

      type:
        "true_false_group",

      statements:
        question.statements.map(
          (statement) => ({
            ...statement,
          })
        ),
    };
  }

  return {
    ...commonSnapshot,

    type:
      "short_answer",

    acceptedAnswers:
      [
        ...question.acceptedAnswers,
      ],

    caseSensitive:
      question.caseSensitive,

    trimWhitespace:
      question.trimWhitespace,

  };
}
