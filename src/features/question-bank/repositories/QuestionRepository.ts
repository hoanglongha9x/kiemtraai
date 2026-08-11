import type {
  QuestionCardData,
  ShortAnswerQuestionData,
  SingleChoiceQuestionData,
  TrueFalseGroupQuestionData,
} from "@/components/question-bank";

export type CreateSingleChoiceQuestionInput =
  Omit<
    SingleChoiceQuestionData,
    "id"
  >;

export type CreateTrueFalseQuestionInput =
  Omit<
    TrueFalseGroupQuestionData,
    "id"
  >;

export type CreateShortAnswerQuestionInput =
  Omit<
    ShortAnswerQuestionData,
    "id"
  >;

export type CreateQuestionInput =
  | CreateSingleChoiceQuestionInput
  | CreateTrueFalseQuestionInput
  | CreateShortAnswerQuestionInput;

export type QuestionSort =
  | "newest"
  | "oldest";

export type QuestionTypeFilter =
  | QuestionCardData["type"]
  | "all";

export type QuestionDifficultyFilter =
  | QuestionCardData["difficulty"]
  | "all";

export type QuestionGradeFilter =
  | string
  | "all";

export type QuestionPageDirection =
  | "initial"
  | "next"
  | "previous";

export type QuestionCursor = {
  id: string;
} | null;

export type QuestionQueryOptions = {
  pageSize: number;

  type: QuestionTypeFilter;

  difficulty:
    QuestionDifficultyFilter;

  grade: QuestionGradeFilter;

  sort: QuestionSort;

  direction?:
    QuestionPageDirection;

  cursor?: QuestionCursor;
};

export type QuestionPageResult = {
  questions:
    QuestionCardData[];

  totalCount: number;

  firstCursor:
    QuestionCursor;

  lastCursor:
    QuestionCursor;

  hasNextPage: boolean;
};

export type QuestionSearchOptions = {
  search: string;

  type: QuestionTypeFilter;

  difficulty:
    QuestionDifficultyFilter;

  grade: QuestionGradeFilter;

  sort: QuestionSort;
};

export interface QuestionRepository {
  getAll(): Promise<
    QuestionCardData[]
  >;

  getPage(
    options:
      QuestionQueryOptions
  ): Promise<
    QuestionPageResult
  >;

  search(
    options:
      QuestionSearchOptions
  ): Promise<
    QuestionCardData[]
  >;

  create(
    question:
      CreateQuestionInput
  ): Promise<
    QuestionCardData
  >;

  createMany(
    questions:
      CreateQuestionInput[]
  ): Promise<
    QuestionCardData[]
  >;

  update(
    question:
      QuestionCardData
  ): Promise<
    QuestionCardData
  >;

  duplicate(
    questionId: string
  ): Promise<
    QuestionCardData
  >;

  duplicateMany(
    questionIds: string[]
  ): Promise<
    QuestionCardData[]
  >;

  delete(
    questionId: string
  ): Promise<void>;

  deleteMany(
    questionIds: string[]
  ): Promise<void>;

  reset(): Promise<
    QuestionCardData[]
  >;
}