import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

import type {
  TestListFilters,
  TestListSort,
  TestListStatusFilter,
  TestListVisibilityFilter,
} from "../types";

import styles from "./tests.module.css";

type TestListToolbarProps = {
  filters: TestListFilters;

  disabled?: boolean;

  onSearchChange: (
    value: string
  ) => void;

  onStatusChange: (
    value: TestListStatusFilter
  ) => void;

  onVisibilityChange: (
    value: TestListVisibilityFilter
  ) => void;

  onSubjectChange: (
    value: string
  ) => void;

  onSortChange: (
    value: TestListSort
  ) => void;

  onReset: () => void;
};

export function TestListToolbar({
  filters,
  disabled = false,
  onSearchChange,
  onStatusChange,
  onVisibilityChange,
  onSubjectChange,
  onSortChange,
  onReset,
}: TestListToolbarProps) {
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.visibility !== "all" ||
    filters.subject !== "" ||
    filters.grade !== "" ||
    filters.sort !== "updated_desc";

  return (
    <section
      className={styles.toolbar}
      aria-label="Bộ lọc đề kiểm tra"
    >
      <div
        className={
          styles.searchField
        }
      >
        <span
          className={
            styles.searchIcon
          }
          aria-hidden="true"
        >
          ⌕
        </span>

        <input
          type="search"
          value={filters.search}
          placeholder="Tìm kiếm đề kiểm tra..."
          disabled={disabled}
          onChange={(event) =>
            onSearchChange(
              event.target.value
            )
          }
        />
      </div>

      <select
        value={filters.status}
        disabled={disabled}
        onChange={(event) =>
          onStatusChange(
            event.target
              .value as TestListStatusFilter
          )
        }
      >
        <option value="all">
          Tất cả trạng thái
        </option>

        <option value="draft">
          Bản nháp
        </option>

        <option value="published">
          Đã xuất bản
        </option>

        <option value="archived">
          Đã lưu trữ
        </option>
      </select>

      <select
        value={
          filters.visibility
        }
        disabled={disabled}
        onChange={(event) =>
          onVisibilityChange(
            event.target
              .value as TestListVisibilityFilter
          )
        }
      >
        <option value="all">
          Tất cả phạm vi
        </option>

        <option value="private">
          Riêng tư
        </option>

        <option value="school">
          Trong trường
        </option>

        <option value="public">
          Công khai
        </option>
      </select>

      <select
        value={filters.subject}
        disabled={disabled}
        onChange={(event) =>
          onSubjectChange(
            event.target.value
          )
        }
      >
        <option value="">
          Tất cả môn
        </option>

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

      <select
        value={filters.sort}
        disabled={disabled}
        onChange={(event) =>
          onSortChange(
            event.target
              .value as TestListSort
          )
        }
      >
        <option value="updated_desc">
          Cập nhật mới nhất
        </option>

        <option value="updated_asc">
          Cập nhật cũ nhất
        </option>

        <option value="created_desc">
          Tạo mới nhất
        </option>

        <option value="created_asc">
          Tạo cũ nhất
        </option>

        <option value="title_asc">
          Tên A–Z
        </option>

        <option value="title_desc">
          Tên Z–A
        </option>
      </select>

      {hasActiveFilters ? (
        <button
          type="button"
          className={
            styles.resetButton
          }
          disabled={disabled}
          onClick={onReset}
        >
          Đặt lại
        </button>
      ) : null}
    </section>
  );
}