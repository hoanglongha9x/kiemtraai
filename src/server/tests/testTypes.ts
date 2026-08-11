export type AnswerKey =
  | "A"
  | "B"
  | "C"
  | "D";

export type QuestionType =
  | "single_choice"
  | "true_false_group"
  | "short_answer";

export type TestSectionId =
  | "part_1"
  | "part_2"
  | "part_3";

export type CognitiveLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

export type QuestionDifficulty =
  | "easy"
  | "medium"
  | "hard";

export type TestVisibility =
  | "private"
  | "school"
  | "public";

export type TestStatus =
  | "draft"
  | "published"
  | "archived";

export type TestOwner = {
  uid: string;

  email: string;

  name: string;

  schoolId: string;
};

export type TestVersion = {
  number: number;

  status:
    | "draft"
    | "published";

  createdAt: string;

  updatedAt: string;

  publishedAt?: string;
};

export type TestSettings = {
  shuffleQuestions: boolean;

  shuffleOptions: boolean;

  allowBackNavigation: boolean;

  showQuestionNumbers: boolean;

  showProgress: boolean;

  autosaveAnswers: boolean;
};

export type TrueFalseStatementInput = {
  id?: string;

  label?: string;

  statement?: string;

  text?: string;

  content?: string;

  statementImageId?: string;

  statementImageUrl?: string;

  correct?:
    | boolean
    | string
    | number;
};

export type QuestionInput = {
  id?: string;

  bankQuestionId?: string;

  questionType?:
    | QuestionType
    | string;

  type?:
    | QuestionType
    | string;

  section?:
    | TestSectionId
    | string;

  question?: string;

  content?: string;

  text?: string;

  questionImageId?: string;

  questionImageUrl?: string;

  A?: string;

  AImageId?: string;

  AImageUrl?: string;

  B?: string;

  BImageId?: string;

  BImageUrl?: string;

  C?: string;

  CImageId?: string;

  CImageUrl?: string;

  D?: string;

  DImageId?: string;

  DImageUrl?: string;

  correct?:
    | AnswerKey
    | string;

  statements?:
    TrueFalseStatementInput[];

  expectedAnswer?:
    | string
    | number;

  acceptedAnswers?: unknown[];

  answerTolerance?:
    | string
    | number;

  explanation?: string;

  topic?: string;

  knowledgeUnit?: string;

  skill?: string;

  learningOutcome?: string;

  cognitiveLevel?:
    | CognitiveLevel
    | string;

  difficulty?:
    | QuestionDifficulty
    | string;

  score?:
    | string
    | number;

  tags?: unknown;
};

export type NormalizedTrueFalseStatement = {
  id: string;

  label:
    | "a"
    | "b"
    | "c"
    | "d";

  statement: string;

  statementImageId: string;

  statementImageUrl: string;

  correct: boolean;
};

export type NormalizedQuestion = {
  id: string;

  bankQuestionId: string;

  questionType:
    QuestionType;

  section:
    TestSectionId;

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

  correct:
    | AnswerKey
    | "";

  statements:
    NormalizedTrueFalseStatement[];

  expectedAnswer: string;

  acceptedAnswers: string[];

  answerTolerance: number;

  explanation: string;

  topic: string;

  knowledgeUnit: string;

  skill: string;

  learningOutcome: string;

  cognitiveLevel:
    CognitiveLevel;

  difficulty:
    QuestionDifficulty;

  score: number;

  tags: string[];

  subject: string;

  grade: string;
};

export type TestMetadata = {
  subject: string;

  grade: string;

  topics: string[];

  tags: string[];
};

export type TestSection = {
  id: TestSectionId;

  title: string;

  instructions: string;

  questions:
    NormalizedQuestion[];
};

export type TeacherTestDocument = {
  id: string;

  title: string;

  description: string;

  instructions: string;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  status: TestStatus;

  visibility:
    TestVisibility;

  owner: TestOwner;

  metadata:
    TestMetadata;

  sections:
    TestSection[];

  settings:
    TestSettings;

  version:
    TestVersion;

  source: string;

  createdAt: string;

  updatedAt: string;

  publishedAt?: string;

  teacherEmail?: string;

  teacherName?: string;

  schoolId?: string;
};

export type QuestionTypeCounts =
  Record<
    QuestionType,
    number
  >;

export type SectionCounts =
  Record<
    TestSectionId,
    number
  >;

  export type PublishedTestQuestion =
  NormalizedQuestion & {
    questionNumber: number;

    createdAt?: string;

    updatedAt?: string;
  };

export type PublishedTestSection = {
  id: TestSectionId;

  title: string;

  instructions: string;

  questions:
    PublishedTestQuestion[];
};

export type PublishedTestSnapshot = {
  snapshotId: string;

  testId: string;

  title: string;

  description: string;

  instructions: string;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  maxAttempts: number;

  visibility:
    TestVisibility;

  owner:
    TestOwner;

  metadata:
    TestMetadata;

  sections:
    PublishedTestSection[];

  settings:
    TestSettings;

  versionNumber: number;

  schemaVersion: number;

  publishedAt: string;
};