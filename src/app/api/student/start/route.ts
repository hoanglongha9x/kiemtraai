import { NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebase/admin";
import { verifyPassword } from "@/lib/security/password";

import type {
  ExamAnswerKey,
  ExamAnswers,
  ExamQuestion,
  ExamQuestionType,
  ExamSingleChoiceOption,
  ExamStudentAnswer,
  ExamTrueFalseStatement,
} from "@/features/exam/types";

import {
  asRecord,
  buildExamAssignmentInfo,
  deriveExamAccessState,
  normalizeAnswerKey,
  normalizeStringArray,
  safeNumber,
  safeString,
  safeUpper,
} from "@/features/exam/utils";

import type {
  QuestionContentBlock,
  QuestionTableCell,
} from "@/types/question-content";

export const runtime = "nodejs";

class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

type RawExamSection = {
  id: string;
  title: string;
  type?: ExamQuestionType;
  questions: unknown[];
};

type SnapshotExamData = {
  questions: ExamQuestion[];
  sectionIds: string[];
};

const ANSWER_KEYS: ExamAnswerKey[] = [
  "A",
  "B",
  "C",
  "D",
];
function extractTextValue(
  value: unknown,
  depth = 0
): string {
  if (
    value === null ||
    value === undefined ||
    depth > 5
  ) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return safeString(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        extractTextValue(
          item,
          depth + 1
        )
      )
      .filter(Boolean)
      .join("\n");
  }

  if (
    typeof value !== "object"
  ) {
    return "";
  }

  const record =
    asRecord(value);

  const candidateKeys = [
    "content",
    "text",
    "value",
    "label",
    "title",
    "question",
    "questionText",
    "prompt",
    "stem",
    "html",
    "plainText",
  ];

  for (
    const key of candidateKeys
  ) {
    const extracted =
      extractTextValue(
        record[key],
        depth + 1
      );

    if (extracted) {
      return extracted;
    }
  }

  return "";
}
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

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];

  for (
    let index = result.length - 1;
    index > 0;
    index--
  ) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1)
    );

    [
      result[index],
      result[randomIndex],
    ] = [
      result[randomIndex],
      result[index],
    ];
  }

  return result;
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

function normalizeQuestionContent(
  question: Record<string, unknown>
): string {
  const directContent =
    extractTextValue(
      question.content ??
        question.stem ??
        question.question ??
        question.questionText ??
        question.title ??
        question.text ??
        question.prompt
    );

  if (directContent) {
    return directContent;
  }

  const nestedSources = [
    question.data,
    question.payload,
    question.questionData,
    question.questionContent,
    question.body,
  ];

  for (
    const source of nestedSources
  ) {
    const content =
      extractTextValue(
        source
      );

    if (content) {
      return content;
    }
  }

  return "";
}

function normalizeTableCell(
  value: unknown
): QuestionTableCell {
  const cell =
    asRecord(value);
  const colSpan =
    Math.max(
      1,
      Math.min(
        20,
        Math.round(
          safeNumber(
            cell.colSpan,
            1
          )
        )
      )
    );
  const rowSpan =
    Math.max(
      1,
      Math.min(
        50,
        Math.round(
          safeNumber(
            cell.rowSpan,
            1
          )
        )
      )
    );
  const align =
    cell.align === "center" ||
    cell.align === "right"
      ? cell.align
      : "left";
  const verticalAlign =
    cell.verticalAlign ===
      "center" ||
    cell.verticalAlign ===
      "bottom"
      ? cell.verticalAlign
      : "top";

  return {
    content:
      extractTextValue(
        cell.content ??
          cell.text
      ),
    colSpan:
      colSpan > 1
        ? colSpan
        : undefined,
    rowSpan:
      rowSpan > 1
        ? rowSpan
        : undefined,
    bold:
      cell.bold === true ||
      undefined,
    italic:
      cell.italic === true ||
      undefined,
    align,
    verticalAlign,
  };
}

function normalizeQuestionContentBlocks(
  value: unknown
): QuestionContentBlock[] |
  undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const blocks:
    QuestionContentBlock[] =
      [];

  value
    .slice(0, 40)
    .forEach((rawBlock) => {
      const block =
        asRecord(rawBlock);

      if (block.type === "text") {
        const content =
          extractTextValue(
            block.content
          );

        if (content) {
          blocks.push({
            type: "text",
            content,
          });
        }

        return;
      }

      if (block.type === "image") {
        const imageId =
          safeString(
            block.imageId
          );
        const imageUrl =
          safeString(
            block.imageUrl
          );

        if (imageId || imageUrl) {
          blocks.push({
            type: "image",
            imageId:
              imageId ||
              undefined,
            imageUrl,
            alt:
              safeString(
                block.alt
              ) ||
              undefined,
          });
        }

        return;
      }

      if (
        block.type !== "table" ||
        !Array.isArray(
          block.rows
        )
      ) {
        return;
      }

      const rows =
        block.rows
          .slice(0, 100)
          .map((rawRow) => {
            const row =
              asRecord(
                rawRow
              );
            const cells =
              Array.isArray(
                row.cells
              )
                ? row.cells
                    .slice(0, 30)
                    .map(
                      normalizeTableCell
                    )
                : [];

            return {
              cells,
            };
          })
          .filter(
            (row) =>
              row.cells.length > 0
          );

      if (rows.length === 0) {
        return;
      }

      const columnWidths =
        Array.isArray(
          block.columnWidths
        )
          ? block.columnWidths
              .map((width) =>
                safeNumber(
                  width,
                  0
                )
              )
              .filter(
                (width) =>
                  width > 0
              )
          : [];

      blocks.push({
        type: "table",
        rows,
        columnWidths:
          columnWidths.length > 0
            ? columnWidths
            : undefined,
      });
    });

  return blocks.length > 0
    ? blocks
    : undefined;
}

