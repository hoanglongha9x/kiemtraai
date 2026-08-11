import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase/client";

import {
  calculateTestSummary,
} from "../utils";

import type {
  CreateTestInput,
  DuplicateTestInput,
  ListTestsInput,
  ListTestsResult,
  TestData,
  TestListCursor,
  TestListFilters,
  TestListItem,
  TestListSort,
  TestOwner,
  TestSection,
  UpdateTestInput,
} from "../types";

const TESTS_COLLECTION =
  "tests";

const DEFAULT_PAGE_SIZE =
  20;

const MAX_PAGE_SIZE =
  100;

const DEFAULT_FILTERS:
  TestListFilters = {
    search: "",
    status: "all",
    visibility: "all",
    subject: "",
    grade: "",
    sort: "updated_desc",
  };

type FirestoreRecord = {
  [key: string]: unknown;
};

function createIsoDate(): string {
  return new Date().toISOString();
}

function createLocalId(
  prefix: string
): string {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function cleanOptionalString(
  value:
    string | undefined
): string | undefined {
  const normalized =
    value?.trim();

  return normalized
    ? normalized
    : undefined;
}

function cleanStringArray(
  values:
    string[] | undefined
): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) =>
          value.trim()
        )
        .filter(Boolean)
    )
  );
}

function removeUndefinedValues(
  value: unknown
): unknown {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      removeUndefinedValues
    );
  }

  if (
    value &&
    typeof value ===
      "object" &&
    !(value instanceof Date)
  ) {
    return Object.fromEntries(
      Object.entries(
        value as FirestoreRecord
      )
        .filter(
          (
            [, entryValue]
          ) =>
            entryValue !==
            undefined
        )
        .map(
          (
            [key, entryValue]
          ) => [
            key,
            removeUndefinedValues(
              entryValue
            ),
          ]
        )
    );
  }

  return value;
}

function normalizePageSize(
  pageSize:
    number | undefined
): number {
  if (
    pageSize === undefined ||
    !Number.isInteger(
      pageSize
    )
  ) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    Math.max(
      pageSize,
      1
    ),
    MAX_PAGE_SIZE
  );
}

function normalizeOwner(
  owner:
    TestOwner
): TestOwner {
  return {
    uid:
      owner.uid.trim(),

    email:
      owner.email
        .trim()
        .toLowerCase(),

    name:
      cleanOptionalString(
        owner.name
      ),

    schoolId:
      cleanOptionalString(
        owner.schoolId
      ),
  };
}

function normalizeSections(
  sections:
    TestSection[]
): TestSection[] {
  return sections.map(
    (
      section,
      sectionIndex
    ) => ({
      ...section,

      id:
        section.id ||
        createLocalId(
          "section"
        ),

      title:
        section.title.trim(),

      description:
        cleanOptionalString(
          section.description
        ),

      order:
        sectionIndex,

      scorePerQuestion:
        Number(
          section.scorePerQuestion
        ),

      questions:
        section.questions.map(
          (
            question,
            questionIndex
          ) => ({
            ...question,

            id:
              question.id ||
              createLocalId(
                "test-question"
              ),

            order:
              questionIndex,

            score:
              Number(
                question.score
              ),
          })
        ),
    })
  );
}

function normalizeCreateInput(
  input:
    CreateTestInput,

  now:
    string
): CreateTestInput {
  const sections =
    normalizeSections(
      input.sections
    );

  const summary =
    calculateTestSummary(
      sections
    );

  return {
    ...input,

    title:
      input.title.trim(),

    description:
      cleanOptionalString(
        input.description
      ),

    instructions:
      cleanOptionalString(
        input.instructions
      ),

    durationMinutes:
      Number(
        input.durationMinutes
      ),

    metadata: {
      subject:
        input.metadata.subject.trim(),

      grade:
        input.metadata.grade.trim(),

      topics:
        cleanStringArray(
          input.metadata.topics
        ),

      tags:
        cleanStringArray(
          input.metadata.tags
        ),
    },

    sections,

    settings: {
      ...input.settings,
    },

    owner:
      normalizeOwner(
        input.owner
      ),

    version: {
      ...input.version,

      number:
        Math.max(
          1,
          Number(
            input.version.number
          ) || 1
        ),

      createdAt:
        input.version.createdAt ||
        now,

      publishedAt:
        cleanOptionalString(
          input.version.publishedAt
        ),
    },

    totalScore:
      summary.totalScore,

    totalQuestions:
      summary.totalQuestions,
  };
}

