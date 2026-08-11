import type {
  AnswerKey,
  CognitiveLevel,
  Difficulty,
  QuestionType,
  TestQuestionDraft,
  TestSection,
  TrueFalseLabel,
  TrueFalseStatementDraft,
} from "@/types/test-question";

const ANSWER_KEYS: AnswerKey[] = [
  "A",
  "B",
  "C",
  "D",
];

const TRUE_FALSE_LABELS: TrueFalseLabel[] = [
  "a",
  "b",
  "c",
  "d",
];

type UnknownRecord = Record<string, unknown>;

/**
 * Tạo ID dùng cho dữ liệu tạm trên trình duyệt.
 * Có fallback để tránh lỗi trong môi trường không hỗ trợ randomUUID.
 */
export function createClientId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `local_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Chuyển một giá trị bất kỳ thành chuỗi đã trim.
 */
export function safeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Chuẩn hóa đáp án A, B, C hoặc D.
 */
export function normalizeAnswerKey(
  value: unknown
): AnswerKey {
  const answer = safeText(value).toUpperCase();

  if (
    answer === "A" ||
    answer === "B" ||
    answer === "C" ||
    answer === "D"
  ) {
    return answer;
  }

  return "A";
}

/**
 * Chuẩn hóa loại câu hỏi từ dữ liệu API, AI hoặc dữ liệu cũ.
 */
export function normalizeQuestionType(
  value: unknown
): QuestionType {
  const questionType = safeText(value)
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    questionType === "true_false_group" ||
    questionType === "true-false-group" ||
    questionType === "true_false" ||
    questionType === "true-false" ||
    questionType === "truefalse"
  ) {
    return "true_false_group";
  }

  if (
    questionType === "short_answer" ||
    questionType === "short-answer" ||
    questionType === "shortanswer"
  ) {
    return "short_answer";
  }

  return "single_choice";
}

/**
 * Trả về phần thi mặc định theo loại câu hỏi.
 */
export function getDefaultSection(
  questionType: QuestionType
): TestSection {
  switch (questionType) {
    case "true_false_group":
      return "part_2";

    case "short_answer":
      return "part_3";

    case "single_choice":
    default:
      return "part_1";
  }
}

/**
 * Chuẩn hóa phần thi.
 */
export function normalizeSection(
  value: unknown,
  questionType: QuestionType = "single_choice"
): TestSection {
  const section = safeText(value).toLowerCase();

  if (
    section === "part_1" ||
    section === "part1" ||
    section === "part i" ||
    section === "phần i" ||
    section === "phan i" ||
    section === "1"
  ) {
    return "part_1";
  }

  if (
    section === "part_2" ||
    section === "part2" ||
    section === "part ii" ||
    section === "phần ii" ||
    section === "phan ii" ||
    section === "2"
  ) {
    return "part_2";
  }

  if (
    section === "part_3" ||
    section === "part3" ||
    section === "part iii" ||
    section === "phần iii" ||
    section === "phan iii" ||
    section === "3"
  ) {
    return "part_3";
  }

  return getDefaultSection(questionType);
}

/**
 * Điểm mặc định theo cấu trúc đề thi.
 */
export function getDefaultQuestionScore(
  questionType: QuestionType
): number {
  switch (questionType) {
    case "true_false_group":
      return 1;

    case "short_answer":
      return 0.5;

    case "single_choice":
    default:
      return 0.25;
  }
}

/**
 * Tạo bốn phát biểu a, b, c, d cho câu Đúng/Sai.
 */
export function createTrueFalseStatements():
  TrueFalseStatementDraft[] {
  return TRUE_FALSE_LABELS.map((label) => ({
    id: createClientId(),
    label,

    statement: "",

    statementImageId: "",
    statementImageUrl: "",

    correct: false,
  }));
}

/**
 * Tạo một câu hỏi mới.
 */
export function createQuestionDraft(
  questionType: QuestionType = "single_choice"
): TestQuestionDraft {
  return {
    id: createClientId(),
    bankQuestionId: "",

    questionType,
    section: getDefaultSection(questionType),

    question: "",

    questionImageId: "",
    questionImageUrl: "",

    A: "",
    AImageId: "",
    AImageUrl: "",

    B: "",
    BImageId: "",
    BImageUrl: "",

    C: "",
    CImageId: "",
    CImageUrl: "",

    D: "",
    DImageId: "",
    DImageUrl: "",

    correct: "A",

    statements:
      questionType === "true_false_group"
        ? createTrueFalseStatements()
        : [],

    expectedAnswer: "",
    acceptedAnswers: [],
    answerTolerance: 0,

    explanation: "",

    topic: "",
    knowledgeUnit: "",
    skill: "",
    learningOutcome: "",

    cognitiveLevel: "understanding",
    difficulty: "medium",

    score: getDefaultQuestionScore(questionType),
    tags: [],
  };
}

/**
 * Thay đổi loại câu hỏi nhưng không xóa dữ liệu đã nhập.
 *
 * Ví dụ:
 * - Giáo viên nhập A–D.
 * - Chuyển sang Đúng/Sai.
 * - Chuyển lại trắc nghiệm.
 *
 * Nội dung A–D vẫn được giữ lại.
 */
export function changeQuestionType(
  question: TestQuestionDraft,
  questionType: QuestionType
): TestQuestionDraft {
  if (question.questionType === questionType) {
    return question;
  }

  return {
    ...question,

    questionType,
    section: getDefaultSection(questionType),
    score: getDefaultQuestionScore(questionType),

    correct: normalizeAnswerKey(question.correct),

    statements:
      question.statements.length === 4
        ? normalizeStatements(question.statements)
        : createTrueFalseStatements(),

    expectedAnswer: safeText(
      question.expectedAnswer
    ),

    acceptedAnswers: normalizeStringArray(
      question.acceptedAnswers
    ),

    answerTolerance:
      Number.isFinite(question.answerTolerance) &&
      question.answerTolerance >= 0
        ? question.answerTolerance
        : 0,
  };
}

/**
 * Chuẩn hóa mức độ nhận thức.
 */
export function normalizeCognitiveLevel(
  value: unknown
): CognitiveLevel {
  const cognitiveLevel = safeText(value)
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    cognitiveLevel === "recognition" ||
    cognitiveLevel === "understanding" ||
    cognitiveLevel === "application" ||
    cognitiveLevel === "high_application"
  ) {
    return cognitiveLevel;
  }

  return "understanding";
}

/**
 * Chuẩn hóa độ khó.
 */
export function normalizeDifficulty(
  value: unknown
): Difficulty {
  const difficulty = safeText(value).toLowerCase();

  if (
    difficulty === "easy" ||
    difficulty === "medium" ||
    difficulty === "hard"
  ) {
    return difficulty;
  }

  return "medium";
}

/**
 * Chuẩn hóa chuỗi hoặc mảng chuỗi thành mảng không trùng lặp.
 */
export function normalizeStringArray(
  value: unknown
): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => safeText(item))
          .filter(Boolean)
      )
    );
  }

  const text = safeText(value);

  if (!text) {
    return [];
  }

  return Array.from(
    new Set(
      text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function readNestedValue(
  source: unknown,
  key: string
): unknown {
  if (!isRecord(source)) {
    return undefined;
  }

  return source[key];
}

/**
 * Đọc nội dung đáp án từ nhiều cấu trúc dữ liệu khác nhau.
 */
function readOptionText(
  value: UnknownRecord,
  key: AnswerKey
): string {
  const lowerKey = key.toLowerCase();

  const directValue =
    safeText(value[key]) ||
    safeText(value[lowerKey]);

  if (directValue) {
    return directValue;
  }

  const answers = value.answers;

  if (isRecord(answers)) {
    const answerValue =
      safeText(answers[key]) ||
      safeText(answers[lowerKey]);

    if (answerValue) {
      return answerValue;
    }
  }

  const options = value.options;

  if (isRecord(options)) {
    const optionValue =
      safeText(options[key]) ||
      safeText(options[lowerKey]);

    if (optionValue) {
      return optionValue;
    }
  }

  if (Array.isArray(options)) {
    const matchedOption = options.find((item) => {
      if (!isRecord(item)) {
        return false;
      }

      return (
        safeText(item.key).toUpperCase() === key ||
        safeText(item.label).toUpperCase() === key
      );
    });

    if (isRecord(matchedOption)) {
      return (
        safeText(matchedOption.text) ||
        safeText(matchedOption.content) ||
        safeText(matchedOption.answer)
      );
    }
  }

  return "";
}

/**
 * Chuẩn hóa giá trị đúng/sai.
 */
function normalizeStatementCorrect(
  value: unknown
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const text = safeText(value).toLowerCase();

  return (
    text === "true" ||
    text === "1" ||
    text === "yes" ||
    text === "correct" ||
    text === "đúng" ||
    text === "dung"
  );
}

/**
 * Chuẩn hóa bốn phát biểu Đúng/Sai.
 */
function normalizeStatements(
  value: unknown
): TrueFalseStatementDraft[] {
  if (!Array.isArray(value)) {
    return createTrueFalseStatements();
  }

  return TRUE_FALSE_LABELS.map((label, index) => {
    const source = isRecord(value[index])
      ? value[index]
      : {};

    return {
      id:
        safeText(source.id) ||
        createClientId(),

      label,

      statement:
        safeText(source.statement) ||
        safeText(source.text) ||
        safeText(source.content),

      statementImageId:
        safeText(source.statementImageId) ||
        safeText(source.imageId),

      statementImageUrl:
        safeText(source.statementImageUrl) ||
        safeText(source.imageUrl),

      correct: normalizeStatementCorrect(
        source.correct ??
          source.isCorrect ??
          source.answer
      ),
    };
  });
}

/**
 * Chuẩn hóa dữ liệu câu hỏi từ API, AI hoặc dữ liệu cũ
 * thành TestQuestionDraft dùng trong editor.
 */
export function normalizeQuestionDraft(
  value: unknown
): TestQuestionDraft {
  const source: UnknownRecord = isRecord(value)
    ? value
    : {};

  const questionType = normalizeQuestionType(
    source.questionType ??
      source.type ??
      source.question_type
  );

  const draft = createQuestionDraft(questionType);

  const numericTolerance = Number(
    source.answerTolerance ??
      source.tolerance ??
      0
  );

  const numericScore = Number(source.score);

  const rawCorrectAnswer =
    source.correct ??
    source.correctAnswer ??
    source.answer ??
    source.answerKey;

  return {
    ...draft,

    id:
      safeText(source.id) ||
      createClientId(),

    bankQuestionId:
      safeText(source.bankQuestionId) ||
      safeText(source.bank_question_id),

    questionType,

    section: normalizeSection(
      source.section ??
        source.testSection ??
        source.part,
      questionType
    ),

    question:
      safeText(source.question) ||
      safeText(source.content) ||
      safeText(source.text) ||
      safeText(source.prompt),

    questionImageId:
      safeText(source.questionImageId) ||
      safeText(source.imageId),

    questionImageUrl:
      safeText(source.questionImageUrl) ||
      safeText(source.imageUrl) ||
      safeText(source.image),

    A: readOptionText(source, "A"),
    AImageId: safeText(source.AImageId),
    AImageUrl: safeText(source.AImageUrl),

    B: readOptionText(source, "B"),
    BImageId: safeText(source.BImageId),
    BImageUrl: safeText(source.BImageUrl),

    C: readOptionText(source, "C"),
    CImageId: safeText(source.CImageId),
    CImageUrl: safeText(source.CImageUrl),

    D: readOptionText(source, "D"),
    DImageId: safeText(source.DImageId),
    DImageUrl: safeText(source.DImageUrl),

    correct: normalizeAnswerKey(
      rawCorrectAnswer
    ),

    statements:
      questionType === "true_false_group"
        ? normalizeStatements(
            source.statements ??
              source.items ??
              source.assertions
          )
        : [],

    expectedAnswer:
      questionType === "short_answer"
        ? safeText(
            source.expectedAnswer ??
              source.correctAnswer ??
              source.answer
          )
        : "",

    acceptedAnswers:
      questionType === "short_answer"
        ? normalizeStringArray(
            source.acceptedAnswers ??
              source.alternativeAnswers ??
              source.validAnswers
          )
        : [],

    answerTolerance:
      questionType === "short_answer" &&
      Number.isFinite(numericTolerance) &&
      numericTolerance >= 0
        ? numericTolerance
        : 0,

    explanation:
      safeText(source.explanation) ||
      safeText(source.solution),

    topic: safeText(source.topic),

    knowledgeUnit:
      safeText(source.knowledgeUnit) ||
      safeText(source.knowledge_unit),

    skill: safeText(source.skill),

    learningOutcome:
      safeText(source.learningOutcome) ||
      safeText(source.learning_outcome),

    cognitiveLevel: normalizeCognitiveLevel(
      source.cognitiveLevel ??
        source.cognitive_level
    ),

    difficulty: normalizeDifficulty(
      source.difficulty
    ),

    score:
      Number.isFinite(numericScore) &&
      numericScore > 0
        ? numericScore
        : getDefaultQuestionScore(questionType),

    tags: normalizeStringArray(source.tags),
  };
}

/**
 * Kiểm tra tính hợp lệ của một câu hỏi.
 */
export function validateQuestionDraft(
  question: TestQuestionDraft,
  index: number
): string[] {
  const errors: string[] = [];
  const questionNumber = index + 1;

  if (!question.question.trim()) {
    errors.push(
      `Câu ${questionNumber}: chưa có nội dung câu hỏi.`
    );
  }

  if (
    !Number.isFinite(question.score) ||
    question.score <= 0
  ) {
    errors.push(
      `Câu ${questionNumber}: điểm phải lớn hơn 0.`
    );
  }

  if (question.questionType === "single_choice") {
    ANSWER_KEYS.forEach((answerKey) => {
      if (!question[answerKey].trim()) {
        errors.push(
          `Câu ${questionNumber}: thiếu đáp án ${answerKey}.`
        );
      }
    });

    if (!question[question.correct].trim()) {
      errors.push(
        `Câu ${questionNumber}: đáp án đúng ${question.correct} chưa có nội dung.`
      );
    }
  }

  if (
    question.questionType ===
    "true_false_group"
  ) {
    if (question.statements.length !== 4) {
      errors.push(
        `Câu ${questionNumber}: phải có đúng 4 phát biểu a, b, c, d.`
      );
    }

    question.statements.forEach(
      (statement, statementIndex) => {
        const label =
          statement.label ??
          TRUE_FALSE_LABELS[statementIndex];

        if (!statement.statement.trim()) {
          errors.push(
            `Câu ${questionNumber}: phát biểu ${label} chưa có nội dung.`
          );
        }
      }
    );
  }

  if (question.questionType === "short_answer") {
    const hasExpectedAnswer =
      question.expectedAnswer.trim().length > 0;

    const hasAcceptedAnswer =
      question.acceptedAnswers.some(
        (answer) => answer.trim().length > 0
      );

    if (!hasExpectedAnswer && !hasAcceptedAnswer) {
      errors.push(
        `Câu ${questionNumber}: chưa có đáp án trả lời ngắn.`
      );
    }

    if (
      !Number.isFinite(question.answerTolerance) ||
      question.answerTolerance < 0
    ) {
      errors.push(
        `Câu ${questionNumber}: sai số đáp án không được nhỏ hơn 0.`
      );
    }
  }

  return errors;
}

/**
 * Kiểm tra câu hỏi có nằm đúng phần thi tiêu chuẩn không.
 */
export function validateQuestionSection(
  question: TestQuestionDraft,
  index: number
): string[] {
  const expectedSection = getDefaultSection(
    question.questionType
  );

  if (question.section === expectedSection) {
    return [];
  }

  return [
    `Câu ${index + 1}: ${getQuestionTypeLabel(
      question.questionType
    )} phải thuộc ${getSectionLabel(
      expectedSection
    )}.`,
  ];
}

/**
 * Kiểm tra toàn bộ danh sách câu hỏi.
 *
 * enforceStandardSections:
 * - false: giáo viên được chọn phần thi tự do.
 * - true: áp dụng cấu trúc chuẩn Phần I, II, III.
 */
export function validateQuestionList(
  questions: TestQuestionDraft[],
  enforceStandardSections = false
): string[] {
  return questions.flatMap((question, index) => {
    const errors = validateQuestionDraft(
      question,
      index
    );

    if (enforceStandardSections) {
      errors.push(
        ...validateQuestionSection(
          question,
          index
        )
      );
    }

    return errors;
  });
}

/**
 * Tính tổng điểm của toàn bộ câu hỏi.
 */
export function calculateTotalQuestionScore(
  questions: TestQuestionDraft[]
): number {
  const total = questions.reduce(
    (sum, question) => {
      const score = Number(question.score);

      return (
        sum +
        (Number.isFinite(score) ? score : 0)
      );
    },
    0
  );

  return Number(total.toFixed(2));
}

/**
 * Nhãn hiển thị của loại câu hỏi.
 */
export function getQuestionTypeLabel(
  questionType: QuestionType
): string {
  switch (questionType) {
    case "true_false_group":
      return "Trắc nghiệm Đúng/Sai";

    case "short_answer":
      return "Trả lời ngắn";

    case "single_choice":
    default:
      return "Trắc nghiệm 4 lựa chọn";
  }
}

/**
 * Nhãn hiển thị của phần thi.
 */
export function getSectionLabel(
  section: TestSection
): string {
  switch (section) {
    case "part_2":
      return "Phần II";

    case "part_3":
      return "Phần III";

    case "part_1":
    default:
      return "Phần I";
  }
}