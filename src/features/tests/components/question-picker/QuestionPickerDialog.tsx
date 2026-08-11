"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import {
  questionRepository,
} from "@/features/question-bank";

import type {
  QuestionBankFilters,
} from "@/components/question-bank";

import type {
  QuestionCardData,
  QuestionDifficulty,
  QuestionType,
} from "@/components/question-bank/types";

import type {
  TestSection,
} from "../../types";

import {
  isQuestionAlreadyInSections,
} from "../../utils";

import QuestionPickerCard from "./QuestionPickerCard";

import styles from "../testEditor.module.css";

type QuestionPickerDialogProps = {
  open: boolean;

  section: TestSection | null;

  allSections: TestSection[];

  onClose: () => void;

  onConfirm: (
    questions: QuestionCardData[]
  ) => void;
};

const TYPE_LABELS: Record<
  QuestionType,
  string
> = {
  single_choice:
    "Trắc nghiệm một đáp án",

  true_false_group:
    "Nhóm câu Đúng / Sai",

  short_answer:
    "Trả lời ngắn",
};

export default function QuestionPickerDialog({
  open,
  section,
  allSections,
  onClose,
  onConfirm,
}: QuestionPickerDialogProps) {
  const [
    questions,
    setQuestions,
  ] = useState<
    QuestionCardData[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    filters,
    setFilters,
  ] = useState<QuestionBankFilters>({
    search: "",
    type: "all",
    difficulty: "all",
    grade: "all",
    sort: "newest",
  });

  const [
    selectedQuestionIds,
    setSelectedQuestionIds,
  ] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setSelectedQuestionIds(
        []
      );
    }
  }, [open]);

  const loadQuestions =
    async () => {
      setLoading(true);
      setLoadError("");

      try {
        const loadedQuestions =
          await questionRepository.getAll();

        setQuestions(
          loadedQuestions
        );
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Không tải được ngân hàng câu hỏi."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadQuestions();
  }, [open]);

  useEffect(() => {
  if (
    !open ||
    !section
  ) {
    return;
  }

  setFilters({
    search: "",

    type:
      section.type,

    difficulty:
      "all",

    grade:
      filters.grade,

    sort:
      filters.sort,
  });
  // Chỉ thiết lập khi mở picker
  // hoặc chuyển section.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  open,
  section?.id,
]);

  const compatibleQuestions =
    useMemo(() => {
      if (!section) {
        return [];
      }

      const normalizedSearch =
        filters.search
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .toLocaleLowerCase("vi")
          .replace(/\s+/g, " ")
          .trim();

      return questions
        .filter(
          (question) =>
            question.type ===
            section.type
        )
        .filter(
          (question) =>
            filters.difficulty ===
              "all" ||
            question.difficulty ===
              filters.difficulty
        )
        .filter(
          (question) =>
            filters.grade ===
              "all" ||
            question.grade ===
              filters.grade
        )
        .filter((question) => {
          if (!normalizedSearch) {
            return true;
          }

          const searchText =
            [
              question.content,
              question.subject,
              question.grade,
              question.topic,
              question.difficulty,
              ...(question.tags ??
                []),
            ]
              .filter(Boolean)
              .join(" ")
              .normalize("NFD")
              .replace(
                /[\u0300-\u036f]/g,
                ""
              )
              .replace(/đ/g, "d")
              .replace(/Đ/g, "D")
              .toLocaleLowerCase(
                "vi"
              );

          return searchText.includes(
            normalizedSearch
          );
        });
    }, [
      filters.difficulty,
      filters.grade,
      filters.search,
      questions,
      section,
    ]);

  const selectedQuestions =
    useMemo(() => {
      const selectedSet =
        new Set(
          selectedQuestionIds
        );

      return compatibleQuestions.filter(
        (question) =>
          selectedSet.has(
            question.id
          )
      );
    }, [
      compatibleQuestions,
      selectedQuestionIds,
    ]);

  const availableQuestionIds =
    useMemo(() => {
      return compatibleQuestions
        .filter(
          (question) =>
            !isQuestionAlreadyInSections(
              question.id,
              allSections
            )
        )
        .map(
          (question) =>
            question.id
        );
    }, [
      allSections,
      compatibleQuestions,
    ]);

  const allAvailableSelected =
    availableQuestionIds.length >
      0 &&
    availableQuestionIds.every(
      (questionId) =>
        selectedQuestionIds.includes(
          questionId
        )
    );

  if (
    !open ||
    !section
  ) {
    return null;
  }

  const handleToggleQuestion = (
    questionId: string
  ) => {
    setSelectedQuestionIds(
      (currentIds) =>
        currentIds.includes(
          questionId
        )
          ? currentIds.filter(
              (id) =>
                id !==
                questionId
            )
          : [
              ...currentIds,
              questionId,
            ]
    );
  };

  const handleToggleAll =
    () => {
      if (
        allAvailableSelected
      ) {
        setSelectedQuestionIds(
          []
        );

        return;
      }

      setSelectedQuestionIds(
        availableQuestionIds
      );
    };

