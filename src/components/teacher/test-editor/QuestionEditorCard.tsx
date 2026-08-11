"use client";

import type { CSSProperties } from "react";
import type {
  QuestionType,
  TestQuestionDraft,
  TestSection,
} from "@/types/test-question";

import {
  changeQuestionType,
  getQuestionTypeLabel,
  getSectionLabel,
} from "@/lib/test-question";

import SingleChoiceEditor from "./SingleChoiceEditor";
import TrueFalseGroupEditor from "./TrueFalseGroupEditor";
import ShortAnswerEditor from "./ShortAnswerEditor";
import QuestionMetadataEditor from "./QuestionMetadataEditor";

type Props = {
  question: TestQuestionDraft;
  questionIndex: number;
  totalQuestions: number;

  onChange: (question: TestQuestionDraft) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export default function QuestionEditorCard({
  question,
  questionIndex,
  totalQuestions,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: Props) {
  const canMoveUp = questionIndex > 0 && Boolean(onMoveUp);

  const canMoveDown =
    questionIndex < totalQuestions - 1 && Boolean(onMoveDown);

  const hasQuestionContent = question.question.trim().length > 0;

  function updateField<K extends keyof TestQuestionDraft>(
    field: K,
    value: TestQuestionDraft[K]
  ) {
    onChange({
      ...question,
      [field]: value,
    });
  }

  function handleQuestionTypeChange(value: QuestionType) {
    const changedQuestion = changeQuestionType(question, value);

    onChange(changedQuestion);
  }

  function handleSectionChange(value: TestSection) {
    updateField("section", value);
  }

  function handleScoreChange(rawValue: string) {
    if (rawValue === "") {
      updateField("score", 0);
      return;
    }

    const parsedScore = Number(rawValue);

    if (!Number.isFinite(parsedScore)) {
      return;
    }

    updateField("score", Math.max(0, parsedScore));
  }

  function renderQuestionEditor() {
    switch (question.questionType) {
      case "single_choice":
        return (
          <SingleChoiceEditor
            question={question}
            onChange={onChange}
          />
        );

      case "true_false_group":
        return (
          <TrueFalseGroupEditor
            question={question}
            onChange={onChange}
          />
        );

      case "short_answer":
        return (
          <ShortAnswerEditor
            question={question}
            onChange={onChange}
          />
        );

      default:
        return null;
    }
  }

  return (
    <section
      style={{
        ...cardStyle,
        borderColor: hasQuestionContent ? "#e5e7eb" : "#fca5a5",
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={questionNumberStyle}>
            Câu {questionIndex + 1}
          </div>

          <div style={typeLabelStyle}>
            {getQuestionTypeLabel(question.questionType)}
            {" · "}
            {getSectionLabel(question.section)}
          </div>
        </div>

        <div style={actionRowStyle}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Di chuyển câu ${questionIndex + 1} lên`}
            title="Di chuyển lên"
            style={{
              ...smallButtonStyle,
              opacity: canMoveUp ? 1 : 0.45,
              cursor: canMoveUp ? "pointer" : "not-allowed",
            }}
          >
            ↑
          </button>

          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Di chuyển câu ${questionIndex + 1} xuống`}
            title="Di chuyển xuống"
            style={{
              ...smallButtonStyle,
              opacity: canMoveDown ? 1 : 0.45,
              cursor: canMoveDown ? "pointer" : "not-allowed",
            }}
          >
            ↓
          </button>

          <button
            type="button"
            onClick={onRemove}
            style={removeButtonStyle}
          >
            Xóa câu
          </button>
        </div>
      </div>

      <div style={topGridStyle}>
        <div>
          <label
            htmlFor={`question-type-${question.id}`}
            style={labelStyle}
          >
            Loại câu hỏi
          </label>

          <select
            id={`question-type-${question.id}`}
            value={question.questionType}
            onChange={(event) =>
              handleQuestionTypeChange(
                event.target.value as QuestionType
              )
            }
            style={inputStyle}
          >
            <option value="single_choice">
              Trắc nghiệm 4 lựa chọn
            </option>

            <option value="true_false_group">
              Trắc nghiệm Đúng/Sai
            </option>

            <option value="short_answer">
              Trả lời ngắn
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor={`question-section-${question.id}`}
            style={labelStyle}
          >
            Phần thi
          </label>

          <select
            id={`question-section-${question.id}`}
            value={question.section}
            onChange={(event) =>
              handleSectionChange(
                event.target.value as TestSection
              )
            }
            style={inputStyle}
          >
            <option value="part_1">Phần I</option>
            <option value="part_2">Phần II</option>
            <option value="part_3">Phần III</option>
          </select>
        </div>

        <div>
          <label
            htmlFor={`question-score-${question.id}`}
            style={labelStyle}
          >
            Điểm câu hỏi
          </label>

          <input
            id={`question-score-${question.id}`}
            type="number"
            min={0}
            step={0.01}
            value={question.score}
            onChange={(event) =>
              handleScoreChange(event.target.value)
            }
            style={inputStyle}
          />

          {question.score <= 0 && (
            <div style={errorTextStyle}>
              Điểm câu hỏi phải lớn hơn 0.
            </div>
          )}
        </div>
      </div>

      <div style={questionContentBox}>
        <label
          htmlFor={`question-content-${question.id}`}
          style={labelStyle}
        >
          Nội dung câu hỏi
        </label>

        <textarea
          id={`question-content-${question.id}`}
          value={question.question}
          onChange={(event) =>
            updateField("question", event.target.value)
          }
          placeholder="Nhập nội dung câu hỏi"
          style={{
            ...questionTextareaStyle,
            borderColor: hasQuestionContent
              ? "#cbd5e1"
              : "#ef4444",
          }}
        />

        {!hasQuestionContent && (
          <div style={errorTextStyle}>
            Nội dung câu hỏi không được để trống.
          </div>
        )}

        {question.questionImageUrl && (
          <img
            src={question.questionImageUrl}
            alt={`Hình minh họa câu ${questionIndex + 1}`}
            style={questionImageStyle}
          />
        )}
      </div>

      {renderQuestionEditor()}

      <QuestionMetadataEditor
        question={question}
        onChange={onChange}
      />
    </section>
  );
}

const cardStyle: CSSProperties = {
  background: "white",
  borderRadius: 20,
  padding: 20,
  border: "1px solid #e5e7eb",
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 18,
};

const questionNumberStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
};

const typeLabelStyle: CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const smallButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "none",
  background: "#e2e8f0",
  color: "#334155",
  fontWeight: 900,
};

const removeButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  cursor: "pointer",
};

const topGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginBottom: 18,
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

const questionContentBox: CSSProperties = {
  marginBottom: 18,
};

const questionTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 120,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  resize: "vertical",
  fontSize: 16,
  lineHeight: 1.6,
  boxSizing: "border-box",
};

const questionImageStyle: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 320,
  objectFit: "contain",
  marginTop: 12,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
};

const errorTextStyle: CSSProperties = {
  marginTop: 6,
  color: "#dc2626",
  fontSize: 13,
  fontWeight: 700,
};