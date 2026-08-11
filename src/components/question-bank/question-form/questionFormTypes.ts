import type {
  QuestionCardData,
} from "../types";

import type {
  QuestionContentBlock,
} from "@/types/question-content";

import type {
  CognitiveLevel,
  QuestionDifficulty,
  QuestionOptionId,
  QuestionType,
} from "../types";

export type QuestionFormValues = {
  type: QuestionType;

  content: string;

  contentBlocks:
    QuestionContentBlock[];

  questionImageId: string;
  questionImageUrl: string;

  subject: string;
  grade: string;
  topic: string;
  knowledgeUnit: string;
  skill: string;
  learningOutcome: string;

  difficulty: QuestionDifficulty;
  cognitiveLevel: CognitiveLevel;

  tags: string;

  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;

  optionAImageId: string;
  optionAImageUrl: string;
  optionBImageId: string;
  optionBImageUrl: string;
  optionCImageId: string;
  optionCImageUrl: string;
  optionDImageId: string;
  optionDImageUrl: string;

  correctOptionId: QuestionOptionId;

  statementA: string;
  statementB: string;
  statementC: string;
  statementD: string;

  statementAImageId: string;
  statementAImageUrl: string;
  statementBImageId: string;
  statementBImageUrl: string;
  statementCImageId: string;
  statementCImageUrl: string;
  statementDImageId: string;
  statementDImageUrl: string;

  statementAAnswer: boolean;
  statementBAnswer: boolean;
  statementCAnswer: boolean;
  statementDAnswer: boolean;

  acceptedAnswers: string;

  caseSensitive: boolean;
  trimWhitespace: boolean;

  explanation: string;
};

export type QuestionFormErrors = Partial<
  Record<
    keyof QuestionFormValues,
    string
  >
>;

export type QuestionFormUpdateField = <
  Field extends keyof QuestionFormValues,
>(
  field: Field,
  value: QuestionFormValues[Field]
) => void;

export type QuestionFormModalProps = {
  open: boolean;

  question:
    | QuestionCardData
    | null;

  submitting?: boolean;

  defaultType?: QuestionType;
  defaultSubject?: string;
  defaultGrade?: string;

  onRequestClose: (
    hasUnsavedChanges: boolean
  ) => void;

  onSubmit: (
    values: QuestionFormValues
  ) => void | Promise<void>;
};

export type TextOptionField =
  | "optionA"
  | "optionB"
  | "optionC"
  | "optionD";

export type StatementContentField =
  | "statementA"
  | "statementB"
  | "statementC"
  | "statementD";

export type StatementAnswerField =
  | "statementAAnswer"
  | "statementBAnswer"
  | "statementCAnswer"
  | "statementDAnswer";
