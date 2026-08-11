import type { CSSProperties } from "react";

import type {
  QuestionType,
} from "@/types/test-question";

type Props = {
  onAddQuestion: (
    questionType: QuestionType
  ) => void;

  onOpenAi?: () => void;
  onOpenQuestionBank?: () => void;
  onImportFile?: () => void;
};

export default function QuestionToolbar({
  onAddQuestion,
  onOpenAi,
  onOpenQuestionBank,
  onImportFile,
}: Props) {
  return (
    <section style={cardStyle}>
      <div>
        <div style={titleStyle}>
          Thêm câu hỏi
        </div>

        <div style={descriptionStyle}>
          Chọn loại câu hỏi hoặc thêm từ nguồn khác.
        </div>
      </div>

      <div style={buttonGroupStyle}>
        <button
          type="button"
          onClick={() =>
            onAddQuestion("single_choice")
          }
          style={primaryButtonStyle}
        >
          + Trắc nghiệm
        </button>

        <button
          type="button"
          onClick={() =>
            onAddQuestion(
              "true_false_group"
            )
          }
          style={secondaryButtonStyle}
        >
          + Đúng/Sai
        </button>

        <button
          type="button"
          onClick={() =>
            onAddQuestion("short_answer")
          }
          style={secondaryButtonStyle}
        >
          + Trả lời ngắn
        </button>

        <button
          type="button"
          onClick={onOpenAi}
          disabled={!onOpenAi}
          style={{
            ...sourceButtonStyle,
            opacity: onOpenAi ? 1 : 0.5,
            cursor: onOpenAi
              ? "pointer"
              : "not-allowed",
          }}
        >
          Tạo bằng AI
        </button>

        <button
          type="button"
          onClick={onOpenQuestionBank}
          disabled={!onOpenQuestionBank}
          style={{
            ...sourceButtonStyle,
            opacity: onOpenQuestionBank
              ? 1
              : 0.5,
            cursor: onOpenQuestionBank
              ? "pointer"
              : "not-allowed",
          }}
        >
          Chọn từ ngân hàng
        </button>

        <button
          type="button"
          onClick={onImportFile}
          disabled={!onImportFile}
          style={{
            ...sourceButtonStyle,
            opacity: onImportFile ? 1 : 0.5,
            cursor: onImportFile
              ? "pointer"
              : "not-allowed",
          }}
        >
          Nhập từ tệp
        </button>
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
  padding: 20,
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
};

const titleStyle: CSSProperties = {
  color: "#111827",
  fontSize: 17,
  fontWeight: 900,
};

const descriptionStyle: CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 14,
};

const buttonGroupStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const primaryButtonStyle: CSSProperties = {
  padding: "12px 16px",
  border: "none",
  borderRadius: 12,
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "12px 16px",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "white",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
};

const sourceButtonStyle: CSSProperties = {
  padding: "12px 16px",
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 900,
};