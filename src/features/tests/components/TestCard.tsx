"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import {
  TEST_VISIBILITY_LABELS,
} from "../constants";

import type {
  TestListItem,
} from "../types";

import {
  TestStatusBadge,
} from "./TestStatusBadge";

import styles from "./tests.module.css";

type TestCardProps = {
  test: TestListItem;

  disabled?: boolean;

  onDuplicate: (
    testId: string
  ) => Promise<void>;

  onArchive: (
    testId: string
  ) => Promise<void>;

  onRestore: (
    testId: string
  ) => Promise<void>;

  onDelete: (
    testId: string
  ) => Promise<void>;
};

function formatDate(
  value: string
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

export function TestCard({
  test,
  disabled = false,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: TestCardProps) {
  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  async function runAction(
    action: () => Promise<void>
  ) {
    try {
      setActionLoading(true);
      setMenuOpen(false);

      await action();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed =
      window.confirm(
        `Bạn có chắc muốn xóa đề “${test.title}”?`
      );

    if (!confirmed) {
      return;
    }

    await runAction(
      () =>
        onDelete(test.id)
    );
  }

  const isDisabled =
    disabled ||
    actionLoading;

  return (
    <article
      className={
        styles.testCard
      }
    >
      <div
        className={
          styles.cardTop
        }
      >
        <TestStatusBadge
          status={test.status}
        />

        <div
          className={
            styles.cardMenuWrapper
          }
        >
          <button
            type="button"
            aria-label="Mở menu thao tác"
            aria-expanded={
              menuOpen
            }
            className={
              styles.menuButton
            }
            disabled={isDisabled}
            onClick={() =>
              setMenuOpen(
                (current) =>
                  !current
              )
            }
          >
            ⋯
          </button>

          {menuOpen ? (
            <div
              className={
                styles.cardMenu
              }
            >
              <button
                type="button"
                onClick={() =>
                  runAction(
                    () =>
                      onDuplicate(
                        test.id
                      )
                  )
                }
              >
                Nhân bản
              </button>

              {test.status ===
              "archived" ? (
                <button
                  type="button"
                  onClick={() =>
                    runAction(
                      () =>
                        onRestore(
                          test.id
                        )
                    )
                  }
                >
                  Khôi phục
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    runAction(
                      () =>
                        onArchive(
                          test.id
                        )
                    )
                  }
                >
                  Lưu trữ
                </button>
              )}

              <button
                type="button"
                className={
                  styles.dangerMenuItem
                }
                onClick={
                  handleDelete
                }
              >
                Xóa đề
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={
          styles.cardContent
        }
      >
        <Link
          href={`/teacher/tests/${test.id}/edit`}
          className={
            styles.cardTitle
          }
        >
          {test.title}
        </Link>

        {test.description ? (
          <p
            className={
              styles.cardDescription
            }
          >
            {test.description}
          </p>
        ) : (
          <p
            className={
              styles.cardDescriptionMuted
            }
          >
            Chưa có mô tả
          </p>
        )}

        <div
          className={
            styles.cardMetadata
          }
        >
          <span>
            {test.subject ||
              "Chưa chọn môn"}
          </span>

          <span>
            Lớp{" "}
            {test.grade ||
              "—"}
          </span>

          <span>
            {
              TEST_VISIBILITY_LABELS[
                test.visibility
              ]
            }
          </span>
        </div>
      </div>

      <div
        className={
          styles.cardStats
        }
      >
        <div>
          <strong>
            {
              test.totalQuestions
            }
          </strong>

          <span>
            Câu hỏi
          </span>
        </div>

        <div>
          <strong>
            {test.totalQuestions > 0
              ? 10
              : 0}
          </strong>

          <span>
            Tổng điểm
          </span>
        </div>

        <div>
          <strong>
            {
              test.durationMinutes
            }
          </strong>

          <span>
            Phút
          </span>
        </div>
      </div>

      <footer
        className={
          styles.cardFooter
        }
      >
        <span>
          Cập nhật{" "}
          {formatDate(
            test.updatedAt
          )}
        </span>

        <Link
          href={`/teacher/tests/${test.id}/edit`}
          className={
            styles.editLink
          }
        >
          Chỉnh sửa
        </Link>
      </footer>

      {actionLoading ? (
        <div
          className={
            styles.cardLoadingOverlay
          }
        >
          Đang xử lý...
        </div>
      ) : null}
    </article>
  );
}
