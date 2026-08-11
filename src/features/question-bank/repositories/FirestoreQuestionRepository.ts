import {
  collection,
  deleteDoc,
  doc,
  endBefore,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from "firebase/firestore";

import type {
  QuestionCardData,
} from "@/components/question-bank";

import type {
  QuestionContentBlock,
} from "@/types/question-content";

import {
  auth,
  db,
} from "@/lib/firebase/client";

import {
  normalizeSubjectName,
} from "@/lib/subjects";

import {
  initialQuestions,
} from "../data/initialQuestions";

import {
  assertValidQuestionInput,
} from "../lib/validateQuestionInput";

import type {
  CreateQuestionInput,
  QuestionCursor,
  QuestionPageResult,
  QuestionQueryOptions,
  QuestionRepository,
  QuestionSearchOptions,
} from "./QuestionRepository";

const COLLECTION_NAME =
  "questions";

const FIRESTORE_BATCH_LIMIT =
  450;

type StoredQuestionDocument =
  DocumentData & {
    ownerId?: string;
    ownerEmail?: string;
    createdAtMs?: number;
    updatedAtMs?: number;
  };

type CurrentUserData = {
  uid: string;
  email: string;
};

type BatchOperation = (
  batch: WriteBatch
) => void;

type PreparedQuestion = {
  question:
    QuestionCardData;

  createdAtMs: number;
  updatedAtMs: number;
};

function getCurrentUser():
  CurrentUserData {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Bạn cần đăng nhập để sử dụng ngân hàng câu hỏi."
    );
  }

  return {
    uid: currentUser.uid,
    email:
      currentUser.email ?? "",
  };
}

function getCurrentTimestamp():
  number {
  return Date.now();
}

function createQuestionDocumentId():
  string {
  return doc(
    collection(
      db,
      COLLECTION_NAME
    )
  ).id;
}

function uniqueIds(
  values: string[]
): string[] {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            value.trim()
        )
        .filter(Boolean)
    )
  );
}

function removeUndefinedValues<
  Value,
>(
  value: Value
): Value {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        removeUndefinedValues(
          item
        )
      )
      .filter(
        (item) =>
          item !== undefined
      ) as Value;
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    const cleanedEntries =
      Object.entries(
        value as Record<
          string,
          unknown
        >
      )
        .filter(
          (
            [, entryValue]
          ) =>
            entryValue !==
            undefined
        )
        .map(
          ([
            entryKey,
            entryValue,
          ]) => [
            entryKey,
            removeUndefinedValues(
              entryValue
            ),
          ]
        );

    return Object.fromEntries(
      cleanedEntries
    ) as Value;
  }

  return value;
}

function cloneQuestion(
  question:
    QuestionCardData
): QuestionCardData {
  const contentBlocks:
    QuestionContentBlock[] |
    undefined =
      question.contentBlocks?.map(
        (block) => {
          if (
            block.type === "table"
          ) {
            return {
              ...block,
              columnWidths:
                block.columnWidths
                  ? [
                      ...block.columnWidths,
                    ]
                  : undefined,
              rows:
                block.rows.map(
                  (row) => ({
                    cells:
                      row.cells.map(
                        (cell) => ({
                          ...cell,
                        })
                      ),
                  })
                ),
            };
          }

          return {
            ...block,
          };
        }
      );

  if (
    question.type ===
    "single_choice"
  ) {
    return {
      ...question,

      contentBlocks,

      options:
        question.options.map(
          (option) => ({
            ...option,
          })
        ),

      tags:
        question.tags
          ? [...question.tags]
          : undefined,
    };
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    return {
      ...question,

      contentBlocks,

      statements:
        question.statements.map(
          (statement) => ({
            ...statement,
          })
        ),

      tags:
        question.tags
          ? [...question.tags]
          : undefined,
    };
  }

  return {
    ...question,

    contentBlocks,

    acceptedAnswers: [
      ...question.acceptedAnswers,
    ],

    tags:
      question.tags
        ? [...question.tags]
        : undefined,
  };
}