function buildQuestionImageUrl(
  imageId: unknown,
  imageUrl: unknown
): string | undefined {
  const directUrl = safeString(
    imageUrl
  );

  if (directUrl) {
    return directUrl;
  }

  const id = safeString(
    imageId
  );

  return id
    ? `/api/question-images/${encodeURIComponent(id)}`
    : undefined;
}

function normalizeQuestionImageUrl(
  question: Record<string, unknown>
): string | undefined {
  return buildQuestionImageUrl(
    question.questionImageId ??
      question.imageId,
    question.imageUrl ??
      question.questionImageUrl ??
      question.questionImage ??
      question.image ??
      question.mediaUrl
  );
}

function normalizeOptionFromRecord(
  option: Record<string, unknown>,
  fallbackId: ExamAnswerKey
): ExamSingleChoiceOption {
  const normalizedId =
    normalizeAnswerKey(
      option.id ??
        option.optionId ??
        option.key ??
        option.label
    ) ||
    fallbackId;

  const content =
    extractTextValue(
      option.content ??
        option.text ??
        option.value ??
        option.label ??
        option.answer ??
        option.optionContent ??
        option.data
    );

  return {
    id:
      normalizedId,

    content,
  };
}

function normalizeSingleChoiceOptions(
  question: Record<string, unknown>
): ExamSingleChoiceOption[] {
  if (Array.isArray(question.options)) {
    const optionMap = new Map<
      ExamAnswerKey,
      ExamSingleChoiceOption
    >();

    question.options
      .slice(0, 4)
      .forEach((item, index) => {
        const fallbackId =
          ANSWER_KEYS[index];

        if (!fallbackId) {
          return;
        }

        const option =
          normalizeOptionFromRecord(
            asRecord(item),
            fallbackId
          );

        optionMap.set(
          option.id,
          option
        );
      });

    return ANSWER_KEYS.map(
      (answerKey) =>
        optionMap.get(answerKey) || {
          id: answerKey,
          content: "",
        }
    );
  }

  return ANSWER_KEYS.map(
    (answerKey) => {
      return {
        id: answerKey,

       content:
  extractTextValue(
    question[answerKey] ??
      question[
        answerKey.toLowerCase()
      ] ??
      question[
        `option${answerKey}`
      ] ??
      question[
        `answer${answerKey}`
      ]
  ),
      };
    }
  );
}

function normalizeStatementFromRecord(
  statement: Record<string, unknown>,
  fallbackId: ExamAnswerKey
): ExamTrueFalseStatement {
  const normalizedId =
    normalizeAnswerKey(
      statement.id ??
        statement.statementId ??
        statement.key ??
        statement.label
    ) ||
    fallbackId;

  const content =
    extractTextValue(
      statement.content ??
        statement.text ??
        statement.value ??
        statement.label ??
        statement.statement ??
        statement.statementContent ??
        statement.data
    );

  return {
    id:
      normalizedId,

    content,
  };
}

function normalizeTrueFalseStatements(
  question: Record<string, unknown>
): ExamTrueFalseStatement[] {
  const rawStatements =
    Array.isArray(
      question.statements
    )
      ? question.statements
      : Array.isArray(
            question.trueFalseStatements
          )
        ? question.trueFalseStatements
        : [];

  if (rawStatements.length > 0) {
    const statementMap = new Map<
      ExamAnswerKey,
      ExamTrueFalseStatement
    >();

    rawStatements
      .slice(0, 4)
      .forEach((item, index) => {
        const fallbackId =
          ANSWER_KEYS[index];

        if (!fallbackId) {
          return;
        }

        const statement =
          normalizeStatementFromRecord(
            asRecord(item),
            fallbackId
          );

        statementMap.set(
          statement.id,
          statement
        );
      });

    return ANSWER_KEYS.map(
      (answerKey) =>
        statementMap.get(
          answerKey
        ) || {
          id: answerKey,
          content: "",
        }
    );
  }

  return ANSWER_KEYS.map(
    (answerKey) => {
      const imageUrl = safeString(
        question[
          `${answerKey}ImageUrl`
        ] ??
          question[
            `${answerKey.toLowerCase()}ImageUrl`
          ]
      );

      return {
        id: answerKey,

        content:
  extractTextValue(
    question[answerKey] ??
      question[
        answerKey.toLowerCase()
      ] ??
      question[
        `statement${answerKey}`
      ]
  ),

        ...(imageUrl
          ? {
              imageUrl,
            }
          : {}),
      };
    }
  );
}

