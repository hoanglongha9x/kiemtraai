import type {
  QuestionCardData,
} from "@/components/question-bank/types";

import type {
  CreateQuestionSnapshotOptions,
  TestQuestionItem,
  TestQuestionSnapshot,
  TestSection,
} from "../types";

const DEFAULT_SCORE = 1;

function createId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function cloneStringArray(
  values?: string[]
): string[] | undefined {
  if (!values) {
    return undefined;
  }

  return [...values];
}

export function createQuestionSnapshot(
  question: QuestionCardData,
  options: CreateQuestionSnapshotOptions = {}
): TestQuestionSnapshot {
  const snapshotCreatedAt =
    options.snapshotCreatedAt ??
    new Date().toISOString();

  const source =
    options.source ??
    "question_bank";

  const baseSnapshot = {
    originalQuestionId: question.id,

    type: question.type,

    content: question.content,

    contentBlocks:
      question.contentBlocks,

    questionImageId:
      question.questionImageId,

    questionImageUrl:
      question.questionImageUrl,

    subject: question.subject,

    grade: question.grade,

    topic: question.topic,

    knowledgeUnit:
      question.knowledgeUnit,

    skill:
      question.skill,

    learningOutcome:
      question.learningOutcome,

    explanation:
      question.explanation,

    difficulty: question.difficulty,

    cognitiveLevel:
      question.cognitiveLevel,

    tags: cloneStringArray(
      question.tags
    ),

    source,

    originalUpdatedAt:
      question.updatedAt,

    snapshotCreatedAt,
  };

  switch (question.type) {
    case "single_choice":
      return {
        ...baseSnapshot,

        type: "single_choice",

        options:
          question.options.map(
            (option) => ({
              ...option,
            })
          ),

        correctOptionId:
          question.correctOptionId,
      };

    case "true_false_group":
      return {
        ...baseSnapshot,

        type: "true_false_group",

        statements:
          question.statements.map(
            (statement) => ({
              ...statement,
            })
          ),
      };

    case "short_answer":
      return {
        ...baseSnapshot,

        type: "short_answer",

        acceptedAnswers: [
          ...question.acceptedAnswers,
        ],

        caseSensitive:
          question.caseSensitive,

        trimWhitespace:
          question.trimWhitespace,

      };

    default: {
      const unreachable:
        never = question;

      throw new Error(
        `Loại câu hỏi không được hỗ trợ: ${String(
          unreachable
        )}`
      );
    }
  }
}

export type CreateTestQuestionItemOptions = {
  order?: number;
  score?: number;
  required?: boolean;
};

export function createTestQuestionItem(
  question: QuestionCardData,
  options: CreateTestQuestionItemOptions = {}
): TestQuestionItem {
  const normalizedScore =
    Number(options.score);

  return {
    id: createId(
      "test-question"
    ),

    questionBankId:
      question.id,

    order:
      options.order ?? 0,

    score:
      Number.isFinite(
        normalizedScore
      ) &&
      normalizedScore > 0
        ? normalizedScore
        : DEFAULT_SCORE,

    required:
      options.required ?? true,

    snapshot:
      createQuestionSnapshot(
        question,
        {
          source:
            "question_bank",
        }
      ),
  };
}

export function isQuestionCompatibleWithSection(
  question: QuestionCardData,
  section: TestSection
): boolean {
  return (
    question.type ===
    section.type
  );
}

export function isQuestionAlreadyInSections(
  questionId: string,
  sections: TestSection[]
): boolean {
  return sections.some(
    (section) =>
      section.questions.some(
        (item) =>
          item.questionBankId ===
            questionId ||
          item.snapshot
            .originalQuestionId ===
            questionId
      )
  );
}

export type AddQuestionsToSectionResult = {
  section: TestSection;

  addedQuestionIds: string[];

  duplicateQuestionIds: string[];

  incompatibleQuestionIds: string[];
};

export function addQuestionsToSection(
  section: TestSection,
  questions: QuestionCardData[],
  allSections: TestSection[]
): AddQuestionsToSectionResult {
  const addedQuestionIds:
    string[] = [];

  const duplicateQuestionIds:
    string[] = [];

  const incompatibleQuestionIds:
    string[] = [];

  const newItems:
    TestQuestionItem[] = [];

  questions.forEach(
    (question) => {
      if (
        !isQuestionCompatibleWithSection(
          question,
          section
        )
      ) {
        incompatibleQuestionIds.push(
          question.id
        );

        return;
      }

      if (
        isQuestionAlreadyInSections(
          question.id,
          allSections
        )
      ) {
        duplicateQuestionIds.push(
          question.id
        );

        return;
      }

      const order =
        section.questions.length +
        newItems.length;

      newItems.push(
        createTestQuestionItem(
          question,
          {
            order,

            score:
              section.scorePerQuestion,

            required: true,
          }
        )
      );

      addedQuestionIds.push(
        question.id
      );
    }
  );

  return {
    section: {
      ...section,

      questions: [
        ...section.questions,
        ...newItems,
      ],
    },

    addedQuestionIds,

    duplicateQuestionIds,

    incompatibleQuestionIds,
  };
}

export function normalizeQuestionOrder(
  questions: TestQuestionItem[]
): TestQuestionItem[] {
  return questions.map(
    (question, index) => ({
      ...question,

      order: index,
    })
  );
}

export function removeQuestionFromSection(
  section: TestSection,
  testQuestionId: string
): TestSection {
  return {
    ...section,

    questions:
      normalizeQuestionOrder(
        section.questions.filter(
          (question) =>
            question.id !==
            testQuestionId
        )
      ),
  };
}

export function moveQuestionInSection(
  section: TestSection,
  testQuestionId: string,
  direction: "up" | "down"
): TestSection {
  const currentIndex =
    section.questions.findIndex(
      (question) =>
        question.id ===
        testQuestionId
    );

  if (currentIndex < 0) {
    return section;
  }

  const targetIndex =
    direction === "up"
      ? currentIndex - 1
      : currentIndex + 1;

  if (
    targetIndex < 0 ||
    targetIndex >=
      section.questions.length
  ) {
    return section;
  }

  const nextQuestions = [
    ...section.questions,
  ];

  const currentQuestion =
    nextQuestions[
      currentIndex
    ];

  const targetQuestion =
    nextQuestions[
      targetIndex
    ];

  if (
    !currentQuestion ||
    !targetQuestion
  ) {
    return section;
  }

  nextQuestions[
    currentIndex
  ] = targetQuestion;

  nextQuestions[
    targetIndex
  ] = currentQuestion;

  return {
    ...section,

    questions:
      normalizeQuestionOrder(
        nextQuestions
      ),
  };
}

export function updateQuestionScore(
  section: TestSection,
  testQuestionId: string,
  score: number
): TestSection {
  const normalizedScore =
    Number(score);

  if (
    !Number.isFinite(
      normalizedScore
    ) ||
    normalizedScore <= 0
  ) {
    return section;
  }

  return {
    ...section,

    questions:
      section.questions.map(
        (question) =>
          question.id ===
          testQuestionId
            ? {
                ...question,

                score:
                  normalizedScore,
              }
            : question
      ),
  };
}

export function updateQuestionRequired(
  section: TestSection,
  testQuestionId: string,
  required: boolean
): TestSection {
  return {
    ...section,

    questions:
      section.questions.map(
        (question) =>
          question.id ===
          testQuestionId
            ? {
                ...question,

                required,
              }
            : question
      ),
  };
}