function documentToQuestion(
  id: string,
  data:
    StoredQuestionDocument
): QuestionCardData {
  const {
    ownerId:
      _ownerId,

    ownerEmail:
      _ownerEmail,

    createdAtMs:
      _createdAtMs,

    updatedAtMs:
      _updatedAtMs,

    id:
      _storedId,

    ...questionData
  } = data;

  return cloneQuestion({
    ...questionData,
    subject:
      normalizeSubjectName(
        questionData.subject
      ),
    id,
  } as QuestionCardData);
}

function questionToDocument(
  question:
    | QuestionCardData
    | CreateQuestionInput,
  metadata: {
    ownerId: string;
    ownerEmail: string;
    createdAtMs: number;
    updatedAtMs: number;
  }
): StoredQuestionDocument {
  const {
    id:
      _questionId,

    ...questionData
  } =
    question as QuestionCardData;

  return removeUndefinedValues({
    ...questionData,
    subject:
      normalizeSubjectName(
        questionData.subject
      ),
    ...metadata,
  });
}

function createCursor(
  document:
    QueryDocumentSnapshot<DocumentData>
): QuestionCursor {
  return {
    id: document.id,
  };
}

async function getCursorDocument(
  cursor:
    QuestionCursor
): Promise<
  DocumentSnapshot<DocumentData> | null
> {
  if (!cursor) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        COLLECTION_NAME,
        cursor.id
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot;
}

function buildFilterConstraints(
  ownerId: string,
  options: {
    type:
      QuestionQueryOptions["type"];

    difficulty:
      QuestionQueryOptions["difficulty"];

    grade:
      QuestionQueryOptions["grade"];
  }
): QueryConstraint[] {
  const constraints:
    QueryConstraint[] = [
      where(
        "ownerId",
        "==",
        ownerId
      ),
    ];

  if (
    options.type !== "all"
  ) {
    constraints.push(
      where(
        "type",
        "==",
        options.type
      )
    );
  }

  if (
    options.difficulty !==
    "all"
  ) {
    constraints.push(
      where(
        "difficulty",
        "==",
        options.difficulty
      )
    );
  }

  if (
    options.grade !== "all"
  ) {
    constraints.push(
      where(
        "grade",
        "==",
        options.grade
      )
    );
  }

  return constraints;
}