function mapDocumentToTest(
  id: string,
  data:
    DocumentData
): TestData {
  return {
    ...(data as Omit<
      TestData,
      "id"
    >),

    id,
  };
}

function mapTestToListItem(
  test:
    TestData
): TestListItem {
  return {
    id:
      test.id,

    title:
      test.title,

    description:
      test.description,

    subject:
      test.metadata.subject,

    grade:
      test.metadata.grade,

    status:
      test.status,

    visibility:
      test.visibility,

    durationMinutes:
      test.durationMinutes,

    totalScore:
      test.totalScore,

    totalQuestions:
      test.totalQuestions,

    versionNumber:
      test.version.number,

    createdAt:
      test.createdAt,

    updatedAt:
      test.updatedAt,

    publishedAt:
      test.publishedAt,
  };
}

function getSortConfiguration(
  sort:
    TestListSort
): {
  field: string;
  direction: "asc" | "desc";
} {
  switch (sort) {
    case "updated_asc":
      return {
        field:
          "updatedAt",

        direction:
          "asc",
      };

    case "created_desc":
      return {
        field:
          "createdAt",

        direction:
          "desc",
      };

    case "created_asc":
      return {
        field:
          "createdAt",

        direction:
          "asc",
      };

    case "title_asc":
      return {
        field:
          "titleNormalized",

        direction:
          "asc",
      };

    case "title_desc":
      return {
        field:
          "titleNormalized",

        direction:
          "desc",
      };

    case "updated_desc":
    default:
      return {
        field:
          "updatedAt",

        direction:
          "desc",
      };
  }
}

function getCursorValue(
  test:
    TestData,

  sort:
    TestListSort
): string {
  switch (sort) {
    case "created_desc":
    case "created_asc":
      return test.createdAt;

    case "title_asc":
    case "title_desc":
      return test.title
        .trim()
        .toLowerCase();

    case "updated_asc":
    case "updated_desc":
    default:
      return test.updatedAt;
  }
}

function normalizeSearch(
  value:
    string
): string {
  return value
    .trim()
    .toLowerCase();
}

