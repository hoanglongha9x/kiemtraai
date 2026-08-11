import {
  Button,
} from "@/components/ui";

import styles from "../QuestionFormModal.module.css";

type QuestionFormFooterProps = {
  editing: boolean;
  submitting: boolean;
  disabled: boolean;
  onCancel: () => void;
};

export default function QuestionFormFooter({
  editing,
  submitting,
  disabled,
  onCancel,
}: QuestionFormFooterProps) {
  return (
    <footer
      className={
        styles.footer
      }
    >
      <Button
        type="button"
        variant="outline"
        disabled={
          disabled
        }
        onClick={
          onCancel
        }
      >
        Hủy
      </Button>

      <Button
        type="submit"
        disabled={
          disabled
        }
      >
        {submitting ? (
          <span
            className={
              styles.spinner
            }
            aria-hidden="true"
          />
        ) : null}

        {submitting
          ? "Đang lưu..."
          : editing
            ? "Lưu thay đổi"
            : "Tạo câu hỏi"}
      </Button>
    </footer>
  );
}