function normalizeSearchText(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function getQuestionSearchText(
  question:
    QuestionCardData
): string {
  const searchableValues:
    string[] = [
      question.id,
      question.content,
      question.subject,
      question.grade,
      question.topic,
      question.knowledgeUnit,
      question.skill,
      question.learningOutcome,
      question.explanation,
      question.cognitiveLevel,
      question.difficulty,
      question.type,
      ...(question.tags ?? []),
      ...(question.contentBlocks ?? [])
        .flatMap((block) => {
          if (block.type === "text") {
            return [block.content];
          }

          if (block.type === "image") {
            return [block.alt];
          }

          return block.rows.flatMap(
            (row) =>
              row.cells.map(
                (cell) =>
                  cell.content
              )
          );
        }),
    ].filter(
      (
        value
      ): value is string =>
        typeof value ===
          "string" &&
        value.trim() !== ""
    );

  if (
    question.type ===
    "single_choice"
  ) {
    searchableValues.push(
      ...question.options.map(
        (option) =>
          option.content
      )
    );
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    searchableValues.push(
      ...question.statements.map(
        (statement) =>
          statement.content
      )
    );
  }

  if (
    question.type ===
    "short_answer"
  ) {
    searchableValues.push(
      ...question.acceptedAnswers
    );
  }

  return normalizeSearchText(
    searchableValues.join(" ")
  );
}

function questionMatchesSearch(
  question:
    QuestionCardData,
  search: string
): boolean {
  const normalizedSearch =
    normalizeSearchText(
      search
    );

  if (!normalizedSearch) {
    return true;
  }

  const searchableText =
    getQuestionSearchText(
      question
    );

  const searchTerms =
    normalizedSearch
      .split(" ")
      .filter(Boolean);

  return searchTerms.every(
    (searchTerm) =>
      searchableText.includes(
        searchTerm
      )
  );
}

async function commitInChunks(
  operations:
    BatchOperation[]
): Promise<void> {
  for (
    let index = 0;
    index <
    operations.length;
    index +=
      FIRESTORE_BATCH_LIMIT
  ) {
    const currentOperations =
      operations.slice(
        index,
        index +
          FIRESTORE_BATCH_LIMIT
      );

    const batch =
      writeBatch(db);

    currentOperations.forEach(
      (operation) => {
        operation(batch);
      }
    );

    await batch.commit();
  }
}

function prepareCreatedQuestions(
  questions:
    CreateQuestionInput[]
): PreparedQuestion[] {
  const baseTimestamp =
    getCurrentTimestamp();

  return questions.map(
    (
      question,
      index
    ) => {
      assertValidQuestionInput(
        question
      );

      const timestamp =
        baseTimestamp +
        index;

      return {
        question: {
          ...cloneQuestion(
            question as QuestionCardData
          ),

          id:
            createQuestionDocumentId(),

          updatedAt:
            new Date(
              timestamp
            ).toISOString(),
        } as QuestionCardData,

        createdAtMs:
          timestamp,

        updatedAtMs:
          timestamp,
      };
    }
  );
}

function prepareDuplicatedQuestion(
  sourceQuestion:
    QuestionCardData,
  timestamp: number
): PreparedQuestion {
  const duplicatedQuestion = {
    ...cloneQuestion(
      sourceQuestion
    ),

    id:
      createQuestionDocumentId(),

    content:
      `${sourceQuestion.content} (Bản sao)`,

    updatedAt:
      new Date(
        timestamp
      ).toISOString(),
  } as QuestionCardData;

  return {
    question:
      duplicatedQuestion,

    createdAtMs:
      timestamp,

    updatedAtMs:
      timestamp,
  };
}

function currentPageHasNext(
  totalCount: number,
  pageSize: number,
  visibleCount: number
): boolean {
  return (
    totalCount >
      pageSize &&
    visibleCount > 0
  );
}

export class FirestoreQuestionRepository
  implements QuestionRepository
{
  async getAll(): Promise<
    QuestionCardData[]
  > {
    const {
      uid,
    } = getCurrentUser();

    const questionsQuery =
      query(
        collection(
          db,
          COLLECTION_NAME
        ),

        where(
          "ownerId",
          "==",
          uid
        ),

        orderBy(
          "createdAtMs",
          "desc"
        )
      );

    const snapshot =
      await getDocs(
        questionsQuery
      );

    return snapshot.docs.map(
      (
        questionDocument
      ) =>
        documentToQuestion(
          questionDocument.id,
          questionDocument.data()
        )
    );
  }

  async getPage(
    options:
      QuestionQueryOptions
  ): Promise<
    QuestionPageResult
  > {
    const {
      uid,
    } = getCurrentUser();

    const safePageSize =
      Math.max(
        1,
        Math.min(
          options.pageSize,
          100
        )
      );

    const pageDirection =
      options.direction ??
      "initial";

    const sortDirection =
      options.sort ===
      "oldest"
        ? "asc"
        : "desc";

    const questionsCollection =
      collection(
        db,
        COLLECTION_NAME
      );

    const filterConstraints =
      buildFilterConstraints(
        uid,
        options
      );

    const countQuery =
      query(
        questionsCollection,
        ...filterConstraints
      );

    const countSnapshot =
      await getCountFromServer(
        countQuery
      );

    const totalCount =
      countSnapshot.data()
        .count;

    const pageConstraints:
      QueryConstraint[] = [
        ...filterConstraints,

        orderBy(
          "createdAtMs",
          sortDirection
        ),
      ];

    const cursorDocument =
      options.cursor
        ? await getCursorDocument(
            options.cursor
          )
        : null;

    if (
      pageDirection ===
        "next" &&
      cursorDocument
    ) {
      pageConstraints.push(
        startAfter(
          cursorDocument
        )
      );

      pageConstraints.push(
        limit(
          safePageSize + 1
        )
      );
    } else if (
      pageDirection ===
        "previous" &&
      cursorDocument
    ) {
      pageConstraints.push(
        endBefore(
          cursorDocument
        )
      );

      pageConstraints.push(
        limitToLast(
          safePageSize
        )
      );
    } else {
      pageConstraints.push(
        limit(
          safePageSize + 1
        )
      );
    }

    const pageQuery =
      query(
        questionsCollection,
        ...pageConstraints
      );

    const pageSnapshot =
      await getDocs(
        pageQuery
      );

    const documents = [
      ...pageSnapshot.docs,
    ];

    const hasExtraDocument =
      pageDirection !==
        "previous" &&
      documents.length >
        safePageSize;

    const visibleDocuments =
      hasExtraDocument
        ? documents.slice(
            0,
            safePageSize
          )
        : documents;

    const firstDocument =
      visibleDocuments[0];

    const lastDocument =
      visibleDocuments[
        visibleDocuments.length -
          1
      ];

    return {
      questions:
        visibleDocuments.map(
          (
            questionDocument
          ) =>
            documentToQuestion(
              questionDocument.id,
              questionDocument.data()
            )
        ),

      totalCount,

      firstCursor:
        firstDocument
          ? createCursor(
              firstDocument
            )
          : null,

      lastCursor:
        lastDocument
          ? createCursor(
              lastDocument
            )
          : null,

      hasNextPage:
        pageDirection ===
        "previous"
          ? currentPageHasNext(
              totalCount,
              safePageSize,
              visibleDocuments.length
            )
          : hasExtraDocument,
    };
  }

  async search(
    options:
      QuestionSearchOptions
  ): Promise<
    QuestionCardData[]
  > {
    const {
      uid,
    } = getCurrentUser();

    const sortDirection =
      options.sort ===
      "oldest"
        ? "asc"
        : "desc";

    const filterConstraints =
      buildFilterConstraints(
        uid,
        options
      );

    const searchQuery =
      query(
        collection(
          db,
          COLLECTION_NAME
        ),

        ...filterConstraints,

        orderBy(
          "createdAtMs",
          sortDirection
        )
      );

    const snapshot =
      await getDocs(
        searchQuery
      );

    return snapshot.docs
      .map(
        (
          questionDocument
        ) =>
          documentToQuestion(
            questionDocument.id,
            questionDocument.data()
          )
      )
      .filter(
        (question) =>
          questionMatchesSearch(
            question,
            options.search
          )
      );
  }

  async create(
    question:
      CreateQuestionInput
  ): Promise<
    QuestionCardData
  > {
    const createdQuestions =
      await this.createMany([
        question,
      ]);

    const createdQuestion =
      createdQuestions[0];

    if (!createdQuestion) {
      throw new Error(
        "Không thể tạo câu hỏi."
      );
    }

    return createdQuestion;
  }

  async createMany(
    questions:
      CreateQuestionInput[]
  ): Promise<
    QuestionCardData[]
  > {
    if (
      questions.length === 0
    ) {
      return [];
    }

    const {
      uid,
      email,
    } = getCurrentUser();

    const preparedQuestions =
      prepareCreatedQuestions(
        questions
      );

    const operations =
      preparedQuestions.map(
        ({
          question,
          createdAtMs,
          updatedAtMs,
        }): BatchOperation =>
          (batch) => {
            const reference =
              doc(
                db,
                COLLECTION_NAME,
                question.id
              );

            batch.set(
              reference,
              questionToDocument(
                question,
                {
                  ownerId:
                    uid,

                  ownerEmail:
                    email,

                  createdAtMs,

                  updatedAtMs,
                }
              )
            );
          }
      );

    await commitInChunks(
      operations
    );

    return preparedQuestions.map(
      ({
        question,
      }) =>
        cloneQuestion(
          question
        )
    );
  }

  async update(
    question:
      QuestionCardData
  ): Promise<
    QuestionCardData
  > {
    const {
      uid,
      email,
    } = getCurrentUser();

    const {
      id:
        _questionId,

      ...questionInput
    } = question;

    assertValidQuestionInput(
      questionInput
    );

    const questionReference =
      doc(
        db,
        COLLECTION_NAME,
        question.id
      );

    const existingSnapshot =
      await getDoc(
        questionReference
      );

    if (
      !existingSnapshot.exists()
    ) {
      throw new Error(
        "Không tìm thấy câu hỏi cần cập nhật."
      );
    }

    const existingData =
      existingSnapshot.data() as
        StoredQuestionDocument;

    if (
      existingData.ownerId !==
      uid
    ) {
      throw new Error(
        "Bạn không có quyền cập nhật câu hỏi này."
      );
    }

    const currentTimestamp =
      getCurrentTimestamp();

    const updatedQuestion = {
      ...cloneQuestion(
        question
      ),

      updatedAt:
        new Date(
          currentTimestamp
        ).toISOString(),
    } as QuestionCardData;

    await setDoc(
      questionReference,

      questionToDocument(
        updatedQuestion,
        {
          ownerId:
            uid,

          ownerEmail:
            email,

          createdAtMs:
            existingData
              .createdAtMs ??
            currentTimestamp,

          updatedAtMs:
            currentTimestamp,
        }
      )
    );

    return cloneQuestion(
      updatedQuestion
    );
  }

  async duplicate(
    questionId: string
  ): Promise<
    QuestionCardData
  > {
    const duplicatedQuestions =
      await this.duplicateMany([
        questionId,
      ]);

    const duplicatedQuestion =
      duplicatedQuestions[0];

    if (!duplicatedQuestion) {
      throw new Error(
        "Không thể nhân bản câu hỏi."
      );
    }

    return duplicatedQuestion;
  }

  async duplicateMany(
    questionIds: string[]
  ): Promise<
    QuestionCardData[]
  > {
    const ids =
      uniqueIds(
        questionIds
      );

    if (ids.length === 0) {
      return [];
    }

    const {
      uid,
      email,
    } = getCurrentUser();

    const snapshots =
      await Promise.all(
        ids.map(
          (questionId) =>
            getDoc(
              doc(
                db,
                COLLECTION_NAME,
                questionId
              )
            )
        )
      );

    const missingSnapshot =
      snapshots.find(
        (snapshot) =>
          !snapshot.exists()
      );

    if (missingSnapshot) {
      throw new Error(
        "Danh sách có câu hỏi không còn tồn tại."
      );
    }

    const unauthorizedSnapshot =
      snapshots.find(
        (snapshot) => {
          const data =
            snapshot.data() as
              StoredQuestionDocument;

          return (
            data.ownerId !==
            uid
          );
        }
      );

    if (
      unauthorizedSnapshot
    ) {
      throw new Error(
        "Danh sách có câu hỏi mà bạn không có quyền nhân bản."
      );
    }

    const baseTimestamp =
      getCurrentTimestamp();

    const preparedQuestions =
      snapshots.map(
        (
          snapshot,
          index
        ) => {
          const sourceQuestion =
            documentToQuestion(
              snapshot.id,
              snapshot.data() as
                StoredQuestionDocument
            );

          return prepareDuplicatedQuestion(
            sourceQuestion,
            baseTimestamp +
              index
          );
        }
      );

    const operations =
      preparedQuestions.map(
        ({
          question,
          createdAtMs,
          updatedAtMs,
        }): BatchOperation =>
          (batch) => {
            const reference =
              doc(
                db,
                COLLECTION_NAME,
                question.id
              );

            batch.set(
              reference,
              questionToDocument(
                question,
                {
                  ownerId:
                    uid,

                  ownerEmail:
                    email,

                  createdAtMs,

                  updatedAtMs,
                }
              )
            );
          }
      );

    await commitInChunks(
      operations
    );

    return preparedQuestions.map(
      ({
        question,
      }) =>
        cloneQuestion(
          question
        )
    );
  }

  async delete(
    questionId: string
  ): Promise<void> {
    const {
      uid,
    } = getCurrentUser();

    const questionReference =
      doc(
        db,
        COLLECTION_NAME,
        questionId
      );

    const snapshot =
      await getDoc(
        questionReference
      );

    if (
      !snapshot.exists()
    ) {
      throw new Error(
        "Không tìm thấy câu hỏi cần xóa."
      );
    }

    const questionData =
      snapshot.data() as
        StoredQuestionDocument;

    if (
      questionData.ownerId !==
      uid
    ) {
      throw new Error(
        "Bạn không có quyền xóa câu hỏi này."
      );
    }

    await deleteDoc(
      questionReference
    );
  }

  async deleteMany(
    questionIds:
      string[]
  ): Promise<void> {
    const {
      uid,
    } = getCurrentUser();

    const ids =
      uniqueIds(
        questionIds
      );

    if (ids.length === 0) {
      return;
    }

    const snapshots =
      await Promise.all(
        ids.map(
          (questionId) =>
            getDoc(
              doc(
                db,
                COLLECTION_NAME,
                questionId
              )
            )
        )
      );

    const unauthorizedQuestion =
      snapshots.find(
        (snapshot) => {
          if (
            !snapshot.exists()
          ) {
            return false;
          }

          const questionData =
            snapshot.data() as
              StoredQuestionDocument;

          return (
            questionData.ownerId !==
            uid
          );
        }
      );

    if (
      unauthorizedQuestion
    ) {
      throw new Error(
        "Danh sách có câu hỏi mà bạn không có quyền xóa."
      );
    }

    const deleteOperations =
      snapshots
        .filter(
          (snapshot) =>
            snapshot.exists()
        )
        .map(
          (
            snapshot
          ): BatchOperation =>
            (batch) => {
              batch.delete(
                snapshot.ref
              );
            }
        );

    await commitInChunks(
      deleteOperations
    );
  }

  async reset(): Promise<
    QuestionCardData[]
  > {
    const {
      uid,
      email,
    } = getCurrentUser();

    const currentQuestionsQuery =
      query(
        collection(
          db,
          COLLECTION_NAME
        ),

        where(
          "ownerId",
          "==",
          uid
        )
      );

    const currentSnapshot =
      await getDocs(
        currentQuestionsQuery
      );

    const deleteOperations =
      currentSnapshot.docs.map(
        (
          questionDocument
        ): BatchOperation =>
          (batch) => {
            batch.delete(
              questionDocument.ref
            );
          }
      );

    await commitInChunks(
      deleteOperations
    );

    const currentTimestamp =
      getCurrentTimestamp();

    const resetQuestions =
      initialQuestions.map(
        (
          question,
          index
        ): PreparedQuestion => {
          const timestamp =
            currentTimestamp -
            index;

          return {
            question: {
              ...cloneQuestion(
                question
              ),

              id:
                createQuestionDocumentId(),

              updatedAt:
                new Date(
                  timestamp
                ).toISOString(),
            } as QuestionCardData,

            createdAtMs:
              timestamp,

            updatedAtMs:
              timestamp,
          };
        }
      );

    const createOperations =
      resetQuestions.map(
        ({
          question,
          createdAtMs,
          updatedAtMs,
        }): BatchOperation =>
          (batch) => {
            const reference =
              doc(
                db,
                COLLECTION_NAME,
                question.id
              );

            batch.set(
              reference,
              questionToDocument(
                question,
                {
                  ownerId:
                    uid,

                  ownerEmail:
                    email,

                  createdAtMs,

                  updatedAtMs,
                }
              )
            );
          }
      );

    await commitInChunks(
      createOperations
    );

    return resetQuestions.map(
      ({
        question,
      }) =>
        cloneQuestion(
          question
        )
    );
  }
}
