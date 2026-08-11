export type AnswerKey = "A" | "B" | "C" | "D";

export type QuestionType =
  | "single_choice"
  | "true_false_group"
  | "short_answer";

export type TestSection =
  | "part_1"
  | "part_2"
  | "part_3";

export type CognitiveLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

export type Difficulty =
  | "easy"
  | "medium"
  | "hard";

export type TrueFalseLabel =
  | "a"
  | "b"
  | "c"
  | "d";

export type TrueFalseStatementDraft = {
  id: string;
  label: TrueFalseLabel;

  statement: string;

  statementImageId: string;
  statementImageUrl: string;

  correct: boolean;
};

export type TestQuestionDraft = {
  id: string;
  bankQuestionId: string;

  questionType: QuestionType;
  section: TestSection;

  question: string;

  questionImageId: string;
  questionImageUrl: string;

  A: string;
  AImageId: string;
  AImageUrl: string;

  B: string;
  BImageId: string;
  BImageUrl: string;

  C: string;
  CImageId: string;
  CImageUrl: string;

  D: string;
  DImageId: string;
  DImageUrl: string;

  /**
   * Chỉ được sử dụng khi questionType là single_choice.
   * Vẫn giữ giá trị mặc định để schema form thống nhất.
   */
  correct: AnswerKey;

  /**
   * Chỉ được sử dụng khi questionType là true_false_group.
   */
  statements: TrueFalseStatementDraft[];

  /**
   * Chỉ được sử dụng khi questionType là short_answer.
   */
  expectedAnswer: string;
  acceptedAnswers: string[];
  answerTolerance: number;

  explanation: string;

  topic: string;
  knowledgeUnit: string;
  skill: string;
  learningOutcome: string;

  cognitiveLevel: CognitiveLevel;
  difficulty: Difficulty;

  score: number;
  tags: string[];
};