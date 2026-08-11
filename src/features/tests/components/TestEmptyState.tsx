import styles from "./tests.module.css";

type TestEmptyStateProps = {
  filtered: boolean;

  onCreate: () => void;

  onResetFilters: () => void;
};

export function TestEmptyState({
  filtered,
  onCreate,
  onResetFilters,
}: TestEmptyStateProps) {
  return (
    <section
      className={
        styles.emptyState
      }
    >
      <div
        className={
          styles.emptyIcon
        }
        aria-hidden="true"
      >
        📝
      </div>

      <h2>
        {filtered
          ? "Không tìm thấy đề phù hợp"
          : "Chưa có đề kiểm tra"}
      </h2>

      <p>
        {filtered
          ? "Hãy thay đổi từ khóa hoặc bộ lọc để xem thêm kết quả."
          : "Tạo đề kiểm tra đầu tiên và bắt đầu thêm câu hỏi từ ngân hàng."}
      </p>

      <div
        className={
          styles.emptyActions
        }
      >
        {filtered ? (
          <button
            type="button"
            className={
              styles.secondaryButton
            }
            onClick={
              onResetFilters
            }
          >
            Đặt lại bộ lọc
          </button>
        ) : null}

        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={onCreate}
        >
          + Tạo đề mới
        </button>
      </div>
    </section>
  );
}