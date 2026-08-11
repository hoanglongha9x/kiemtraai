"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  QuestionFormModal,
  type QuestionFormValues,
} from "@/components/question-bank";

import type {
  QuestionCardData,
} from "@/components/question-bank/types";

import {
  mapQuestionFormToCreateInput,
  useQuestions,
} from "@/features/question-bank";

import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

import {
  useTestEditor,
} from "../../hooks";

import type {
  TestSection,
} from "../../types";

import QuestionPickerDialog from "../question-picker/QuestionPickerDialog";

import TestSectionEditor from "./TestSectionEditor";
import ValidationPanel from "./ValidationPanel";

import styles from "../testEditor.module.css";

type TestEditorPageProps = {
  testId: string;
  ownerUid: string;
};

const OTHER_SUBJECT = "Khác";

function buildCreatedQuestionForSection(
  createdQuestion:
    QuestionCardData,
  values:
    QuestionFormValues,
  section:
    TestSection
): QuestionCardData {
  const common = {
    ...createdQuestion,
    type:
      section.type,
    content:
      values.content.trim(),
    subject:
      values.subject.trim(),
    grade:
      values.grade.trim(),
    topic:
      values.topic.trim() ||
      undefined,
    knowledgeUnit:
      values.knowledgeUnit.trim() ||
      undefined,
    skill:
      values.skill.trim() ||
      undefined,
    learningOutcome:
      values.learningOutcome.trim() ||
      undefined,
    explanation:
      values.explanation.trim() ||
      undefined,
    difficulty:
      values.difficulty,
    cognitiveLevel:
      values.cognitiveLevel,
    tags:
      values.tags
        .split(",")
        .map((tag) =>
          tag.trim()
        )
        .filter(Boolean),
    updatedAt:
      createdQuestion.updatedAt ||
      new Date().toISOString(),
  };

  if (
    section.type ===
    "single_choice"
  ) {
    return {
      ...common,
      type: "single_choice",
      options: [
        {
          id: "A",
          content:
            values.optionA.trim(),
        },
        {
          id: "B",
          content:
            values.optionB.trim(),
        },
        {
          id: "C",
          content:
            values.optionC.trim(),
        },
        {
          id: "D",
          content:
            values.optionD.trim(),
        },
      ],
      correctOptionId:
        values.correctOptionId,
    };
  }

  if (
    section.type ===
    "true_false_group"
  ) {
    return {
      ...common,
      type:
        "true_false_group",
      statements: [
        {
          id: "A",
          content:
            values.statementA.trim(),
          correctAnswer:
            values.statementAAnswer,
        },
        {
          id: "B",
          content:
            values.statementB.trim(),
          correctAnswer:
            values.statementBAnswer,
        },
        {
          id: "C",
          content:
            values.statementC.trim(),
          correctAnswer:
            values.statementCAnswer,
        },
        {
          id: "D",
          content:
            values.statementD.trim(),
          correctAnswer:
            values.statementDAnswer,
        },
      ],
    };
  }

  return {
    ...common,
    type: "short_answer",
    acceptedAnswers:
      values.acceptedAnswers
        .split(",")
        .map((answer) =>
          answer.trim()
        )
        .filter(Boolean),
    caseSensitive:
      values.caseSensitive,
    trimWhitespace:
      values.trimWhitespace,
    };
}

function getSubjectOption(value: string): string {
  return TEACHER_SUBJECTS.includes(
    value as (typeof TEACHER_SUBJECTS)[number]
  )
    ? value
    : OTHER_SUBJECT;
}

type SaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

function getSaveStatusLabel(
  status: SaveStatus
): string {
  switch (status) {
    case "dirty":
      return "Chưa lưu";

    case "saving":
      return "Đang lưu...";

    case "saved":
      return "Đã lưu";

    case "error":
      return "Lỗi lưu";

    case "idle":
    default:
      return "Không có thay đổi";
  }
}

