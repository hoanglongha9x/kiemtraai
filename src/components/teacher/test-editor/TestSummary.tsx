import type { CSSProperties } from "react";

type Props = {
  totalQuestions: number;
  totalScore: number;
};

export default function TestSummary({
  totalQuestions,
  totalScore,
}: Props) {
  return (
    <section style={headerCardStyle}>
      <div>
        <div style={eyebrowStyle}>
          KIEMTRA.AI
        </div>

        <h1 style={titleStyle}>
          Trình biên soạn đề kiểm tra
        </h1>

        <p style={descriptionStyle}>
          Xây dựng đề gồm trắc nghiệm,
          Đúng/Sai và trả lời ngắn.
        </p>
      </div>

      <div style={summaryStyle}>
        <div style={summaryItemStyle}>
          <span style={summaryValueStyle}>
            {totalQuestions}
          </span>

          <span style={summaryLabelStyle}>
            Câu hỏi
          </span>
        </div>

        <div style={summaryDividerStyle} />

        <div style={summaryItemStyle}>
          <span style={summaryValueStyle}>
            {totalScore.toFixed(2)}
          </span>

          <span style={summaryLabelStyle}>
            Tổng điểm
          </span>
        </div>
      </div>
    </section>
  );
}

const headerCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 24,
  padding: 24,
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  boxShadow:
    "0 10px 28px rgba(15,23,42,.06)",
};

const eyebrowStyle: CSSProperties = {
  marginBottom: 6,
  color: "#2563eb",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 28,
  lineHeight: 1.2,
};

const descriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  lineHeight: 1.6,
};

const summaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 20,
  padding: "14px 18px",
  background: "#f8fafc",
  borderRadius: 16,
};

const summaryItemStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  textAlign: "center",
};

const summaryValueStyle: CSSProperties = {
  color: "#111827",
  fontSize: 22,
  fontWeight: 900,
};

const summaryLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const summaryDividerStyle: CSSProperties = {
  width: 1,
  height: 36,
  background: "#cbd5e1",
};