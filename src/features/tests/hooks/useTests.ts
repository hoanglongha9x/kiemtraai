"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  archiveTest as archiveTestService,
  createDefaultTest,
  deleteTest as deleteTestService,
  duplicateTest as duplicateTestService,
  getTestServiceErrorMessage,
  listTests as listTestsService,
  restoreTest as restoreTestService,
} from "../services";

import type {
  CreateTestFromHookInput,
  DuplicateTestFromHookInput,
  TestData,
  TestListCursor,
  TestListFilters,
  TestListItem,
  TestListSort,
  TestListStatusFilter,
  TestListVisibilityFilter,
  UseTestsOptions,
  UseTestsResult,
} from "../types";

const DEFAULT_PAGE_SIZE = 20;

const DEFAULT_FILTERS:
  TestListFilters = {
    search: "",

    status: "all",

    visibility: "all",

    subject: "",

    grade: "",

    sort: "updated_desc",
  };

function normalizePageSize(
  value:
    number | undefined
): number {
  if (
    !Number.isInteger(value)
  ) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    Math.max(
      value ??
        DEFAULT_PAGE_SIZE,
      1
    ),
    100
  );
}

function normalizeFilters(
  filters:
    Partial<TestListFilters> = {}
): TestListFilters {
  return {
    search:
      filters.search?.trim() ??
      DEFAULT_FILTERS.search,

    status:
      filters.status ??
      DEFAULT_FILTERS.status,

    visibility:
      filters.visibility ??
      DEFAULT_FILTERS.visibility,

    subject:
      filters.subject?.trim() ??
      DEFAULT_FILTERS.subject,

    grade:
      filters.grade?.trim() ??
      DEFAULT_FILTERS.grade,

    sort:
      filters.sort ??
      DEFAULT_FILTERS.sort,
  };
}

