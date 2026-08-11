"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  auth,
} from "@/lib/firebase/client";

import {
  loadAssignmentOptions,
} from "../api";

import {
  useAssignments,
} from "../hooks";

import type {
  AssignmentClassOption,
  AssignmentStatus,
  AssignmentTestOption,
  CreateAssignmentInput,
} from "../types";

import {
  AssignmentCard,
} from "./AssignmentCard";

import {
  AssignmentCreateForm,
} from "./AssignmentCreateForm";

import styles from "./assignments.module.css";

type StatusFilter =
  | AssignmentStatus
  | "all";

const STATUS_FILTERS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  {
    value: "all",
    label: "Tất cả",
  },
  {
    value: "active",
    label: "Đang hoạt động",
  },
  {
    value: "scheduled",
    label: "Đã lên lịch",
  },
  {
    value: "closed",
    label: "Đã đóng",
  },
  {
    value: "locked",
    label: "Đã khóa",
  },
  {
    value: "archived",
    label: "Đã lưu trữ",
  },
];

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}

export function AssignmentListPage() {
  const searchParams =
    useSearchParams();

  const initialTestId =
    searchParams.get(
      "testId"
    ) ?? "";

  const {
    assignments,
    loading,
    mutating,
    initialized,
    feedback,
    loadAssignments,
    refresh,
    createAssignment,
    lockAssignment,
    unlockAssignment,
    archiveAssignment,
    restoreAssignment,
    clearFeedback,
  } = useAssignments();

  const [
    tests,
    setTests,
  ] = useState<
    AssignmentTestOption[]
  >([]);

  const [
    classes,
    setClasses,
  ] = useState<
    AssignmentClassOption[]
  >([]);

  const [
    optionsLoading,
    setOptionsLoading,
  ] = useState(true);

  const [
    optionsError,
    setOptionsError,
  ] = useState<
    string | null
  >(null);

  const [
    authenticated,
    setAuthenticated,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    StatusFilter
  >("all");

  const loadOptions =
    useCallback(
      async () => {
        setOptionsLoading(
          true
        );

        setOptionsError(
          null
        );

        try {
          const options =
            await loadAssignmentOptions();

          setTests(
            options.tests
          );

          setClasses(
            options.classes
          );
        } catch (
          error
        ) {
          setOptionsError(
            getErrorMessage(
              error,
              "Không tải được dữ liệu tạo lượt giao đề."
            )
          );
        } finally {
          setOptionsLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {
          if (!currentUser) {
            setAuthenticated(
              false
            );

            setOptionsLoading(
              false
            );

            setOptionsError(
              "Vui lòng đăng nhập để quản lý giao đề."
            );

            return;
          }

          setAuthenticated(
            true
          );

          void Promise.all([
            loadAssignments(),
            loadOptions(),
          ]);
        }
      );

    return unsubscribe;
  }, [
    loadAssignments,
    loadOptions,
  ]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    if (
      feedback.variant ===
      "loading"
    ) {
      return;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          clearFeedback();
        },
        4000
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    clearFeedback,
    feedback,
  ]);

  const filteredAssignments =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return assignments.filter(
        (assignment) => {
          if (
            statusFilter !==
              "all" &&
            assignment.status !==
              statusFilter
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          const searchableText = [
            assignment.testTitle,
            assignment.subject,
            assignment.grade,
            assignment.assignmentCode,
            ...assignment.classNames,
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            normalizedSearch
          );
        }
      );
    }, [
      assignments,
      search,
      statusFilter,
    ]);

  async function handleCreate(
    input:
      CreateAssignmentInput
  ): Promise<boolean> {
    const assignment =
      await createAssignment(
        input
      );

    return Boolean(
      assignment
    );
  }

  async function handleRefresh() {
    await Promise.all([
      refresh(),
      loadOptions(),
    ]);
  }

  const pageLoading =
    !initialized ||
    optionsLoading;

  if (pageLoading) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.pageHeader
          }
        >
          <div>
            <h1
              className={
                styles.pageTitle
              }
            >
              Giao đề
            </h1>

            <p
              className={
                styles.pageDescription
              }
            >
              Đang tải dữ liệu...
            </p>
          </div>
        </div>

        <div
          className={
            styles.loadingCard
          }
        />

        <div
          className={
            styles.loadingCard
          }
        />
      </main>
    );
  }

  return (
    <main
      className={
        styles.page
      }
    >
      <header
        className={
          styles.pageHeader
        }
      >
        <div>
          <h1
            className={
              styles.pageTitle
            }
          >
            Giao đề
          </h1>

          <p
            className={
              styles.pageDescription
            }
          >
            Xuất bản đề, giao cho lớp
            và quản lý quyền truy cập
            bài kiểm tra.
          </p>
        </div>

        <button
          type="button"
          className={
            styles.secondaryButton
          }
          disabled={
            loading ||
            optionsLoading ||
            mutating ||
            !authenticated
          }
          onClick={() => {
            void handleRefresh();
          }}
        >
          Tải lại
        </button>
      </header>

      {feedback && (
        <div
          role="status"
          className={`${styles.feedback} ${
            feedback.variant ===
            "success"
              ? styles.feedbackSuccess
              : feedback.variant ===
                  "loading"
                ? styles.feedbackLoading
                : feedback.variant ===
                    "info"
                  ? styles.feedbackInfo
                  : styles.feedbackError
          }`}
        >
          {feedback.message}
        </div>
      )}

      {optionsError && (
        <div
          role="alert"
          className={`${styles.feedback} ${styles.feedbackError}`}
        >
          {optionsError}
        </div>
      )}

      {authenticated && (
        <section
          className={
            styles.panel
          }
        >
          <AssignmentCreateForm
            tests={tests}
            classes={classes}
            initialTestId={
              initialTestId
            }
            submitting={
              mutating
            }
            onSubmit={
              handleCreate
            }
          />
        </section>
      )}

      <section
        className={
          styles.panel
        }
      >
        <div
          className={
            styles.listHeader
          }
        >
          <div>
            <h2
              className={
                styles.sectionTitle
              }
            >
              Danh sách đã giao
            </h2>

            <p
              className={
                styles.sectionDescription
              }
            >
              Có{" "}
              <strong>
                {
                  assignments.length
                }
              </strong>{" "}
              lượt giao đề.
            </p>
          </div>

          <div
            className={
              styles.toolbar
            }
          >
            <input
              className={
                styles.searchInput
              }
              value={search}
              placeholder="Tìm tên đề, lớp hoặc mã..."
              onChange={(event) => {
                setSearch(
                  event.target.value
                );
              }}
            />

            <select
              className={
                styles.filterSelect
              }
              value={
                statusFilter
              }
              onChange={(event) => {
                setStatusFilter(
                  event.target
                    .value as StatusFilter
                );
              }}
            >
              {STATUS_FILTERS.map(
                (filter) => (
                  <option
                    key={
                      filter.value
                    }
                    value={
                      filter.value
                    }
                  >
                    {
                      filter.label
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {filteredAssignments.length ===
        0 ? (
          <div
            className={
              styles.emptyState
            }
          >
            <strong>
              {assignments.length ===
              0
                ? "Chưa có lượt giao đề"
                : "Không tìm thấy kết quả phù hợp"}
            </strong>

            <span>
              {assignments.length ===
              0
                ? "Hãy chọn đề đã xuất bản và lớp học ở biểu mẫu phía trên."
                : "Thử thay đổi từ khóa hoặc bộ lọc trạng thái."}
            </span>
          </div>
        ) : (
          <div
            className={
              styles.assignmentList
            }
          >
            {filteredAssignments.map(
              (assignment) => (
                <AssignmentCard
                  key={
                    assignment.id
                  }
                  assignment={
                    assignment
                  }
                  mutating={
                    mutating
                  }
                  onLock={async (
                    assignmentId
                  ) => {
                    await lockAssignment(
                      assignmentId
                    );
                  }}
                  onUnlock={async (
                    assignmentId
                  ) => {
                    await unlockAssignment(
                      assignmentId
                    );
                  }}
                  onArchive={async (
                    assignmentId
                  ) => {
                    await archiveAssignment(
                      assignmentId
                    );
                  }}
                  onRestore={async (
                    assignmentId
                  ) => {
                    await restoreAssignment(
                      assignmentId
                    );
                  }}
                />
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}