import styles from "../QuestionFormModal.module.css";

type QuestionFormHeaderProps = {
  editing: boolean;
  disabled: boolean;
  onClose: () => void;
};

export default function QuestionFormHeader({
  editing,
  disabled,
  onClose,
}: QuestionFormHeaderProps) {
  return (
    <header
      className={
        styles.header
      }
    >
      <div>
        <h2
          id="question-form-title"
          className={
            styles.title
          }
        >
          {editing
            ? "Chỉnh sửa câu hỏi"
            : "Tạo câu hỏi mới"}
        </h2>

        <p
          id="question-form-description"
          className={
            styles.subtitle
          }
        >
          Điền đầy đủ nội dung, đáp án và
          thông tin phân loại.
        </p>
      </div>

      <button
        type="button"
        className={
          styles.closeButton
        }
        disabled={
          disabled
        }
        onClick={
          onClose
        }
        aria-label="Đóng biểu mẫu"
      >
        ×
      </button>
    </header>
  );
}