"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import useCurrentTeacher from "@/features/teacher-shell/hooks/useCurrentTeacher";

import {
  useTests,
} from "../hooks";

import {
  TestCard,
} from "./TestCard";

import {
  TestCreateDialog,
  type CreateTestFormValues,
} from "./TestCreateDialog";

import {
  TestEmptyState,
} from "./TestEmptyState";

import {
  TestListToolbar,
} from "./TestListToolbar";

import styles from "./tests.module.css";

export function TestListPage() {
  const router =
    useRouter();

  const {
    teacher,
  } = useCurrentTeacher();

  const [
    createDialogOpen,
    setCreateDialogOpen,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const {
    tests,
    filters,
    loading,
    loadingMore,
    mutating,
    initialized,
    error,
    hasNextPage,

    setSearch,
    setStatus,
    setVisibility,
    setSubject,
    setSort,
    resetFilters,

    refresh,
    loadMore,

    createTest,
    duplicateTest,
    archiveTest,
    restoreTest,
    deleteTest,
  } = useTests({
    ownerUid:
      teacher?.uid,

    autoLoad:
      Boolean(
        teacher?.uid
      ),
  });

  const hasActiveFilters =
    filters.search.trim() !==
      "" ||
    filters.status !==
      "all" ||
    filters.visibility !==
      "all" ||
    filters.subject !== "" ||
    filters.grade !== "" ||
    filters.sort !==
      "updated_desc";

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          setMessage("");
        },
        4000
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [message]);

  async function handleCreate(
    values:
      CreateTestFormValues
  ): Promise<void> {
    if (
      !teacher?.uid ||
      !teacher.email
    ) {
      setMessage(
        "Không xác định được tài khoản giáo viên."
      );

      return;
    }

    const created =
      await createTest({
        owner: {
          uid:
            teacher.uid,

          email:
            teacher.email,

          name:
            teacher.name,

          schoolId:
            teacher.schoolId,
        },

        title:
          values.title,

        subject:
          values.subject,

        grade:
          values.grade,

        includeDefaultSections:
          true,
      });

    if (!created) {
      return;
    }

    setCreateDialogOpen(
      false
    );

    setMessage(
      "Đã tạo đề kiểm tra."
    );

    router.push(
      `/teacher/tests/${created.id}/edit`
    );
  }

  async function handleDuplicate(
    testId: string
  ): Promise<void> {
    if (
      !teacher?.uid ||
      !teacher.email ||
      mutating
    ) {
      return;
    }

    const duplicated =
      await duplicateTest({
        testId,

        owner: {
          uid:
            teacher.uid,

          email:
            teacher.email,

          name:
            teacher.name,

          schoolId:
            teacher.schoolId,
        },
      });

    if (!duplicated) {
      return;
    }

    setMessage(
      "Đã nhân bản đề kiểm tra."
    );

    router.push(
      `/teacher/tests/${duplicated.id}/edit`
    );
  }

  async function handleArchive(
    testId: string
  ): Promise<void> {
    if (mutating) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          "Bạn có chắc muốn lưu trữ đề kiểm tra này?",
          "",
          "Đề sẽ không còn ở trạng thái hoạt động nhưng vẫn có thể khôi phục sau.",
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    const archived =
      await archiveTest(
        testId
      );

    if (archived) {
      setMessage(
        "Đã lưu trữ đề kiểm tra."
      );
    }
  }

  async function handleRestore(
    testId: string
  ): Promise<void> {
    if (mutating) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          "Khôi phục đề kiểm tra này?",
          "",
          "Đề sẽ trở về trạng thái bản nháp và có thể chỉnh sửa.",
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    const restored =
      await restoreTest(
        testId
      );

    if (!restored) {
      return;
    }

    setMessage(
      "Đã khôi phục đề kiểm tra."
    );

    router.push(
      `/teacher/tests/${restored.id}/edit`
    );
  }

  async function handleDelete(
    testId: string
  ): Promise<void> {
    if (mutating) {
      return;
    }

    const testToDelete =
      tests.find(
        (test) =>
          test.id ===
          testId
      );

    const testTitle =
      testToDelete?.title.trim() ||
      "đề kiểm tra này";

    const confirmed =
      window.confirm(
        [
          `Bạn có chắc muốn xóa “${testTitle}”?`,
          "",
          "Thao tác này không thể hoàn tác.",
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    const deleted =
      await deleteTest(
        testId
      );

    if (deleted) {
      setMessage(
        "Đã xóa đề kiểm tra."
      );
    }
  }

  return (
    <>
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
            <p
              className={
                styles.eyebrow
              }
            >
              Quản lý đề kiểm tra
            </p>

            <h1>
              Đề kiểm tra
            </h1>

            <p
              className={
                styles.pageDescription
              }
            >
              Tạo, quản lý và xuất bản đề kiểm tra từ ngân hàng câu hỏi.
            </p>
          </div>

          <div
            className={
              styles.headerActions
            }
          >
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              disabled={
                loading ||
                mutating
              }
              onClick={() => {
                void refresh();
              }}
            >
              {loading
                ? "Đang tải..."
                : "Làm mới"}
            </button>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              disabled={
                mutating ||
                !teacher?.uid
              }
              onClick={() => {
                setCreateDialogOpen(
                  true
                );
              }}
            >
              + Tạo đề mới
            </button>
          </div>
        </header>

        {message ? (
          <div
            className={
              styles.successMessage
            }
          >
            <span>
              {message}
            </span>

            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => {
                setMessage("");
              }}
            >
              ×
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            className={
              styles.errorMessage
            }
          >
            <span>
              {error}
            </span>

            <button
              type="button"
              disabled={
                loading
              }
              onClick={() => {
                void refresh();
              }}
            >
              Thử lại
            </button>
          </div>
        ) : null}

        <TestListToolbar
          filters={
            filters
          }
          disabled={
            loading ||
            mutating
          }
          onSearchChange={
            setSearch
          }
          onStatusChange={
            setStatus
          }
          onVisibilityChange={
            setVisibility
          }
          onSubjectChange={
            setSubject
          }
          onSortChange={
            setSort
          }
          onReset={
            resetFilters
          }
        />

        {loading &&
        !initialized ? (
          <section
            className={
              styles.loadingState
            }
          >
            <div
              className={
                styles.spinner
              }
            />

            <p>
              Đang tải danh sách đề kiểm tra...
            </p>
          </section>
        ) : null}

        {!loading &&
        initialized &&
        tests.length ===
          0 ? (
          <TestEmptyState
            filtered={
              hasActiveFilters
            }
            onCreate={() => {
              setCreateDialogOpen(
                true
              );
            }}
            onResetFilters={
              resetFilters
            }
          />
        ) : null}

        {tests.length > 0 ? (
          <>
            <div
              className={
                styles.resultSummary
              }
            >
              Hiển thị{" "}
              <strong>
                {tests.length}
              </strong>{" "}
              đề kiểm tra
            </div>

            <section
              className={
                styles.testGrid
              }
            >
              {tests.map(
                (test) => (
                  <TestCard
                    key={
                      test.id
                    }
                    test={
                      test
                    }
                    disabled={
                      mutating
                    }
                    onDuplicate={
                      handleDuplicate
                    }
                    onArchive={
                      handleArchive
                    }
                    onRestore={
                      handleRestore
                    }
                    onDelete={
                      handleDelete
                    }
                  />
                )
              )}
            </section>

            {hasNextPage ? (
              <div
                className={
                  styles.loadMoreWrapper
                }
              >
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={
                    loadingMore ||
                    mutating
                  }
                  onClick={() => {
                    void loadMore();
                  }}
                >
                  {loadingMore
                    ? "Đang tải..."
                    : "Tải thêm"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </main>

      <TestCreateDialog
        open={
          createDialogOpen
        }
        submitting={
          mutating
        }
        onClose={() => {
          if (mutating) {
            return;
          }

          setCreateDialogOpen(
            false
          );
        }}
        onSubmit={
          handleCreate
        }
      />
    </>
  );
}