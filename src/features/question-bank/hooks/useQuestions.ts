"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  QuestionBankFilters,
  QuestionCardData,
} from "@/components/question-bank";

import {
  questionRepository,
  type CreateQuestionInput,
  type QuestionCursor,
} from "../repositories";

const DEFAULT_PAGE_SIZE =
  10;

const MAX_PAGE_SIZE =
  100;

const SEARCH_DEBOUNCE_MS =
  350;

const DEFAULT_FILTERS:
  QuestionBankFilters = {
    search: "",
    type: "all",
    difficulty: "all",
    grade: "all",
    sort: "newest",
  };

type UseQuestionsResult = {
  questions:
    QuestionCardData[];

  loading: boolean;
  mutating: boolean;
  error: string;

  filters:
    QuestionBankFilters;

  pageSize: number;
  currentPage: number;
  totalCount: number;
  totalPages: number;

  hasNextPage: boolean;
  hasPreviousPage: boolean;

  isSearchMode: boolean;

  setFilters: (
    filters:
      QuestionBankFilters
  ) => void;

  setPageSize: (
    pageSize: number
  ) => void;

  goToNextPage:
    () => Promise<void>;

  goToPreviousPage:
    () => Promise<void>;

  reload:
    () => Promise<void>;

  resetQuestions:
    () => Promise<void>;

  createQuestion: (
    question:
      CreateQuestionInput
  ) => Promise<
    QuestionCardData
  >;

  createQuestions: (
    questions:
      CreateQuestionInput[]
  ) => Promise<
    QuestionCardData[]
  >;

  updateQuestion: (
    question:
      QuestionCardData
  ) => Promise<
    QuestionCardData
  >;

  duplicateQuestion: (
    questionId: string
  ) => Promise<
    QuestionCardData
  >;

  duplicateQuestions: (
    questionIds:
      string[]
  ) => Promise<
    QuestionCardData[]
  >;

  deleteQuestion: (
    questionId: string
  ) => Promise<void>;

  deleteQuestions: (
    questionIds:
      string[]
  ) => Promise<void>;

  clearError: () => void;
};

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Đã xảy ra lỗi không xác định.";
}

function normalizeIds(
  questionIds: string[]
): string[] {
  return Array.from(
    new Set(
      questionIds
        .map(
          (questionId) =>
            questionId.trim()
        )
        .filter(Boolean)
    )
  );
}

