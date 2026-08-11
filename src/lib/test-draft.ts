import type {
  TestDraft,
  TestDraftValidationResult,
  TestStatus,
  TestStructureMode,
} from "@/types/test-draft";

import type {
  TestQuestionDraft,
} from "@/types/test-question";

import {
  createClientId,
  createQuestionDraft,
  normalizeQuestionDraft,
  safeText,
  validateQuestionList,
} from "@/lib/test-question";

type UnknownRecord = Record<
  string,
  unknown
>;

function isRecord(
  value: unknown
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function createIsoTimestamp(): string {
  return new Date().toISOString();
}

export function normalizeTestStructureMode(
  value: unknown
): TestStructureMode {
  const mode = safeText(value)
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    mode === "custom" ||
    mode === "tùy_chỉnh" ||
    mode === "tuỳ_chỉnh" ||
    mode === "tuy_chinh"
  ) {
    return "custom";
  }

  return "gdpt_2018";
}

export function normalizeTestStatus(
  value: unknown
): TestStatus {
  const status = safeText(value)
    .toLowerCase();

  if (status === "published") {
    return "published";
  }

  if (status === "archived") {
    return "archived";
  }

  return "draft";
}

export function normalizeDurationMinutes(
  value: unknown
): number {
  const duration = Number(value);

  if (
    Number.isFinite(duration) &&
    duration > 0
  ) {
    return Math.round(duration);
  }

  return 45;
}

export function createTestDraft(): TestDraft {
  const now = createIsoTimestamp();

  return {
    id: createClientId(),

    title: "",
    subject: "",
    grade: "",

    durationMinutes: 45,

    description: "",
    instructions: "",

    structureMode: "gdpt_2018",
    status: "draft",

    questions: [
      createQuestionDraft(
        "single_choice"
      ),
    ],

    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeTestQuestions(
  value: unknown
): TestQuestionDraft[] {
  if (!Array.isArray(value)) {
    return [
      createQuestionDraft(
        "single_choice"
      ),
    ];
  }

  const questions = value.map(
    (question) =>
      normalizeQuestionDraft(question)
  );

  return questions.length > 0
    ? questions
    : [
        createQuestionDraft(
          "single_choice"
        ),
      ];
}

export function normalizeTestDraft(
  value: unknown
): TestDraft {
  const source: UnknownRecord =
    isRecord(value)
      ? value
      : {};

  const now = createIsoTimestamp();

  return {
    id:
      safeText(source.id) ||
      createClientId(),

    title:
      safeText(source.title) ||
      safeText(source.name),

    subject:
      safeText(source.subject) ||
      safeText(source.subjectName),

    grade:
      safeText(source.grade) ||
      safeText(source.gradeLevel),

    durationMinutes:
      normalizeDurationMinutes(
        source.durationMinutes ??
          source.duration ??
          source.timeLimit
      ),

    description:
      safeText(source.description),

    instructions:
      safeText(source.instructions) ||
      safeText(source.guide),

    structureMode:
      normalizeTestStructureMode(
        source.structureMode ??
          source.mode
      ),

    status:
      normalizeTestStatus(
        source.status
      ),

    questions:
      normalizeTestQuestions(
        source.questions ??
          source.items
      ),

    createdAt:
      safeText(source.createdAt) ||
      now,

    updatedAt:
      safeText(source.updatedAt) ||
      now,
  };
}

export function updateTestDraftTimestamp(
  draft: TestDraft
): TestDraft {
  return {
    ...draft,
    updatedAt: createIsoTimestamp(),
  };
}

export function validateTestDraft(
  draft: TestDraft
): TestDraftValidationResult {
  const errors: string[] = [];

  if (!draft.title.trim()) {
    errors.push(
      "Chưa nhập tên đề kiểm tra."
    );
  }

  if (!draft.subject.trim()) {
    errors.push(
      "Chưa chọn hoặc nhập môn học."
    );
  }

  if (!draft.grade.trim()) {
    errors.push(
      "Chưa chọn hoặc nhập khối lớp."
    );
  }

  if (
    !Number.isFinite(
      draft.durationMinutes
    ) ||
    draft.durationMinutes <= 0
  ) {
    errors.push(
      "Thời gian làm bài phải lớn hơn 0 phút."
    );
  }

  if (
    !Array.isArray(draft.questions) ||
    draft.questions.length === 0
  ) {
    errors.push(
      "Đề kiểm tra chưa có câu hỏi."
    );
  }

  errors.push(
    ...validateQuestionList(
      draft.questions,
      draft.structureMode ===
        "gdpt_2018"
    )
  );

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function prepareTestDraftPayload(
  draft: TestDraft
): TestDraft {
  const normalizedDraft =
    normalizeTestDraft(draft);

  return {
    ...normalizedDraft,

    title:
      normalizedDraft.title.trim(),

    subject:
      normalizedDraft.subject.trim(),

    grade:
      normalizedDraft.grade.trim(),

    description:
      normalizedDraft.description.trim(),

    instructions:
      normalizedDraft.instructions.trim(),

    questions:
      normalizedDraft.questions.map(
        (question) =>
          normalizeQuestionDraft(
            question
          )
      ),

    updatedAt:
      createIsoTimestamp(),
  };
}