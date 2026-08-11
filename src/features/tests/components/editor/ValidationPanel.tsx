import type {
  TestValidationResult,
} from "../../types";

import styles from "../testEditor.module.css";

type ValidationPanelProps = {
  validation:
    TestValidationResult;

  visible?: boolean;
};

export default function ValidationPanel({
  validation,
  visible = true,
}: ValidationPanelProps) {
  if (!visible) {
    return null;
  }

  if (
    validation.issues.length ===
    0
  ) {
    return (
      <section
        className={
          styles.validationSuccess
        }
      >
        <div
          className={
            styles.validationHeader
          }
        >
          <strong>
            Đề kiểm tra hợp lệ
          </strong>

          <span>
            Có thể xuất bản
          </span>
        </div>

        <p>
          Không phát hiện lỗi cần
          khắc phục.
        </p>
      </section>
    );
  }

  return (
    <section
      className={
        styles.validationPanel
      }
    >
      <div
        className={
          styles.validationHeader
        }
      >
        <strong>
          Kiểm tra đề
        </strong>

        <span>
          {validation.errors.length} lỗi
          {" · "}
          {validation.warnings.length} cảnh báo
        </span>
      </div>

      {validation.errors.length >
      0 ? (
        <div
          className={
            styles.validationGroup
          }
        >
          <h3>
            Lỗi cần khắc phục
          </h3>

          <ul>
            {validation.errors.map(
              (
                issue,
                index
              ) => (
                <li
                  key={`${issue.code}-${issue.sectionId ?? "test"}-${issue.questionId ?? index}`}
                  className={
                    styles.validationErrorItem
                  }
                >
                  {issue.message}
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}

      {validation.warnings.length >
      0 ? (
        <div
          className={
            styles.validationGroup
          }
        >
          <h3>
            Cảnh báo
          </h3>

          <ul>
            {validation.warnings.map(
              (
                issue,
                index
              ) => (
                <li
                  key={`${issue.code}-${issue.sectionId ?? "test"}-${issue.questionId ?? index}`}
                  className={
                    styles.validationWarningItem
                  }
                >
                  {issue.message}
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
}