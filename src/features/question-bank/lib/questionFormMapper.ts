import type {
  QuestionFormValues,
} from "@/components/question-bank";

import type {
  CreateQuestionInput,
} from "../repositories";

import type {
  QuestionContentBlock,
} from "@/types/question-content";

function normalizeCommaSeparatedValues(
  value: string
): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeContentBlocks(
  content: string,
  blocks:
    QuestionContentBlock[]
): QuestionContentBlock[] |
  undefined {
  if (blocks.length === 0) {
    return undefined;
  }

  const originalText =
    blocks
      .filter(
        (block) =>
          block.type === "text"
      )
      .map((block) =>
        block.content.trim()
      )
      .filter(Boolean)
      .join("\n")
      .trim();

  if (
    originalText ===
    content.trim()
  ) {
    return blocks;
  }

  return [
    {
      type: "text",
      content:
        content.trim(),
    },
    ...blocks.filter(
      (block) =>
        block.type !== "text"
    ),
  ];
}

export function mapQuestionFormToCreateInput(
  values: QuestionFormValues
): CreateQuestionInput {
  const commonQuestionData = {
    content: values.content.trim(),
    contentBlocks:
      normalizeContentBlocks(
        values.content,
        values.contentBlocks
      ),
    questionImageId:
      values.questionImageId.trim() ||
      undefined,
    questionImageUrl:
      values.questionImageUrl.trim() ||
      undefined,
    subject: values.subject.trim(),
    grade: values.grade.trim(),
    topic:
      values.topic.trim() ||
      undefined,
    knowledgeUnit:
      values.knowledgeUnit.trim() ||
      undefined,
    skill:
      values.skill.trim() ||
      undefined,
    learningOutcome:
      values.learningOutcome.trim() ||
      undefined,
    explanation:
      values.explanation.trim() ||
      undefined,
    difficulty:
      values.difficulty,
    cognitiveLevel:
      values.cognitiveLevel,
    tags:
      normalizeCommaSeparatedValues(
        values.tags
      ),
    updatedAt:
      new Date().toISOString(),
  };

  if (
    values.type ===
    "single_choice"
  ) {
    return {
      ...commonQuestionData,
      type: "single_choice",
      options: [
        {
          id: "A",
          content:
            values.optionA.trim(),
          imageId:
            values.optionAImageId.trim() ||
            undefined,
          imageUrl:
            values.optionAImageUrl.trim() ||
            undefined,
        },
        {
          id: "B",
          content:
            values.optionB.trim(),
          imageId:
            values.optionBImageId.trim() ||
            undefined,
          imageUrl:
            values.optionBImageUrl.trim() ||
            undefined,
        },
        {
          id: "C",
          content:
            values.optionC.trim(),
          imageId:
            values.optionCImageId.trim() ||
            undefined,
          imageUrl:
            values.optionCImageUrl.trim() ||
            undefined,
        },
        {
          id: "D",
          content:
            values.optionD.trim(),
          imageId:
            values.optionDImageId.trim() ||
            undefined,
          imageUrl:
            values.optionDImageUrl.trim() ||
            undefined,
        },
      ],
      correctOptionId:
        values.correctOptionId,
    };
  }

  if (
    values.type ===
    "true_false_group"
  ) {
    return {
      ...commonQuestionData,
      type:
        "true_false_group",
      statements: [
        {
          id: "A",
          content:
            values.statementA.trim(),
          correctAnswer:
            values.statementAAnswer,
          imageId:
            values.statementAImageId.trim() ||
            undefined,
          imageUrl:
            values.statementAImageUrl.trim() ||
            undefined,
        },
        {
          id: "B",
          content:
            values.statementB.trim(),
          correctAnswer:
            values.statementBAnswer,
          imageId:
            values.statementBImageId.trim() ||
            undefined,
          imageUrl:
            values.statementBImageUrl.trim() ||
            undefined,
        },
        {
          id: "C",
          content:
            values.statementC.trim(),
          correctAnswer:
            values.statementCAnswer,
          imageId:
            values.statementCImageId.trim() ||
            undefined,
          imageUrl:
            values.statementCImageUrl.trim() ||
            undefined,
        },
        {
          id: "D",
          content:
            values.statementD.trim(),
          correctAnswer:
            values.statementDAnswer,
          imageId:
            values.statementDImageId.trim() ||
            undefined,
          imageUrl:
            values.statementDImageUrl.trim() ||
            undefined,
        },
      ],
    };
  }

  return {
    ...commonQuestionData,
    type: "short_answer",
    acceptedAnswers:
      normalizeCommaSeparatedValues(
        values.acceptedAnswers
      ),
    caseSensitive:
      values.caseSensitive,
    trimWhitespace:
      values.trimWhitespace,
  };
}
