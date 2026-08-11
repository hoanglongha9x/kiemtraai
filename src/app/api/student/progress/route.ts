import { NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebase/admin";

import type {
  ExamAnswerKey,
  ExamAnswers,
  ExamQuestionType,
  ExamStudentAnswer,
} from "@/features/exam/types";

import {
  asRecord,
  normalizeAnswerKey,
  normalizeStringArray,
  normalizeSuspiciousEvents,
  safeNumber,
  safeString,
  safeUpper,
} from "@/features/exam/utils";

export const runtime = "nodejs";

class ApiError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

type QuestionSchema = {
  id: string;
  type: ExamQuestionType;
};

const ANSWER_KEYS: ExamAnswerKey[] = [
  "A",
  "B",
  "C",
  "D",
];

function isExamQuestionType(
  value: unknown
): value is ExamQuestionType {
  return (
    value === "single_choice" ||
    value === "true_false_group" ||
    value === "short_answer"
  );
}

function normalizeQuestionTypeLabel(
  value: unknown
): string {
  return safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveExamQuestionType(
  value: unknown
): ExamQuestionType | null {
  if (isExamQuestionType(value)) {
    return value;
  }

  const normalized =
    normalizeQuestionTypeLabel(value);

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("dung sai") ||
    normalized.includes("true false") ||
    normalized.includes("truefalse")
  ) {
    return "true_false_group";
  }

  if (
    normalized.includes("tra loi ngan") ||
    normalized.includes("short answer") ||
    normalized.includes("shortanswer")
  ) {
    return "short_answer";
  }

  if (
    normalized.includes("trac nghiem") ||
    normalized.includes("nhieu lua chon") ||
    normalized.includes("single choice") ||
    normalized.includes("multiple choice") ||
    normalized.includes("choice")
  ) {
    return "single_choice";
  }

  return null;
}

function normalizeQuestionType(
  questionType: unknown,
  sectionType: unknown
): ExamQuestionType | null {
  return (
    resolveExamQuestionType(questionType) ??
    resolveExamQuestionType(sectionType)
  );
}

function normalizeQuestionId(
  question: Record<string, unknown>,
  sectionId: string,
  questionIndex: number
): string {
  return (
    safeString(
      question.id ??
        question.questionId ??
        question.bankQuestionId
    ) ||
    `${sectionId}-q-${questionIndex + 1}`
  );
}

function buildQuestionSchema(
  assignment: Record<string, unknown>
): QuestionSchema[] {
  const testSnapshot = asRecord(
    assignment.testSnapshot
  );

  if (!Array.isArray(testSnapshot.sections)) {
    throw new ApiError(
      "Bản đề đã xuất bản không có dữ liệu sections.",
      500
    );
  }

  const schemas: QuestionSchema[] = [];
  const usedQuestionIds = new Set<string>();

  testSnapshot.sections.forEach(
    (rawSection, sectionIndex) => {
      const section = asRecord(rawSection);

      const sectionId =
        safeString(
          section.id ??
            section.sectionId
        ) ||
        `part_${sectionIndex + 1}`;

      const sectionType = section.type;

      const questions = Array.isArray(
        section.questions
      )
        ? section.questions
        : [];

      questions.forEach(
        (rawQuestion, questionIndex) => {
          const question = asRecord(
            rawQuestion
          );

          const snapshot = asRecord(
            question.snapshot
          );

          const questionContent =
            Object.keys(snapshot).length > 0
              ? snapshot
              : question;

          const type = normalizeQuestionType(
            questionContent.type ??
              questionContent.questionType ??
              question.type ??
              question.questionType,
            sectionType
          );

          if (!type) {
            throw new ApiError(
              `Câu hỏi ${
                questionIndex + 1
              } trong phần ${
                sectionIndex + 1
              } chưa có loại hợp lệ.`,
              500
            );
          }

          const baseQuestionId =
            normalizeQuestionId(
              question,
              sectionId,
              questionIndex
            );

          let questionId = baseQuestionId;
          let duplicateIndex = 2;

          while (
            usedQuestionIds.has(questionId)
          ) {
            questionId =
              `${baseQuestionId}-${duplicateIndex}`;

            duplicateIndex += 1;
          }

          usedQuestionIds.add(questionId);

          schemas.push({
            id: questionId,
            type,
          });
        }
      );
    }
  );

  if (schemas.length === 0) {
    throw new ApiError(
      "Đề kiểm tra chưa có câu hỏi.",
      500
    );
  }

  return schemas;
}

function normalizeTrueFalseAnswer(
  value: unknown
): Partial<
  Record<ExamAnswerKey, boolean>
> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const record = asRecord(value);

  const answer: Partial<
    Record<ExamAnswerKey, boolean>
  > = {};

  function normalizeTrueFalseValue(
    item: unknown
  ): boolean | undefined {
    if (typeof item === "boolean") {
      return item;
    }

    if (typeof item === "number") {
      if (item === 1) return true;
      if (item === 0) return false;
      return undefined;
    }

    const text = safeString(item)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .trim();

    if (
      text === "true" ||
      text === "1" ||
      text === "yes" ||
      text === "y" ||
      text === "dung"
    ) {
      return true;
    }

    if (
      text === "false" ||
      text === "0" ||
      text === "no" ||
      text === "n" ||
      text === "sai"
    ) {
      return false;
    }

    return undefined;
  }

  ANSWER_KEYS.forEach(
    (answerKey) => {
      const rawValue =
        record[answerKey] ??
        record[
          answerKey.toLowerCase()
        ];

      const normalizedValue =
        normalizeTrueFalseValue(
          rawValue
        );

      if (typeof normalizedValue === "boolean") {
        answer[answerKey] =
          normalizedValue;
      }
    }
  );

  return Object.keys(answer).length > 0
    ? answer
    : null;
}

