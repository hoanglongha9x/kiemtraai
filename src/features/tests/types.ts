import type {
  CognitiveLevel,
  QuestionCardData,
  QuestionDifficulty,
  QuestionOption,
  QuestionOptionId,
  QuestionType,
  TrueFalseStatement,
} from "@/components/question-bank/types";

import type {
  QuestionContentBlock,
} from "@/types/question-content";

export type TestStatus =
  | "draft"
  | "published"
  | "archived"
  | "deleted";

export type TestVisibility =
  | "private"
  | "school"
  | "public";

export type TestSectionType =
  QuestionType;

export type TestQuestionSource =
  | "question_bank"
  | "manual"
  | "import"
  | "ai";

export type TestVersionStatus =
  | "draft"
  | "published";

export type TestValidationSeverity =
  | "error"
  | "warning";

export type TestValidationCode =
  | "missing_title"
  | "missing_subject"
  | "missing_grade"
  | "invalid_duration"
  | "missing_section"
  | "empty_section"
  | "missing_question"
  | "invalid_question_score"
  | "invalid_total_score"
  | "duplicate_question"
  | "section_type_mismatch"
  | "invalid_single_choice"
  | "invalid_true_false_group"
  | "invalid_short_answer"
  | "missing_learning_metadata";

export type TestQuestionBaseSnapshot = {
  originalQuestionId?: string;

  type: QuestionType;

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

  difficulty:
    QuestionDifficulty;

  cognitiveLevel:
    CognitiveLevel;

  tags?: string[];

  source:
    TestQuestionSource;

  originalUpdatedAt?: string;

  snapshotCreatedAt:
    string;
};

export type TestSingleChoiceQuestionSnapshot =
  TestQuestionBaseSnapshot & {
    type: "single_choice";

    options:
      QuestionOption[];

    correctOptionId:
      QuestionOptionId;
  };

export type TestTrueFalseGroupQuestionSnapshot =
  TestQuestionBaseSnapshot & {
    type:
      "true_false_group";

    statements:
      TrueFalseStatement[];
  };

export type TestShortAnswerQuestionSnapshot =
  TestQuestionBaseSnapshot & {
    type: "short_answer";

    acceptedAnswers:
      string[];

    caseSensitive:
      boolean;

    trimWhitespace:
      boolean;

    explanation?: string;
  };

export type TestQuestionSnapshot =
  | TestSingleChoiceQuestionSnapshot
  | TestTrueFalseGroupQuestionSnapshot
  | TestShortAnswerQuestionSnapshot;

export type TestQuestionItem = {
  id: string;

  questionBankId?: string;

  order: number;

  score: number;

  required: boolean;

  snapshot:
    TestQuestionSnapshot;
};

export type TestSection = {
  id: string;

  type:
    TestSectionType;

  title: string;

  description?: string;

  order: number;

  scorePerQuestion:
    number;

  questions:
    TestQuestionItem[];
};

export type TestSettings = {
  shuffleQuestions:
    boolean;

  shuffleOptions:
    boolean;

  allowBackNavigation:
    boolean;

  showQuestionNumbers:
    boolean;

  showProgress:
    boolean;

  autosaveAnswers:
    boolean;
};

export type TestMetadata = {
  subject: string;

  grade: string;

  topics: string[];

  tags: string[];
};

export type TestOwner = {
  uid: string;

  email: string;

  name?: string;

  schoolId?: string;
};

export type TestVersion = {
  number: number;

  status:
    TestVersionStatus;

  createdAt:
    string;

  publishedAt?: string;
};

export type TestData = {
  id: string;

  title: string;

  description?: string;

  instructions?: string;

  durationMinutes:
    number;

  status:
    TestStatus;

  visibility:
    TestVisibility;

  metadata:
    TestMetadata;

  sections:
    TestSection[];

  settings:
    TestSettings;

  owner:
    TestOwner;

  version:
    TestVersion;

  totalScore:
    number;

  totalQuestions:
    number;

  createdAt:
    string;

  updatedAt:
    string;

  publishedAt?: string;

  archivedAt?: string;
};

export type CreateTestInput =
  Omit<
    TestData,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "publishedAt"
    | "archivedAt"
  >;

export type UpdateTestInput =
  Partial<
    Omit<
      TestData,
      | "id"
      | "owner"
      | "createdAt"
    >
  > & {
    id: string;
  };

export type TestListItem = {
  id: string;

  title: string;

  description?: string;

  subject: string;

  grade: string;

  status:
    TestStatus;

  visibility:
    TestVisibility;

  durationMinutes:
    number;

  totalScore:
    number;

  totalQuestions:
    number;

  versionNumber:
    number;

  createdAt:
    string;

  updatedAt:
    string;

  publishedAt?: string;
};

export type TestSummary = {
  totalSections:
    number;

  totalQuestions:
    number;

  totalScore:
    number;

  questionCountByType:
    Record<
      QuestionType,
      number
    >;

  questionCountByDifficulty:
    Record<
      QuestionDifficulty,
      number
    >;

  questionCountByCognitiveLevel:
    Record<
      CognitiveLevel,
      number
    >;
};

