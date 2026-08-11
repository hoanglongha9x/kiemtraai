import {
  OPTION_IDS,
} from "./questionFormConstants";

import type {
  QuestionFormErrors,
  QuestionFormUpdateField,
  QuestionFormValues,
  StatementAnswerField,
  StatementContentField,
} from "./questionFormTypes";

import styles from "../QuestionFormModal.module.css";

type TrueFalseGroupFieldsProps = {
  values: QuestionFormValues;

  errors: QuestionFormErrors;

  disabled: boolean;

  onUpdateField:
    QuestionFormUpdateField;
};

export default function TrueFalseGroupFields({
  values,
  errors,
  disabled,
  onUpdateField,
}: TrueFalseGroupFieldsProps) {
  return (
    <section
      className={
        styles.section
      }
      aria-labelledby="true-false-title"
    >
      <div>
        <h3
          id="true-false-title"
          className={
            styles.sectionTitle
          }
        >
          Các mệnh đề đúng/sai
        </h3>

        <p
          className={
            styles.hint
          }
        >
          Nhập bốn mệnh đề và chọn đáp án
          đúng hoặc sai cho từng mệnh đề.
        </p>
      </div>

      {OPTION_IDS.map(
        (
          statementId
        ) => {
          const contentField =
            `statement${statementId}` as
              StatementContentField;

          const answerField =
            `statement${statementId}Answer` as
              StatementAnswerField;

          const errorMessage =
            errors[
              contentField
            ];

          const errorId =
            `question-${contentField}-error`;

          return (
            <div
              key={
                statementId
              }
              className={
                styles.statementRow
              }
            >
              <span
                className={
                  styles.optionLabel
                }
                aria-hidden="true"
              >
                {
                  statementId
                }
              </span>

              <div
                className={
                  styles.statementContent
                }
              >
                <textarea
                  className={[
                    styles.textarea,

                    errorMessage
                      ? styles.invalid
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  rows={2}
                  value={
                    values[
                      contentField
                    ]
                  }
                  disabled={
                    disabled
                  }
                  placeholder={`Nhập mệnh đề ${statementId}`}
                  aria-label={`Nội dung mệnh đề ${statementId}`}
                  aria-invalid={
                    Boolean(
                      errorMessage
                    )
                  }
                  aria-describedby={
                    errorMessage
                      ? errorId
                      : undefined
                  }
                  onChange={(
                    event
                  ) =>
                    onUpdateField(
                      contentField,
                      event.target.value
                    )
                  }
                />

                {errorMessage ? (
                  <p
                    id={
                      errorId
                    }
                    className={
                      styles.error
                    }
                  >
                    {
                      errorMessage
                    }
                  </p>
                ) : null}
              </div>

              <select
                className={
                  styles.answerSelect
                }
                value={
                  values[
                    answerField
                  ]
                    ? "true"
                    : "false"
                }
                disabled={
                  disabled
                }
                aria-label={`Đáp án mệnh đề ${statementId}`}
                onChange={(
                  event
                ) =>
                  onUpdateField(
                    answerField,
                    event.target.value ===
                      "true"
                  )
                }
              >
                <option value="true">
                  Đúng
                </option>

                <option value="false">
                  Sai
                </option>
              </select>
            </div>
          );
        }
      )}
    </section>
  );
}