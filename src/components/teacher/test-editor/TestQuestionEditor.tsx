"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import type {
  QuestionType,
  TestQuestionDraft,
} from "@/types/test-question";

import {
  calculateTotalQuestionScore,
  createQuestionDraft,
  validateQuestionList,
} from "@/lib/test-question";

import QuestionEditorCard from "./QuestionEditorCard";

type Props = {
  initialQuestions?: TestQuestionDraft[];
  enforceStandardSections?: boolean;

  onQuestionsChange?: (
    questions: TestQuestionDraft[]
  ) => void;
};

export default function TestQuestionEditor({
  initialQuestions = [],
  enforceStandardSections = true,
  onQuestionsChange,
}: Props) {
  const [questions, setQuestions] =
    useState<TestQuestionDraft[]>(
      initialQuestions.length > 0
        ? initialQuestions
        : [createQuestionDraft()]
    );

  const [showValidation, setShowValidation] =
    useState(false);

  const totalScore = useMemo(
    () => calculateTotalQuestionScore(questions),
    [questions]
  );

  const validationErrors = useMemo(
    () =>
      validateQuestionList(
        questions,
        enforceStandardSections
      ),
    [questions, enforceStandardSections]
  );

  function commitQuestions(
    nextQuestions: TestQuestionDraft[]
  ) {
    setQuestions(nextQuestions);
    onQuestionsChange?.(nextQuestions);
  }

  function addQuestion(
    questionType: QuestionType
  ) {
    commitQuestions([
      ...questions,
      createQuestionDraft(questionType),
    ]);
  }

  function updateQuestion(
    index: number,
    updatedQuestion: TestQuestionDraft
  ) {
    const nextQuestions = questions.map(
      (question, questionIndex) =>
        questionIndex === index
          ? updatedQuestion
          : question
    );

    commitQuestions(nextQuestions);
  }

  function removeQuestion(index: number) {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa câu ${index + 1} không?`
    );

    if (!confirmed) {
      return;
    }

    const nextQuestions = questions.filter(
      (_, questionIndex) =>
        questionIndex !== index
    );

    commitQuestions(
      nextQuestions.length > 0
        ? nextQuestions
        : [createQuestionDraft()]
    );
  }

  function moveQuestion(
    fromIndex: number,
    toIndex: number
  ) {
    if (
      toIndex < 0 ||
      toIndex >= questions.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const nextQuestions = [...questions];

    const [movedQuestion] = nextQuestions.splice(
      fromIndex,
      1
    );

    nextQuestions.splice(
      toIndex,
      0,
      movedQuestion
    );

    commitQuestions(nextQuestions);
  }

  function validateQuestions() {
    setShowValidation(true);

    if (validationErrors.length === 0) {
      window.alert(
        "Danh sách câu hỏi hợp lệ."
      );
    }
  }

  return (
    <div style={containerStyle}>
      <div style={summaryCardStyle}>
        <div>
          <div style={summaryTitleStyle}>
            Nội dung đề kiểm tra
          </div>

          <div style={summaryTextStyle}>
            {questions.length} câu hỏi · Tổng{" "}
            {totalScore.toFixed(2)} điểm
          </div>
        </div>

        <button
          type="button"
          onClick={validateQuestions}
          style={validateButtonStyle}
        >
          Kiểm tra đề
        </button>
      </div>

      <div style={toolbarStyle}>
        <button
          type="button"
          onClick={() =>
            addQuestion("single_choice")
          }
          style={primaryButtonStyle}
        >
          + Trắc nghiệm
        </button>

        <button
          type="button"
          onClick={() =>
            addQuestion("true_false_group")
          }
          style={secondaryButtonStyle}
        >
          + Đúng/Sai
        </button>

        <button
          type="button"
          onClick={() =>
            addQuestion("short_answer")
          }
          style={secondaryButtonStyle}
        >
          + Trả lời ngắn
        </button>
      </div>

      {showValidation &&
        validationErrors.length > 0 && (
          <div style={validationBoxStyle}>
            <div style={validationTitleStyle}>
              Đề kiểm tra còn{" "}
              {validationErrors.length} lỗi
            </div>

            <ul style={validationListStyle}>
              {validationErrors.map(
                (error, index) => (
                  <li
                    key={`${error}-${index}`}
                    style={validationItemStyle}
                  >
                    {error}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

      <div style={questionListStyle}>
        {questions.map(
          (question, questionIndex) => (
            <QuestionEditorCard
              key={question.id}
              question={question}
              questionIndex={questionIndex}
              totalQuestions={questions.length}
              onChange={(updatedQuestion) =>
                updateQuestion(
                  questionIndex,
                  updatedQuestion
                )
              }
              onRemove={() =>
                removeQuestion(questionIndex)
              }
              onMoveUp={() =>
                moveQuestion(
                  questionIndex,
                  questionIndex - 1
                )
              }
              onMoveDown={() =>
                moveQuestion(
                  questionIndex,
                  questionIndex + 1
                )
              }
            />
          )
        )}
      </div>

      <div style={bottomToolbarStyle}>
        <button
          type="button"
          onClick={() =>
            addQuestion("single_choice")
          }
          style={primaryButtonStyle}
        >
          + Thêm câu hỏi
        </button>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "grid",
  gap: 20,
};

const summaryCardStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  padding: 20,
  borderRadius: 20,
  background: "white",
  border: "1px solid #e5e7eb",
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const summaryTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
};

const summaryTextStyle: CSSProperties = {
  marginTop: 5,
  color: "#64748b",
  fontWeight: 700,
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
};

const validateButtonStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "#ecfdf5",
  color: "#047857",
  fontWeight: 900,
  cursor: "pointer",
};

const validationBoxStyle: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff7f7",
};

const validationTitleStyle: CSSProperties = {
  color: "#991b1b",
  fontWeight: 900,
  marginBottom: 10,
};

const validationListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 22,
};

const validationItemStyle: CSSProperties = {
  marginBottom: 6,
  color: "#b91c1c",
  fontWeight: 700,
};

const questionListStyle: CSSProperties = {
  display: "grid",
  gap: 20,
};

const bottomToolbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  paddingBottom: 20,
};