export default function TestEditorPage({
  testId,
  ownerUid,
}: TestEditorPageProps) {
  const editor =
    useTestEditor({
      testId,
      ownerUid,
    });

  const [
    pickerSectionId,
    setPickerSectionId,
  ] = useState<string | null>(
    null
  );
  const [
    quickCreateSectionId,
    setQuickCreateSectionId,
  ] = useState<string | null>(
    null
  );
  const [
    quickCreateError,
    setQuickCreateError,
  ] = useState<string | null>(
    null
  );
  const [
    quickCreateSubmitting,
    setQuickCreateSubmitting,
  ] = useState(false);
  const questionBank =
    useQuestions();

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null
  );

  const pickerSection =
    editor.test?.sections.find(
      (section) =>
        section.id ===
        pickerSectionId
    ) ?? null;
  const quickCreateSection =
    editor.test?.sections.find(
      (section) =>
        section.id ===
        quickCreateSectionId
    ) ?? null;

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          setNotice(null);
        },
        3500
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [notice]);

  if (
    editor.loading &&
    !editor.test
  ) {
    return (
      <main
        className={
          styles.editorPage
        }
      >
        <div
          className={
            styles.centerState
          }
        >
          Đang tải đề kiểm tra...
        </div>
      </main>
    );
  }

  if (
    editor.error &&
    !editor.test
  ) {
    return (
      <main
        className={
          styles.editorPage
        }
      >
        <div
          className={
            styles.errorState
          }
        >
          <h1>
            Không thể mở đề
          </h1>

          <p>
            {editor.error}
          </p>

          <button
            type="button"
            className={
              styles.primaryButton
            }
            disabled={
              editor.loading
            }
            onClick={() => {
              void editor.load();
            }}
          >
            {editor.loading
              ? "Đang tải..."
              : "Thử lại"}
          </button>
        </div>
      </main>
    );
  }

  if (!editor.test) {
    return null;
  }

  const test =
    editor.test;

  const isDraft =
    test.status ===
    "draft";

  const isPublished =
    test.status ===
    "published";

  const isArchived =
    test.status ===
    "archived";

  const readOnly =
    !isDraft ||
    editor.saving ||
    editor.publishing;

  const handleAddQuestions = (
    questions:
      QuestionCardData[]
  ): void => {
    if (
      !pickerSectionId ||
      readOnly
    ) {
      return;
    }

    const result =
      editor.addQuestions(
        pickerSectionId,
        questions
      );

    const messages:
      string[] = [];

    if (
      result.addedCount > 0
    ) {
      messages.push(
        `Đã thêm ${result.addedCount} câu hỏi`
      );
    }

    if (
      result.duplicateCount > 0
    ) {
      messages.push(
        `${result.duplicateCount} câu đã tồn tại`
      );
    }

    if (
      result.incompatibleCount >
      0
    ) {
      messages.push(
        `${result.incompatibleCount} câu không đúng loại`
      );
    }

    if (
      messages.length === 0
    ) {
      messages.push(
        "Không có câu hỏi nào được thêm"
      );
    }

    setNotice(
      messages.join(". ")
    );

    if (
      result.addedCount > 0
    ) {
      setPickerSectionId(
        null
      );
    }
  };

  const handleCreateQuestion =
    async (
      values:
        QuestionFormValues
    ): Promise<void> => {
      if (
        !quickCreateSectionId ||
        readOnly ||
        quickCreateSubmitting
      ) {
        return;
      }

      setQuickCreateSubmitting(true);
      setQuickCreateError(null);

      try {
        if (
          quickCreateSection &&
          values.type !==
            quickCreateSection.type
        ) {
          setQuickCreateError(
            "Loại câu hỏi chưa khớp với phần đang chọn. Hãy tạo đúng loại câu hỏi của phần này."
          );
          return;
        }

        const createdQuestion =
          await questionBank.createQuestion(
            mapQuestionFormToCreateInput(
              values
            )
          );
        const questionForTest =
          quickCreateSection
            ? buildCreatedQuestionForSection(
                createdQuestion,
                values,
                quickCreateSection
              )
            : createdQuestion;

        const result =
          editor.addQuestions(
            quickCreateSectionId,
            [questionForTest]
          );

        if (
          result.addedCount <= 0
        ) {
          if (
            result.duplicateCount > 0
          ) {
            setQuickCreateError(
              "Câu hỏi đã được tạo vào ngân hàng nhưng chưa thêm vào đề vì câu này đã có trong đề."
            );
          } else if (
            result.incompatibleCount > 0
          ) {
            setQuickCreateError(
              "Câu hỏi đã được tạo vào ngân hàng nhưng chưa thêm vào phần này vì loại câu hỏi không khớp."
            );
          } else {
            setQuickCreateError(
              "Câu hỏi đã được tạo vào ngân hàng nhưng chưa thêm được vào đề. Vui lòng thử lại."
            );
          }
          return;
        }

        setNotice(
          "Đã tạo và thêm câu hỏi vào đề."
        );
        setQuickCreateSectionId(
          null
        );
      } catch (error) {
        setQuickCreateError(
          error instanceof Error
            ? error.message
            : "Không tạo được câu hỏi."
        );
      } finally {
        setQuickCreateSubmitting(
          false
        );
      }
    };

  const handleSectionChange = (
    sectionId: string,
    changes: Partial<
      Omit<
        TestSection,
        "id"
      >
    >
  ): void => {
    if (readOnly) {
      return;
    }

    editor.updateSection(
      sectionId,
      changes
    );
  };

  const handleSave =
    async (): Promise<void> => {
      const saved =
        await editor.save();

      if (saved) {
        setNotice(
          "Đã lưu đề kiểm tra."
        );
      }
    };

  const handlePublish =
    async (): Promise<void> => {
      if (
        !editor.canPublish
      ) {
        return;
      }

      const confirmed =
  window.confirm(
    isPublished
      ? [
          "Bạn có chắc muốn tạo lại snapshot cho đề này?",
          "",
          "Thao tác này sẽ tạo bản snapshot dùng để giao bài cho học sinh.",
        ].join("\n")
      : [
          "Bạn có chắc muốn xuất bản đề kiểm tra này?",
          "",
          "Sau khi xuất bản, đề sẽ chuyển sang chế độ chỉ đọc và không thể chỉnh sửa trực tiếp.",
        ].join("\n")
  );

      if (!confirmed) {
        return;
      }

      setPickerSectionId(
        null
      );

      const published =
        await editor.publish();

      if (published) {
  setNotice(
    isPublished
      ? "Đã tạo lại snapshot thành công."
      : "Đã xuất bản đề kiểm tra thành công."
  );
}
    };

  return (
    <main
      className={
        styles.editorPage
      }
    >
      <header
        className={
          styles.editorHeader
        }
      >
        <div
          className={
            styles.editorHeaderMain
          }
        >
          <a
            href="/teacher/tests"
            className={
              styles.backLink
            }
          >
            ← Danh sách đề
          </a>

          <div
            className={
              styles.titleRow
            }
          >
            <input
              type="text"
              value={
                test.title
              }
              disabled={
                readOnly
              }
              className={
                styles.testTitleInput
              }
              placeholder="Tên đề kiểm tra"
              onChange={(
                event
              ) => {
                editor.setTitle(
                  event.target.value
                );
              }}
            />

            <div
              className={
                styles.saveStatusGroup
              }
            >
              <span
                className={[
                  styles.saveStatus,

                  editor.saveStatus ===
                  "error"
                    ? styles.saveStatusError
                    : "",

                  editor.saveStatus ===
                  "saved"
                    ? styles.saveStatusSuccess
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {editor.publishing
                  ? "Đang xuất bản..."
                  : getSaveStatusLabel(
                      editor.saveStatus
                    )}
              </span>
            </div>
          </div>

          <div
            className={
              styles.testSummary
            }
          >
            <span>
              {test.totalQuestions}{" "}
              câu hỏi
            </span>

            <span>•</span>

            <span>
              {test.totalQuestions > 0
                ? 10
                : 0}{" "}
              điểm
            </span>

            <span>•</span>

            <span>
              {test.durationMinutes}{" "}
              phút
            </span>

            <span>•</span>

            <span>
              {isDraft
                ? "Bản nháp"
                : isPublished
                  ? "Đã xuất bản"
                  : "Đã lưu trữ"}
            </span>
          </div>
        </div>

        <div
          className={
            styles.editorHeaderActions
          }
        >
          <button
            type="button"
            className={
              styles.secondaryButton
            }
            disabled={
              !isDraft ||
              !editor.dirty ||
              editor.saving ||
              editor.publishing
            }
            onClick={
              editor.reset
            }
          >
            Hoàn tác
          </button>

          <button
            type="button"
            className={
              styles.secondaryButton
            }
            disabled={
              !isDraft ||
              !editor.dirty ||
              editor.saving ||
              editor.publishing
            }
            onClick={() => {
              void handleSave();
            }}
          >
            {editor.saving
              ? "Đang lưu..."
              : "Lưu đề"}
          </button>

          <button
            type="button"
            className={
              styles.primaryButton
            }
            disabled={
              !editor.canPublish
            }
            onClick={() => {
              void handlePublish();
            }}
          >
            {editor.publishing
  ? "Đang tạo snapshot..."
  : isPublished
    ? "Tạo lại snapshot"
    : "Xuất bản đề"}
          </button>
        </div>
      </header>

      {notice ? (
        <div
          className={
            styles.notice
          }
        >
          {notice}
        </div>
      ) : null}

      {editor.saveError ? (
        <div
          className={
            styles.errorNotice
          }
        >
          {editor.saveError}
        </div>
      ) : null}

      {editor.publishError ? (
        <div
          className={
            styles.errorNotice
          }
        >
          {editor.publishError}
        </div>
      ) : null}

      {quickCreateError ? (
        <div
          className={
            styles.errorNotice
          }
        >
          {quickCreateError}
        </div>
      ) : null}

      {!isDraft ? (
        <div
          className={
            styles.notice
          }
        >
          {isArchived
            ? "Đề đã được lưu trữ và hiện không thể chỉnh sửa."
            : "Đề đã được xuất bản. Hãy tạo bản sao nếu cần chỉnh sửa."}
        </div>
      ) : null}

      <div
        className={
          styles.editorLayout
        }
      >
        <aside
          className={
            styles.informationPanel
          }
        >
          <h2>
            Thông tin đề
          </h2>

          <label
            className={
              styles.field
            }
          >
            <span>
              Môn học
            </span>

            <select
              value={getSubjectOption(
                test.metadata.subject
              )}
              disabled={
                readOnly
              }
              onChange={(event) => {
                editor.setSubject(
                  event.target.value
                );
              }}
            >
              {TEACHER_SUBJECTS.map(
                (subject) => (
                  <option
                    key={subject}
                    value={subject}
                  >
                    {subject}
                  </option>
                )
              )}
            </select>

            {getSubjectOption(
              test.metadata.subject
            ) === OTHER_SUBJECT ? (
              <input
                type="text"
                value={
                  test.metadata.subject ===
                  OTHER_SUBJECT
                    ? ""
                    : test.metadata.subject
                }
                disabled={readOnly}
                placeholder="Nhập tên môn học"
                onChange={(event) => {
                  editor.setSubject(
                    event.target.value
                  );
                }}
              />
            ) : null}
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Lớp
            </span>

            <input
              type="text"
              value={
                test.metadata.grade
              }
              disabled={
                readOnly
              }
              onChange={(
                event
              ) => {
                editor.setGrade(
                  event.target.value
                );
              }}
            />
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Thời gian làm bài
            </span>

            <input
              type="number"
              min={1}
              value={
                test.durationMinutes
              }
              disabled={
                readOnly
              }
              onChange={(
                event
              ) => {
                editor.setDurationMinutes(
                  Number(
                    event.target.value
                  )
                );
              }}
            />
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Mô tả
            </span>

            <textarea
              value={
                test.description ??
                ""
              }
              disabled={
                readOnly
              }
              rows={4}
              onChange={(
                event
              ) => {
                editor.setDescription(
                  event.target.value
                );
              }}
            />
          </label>

          <label
            className={
              styles.field
            }
          >
            <span>
              Hướng dẫn làm bài
            </span>

            <textarea
              value={
                test.instructions ??
                ""
              }
              disabled={
                readOnly
              }
              rows={6}
              onChange={(
                event
              ) => {
                editor.setInstructions(
                  event.target.value
                );
              }}
            />
          </label>

          {editor.validation ? (
            <ValidationPanel
              validation={
                editor.validation
              }
              visible={
                isDraft
              }
            />
          ) : null}
        </aside>

        <div
          className={
            styles.sectionsColumn
          }
        >
          {test.sections.map(
            (section) => (
              <TestSectionEditor
                key={
                  section.id
                }
                section={
                  section
                }
                disabled={
                  readOnly
                }
                onOpenPicker={() => {
                  if (readOnly) {
                    return;
                  }

                  setPickerSectionId(
                    section.id
                  );
                }}
                onCreateQuestion={() => {
                  if (readOnly) {
                    return;
                  }

                  setQuickCreateError(
                    null
                  );
                  setQuickCreateSectionId(
                    section.id
                  );
                }}
                onSectionChange={(
                  changes
                ) => {
                  handleSectionChange(
                    section.id,
                    changes
                  );
                }}
                onRemoveQuestion={(
                  questionId
                ) => {
                  editor.removeQuestion(
                    section.id,
                    questionId
                  );
                }}
                onMoveQuestion={(
                  questionId,
                  direction
                ) => {
                  editor.moveQuestion(
                    section.id,
                    questionId,
                    direction
                  );
                }}
                onQuestionScoreChange={(
                  questionId,
                  score
                ) => {
                  editor.setQuestionScore(
                    section.id,
                    questionId,
                    score
                  );
                }}
                onQuestionRequiredChange={(
                  questionId,
                  required
                ) => {
                  editor.setQuestionRequired(
                    section.id,
                    questionId,
                    required
                  );
                }}
                onQuestionSnapshotChange={(
                  questionId,
                  snapshot
                ) => {
                  editor.setQuestionSnapshot(
                    section.id,
                    questionId,
                    snapshot
                  );
                }}
              />
            )
          )}
        </div>
      </div>

      <QuestionPickerDialog
        open={
          Boolean(
            pickerSectionId
          ) &&
          !readOnly
        }
        section={
          pickerSection
        }
        allSections={
          test.sections
        }
        onClose={() => {
          setPickerSectionId(
            null
          );
        }}
        onConfirm={
          handleAddQuestions
        }
      />

      <QuestionFormModal
        open={
          Boolean(
            quickCreateSectionId
          ) &&
          !readOnly
        }
        question={
          null
        }
        defaultType={
          quickCreateSection?.type
        }
        defaultSubject={
          test.metadata.subject
        }
        defaultGrade={
          test.metadata.grade
        }
        submitting={
          quickCreateSubmitting ||
          questionBank.mutating
        }
        onRequestClose={(
          hasUnsavedChanges
        ) => {
          if (
            hasUnsavedChanges &&
            !window.confirm(
              "Bỏ câu hỏi đang nhập?"
            )
          ) {
            return;
          }

          setQuickCreateSectionId(
            null
          );
        }}
        onSubmit={
          handleCreateQuestion
        }
      />
    </main>
  );
}
