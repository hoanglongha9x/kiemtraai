import {
  Button,
  SearchInput,
} from "@/components/ui";

import type {
  QuestionDifficulty,
  QuestionType,
} from "./types";

import styles from "./QuestionBankToolbar.module.css";

export type QuestionBankSort =
  | "newest"
  | "oldest";

export type QuestionBankFilters = {
  search: string;

  type:
    | "all"
    | QuestionType;

  difficulty:
    | "all"
    | QuestionDifficulty;

  grade:
    | "all"
    | string;

  sort: QuestionBankSort;
};

type QuestionBankToolbarProps = {
  filters: QuestionBankFilters;

  selectedCount: number;
  visibleCount: number;
  totalCount: number;

  allVisibleSelected: boolean;
  searchPending?: boolean;

  onFiltersChange: (
    filters: QuestionBankFilters
  ) => void;

  onToggleSelectAll: () => void;
  onClearSelection: () => void;

  onAddSelectedToTest?: () => void;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;

  onCreateQuestion?: () => void;
  onImportQuestions?: () => void;
  onGenerateWithAI?: () => void;
};

type FilterOption<Value> = {
  value: Value;
  label: string;
};

const TYPE_OPTIONS: Array<
  FilterOption<
    QuestionBankFilters["type"]
  >
> = [
  {
    value: "all",
    label: "Tất cả",
  },
  {
    value: "single_choice",
    label: "Trắc nghiệm",
  },
  {
    value: "true_false_group",
    label: "Đúng / Sai",
  },
  {
    value: "short_answer",
    label: "Trả lời ngắn",
  },
];

const DIFFICULTY_OPTIONS: Array<
  FilterOption<
    QuestionBankFilters["difficulty"]
  >
> = [
  {
    value: "all",
    label: "Tất cả",
  },
  {
    value: "easy",
    label: "Dễ",
  },
  {
    value: "medium",
    label: "Trung bình",
  },
  {
    value: "hard",
    label: "Khó",
  },
];

const GRADE_OPTIONS: Array<
  FilterOption<
    QuestionBankFilters["grade"]
  >
> = [
  {
    value: "all",
    label: "Tất cả",
  },
  {
    value: "10",
    label: "Khối 10",
  },
  {
    value: "11",
    label: "Khối 11",
  },
  {
    value: "12",
    label: "Khối 12",
  },
];

function getOptionLabel<Value>(
  options: Array<
    FilterOption<Value>
  >,
  value: Value
): string {
  return (
    options.find(
      (option) =>
        option.value === value
    )?.label ??
    String(value)
  );
}

