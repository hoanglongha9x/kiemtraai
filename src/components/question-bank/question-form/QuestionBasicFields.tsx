import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

import {
  CONTENT_MAX_LENGTH,
} from "./questionFormConstants";

import type {
  QuestionFormErrors,
  QuestionFormUpdateField,
  QuestionFormValues,
} from "./questionFormTypes";

import type {
  CognitiveLevel,
  QuestionDifficulty,
  QuestionType,
} from "../types";

import styles from "../QuestionFormModal.module.css";

const OTHER_SUBJECT = "Khác";

function getSubjectOption(value: string): string {
  return TEACHER_SUBJECTS.includes(
    value as (typeof TEACHER_SUBJECTS)[number]
  )
    ? value
    : OTHER_SUBJECT;
}

type QuestionBasicFieldsProps = {
  values: QuestionFormValues;
  errors: QuestionFormErrors;
  disabled: boolean;

  contentFieldRef:
    React.RefObject<HTMLTextAreaElement | null>;

  onUpdateField:
    QuestionFormUpdateField;
};

export default function QuestionBasicFields({
  values,
  errors,
  disabled,
  contentFieldRef,
  onUpdateField,
}: QuestionBasicFieldsProps) {
  return (
    <>
      <div
        className={
          styles.field
        }
      >
        <label
          className={
            styles.label
          }
          htmlFor="question-type"
        >
          Loại câu hỏi
        </label>

        <select
          id="question-type"
          className={
            styles.input
          }
          value={
            values.type
          }
          disabled={
            disabled
          }
          onChange={(
            event
          ) =>
            onUpdateField(
              "type",
              event.target
                .value as QuestionType
            )
          }
        >
          <option value="single_choice">
            Trắc nghiệm
          </option>

          <option value="true_false_group">
            Nhóm đúng/sai
          </option>

          <option value="short_answer">
            Trả lời ngắn
          </option>
        </select>
      </div>

      <div
        className={
          styles.field
        }
      >
        <label
          className={
            styles.label
          }
          htmlFor="question-content"
        >
          Nội dung câu hỏi
        </label>

        <textarea
          ref={
            contentFieldRef
          }
          id="question-content"
          className={[
            styles.textarea,

            errors.content
              ? styles.invalid
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          rows={5}
          maxLength={
            CONTENT_MAX_LENGTH
          }
          value={
            values.content
          }
          disabled={
            disabled
          }
          placeholder="Nhập nội dung câu hỏi..."
          aria-invalid={
            Boolean(
              errors.content
            )
          }
          aria-describedby={
            errors.content
              ? "question-content-error question-content-meta"
              : "question-content-meta"
          }
          onChange={(
            event
          ) =>
            onUpdateField(
              "content",
              event.target.value
            )
          }
        />

        <div
          id="question-content-meta"
          className={
            styles.fieldMeta
          }
        >
          <span>
            Viết câu hỏi rõ ràng, ngắn gọn
            và tránh gây hiểu nhầm.
          </span>

          <span>
            {values.content.length}/
            {CONTENT_MAX_LENGTH}
          </span>
        </div>

        {errors.content ? (
          <p
            id="question-content-error"
            className={
              styles.error
            }
          >
            {errors.content}
          </p>
        ) : null}
      </div>

      <div
        className={
          styles.grid
        }
      >
        <div
          className={
            styles.field
          }
        >
          <label
            className={
              styles.label
            }
            htmlFor="question-subject"
          >
            Môn học
          </label>

          <select
            id="question-subject"
            className={[
              styles.input,

              errors.subject
                ? styles.invalid
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={getSubjectOption(
              values.subject
            )}
            disabled={
              disabled
            }
            aria-invalid={
              Boolean(
                errors.subject
              )
            }
            aria-describedby={
              errors.subject
                ? "question-subject-error"
                : undefined
            }
            onChange={(event) =>
              onUpdateField(
                "subject",
                event.target.value
              )
            }
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
            values.subject
          ) === OTHER_SUBJECT ? (
            <input
              className={[
                styles.input,
                styles.subjectOtherInput,
              ]
                .filter(Boolean)
                .join(" ")}
              value={
                values.subject === OTHER_SUBJECT
                  ? ""
                  : values.subject
              }
              disabled={disabled}
              placeholder="Nhập tên môn học"
              onChange={(event) =>
                onUpdateField(
                  "subject",
                  event.target.value
                )
              }
            />
          ) : null}

          {errors.subject ? (
            <p
              id="question-subject-error"
              className={
                styles.error
              }
            >
              {errors.subject}
            </p>
          ) : null}
        </div>

        <div
          className={
            styles.field
          }
        >
          <label
            className={
              styles.label
            }
            htmlFor="question-grade"
          >
            Khối lớp
          </label>

          <select
            id="question-grade"
            className={[
              styles.input,

              errors.grade
                ? styles.invalid
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={
              values.grade
            }
            disabled={
              disabled
            }
            aria-invalid={
              Boolean(
                errors.grade
              )
            }
            onChange={(
              event
            ) =>
              onUpdateField(
                "grade",
                event.target.value
              )
            }
          >
            <option value="10">
              Lớp 10
            </option>

            <option value="11">
              Lớp 11
            </option>

            <option value="12">
              Lớp 12
            </option>
          </select>
        </div>
      </div>

      <div
        className={
          styles.grid
        }
      >
        <div
          className={
            styles.field
          }
        >
          <label
            className={
              styles.label
            }
            htmlFor="question-topic"
          >
            Chủ đề
          </label>

          <input
            id="question-topic"
            className={
              styles.input
            }
            value={
              values.topic
            }
            disabled={
              disabled
            }
            placeholder="Ví dụ: Python"
            onChange={(
              event
            ) =>
              onUpdateField(
                "topic",
                event.target.value
              )
            }
          />
        </div>

        <div
          className={
            styles.field
          }
        >
          <label
            className={
              styles.label
            }
            htmlFor="question-difficulty"
          >
            Độ khó
          </label>

          <select
            id="question-difficulty"
            className={
              styles.input
            }
            value={
              values.difficulty
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) =>
              onUpdateField(
                "difficulty",
                event.target
                  .value as QuestionDifficulty
              )
            }
          >
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
        </div>
      </div>

      <div
        className={
          styles.grid
        }
      >
        <div
          className={
            styles.field
          }
        >
          <label
            className={
              styles.label
            }
            htmlFor="question-cognitive-level"
          >
            Mức độ nhận thức
          </label>

          <select
            id="question-cognitive-level"
            className={
              styles.input
            }
            value={
              values.cognitiveLevel
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) =>
              onUpdateField(
                "cognitiveLevel",
                event.target
                  .value as CognitiveLevel
              )
            }
          >
            <option value="recognition">
              Nhận biết
            </option>

            <option value="understanding">
              Thông hiểu
            </option>

            <option value="application">
              Vận dụng
            </option>

            <option value="high_application">
              Vận dụng cao
            </option>
          </select>
        </div>

        <div
          className={
            styles.field
          }
        >
          <label
            className={
              styles.label
            }
            htmlFor="question-tags"
          >
            Thẻ
          </label>

          <input
            id="question-tags"
            className={
              styles.input
            }
            value={
              values.tags
            }
            disabled={
              disabled
            }
            placeholder="Python, hàm, cơ bản"
            onChange={(
              event
            ) =>
              onUpdateField(
                "tags",
                event.target.value
              )
            }
          />

          <p
            className={
              styles.hint
            }
          >
            Phân cách nhiều thẻ bằng dấu
            phẩy.
          </p>
        </div>
      </div>
    </>
  );
}