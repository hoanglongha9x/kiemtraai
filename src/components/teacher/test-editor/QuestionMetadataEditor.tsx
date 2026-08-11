"use client";

import type { CSSProperties } from "react";

import type {
  CognitiveLevel,
  Difficulty,
  TestQuestionDraft,
} from "@/types/test-question";

type Props = {
  question: TestQuestionDraft;
  onChange: (question: TestQuestionDraft) => void;
};

export default function QuestionMetadataEditor({
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

  function updateTags(value: string) {
    const tags = Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

    updateField("tags", tags);
  }

  const tagsText = question.tags.join(", ");

  return (
    <section style={sectionStyle}>
      <div style={sectionHeader}>
        <div>
          <h3 style={sectionTitle}>Thông tin năng lực</h3>

          <p style={sectionDescription}>
            Metadata này được dùng để phân tích chủ đề, kỹ năng, mức độ nhận
            thức và đề xuất ôn tập cho học sinh.
          </p>
        </div>

        <span
          style={{
            ...statusBadge,
            background:
              question.topic.trim() &&
              question.skill.trim() &&
              question.learningOutcome.trim()
                ? "#dcfce7"
                : "#fef3c7",
            color:
              question.topic.trim() &&
              question.skill.trim() &&
              question.learningOutcome.trim()
                ? "#166534"
                : "#92400e",
          }}
        >
          {question.topic.trim() &&
          question.skill.trim() &&
          question.learningOutcome.trim()
            ? "Metadata đầy đủ"
            : "Cần bổ sung"}
        </span>
      </div>

      <div style={gridStyle}>
        <div style={fieldBox}>
          <label style={labelStyle}>Chủ đề lớn</label>

          <input
            value={question.topic}
            onChange={(event) =>
              updateField("topic", event.target.value)
            }
            placeholder="Ví dụ: Cấu trúc điều khiển"
            style={inputStyle}
          />

          <p style={fieldHint}>
            Nhóm nội dung lớn dùng để tổng hợp kết quả theo chủ đề.
          </p>
        </div>

        <div style={fieldBox}>
          <label style={labelStyle}>Đơn vị kiến thức</label>

          <input
            value={question.knowledgeUnit}
            onChange={(event) =>
              updateField("knowledgeUnit", event.target.value)
            }
            placeholder="Ví dụ: Câu lệnh điều kiện if"
            style={inputStyle}
          />

          <p style={fieldHint}>
            Nội dung kiến thức nhỏ và cụ thể đang được đánh giá.
          </p>
        </div>

        <div style={fieldBox}>
          <label style={labelStyle}>Kỹ năng</label>

          <input
            value={question.skill}
            onChange={(event) =>
              updateField("skill", event.target.value)
            }
            placeholder="Ví dụ: Phân tích điều kiện"
            style={inputStyle}
          />

          <p style={fieldHint}>
            Hành động hoặc năng lực học sinh cần thể hiện khi làm câu hỏi.
          </p>
        </div>

        <div style={fieldBox}>
          <label style={labelStyle}>Yêu cầu cần đạt</label>

          <input
            value={question.learningOutcome}
            onChange={(event) =>
              updateField("learningOutcome", event.target.value)
            }
            placeholder="Ví dụ: Xác định được nhánh lệnh được thực hiện"
            style={inputStyle}
          />

          <p style={fieldHint}>
            Mục tiêu học tập cụ thể dùng cho phân tích kết quả.
          </p>
        </div>

        <div style={fieldBox}>
          <label style={labelStyle}>Mức độ nhận thức</label>

          <select
            value={question.cognitiveLevel}
            onChange={(event) =>
              updateField(
                "cognitiveLevel",
                event.target.value as CognitiveLevel
              )
            }
            style={inputStyle}
          >
            <option value="recognition">Nhận biết</option>
            <option value="understanding">Thông hiểu</option>
            <option value="application">Vận dụng</option>
            <option value="high_application">Vận dụng cao</option>
          </select>

          <p style={fieldHint}>
            Dùng để xác định mức tư duy mà câu hỏi yêu cầu.
          </p>
        </div>

        <div style={fieldBox}>
          <label style={labelStyle}>Độ khó</label>

          <select
            value={question.difficulty}
            onChange={(event) =>
              updateField(
                "difficulty",
                event.target.value as Difficulty
              )
            }
            style={inputStyle}
          >
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>

          <p style={fieldHint}>
            Độ khó do giáo viên dự kiến trước khi có dữ liệu thực tế.
          </p>
        </div>
      </div>

      <div style={fullWidthField}>
        <label style={labelStyle}>Từ khóa</label>

        <input
          value={tagsText}
          onChange={(event) => updateTags(event.target.value)}
          placeholder="Ví dụ: if, điều kiện, python"
          style={inputStyle}
        />

        <p style={fieldHint}>
          Nhập nhiều từ khóa, ngăn cách bằng dấu phẩy.
        </p>

        {question.tags.length > 0 && (
          <div style={tagList}>
            {question.tags.map((tag) => (
              <span key={tag} style={tagBadge}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={fullWidthField}>
        <label style={labelStyle}>Giải thích đáp án</label>

        <textarea
          value={question.explanation}
          onChange={(event) =>
            updateField("explanation", event.target.value)
          }
          placeholder="Giải thích vì sao đáp án đúng và các lỗi học sinh thường mắc"
          style={textareaStyle}
        />

        <p style={fieldHint}>
          Nội dung này có thể dùng ở trang chữa bài và phần đề xuất ôn tập.
        </p>
      </div>

      <div style={summaryBox}>
        <div style={summaryTitle}>Tóm tắt metadata</div>

        <div style={summaryGrid}>
          <SummaryItem
            label="Chủ đề"
            value={question.topic || "Chưa phân loại"}
          />

          <SummaryItem
            label="Đơn vị kiến thức"
            value={question.knowledgeUnit || "Chưa phân loại"}
          />

          <SummaryItem
            label="Kỹ năng"
            value={question.skill || "Chưa phân loại"}
          />

          <SummaryItem
            label="Yêu cầu cần đạt"
            value={question.learningOutcome || "Chưa xác định"}
          />

          <SummaryItem
            label="Mức nhận thức"
            value={getCognitiveLevelLabel(question.cognitiveLevel)}
          />

          <SummaryItem
            label="Độ khó"
            value={getDifficultyLabel(question.difficulty)}
          />
        </div>
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={summaryItem}>
      <span style={summaryLabel}>{label}</span>
      <b style={summaryValue}>{value}</b>
    </div>
  );
}

function getCognitiveLevelLabel(value: CognitiveLevel): string {
  if (value === "recognition") return "Nhận biết";
  if (value === "application") return "Vận dụng";
  if (value === "high_application") return "Vận dụng cao";

  return "Thông hiểu";
}

function getDifficultyLabel(value: Difficulty): string {
  if (value === "easy") return "Dễ";
  if (value === "hard") return "Khó";

  return "Trung bình";
}

const sectionStyle: CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  marginTop: 18,
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
  maxWidth: 760,
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

const fullWidthField: CSSProperties = {
  marginTop: 14,
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

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  fontSize: 15,
  lineHeight: 1.6,
  resize: "vertical",
  boxSizing: "border-box",
};

const fieldHint: CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
};

const tagList: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const tagBadge: CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#3730a3",
  fontWeight: 800,
  fontSize: 13,
};

const summaryBox: CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
};

const summaryTitle: CSSProperties = {
  color: "#1e40af",
  fontWeight: 900,
  marginBottom: 12,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const summaryItem: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  padding: 12,
  borderRadius: 12,
  background: "white",
  border: "1px solid #dbeafe",
  minWidth: 0,
};

const summaryLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
};

const summaryValue: CSSProperties = {
  color: "#111827",
  overflowWrap: "anywhere",
};