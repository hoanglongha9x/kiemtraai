"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

import styles from "./tests.module.css";

export type CreateTestFormValues = {
  title: string;

  subject: string;

  grade: string;

  includeDefaultSections:
    boolean;
};

type TestCreateDialogProps = {
  open: boolean;

  submitting?: boolean;

  defaultSubject?: string;

  onClose: () => void;

  onSubmit: (
    values:
      CreateTestFormValues
  ) => Promise<void>;
};

const OTHER_SUBJECT = "Khác";

function getSubjectOption(value: string): string {
  return TEACHER_SUBJECTS.includes(
    value as (typeof TEACHER_SUBJECTS)[number]
  )
    ? value
    : OTHER_SUBJECT;
}

const GRADES = [
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

export function TestCreateDialog({
  open,
  submitting = false,
  defaultSubject = "",
  onClose,
  onSubmit,
}: TestCreateDialogProps) {
  const [
    title,
    setTitle,
  ] = useState("");

  const [
    subject,
    setSubject,
  ] = useState(
    defaultSubject || "Toán"
  );

  const [
    grade,
    setGrade,
  ] = useState("10");

  const [
    includeDefaultSections,
    setIncludeDefaultSections,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(
    () => {
      if (!open) {
        return;
      }

      setTitle("");
      setSubject(
        defaultSubject || "Toán"
      );
      setGrade("10");
      setIncludeDefaultSections(
        true
      );
      setError("");
    },
    [
      defaultSubject,
      open,
    ]
  );

  if (!open) {
    return null;
  }

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    const normalizedTitle =
      title.trim();

    if (!normalizedTitle) {
      setError(
        "Vui lòng nhập tên đề kiểm tra."
      );

      return;
    }

    setError("");

    await onSubmit({
      title:
        normalizedTitle,

      subject:
        subject.trim(),

      grade,

      includeDefaultSections,
    });
  }

  return (
    <div
      className={
        styles.dialogBackdrop
      }
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >
      <section
        className={
          styles.dialog
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-test-title"
      >
        <header
          className={
            styles.dialogHeader
          }
        >
          <div>
            <h2
              id="create-test-title"
            >
              Tạo đề kiểm tra
            </h2>

            <p>
              Nhập thông tin cơ bản. Bạn có thể chỉnh sửa chi tiết sau.
            </p>
          </div>

          <button
            type="button"
            aria-label="Đóng"
            className={
              styles.dialogCloseButton
            }
            disabled={submitting}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className={
            styles.dialogForm
          }
          onSubmit={
            handleSubmit
          }
        >
          <label
            className={
              styles.formField
            }
          >
            <span>
              Tên đề kiểm tra
            </span>

            <input
              autoFocus
              value={title}
              disabled={submitting}
              placeholder="Ví dụ: Kiểm tra giữa kỳ I"
              onChange={(
                event
              ) =>
                setTitle(
                  event.target
                    .value
                )
              }
            />
          </label>

          <div
            className={
              styles.formGrid
            }
          >
            <label
              className={
                styles.formField
              }
            >
              <span>
                Môn học
              </span>

              <select
                value={getSubjectOption(
                  subject
                )}
                disabled={submitting}
                onChange={(
                  event
                ) =>
                  setSubject(
                    event.target.value
                  )
                }
              >
                {TEACHER_SUBJECTS.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>

              {getSubjectOption(subject) ===
              OTHER_SUBJECT ? (
                <input
                  value={
                    subject === OTHER_SUBJECT
                      ? ""
                      : subject
                  }
                  disabled={submitting}
                  placeholder="Nhập tên môn học"
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                />
              ) : null}
            </label>

            <label
              className={
                styles.formField
              }
            >
              <span>
                Khối lớp
              </span>

              <select
                value={grade}
                disabled={submitting}
                onChange={(
                  event
                ) =>
                  setGrade(
                    event.target
                      .value
                  )
                }
              >
                {GRADES.map(
                  (gradeValue) => (
                    <option
                      key={
                        gradeValue
                      }
                      value={
                        gradeValue
                      }
                    >
                      Lớp{" "}
                      {
                        gradeValue
                      }
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <label
            className={
              styles.checkboxField
            }
          >
            <input
              type="checkbox"
              checked={
                includeDefaultSections
              }
              disabled={submitting}
              onChange={(
                event
              ) =>
                setIncludeDefaultSections(
                  event.target
                    .checked
                )
              }
            />

            <span>
              Tạo sẵn ba phần: trắc nghiệm, đúng/sai và trả lời ngắn
            </span>
          </label>

          {error ? (
            <p
              className={
                styles.formError
              }
            >
              {error}
            </p>
          ) : null}

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
              disabled={submitting}
              onClick={onClose}
            >
              Hủy
            </button>

            <button
              type="submit"
              className={
                styles.primaryButton
              }
              disabled={submitting}
            >
              {submitting
                ? "Đang tạo..."
                : "Tạo đề"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}