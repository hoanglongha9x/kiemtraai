"use client";

import type {
  TestQuestionSnapshot,
  TestSection,
} from "../../types";

import TestQuestionItem from "./TestQuestionItem";

import styles from "../testEditor.module.css";

type TestSectionEditorProps = {
  section: TestSection;

  disabled?: boolean;

  onOpenPicker: () => void;

  onCreateQuestion: () => void;

  onSectionChange: (
    changes: Partial<
      Omit<
        TestSection,
        "id"
      >
    >
  ) => void;

  onRemoveQuestion: (
    testQuestionId: string
  ) => void;

  onMoveQuestion: (
    testQuestionId: string,
    direction:
      | "up"
      | "down"
  ) => void;

  onQuestionScoreChange: (
    testQuestionId: string,
    score: number
  ) => void;

  onQuestionRequiredChange: (
    testQuestionId: string,
    required: boolean
  ) => void;

  onQuestionSnapshotChange: (
    testQuestionId: string,
    snapshot: TestQuestionSnapshot
  ) => void;
};

const TYPE_LABELS = {
  single_choice:
    "Trắc nghiệm một đáp án",

  true_false_group:
    "Nhóm câu Đúng / Sai",

  short_answer:
    "Trả lời ngắn",
} as const;

export default function TestSectionEditor({
  section,
  disabled = false,
  onOpenPicker,
  onCreateQuestion,
  onSectionChange,
  onRemoveQuestion,
  onMoveQuestion,
  onQuestionScoreChange,
  onQuestionRequiredChange,
  onQuestionSnapshotChange,
}: TestSectionEditorProps) {
  const sectionScore =
    section.questions.reduce(
      (total, question) =>
        total +
        Number(
          question.score || 0
        ),
      0
    );

  return (
    <section
      className={
        styles.sectionCard
      }
    >
      <header
        className={
          styles.sectionHeader
        }
      >
        <div
          className={
            styles.sectionHeading
          }
        >
          <input
            type="text"
            value={
              section.title
            }
            disabled={
              disabled
            }
            className={
              styles.sectionTitleInput
            }
            onChange={(
              event
            ) =>
              onSectionChange({
                title:
                  event.target
                    .value,
              })
            }
          />

          <div
            className={
              styles.sectionMeta
            }
          >
            <span>
              {
                TYPE_LABELS[
                  section.type
                ]
              }
            </span>

            <span>•</span>

            <span>
              {
                section.questions
                  .length
              }{" "}
              câu
            </span>

            <span>•</span>

            <span>
              {sectionScore} điểm
            </span>
          </div>
        </div>

        <div
          className={
            styles.sectionActions
          }
        >
          <button
            type="button"
            className={
              styles.secondaryButton
            }
            disabled={
              disabled
            }
            onClick={
              onOpenPicker
            }
          >
            Mở ngân hàng
          </button>

          <button
            type="button"
            className={
              styles.primaryButton
            }
            disabled={
              disabled
            }
            onClick={
              onCreateQuestion
            }
          >
            + Thêm câu hỏi
          </button>
        </div>
      </header>

      <div
        className={
          styles.sectionSettings
        }
      >
        <label
          className={
            styles.field
          }
        >
          <span>Mô tả phần</span>

          <input
            type="text"
            value={
              section.description ??
              ""
            }
            disabled={
              disabled
            }
            placeholder="Hướng dẫn ngắn cho phần thi"
            onChange={(
              event
            ) =>
              onSectionChange({
                description:
                  event.target
                    .value ||
                  undefined,
              })
            }
          />
        </label>

        <label
          className={
            styles.field
          }
        >
          <span>
            Điểm mặc định
          </span>

          <input
            type="number"
            min="0.1"
            step="0.1"
            value={
              section.scorePerQuestion
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) =>
              onSectionChange({
                scorePerQuestion:
                  Number(
                    event.target
                      .value
                  ),
              })
            }
          />
        </label>
      </div>

      {section.questions.length ===
      0 ? (
        <div
          className={
            styles.emptySection
          }
        >
          <strong>
            Phần này chưa có câu hỏi
          </strong>

          <p>
            Chọn câu hỏi từ ngân hàng để bắt đầu xây dựng phần thi.
          </p>

          <div
            className={
              styles.emptyActions
            }
          >
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              disabled={
                disabled
              }
              onClick={
                onOpenPicker
              }
            >
              Mở ngân hàng câu hỏi
            </button>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              disabled={
                disabled
              }
              onClick={
                onCreateQuestion
              }
            >
              + Tạo câu hỏi mới
            </button>
          </div>
        </div>
      ) : (
        <div
          className={
            styles.questionList
          }
        >
          {section.questions.map(
            (
              question,
              index
            ) => (
             <TestQuestionItem
  key={
    question.id
  }
  question={
    question
  }
  index={
    index
  }
  first={
    index === 0
  }
  last={
    index ===
    section.questions.length -
      1
  }
  disabled={
    disabled
  }
  onMoveUp={() =>
    onMoveQuestion(
      question.id,
      "up"
    )
  }
  onMoveDown={() =>
    onMoveQuestion(
      question.id,
      "down"
    )
  }
  onRemove={() =>
    onRemoveQuestion(
      question.id
    )
  }
  onScoreChange={(
    score: number
  ) =>
    onQuestionScoreChange(
      question.id,
      score
    )
  }
  onRequiredChange={(
    required: boolean
  ) =>
    onQuestionRequiredChange(
      question.id,
      required
    )
  }
  onSnapshotChange={(
    snapshot
  ) =>
    onQuestionSnapshotChange(
      question.id,
      snapshot
    )
  }
/>
            )
          )}
        </div>
      )}
    </section>
  );
}
