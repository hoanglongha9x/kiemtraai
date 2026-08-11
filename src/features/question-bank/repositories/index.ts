import {
  FirestoreQuestionRepository,
} from "./FirestoreQuestionRepository";

export const questionRepository =
  new FirestoreQuestionRepository();

export type {
  CreateQuestionInput,
  CreateShortAnswerQuestionInput,
  CreateSingleChoiceQuestionInput,
  CreateTrueFalseQuestionInput,
  QuestionCursor,
  QuestionDifficultyFilter,
  QuestionGradeFilter,
  QuestionPageDirection,
  QuestionPageResult,
  QuestionQueryOptions,
  QuestionRepository,
  QuestionSearchOptions,
  QuestionSort,
  QuestionTypeFilter,
} from "./QuestionRepository";