const handleSearchChange = (
  event:
    ChangeEvent<HTMLInputElement>
) => {
  setFilters({
    ...filters,

    search:
      event.target.value,
  });
};

const handleDifficultyChange = (
  event:
    ChangeEvent<HTMLSelectElement>
) => {
  setFilters({
    ...filters,

    difficulty:
      event.target.value as
        | QuestionDifficulty
        | "all",
  });
};

const handleGradeChange = (
  event:
    ChangeEvent<HTMLSelectElement>
) => {
  setFilters({
    ...filters,

    grade:
      event.target.value,
  });
};

  const handleConfirm =
    () => {
      if (
        selectedQuestions.length ===
        0
      ) {
        return;
      }

      onConfirm(
        selectedQuestions
      );

      setSelectedQuestionIds(
        []
      );
    };

  return (
    <div
      className={
        styles.dialogBackdrop
      }
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-picker-title"
        className={
          styles.questionPickerDialog
        }
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <header
          className={
            styles.dialogHeader
          }
        >
          <div>
            <h2
              id="question-picker-title"
              className={
                styles.dialogTitle
              }
            >
              Chọn câu hỏi
            </h2>

            <p
              className={
                styles.dialogDescription
              }
            >
              Thêm câu hỏi{" "}
              <strong>
                {
                  TYPE_LABELS[
                    section.type
                  ]
                }
              </strong>{" "}
              vào {section.title}.
            </p>
          </div>

          <button
            type="button"
            className={
              styles.iconButton
            }
            aria-label="Đóng"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div
          className={
            styles.pickerToolbar
          }
        >
          <input
            type="search"
            value={
              filters.search
            }
            onChange={
              handleSearchChange
            }
            placeholder="Tìm nội dung câu hỏi..."
            className={
              styles.input
            }
          />

          <select
            value={
              filters.difficulty
            }
            onChange={
              handleDifficultyChange
            }
            className={
              styles.select
            }
          >
            <option value="all">
              Mọi độ khó
            </option>

            <option value="easy">
              Dễ
            </option>

            <option value="medium">
              Trung bình
            </option>

            <option value="hard">
              Khó
            </option>
          </select>

          <select
            value={
              filters.grade
            }
            onChange={
              handleGradeChange
            }
            className={
              styles.select
            }
          >
            <option value="all">
              Mọi lớp
            </option>

            {Array.from({
              length: 12,
            }).map(
              (_, index) => {
                const grade =
                  String(
                    index + 1
                  );

                return (
                  <option
                    key={
                      grade
                    }
                    value={
                      grade
                    }
                  >
                    Lớp{" "}
                    {grade}
                  </option>
                );
              }
            )}
          </select>

          <button
            type="button"
            className={
              styles.secondaryButton
            }
            onClick={() =>
              void loadQuestions()
            }
            disabled={
              loading
            }
          >
            Tải lại
          </button>
        </div>

        <div
          className={
            styles.pickerSelectionBar
          }
        >
          <label
            className={
              styles.checkLabel
            }
          >
            <input
              type="checkbox"
              checked={
                allAvailableSelected
              }
              onChange={
                handleToggleAll
              }
            />

            Chọn tất cả câu khả dụng
          </label>

          <span>
            Đã chọn{" "}
            <strong>
              {
                selectedQuestionIds.length
              }
            </strong>
          </span>
        </div>

        <div
          className={
            styles.pickerList
          }
        >
          {loading ? (
            <div
              className={
                styles.centerState
              }
            >
              Đang tải câu hỏi...
            </div>
          ) : null}

          {!loading &&
          compatibleQuestions.length ===
            0 ? (
            <div
              className={
                styles.centerState
              }
            >
              Không tìm thấy câu hỏi phù hợp.
            </div>
          ) : null}

          {!loading
            ? compatibleQuestions.map(
                (question) => {
                  const alreadyAdded =
                    isQuestionAlreadyInSections(
                      question.id,
                      allSections
                    );

                  return (
                    <QuestionPickerCard
                      key={
                        question.id
                      }
                      question={
                        question
                      }
                      selected={selectedQuestionIds.includes(
                        question.id
                      )}
                      alreadyAdded={
                        alreadyAdded
                      }
                      onToggle={
                        handleToggleQuestion
                      }
                    />
                  );
                }
              )
            : null}
        </div>

        <footer
          className={
            styles.dialogFooter
          }
        >
          <button
            type="button"
            className={
              styles.secondaryButton
            }
            onClick={
              onClose
            }
          >
            Hủy
          </button>

          <button
            type="button"
            className={
              styles.primaryButton
            }
            disabled={
              selectedQuestions.length ===
              0
            }
            onClick={
              handleConfirm
            }
          >
            Thêm{" "}
            {
              selectedQuestions.length
            }{" "}
            câu hỏi
          </button>
        </footer>
      </section>
    </div>
  );
}