function normalizeAnswerByQuestionType(
  type: ExamQuestionType,
  value: unknown
): ExamStudentAnswer | null {
  switch (type) {
    case "single_choice": {
      const answer = normalizeAnswerKey(
        value
      );

      return answer || null;
    }

    case "true_false_group": {
      return normalizeTrueFalseAnswer(
        value
      );
    }

    case "short_answer": {
      const answer = safeString(value);

      return answer || null;
    }
  }
}

function normalizeAnswers(
  value: unknown,
  questionSchemas: QuestionSchema[]
): ExamAnswers {
  const rawAnswers = asRecord(value);

  const schemaMap = new Map(
    questionSchemas.map(
      (question) => [
        question.id,
        question,
      ]
    )
  );

  const answers: ExamAnswers = {};

  Object.entries(rawAnswers).forEach(
    ([questionId, rawAnswer]) => {
      const schema = schemaMap.get(
        questionId
      );

      if (!schema) {
        return;
      }

      const answer =
        normalizeAnswerByQuestionType(
          schema.type,
          rawAnswer
        );

      if (answer !== null) {
        answers[questionId] = answer;
      }
    }
  );

  return answers;
}

function normalizeBookmarks(
  value: unknown,
  validQuestionIds: Set<string>
): string[] {
  return normalizeStringArray(value)
    .filter(
      (questionId) =>
        validQuestionIds.has(questionId)
    )
    .slice(0, 500);
}

function countAnsweredQuestions(
  answers: ExamAnswers
): number {
  return Object.keys(answers).length;
}

function countCompletedTrueFalseStatements(
  answers: ExamAnswers,
  questionSchemas: QuestionSchema[]
): number {
  const schemaMap = new Map(
    questionSchemas.map(
      (question) => [
        question.id,
        question.type,
      ]
    )
  );

  return Object.entries(answers).reduce(
    (total, [questionId, answer]) => {
      if (
        schemaMap.get(questionId) !==
          "true_false_group" ||
        !answer ||
        typeof answer !== "object" ||
        Array.isArray(answer)
      ) {
        return total;
      }

      return (
        total +
        Object.values(answer).filter(
          (value) =>
            typeof value === "boolean"
        ).length
      );
    },
    0
  );
}

async function loadAssignment(
  assignmentId: string
) {
  const db = getAdminDb();

  for (const collectionName of [
    "assignments",
    "testAssignments",
  ]) {
    const assignmentDoc = await db
      .collection(collectionName)
      .doc(assignmentId)
      .get();

    if (assignmentDoc.exists) {
      return assignmentDoc;
    }
  }

  throw new ApiError(
    "Không tìm thấy bài kiểm tra được giao.",
    404
  );
}

