import {
  OPTION_IDS,
} from "./questionFormConstants";

import type {
  QuestionFormErrors,
  QuestionFormUpdateField,
  QuestionFormValues,
  TextOptionField,
} from "./questionFormTypes";

import styles from "../QuestionFormModal.module.css";

type SingleChoiceFieldsProps = {
  values: QuestionFormValues;

  errors: QuestionFormErrors;

  disabled: boolean;

  onUpdateField:
    QuestionFormUpdateField;
};

export default function SingleChoiceFields({
  values,
  errors,
  disabled,
  onUpdateField,
}: SingleChoiceFieldsProps) {
  return (
    <section
      className={
        styles.section
      }
      aria-labelledby="single-choice-title"
    >
      <div>
        <h3
          id="single-choice-title"
          className={
            styles.sectionTitle
          }
        >
          Các phương án
        </h3>

        <p
          className={
            styles.hint
          }
        >
          Chọn nút tròn bên trái để xác định
          đáp án đúng.
        </p>
      </div>

      {OPTION_IDS.map(
        (
          optionId
        ) => {
          const fieldName =
            `option${optionId}` as
              TextOptionField;

          const errorMessage =
            errors[
              fieldName
            ];

          const errorId =
            `question-${fieldName}-error`;

          return (
            <div
              key={
                optionId
              }
              className={
                styles.optionRow
              }
            >
              <input
                type="radio"
                name="correct-option"
                checked={
                  values.correctOptionId ===
                  optionId
                }
                disabled={
                  disabled
                }
                aria-label={`Chọn phương án ${optionId} là đáp án đúng`}
                onChange={
                  () =>
                    onUpdateField(
                      "correctOptionId",
                      optionId
                    )
                }
              />

              <span
                className={
                  styles.optionLabel
                }
                aria-hidden="true"
              >
                {optionId}
              </span>

              <div
                className={
                  styles.optionField
                }
              >
                <input
                  className={[
                    styles.input,

                    errorMessage
                      ? styles.invalid
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  value={
                    values[
                      fieldName
                    ]
                  }
                  disabled={
                    disabled
                  }
                  placeholder={`Nhập phương án ${optionId}`}
                  aria-label={`Nội dung phương án ${optionId}`}
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
                      fieldName,
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
            </div>
          );
        }
      )}
    </section>
  );
}