function resolveSnapshotContainer(
  assignment: Record<string, unknown>
): Record<string, unknown> {
  const testSnapshot =
    asRecord(
      assignment.testSnapshot
    );

  if (
    Object.keys(testSnapshot)
      .length === 0
  ) {
    throw new ApiError(
      "Bài được giao chưa có bản đề đã xuất bản.",
      500
    );
  }

  return testSnapshot;
}

function findSectionsArray(
  testSnapshot: Record<string, unknown>
): unknown[] | null {
  if (
    Array.isArray(
      testSnapshot.sections
    )
  ) {
    return testSnapshot.sections;
  }

  const nestedSnapshot =
    asRecord(
      testSnapshot.testSnapshot
    );

  if (
    Array.isArray(
      nestedSnapshot.sections
    )
  ) {
    return nestedSnapshot.sections;
  }

  const nestedTest =
    asRecord(
      testSnapshot.test
    );

  if (
    Array.isArray(
      nestedTest.sections
    )
  ) {
    return nestedTest.sections;
  }

  const content =
    asRecord(
      testSnapshot.content
    );

  if (
    Array.isArray(
      content.sections
    )
  ) {
    return content.sections;
  }

  return null;
}

function findLegacyQuestionsArray(
  testSnapshot: Record<string, unknown>
): unknown[] | null {
  if (
    Array.isArray(
      testSnapshot.questions
    )
  ) {
    return testSnapshot.questions;
  }

  const nestedSnapshot =
    asRecord(
      testSnapshot.testSnapshot
    );

  if (
    Array.isArray(
      nestedSnapshot.questions
    )
  ) {
    return nestedSnapshot.questions;
  }

  const nestedTest =
    asRecord(
      testSnapshot.test
    );

  if (
    Array.isArray(
      nestedTest.questions
    )
  ) {
    return nestedTest.questions;
  }

  const content =
    asRecord(
      testSnapshot.content
    );

  if (
    Array.isArray(
      content.questions
    )
  ) {
    return content.questions;
  }

  return null;
}

function getDefaultSectionId(
  type: ExamQuestionType | null,
  index: number
): string {
  switch (type) {
    case "single_choice":
      return "part_1";

    case "true_false_group":
      return "part_2";

    case "short_answer":
      return "part_3";

    default:
      return `part_${index + 1}`;
  }
}

function getDefaultSectionTitle(
  sectionId: string,
  type: ExamQuestionType | null,
  index: number
): string {
  if (
    sectionId === "part_1" ||
    type === "single_choice"
  ) {
    return "Phần I";
  }

  if (
    sectionId === "part_2" ||
    type === "true_false_group"
  ) {
    return "Phần II";
  }

  if (
    sectionId === "part_3" ||
    type === "short_answer"
  ) {
    return "Phần III";
  }

  return `Phần ${index + 1}`;
}

function buildSectionsFromLegacyQuestions(
  rawQuestions: unknown[]
): RawExamSection[] {
  const sectionMap =
    new Map<
      string,
      RawExamSection
    >();

  rawQuestions.forEach(
    (item, questionIndex) => {
      const question =
        asRecord(item);

      const questionType =
        normalizeQuestionType(
          question.type ??
            question.questionType,
          null
        );

      const sectionId =
        safeString(
          question.sectionId ??
            question.partId ??
            question.section
        ) ||
        getDefaultSectionId(
          questionType,
          questionIndex
        );

      const sectionTitle =
        safeString(
          question.sectionTitle ??
            question.partTitle
        ) ||
        getDefaultSectionTitle(
          sectionId,
          questionType,
          questionIndex
        );

      const existingSection =
        sectionMap.get(
          sectionId
        );

      if (existingSection) {
        existingSection.questions.push(
          item
        );

        if (
          !existingSection.type &&
          questionType
        ) {
          existingSection.type =
            questionType;
        }

        return;
      }

      sectionMap.set(
        sectionId,
        {
          id: sectionId,
          title: sectionTitle,
          type:
            questionType ||
            undefined,
          questions: [item],
        }
      );
    }
  );

  return Array.from(
    sectionMap.values()
  );
}

