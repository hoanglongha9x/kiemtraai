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
  validateTestDraft,
} from "@/lib/test-draft";

import {
  calculateTotalQuestionScore,
  createQuestionDraft,
} from "@/lib/test-question";

import { useTestDraft } from "@/hooks/use-test-draft";

import QuestionEditorCard from "./QuestionEditorCard";
import QuestionToolbar from "./QuestionToolbar";
import SaveStatusIndicator from "./SaveStatusIndicator";
import TestInformationPanel from "./TestInformationPanel";
import TestSummary from "./TestSummary";
import ValidationPanel from "./ValidationPanel";

export default function TestEditor() {
  const {
    draft,
    isHydrated,
    isDirty,
    saveStatus,
    lastSavedAt,
    updateDraft,
    saveDraftNow,
    resetDraft,
  } = useTestDraft();

  const [showValidation, setShowValidation] =
    useState(false);

  const questions = draft?.questions ?? [];

  const totalScore = useMemo(
    () => calculateTotalQuestionScore(questions),
    [questions]
  );

  const validationResult = useMemo(
    () =>
      draft
        ? validateTestDraft(draft)
        : {
            valid: false,
            errors: [],
          },
    [draft]
  );

  const validationErrors =
    validationResult.errors;

  function addQuestion(
    questionType: QuestionType
  ) {
    updateDraft((currentDraft) => ({
      ...currentDraft,

      questions: [
        ...currentDraft.questions,
        createQuestionDraft(questionType),
      ],
    }));
  }

  function updateQuestion(
    questionIndex: number,
    updatedQuestion: TestQuestionDraft
  ) {
    updateDraft((currentDraft) => ({
      ...currentDraft,

      questions:
        currentDraft.questions.map(
          (question, index) =>
            index === questionIndex
              ? updatedQuestion
              : question
        ),
    }));
  }

  function removeQuestion(
    questionIndex: number
  ) {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa câu ${
        questionIndex + 1
      } không?`
    );

    if (!confirmed) {
      return;
    }

    updateDraft((currentDraft) => {
      const nextQuestions =
        currentDraft.questions.filter(
          (_, index) =>
            index !== questionIndex
        );

      return {
        ...currentDraft,

        questions:
          nextQuestions.length > 0
            ? nextQuestions
            : [
                createQuestionDraft(
                  "single_choice"
                ),
              ],
      };
    });
  }

  function moveQuestion(
    fromIndex: number,
    toIndex: number
  ) {
    if (
      !draft ||
      fromIndex === toIndex ||
      toIndex < 0 ||
      toIndex >= draft.questions.length
    ) {
      return;
    }

    updateDraft((currentDraft) => {
      const nextQuestions = [
        ...currentDraft.questions,
      ];

      const [movedQuestion] =
        nextQuestions.splice(fromIndex, 1);

      if (!movedQuestion) {
        return currentDraft;
      }

      nextQuestions.splice(
        toIndex,
        0,
        movedQuestion
      );

      return {
        ...currentDraft,
        questions: nextQuestions,
      };
    });
  }

  function handleValidate() {
    setShowValidation(true);

    if (validationResult.valid) {
      window.alert(
        "Đề kiểm tra hiện không có lỗi."
      );
    }
  }

  function handleSaveDraft() {
    const saved = saveDraftNow();

    if (!saved) {
      window.alert(
        "Không thể lưu bản nháp. Vui lòng thử lại."
      );
    }
  }

  if (!isHydrated || !draft) {
    return (
      <main style={pageStyle}>
        <section style={loadingCardStyle}>
          Đang khởi tạo trình biên soạn đề...
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <TestSummary
        totalQuestions={questions.length}
        totalScore={totalScore}
      />

      <section style={saveToolbarStyle}>
        <SaveStatusIndicator
          status={saveStatus}
          isDirty={isDirty}
          lastSavedAt={lastSavedAt}
        />

        <div style={saveActionGroupStyle}>
          <button
            type="button"
            onClick={resetDraft}
            style={secondaryButtonStyle}
          >
            Tạo đề mới
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            style={saveButtonStyle}
          >
            Lưu bản nháp
          </button>
        </div>
      </section>

      <TestInformationPanel
        draft={draft}
        onChange={updateDraft}
      />

      <QuestionToolbar
        onAddQuestion={addQuestion}
      />

      <ValidationPanel
        errors={validationErrors}
        visible={showValidation}
      />

      <section style={questionListStyle}>
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
      </section>

      <section style={footerActionsStyle}>
        <button
          type="button"
          onClick={() =>
            addQuestion("single_choice")
          }
          style={secondaryButtonStyle}
        >
          + Thêm câu
        </button>

        <button
          type="button"
          onClick={handleValidate}
          style={validateButtonStyle}
        >
          Kiểm tra đề
        </button>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  display: "grid",
  gap: 20,
};

const saveToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  padding: "14px 18px",
  borderRadius: 16,
  background: "white",
  border: "1px solid #e5e7eb",
};

const saveActionGroupStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const saveButtonStyle: CSSProperties = {
  padding: "11px 16px",
  border: "none",
  borderRadius: 11,
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

const validateButtonStyle: CSSProperties = {
  padding: "12px 18px",
  border: "none",
  borderRadius: 12,
  background: "#047857",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const questionListStyle: CSSProperties = {
  display: "grid",
  gap: 20,
};

const footerActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  paddingBottom: 24,
};

const loadingCardStyle: CSSProperties = {
  padding: 24,
  borderRadius: 20,
  background: "white",
  border: "1px solid #e5e7eb",
  color: "#64748b",
  fontWeight: 700,
  textAlign: "center",
};