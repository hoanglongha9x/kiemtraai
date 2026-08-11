import type {
  QuestionContentBlock,
} from "@/types/question-content";

export type {
  QuestionContentBlock,
  QuestionImageBlock,
  QuestionTableBlock,
  QuestionTableCell,
  QuestionTableRow,
  QuestionTextBlock,
} from "@/types/question-content";

export type QuestionDifficulty =
  | "easy"
  | "medium"
  | "hard";

export type QuestionType =
  | "single_choice"
  | "true_false_group"
  | "short_answer";

export type CognitiveLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

export type QuestionOptionId =
  | "A"
  | "B"
  | "C"
  | "D";

export type QuestionOption = {
  id: QuestionOptionId;
  content: string;
  imageId?: string;
  imageUrl?: string;
};

export type TrueFalseStatement = {
  id: QuestionOptionId;
  content: string;
  correctAnswer: boolean;
  imageId?: string;
  imageUrl?: string;
};

export type BaseQuestionData = {
  id: string;

  content: string;

  contentBlocks?:
    QuestionContentBlock[];

  questionImageId?: string;
  questionImageUrl?: string;

  subject: string;
  grade: string;
  topic?: string;
  knowledgeUnit?: string;
  skill?: string;
  learningOutcome?: string;
  explanation?: string;

  difficulty: QuestionDifficulty;
  cognitiveLevel: CognitiveLevel;

  tags?: string[];

  updatedAt: string;
};

export type SingleChoiceQuestionData =
  BaseQuestionData & {
    type: "single_choice";

    options: QuestionOption[];

    correctOptionId: QuestionOptionId;
  };

export type TrueFalseGroupQuestionData =
  BaseQuestionData & {
    type: "true_false_group";

    statements: TrueFalseStatement[];
  };

export type ShortAnswerQuestionData =
  BaseQuestionData & {
    type: "short_answer";

    acceptedAnswers: string[];

    caseSensitive: boolean;
    trimWhitespace: boolean;

  };

export type QuestionCardData =
  | SingleChoiceQuestionData
  | TrueFalseGroupQuestionData
  | ShortAnswerQuestionData;
