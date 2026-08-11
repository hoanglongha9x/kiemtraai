import {
  DEFAULT_TEACHER_SETTINGS,
} from "@/features/teacher-settings/constants";

import type {
  TeacherSettings,
} from "@/features/teacher-settings/types";

import type {
  CognitiveLevel,
  QuestionCardData,
  QuestionOptionId,
} from "../types";

import type {
  QuestionFormValues,
} from "./questionFormTypes";

export function createEmptyFormValues(
  settings:
    TeacherSettings =
      DEFAULT_TEACHER_SETTINGS
): QuestionFormValues {
  return {
    type:
      settings.defaultQuestionType,

    content: "",

    contentBlocks: [],

    questionImageId: "",
    questionImageUrl: "",

    subject:
      settings.defaultSubject,

    grade: "10",

    topic: "",

    knowledgeUnit: "",
    skill: "",
    learningOutcome: "",

    difficulty:
      settings.defaultDifficulty,

    cognitiveLevel:
      settings.defaultCognitiveLevel,

    tags: "",

    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",

    optionAImageId: "",
    optionAImageUrl: "",
    optionBImageId: "",
    optionBImageUrl: "",
    optionCImageId: "",
    optionCImageUrl: "",
    optionDImageId: "",
    optionDImageUrl: "",

    correctOptionId: "A",

    statementA: "",
    statementB: "",
    statementC: "",
    statementD: "",

    statementAImageId: "",
    statementAImageUrl: "",
    statementBImageId: "",
    statementBImageUrl: "",
    statementCImageId: "",
    statementCImageUrl: "",
    statementDImageId: "",
    statementDImageUrl: "",

    statementAAnswer: true,
    statementBAnswer: true,
    statementCAnswer: true,
    statementDAnswer: true,

    acceptedAnswers: "",

    caseSensitive: false,
    trimWhitespace: true,

    explanation: "",
  };
}

function normalizeCognitiveLevel(
  value: unknown
): CognitiveLevel {
  switch (value) {
    case "recognition":
    case "understanding":
    case "application":
    case "high_application":
      return value;

    default:
      return "recognition";
  }
}

function getOptionContent(
  question:
    QuestionCardData,
  optionId:
    QuestionOptionId
): string {
  if (
    question.type !==
    "single_choice"
  ) {
    return "";
  }

  return (
    question.options.find(
      (
        option
      ) =>
        option.id ===
        optionId
    )?.content ?? ""
  );
}

function getOption(
  question: QuestionCardData,
  optionId: QuestionOptionId
) {
  return question.type ===
    "single_choice"
    ? question.options.find(
        (option) =>
          option.id === optionId
      ) ?? null
    : null;
}

function getStatement(
  question:
    QuestionCardData,
  statementId:
    QuestionOptionId
) {
  if (
    question.type !==
    "true_false_group"
  ) {
    return null;
  }

  return (
    question.statements.find(
      (
        statement
      ) =>
        statement.id ===
        statementId
    ) ?? null
  );
}

export function createFormValues(
  question:
    | QuestionCardData
    | null,

  settings:
    TeacherSettings =
      DEFAULT_TEACHER_SETTINGS
): QuestionFormValues {
  const emptyValues =
    createEmptyFormValues(
      settings
    );

  if (
    !question
  ) {
    return emptyValues;
  }

  const commonValues: Pick<
    QuestionFormValues,
    | "content"
    | "contentBlocks"
    | "questionImageId"
    | "questionImageUrl"
    | "subject"
    | "grade"
    | "topic"
    | "knowledgeUnit"
    | "skill"
    | "learningOutcome"
    | "explanation"
    | "difficulty"
    | "cognitiveLevel"
    | "tags"
  > = {
    content:
      question.content,

    contentBlocks:
      question.contentBlocks
        ? [
            ...question.contentBlocks,
          ]
        : [],

    questionImageId:
      question.questionImageId ??
      "",

    questionImageUrl:
      question.questionImageUrl ??
      "",

    subject:
      question.subject,

    grade:
      question.grade,

    topic:
      question.topic ??
      "",

    knowledgeUnit:
      question.knowledgeUnit ??
      "",

    skill:
      question.skill ??
      "",

    learningOutcome:
      question.learningOutcome ??
      "",

    explanation:
      question.explanation ??
      "",

    difficulty:
      question.difficulty,

    cognitiveLevel:
      normalizeCognitiveLevel(
        question.cognitiveLevel
      ),

    tags:
      question.tags?.join(
        ", "
      ) ?? "",
  };

  if (
    question.type ===
    "single_choice"
  ) {
    const optionA =
      getOption(question, "A");
    const optionB =
      getOption(question, "B");
    const optionC =
      getOption(question, "C");
    const optionD =
      getOption(question, "D");

    return {
      ...emptyValues,
      ...commonValues,

      type:
        "single_choice",

      optionA:
        getOptionContent(
          question,
          "A"
        ),

      optionB:
        getOptionContent(
          question,
          "B"
        ),

      optionC:
        getOptionContent(
          question,
          "C"
        ),

      optionD:
        getOptionContent(
          question,
          "D"
        ),

      optionAImageId:
        optionA?.imageId ?? "",
      optionAImageUrl:
        optionA?.imageUrl ?? "",
      optionBImageId:
        optionB?.imageId ?? "",
      optionBImageUrl:
        optionB?.imageUrl ?? "",
      optionCImageId:
        optionC?.imageId ?? "",
      optionCImageUrl:
        optionC?.imageUrl ?? "",
      optionDImageId:
        optionD?.imageId ?? "",
      optionDImageUrl:
        optionD?.imageUrl ?? "",

      correctOptionId:
        question.correctOptionId,
    };
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    const statementA =
      getStatement(
        question,
        "A"
      );

    const statementB =
      getStatement(
        question,
        "B"
      );

    const statementC =
      getStatement(
        question,
        "C"
      );

    const statementD =
      getStatement(
        question,
        "D"
      );

    return {
      ...emptyValues,
      ...commonValues,

      type:
        "true_false_group",

      statementA:
        statementA?.content ??
        "",

      statementB:
        statementB?.content ??
        "",

      statementC:
        statementC?.content ??
        "",

      statementD:
        statementD?.content ??
        "",

      statementAImageId:
        statementA?.imageId ?? "",
      statementAImageUrl:
        statementA?.imageUrl ?? "",
      statementBImageId:
        statementB?.imageId ?? "",
      statementBImageUrl:
        statementB?.imageUrl ?? "",
      statementCImageId:
        statementC?.imageId ?? "",
      statementCImageUrl:
        statementC?.imageUrl ?? "",
      statementDImageId:
        statementD?.imageId ?? "",
      statementDImageUrl:
        statementD?.imageUrl ?? "",

      statementAAnswer:
        statementA?.correctAnswer ??
        true,

      statementBAnswer:
        statementB?.correctAnswer ??
        true,

      statementCAnswer:
        statementC?.correctAnswer ??
        true,

      statementDAnswer:
        statementD?.correctAnswer ??
        true,
    };
  }

  return {
    ...emptyValues,
    ...commonValues,

    type:
      "short_answer",

    acceptedAnswers:
      question.acceptedAnswers.join(
        ", "
      ),

    caseSensitive:
      question.caseSensitive,

    trimWhitespace:
      question.trimWhitespace,

  };
}