export type TestValidationIssue = {
  code:
    TestValidationCode;

  severity:
    TestValidationSeverity;

  message:
    string;

  sectionId?: string;

  questionId?: string;
};

export type TestValidationResult = {
  valid: boolean;

  errors:
    TestValidationIssue[];

  warnings:
    TestValidationIssue[];

  issues:
    TestValidationIssue[];
};

export type CreateQuestionSnapshotOptions = {
  source?:
    TestQuestionSource;

  snapshotCreatedAt?:
    string;
};

export type TestSectionPreset = {
  type:
    TestSectionType;

  title:
    string;

  description:
    string;

  scorePerQuestion:
    number;
};

export type TestQuestionCardData =
  QuestionCardData;

export type TestListStatusFilter =
  | TestStatus
  | "all";

export type TestListVisibilityFilter =
  | TestVisibility
  | "all";

export type TestListSort =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc";

export type TestListFilters = {
  search: string;

  status:
    TestListStatusFilter;

  visibility:
    TestListVisibilityFilter;

  subject: string;

  grade: string;

  sort:
    TestListSort;
};

export type TestListCursor = {
  id: string;

  value:
    string | number;
};

export type ListTestsInput = {
  ownerUid: string;

  filters?:
    Partial<TestListFilters>;

  pageSize?: number;

  cursor?:
    TestListCursor | null;
};

export type ListTestsResult = {
  tests:
    TestListItem[];

  nextCursor:
    TestListCursor | null;

  hasNextPage:
    boolean;
};

export type DuplicateTestInput = {
  testId: string;

  owner:
    TestOwner;

  title?: string;
};

export type CreateDefaultTestInput = {
  owner: TestOwner;

  subject?: string;

  grade?: string;

  title?: string;

  includeDefaultSections?: boolean;
};

export type SaveTestInput = {
  test: TestData;

  validateBeforeSave?: boolean;
};

export type PublishTestInput = {
  testId: string;

  ownerUid: string;
};

export type TestServiceResult<T> = {
  data: T;

  message: string;
};

export type TestServiceErrorCode =
  | "unauthenticated"
  | "permission_denied"
  | "not_found"
  | "invalid_input"
  | "validation_failed"
  | "already_published"
  | "cannot_delete_published"
  | "network_error"
  | "firestore_error"
  | "unknown";

export type TestServiceErrorDetails = {
  code: TestServiceErrorCode;

  message: string;

  originalError?: unknown;

  validation?: TestValidationResult;
};

export type UseTestsOptions = {
  ownerUid?: string;

  initialFilters?:
    Partial<TestListFilters>;

  pageSize?: number;

  autoLoad?: boolean;
};

export type CreateTestFromHookInput = {
  owner: TestOwner;

  title?: string;

  subject?: string;

  grade?: string;

  includeDefaultSections?:
    boolean;
};

export type DuplicateTestFromHookInput = {
  testId: string;

  owner: TestOwner;

  title?: string;
};

export type UseTestsResult = {
  tests:
    TestListItem[];

  filters:
    TestListFilters;

  loading:
    boolean;

  loadingMore:
    boolean;

  mutating:
    boolean;

  initialized:
    boolean;

  error:
    string | null;

  hasNextPage:
    boolean;

  nextCursor:
    TestListCursor | null;

  selectedTestIds:
    string[];

  setFilters:
    (
      filters:
        Partial<TestListFilters>
    ) => void;

  resetFilters:
    () => void;

  setSearch:
    (
      search:
        string
    ) => void;

  setStatus:
    (
      status:
        TestListStatusFilter
    ) => void;

  setVisibility:
    (
      visibility:
        TestListVisibilityFilter
    ) => void;

  setSubject:
    (
      subject:
        string
    ) => void;

  setGrade:
    (
      grade:
        string
    ) => void;

  setSort:
    (
      sort:
        TestListSort
    ) => void;

  loadTests:
    () => Promise<void>;

  loadMore:
    () => Promise<void>;

  refresh:
    () => Promise<void>;

  createTest:
    (
      input:
        CreateTestFromHookInput
    ) => Promise<TestData | null>;

  duplicateTest:
    (
      input:
        DuplicateTestFromHookInput
    ) => Promise<TestData | null>;

  archiveTest:
    (
      testId:
        string
    ) => Promise<TestData | null>;

  restoreTest:
    (
      testId:
        string
    ) => Promise<TestData | null>;

  deleteTest:
    (
      testId:
        string
    ) => Promise<boolean>;

  toggleSelectedTest:
    (
      testId:
        string
    ) => void;

  selectAllVisible:
    () => void;

  clearSelection:
    () => void;

  isSelected:
    (
      testId:
        string
    ) => boolean;

  removeTestFromState:
    (
      testId:
        string
    ) => void;

  replaceTestInState:
    (
      test:
        TestListItem
    ) => void;
};
