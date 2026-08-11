"use client";

import type {
  AssignmentListItem,
  AssignmentStatus,
} from "../types";

import styles from "./assignments.module.css";

type AssignmentCardProps = {
  assignment:
    AssignmentListItem;

  mutating: boolean;

  onLock: (
    assignmentId: string
  ) => Promise<void>;

  onUnlock: (
    assignmentId: string
  ) => Promise<void>;

  onArchive: (
    assignmentId: string
  ) => Promise<void>;

  onRestore: (
    assignmentId: string
  ) => Promise<void>;
};

const STATUS_LABELS:
  Record<
    AssignmentStatus,
    string
  > = {
  scheduled:
    "Đã lên lịch",

  active:
    "Đang hoạt động",

  closed:
    "Đã đóng",

  locked:
    "Đã khóa",

  archived:
    "Đã lưu trữ",
};

function formatDateTime(
  value:
    string | undefined
): string {
  if (!value) {
    return "Không giới hạn";
  }

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
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  ).format(date);
}

function getStatusClassName(
  status:
    AssignmentStatus
): string {
  switch (status) {
    case "scheduled":
      return styles.statusScheduled;

    case "active":
      return styles.statusActive;

    case "closed":
      return styles.statusClosed;

    case "locked":
      return styles.statusLocked;

    case "archived":
      return styles.statusArchived;

    default:
      return "";
  }
}

export function AssignmentCard({
  assignment,
  mutating,
  onLock,
  onUnlock,
  onArchive,
  onRestore,
}: AssignmentCardProps) {
  const examLink =
    assignment.link ||
    `/exam/${assignment.assignmentCode}`;

  async function copyLink() {
    const absoluteLink =
      `${window.location.origin}${examLink}`;

    try {
      await navigator.clipboard.writeText(
        absoluteLink
      );
    } catch {
      window.prompt(
        "Sao chép đường dẫn:",
        absoluteLink
      );
    }
  }

  async function handleLock() {
    const confirmed =
      window.confirm(
        "Bạn có chắc muốn khóa lượt giao đề này?"
      );

    if (!confirmed) {
      return;
    }

    await onLock(
      assignment.id
    );
  }

  async function handleArchive() {
    const confirmed =
      window.confirm(
        "Bạn có chắc muốn lưu trữ lượt giao đề này?"
      );

    if (!confirmed) {
      return;
    }

    await onArchive(
      assignment.id
    );
  }

  return (
    <article
      className={
        styles.assignmentCard
      }
    >
      <div
        className={
          styles.assignmentCardHeader
        }
      >
        <div>
          <div
            className={
              styles.assignmentMetaLine
            }
          >
            <span
              className={`${styles.statusBadge} ${getStatusClassName(
                assignment.status
              )}`}
            >
              {
                STATUS_LABELS[
                  assignment.status
                ]
              }
            </span>

            <span
              className={
                styles.versionText
              }
            >
              Mã:{" "}
              <strong>
                {
                  assignment.assignmentCode
                }
              </strong>
            </span>
          </div>

          <h3
            className={
              styles.assignmentTitle
            }
          >
            {
              assignment.testTitle
            }
          </h3>

          <p
            className={
              styles.assignmentSubtitle
            }
          >
            {assignment.subject}
            {assignment.grade
              ? ` · Khối ${assignment.grade}`
              : ""}
          </p>
        </div>

        <a
          className={
            styles.openExamButton
          }
          href={examLink}
          target="_blank"
          rel="noreferrer"
        >
          Mở bài thi
        </a>
      </div>

      <div
        className={
          styles.assignmentStats
        }
      >
        <div>
          <span>Thời lượng</span>

          <strong>
            {
              assignment.durationMinutes
            }{" "}
            phút
          </strong>
        </div>

        <div>
          <span>Số câu</span>

          <strong>
            {
              assignment.totalQuestions
            }
          </strong>
        </div>

        <div>
          <span>Tổng điểm</span>

          <strong>
            {
              assignment.totalQuestions > 0
                ? 10
                : 0
            }
          </strong>
        </div>

        <div>
          <span>Lượt làm</span>

          <strong>
            {
              assignment.maxAttempts
            }
          </strong>
        </div>
      </div>

      <div
        className={
          styles.assignmentInformation
        }
      >
        <div>
          <span>Lớp được giao</span>

          <strong>
            {assignment.classNames.length >
            0
              ? assignment.classNames.join(
                  ", "
                )
              : "Chưa xác định"}
          </strong>
        </div>

        <div>
          <span>Thời gian mở</span>

          <strong>
            {formatDateTime(
              assignment.startTime
            )}
          </strong>
        </div>

        <div>
          <span>Thời gian đóng</span>

          <strong>
            {formatDateTime(
              assignment.endTime
            )}
          </strong>
        </div>

        <div>
          <span>Mật khẩu</span>

          <strong>
            {assignment.hasPassword
              ? "Có yêu cầu"
              : "Không yêu cầu"}
          </strong>
        </div>
      </div>

      <div
        className={
          styles.assignmentFooter
        }
      >
        <button
          type="button"
          className={
            styles.secondaryButton
          }
          disabled={
            mutating
          }
          onClick={() => {
            void copyLink();
          }}
        >
          Sao chép liên kết
        </button>

        <div
          className={
            styles.cardActions
          }
        >
          {assignment.status ===
          "locked" ? (
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              disabled={
                mutating
              }
              onClick={() => {
                void onUnlock(
                  assignment.id
                );
              }}
            >
              Mở khóa
            </button>
          ) : assignment.status !==
            "archived" ? (
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              disabled={
                mutating
              }
              onClick={() => {
                void handleLock();
              }}
            >
              Khóa
            </button>
          ) : null}

          {assignment.status ===
          "archived" ? (
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              disabled={
                mutating
              }
              onClick={() => {
                void onRestore(
                  assignment.id
                );
              }}
            >
              Khôi phục
            </button>
          ) : (
            <button
              type="button"
              className={
                styles.dangerButton
              }
              disabled={
                mutating
              }
              onClick={() => {
                void handleArchive();
              }}
            >
              Lưu trữ
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