function normalizeSectionItem(
  item: unknown,
  sectionIndex: number
): RawExamSection {
  const section =
    asRecord(item);

  const sectionId =
    safeString(
      section.id ??
        section.sectionId ??
        section.partId
    ) ||
    `part_${sectionIndex + 1}`;

  const sectionTitle =
    safeString(
      section.title ??
        section.sectionTitle ??
        section.name ??
        section.partTitle
    ) ||
    `Phần ${sectionIndex + 1}`;

  const sectionType =
    isExamQuestionType(
      section.type
    )
      ? section.type
      : isExamQuestionType(
            section.questionType
          )
        ? section.questionType
        : undefined;

  const questions =
    Array.isArray(
      section.questions
    )
      ? section.questions
      : Array.isArray(
            section.items
          )
        ? section.items
        : [];

  return {
    id: sectionId,
    title: sectionTitle,
    type: sectionType,
    questions,
  };
}

function normalizeRawSections(
  assignment: Record<string, unknown>
): RawExamSection[] {
  const testSnapshot =
    resolveSnapshotContainer(
      assignment
    );

  const rawSections =
    findSectionsArray(
      testSnapshot
    );

  if (rawSections) {
    const sections =
      rawSections.map(
        normalizeSectionItem
      );

    if (
      sections.some(
        (section) =>
          section.questions.length >
          0
      )
    ) {
      return sections;
    }
  }

  /*
   * Hỗ trợ assignment cũ chỉ lưu
   * testSnapshot.questions.
   *
   * Dữ liệu vẫn chỉ được đọc từ
   * assignment.testSnapshot.
   */
  const legacyQuestions =
    findLegacyQuestionsArray(
      testSnapshot
    );

  if (
    legacyQuestions &&
    legacyQuestions.length > 0
  ) {
    return buildSectionsFromLegacyQuestions(
      legacyQuestions
    );
  }



  throw new ApiError(
    "Dữ liệu đề đã xuất bản không có sections hoặc questions hợp lệ.",
    500
  );
}

function normalizeSnapshotQuestions(
  assignment: Record<string, unknown>
): SnapshotExamData {
  const rawSections =
    normalizeRawSections(
      assignment
    );

  const questions: ExamQuestion[] =
    [];

  const questionIds =
    new Set<string>();

  let globalQuestionNumber =
    1;

  rawSections.forEach(
    (section) => {
      section.questions.forEach(
        (
          rawQuestion,
          questionIndex
        ) => {
          const questionWrapper =
            asRecord(
              rawQuestion
            );

          const snapshot =
            asRecord(
              questionWrapper.snapshot
            );

          /*
           * Câu hỏi được lưu dưới dạng:
           *
           * {
           *   id,
           *   score,
           *   order,
           *   snapshot: {
           *     type,
           *     content,
           *     options,
           *     statements
           *   }
           * }
           *
           * Nếu assignment cũ không có snapshot,
           * sử dụng trực tiếp questionWrapper.
           */
          const questionContent =
            Object.keys(
              snapshot
            ).length > 0
              ? snapshot
              : questionWrapper;

          const questionType =
            normalizeQuestionType(
              questionContent.type ??
                questionContent.questionType,
              section.type
            );

          if (!questionType) {
            throw new ApiError(
              `Câu hỏi ${
                questionIndex + 1
              } trong "${section.title}" chưa có loại hợp lệ.`,
              500
            );
          }

          const baseQuestionId =
            normalizeQuestionId(
              questionWrapper,
              section.id,
              questionIndex
            );

          let questionId =
            baseQuestionId;

          let duplicateIndex =
            2;

          while (
            questionIds.has(
              questionId
            )
          ) {
            questionId =
              `${baseQuestionId}-${duplicateIndex}`;

            duplicateIndex +=
              1;
          }

          questionIds.add(
            questionId
          );

          const storedQuestionNumber =
            safeNumber(
              questionWrapper.questionNumber ??
                questionContent.questionNumber,
              globalQuestionNumber
            );

          const questionNumber =
            storedQuestionNumber >
            0
              ? storedQuestionNumber
              : globalQuestionNumber;

          const score =
            Math.max(
              0,
              safeNumber(
                questionWrapper.score ??
                  questionWrapper.points ??
                  questionContent.score ??
                  questionContent.points,
                0
              )
            );

          const imageUrl =
            normalizeQuestionImageUrl(
              questionContent
            );
          const contentBlocks =
            normalizeQuestionContentBlocks(
              questionContent.contentBlocks
            );

          const baseQuestion = {
            id:
              questionId,

            type:
              questionType,

            questionNumber,

            sectionId:
              section.id,

            sectionTitle:
              section.title,

            content:
              normalizeQuestionContent(
                questionContent
              ),

            ...(contentBlocks
              ? {
                  contentBlocks,
                }
              : {}),

            score,

            ...(imageUrl
              ? {
                  imageUrl,
                }
              : {}),
          };

          switch (
            questionType
          ) {
            case "single_choice": {
              questions.push({
                ...baseQuestion,

                type:
                  "single_choice",

                options:
                  normalizeSingleChoiceOptions(
                    questionContent
                  ),
              });

              break;
            }

            case "true_false_group": {
              questions.push({
                ...baseQuestion,

                type:
                  "true_false_group",

                statements:
                  normalizeTrueFalseStatements(
                    questionContent
                  ),
              });

              break;
            }

            case "short_answer": {
              questions.push({
                ...baseQuestion,

                type:
                  "short_answer",
              });

              break;
            }
          }

          globalQuestionNumber +=
            1;
        }
      );
    }
  );

  if (
    questions.length ===
    0
  ) {
    throw new ApiError(
      "Đề kiểm tra này chưa có câu hỏi trong bản đề đã xuất bản.",
      404
    );
  }

  return {
    questions,

    sectionIds:
      rawSections.map(
        (section) =>
          section.id
      ),
  };
}