function mapTestDataToListItem(
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

function mergeUniqueTests(
  currentTests:
    TestListItem[],

  nextTests:
    TestListItem[]
): TestListItem[] {
  const testMap =
    new Map<
      string,
      TestListItem
    >();

  currentTests.forEach(
    (test) => {
      testMap.set(
        test.id,
        test
      );
    }
  );

  nextTests.forEach(
    (test) => {
      testMap.set(
        test.id,
        test
      );
    }
  );

  return Array.from(
    testMap.values()
  );
}

export function useTests({
  ownerUid,
  initialFilters,
  pageSize:
    requestedPageSize,
  autoLoad = true,
}: UseTestsOptions = {}): UseTestsResult {
  const pageSize =
    useMemo(
      () =>
        normalizePageSize(
          requestedPageSize
        ),
      [requestedPageSize]
    );

  const [
    filters,
    setFiltersState,
  ] = useState<TestListFilters>(
    () =>
      normalizeFilters(
        initialFilters
      )
  );

  const [
    tests,
    setTests,
  ] = useState<
    TestListItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    mutating,
    setMutating,
  ] = useState(false);

  const [
    initialized,
    setInitialized,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    nextCursor,
    setNextCursor,
  ] = useState<
    TestListCursor | null
  >(null);

  const [
    hasNextPage,
    setHasNextPage,
  ] = useState(false);

  const [
    selectedTestIds,
    setSelectedTestIds,
  ] = useState<
    string[]
  >([]);

  const requestIdRef =
    useRef(0);

  const normalizedOwnerUid =
    ownerUid?.trim() ?? "";

  const loadTests =
    useCallback(
      async (): Promise<void> => {
        const currentRequestId =
          requestIdRef.current +
          1;

        requestIdRef.current =
          currentRequestId;

        if (
          !normalizedOwnerUid
        ) {
          setTests([]);
          setNextCursor(null);
          setHasNextPage(false);
          setInitialized(true);
          setError(null);

          return;
        }

        try {
          setLoading(true);
          setError(null);

          const response =
            await listTestsService({
              ownerUid:
                normalizedOwnerUid,

              filters,

              pageSize,

              cursor:
                null,
            });

          if (
            requestIdRef.current !==
            currentRequestId
          ) {
            return;
          }

          setTests(
            response.tests
          );

          setNextCursor(
            response.nextCursor
          );

          setHasNextPage(
            response.hasNextPage
          );

          setSelectedTestIds(
            (
              selectedIds
            ) =>
              selectedIds.filter(
                (selectedId) =>
                  response.tests.some(
                    (test) =>
                      test.id ===
                      selectedId
                  )
              )
          );
        } catch (
          loadError
        ) {
          if (
            requestIdRef.current !==
            currentRequestId
          ) {
            return;
          }

          setTests([]);

          setNextCursor(null);

          setHasNextPage(false);

          setError(
            getTestServiceErrorMessage(
              loadError,
              "Không thể tải danh sách đề kiểm tra."
            )
          );
        } finally {
          if (
            requestIdRef.current ===
            currentRequestId
          ) {
            setLoading(false);
            setInitialized(true);
          }
        }
      },
      [
        filters,
        normalizedOwnerUid,
        pageSize,
      ]
    );

  const loadMore =
    useCallback(
      async (): Promise<void> => {
        if (
          !normalizedOwnerUid ||
          !nextCursor ||
          !hasNextPage ||
          loading ||
          loadingMore
        ) {
          return;
        }

        try {
          setLoadingMore(true);
          setError(null);

          const response =
            await listTestsService({
              ownerUid:
                normalizedOwnerUid,

              filters,

              pageSize,

              cursor:
                nextCursor,
            });

          setTests(
            (
              currentTests
            ) =>
              mergeUniqueTests(
                currentTests,
                response.tests
              )
          );

          setNextCursor(
            response.nextCursor
          );

          setHasNextPage(
            response.hasNextPage
          );
        } catch (
          loadMoreError
        ) {
          setError(
            getTestServiceErrorMessage(
              loadMoreError,
              "Không thể tải thêm đề kiểm tra."
            )
          );
        } finally {
          setLoadingMore(false);
        }
      },
      [
        filters,
        hasNextPage,
        loading,
        loadingMore,
        nextCursor,
        normalizedOwnerUid,
        pageSize,
      ]
    );

  const refresh =
    useCallback(
      async (): Promise<void> => {
        setSelectedTestIds([]);

        await loadTests();
      },
      [loadTests]
    );

  const setFilters =
    useCallback(
      (
        partialFilters:
          Partial<TestListFilters>
      ): void => {
        setFiltersState(
          (
            currentFilters
          ) =>
            normalizeFilters({
              ...currentFilters,
              ...partialFilters,
            })
        );

        setNextCursor(null);
        setHasNextPage(false);
        setSelectedTestIds([]);
      },
      []
    );

  const resetFilters =
    useCallback(
      (): void => {
        setFiltersState({
          ...DEFAULT_FILTERS,
        });

        setNextCursor(null);
        setHasNextPage(false);
        setSelectedTestIds([]);
      },
      []
    );

  const setSearch =
    useCallback(
      (
        search:
          string
      ): void => {
        setFilters({
          search,
        });
      },
      [setFilters]
    );

  const setStatus =
    useCallback(
      (
        status:
          TestListStatusFilter
      ): void => {
        setFilters({
          status,
        });
      },
      [setFilters]
    );

  const setVisibility =
    useCallback(
      (
        visibility:
          TestListVisibilityFilter
      ): void => {
        setFilters({
          visibility,
        });
      },
      [setFilters]
    );

  const setSubject =
    useCallback(
      (
        subject:
          string
      ): void => {
        setFilters({
          subject,
        });
      },
      [setFilters]
    );

  const setGrade =
    useCallback(
      (
        grade:
          string
      ): void => {
        setFilters({
          grade,
        });
      },
      [setFilters]
    );

  const setSort =
    useCallback(
      (
        sort:
          TestListSort
      ): void => {
        setFilters({
          sort,
        });
      },
      [setFilters]
    );

  const removeTestFromState =
    useCallback(
      (
        testId:
          string
      ): void => {
        setTests(
          (
            currentTests
          ) =>
            currentTests.filter(
              (test) =>
                test.id !==
                testId
            )
        );

        setSelectedTestIds(
          (
            currentIds
          ) =>
            currentIds.filter(
              (id) =>
                id !== testId
            )
        );
      },
      []
    );

  const replaceTestInState =
    useCallback(
      (
        test:
          TestListItem
      ): void => {
        setTests(
          (
            currentTests
          ) => {
            const exists =
              currentTests.some(
                (
                  currentTest
                ) =>
                  currentTest.id ===
                  test.id
              );

            if (!exists) {
              return [
                test,
                ...currentTests,
              ];
            }

            return currentTests.map(
              (
                currentTest
              ) =>
                currentTest.id ===
                test.id
                  ? test
                  : currentTest
            );
          }
        );
      },
      []
    );

  const createTest =
    useCallback(
      async (
        input:
          CreateTestFromHookInput
      ): Promise<TestData | null> => {
        try {
          setMutating(true);
          setError(null);

          const response =
            await createDefaultTest({
              owner:
                input.owner,

              title:
                input.title,

              subject:
                input.subject,

              grade:
                input.grade,

              includeDefaultSections:
                input.includeDefaultSections,
            });

          setTests(
            (
              currentTests
            ) => [
              mapTestDataToListItem(
                response.data
              ),
              ...currentTests,
            ]
          );

          return response.data;
        } catch (
          createError
        ) {
          setError(
            getTestServiceErrorMessage(
              createError,
              "Không thể tạo đề kiểm tra."
            )
          );

          return null;
        } finally {
          setMutating(false);
        }
      },
      []
    );

  const duplicateTest =
    useCallback(
      async (
        input:
          DuplicateTestFromHookInput
      ): Promise<TestData | null> => {
        try {
          setMutating(true);
          setError(null);

          const response =
            await duplicateTestService({
              testId:
                input.testId,

              owner:
                input.owner,

              title:
                input.title,
            });

          setTests(
            (
              currentTests
            ) => [
              mapTestDataToListItem(
                response.data
              ),
              ...currentTests,
            ]
          );

          return response.data;
        } catch (
          duplicateError
        ) {
          setError(
            getTestServiceErrorMessage(
              duplicateError,
              "Không thể nhân bản đề kiểm tra."
            )
          );

          return null;
        } finally {
          setMutating(false);
        }
      },
      []
    );

  const archiveTest =
    useCallback(
      async (
        testId:
          string
      ): Promise<TestData | null> => {
        if (
          !normalizedOwnerUid
        ) {
          setError(
            "Không xác định được giáo viên."
          );

          return null;
        }

        try {
          setMutating(true);
          setError(null);

          const response =
            await archiveTestService(
              testId,
              normalizedOwnerUid
            );

          const listItem =
            mapTestDataToListItem(
              response.data
            );

          if (
            filters.status !==
              "all" &&
            filters.status !==
              "archived"
          ) {
            removeTestFromState(
              testId
            );
          } else {
            replaceTestInState(
              listItem
            );
          }

          return response.data;
        } catch (
          archiveError
        ) {
          setError(
            getTestServiceErrorMessage(
              archiveError,
              "Không thể lưu trữ đề kiểm tra."
            )
          );

          return null;
        } finally {
          setMutating(false);
        }
      },
      [
        filters.status,
        normalizedOwnerUid,
        removeTestFromState,
        replaceTestInState,
      ]
    );

  const restoreTest =
    useCallback(
      async (
        testId:
          string
      ): Promise<TestData | null> => {
        if (
          !normalizedOwnerUid
        ) {
          setError(
            "Không xác định được giáo viên."
          );

          return null;
        }

        try {
          setMutating(true);
          setError(null);

          const response =
            await restoreTestService(
              testId,
              normalizedOwnerUid
            );

          const listItem =
            mapTestDataToListItem(
              response.data
            );

          if (
            filters.status ===
            "archived"
          ) {
            removeTestFromState(
              testId
            );
          } else {
            replaceTestInState(
              listItem
            );
          }

          return response.data;
        } catch (
          restoreError
        ) {
          setError(
            getTestServiceErrorMessage(
              restoreError,
              "Không thể khôi phục đề kiểm tra."
            )
          );

          return null;
        } finally {
          setMutating(false);
        }
      },
      [
        filters.status,
        normalizedOwnerUid,
        removeTestFromState,
        replaceTestInState,
      ]
    );

  const deleteTest =
    useCallback(
      async (
        testId:
          string
      ): Promise<boolean> => {
        if (
          !normalizedOwnerUid
        ) {
          setError(
            "Không xác định được giáo viên."
          );

          return false;
        }

        try {
          setMutating(true);
          setError(null);

          await deleteTestService(
            testId,
            normalizedOwnerUid
          );

          removeTestFromState(
            testId
          );

          return true;
        } catch (
          deleteError
        ) {
          setError(
            getTestServiceErrorMessage(
              deleteError,
              "Không thể xóa đề kiểm tra."
            )
          );

          return false;
        } finally {
          setMutating(false);
        }
      },
      [
        normalizedOwnerUid,
        removeTestFromState,
      ]
    );

  const toggleSelectedTest =
    useCallback(
      (
        testId:
          string
      ): void => {
        setSelectedTestIds(
          (
            currentIds
          ) =>
            currentIds.includes(
              testId
            )
              ? currentIds.filter(
                  (id) =>
                    id !== testId
                )
              : [
                  ...currentIds,
                  testId,
                ]
        );
      },
      []
    );

  const selectAllVisible =
    useCallback(
      (): void => {
        setSelectedTestIds(
          tests.map(
            (test) =>
              test.id
          )
        );
      },
      [tests]
    );

  const clearSelection =
    useCallback(
      (): void => {
        setSelectedTestIds([]);
      },
      []
    );

  const isSelected =
    useCallback(
      (
        testId:
          string
      ): boolean =>
        selectedTestIds.includes(
          testId
        ),
      [selectedTestIds]
    );

  useEffect(
    () => {
      if (!autoLoad) {
        return;
      }

      void loadTests();
    },
    [
      autoLoad,
      loadTests,
    ]
  );

  return {
    tests,

    filters,

    loading,

    loadingMore,

    mutating,

    initialized,

    error,

    hasNextPage,

    nextCursor,

    selectedTestIds,

    setFilters,

    resetFilters,

    setSearch,

    setStatus,

    setVisibility,

    setSubject,

    setGrade,

    setSort,

    loadTests,

    loadMore,

    refresh,

    createTest,

    duplicateTest,

    archiveTest,

    restoreTest,

    deleteTest,

    toggleSelectedTest,

    selectAllVisible,

    clearSelection,

    isSelected,

    removeTestFromState,

    replaceTestInState,
  };
}