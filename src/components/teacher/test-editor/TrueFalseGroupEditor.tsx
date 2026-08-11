"use client";

import type { CSSProperties } from "react";
import MathContent from "@/components/common/MathContent";

import type {
  TestQuestionDraft,
  TrueFalseStatementDraft,
} from "@/types/test-question";

type Props = {
  question: TestQuestionDraft;
  onChange: (question: TestQuestionDraft) => void;
};

export default function TrueFalseGroupEditor({
  question,
  onChange,
}: Props) {
  function updateStatement(
    statementId: string,
    patch: Partial<TrueFalseStatementDraft>
  ) {
    onChange({
      ...question,
      statements: question.statements.map((statement) =>
        statement.id === statementId
          ? {
              ...statement,
              ...patch,
            }
          : statement
      ),
    });
  }

  function removeStatementImage(statementId: string) {
    updateStatement(statementId, {
      statementImageId: "",
      statementImageUrl: "",
    });
  }

  const trueCount = question.statements.filter(
    (statement) => statement.correct
  ).length;

  const falseCount = question.statements.length - trueCount;

  return (
    <section style={sectionStyle}>
      <div style={sectionHeader}>
        <div>
          <h3 style={sectionTitle}>Nhóm phát biểu Đúng/Sai</h3>

          <p style={sectionDescription}>
            Mỗi câu gồm đúng 4 phát biểu a, b, c, d. Giáo viên xác định từng
            phát biểu là đúng hoặc sai.
          </p>
        </div>

        <div style={summaryRow}>
          <span style={trueBadge}>Đúng: {trueCount}</span>
          <span style={falseBadge}>Sai: {falseCount}</span>
        </div>
      </div>

      {question.statements.length !== 4 && (
        <div style={warningBox}>
          Câu hỏi này cần đúng 4 phát biểu. Hiện có{" "}
          <b>{question.statements.length}</b> phát biểu.
        </div>
      )}

      <div style={statementList}>
        {question.statements.map((statement, index) => {
          const isCorrect = statement.correct;

          return (
            <article
              key={statement.id}
              style={{
                ...statementCard,
                borderColor: isCorrect ? "#22c55e" : "#ef4444",
                background: isCorrect ? "#f0fdf4" : "#fff7f7",
              }}
            >
              <div style={statementHeader}>
                <div style={statementTitleRow}>
                  <span
                    style={{
                      ...labelBadge,
                      background: isCorrect ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {statement.label || String.fromCharCode(97 + index)}
                  </span>

                  <div>
                    <div style={statementTitle}>
                      Phát biểu {statement.label}
                    </div>

                    <div style={statementHint}>
                      Chọn trạng thái đúng hoặc sai cho phát biểu này.
                    </div>
                  </div>
                </div>

                <div style={correctToggleGroup}>
                  <button
                    type="button"
                    onClick={() =>
                      updateStatement(statement.id, {
                        correct: true,
                      })
                    }
                    style={{
                      ...correctToggleButton,
                      background: isCorrect ? "#16a34a" : "white",
                      color: isCorrect ? "white" : "#166534",
                      borderColor: "#16a34a",
                    }}
                  >
                    Đúng
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateStatement(statement.id, {
                        correct: false,
                      })
                    }
                    style={{
                      ...correctToggleButton,
                      background: !isCorrect ? "#dc2626" : "white",
                      color: !isCorrect ? "white" : "#991b1b",
                      borderColor: "#dc2626",
                    }}
                  >
                    Sai
                  </button>
                </div>
              </div>

              <textarea
                value={statement.statement}
                onChange={(event) =>
                  updateStatement(statement.id, {
                    statement: event.target.value,
                  })
                }
                placeholder={`Nhập nội dung phát biểu ${statement.label}`}
                style={statementTextarea}
              />

              {statement.statement.trim() && (
                <div style={previewBox}>
                  <div style={previewLabel}>Xem trước</div>

                  <MathContent text={statement.statement} />
                </div>
              )}

              {statement.statementImageUrl && (
                <div style={imageBox}>
                  <img
                    src={statement.statementImageUrl}
                    alt={`Hình phát biểu ${statement.label}`}
                    style={statementImage}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeStatementImage(statement.id)
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

      <div style={scoreNote}>
        <b>Gợi ý chấm điểm:</b> mỗi phát biểu có thể được tính riêng, hoặc tính
        điểm theo số lượng phát biểu đúng trong cả nhóm.
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
  maxWidth: 720,
};

const summaryRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const trueBadge: CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  fontSize: 13,
};

const falseBadge: CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  fontSize: 13,
};

const warningBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontWeight: 800,
  marginBottom: 14,
};

const statementList: CSSProperties = {
  display: "grid",
  gap: 14,
};

const statementCard: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "2px solid #e2e8f0",
  boxSizing: "border-box",
};

const statementHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const statementTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const labelBadge: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontWeight: 900,
  fontSize: 17,
  textTransform: "lowercase",
  flexShrink: 0,
};

const statementTitle: CSSProperties = {
  fontWeight: 900,
  color: "#111827",
};

const statementHint: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 3,
};

const correctToggleGroup: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const correctToggleButton: CSSProperties = {
  minWidth: 70,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid",
  fontWeight: 900,
  cursor: "pointer",
};

const statementTextarea: CSSProperties = {
  width: "100%",
  minHeight: 92,
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

const statementImage: CSSProperties = {
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

const scoreNote: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: "#eff6ff",
  color: "#1e40af",
  lineHeight: 1.6,
};