function getAllowedClassIds(
  assignment: Record<string, unknown>
): string[] {
  const classSnapshots =
    Array.isArray(
      assignment.classSnapshots
    )
      ? assignment.classSnapshots
      : [];

  const snapshotClassIds =
    classSnapshots
      .map((item) => {
        const snapshot =
          asRecord(item);

        return safeString(
          snapshot.id ??
            snapshot.classId
        );
      })
      .filter(Boolean);

  if (
    snapshotClassIds.length > 0
  ) {
    return Array.from(
      new Set(
        snapshotClassIds
      )
    );
  }

  const classIds =
    normalizeStringArray(
      assignment.classIds
    );

  if (
    classIds.length > 0
  ) {
    return classIds;
  }

  const legacyClassId =
    safeString(
      assignment.classId
    );

  return legacyClassId
    ? [legacyClassId]
    : [];
}

async function findAssignment(params: {
  assignmentId: string;
  assignmentCode: string;
}) {
  const db =
    getAdminDb();

  if (params.assignmentId) {
    for (const collectionName of [
      "assignments",
      "testAssignments",
    ]) {
      const assignmentDoc =
        await db
          .collection(
            collectionName
          )
          .doc(
            params.assignmentId
          )
          .get();

      if (
        assignmentDoc.exists
      ) {
        return assignmentDoc;
      }
    }
  }

  if (
    params.assignmentCode
  ) {
    for (const collectionName of [
      "assignments",
      "testAssignments",
    ]) {
      const snapshot =
        await db
          .collection(
            collectionName
          )
          .where(
            "assignmentCode",
            "==",
            params.assignmentCode
          )
          .limit(1)
          .get();

      if (!snapshot.empty) {
        return snapshot.docs[0];
      }
    }
  }

  throw new ApiError(
    "Không tìm thấy bài kiểm tra được giao.",
    404
  );
}

async function findStudent(params: {
  classIds: string[];
  studentCode: string;
}) {
  const db =
    getAdminDb();

  const snapshots =
    await Promise.all(
      params.classIds.map(
        (classId) =>
          db
            .collection(
              "students"
            )
            .where(
              "classId",
              "==",
              classId
            )
            .where(
              "studentCode",
              "==",
              params.studentCode
            )
            .limit(1)
            .get()
      )
    );

  const matchedSnapshot =
    snapshots.find(
      (snapshot) =>
        !snapshot.empty
    );

  if (!matchedSnapshot) {
    throw new ApiError(
      "Không tìm thấy học sinh trong các lớp được giao đề.",
      404
    );
  }

  return matchedSnapshot
    .docs[0];
}

function verifyAssignmentPassword(
  assignment: Record<string, unknown>,
  password: string
) {
  const access =
    asRecord(
      assignment.access
    );

  const passwordHash =
    safeString(
      access.passwordHash ??
        assignment.passwordHash
    );

  const legacyPassword =
    safeString(
      access.password ??
        assignment.password
    );

  if (
    passwordHash &&
    !verifyPassword(
      password,
      passwordHash
    )
  ) {
    throw new ApiError(
      "Mật khẩu bài kiểm tra không đúng.",
      403
    );
  }

  if (
    !passwordHash &&
    legacyPassword &&
    legacyPassword !== password
  ) {
    throw new ApiError(
      "Mật khẩu bài kiểm tra không đúng.",
      403
    );
  }
}

function buildInitialQuestionOrder(
  questions: ExamQuestion[],
  shuffleQuestions: boolean
): string[] {
  const sectionOrder =
    Array.from(
      new Set(
        questions.map(
          (question) =>
            question.sectionId
        )
      )
    );

  return sectionOrder.flatMap(
    (sectionId) => {
      const questionIds =
        questions
          .filter(
            (question) =>
              question.sectionId ===
              sectionId
          )
          .map(
            (question) =>
              question.id
          );

      return shuffleQuestions
        ? shuffleArray(
            questionIds
          )
        : questionIds;
    }
  );
}

