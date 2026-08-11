"use client";

import type {
  QuestionCardData,
  QuestionDifficulty,
  QuestionType,
} from "@/components/question-bank/types";

import styles from "../testEditor.module.css";

type QuestionPickerCardProps = {
  question: QuestionCardData;
  selected: boolean;
  disabled?: boolean;
  alreadyAdded?: boolean;
  onToggle: (questionId: string) => void;
};

const TYPE_LABELS: Record<
  QuestionType,
  string
> = {
  single_choice: "Trắc nghiệm",
  true_false_group: "Đúng / Sai",
  short_answer: "Trả lời ngắn",
};

const DIFFICULTY_LABELS: Record<
  QuestionDifficulty,
  string
> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

function getQuestionPreview(
  question: QuestionCardData
): string {
  const normalized =
    question.content
      .replace(/\s+/g, " ")
      .trim();

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 180)}…`;
}

export default function QuestionPickerCard({
  question,
  selected,
  disabled = false,
  alreadyAdded = false,
  onToggle,
}: QuestionPickerCardProps) {
  const isDisabled =
    disabled || alreadyAdded;

  return (
    <button
      type="button"
      className={[
        styles.pickerCard,
        selected
          ? styles.pickerCardSelected
          : "",
        isDisabled
          ? styles.pickerCardDisabled
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isDisabled}
      onClick={() =>
        onToggle(question.id)
      }
    >
      <span
        className={
          styles.pickerCheckbox
        }
        aria-hidden="true"
      >
        {alreadyAdded
          ? "✓"
          : selected
            ? "✓"
            : ""}
      </span>

      <span
        className={
          styles.pickerCardContent
        }
      >
        <span
          className={
            styles.pickerCardTop
          }
        >
          <span
            className={
              styles.pickerType
            }
          >
            {
              TYPE_LABELS[
                question.type
              ]
            }
          </span>

          <span
            className={
              styles.pickerDifficulty
            }
          >
            {
              DIFFICULTY_LABELS[
                question.difficulty
              ]
            }
          </span>

          {alreadyAdded ? (
            <span
              className={
                styles.pickerAdded
              }
            >
              Đã có trong đề
            </span>
          ) : null}
        </span>

        <strong
          className={
            styles.pickerQuestionContent
          }
        >
          {getQuestionPreview(
            question
          )}
        </strong>

        <span
          className={
            styles.pickerMetadata
          }
        >
          <span>
            {question.subject ||
              "Chưa có môn"}
          </span>

          <span>•</span>

          <span>
            Lớp{" "}
            {question.grade ||
              "—"}
          </span>

          {question.topic ? (
            <>
              <span>•</span>

              <span>
                {question.topic}
              </span>
            </>
          ) : null}
        </span>
      </span>
    </button>
  );
}