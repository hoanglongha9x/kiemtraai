import type {
  QuestionFormErrors,
  QuestionFormUpdateField,
  QuestionFormValues,
} from "./questionFormTypes";

import styles from "../QuestionFormModal.module.css";

type QuestionAnalysisFieldsProps = {
  values: QuestionFormValues;
  errors: QuestionFormErrors;
  disabled: boolean;
  onUpdateField: QuestionFormUpdateField;
};

export default function QuestionAnalysisFields({
  values,
  errors,
  disabled,
  onUpdateField,
}: QuestionAnalysisFieldsProps) {
  const requiredFields = [
    values.topic,
    values.knowledgeUnit,
    values.skill,
    values.learningOutcome,
  ];
  const completedCount = requiredFields.filter((value) => value.trim()).length;

  return (
    <section className={styles.section} aria-labelledby="analysis-metadata-title">
      <div>
        <h3 id="analysis-metadata-title" className={styles.sectionTitle}>
          Thông tin đánh giá năng lực
        </h3>
        <p className={styles.hint}>
          Dùng để tổng hợp năng lực, phát hiện phần kiến thức cần hỗ trợ và tạo
          báo cáo ôn tập.
        </p>
        <p className={styles.hint} role="status">
          Đã hoàn thành {completedCount}/4 nhãn phân tích cốt lõi.
        </p>
      </div>

      <div className={styles.grid}>
        <AnalysisInput
          id="question-knowledge-unit"
          label="Đơn vị kiến thức"
          value={values.knowledgeUnit}
          error={errors.knowledgeUnit}
          placeholder="Ví dụ: Câu lệnh điều kiện if"
          disabled={disabled}
          onChange={(value) => onUpdateField("knowledgeUnit", value)}
        />
        <AnalysisInput
          id="question-skill"
          label="Kỹ năng"
          value={values.skill}
          error={errors.skill}
          placeholder="Ví dụ: Phân tích điều kiện"
          disabled={disabled}
          onChange={(value) => onUpdateField("skill", value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="question-learning-outcome">
          Yêu cầu cần đạt
        </label>
        <input
          id="question-learning-outcome"
          className={[styles.input, errors.learningOutcome ? styles.invalid : ""]
            .filter(Boolean)
            .join(" ")}
          value={values.learningOutcome}
          disabled={disabled}
          placeholder="Ví dụ: Xác định được nhánh lệnh được thực hiện"
          onChange={(event) =>
            onUpdateField("learningOutcome", event.target.value)
          }
        />
        {errors.learningOutcome ? (
          <p className={styles.error}>{errors.learningOutcome}</p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="question-explanation">
          Giải thích đáp án
        </label>
        <textarea
          id="question-explanation"
          className={styles.textarea}
          rows={4}
          value={values.explanation}
          disabled={disabled}
          placeholder="Giải thích đáp án đúng và lỗi học sinh thường mắc"
          onChange={(event) => onUpdateField("explanation", event.target.value)}
        />
      </div>
    </section>
  );
}

function AnalysisInput({
  id,
  label,
  value,
  error,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={[styles.input, error ? styles.invalid : ""]
          .filter(Boolean)
          .join(" ")}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
