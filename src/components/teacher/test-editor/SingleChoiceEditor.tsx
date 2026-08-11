"use client";

import type { CSSProperties } from "react";
import MathContent from "@/components/common/MathContent";

import type {
  AnswerKey,
  TestQuestionDraft,
} from "@/types/test-question";

type Props = {
  question: TestQuestionDraft;
  onChange: (question: TestQuestionDraft) => void;
};

const ANSWER_KEYS: AnswerKey[] = ["A", "B", "C", "D"];

export default function SingleChoiceEditor({
  question,
  onChange,
}: Props) {
  function updateField<K extends keyof TestQuestionDraft>(
    field: K,
    value: TestQuestionDraft[K]
  ) {
    onChange({
      ...question,
      [field]: value,
    });
  }

  function updateAnswerText(
    answerKey: AnswerKey,
    value: string
  ) {
    updateField(answerKey, value);
  }

  function updateCorrectAnswer(answerKey: AnswerKey) {
    updateField("correct", answerKey);
  }

  function removeAnswerImage(answerKey: AnswerKey) {
    const imageIdField =
      `${answerKey}ImageId` as keyof TestQuestionDraft;

    const imageUrlField =
      `${answerKey}ImageUrl` as keyof TestQuestionDraft;

    onChange({
      ...question,
      [imageIdField]: "",
      [imageUrlField]: "",
    });
  }

  return (
    <section style={sectionStyle}>
      <div style={sectionHeader}>
        <div>
          <h3 style={sectionTitle}>
            Đáp án trắc nghiệm
          </h3>

          <p style={sectionDescription}>
            Nhập bốn phương án và chọn một đáp án đúng.
          </p>
        </div>

        <span style={correctSummaryBadge}>
          Đáp án đúng: {question.correct}
        </span>
      </div>

      <div style={answerGrid}>
        {ANSWER_KEYS.map((answerKey) => {
          const imageUrlField =
            `${answerKey}ImageUrl` as keyof TestQuestionDraft;

          const imageUrl = String(
            question[imageUrlField] || ""
          );

          const isCorrect =
            question.correct === answerKey;

          return (
            <article
              key={answerKey}
              style={{
                ...answerCard,

                borderColor: isCorrect
                  ? "#22c55e"
                  : "#e2e8f0",

                background: isCorrect
                  ? "#f0fdf4"
                  : "white",
              }}
            >
              <div style={answerHeader}>
                <div style={answerTitleRow}>
                  <span
                    style={{
                      ...answerKeyBadge,

                      background: isCorrect
                        ? "#22c55e"
                        : "#dbeafe",

                      color: isCorrect
                        ? "white"
                        : "#1e40af",
                    }}
                  >
                    {answerKey}
                  </span>

                  <div>
                    <div style={answerTitle}>
                      Đáp án {answerKey}
                    </div>

                    <div style={answerHint}>
                      {isCorrect
                        ? "Đây là đáp án đúng"
                        : "Phương án trả lời"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateCorrectAnswer(answerKey)
                  }
                  style={{
                    ...correctButton,

                    background: isCorrect
                      ? "#16a34a"
                      : "#f1f5f9",

                    color: isCorrect
                      ? "white"
                      : "#475569",

                    borderColor: isCorrect
                      ? "#16a34a"
                      : "#cbd5e1",
                  }}
                >
                  {isCorrect
                    ? "✓ Đáp án đúng"
                    : "Chọn đáp án đúng"}
                </button>
              </div>

              <textarea
                value={question[answerKey]}
                onChange={(event) =>
                  updateAnswerText(
                    answerKey,
                    event.target.value
                  )
                }
                placeholder={`Nhập nội dung đáp án ${answerKey}`}
                style={answerTextarea}
              />

              {question[answerKey].trim() && (
                <div style={previewBox}>
                  <div style={previewLabel}>
                    Xem trước
                  </div>

                  <MathContent
                    text={question[answerKey]}
                  />
                </div>
              )}

              {imageUrl && (
                <div style={imageBox}>
                  <img
                    src={imageUrl}
                    alt={`Hình đáp án ${answerKey}`}
                    style={answerImage}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeAnswerImage(answerKey)
                    }
                    style={removeImageButton}
                  >
                    Xóa ảnh
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div style={answerFooter}>
        <div style={answerFooterText}>
          Chọn đáp án đúng bằng một trong các nút bên
          dưới:
        </div>

        <div style={correctAnswerButtons}>
          {ANSWER_KEYS.map((answerKey) => {
            const isCorrect =
              question.correct === answerKey;

            return (
              <button
                key={answerKey}
                type="button"
                onClick={() =>
                  updateCorrectAnswer(answerKey)
                }
                style={{
                  ...correctAnswerButton,

                  background: isCorrect
                    ? "#22c55e"
                    : "white",

                  color: isCorrect
                    ? "white"
                    : "#334155",

                  borderColor: isCorrect
                    ? "#22c55e"
                    : "#cbd5e1",
                }}
              >
                {answerKey}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const sectionStyle: CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  marginBottom: 18,
};

const sectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 16,
};

const sectionTitle: CSSProperties = {
  margin: "0 0 5px",
  fontSize: 19,
  fontWeight: 900,
  color: "#111827",
};

const sectionDescription: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.5,
};

const correctSummaryBadge: CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  fontSize: 13,
};

const answerGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 14,
};

const answerCard: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "2px solid #e2e8f0",
  boxSizing: "border-box",
  minWidth: 0,
};

const answerHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const answerTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const answerKeyBadge: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 17,
  flexShrink: 0,
};

const answerTitle: CSSProperties = {
  fontWeight: 900,
  color: "#111827",
};

const answerHint: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 3,
};

const correctButton: CSSProperties = {
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
};

const answerTextarea: CSSProperties = {
  width: "100%",
  minHeight: 88,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  resize: "vertical",
  fontSize: 15,
  lineHeight: 1.5,
  boxSizing: "border-box",
  background: "white",
};

const previewBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "white",
  border: "1px dashed #cbd5e1",
  color: "#334155",
  overflowWrap: "anywhere",
};

const previewLabel: CSSProperties = {
  marginBottom: 7,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const imageBox: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  marginTop: 12,
  flexWrap: "wrap",
};

const answerImage: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 220,
  objectFit: "contain",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "white",
};

const removeImageButton: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "none",
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  cursor: "pointer",
};

const answerFooter: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: "white",
  border: "1px dashed #cbd5e1",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const answerFooterText: CSSProperties = {
  color: "#475569",
  fontWeight: 800,
};

const correctAnswerButtons: CSSProperties = {
  display: "flex",
  gap: 9,
  flexWrap: "wrap",
};

const correctAnswerButton: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  fontWeight: 900,
  fontSize: 17,
  cursor: "pointer",
};