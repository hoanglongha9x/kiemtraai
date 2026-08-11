"use client";

import type { CSSProperties } from "react";
import MathContent from "@/components/common/MathContent";
import type { TestQuestionDraft } from "@/types/test-question";

type Props = {
  question: TestQuestionDraft;
  onChange: (question: TestQuestionDraft) => void;
};

export default function ShortAnswerEditor({
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

  function updateAcceptedAnswers(value: string) {
    const acceptedAnswers = Array.from(
      new Set(
        value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

    updateField("acceptedAnswers", acceptedAnswers);
  }

  const acceptedAnswersText = question.acceptedAnswers.join("\n");

  const hasNumericExpectedAnswer =
    question.expectedAnswer.trim() !== "" &&
    Number.isFinite(Number(question.expectedAnswer));

  return (
    <section style={sectionStyle}>
      <div style={sectionHeader}>
        <div>
          <h3 style={sectionTitle}>Đáp án trả lời ngắn</h3>

          <p style={sectionDescription}>
            Nhập đáp án chuẩn, các cách trả lời được chấp nhận và sai số nếu
            đáp án là số.
          </p>
        </div>

        <span
          style={{
            ...statusBadge,
            background:
              question.expectedAnswer.trim() ||
              question.acceptedAnswers.length > 0
                ? "#dcfce7"
                : "#fee2e2",
            color:
              question.expectedAnswer.trim() ||
              question.acceptedAnswers.length > 0
                ? "#166534"
                : "#991b1b",
          }}
        >
          {question.expectedAnswer.trim() ||
          question.acceptedAnswers.length > 0
            ? "Đã có đáp án"
            : "Chưa có đáp án"}
        </span>
      </div>

      <div style={gridStyle}>
        <div style={fieldBox}>
          <label style={labelStyle}>Đáp án chuẩn</label>

          <input
            value={question.expectedAnswer}
            onChange={(event) =>
              updateField("expectedAnswer", event.target.value)
            }
            placeholder="Ví dụ: 12 hoặc Nguyễn Trãi"
            style={inputStyle}
          />

          <p style={fieldHint}>
            Đây là đáp án chính dùng khi chấm bài.
          </p>
        </div>

        <div style={fieldBox}>
          <label style={labelStyle}>Sai số cho phép</label>

          <input
            type="number"
            min={0}
            step={0.0001}
            value={question.answerTolerance}
            onChange={(event) =>
              updateField(
                "answerTolerance",
                Math.max(0, Number(event.target.value || 0))
              )
            }
            disabled={!hasNumericExpectedAnswer}
            style={{
              ...inputStyle,
              background: hasNumericExpectedAnswer ? "white" : "#f1f5f9",
              cursor: hasNumericExpectedAnswer ? "text" : "not-allowed",
            }}
          />

          <p style={fieldHint}>
            Chỉ áp dụng khi đáp án chuẩn là số. Ví dụ đáp án 10, sai số 0.1 sẽ
            chấp nhận từ 9.9 đến 10.1.
          </p>
        </div>
      </div>

      <div style={acceptedAnswersBox}>
        <label style={labelStyle}>
          Các đáp án khác được chấp nhận
        </label>

        <textarea
          value={acceptedAnswersText}
          onChange={(event) =>
            updateAcceptedAnswers(event.target.value)
          }
          placeholder={`Mỗi đáp án trên một dòng.\nVí dụ:\n12\n12.0\n12,0`}
          style={acceptedAnswersTextarea}
        />

        <p style={fieldHint}>
          Mỗi dòng là một cách viết hợp lệ. Không cần nhập lại đáp án chuẩn.
        </p>
      </div>

      {(question.expectedAnswer.trim() ||
        question.acceptedAnswers.length > 0) && (
        <div style={previewBox}>
          <div style={previewHeader}>
            <div>
              <div style={previewTitle}>Xem trước đáp án</div>

              <div style={previewDescription}>
                Danh sách đáp án mà hệ thống có thể chấp nhận.
              </div>
            </div>

            <span style={answerCountBadge}>
              {Array.from(
                new Set(
                  [
                    question.expectedAnswer.trim(),
                    ...question.acceptedAnswers,
                  ].filter(Boolean)
                )
              ).length}{" "}
              đáp án
            </span>
          </div>

          {question.expectedAnswer.trim() && (
            <div style={mainAnswerBox}>
              <div style={answerLabel}>Đáp án chuẩn</div>

              <div style={answerPreviewContent}>
                <MathContent text={question.expectedAnswer} />
              </div>
            </div>
          )}

          {question.acceptedAnswers.length > 0 && (
            <div style={acceptedAnswerList}>
              {question.acceptedAnswers.map((answer, index) => (
                <div
                  key={`${answer}-${index}`}
                  style={acceptedAnswerItem}
                >
                  <span style={acceptedAnswerIndex}>
                    {index + 1}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <MathContent text={answer} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasNumericExpectedAnswer && (
            <div style={toleranceInfo}>
              Sai số cho phép:{" "}
              <b>{Number(question.answerTolerance || 0)}</b>
            </div>
          )}
        </div>
      )}

      <div style={normalizationNote}>
        <b>Quy tắc chấm đề xuất:</b> bỏ khoảng trắng thừa, không phân biệt chữ
        hoa/chữ thường và chuẩn hóa dấu phẩy, dấu chấm với đáp án số trước khi
        so sánh.
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

const statusBadge: CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const fieldBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "white",
  border: "1px solid #e2e8f0",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontWeight: 900,
  color: "#334155",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  fontSize: 15,
  boxSizing: "border-box",
};

const fieldHint: CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
};

const acceptedAnswersBox: CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  background: "white",
  border: "1px solid #e2e8f0",
};

const acceptedAnswersTextarea: CSSProperties = {
  width: "100%",
  minHeight: 130,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  resize: "vertical",
  fontSize: 15,
  lineHeight: 1.6,
  boxSizing: "border-box",
};

const previewBox: CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  background: "white",
  border: "1px dashed #93c5fd",
};

const previewHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const previewTitle: CSSProperties = {
  fontWeight: 900,
  color: "#111827",
};

const previewDescription: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 3,
};

const answerCountBadge: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#1e40af",
  fontWeight: 900,
  fontSize: 13,
};

const mainAnswerBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  marginBottom: 12,
};

const answerLabel: CSSProperties = {
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  marginBottom: 7,
};

const answerPreviewContent: CSSProperties = {
  color: "#111827",
  fontWeight: 800,
  overflowWrap: "anywhere",
};

const acceptedAnswerList: CSSProperties = {
  display: "grid",
  gap: 8,
};

const acceptedAnswerItem: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: 10,
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  overflowWrap: "anywhere",
};

const acceptedAnswerIndex: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 8,
  background: "#e2e8f0",
  color: "#334155",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 12,
  flexShrink: 0,
};

const toleranceInfo: CSSProperties = {
  marginTop: 12,
  padding: 10,
  borderRadius: 12,
  background: "#eff6ff",
  color: "#1e40af",
};

const normalizationNote: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: "#fff7ed",
  color: "#9a3412",
  lineHeight: 1.6,
};