function normalizeQuestionOrder(
  value: unknown,
  questions: ExamQuestion[]
): string[] {
  const availableIds =
    new Set(
      questions.map(
        (question) =>
          question.id
      )
    );

  const storedOrder =
    normalizeStringArray(
      value
    ).filter(
      (questionId) =>
        availableIds.has(
          questionId
        )
    );

  const storedIdSet =
    new Set(
      storedOrder
    );

  const missingIds =
    questions
      .map(
        (question) =>
          question.id
      )
      .filter(
        (questionId) =>
          !storedIdSet.has(
            questionId
          )
      );

  return [
    ...storedOrder,
    ...missingIds,
  ];
}

function buildInitialOptionOrders(
  questions: ExamQuestion[],
  shuffleOptions: boolean
): Record<
  string,
  ExamAnswerKey[]
> {
  const optionOrders: Record<
    string,
    ExamAnswerKey[]
  > = {};

  questions.forEach(
    (question) => {
      if (
        question.type !==
        "single_choice"
      ) {
        return;
      }

      optionOrders[
        question.id
      ] = shuffleOptions
        ? shuffleArray(
            ANSWER_KEYS
          )
        : [...ANSWER_KEYS];
    }
  );

  return optionOrders;
}

function normalizeOptionOrders(
  value: unknown,
  questions: ExamQuestion[]
): Record<
  string,
  ExamAnswerKey[]
> {
  const storedOrders =
    asRecord(value);

  const normalizedOrders: Record<
    string,
    ExamAnswerKey[]
  > = {};

  questions.forEach(
    (question) => {
      if (
        question.type !==
        "single_choice"
      ) {
        return;
      }

      const rawOrder =
        storedOrders[
          question.id
        ];

      const validOrder =
        Array.isArray(
          rawOrder
        )
          ? Array.from(
              new Set(
                rawOrder
                  .map(
                    normalizeAnswerKey
                  )
                  .filter(
                    (
                      answerKey
                    ): answerKey is ExamAnswerKey =>
                      Boolean(
                        answerKey
                      )
                  )
              )
            )
          : [];

      ANSWER_KEYS.forEach(
        (answerKey) => {
          if (
            !validOrder.includes(
              answerKey
            )
          ) {
            validOrder.push(
              answerKey
            );
          }
        }
      );

      normalizedOrders[
        question.id
      ] = validOrder.slice(
        0,
        4
      );
    }
  );

  return normalizedOrders;
}

function normalizeTrueFalseAnswer(
  value: unknown
): Partial<
  Record<
    ExamAnswerKey,
    boolean
  >
> {
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

  const answer =
    asRecord(value);

  const normalized: Partial<
    Record<
      ExamAnswerKey,
      boolean
    >
  > = {};

  ANSWER_KEYS.forEach(
    (answerKey) => {
      const rawValue =
        answer[answerKey] ??
        answer[
          answerKey.toLowerCase()
        ];

      const normalizedValue =
        normalizeTrueFalseValue(
          rawValue
        );

      if (typeof normalizedValue === "boolean") {
        normalized[
          answerKey
        ] = normalizedValue;
      }
    }
  );

  return normalized;
}

function normalizeStudentAnswer(
  question: ExamQuestion,
  value: unknown
): ExamStudentAnswer | null {
  switch (
    question.type
  ) {
    case "single_choice": {
      const answer =
        normalizeAnswerKey(
          value
        );

      return answer || null;
    }

    case "true_false_group": {
      const answer =
        normalizeTrueFalseAnswer(
          value
        );

      return Object.keys(
        answer
      ).length > 0
        ? answer
        : null;
    }

    case "short_answer": {
      const answer =
        safeString(value);

      return answer || null;
    }
  }
}

function normalizeExamAnswers(
  value: unknown,
  questions: ExamQuestion[]
): ExamAnswers {
  const rawAnswers =
    asRecord(value);

  const answers: ExamAnswers =
    {};

  questions.forEach(
    (question) => {
      const normalizedAnswer =
        normalizeStudentAnswer(
          question,
          rawAnswers[
            question.id
          ]
        );

      if (
        normalizedAnswer !== null
      ) {
        answers[
          question.id
        ] = normalizedAnswer;
      }
    }
  );

  return answers;
}

function orderQuestions(
  questions: ExamQuestion[],
  questionOrder: string[]
): ExamQuestion[] {
  const questionMap =
    new Map(
      questions.map(
        (question) => [
          question.id,
          question,
        ]
      )
    );

  return questionOrder
    .map(
      (questionId) =>
        questionMap.get(
          questionId
        )
    )
    .filter(
      (
        question
      ): question is ExamQuestion =>
        Boolean(question)
    )
    .map(
      (
        question,
        index
      ) => ({
        ...question,

        questionNumber:
          index + 1,
      })
    );
}

function getAttemptExpiration(
  attempt: Record<string, unknown>
): Date | null {
  const expiresAt =
    safeString(
      attempt.expiresAt
    );

  if (!expiresAt) {
    return null;
  }

  const expiresAtDate =
    new Date(
      expiresAt
    );

  if (
    Number.isNaN(
      expiresAtDate.getTime()
    )
  ) {
    return null;
  }

  return expiresAtDate;
}