function matchesSearch(
  test:
    TestData,

  search:
    string
): boolean {
  if (!search) {
    return true;
  }

  const searchableText = [
    test.title,
    test.description ?? "",
    test.metadata.subject,
    test.metadata.grade,
    ...test.metadata.topics,
    ...test.metadata.tags,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(
    search
  );
}

async function readOwnedTest(
  testId:
    string,

  ownerUid:
    string
): Promise<TestData> {
  const normalizedTestId =
    testId.trim();

  const normalizedOwnerUid =
    ownerUid.trim();

  if (!normalizedTestId) {
    throw new Error(
      "Thiếu mã đề kiểm tra."
    );
  }

  if (!normalizedOwnerUid) {
    throw new Error(
      "Không xác định được giáo viên sở hữu đề."
    );
  }

  const testReference =
    doc(
      db,
      TESTS_COLLECTION,
      normalizedTestId
    );

  const snapshot =
    await getDoc(
      testReference
    );

  if (!snapshot.exists()) {
    throw new Error(
      "Không tìm thấy đề kiểm tra."
    );
  }

  const test =
    mapDocumentToTest(
      snapshot.id,
      snapshot.data()
    );

  if (
    !test.owner?.uid ||
    test.owner.uid !==
      normalizedOwnerUid
  ) {
    throw new Error(
      "Bạn không có quyền truy cập đề kiểm tra này."
    );
  }

  return test;
}

function createListConstraints(
  ownerUid:
    string,

  filters:
    TestListFilters,

  pageSize:
    number,

  cursor:
    TestListCursor | null | undefined
): QueryConstraint[] {
  const constraints:
    QueryConstraint[] = [
      where(
        "owner.uid",
        "==",
        ownerUid
      ),
    ];

  if (
    filters.status !==
    "all"
  ) {
    constraints.push(
      where(
        "status",
        "==",
        filters.status
      )
    );
  }

  if (
    filters.visibility !==
    "all"
  ) {
    constraints.push(
      where(
        "visibility",
        "==",
        filters.visibility
      )
    );
  }

  const normalizedSubject =
    filters.subject.trim();

  if (normalizedSubject) {
    constraints.push(
      where(
        "metadata.subject",
        "==",
        normalizedSubject
      )
    );
  }

  const normalizedGrade =
    filters.grade.trim();

  if (normalizedGrade) {
    constraints.push(
      where(
        "metadata.grade",
        "==",
        normalizedGrade
      )
    );
  }

  const sortConfiguration =
    getSortConfiguration(
      filters.sort
    );

  constraints.push(
    orderBy(
      sortConfiguration.field,
      sortConfiguration.direction
    )
  );

  constraints.push(
    orderBy(
      documentId(),
      sortConfiguration.direction
    )
  );

  if (cursor) {
    constraints.push(
      startAfter(
        cursor.value,
        cursor.id
      )
    );
  }

  constraints.push(
    limit(
      pageSize + 1
    )
  );

  return constraints;
}

export async function createTest(
  input: CreateTestInput
): Promise<TestData> {
  const now =
    createIsoDate();

  const normalizedInput =
    normalizeCreateInput(
      input,
      now
    );

  if (
    !normalizedInput.owner.uid
  ) {
    throw new Error(
      "Không xác định được giáo viên tạo đề."
    );
  }

  if (
    !normalizedInput.owner.email
  ) {
    throw new Error(
      "Tài khoản giáo viên chưa có email."
    );
  }

  const testReference =
    doc(
      collection(
        db,
        TESTS_COLLECTION
      )
    );

  /*
   * Đề mới luôn được tạo ở trạng thái draft.
   * Publish phải được thực hiện qua backend.
   */
  const test:
    TestData = {
      ...normalizedInput,

      id:
        testReference.id,

      status:
        "draft",

      owner:
        normalizedInput.owner,

      version: {
        ...normalizedInput.version,

        number:
          1,

        status:
          "draft",

        createdAt:
          normalizedInput
            .version
            .createdAt ||
          now,

        publishedAt:
          undefined,
      },

      createdAt:
        now,

      updatedAt:
        now,

      publishedAt:
        undefined,

      archivedAt:
        undefined,
  };

  const firestoreData =
    removeUndefinedValues({
      ...test,

      titleNormalized:
        test.title
          .trim()
          .toLowerCase(),

      /*
       * Các field tương thích backend
       * và dữ liệu cũ.
       */
      createdBy:
        test.owner.uid,

      updatedBy:
        test.owner.uid,

      teacherEmail:
        test.owner.email,

      teacherName:
        test.owner.name,

      schoolId:
        test.owner.schoolId,

      subject:
        test.metadata.subject,

      grade:
        test.metadata.grade,

      duration:
        test.durationMinutes,

      questionCount:
        test.totalQuestions,

      schemaVersion:
        3,

      testFormat:
        "three_part",
    }) as DocumentData;

  await setDoc(
    testReference,
    firestoreData
  );

  return test;
}

export async function getTest(
  testId:
    string,

  ownerUid:
    string
): Promise<TestData> {
  return readOwnedTest(
    testId,
    ownerUid
  );
}

export async function listTests({
  ownerUid,
  filters:
    partialFilters,
  pageSize:
    requestedPageSize,
  cursor,
}: ListTestsInput): Promise<ListTestsResult> {
  const normalizedOwnerUid =
    ownerUid.trim();

  if (!normalizedOwnerUid) {
    throw new Error(
      "Không xác định được giáo viên."
    );
  }

  const filters:
    TestListFilters = {
      ...DEFAULT_FILTERS,
      ...partialFilters,
    };

  const pageSize =
    normalizePageSize(
      requestedPageSize
    );

  const testsQuery =
    query(
      collection(
        db,
        TESTS_COLLECTION
      ),

      ...createListConstraints(
        normalizedOwnerUid,
        filters,
        pageSize,
        cursor
      )
    );

  const snapshot =
    await getDocs(
      testsQuery
    );

  const loadedTests =
    snapshot.docs.map(
      (
        documentSnapshot
      ) =>
        mapDocumentToTest(
          documentSnapshot.id,
          documentSnapshot.data()
        )
    );

  const hasNextPage =
    loadedTests.length >
    pageSize;

  const queryPageTests =
    loadedTests.slice(
      0,
      pageSize
    );

  const normalizedSearch =
    normalizeSearch(
      filters.search
    );

  /*
   * Firestore không hỗ trợ tìm kiếm chứa chuỗi toàn văn.
   * Tạm thời tìm kiếm trong số document của trang hiện tại.
   */
  const matchingTests =
    queryPageTests.filter(
      (test) =>
        test.status !==
          "deleted" &&
        matchesSearch(
          test,
          normalizedSearch
        )
    );

  const lastLoadedTest =
    queryPageTests[
      queryPageTests.length - 1
    ];

  const nextCursor:
    TestListCursor | null =
      hasNextPage &&
      lastLoadedTest
        ? {
            id:
              lastLoadedTest.id,

            value:
              getCursorValue(
                lastLoadedTest,
                filters.sort
              ),
          }
        : null;

  return {
    tests:
      matchingTests.map(
        mapTestToListItem
      ),

    nextCursor,

    hasNextPage,
  };
}

export async function updateTest(
  input:
    UpdateTestInput,

  ownerUid:
    string
): Promise<TestData> {
  const currentTest =
    await readOwnedTest(
      input.id,
      ownerUid
    );

  const now =
    createIsoDate();

  const nextSections =
    input.sections
      ? normalizeSections(
          input.sections
        )
      : currentTest.sections;

  const summary =
    calculateTestSummary(
      nextSections
    );

  const requestedStatus =
  input.status ??
  currentTest.status;

/*
 * Không cho frontend tự xuất bản đề.
 *
 * Publish phải đi qua backend để:
 * - xác thực người dùng;
 * - kiểm tra quyền;
 * - kiểm tra nội dung đề;
 * - tạo publishedSnapshot;
 * - quản lý version.
 */
if (
  requestedStatus ===
    "published" &&
  currentTest.status !==
    "published"
) {
  throw new Error(
    "Không thể xuất bản đề trực tiếp từ frontend. Vui lòng sử dụng API publish."
  );
}

const nextStatus =
  requestedStatus;

  const nextMetadata =
    input.metadata
      ? {
          subject:
            input.metadata.subject.trim(),

          grade:
            input.metadata.grade.trim(),

          topics:
            cleanStringArray(
              input.metadata.topics
            ),

          tags:
            cleanStringArray(
              input.metadata.tags
            ),
        }
      : currentTest.metadata;

  const nextTest:
    TestData = {
      ...currentTest,
      ...input,

      id:
        currentTest.id,

      owner:
        currentTest.owner,

      title:
        (
          input.title ??
          currentTest.title
        ).trim(),

      description:
        cleanOptionalString(
          input.description ??
            currentTest.description
        ),

      instructions:
        cleanOptionalString(
          input.instructions ??
            currentTest.instructions
        ),

      durationMinutes:
        Number(
          input.durationMinutes ??
            currentTest.durationMinutes
        ),

      metadata:
        nextMetadata,

      sections:
        nextSections,

      settings:
        input.settings
          ? {
              ...input.settings,
            }
          : currentTest.settings,

      status:
        nextStatus,

      totalScore:
        summary.totalScore,

      totalQuestions:
        summary.totalQuestions,

      createdAt:
        currentTest.createdAt,

      updatedAt:
        now,

      publishedAt:
        nextStatus ===
        "published"
          ? input.publishedAt ??
            currentTest.publishedAt ??
            now
          : currentTest.publishedAt,

      archivedAt:
        nextStatus ===
        "archived"
          ? input.archivedAt ??
            currentTest.archivedAt ??
            now
          : nextStatus ===
              "draft"
            ? undefined
            : currentTest.archivedAt,
    };

  const testReference =
    doc(
      db,
      TESTS_COLLECTION,
      currentTest.id
    );

const firestoreData =
  removeUndefinedValues({
    ...nextTest,

    titleNormalized:
      nextTest.title
        .trim()
        .toLowerCase(),

createdBy:
  currentTest.owner.uid,

    updatedBy:
      currentTest.owner.uid,

    teacherEmail:
      currentTest.owner.email,

    teacherName:
      currentTest.owner.name,

    schoolId:
      currentTest.owner.schoolId,

    subject:
      nextTest.metadata.subject,

    grade:
      nextTest.metadata.grade,

    duration:
      nextTest.durationMinutes,

    questionCount:
      nextTest.totalQuestions,

    schemaVersion:
      3,

    testFormat:
      "three_part",
  }) as DocumentData;

  await setDoc(
    testReference,
    firestoreData
  );

  return nextTest;
}

export async function duplicateTest({
  testId,
  owner,
  title,
}: DuplicateTestInput): Promise<TestData> {
  const normalizedOwner =
    normalizeOwner(
      owner
    );

  const sourceTest =
    await readOwnedTest(
      testId,
      normalizedOwner.uid
    );

  const now =
    createIsoDate();

  const copiedSections =
    sourceTest.sections.map(
      (
        section,
        sectionIndex
      ) => ({
        ...section,

        id:
          createLocalId(
            "section"
          ),

        order:
          sectionIndex,

        questions:
          section.questions.map(
            (
              question,
              questionIndex
            ) => ({
              ...question,

              id:
                createLocalId(
                  "test-question"
                ),

              order:
                questionIndex,

              snapshot: {
                ...question.snapshot,

                snapshotCreatedAt:
                  now,
              },
            })
          ),
      })
    );

  return createTest({
    title:
      title?.trim() ||
      `Bản sao - ${sourceTest.title}`,

    description:
      sourceTest.description,

    instructions:
      sourceTest.instructions,

    durationMinutes:
      sourceTest.durationMinutes,

    status:
      "draft",

    visibility:
      "private",

    metadata: {
      ...sourceTest.metadata,

      topics: [
        ...sourceTest.metadata.topics,
      ],

      tags: [
        ...sourceTest.metadata.tags,
      ],
    },

    sections:
      copiedSections,

    settings: {
      ...sourceTest.settings,
    },

    owner:
      normalizedOwner,

    version: {
      number:
        1,

      status:
        "draft",

      createdAt:
        now,
    },

    totalScore:
      0,

    totalQuestions:
      0,
  });
}

export async function archiveTest(
  testId:
    string,

  ownerUid:
    string
): Promise<TestData> {
  return updateTest(
    {
      id:
        testId,

      status:
        "archived",
    },
    ownerUid
  );
}

export async function restoreTest(
  testId:
    string,

  ownerUid:
    string
): Promise<TestData> {
  return updateTest(
    {
      id:
        testId,

      status:
        "draft",

      archivedAt:
        undefined,
    },
    ownerUid
  );
}

export async function deleteTest(
  testId:
    string,

  ownerUid:
    string
): Promise<void> {
  const test =
    await readOwnedTest(
      testId,
      ownerUid
    );

  const now =
    createIsoDate();

  const testReference =
    doc(
      db,
      TESTS_COLLECTION,
      test.id
    );

  /*
   * Xóa mềm để assignment/result đã tạo từ snapshot cũ
   * không bị mất tham chiếu khi giáo viên dọn đề lỗi.
   */
  await setDoc(
    testReference,
    removeUndefinedValues({
      status:
        "deleted",

      deletedAt:
        now,

      updatedAt:
        now,

      archivedAt:
        test.archivedAt,
    }) as DocumentData,
    {
      merge: true,
    }
  );
}