export default function QuestionBankToolbar({
  filters,
  selectedCount,
  visibleCount,
  totalCount,
  allVisibleSelected,
  searchPending = false,
  onFiltersChange,
  onToggleSelectAll,
  onClearSelection,
  onAddSelectedToTest,
  onDuplicateSelected,
  onDeleteSelected,
  onCreateQuestion,
  onImportQuestions,
  onGenerateWithAI,
}: QuestionBankToolbarProps) {
  const hasSelection =
    selectedCount > 0;

  const hasVisibleQuestions =
    visibleCount > 0;

  const trimmedSearch =
    filters.search.trim();

  const hasActiveFilters =
    trimmedSearch !== "" ||
    filters.type !== "all" ||
    filters.difficulty !==
      "all" ||
    filters.grade !== "all";

  const updateFilter = <
    Key extends keyof QuestionBankFilters,
  >(
    key: Key,
    value:
      QuestionBankFilters[Key]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      type: "all",
      difficulty: "all",
      grade: "all",
      sort: filters.sort,
    });
  };

  return (
    <section
      className={styles.toolbar}
      aria-label="Công cụ ngân hàng câu hỏi"
    >
      <div
        className={
          styles.primaryRow
        }
      >
        <div
          className={
            styles.searchSection
          }
        >
          <SearchInput
            value={filters.search}
            placeholder="Tìm nội dung, môn học, chủ đề, thẻ hoặc mã câu hỏi..."
            onChange={(value) => {
              updateFilter(
                "search",
                value
              );
            }}
          />

          {trimmedSearch !== "" && (
            <button
              type="button"
              className={
                styles.clearSearchButton
              }
              aria-label="Xóa nội dung tìm kiếm"
              title="Xóa nội dung tìm kiếm"
              onClick={() => {
                updateFilter(
                  "search",
                  ""
                );
              }}
            >
              <span
                aria-hidden="true"
              >
                ×
              </span>
            </button>
          )}
        </div>

        <div
          className={
            styles.primaryActions
          }
        >
          {onImportQuestions && (
            <Button
              type="button"
              variant="outline"
              onClick={
                onImportQuestions
              }
            >
              Nhập câu hỏi
            </Button>
          )}

          {onGenerateWithAI && (
            <Button
              type="button"
              variant="secondary"
              onClick={
                onGenerateWithAI
              }
            >
              AI tạo câu hỏi
            </Button>
          )}

          {onCreateQuestion && (
            <Button
              type="button"
              onClick={
                onCreateQuestion
              }
            >
              + Tạo câu hỏi
            </Button>
          )}
        </div>
      </div>

      <div
        className={
          styles.filterPanel
        }
      >
        <FilterChipGroup
          label="Loại câu hỏi"
          ariaLabel="Lọc theo loại câu hỏi"
          options={TYPE_OPTIONS}
          value={filters.type}
          onChange={(value) => {
            updateFilter(
              "type",
              value
            );
          }}
        />

        <FilterChipGroup
          label="Độ khó"
          ariaLabel="Lọc theo độ khó"
          options={
            DIFFICULTY_OPTIONS
          }
          value={
            filters.difficulty
          }
          onChange={(value) => {
            updateFilter(
              "difficulty",
              value
            );
          }}
        />

        <FilterChipGroup
          label="Khối lớp"
          ariaLabel="Lọc theo khối lớp"
          options={
            GRADE_OPTIONS
          }
          value={filters.grade}
          onChange={(value) => {
            updateFilter(
              "grade",
              value
            );
          }}
        />

        <label
          className={
            styles.sortField
          }
        >
          <span
            className={
              styles.filterLabel
            }
          >
            Sắp xếp
          </span>

          <select
            className={
              styles.sortSelect
            }
            value={filters.sort}
            onChange={(event) => {
              updateFilter(
                "sort",
                event.target
                  .value as QuestionBankSort
              );
            }}
          >
            <option value="newest">
              Mới nhất
            </option>

            <option value="oldest">
              Cũ nhất
            </option>
          </select>
        </label>
      </div>

      <div
        className={
          styles.resultRow
        }
      >
        <div
          className={
            styles.resultSummary
          }
          aria-live="polite"
          aria-atomic="true"
        >
          {searchPending ? (
            <span
              className={
                styles.searchingStatus
              }
            >
              Đang tìm kiếm...
            </span>
          ) : (
            <>
              <strong>
                {visibleCount}
              </strong>

              <span>
                {" "}
                / {totalCount} câu hỏi
              </span>
            </>
          )}
        </div>

        {hasActiveFilters && (
          <div
            className={
              styles.activeFilters
            }
            aria-label="Các bộ lọc đang áp dụng"
          >
            {trimmedSearch !== "" && (
              <ActiveFilterChip
                label={`Từ khóa: “${trimmedSearch}”`}
                ariaLabel="Xóa từ khóa tìm kiếm"
                onRemove={() => {
                  updateFilter(
                    "search",
                    ""
                  );
                }}
              />
            )}

            {filters.type !==
              "all" && (
              <ActiveFilterChip
                label={getOptionLabel(
                  TYPE_OPTIONS,
                  filters.type
                )}
                ariaLabel="Xóa bộ lọc loại câu hỏi"
                onRemove={() => {
                  updateFilter(
                    "type",
                    "all"
                  );
                }}
              />
            )}

            {filters.difficulty !==
              "all" && (
              <ActiveFilterChip
                label={getOptionLabel(
                  DIFFICULTY_OPTIONS,
                  filters.difficulty
                )}
                ariaLabel="Xóa bộ lọc độ khó"
                onRemove={() => {
                  updateFilter(
                    "difficulty",
                    "all"
                  );
                }}
              />
            )}

            {filters.grade !==
              "all" && (
              <ActiveFilterChip
                label={getOptionLabel(
                  GRADE_OPTIONS,
                  filters.grade
                )}
                ariaLabel="Xóa bộ lọc khối lớp"
                onRemove={() => {
                  updateFilter(
                    "grade",
                    "all"
                  );
                }}
              />
            )}

            <button
              type="button"
              className={
                styles.clearFiltersButton
              }
              onClick={
                clearFilters
              }
            >
              Xóa tất cả
            </button>
          </div>
        )}
      </div>

      <div
        className={`${styles.selectionBar} ${
          hasSelection
            ? styles.selectionBarActive
            : ""
        }`}
      >
        <div
          className={
            styles.selectionInfo
          }
        >
          <label
            className={
              styles.selectAll
            }
          >
            <input
              type="checkbox"
              className={
                styles.checkbox
              }
              checked={
                hasVisibleQuestions &&
                allVisibleSelected
              }
              disabled={
                !hasVisibleQuestions
              }
              onChange={
                onToggleSelectAll
              }
            />

            <span>
              {allVisibleSelected
                ? "Bỏ chọn các câu đang hiển thị"
                : "Chọn tất cả câu đang hiển thị"}
            </span>
          </label>

          {hasSelection ? (
            <span
              className={
                styles.selectedCount
              }
              aria-live="polite"
            >
              Đã chọn{" "}
              <strong>
                {selectedCount}
              </strong>{" "}
              câu hỏi
            </span>
          ) : (
            <span
              className={
                styles.selectionHint
              }
            >
              Chọn câu hỏi để thực
              hiện thao tác hàng loạt
            </span>
          )}
        </div>

        {hasSelection && (
          <div
            className={
              styles.bulkActions
            }
          >
            <button
              type="button"
              className={
                styles.clearSelectionButton
              }
              onClick={
                onClearSelection
              }
            >
              Bỏ chọn
            </button>

            {onAddSelectedToTest && (
              <Button
                type="button"
                variant="outline"
                onClick={
                  onAddSelectedToTest
                }
              >
                Thêm vào đề
              </Button>
            )}

            {onDuplicateSelected && (
              <Button
                type="button"
                variant="outline"
                onClick={
                  onDuplicateSelected
                }
              >
                Nhân bản
              </Button>
            )}

            {onDeleteSelected && (
              <Button
                type="button"
                variant="danger"
                onClick={
                  onDeleteSelected
                }
              >
                Xóa đã chọn
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

type FilterChipGroupProps<
  Value extends string,
> = {
  label: string;
  ariaLabel: string;

  options: Array<
    FilterOption<Value>
  >;

  value: Value;

  onChange: (
    value: Value
  ) => void;
};

function FilterChipGroup<
  Value extends string,
>({
  label,
  ariaLabel,
  options,
  value,
  onChange,
}: FilterChipGroupProps<Value>) {
  return (
    <div
      className={
        styles.filterGroup
      }
    >
      <span
        className={
          styles.filterLabel
        }
      >
        {label}
      </span>

      <div
        className={
          styles.chipList
        }
        role="group"
        aria-label={ariaLabel}
      >
        {options.map(
          (option) => {
            const active =
              value ===
              option.value;

            return (
              <button
                key={
                  option.value
                }
                type="button"
                aria-pressed={
                  active
                }
                className={`${styles.filterChip} ${
                  active
                    ? styles.filterChipActive
                    : ""
                }`}
                onClick={() => {
                  onChange(
                    option.value
                  );
                }}
              >
                {option.label}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

type ActiveFilterChipProps = {
  label: string;
  ariaLabel: string;
  onRemove: () => void;
};

function ActiveFilterChip({
  label,
  ariaLabel,
  onRemove,
}: ActiveFilterChipProps) {
  return (
    <button
      type="button"
      className={
        styles.activeFilterChip
      }
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onRemove}
    >
      <span
        className={
          styles.activeFilterText
        }
      >
        {label}
      </span>

      <span
        className={
          styles.activeFilterRemove
        }
        aria-hidden="true"
      >
        ×
      </span>
    </button>
  );
}