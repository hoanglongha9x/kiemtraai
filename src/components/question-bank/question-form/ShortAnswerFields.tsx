import type {
  QuestionFormErrors,
  QuestionFormUpdateField,
  QuestionFormValues,
} from "./questionFormTypes";

import styles from "../QuestionFormModal.module.css";

type ShortAnswerFieldsProps = {
  values: QuestionFormValues;

  errors: QuestionFormErrors;

  disabled: boolean;

  onUpdateField:
    QuestionFormUpdateField;
};

export default function ShortAnswerFields({
  values,
  errors,
  disabled,
  onUpdateField,
}: ShortAnswerFieldsProps) {
  const acceptedAnswersError =
    errors.acceptedAnswers;

  return (
    <section
      className={
        styles.section
      }
      aria-labelledby="short-answer-title"
    >
      <div>
        <h3
          id="short-answer-title"
          className={
            styles.sectionTitle
          }
        >
          Cấu hình trả lời ngắn
        </h3>

        <p
          className={
            styles.hint
          }
        >
          Thiết lập đáp án được chấp nhận
          và cách hệ thống so sánh kết quả.
        </p>
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
          htmlFor="accepted-answers"
        >
          Các đáp án được chấp nhận
        </label>

        <input
          id="accepted-answers"
          className={[
            styles.input,

            acceptedAnswersError
              ? styles.invalid
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          value={
            values.acceptedAnswers
          }
          disabled={
            disabled
          }
          placeholder="Ví dụ: def, define"
          aria-invalid={
            Boolean(
              acceptedAnswersError
            )
          }
          aria-describedby={
            acceptedAnswersError
              ? "accepted-answers-hint accepted-answers-error"
              : "accepted-answers-hint"
          }
          onChange={(
            event
          ) =>
            onUpdateField(
              "acceptedAnswers",
              event.target.value
            )
          }
        />

        <p
          id="accepted-answers-hint"
          className={
            styles.hint
          }
        >
          Phân cách nhiều đáp án bằng dấu
          phẩy.
        </p>

        {acceptedAnswersError ? (
          <p
            id="accepted-answers-error"
            className={
              styles.error
            }
          >
            {
              acceptedAnswersError
            }
          </p>
        ) : null}
      </div>

      <label
        className={
          styles.checkboxRow
        }
      >
        <input
          type="checkbox"
          checked={
            values.caseSensitive
          }
          disabled={
            disabled
          }
          onChange={(
            event
          ) =>
            onUpdateField(
              "caseSensitive",
              event.target.checked
            )
          }
        />

        <span>
          Phân biệt chữ hoa và chữ thường
        </span>
      </label>

      <label
        className={
          styles.checkboxRow
        }
      >
        <input
          type="checkbox"
          checked={
            values.trimWhitespace
          }
          disabled={
            disabled
          }
          onChange={(
            event
          ) =>
            onUpdateField(
              "trimWhitespace",
              event.target.checked
            )
          }
        />

        <span>
          Tự động loại bỏ khoảng trắng thừa
        </span>
      </label>

    </section>
  );
}