async function readRequestBody(
  request: Request
): Promise<
  Record<string, unknown>
> {
  try {
    return asRecord(
      await request.json()
    );
  } catch {
    throw new ApiError(
      "Dữ liệu gửi lên không hợp lệ.",
      400
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await readRequestBody(
        request
      );

    const assignmentId =
      safeString(
        body.assignmentId
      );

    const assignmentCode =
      safeUpper(
        body.assignmentCode
      );

    const studentCode =
      safeUpper(
        body.studentCode
      );

    const password =
      safeString(
        body.password
      );

    if (
      !assignmentId &&
      !assignmentCode
    ) {
      throw new ApiError(
        "Thiếu thông tin bài được giao.",
        400
      );
    }

    if (!studentCode) {
      throw new ApiError(
        "Vui lòng nhập mã học sinh.",
        400
      );
    }

    const db =
      getAdminDb();

    const assignmentDoc =
      await findAssignment({
        assignmentId,
        assignmentCode,
      });

    const assignment =
      asRecord(
        assignmentDoc.data()
      );

    const realAssignmentId =
      assignmentDoc.id;

    const accessResult =
      deriveExamAccessState(
        assignment
      );

    if (
      accessResult.state !==
      "available"
    ) {
      throw new ApiError(
        accessResult.message,
        403
      );
    }

    verifyAssignmentPassword(
      assignment,
      password
    );

    const assignmentInfo =
      buildExamAssignmentInfo(
        realAssignmentId,
        assignment
      );

    const allowedClassIds =
      getAllowedClassIds(
        assignment
      );

    if (
      allowedClassIds.length ===
      0
    ) {
      throw new ApiError(
        "Giao đề này chưa có lớp hợp lệ.",
        403
      );
    }

    const studentDoc =
      await findStudent({
        classIds:
          allowedClassIds,

        studentCode,
      });

    const student =
      asRecord(
        studentDoc.data()
      );

    if (
      safeString(
        student.status
      ) !== "active"
    ) {
      throw new ApiError(
        "Tài khoản học sinh này đang bị khóa.",
        403
      );
    }

    const studentClassId =
      safeString(
        student.classId
      );

    if (
      !allowedClassIds.includes(
        studentClassId
      )
    ) {
      throw new ApiError(
        "Bạn không thuộc lớp được giao đề này.",
        403
      );
    }

    /*
     * Nguồn câu hỏi duy nhất:
     *
     * assignment.testSnapshot
     *
     * Không đọc question bank.
     * Không đọc tests.questions.
     */
    const {
      questions:
        snapshotQuestions,
    } =
      normalizeSnapshotQuestions(
        assignment
      );

    const maxAttempts =
      assignmentInfo.maxAttempts;

    const resultSnapshot =
      await db
        .collection(
          "results"
        )
        .where(
          "assignmentId",
          "==",
          realAssignmentId
        )
        .where(
          "studentCode",
          "==",
          studentCode
        )
        .get();

    if (
      resultSnapshot.size >=
      maxAttempts
    ) {
      throw new ApiError(
        `Học sinh này đã hết số lượt làm bài. Số lượt tối đa: ${maxAttempts}.`,
        403
      );
    }

    const activeAttemptSnapshot =
      await db
        .collection(
          "examAttempts"
        )
        .where(
          "assignmentId",
          "==",
          realAssignmentId
        )
        .where(
          "studentCode",
          "==",
          studentCode
        )
        .where(
          "status",
          "==",
          "in_progress"
        )
        .limit(1)
        .get();

    let attemptId = "";

    let attempt:
      Record<string, unknown> |
      null = null;

    let resumed = false;

    if (
      !activeAttemptSnapshot.empty
    ) {
      const activeAttemptDoc =
        activeAttemptSnapshot
          .docs[0];

      const activeAttempt =
        asRecord(
          activeAttemptDoc.data()
        );

      const expiresAt =
        getAttemptExpiration(
          activeAttempt
        );

      if (
        expiresAt &&
        expiresAt.getTime() >
          Date.now()
      ) {
        attemptId =
          activeAttemptDoc.id;

        attempt =
          activeAttempt;

        resumed = true;
      } else {
        await activeAttemptDoc
          .ref
          .update({
            status:
              "expired",

            updatedAt:
              new Date()
                .toISOString(),
          });
      }
    }

    if (!attempt) {
      const now =
        new Date();

      const expiresAt =
        new Date(
          now.getTime() +
            assignmentInfo
              .durationMinutes *
              60 *
              1000
        );

      const questionOrder =
        buildInitialQuestionOrder(
          snapshotQuestions,
          assignmentInfo
            .shuffleQuestions
        );

      const optionOrders =
        buildInitialOptionOrders(
          snapshotQuestions,
          assignmentInfo
            .shuffleOptions
        );

      const attemptRef =
        db
          .collection(
            "examAttempts"
          )
          .doc();

      attemptId =
        attemptRef.id;

      attempt = {
        assignmentId:
          realAssignmentId,

        assignmentCode:
          assignmentInfo
            .assignmentCode,

        testId:
          assignmentInfo.testId,

        testVersionNumber:
          assignmentInfo
            .versionNumber,

        studentId:
          studentDoc.id,

        studentCode,

        studentName:
          safeString(
            student.studentName
          ),

        classId:
          studentClassId,

        className:
          safeString(
            student.className
          ),

        teacherEmail:
          safeString(
            assignment.teacherEmail
          ),

        schoolId:
          safeString(
            assignment.schoolId
          ),

        attemptNumber:
          resultSnapshot.size + 1,

        status:
          "in_progress",

        startedAt:
          now.toISOString(),

        expiresAt:
          expiresAt.toISOString(),

        submittedAt:
          "",

        questionOrder,

        optionOrders,

        answers: {},

        bookmarkedQuestionIds:
          [],

        currentQuestionIndex:
          0,

        antiCheat: {
          visibilityLostCount:
            0,

          focusLostCount:
            0,

          suspiciousEvents:
            [],
        },

        createdAt:
          now.toISOString(),

        updatedAt:
          now.toISOString(),
      };

      await attemptRef.set(
        attempt
      );
    }

    const questionOrder =
      normalizeQuestionOrder(
        attempt.questionOrder,
        snapshotQuestions
      );

    const optionOrders =
      normalizeOptionOrders(
        attempt.optionOrders,
        snapshotQuestions
      );

    const answers =
      normalizeExamAnswers(
        attempt.answers,
        snapshotQuestions
      );

    const orderedQuestions =
      orderQuestions(
        snapshotQuestions,
        questionOrder
      );

    const expiresAtDate =
      getAttemptExpiration(
        attempt
      );

    const remainingSeconds =
      expiresAtDate
        ? Math.max(
            0,
            Math.ceil(
              (
                expiresAtDate.getTime() -
                Date.now()
              ) / 1000
            )
          )
        : 0;

    if (
      remainingSeconds <= 0
    ) {
      await db
        .collection(
          "examAttempts"
        )
        .doc(
          attemptId
        )
        .update({
          status:
            "expired",

          updatedAt:
            new Date()
              .toISOString(),
        });

      throw new ApiError(
        "Phiên làm bài đã hết thời gian.",
        403
      );
    }

    if (resumed) {
      await db
        .collection(
          "examAttempts"
        )
        .doc(
          attemptId
        )
        .update({
          questionOrder,
          optionOrders,
          answers,

          updatedAt:
            new Date()
              .toISOString(),
        });
    }

    const attemptAntiCheat =
      asRecord(
        attempt.antiCheat
      );

    return NextResponse.json({
      status:
        "success",

      resumed,

      attempt: {
        id:
          attemptId,

        status:
          safeString(
            attempt.status
          ) ||
          "in_progress",

        attemptNumber:
          Math.max(
            1,
            safeNumber(
              attempt.attemptNumber,
              1
            )
          ),

        startedAt:
          safeString(
            attempt.startedAt
          ),

        expiresAt:
          safeString(
            attempt.expiresAt
          ),

        remainingSeconds,

        answers,

        bookmarkedQuestionIds:
          normalizeStringArray(
            attempt
              .bookmarkedQuestionIds
          ),

        currentQuestionIndex:
          Math.max(
            0,
            safeNumber(
              attempt
                .currentQuestionIndex,
              0
            )
          ),

        questionOrder,

        optionOrders,

        antiCheat: {
          visibilityLostCount:
            Math.max(
              0,
              safeNumber(
                attemptAntiCheat
                  .visibilityLostCount
              )
            ),

          focusLostCount:
            Math.max(
              0,
              safeNumber(
                attemptAntiCheat
                  .focusLostCount
              )
            ),

          suspiciousEvents:
            Array.isArray(
              attemptAntiCheat
                .suspiciousEvents
            )
              ? attemptAntiCheat
                  .suspiciousEvents
              : [],
        },
      },

      assignment:
        assignmentInfo,

      student: {
        id:
          studentDoc.id,

        studentCode:
          safeString(
            student.studentCode
          ) ||
          studentCode,

        studentName:
          safeString(
            student.studentName
          ),

        gender:
          safeString(
            student.gender
          ),

        classId:
          studentClassId,

        className:
          safeString(
            student.className
          ),

        status:
          "active",
      },

      questions:
        orderedQuestions,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "POST /api/student/start error:",
      error
    );

    const apiError =
      error instanceof ApiError
        ? error
        : null;

    return NextResponse.json(
      {
        status:
          "error",

        message:
          apiError?.message ||
          (error instanceof Error
            ? error.message
            : "Không bắt đầu được bài làm."),
      },
      {
        status:
          apiError?.statusCode ||
          500,
      }
    );
  }
}