export function useQuestions():
  UseQuestionsResult {
  const mountedRef =
    useRef(true);

  const firstCursorRef =
    useRef<QuestionCursor>(
      null
    );

  const lastCursorRef =
    useRef<QuestionCursor>(
      null
    );

  const searchResultsRef =
    useRef<
      QuestionCardData[]
    >([]);

  const requestIdRef =
    useRef(0);

  const [
    questions,
    setQuestions,
  ] = useState<
    QuestionCardData[]
  >([]);

  const [
    filters,
    setFiltersState,
  ] =
    useState<QuestionBankFilters>(
      DEFAULT_FILTERS
    );

  const [
    pageSize,
    setPageSizeState,
  ] = useState(
    DEFAULT_PAGE_SIZE
  );

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    totalCount,
    setTotalCount,
  ] = useState(0);

  const [
    hasNextPage,
    setHasNextPage,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    mutating,
    setMutating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const isSearchMode =
    filters.search.trim() !== "";

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalCount /
          pageSize
      )
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  const clearError =
    useCallback(() => {
      setError("");
    }, []);

  const resetPaginationRefs =
    useCallback(() => {
      firstCursorRef.current =
        null;

      lastCursorRef.current =
        null;
    }, []);

  const applySearchPage =
    useCallback(
      (
        results:
          QuestionCardData[],
        page: number
      ) => {
        const searchTotalPages =
          Math.max(
            1,
            Math.ceil(
              results.length /
                pageSize
            )
          );

        const safePage =
          Math.min(
            Math.max(
              page,
              1
            ),
            searchTotalPages
          );

        const startIndex =
          (safePage - 1) *
          pageSize;

        const visibleQuestions =
          results.slice(
            startIndex,
            startIndex +
              pageSize
          );

        setQuestions(
          visibleQuestions
        );

        setTotalCount(
          results.length
        );

        setCurrentPage(
          safePage
        );

        setHasNextPage(
          safePage <
            searchTotalPages
        );
      },
      [pageSize]
    );

  const loadInitialPage =
    useCallback(async () => {
      const requestId =
        requestIdRef.current +
        1;

      requestIdRef.current =
        requestId;

      setLoading(true);
      setError("");

      try {
        const trimmedSearch =
          filters.search.trim();

        if (trimmedSearch) {
          const results =
            await questionRepository.search(
              {
                search:
                  trimmedSearch,

                type:
                  filters.type,

                difficulty:
                  filters.difficulty,

                grade:
                  filters.grade,

                sort:
                  filters.sort,
              }
            );

          if (
            !mountedRef.current ||
            requestId !==
              requestIdRef.current
          ) {
            return;
          }

          searchResultsRef.current =
            results;

          resetPaginationRefs();

          applySearchPage(
            results,
            1
          );

          return;
        }

        searchResultsRef.current =
          [];

        const result =
          await questionRepository.getPage(
            {
              pageSize,

              type:
                filters.type,

              difficulty:
                filters.difficulty,

              grade:
                filters.grade,

              sort:
                filters.sort,

              direction:
                "initial",

              cursor:
                null,
            }
          );

        if (
          !mountedRef.current ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        setQuestions(
          result.questions
        );

        setTotalCount(
          result.totalCount
        );

        setHasNextPage(
          result.hasNextPage
        );

        setCurrentPage(1);

        firstCursorRef.current =
          result.firstCursor;

        lastCursorRef.current =
          result.lastCursor;
      } catch (
        loadError
      ) {
        if (
          mountedRef.current &&
          requestId ===
            requestIdRef.current
        ) {
          setError(
            getErrorMessage(
              loadError
            )
          );
        }
      } finally {
        if (
          mountedRef.current &&
          requestId ===
            requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    }, [
      applySearchPage,
      filters.difficulty,
      filters.grade,
      filters.search,
      filters.sort,
      filters.type,
      pageSize,
      resetPaginationRefs,
    ]);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          void loadInitialPage();
        },
        isSearchMode
          ? SEARCH_DEBOUNCE_MS
          : 0
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    isSearchMode,
    loadInitialPage,
  ]);

  const reload =
    useCallback(async () => {
      await loadInitialPage();
    }, [loadInitialPage]);

  const setFilters =
    useCallback(
      (
        nextFilters:
          QuestionBankFilters
      ) => {
        setCurrentPage(1);

        resetPaginationRefs();

        setFiltersState(
          nextFilters
        );
      },
      [resetPaginationRefs]
    );

  const setPageSize =
    useCallback(
      (
        nextPageSize:
          number
      ) => {
        const safePageSize =
          Math.max(
            1,
            Math.min(
              nextPageSize,
              MAX_PAGE_SIZE
            )
          );

        setCurrentPage(1);

        resetPaginationRefs();

        setPageSizeState(
          safePageSize
        );
      },
      [resetPaginationRefs]
    );

  const goToNextPage =
    useCallback(async () => {
      if (
        loading ||
        mutating ||
        !hasNextPage
      ) {
        return;
      }

      if (isSearchMode) {
        applySearchPage(
          searchResultsRef.current,
          currentPage + 1
        );

        return;
      }

      const lastCursor =
        lastCursorRef.current;

      if (!lastCursor) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result =
          await questionRepository.getPage(
            {
              pageSize,

              type:
                filters.type,

              difficulty:
                filters.difficulty,

              grade:
                filters.grade,

              sort:
                filters.sort,

              direction:
                "next",

              cursor:
                lastCursor,
            }
          );

        if (
          !mountedRef.current
        ) {
          return;
        }

        setQuestions(
          result.questions
        );

        setTotalCount(
          result.totalCount
        );

        setHasNextPage(
          result.hasNextPage
        );

        setCurrentPage(
          (previousPage) =>
            previousPage + 1
        );

        firstCursorRef.current =
          result.firstCursor;

        lastCursorRef.current =
          result.lastCursor;
      } catch (
        loadError
      ) {
        if (
          mountedRef.current
        ) {
          setError(
            getErrorMessage(
              loadError
            )
          );
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(false);
        }
      }
    }, [
      applySearchPage,
      currentPage,
      filters.difficulty,
      filters.grade,
      filters.sort,
      filters.type,
      hasNextPage,
      isSearchMode,
      loading,
      mutating,
      pageSize,
    ]);

  const goToPreviousPage =
    useCallback(async () => {
      if (
        loading ||
        mutating ||
        currentPage <= 1
      ) {
        return;
      }

      if (isSearchMode) {
        applySearchPage(
          searchResultsRef.current,
          currentPage - 1
        );

        return;
      }

      const firstCursor =
        firstCursorRef.current;

      if (!firstCursor) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result =
          await questionRepository.getPage(
            {
              pageSize,

              type:
                filters.type,

              difficulty:
                filters.difficulty,

              grade:
                filters.grade,

              sort:
                filters.sort,

              direction:
                "previous",

              cursor:
                firstCursor,
            }
          );

        if (
          !mountedRef.current
        ) {
          return;
        }

        setQuestions(
          result.questions
        );

        setTotalCount(
          result.totalCount
        );

        setCurrentPage(
          (previousPage) =>
            Math.max(
              1,
              previousPage - 1
            )
        );

        setHasNextPage(true);

        firstCursorRef.current =
          result.firstCursor;

        lastCursorRef.current =
          result.lastCursor;
      } catch (
        loadError
      ) {
        if (
          mountedRef.current
        ) {
          setError(
            getErrorMessage(
              loadError
            )
          );
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(false);
        }
      }
    }, [
      applySearchPage,
      currentPage,
      filters.difficulty,
      filters.grade,
      filters.sort,
      filters.type,
      isSearchMode,
      loading,
      mutating,
      pageSize,
    ]);

  const runMutation =
    useCallback(
      async <Result,>(
        operation:
          () => Promise<Result>,
        options?: {
          reloadAfter?:
            boolean;
        }
      ): Promise<Result> => {
        setMutating(true);
        setError("");

        try {
          const result =
            await operation();

          if (
            options?.reloadAfter !==
            false
          ) {
            await loadInitialPage();
          }

          return result;
        } catch (
          mutationError
        ) {
          if (
            mountedRef.current
          ) {
            setError(
              getErrorMessage(
                mutationError
              )
            );
          }

          throw mutationError;
        } finally {
          if (
            mountedRef.current
          ) {
            setMutating(false);
          }
        }
      },
      [loadInitialPage]
    );

  const createQuestion =
    useCallback(
      async (
        question:
          CreateQuestionInput
      ) => {
        return runMutation(
          () =>
            questionRepository.create(
              question
            )
        );
      },
      [runMutation]
    );

  const createQuestions =
    useCallback(
      async (
        questionInputs:
          CreateQuestionInput[]
      ) => {
        if (
          questionInputs.length ===
          0
        ) {
          return [];
        }

        return runMutation(
          () =>
            questionRepository.createMany(
              questionInputs
            )
        );
      },
      [runMutation]
    );

  const updateQuestion =
    useCallback(
      async (
        question:
          QuestionCardData
      ) => {
        return runMutation(
          () =>
            questionRepository.update(
              question
            )
        );
      },
      [runMutation]
    );

  const duplicateQuestion =
    useCallback(
      async (
        questionId:
          string
      ) => {
        return runMutation(
          () =>
            questionRepository.duplicate(
              questionId
            )
        );
      },
      [runMutation]
    );

  const duplicateQuestions =
    useCallback(
      async (
        questionIds:
          string[]
      ) => {
        const normalizedIds =
          normalizeIds(
            questionIds
          );

        if (
          normalizedIds.length ===
          0
        ) {
          return [];
        }

        return runMutation(
          () =>
            questionRepository.duplicateMany(
              normalizedIds
            )
        );
      },
      [runMutation]
    );

  const deleteQuestion =
    useCallback(
      async (
        questionId:
          string
      ) => {
        await runMutation(
          () =>
            questionRepository.delete(
              questionId
            )
        );
      },
      [runMutation]
    );

  const deleteQuestions =
    useCallback(
      async (
        questionIds:
          string[]
      ) => {
        const normalizedIds =
          normalizeIds(
            questionIds
          );

        if (
          normalizedIds.length ===
          0
        ) {
          return;
        }

        await runMutation(
          () =>
            questionRepository.deleteMany(
              normalizedIds
            )
        );
      },
      [runMutation]
    );

  const resetQuestions =
    useCallback(async () => {
      await runMutation(
        () =>
          questionRepository.reset()
      );
    }, [runMutation]);

  return {
    questions,

    loading,
    mutating,
    error,

    filters,
    pageSize,
    currentPage,
    totalCount,
    totalPages,

    hasNextPage,

    hasPreviousPage:
      currentPage > 1,

    isSearchMode,

    setFilters,
    setPageSize,

    goToNextPage,
    goToPreviousPage,

    reload,
    resetQuestions,

    createQuestion,
    createQuestions,

    updateQuestion,

    duplicateQuestion,
    duplicateQuestions,

    deleteQuestion,
    deleteQuestions,

    clearError,
  };
}