export async function POST(
  request: Request
) {
  try {
    const body = asRecord(
      await request.json()
    );

    const attemptId = safeString(
      body.attemptId
    );

    const studentId = safeString(
      body.studentId
    );

    const studentCode = safeUpper(
      body.studentCode
    );

    if (
      !attemptId ||
      !studentId ||
      !studentCode
    ) {
      throw new ApiError(
        "Thiếu thông tin phiên làm bài.",
        400
      );
    }

    const db = getAdminDb();

    const attemptRef = db
      .collection("examAttempts")
      .doc(attemptId);

    const attemptDoc =
      await attemptRef.get();

    if (!attemptDoc.exists) {
      throw new ApiError(
        "Không tìm thấy phiên làm bài.",
        404
      );
    }

    const attempt = asRecord(
      attemptDoc.data()
    );

    if (
      safeString(attempt.studentId) !==
        studentId ||
      safeUpper(attempt.studentCode) !==
        studentCode
    ) {
      throw new ApiError(
        "Thông tin học sinh không khớp với phiên làm bài.",
        403
      );
    }

    if (
      safeString(attempt.status) !==
      "in_progress"
    ) {
      throw new ApiError(
        "Phiên làm bài này không còn hoạt động.",
        409
      );
    }

    const expiresAt = new Date(
      safeString(attempt.expiresAt)
    );

    if (
      Number.isNaN(
        expiresAt.getTime()
      ) ||
      expiresAt.getTime() <=
        Date.now()
    ) {
      await attemptRef.update({
        status: "expired",
        updatedAt:
          new Date().toISOString(),
      });

      throw new ApiError(
        "Phiên làm bài đã hết thời gian.",
        409
      );
    }

    const assignmentId = safeString(
      attempt.assignmentId
    );

    if (!assignmentId) {
      throw new ApiError(
        "Phiên làm bài không có assignmentId hợp lệ.",
        500
      );
    }

    const assignmentDoc =
      await loadAssignment(
        assignmentId
      );

    const assignment = asRecord(
      assignmentDoc.data()
    );

    const questionSchemas =
      buildQuestionSchema(
        assignment
      );

    const validQuestionIds = new Set(
      questionSchemas.map(
        (question) => question.id
      )
    );

    const answers = normalizeAnswers(
      body.answers,
      questionSchemas
    );

    const bookmarkedQuestionIds =
      normalizeBookmarks(
        body.bookmarkedQuestionIds,
        validQuestionIds
      );

    const maximumQuestionIndex =
      Math.max(
        0,
        questionSchemas.length - 1
      );

    const currentQuestionIndex =
      Math.min(
        maximumQuestionIndex,
        Math.max(
          0,
          Math.floor(
            safeNumber(
              body.currentQuestionIndex,
              0
            )
          )
        )
      );

    const rawAntiCheat = asRecord(
      body.antiCheat
    );

    const visibilityLostCount =
      Math.max(
        0,
        Math.floor(
          safeNumber(
            rawAntiCheat.visibilityLostCount,
            0
          )
        )
      );

    const focusLostCount =
      Math.max(
        0,
        Math.floor(
          safeNumber(
            rawAntiCheat.focusLostCount,
            0
          )
        )
      );

    const suspiciousEvents =
      normalizeSuspiciousEvents(
        rawAntiCheat.suspiciousEvents
      );

    const now =
      new Date().toISOString();

    await attemptRef.update({
      answers,

      bookmarkedQuestionIds,

      currentQuestionIndex,

      antiCheat: {
        visibilityLostCount,
        focusLostCount,
        suspiciousEvents,
      },

      updatedAt: now,
      lastSavedAt: now,
    });

    return NextResponse.json({
      status: "success",

      savedAt: now,

      progress: {
        answeredQuestionCount:
          countAnsweredQuestions(
            answers
          ),

        totalQuestionCount:
          questionSchemas.length,

        completedTrueFalseStatementCount:
          countCompletedTrueFalseStatements(
            answers,
            questionSchemas
          ),

        bookmarkedQuestionCount:
          bookmarkedQuestionIds.length,

        currentQuestionIndex,
      },

      answers,

      bookmarkedQuestionIds,

      message:
        "Đã lưu tiến độ.",
    });
  } catch (error: unknown) {
    console.error(
      "POST /api/student/progress error:",
      error
    );

    const apiError =
      error instanceof ApiError
        ? error
        : null;

    return NextResponse.json(
      {
        status: "error",

        message:
          apiError?.message ||
          (error instanceof Error
            ? error.message
            : "Không lưu được tiến độ."),
      },
      {
        status:
          apiError?.statusCode ||
          500,
      }
    );
  }
}
