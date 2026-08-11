"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import {
  QuestionBankToolbar,
  QuestionCard,
  QuestionFormModal,
  type QuestionBankFilters,
  type QuestionFormValues,
} from "@/components/question-bank";

import QuestionCardSkeleton from "@/components/question-bank/QuestionCardSkeleton";

import {
  Button,
  ConfirmDialog,
  useToast,
} from "@/components/ui";

import {
  ImportQuestionsModal,
  mapQuestionFormToCreateInput,
  useQuestions,
  type CreateQuestionInput,
} from "@/features/question-bank";

import styles from "./page.module.css";

const PAGE_SIZE_OPTIONS = [
  10,
  20,
  50,
] as const;

const SKELETON_COUNT = 4;

type DeleteConfirmation =
  | {
      mode: "single";
      questionId: string;
    }
  | {
      mode: "multiple";
      questionIds: string[];
    }
  | null;

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Đã xảy ra lỗi không xác định.";
}

export default function QuestionBankPage() {
  const {
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
    hasPreviousPage,
    isSearchMode,

    setFilters,
    setPageSize,

    goToNextPage,
    goToPreviousPage,

    reload,

    createQuestion,
    createQuestions,

    updateQuestion,

    duplicateQuestion,
    duplicateQuestions,

    deleteQuestion,
    deleteQuestions,
  } = useQuestions();

  const toast = useToast();

  const [
    selectedQuestionIds,
    setSelectedQuestionIds,
  ] = useState<string[]>([]);

  const [
    isFormOpen,
    setIsFormOpen,
  ] = useState(false);

  const [
    editingQuestionId,
    setEditingQuestionId,
  ] = useState<string | null>(
    null
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    isImportModalOpen,
    setIsImportModalOpen,
  ] = useState(false);

  const [
    isImporting,
    setIsImporting,
  ] = useState(false);

  const [
    isBulkDuplicating,
    setIsBulkDuplicating,
  ] = useState(false);

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] =
    useState<DeleteConfirmation>(
      null
    );

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    showDiscardChangesDialog,
    setShowDiscardChangesDialog,
  ] = useState(false);

  const editingQuestion =
    useMemo(() => {
      if (!editingQuestionId) {
        return null;
      }

      return (
        questions.find(
          (question) =>
            question.id ===
            editingQuestionId
        ) ?? null
      );
    }, [
      editingQuestionId,
      questions,
    ]);

  const visibleQuestionIds =
    useMemo(() => {
      return questions.map(
        (question) =>
          question.id
      );
    }, [questions]);

  const allVisibleSelected =
    visibleQuestionIds.length >
      0 &&
    visibleQuestionIds.every(
      (questionId) =>
        selectedQuestionIds.includes(
          questionId
        )
    );

  const hasActiveFilters =
    filters.search.trim() !==
      "" ||
    filters.type !== "all" ||
    filters.difficulty !==
      "all" ||
    filters.grade !== "all";

  const isProcessing =
    loading ||
    mutating ||
    isSubmitting ||
    isImporting ||
    isDeleting ||
    isBulkDuplicating;

  const firstVisibleIndex =
    totalCount === 0 ||
    questions.length === 0
      ? 0
      : (currentPage - 1) *
          pageSize +
        1;

  const lastVisibleIndex =
    totalCount === 0
      ? 0
      : Math.min(
          firstVisibleIndex +
            questions.length -
            1,
          totalCount
        );

  useEffect(() => {
    const currentQuestionIds =
      new Set(
        questions.map(
          (question) =>
            question.id
        )
      );

    setSelectedQuestionIds(
      (currentIds) => {
        const nextIds =
          currentIds.filter(
            (questionId) =>
              currentQuestionIds.has(
                questionId
              )
          );

        return nextIds.length ===
          currentIds.length
          ? currentIds
          : nextIds;
      }
    );
  }, [questions]);

  useEffect(() => {
    if (
      !editingQuestionId ||
      isSubmitting
    ) {
      return;
    }

    const questionExists =
      questions.some(
        (question) =>
          question.id ===
          editingQuestionId
      );

    if (!questionExists) {
      setEditingQuestionId(
        null
      );

      setIsFormOpen(false);
    }
  }, [
    editingQuestionId,
    isSubmitting,
    questions,
  ]);

  const handleFiltersChange = (
    nextFilters:
      QuestionBankFilters
  ) => {
    if (isProcessing) {
      return;
    }

    setSelectedQuestionIds(
      []
    );

    setFilters(
      nextFilters
    );
  };

  const clearFilters = () => {
    if (isProcessing) {
      return;
    }

    setSelectedQuestionIds(
      []
    );

    setFilters({
      search: "",
      type: "all",
      difficulty: "all",
      grade: "all",
      sort: filters.sort,
    });
  };

  const closeFormImmediately =
    () => {
      setIsFormOpen(false);

      setEditingQuestionId(
        null
      );

      setShowDiscardChangesDialog(
        false
      );
    };

  const handleRequestCloseForm = (
    hasUnsavedChanges:
      boolean
  ) => {
    if (isSubmitting) {
      return;
    }

    if (hasUnsavedChanges) {
      setShowDiscardChangesDialog(
        true
      );

      return;
    }

    closeFormImmediately();
  };

  const handleSelectQuestion = (
    questionId: string
  ) => {
    if (isProcessing) {
      return;
    }

    setSelectedQuestionIds(
      (currentIds) => {
        if (
          currentIds.includes(
            questionId
          )
        ) {
          return currentIds.filter(
            (id) =>
              id !== questionId
          );
        }

        return [
          ...currentIds,
          questionId,
        ];
      }
    );
  };

  const handleToggleSelectAll =
    () => {
      if (isProcessing) {
        return;
      }

      setSelectedQuestionIds(
        (currentIds) => {
          if (
            allVisibleSelected
          ) {
            return currentIds.filter(
              (questionId) =>
                !visibleQuestionIds.includes(
                  questionId
                )
            );
          }

          return Array.from(
            new Set([
              ...currentIds,
              ...visibleQuestionIds,
            ])
          );
        }
      );
    };

  const handleOpenCreateForm =
    () => {
      if (isProcessing) {
        return;
      }

      setEditingQuestionId(
        null
      );

      setShowDiscardChangesDialog(
        false
      );

      setIsFormOpen(true);
    };

  const handleOpenEditForm = (
    questionId: string
  ) => {
    if (isProcessing) {
      return;
    }

    const questionExists =
      questions.some(
        (question) =>
          question.id ===
          questionId
      );

    if (!questionExists) {
      toast.error(
        "Không tìm thấy câu hỏi",
        `Không thể mở câu hỏi ${questionId}.`
      );

      return;
    }

    setEditingQuestionId(
      questionId
    );

    setShowDiscardChangesDialog(
      false
    );

    setIsFormOpen(true);
  };

  const handleSubmitQuestion =
    async (
      values:
        QuestionFormValues
    ) => {
      if (
        isSubmitting ||
        mutating
      ) {
        return;
      }

      setIsSubmitting(true);

      try {
        const questionData =
          mapQuestionFormToCreateInput(
            values
          );

        if (editingQuestion) {
          const updatedQuestion =
            await updateQuestion({
              id:
                editingQuestion.id,

              ...questionData,
            });

          toast.success(
            "Đã cập nhật câu hỏi",
            `Câu hỏi ${updatedQuestion.id} đã được lưu.`
          );
        } else {
          const createdQuestion =
            await createQuestion(
              questionData
            );

          toast.success(
            "Đã tạo câu hỏi",
            `Câu hỏi ${createdQuestion.id} đã được thêm vào ngân hàng.`
          );
        }

        setSelectedQuestionIds(
          []
        );

        closeFormImmediately();
      } catch (
        submitError
      ) {
        console.error(
          "Không thể lưu câu hỏi:",
          submitError
        );

        toast.error(
          "Không thể lưu câu hỏi",
          getErrorMessage(
            submitError
          )
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  const handleDuplicateQuestion =
    async (
      questionId: string
    ) => {
      if (isProcessing) {
        return;
      }

      try {
        const duplicatedQuestion =
          await duplicateQuestion(
            questionId
          );

        setSelectedQuestionIds(
          []
        );

        toast.success(
          "Đã nhân bản câu hỏi",
          `Đã tạo ${duplicatedQuestion.id} từ ${questionId}.`
        );
      } catch (
        duplicateError
      ) {
        console.error(
          "Không thể nhân bản câu hỏi:",
          duplicateError
        );

        toast.error(
          "Không thể nhân bản",
          getErrorMessage(
            duplicateError
          )
        );
      }
    };

  const handleDuplicateSelected =
    async () => {
      if (
        selectedQuestionIds.length ===
          0 ||
        isProcessing
      ) {
        return;
      }

      const questionIds = [
        ...selectedQuestionIds,
      ];

      setIsBulkDuplicating(
        true
      );

      try {
        const duplicatedQuestions =
          await duplicateQuestions(
            questionIds
          );

        setSelectedQuestionIds(
          []
        );

        toast.success(
          "Đã nhân bản câu hỏi",
          `${duplicatedQuestions.length} câu hỏi đã được nhân bản.`
        );
      } catch (
        duplicateError
      ) {
        console.error(
          "Không thể nhân bản các câu hỏi:",
          duplicateError
        );

        toast.error(
          "Không thể nhân bản",
          getErrorMessage(
            duplicateError
          )
        );
      } finally {
        setIsBulkDuplicating(
          false
        );
      }
    };

  const handleDeleteQuestion = (
    questionId: string
  ) => {
    if (isProcessing) {
      return;
    }

    setDeleteConfirmation({
      mode: "single",
      questionId,
    });
  };

  const handleDeleteSelected =
    () => {
      if (
        selectedQuestionIds.length ===
          0 ||
        isProcessing
      ) {
        return;
      }

      setDeleteConfirmation({
        mode: "multiple",

        questionIds: [
          ...selectedQuestionIds,
        ],
      });
    };

  const handleConfirmDelete =
    async () => {
      if (
        !deleteConfirmation ||
        isDeleting ||
        mutating
      ) {
        return;
      }

      setIsDeleting(true);

      try {
        if (
          deleteConfirmation.mode ===
          "single"
        ) {
          const {
            questionId,
          } = deleteConfirmation;

          await deleteQuestion(
            questionId
          );

          setSelectedQuestionIds(
            (currentIds) =>
              currentIds.filter(
                (id) =>
                  id !==
                  questionId
              )
          );

          toast.success(
            "Đã xóa câu hỏi",
            `Câu hỏi ${questionId} đã được xóa.`
          );
        } else {
          const {
            questionIds,
          } = deleteConfirmation;

          await deleteQuestions(
            questionIds
          );

          setSelectedQuestionIds(
            []
          );

          toast.success(
            "Đã xóa câu hỏi",
            `${questionIds.length} câu hỏi đã được xóa.`
          );
        }

        setDeleteConfirmation(
          null
        );
      } catch (
        deleteError
      ) {
        console.error(
          "Không thể xóa câu hỏi:",
          deleteError
        );

        toast.error(
          "Không thể xóa câu hỏi",
          getErrorMessage(
            deleteError
          )
        );
      } finally {
        setIsDeleting(false);
      }
    };

  const handleImportQuestions =
    () => {
      if (isProcessing) {
        return;
      }

      setIsImportModalOpen(
        true
      );
    };

  const handleConfirmImport =
    async (
      importedQuestions:
        CreateQuestionInput[]
    ) => {
      if (
        importedQuestions.length ===
          0 ||
        isImporting ||
        mutating
      ) {
        return;
      }

      setIsImporting(true);

      try {
        const createdQuestions =
          await createQuestions(
            importedQuestions
          );

        setIsImportModalOpen(
          false
        );

        setSelectedQuestionIds(
          []
        );

        toast.success(
          "Đã nhập câu hỏi",
          `${createdQuestions.length} câu hỏi đã được thêm vào ngân hàng.`
        );
      } catch (
        importError
      ) {
        console.error(
          "Không thể nhập câu hỏi:",
          importError
        );

        toast.error(
          "Không thể nhập câu hỏi",
          getErrorMessage(
            importError
          )
        );
      } finally {
        setIsImporting(false);
      }
    };

  const handlePageSizeChange = (
    event:
      ChangeEvent<HTMLSelectElement>
  ) => {
    if (isProcessing) {
      return;
    }

    const nextPageSize =
      Number(
        event.target.value
      );

    setSelectedQuestionIds(
      []
    );

    setPageSize(
      nextPageSize
    );
  };

  const handlePreviousPage =
    async () => {
      if (
        isProcessing ||
        !hasPreviousPage
      ) {
        return;
      }

      setSelectedQuestionIds(
        []
      );

      await goToPreviousPage();
    };

  const handleNextPage =
    async () => {
      if (
        isProcessing ||
        !hasNextPage
      ) {
        return;
      }

      setSelectedQuestionIds(
        []
      );

      await goToNextPage();
    };

  const handleReload =
    async () => {
      if (isProcessing) {
        return;
      }

      setSelectedQuestionIds(
        []
      );

      try {
        await reload();

        toast.success(
          "Đã tải lại dữ liệu",
          "Danh sách câu hỏi đã được cập nhật."
        );
      } catch (
        reloadError
      ) {
        console.error(
          "Không thể tải lại dữ liệu:",
          reloadError
        );

        toast.error(
          "Không thể tải lại dữ liệu",
          getErrorMessage(
            reloadError
          )
        );
      }
    };

  const handleAddSelectedToTest =
    () => {
      if (
        selectedQuestionIds.length ===
          0 ||
        isProcessing
      ) {
        return;
      }

      toast.info(
        "Thêm vào đề",
        `Đã chọn ${selectedQuestionIds.length} câu hỏi.`
      );
    };

  const handleGenerateWithAI =
    () => {
      if (isProcessing) {
        return;
      }

      window.location.href =
        "/teacher/ai-generator";
    };

  if (
    loading &&
    questions.length === 0
  ) {
    return (
      <main
        className={styles.page}
      >
        <header
          className={styles.header}
        >
          <div>
            <h1
              className={
                styles.title
              }
            >
              Ngân hàng câu hỏi
            </h1>

            <p
              className={
                styles.description
              }
            >
              Quản lý, tìm kiếm và tái
              sử dụng câu hỏi trong các
              đề kiểm tra.
            </p>
          </div>
        </header>

        <div
          className={
            styles.loadingToolbar
          }
        />

        <section
          className={styles.list}
          aria-label="Đang tải câu hỏi"
          aria-busy="true"
        >
          {Array.from({
            length:
              SKELETON_COUNT,
          }).map(
            (_, index) => (
              <QuestionCardSkeleton
                key={index}
              />
            )
          )}
        </section>
      </main>
    );
  }

  const hasQuestions =
    totalCount > 0;

  const hasVisibleResults =
    questions.length > 0;

  return (
    <main
      className={styles.page}
    >
      <header
        className={styles.header}
      >
        <div>
          <h1
            className={styles.title}
          >
            Ngân hàng câu hỏi
          </h1>

          <p
            className={
              styles.description
            }
          >
            Quản lý, tìm kiếm và tái
            sử dụng câu hỏi trong các
            đề kiểm tra.
          </p>
        </div>

        <div
          className={styles.summary}
        >
          <strong>
            {totalCount}
          </strong>

          <span>
            {" "}
            câu hỏi
          </span>
        </div>
      </header>

      {error && (
        <div
          className={styles.error}
          role="alert"
        >
          <div>
            <strong>
              Không thể tải đầy đủ dữ
              liệu.
            </strong>

            <span>
              {error}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={
              isProcessing
            }
            onClick={() => {
              void handleReload();
            }}
          >
            Thử lại
          </Button>
        </div>
      )}

      <QuestionBankToolbar
        filters={filters}
        selectedCount={
          selectedQuestionIds.length
        }
        visibleCount={
          questions.length
        }
        totalCount={
          totalCount
        }
        allVisibleSelected={
          allVisibleSelected
        }
        searchPending={
          loading &&
          filters.search.trim() !==
            ""
        }
        onFiltersChange={
          handleFiltersChange
        }
        onToggleSelectAll={
          handleToggleSelectAll
        }
        onClearSelection={() => {
          if (!isProcessing) {
            setSelectedQuestionIds(
              []
            );
          }
        }}
        onAddSelectedToTest={
          handleAddSelectedToTest
        }
        onDuplicateSelected={
          handleDuplicateSelected
        }
        onDeleteSelected={
          handleDeleteSelected
        }
        onCreateQuestion={
          handleOpenCreateForm
        }
        onImportQuestions={
          handleImportQuestions
        }
        onGenerateWithAI={
          handleGenerateWithAI
        }
      />

      {loading &&
        questions.length > 0 && (
          <div
            className={
              styles.processingNotice
            }
            role="status"
            aria-live="polite"
          >
            Đang tải dữ liệu...
          </div>
        )}

      {isBulkDuplicating && (
        <div
          className={
            styles.processingNotice
          }
          role="status"
          aria-live="polite"
        >
          Đang nhân bản{" "}
          {
            selectedQuestionIds.length
          }{" "}
          câu hỏi...
        </div>
      )}

      {isImporting && (
        <div
          className={
            styles.processingNotice
          }
          role="status"
          aria-live="polite"
        >
          Đang nhập câu hỏi vào ngân
          hàng...
        </div>
      )}

      {!hasQuestions ? (
        <section
          className={styles.empty}
        >
          <div
            className={
              styles.emptyIllustration
            }
            aria-hidden="true"
          >
            <span>?</span>
          </div>

          <h2
            className={
              styles.emptyTitle
            }
          >
            Ngân hàng chưa có câu hỏi
          </h2>

          <p
            className={
              styles.emptyDescription
            }
          >
            Tạo câu hỏi đầu tiên hoặc
            nhập câu hỏi từ tài liệu có
            sẵn để bắt đầu xây dựng ngân
            hàng dữ liệu.
          </p>

          <div
            className={
              styles.emptyActions
            }
          >
            <Button
              type="button"
              disabled={
                isProcessing
              }
              onClick={
                handleOpenCreateForm
              }
            >
              + Tạo câu hỏi đầu tiên
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={
                isProcessing
              }
              onClick={
                handleImportQuestions
              }
            >
              Nhập câu hỏi
            </Button>
          </div>
        </section>
      ) : !hasVisibleResults ? (
        <section
          className={styles.empty}
        >
          <div
            className={
              styles.emptyIllustration
            }
            aria-hidden="true"
          >
            <span>⌕</span>
          </div>

          <h2
            className={
              styles.emptyTitle
            }
          >
            Không tìm thấy câu hỏi phù
            hợp
          </h2>

          <p
            className={
              styles.emptyDescription
            }
          >
            {isSearchMode
              ? "Không có câu hỏi nào trong ngân hàng khớp với từ khóa tìm kiếm."
              : "Không có câu hỏi nào khớp với bộ lọc hiện tại."}
          </p>

          <div
            className={
              styles.emptyActions
            }
          >
            {hasActiveFilters && (
              <Button
                type="button"
                disabled={
                  isProcessing
                }
                onClick={
                  clearFilters
                }
              >
                Xóa bộ lọc
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={
                isProcessing
              }
              onClick={
                handleOpenCreateForm
              }
            >
              Tạo câu hỏi mới
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section
            className={styles.list}
            aria-busy={
              isProcessing
            }
          >
            {questions.map(
              (question) => (
                <QuestionCard
                  key={
                    question.id
                  }
                  question={
                    question
                  }
                  selected={selectedQuestionIds.includes(
                    question.id
                  )}
                  searchQuery={
                    filters.search
                  }
                  onSelect={
                    handleSelectQuestion
                  }
                  onEdit={
                    handleOpenEditForm
                  }
                  onDuplicate={
                    handleDuplicateQuestion
                  }
                  onDelete={
                    handleDeleteQuestion
                  }
                />
              )
            )}
          </section>

          <nav
            className={
              styles.pagination
            }
            aria-label="Phân trang ngân hàng câu hỏi"
          >
            <div
              className={
                styles.pageSizeControl
              }
            >
              <label
                htmlFor="question-page-size"
              >
                Hiển thị
              </label>

              <select
                id="question-page-size"
                value={
                  pageSize
                }
                disabled={
                  isProcessing
                }
                onChange={
                  handlePageSizeChange
                }
              >
                {PAGE_SIZE_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option
                      }
                      value={
                        option
                      }
                    >
                      {option} câu
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              className={
                styles.pageInformation
              }
            >
              Hiển thị{" "}
              <strong>
                {
                  firstVisibleIndex
                }
              </strong>
              {" – "}
              <strong>
                {
                  lastVisibleIndex
                }
              </strong>
              {" / "}
              {totalCount}
              {" câu hỏi · Trang "}
              <strong>
                {currentPage}
              </strong>
              {" / "}
              {totalPages}
            </div>

            <div
              className={
                styles.pageActions
              }
            >
              <button
                type="button"
                disabled={
                  isProcessing ||
                  !hasPreviousPage
                }
                onClick={() => {
                  void handlePreviousPage();
                }}
              >
                ← Trước
              </button>

              <button
                type="button"
                disabled={
                  isProcessing ||
                  !hasNextPage
                }
                onClick={() => {
                  void handleNextPage();
                }}
              >
                Sau →
              </button>
            </div>
          </nav>
        </>
      )}

      <ImportQuestionsModal
        open={
          isImportModalOpen
        }
        importing={
          isImporting
        }
        onClose={() => {
          if (
            !isImporting &&
            !mutating
          ) {
            setIsImportModalOpen(
              false
            );
          }
        }}
        onImport={
          handleConfirmImport
        }
      />

      <QuestionFormModal
        open={
          isFormOpen
        }
        question={
          editingQuestion
        }
        submitting={
          isSubmitting
        }
        onRequestClose={
          handleRequestCloseForm
        }
        onSubmit={
          handleSubmitQuestion
        }
      />

      <ConfirmDialog
        open={
          showDiscardChangesDialog
        }
        title="Bỏ các thay đổi chưa lưu?"
        description="Những nội dung bạn vừa nhập hoặc chỉnh sửa sẽ bị mất."
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Tiếp tục chỉnh sửa"
        variant="warning"
        loading={false}
        onClose={() =>
          setShowDiscardChangesDialog(
            false
          )
        }
        onConfirm={
          closeFormImmediately
        }
      />

      <ConfirmDialog
        open={Boolean(
          deleteConfirmation
        )}
        title={
          deleteConfirmation?.mode ===
          "multiple"
            ? "Xóa các câu hỏi đã chọn?"
            : "Xóa câu hỏi này?"
        }
        description={
          deleteConfirmation?.mode ===
          "multiple"
            ? `Bạn sắp xóa ${deleteConfirmation.questionIds.length} câu hỏi. Thao tác này không thể hoàn tác.`
            : deleteConfirmation
              ? `Câu hỏi ${deleteConfirmation.questionId} sẽ bị xóa khỏi ngân hàng. Thao tác này không thể hoàn tác.`
              : undefined
        }
        confirmLabel={
          deleteConfirmation?.mode ===
          "multiple"
            ? "Xóa các câu hỏi"
            : "Xóa câu hỏi"
        }
        variant="danger"
        loading={
          isDeleting
        }
        onClose={() => {
          if (
            !isDeleting &&
            !mutating
          ) {
            setDeleteConfirmation(
              null
            );
          }
        }}
        onConfirm={
          handleConfirmDelete
        }
      />
    </main>
  );
}