"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";
import AnimatedLoginScene from "@/components/auth/AnimatedLoginScene";
import ExamImage from "@/components/exam/ExamImage";

import MathContent from "@/components/common/MathContent";
import QuestionContentBlocks from "@/components/question-content/QuestionContentBlocks";
import type {
  ExamAnswerKey,
  ExamAnswers,
  ExamAssignmentInfo,
  ExamAttempt,
  ExamQuestion,
  ExamShortAnswerQuestion,
  ExamSingleChoiceQuestion,
  ExamStudentAnswer,
  ExamStudentInfo,
  ExamSuspiciousEvent,
  ExamTrueFalseAnswer,
  ExamTrueFalseQuestion,
  StartExamResponse,
} from "@/features/exam/types";
import { postJSON } from "@/lib/api/client";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type QuestionProgressStatus =
  | "unanswered"
  | "partial"
  | "answered";

type ExamSectionGroup = {
  id: string;
  title: string;
  questions: Array<{
    question: ExamQuestion;
    globalIndex: number;
  }>;
};

type AssignmentInfoResponse = {
  status: "success";
  assignment: ExamAssignmentInfo;
};

type ProgressResponse = {
  status: "success";
  savedAt: string;
  message: string;
};

type SubmitExamResponse = {
  status: "success";
  resultId: string;
  alreadySubmitted?: boolean;
  summary?: SubmitSummary | null;
  answerReview?: SubmitAnswerReviewItem[];
  message: string;
};

type SubmitSummary = {
  score: number;
  totalScore: number;
  percentage: number;
  totalQuestions: number;
  answeredQuestionCount: number;
  correctQuestionCount: number;
  answeredStatementCount: number;
  correctStatementCount: number;
  totalStatementCount: number;
};

type SubmitAnswerReviewItem = {
  questionId: string;
  questionNumber: number;
  sectionTitle: string;
  type: "single_choice" | "true_false_group" | "short_answer";
  isCorrect: boolean;
  score: number;
  maxScore: number;
  studentAnswer?: unknown;
  correctAnswer?: unknown;
  acceptedAnswers?: string[];
};

type DisplayOption = {
  displayKey: ExamAnswerKey;
  originalKey: ExamAnswerKey;
  content: string;
  imageUrl?: string;
};

type DisplayOptionMap = Record<string, DisplayOption[]>;

type LatestState = {
  answers: ExamAnswers;
  bookmarkedQuestionIds: string[];
  currentQuestionIndex: number;
  visibilityLostCount: number;
  focusLostCount: number;
  suspiciousEvents: ExamSuspiciousEvent[];
};

const ANSWER_KEYS: ExamAnswerKey[] = ["A", "B", "C", "D"];

function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeAnswerKey(value: unknown): ExamAnswerKey | "" {
  const answer = safeText(value).toUpperCase();

  if (answer === "A" || answer === "B" || answer === "C" || answer === "D") {
    return answer;
  }

  return "";
}

function buildDisplayOptionMap(
  questions: ExamQuestion[],
  optionOrders: Record<string, ExamAnswerKey[]>
): DisplayOptionMap {
  const result: DisplayOptionMap = {};

  questions.forEach((question) => {
    if (question.type !== "single_choice") return;

    const optionMap = new Map(
      question.options.map((option) => [option.id, option])
    );

    const availableKeys = question.options
      .map((option) => normalizeAnswerKey(option.id))
      .filter((key): key is ExamAnswerKey => Boolean(key));

    const savedOrder = Array.isArray(optionOrders[question.id])
      ? optionOrders[question.id]
          .map((key) => normalizeAnswerKey(key))
          .filter((key): key is ExamAnswerKey => Boolean(key))
      : [];

    const uniqueSavedOrder = Array.from(
      new Set(savedOrder.filter((key) => availableKeys.includes(key)))
    );

    const completeOrder: ExamAnswerKey[] = [
      ...uniqueSavedOrder,
      ...availableKeys.filter((key) => !uniqueSavedOrder.includes(key)),
    ];

    result[question.id] = completeOrder.map((originalKey, index) => {
      const option = optionMap.get(originalKey);

      return {
        displayKey: ANSWER_KEYS[index] ?? originalKey,
        originalKey,
        content: safeText(option?.content),
        imageUrl: safeText(option?.imageUrl) || undefined,
      };
    });
  });

  return result;
}

function getClassDisplayName(assignment: ExamAssignmentInfo): string {
  if (assignment.classNames.length > 0) {
    return assignment.classNames.join(", ");
  }

  return "--";
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(remainSeconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(
    2,
    "0"
  )}`;
}

function getSaveStatusText(status: SaveStatus): string {
  if (status === "saving") return "Đang lưu...";
  if (status === "saved") return "Đã lưu";
  if (status === "error") return "Lỗi lưu bài";
  return "Chưa có thay đổi";
}

function getSingleChoiceAnswer(
  answer: ExamStudentAnswer | undefined
): ExamAnswerKey | "" {
  return typeof answer === "string" && ANSWER_KEYS.includes(answer as ExamAnswerKey)
    ? (answer as ExamAnswerKey)
    : "";
}

function getShortAnswer(answer: ExamStudentAnswer | undefined): string {
  if (typeof answer !== "string") return "";
  if (ANSWER_KEYS.includes(answer as ExamAnswerKey)) return "";
  return answer;
}

function getTrueFalseAnswer(
  answer: ExamStudentAnswer | undefined
): ExamTrueFalseAnswer {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
    return {};
  }

  return answer;
}

function isQuestionAnswered(
  question: ExamQuestion,
  answer: ExamStudentAnswer | undefined
): boolean {
  if (question.type === "single_choice") {
    return Boolean(getSingleChoiceAnswer(answer));
  }

  if (question.type === "short_answer") {
    return Boolean(getShortAnswer(answer).trim());
  }

  const trueFalseAnswer = getTrueFalseAnswer(answer);

  return question.statements.every(
    (statement) => typeof trueFalseAnswer[statement.id] === "boolean"
  );
}

function getQuestionProgressStatus(
  question: ExamQuestion,
  answer: ExamStudentAnswer | undefined
): QuestionProgressStatus {
  if (question.type === "single_choice") {
    return getSingleChoiceAnswer(answer)
      ? "answered"
      : "unanswered";
  }

  if (question.type === "short_answer") {
    return getShortAnswer(answer).trim()
      ? "answered"
      : "unanswered";
  }

  const trueFalseAnswer =
    getTrueFalseAnswer(answer);

  const answeredStatementCount =
    question.statements.filter(
      (statement) =>
        typeof trueFalseAnswer[
          statement.id
        ] === "boolean"
    ).length;

  if (
    answeredStatementCount === 0
  ) {
    return "unanswered";
  }

  if (
    answeredStatementCount <
    question.statements.length
  ) {
    return "partial";
  }

  return "answered";
}

function getTrueFalseAnsweredCount(
  question: ExamTrueFalseQuestion,
  answer: ExamStudentAnswer | undefined
): number {
  const trueFalseAnswer =
    getTrueFalseAnswer(answer);

  return question.statements.filter(
    (statement) =>
      typeof trueFalseAnswer[
        statement.id
      ] === "boolean"
  ).length;
}

function getQuestionTypeLabel(question: ExamQuestion): string {
  if (question.type === "single_choice") return "Trắc nghiệm";
  if (question.type === "true_false_group") return "Đúng / Sai";
  return "Trả lời ngắn";
}

function formatReviewAnswer(value: unknown): string {
  if (typeof value === "string") {
    return value || "--";
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const record = value as Record<string, unknown>;

    return ANSWER_KEYS.map((key) => {
      const answer = record[key];

      if (typeof answer !== "boolean") {
        return `${key}: --`;
      }

      return `${key}: ${answer ? "Đúng" : "Sai"}`;
    }).join(" · ");
  }

  return "--";
}

export default function StudentExamPage() {
  const params = useParams();

  const assignmentCode = useMemo(() => {
    const value = params?.assignmentCode ?? params?.assignmentId;

    if (typeof value === "string" && value.trim()) {
      return decodeURIComponent(value).trim().toUpperCase();
    }

    if (Array.isArray(value) && value[0]) {
      return decodeURIComponent(value[0]).trim().toUpperCase();
    }

    return "";
  }, [params]);

  const [assignment, setAssignment] = useState<ExamAssignmentInfo | null>(null);
  const [student, setStudent] = useState<ExamStudentInfo | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptionMap>({});
  const [answers, setAnswers] = useState<ExamAnswers>({});
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<string[]>(
    []
  );

  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const [visibilityLostCount, setVisibilityLostCount] = useState(0);
  const [focusLostCount, setFocusLostCount] = useState(0);
  const [suspiciousEvents, setSuspiciousEvents] = useState<
    ExamSuspiciousEvent[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitSummary, setSubmitSummary] =
    useState<SubmitSummary | null>(null);
  const [answerReview, setAnswerReview] =
    useState<SubmitAnswerReviewItem[]>([]);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [message, setMessage] = useState("");

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitLockRef = useRef(false);
  const autoSubmitTriggeredRef = useRef(false);

  const latestStateRef = useRef<LatestState>({
    answers: {},
    bookmarkedQuestionIds: [],
    currentQuestionIndex: 0,
    visibilityLostCount: 0,
    focusLostCount: 0,
    suspiciousEvents: [],
  });

  const currentQuestion = questions[currentQuestionIndex];

const sectionGroups =
  useMemo<ExamSectionGroup[]>(
    () => {
      const groupMap =
        new Map<
          string,
          ExamSectionGroup
        >();

      questions.forEach(
        (
          question,
          globalIndex
        ) => {
          const sectionId =
            safeText(
              question.sectionId
            ) ||
            "default-section";

          const sectionTitle =
            safeText(
              question.sectionTitle
            ) ||
            "Phần câu hỏi";

          const existingGroup =
            groupMap.get(
              sectionId
            );

          if (
            existingGroup
          ) {
            existingGroup.questions.push({
              question,
              globalIndex,
            });

            return;
          }

          groupMap.set(
            sectionId,
            {
              id:
                sectionId,

              title:
                sectionTitle,

              questions: [
                {
                  question,
                  globalIndex,
                },
              ],
            }
          );
        }
      );

      return Array.from(
        groupMap.values()
      );
    },
    [
      questions,
    ]
  );

  const answeredCount = useMemo(
    () =>
      questions.filter((question) =>
        isQuestionAnswered(question, answers[question.id])
      ).length,
    [answers, questions]
  );
const partialCount =
  useMemo(
    () =>
      questions.filter(
        (question) =>
          getQuestionProgressStatus(
            question,
            answers[
              question.id
            ]
          ) === "partial"
      ).length,
    [
      answers,
      questions,
    ]
  );
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const bookmarkedCount = bookmarkedQuestionIds.length;
const notStartedCount =
  useMemo(
    () =>
      questions.filter(
        (question) =>
          getQuestionProgressStatus(
            question,
            answers[
              question.id
            ]
          ) ===
          "unanswered"
      ).length,
    [
      answers,
      questions,
    ]
  );
  useEffect(() => {
    latestStateRef.current = {
      answers,
      bookmarkedQuestionIds,
      currentQuestionIndex,
      visibilityLostCount,
      focusLostCount,
      suspiciousEvents,
    };
  }, [
    answers,
    bookmarkedQuestionIds,
    currentQuestionIndex,
    visibilityLostCount,
    focusLostCount,
    suspiciousEvents,
  ]);

  useEffect(() => {
    if (!assignmentCode) {
      setMessage("Mã bài làm không hợp lệ.");
      setLoading(false);
      return;
    }

    void loadAssignment();
  }, [assignmentCode]);

  useEffect(() => {
    if (!examStarted || submitted || submitting || !attempt?.expiresAt) {
      return;
    }

    const updateRemainingTime = () => {
      const expiresAtTime = new Date(attempt.expiresAt).getTime();

      if (Number.isNaN(expiresAtTime)) {
        setTimeLeft(0);
        return;
      }

      const remainingSeconds = Math.max(
        0,
        Math.ceil((expiresAtTime - Date.now()) / 1000)
      );

      setTimeLeft(remainingSeconds);

      if (
        remainingSeconds <= 0 &&
        !autoSubmitTriggeredRef.current &&
        !submitLockRef.current
      ) {
        autoSubmitTriggeredRef.current = true;
        void submitExam(true);
      }
    };

    updateRemainingTime();

    const timer = window.setInterval(updateRemainingTime, 1000);

    return () => window.clearInterval(timer);
  }, [attempt?.expiresAt, examStarted, submitted, submitting]);

  useEffect(() => {
    if (!examStarted || submitted || !attempt) return;

    const interval = window.setInterval(() => {
      void saveProgress(true);
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [attempt?.id, examStarted, submitted]);

  useEffect(() => {
    if (!examStarted || submitted) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;

      const now = Date.now();

      const event: ExamSuspiciousEvent = {
        type: "visibility_hidden",
        at: new Date(now).toISOString(),
      };

      setVisibilityLostCount((previous) => previous + 1);
      setSuspiciousEvents((previous) => [...previous, event].slice(-100));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [examStarted, submitted]);

  useEffect(() => {
    if (!examStarted || submitted || !attempt || !student) return;

    const handlePageHide = () => {
      const currentState = latestStateRef.current;

      const payload = JSON.stringify({
        attemptId: attempt.id,
        studentId: student.id,
        studentCode: student.studentCode,
        answers: currentState.answers,
        bookmarkedQuestionIds: currentState.bookmarkedQuestionIds,
        currentQuestionIndex: currentState.currentQuestionIndex,
        antiCheat: {
          visibilityLostCount: currentState.visibilityLostCount,
          focusLostCount: currentState.focusLostCount,
          suspiciousEvents: currentState.suspiciousEvents,
        },
      });

      navigator.sendBeacon(
        "/api/student/progress",
        new Blob([payload], { type: "application/json" })
      );
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [attempt, examStarted, student, submitted]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  async function loadAssignment() {
    try {
      setLoading(true);
      setMessage("");

      const data = await postJSON<AssignmentInfoResponse>(
        "/api/student/assignment-info",
        { assignmentCode }
      );

      setAssignment(data.assignment);
    } catch (error: unknown) {
      setAssignment(null);
      setMessage(getErrorMessage(error, "Không tải được bài kiểm tra."));
    } finally {
      setLoading(false);
    }
  }

  async function handleStartExam() {
    if (!assignment || starting) return;

    if (assignment.accessState !== "available") {
      setMessage(
        assignment.accessMessage || "Bài kiểm tra hiện chưa thể bắt đầu."
      );
      return;
    }

    const cleanStudentCode = studentCode.trim().toUpperCase();
    const cleanPassword = password.trim();

    if (!cleanStudentCode) {
      setMessage("Vui lòng nhập mã học sinh.");
      return;
    }

    try {
      setStarting(true);
      setMessage("Đang kiểm tra thông tin và mở bài làm...");

      const data = await postJSON<StartExamResponse>("/api/student/start", {
        assignmentId: assignment.id,
        assignmentCode: assignment.assignmentCode,
        studentCode: cleanStudentCode,
        password: cleanPassword,
      });

      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error("Đề kiểm tra này chưa có câu hỏi.");
      }

      const safeCurrentIndex = Math.min(
        Math.max(0, Number(data.attempt.currentQuestionIndex ?? 0)),
        data.questions.length - 1
      );

      setAssignment(data.assignment);
      setStudent(data.student);
      setAttempt(data.attempt);
      setQuestions(data.questions);
      setDisplayOptions(
        buildDisplayOptionMap(data.questions, data.attempt.optionOrders ?? {})
      );
      setAnswers(data.attempt.answers ?? {});
      setBookmarkedQuestionIds(data.attempt.bookmarkedQuestionIds ?? []);
      setCurrentQuestionIndex(safeCurrentIndex);
      setTimeLeft(Number(data.attempt.remainingSeconds ?? 0));
      setVisibilityLostCount(
        Number(data.attempt.antiCheat?.visibilityLostCount ?? 0)
      );
      setFocusLostCount(Number(data.attempt.antiCheat?.focusLostCount ?? 0));
      setSuspiciousEvents(
        Array.isArray(data.attempt.antiCheat?.suspiciousEvents)
          ? data.attempt.antiCheat.suspiciousEvents
          : []
      );

      setExamStarted(true);
      setSubmitted(false);
      setSubmitSummary(null);
      setAnswerReview([]);
      setSaveStatus("saved");
      setLastSavedAt(data.attempt.startedAt ?? "");

      autoSubmitTriggeredRef.current = false;
      submitLockRef.current = false;

      setMessage(
        data.resumed ? "Đã khôi phục bài làm đang thực hiện." : ""
      );
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Không bắt đầu được bài làm."));
    } finally {
      setStarting(false);
    }
  }

  function scheduleSave() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("saving");

    saveTimeoutRef.current = setTimeout(() => {
      void saveProgress(false);
    }, 700);
  }

  function setQuestionAnswer(
    questionId: string,
    answer: ExamStudentAnswer
  ) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: answer,
    }));

    scheduleSave();
  }

  function chooseSingleChoice(
    question: ExamSingleChoiceQuestion,
    answerKey: ExamAnswerKey
  ) {
    setQuestionAnswer(question.id, answerKey);
  }

  function chooseTrueFalse(
    question: ExamTrueFalseQuestion,
    statementId: ExamAnswerKey,
    value: boolean
  ) {
    const currentAnswer = getTrueFalseAnswer(answers[question.id]);

    setQuestionAnswer(question.id, {
      ...currentAnswer,
      [statementId]: value,
    });
  }

  function changeShortAnswer(
    question: ExamShortAnswerQuestion,
    value: string
  ) {
    setQuestionAnswer(question.id, value);
  }

  function toggleBookmark(questionId: string) {
    setBookmarkedQuestionIds((previous) =>
      previous.includes(questionId)
        ? previous.filter((id) => id !== questionId)
        : [...previous, questionId]
    );

    scheduleSave();
  }

  function goToQuestion(index: number) {
    const safeIndex = Math.min(
      Math.max(0, index),
      Math.max(0, questions.length - 1)
    );

    setCurrentQuestionIndex(safeIndex);
    scheduleSave();
  }

  async function saveProgress(silent = false): Promise<boolean> {
    if (!attempt || !student || !examStarted || submitted || submitting) {
      return false;
    }

    try {
      if (!silent) {
        setSaveStatus("saving");
      }

      const currentState = latestStateRef.current;

      const data = await postJSON<ProgressResponse>("/api/student/progress", {
        attemptId: attempt.id,
        studentId: student.id,
        studentCode: student.studentCode,
        answers: currentState.answers,
        bookmarkedQuestionIds: currentState.bookmarkedQuestionIds,
        currentQuestionIndex: currentState.currentQuestionIndex,
        antiCheat: {
          visibilityLostCount: currentState.visibilityLostCount,
          focusLostCount: currentState.focusLostCount,
          suspiciousEvents: currentState.suspiciousEvents,
        },
      });

      setSaveStatus("saved");
      setLastSavedAt(data.savedAt || new Date().toISOString());

      return true;
    } catch (error: unknown) {
      console.error("Không lưu được tiến độ:", error);
      setSaveStatus("error");

      if (!silent) {
        setMessage(
          getErrorMessage(
            error,
            "Không lưu được tiến độ. Vui lòng kiểm tra kết nối mạng."
          )
        );
      }

      return false;
    }
  }

  async function submitExam(autoSubmit = false) {
    if (
      !attempt ||
      !student ||
      questions.length === 0 ||
      submitLockRef.current ||
      submitting
    ) {
      return;
    }

    if (!autoSubmit) {
      const warningText =
        unansweredCount > 0
          ? `Bạn còn ${unansweredCount} câu chưa hoàn thành.\n\nBạn vẫn muốn nộp bài?`
          : "Bạn chắc chắn muốn nộp bài? Sau khi nộp sẽ không thể sửa.";

      if (!window.confirm(warningText)) return;
    }

    submitLockRef.current = true;

    try {
      setSubmitting(true);
      setMessage(
        autoSubmit
          ? "Đã hết giờ. Hệ thống đang tự động nộp bài..."
          : "Đang lưu lần cuối và nộp bài..."
      );

      await saveProgress(true);

      const currentState = latestStateRef.current;

      const response = await postJSON<SubmitExamResponse>(
        "/api/student/submit",
        {
          attemptId: attempt.id,
          studentId: student.id,
          studentCode: student.studentCode,
          answers: currentState.answers,
          autoSubmit,
          antiCheat: {
            visibilityLostCount: currentState.visibilityLostCount,
            focusLostCount: currentState.focusLostCount,
            suspiciousEvents: currentState.suspiciousEvents,
          },
        }
      );

      setExamStarted(false);
      setSubmitted(true);
      setSubmitSummary(response.summary ?? null);
      setAnswerReview(
        Array.isArray(response.answerReview)
          ? response.answerReview
          : []
      );
      setSaveStatus("saved");

      setMessage(
        response.alreadySubmitted
          ? "Bài làm đã được ghi nhận trước đó."
          : autoSubmit
            ? "Đã hết giờ và hệ thống đã tự động nộp bài."
            : "Đã nộp bài thành công."
      );
    } catch (error: unknown) {
      submitLockRef.current = false;
      autoSubmitTriggeredRef.current = false;
      setMessage(
        getErrorMessage(
          error,
          "Không nộp được bài. Vui lòng kiểm tra kết nối và thử lại."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderSingleChoiceQuestion(question: ExamSingleChoiceQuestion) {
    const selectedAnswer = getSingleChoiceAnswer(answers[question.id]);
    const options = displayOptions[question.id] ?? [];

    return (
      <div style={answerList}>
        {options.map((option) => {
          const isSelected = selectedAnswer === option.originalKey;

          return (
            <button
              key={`${question.id}-${option.originalKey}`}
              type="button"
              onClick={() =>
                chooseSingleChoice(question, option.originalKey)
              }
              style={{
                ...answerBtn,
                borderColor: isSelected ? "#2563eb" : "#cbd5e1",
                background: isSelected ? "#eff6ff" : "white",
                boxShadow: isSelected
                  ? "0 0 0 2px rgba(37,99,235,.08)"
                  : "none",
              }}
            >
              <span
                style={{
                  ...answerOptionLabel,
                  background: isSelected ? "#2563eb" : "#f1f5f9",
                  color: isSelected ? "white" : "#334155",
                }}
              >
                {option.displayKey}
              </span>

              <div style={answerContent}>
                <MathContent text={option.content} />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderTrueFalseQuestion(question: ExamTrueFalseQuestion) {
    const currentAnswer = getTrueFalseAnswer(answers[question.id]);

    return (
      <div style={trueFalseTable}>
        <div style={trueFalseHeader}>
          <div style={trueFalseStatementHeader}>Nội dung</div>
          <div style={trueFalseChoiceHeader}>Đúng</div>
          <div style={trueFalseChoiceHeader}>Sai</div>
        </div>

        {question.statements.map((statement) => {
          const selectedValue = currentAnswer[statement.id];

          return (
            <div key={statement.id} style={trueFalseRow}>
              <div style={statementContent}>
                <span style={statementLabel}>{statement.id}</span>

                <div style={answerContent}>
                  <MathContent text={statement.content} />
                </div>
              </div>

              <button
                type="button"
                aria-label={`Chọn Đúng cho mệnh đề ${statement.id}`}
                onClick={() =>
                  chooseTrueFalse(question, statement.id, true)
                }
                style={{
                  ...trueFalseButton,
                  background:
                    selectedValue === true ? "#dcfce7" : "white",
                  borderColor:
                    selectedValue === true ? "#16a34a" : "#cbd5e1",
                  color: selectedValue === true ? "#166534" : "#475569",
                }}
              >
                {selectedValue === true ? "✓" : ""}
              </button>

              <button
                type="button"
                aria-label={`Chọn Sai cho mệnh đề ${statement.id}`}
                onClick={() =>
                  chooseTrueFalse(question, statement.id, false)
                }
                style={{
                  ...trueFalseButton,
                  background:
                    selectedValue === false ? "#fee2e2" : "white",
                  borderColor:
                    selectedValue === false ? "#dc2626" : "#cbd5e1",
                  color: selectedValue === false ? "#991b1b" : "#475569",
                }}
              >
                {selectedValue === false ? "✓" : ""}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderShortAnswerQuestion(question: ExamShortAnswerQuestion) {
    const value = getShortAnswer(answers[question.id]);

    return (
      <div>
        <label style={shortAnswerLabel} htmlFor={`answer-${question.id}`}>
          Câu trả lời
        </label>

        <textarea
          id={`answer-${question.id}`}
          value={value}
          onChange={(event) =>
            changeShortAnswer(question, event.target.value)
          }
          placeholder="Nhập câu trả lời của bạn..."
          rows={6}
          style={shortAnswerInput}
        />

        <div style={shortAnswerHint}>
          Nội dung được tự động lưu trong quá trình nhập.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1>Đang tải bài kiểm tra...</h1>
        </section>
      </main>
    );
  }

  if (!assignment) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1>Không mở được bài kiểm tra</h1>
          {message && <div style={errorBox}>{message}</div>}
        </section>
      </main>
    );
  }

  if (submitted) {
    return (
      <main style={pageStyle}>
        <section style={submittedCardStyle}>
          <div style={submittedIconStyle}>✓</div>
          <h1>Đã nộp bài thành công</h1>

          <p style={submittedTextStyle}>
            Bài làm của bạn đã được ghi nhận trên hệ thống.
          </p>

          <div style={submittedInfoBox}>
            <p>
              <b>Môn:</b> {assignment.subject || "--"}
            </p>

            <p>
              <b>Lớp:</b>{" "}
              {student?.className || getClassDisplayName(assignment)}
            </p>

            {student && (
              <>
                <p>
                  <b>Học sinh:</b> {student.studentName}
                </p>

                <p>
                  <b>Mã học sinh:</b> {student.studentCode}
                </p>
              </>
            )}
          </div>

          {submitSummary ? (
            <div style={resultSummaryBox}>
              <div style={resultScoreText}>
                {submitSummary.score}/{submitSummary.totalScore}
              </div>

              <div style={resultPercentText}>
                {submitSummary.percentage}% · Đúng{" "}
                {submitSummary.correctQuestionCount}/
                {submitSummary.totalQuestions} câu
              </div>

              <div style={resultMetaGrid}>
                <span>
                  Đã trả lời: {submitSummary.answeredQuestionCount}
                </span>

                {submitSummary.totalStatementCount > 0 && (
                  <span>
                    Mệnh đề đúng/sai:{" "}
                    {submitSummary.correctStatementCount}/
                    {submitSummary.totalStatementCount}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={submittedNoticeStyle}>
              Kết quả sẽ được giáo viên xem và thông báo sau.
            </div>
          )}

          {answerReview.length > 0 && (
            <div style={answerReviewBox}>
              <h2 style={answerReviewTitle}>Đáp án đúng</h2>

              <div style={answerReviewList}>
                {answerReview.map((item) => (
                  <div
                    key={item.questionId}
                    style={{
                      ...answerReviewItem,
                      borderColor: item.isCorrect ? "#bbf7d0" : "#fecaca",
                      background: item.isCorrect ? "#f0fdf4" : "#fef2f2",
                    }}
                  >
                    <div style={answerReviewTop}>
                      <strong>Câu {item.questionNumber}</strong>
                      <span>
                        {item.score}/{item.maxScore} điểm
                      </span>
                    </div>

                    <div style={answerReviewText}>
                      <b>Em chọn:</b>{" "}
                      {formatReviewAnswer(item.studentAnswer)}
                    </div>

                    <div style={answerReviewText}>
                      <b>Đáp án đúng:</b>{" "}
                      {item.type === "short_answer"
                        ? (item.acceptedAnswers ?? []).join("; ") || "--"
                        : formatReviewAnswer(item.correctAnswer)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (!examStarted) {
    const isAvailable = assignment.accessState === "available";

    return (
      <AnimatedLoginScene eyebrow="KIEMTRA.AI EXAM">
        <div style={studentLoginKicker}>KIEMTRA.AI</div>
        <h1 style={studentLoginTitle}>Vào làm bài kiểm tra</h1>

        <div style={studentInfoBox}>
          <p>
            <b>Môn:</b> {assignment.subject || "--"}
          </p>

          <p>
            <b>Thời gian:</b> {assignment.durationMinutes || 45} phút
          </p>

          <p>
            <b>Mã giao đề:</b>{" "}
            {assignment.assignmentCode || assignmentCode}
          </p>
        </div>

        {!isAvailable && (
          <div
            style={{
              ...messageStyle,
              background: "#fff7ed",
              color: "#9a3412",
            }}
          >
            {assignment.accessMessage}
          </div>
        )}

        <div>
          <label style={studentLabelStyle}>Mã học sinh</label>

          <input
            value={studentCode}
            onChange={(event) =>
              setStudentCode(event.target.value.toUpperCase())
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleStartExam();
              }
            }}
            placeholder="Ví dụ: FQN001"
            autoComplete="off"
            style={studentInputStyle}
          />
        </div>

        {assignment.hasPassword && (
          <div>
            <label style={studentLabelStyle}>Mật khẩu bài kiểm tra</label>

            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleStartExam();
                }
              }}
              placeholder="Nhập mật khẩu giáo viên cung cấp"
              type="password"
              style={studentInputStyle}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleStartExam()}
          disabled={starting || !isAvailable}
          style={{
            ...studentPrimaryBtn,
            opacity: starting || !isAvailable ? 0.6 : 1,
            cursor: starting || !isAvailable ? "not-allowed" : "pointer",
          }}
        >
          {starting
            ? "Đang mở bài..."
            : assignment.accessState === "scheduled"
              ? "Bài thi chưa mở"
              : assignment.accessState === "closed"
                ? "Bài thi đã đóng"
                : assignment.accessState === "locked"
                  ? "Bài thi đang khóa"
                  : assignment.accessState === "archived"
                    ? "Bài thi đã lưu trữ"
                    : "Bắt đầu làm bài"}
        </button>

        {message && (
          <div
            style={{
              ...messageStyle,
              background:
                message.includes("Đang") || message.includes("khôi phục")
                  ? "#dbeafe"
                  : "#fee2e2",
              color:
                message.includes("Đang") || message.includes("khôi phục")
                  ? "#1e40af"
                  : "#991b1b",
            }}
          >
            {message}
          </div>
        )}
      </AnimatedLoginScene>
    );
  }

  return (
    <main style={examPageStyle}>
      <header style={examHeader}>
        <div style={{ minWidth: 0 }}>
          <h2 style={examTitle}>{assignment.testTitle || "Bài kiểm tra"}</h2>

          <p style={studentMeta}>
            Học sinh: <b>{student?.studentName}</b> — Mã:{" "}
            <b>{student?.studentCode}</b> — Lớp:{" "}
            <b>{student?.className || getClassDisplayName(assignment)}</b>
          </p>

          <div style={headerStatusRow}>
            <span
              style={{
                ...saveBadge,
                background:
                  saveStatus === "error"
                    ? "#fee2e2"
                    : saveStatus === "saved"
                      ? "#dcfce7"
                      : "#dbeafe",
                color:
                  saveStatus === "error"
                    ? "#991b1b"
                    : saveStatus === "saved"
                      ? "#166534"
                      : "#1e40af",
              }}
            >
              {getSaveStatusText(saveStatus)}
            </span>

            {lastSavedAt && (
              <span style={lastSavedText}>
                Lưu gần nhất:{" "}
                {new Date(lastSavedAt).toLocaleTimeString("vi-VN")}
              </span>
            )}

            {attempt?.attemptNumber && (
              <span style={attemptBadge}>Lượt {attempt.attemptNumber}</span>
            )}
          </div>
        </div>

        <div
          style={{
            ...timerBox,
            background: timeLeft <= 300 ? "#fee2e2" : "#eff6ff",
            color: timeLeft <= 300 ? "#991b1b" : "#1e40af",
          }}
        >
          <div>Thời gian còn lại</div>
          <b style={timerText}>{formatTime(timeLeft)}</b>
        </div>
      </header>

      {message && (
        <div
          style={{
            ...examMessage,
            background: message.includes("Đang")
              ? "#dbeafe"
              : message.includes("thành công") ||
                  message.includes("khôi phục")
                ? "#dcfce7"
                : "#fee2e2",
            color: message.includes("Đang")
              ? "#1e40af"
              : message.includes("thành công") ||
                  message.includes("khôi phục")
                ? "#166534"
                : "#991b1b",
          }}
        >
          {message}
        </div>
      )}

      <div style={examLayout}>
        <section style={questionArea}>
          {currentQuestion && (
            <article style={questionCard}>
              <div style={questionTop}>
                <div>
                  <div style={questionNumberLabel}>
                    Câu {currentQuestionIndex + 1}
                  </div>

                  <div style={questionMetaRow}>
                    <span>
                      {currentQuestionIndex + 1}/{questions.length}
                    </span>

                    <span style={questionTypeBadge}>
                      {currentQuestion.sectionTitle} ·{" "}
                      {getQuestionTypeLabel(currentQuestion)}
                    </span>
                  </div>
                </div>

                <div style={questionTopActions}>
                  {(() => {
  const progressStatus =
    getQuestionProgressStatus(
      currentQuestion,
      answers[
        currentQuestion.id
      ]
    );

  const isPartial =
    progressStatus ===
    "partial";

  const isAnswered =
    progressStatus ===
    "answered";

  let statusText =
    "Chưa hoàn thành";

  if (
    isAnswered
  ) {
    statusText =
      "Đã hoàn thành";
  }

  if (
    isPartial &&
    currentQuestion.type ===
      "true_false_group"
  ) {
    statusText =
      `Đang làm ${getTrueFalseAnsweredCount(
        currentQuestion,
        answers[
          currentQuestion.id
        ]
      )}/${currentQuestion.statements.length}`;
  }

  return (
    <span
      style={{
        ...answeredBadge,

        background:
          isAnswered
            ? "#dcfce7"
            : isPartial
              ? "#fef3c7"
              : "#f1f5f9",

        color:
          isAnswered
            ? "#166534"
            : isPartial
              ? "#92400e"
              : "#475569",
      }}
    >
      {
        statusText
      }
    </span>
  );
})()}
                  <button
                    type="button"
                    onClick={() => toggleBookmark(currentQuestion.id)}
                    style={{
                      ...bookmarkBtn,
                      background: bookmarkedQuestionIds.includes(
                        currentQuestion.id
                      )
                        ? "#fef3c7"
                        : "white",
                      color: bookmarkedQuestionIds.includes(currentQuestion.id)
                        ? "#92400e"
                        : "#475569",
                      borderColor: bookmarkedQuestionIds.includes(
                        currentQuestion.id
                      )
                        ? "#f59e0b"
                        : "#cbd5e1",
                    }}
                  >
                    {bookmarkedQuestionIds.includes(currentQuestion.id)
                      ? "★ Đã đánh dấu"
                      : "☆ Đánh dấu xem lại"}
                  </button>
                </div>
              </div>

              {currentQuestion.content ? (
                <div style={questionText}>
                  <QuestionContentBlocks
                    content={
                      currentQuestion.content
                    }
                    blocks={
                      currentQuestion.contentBlocks
                    }
                    questionImageUrl={
                      currentQuestion.imageUrl
                    }
                  />
                </div>
              ) : (
                <div style={emptyContentWarning}>
                  Câu hỏi chưa có nội dung đề dẫn trong bản đề đã xuất bản.
                </div>
              )}

              {currentQuestion.type === "single_choice" &&
                renderSingleChoiceQuestion(currentQuestion)}

              {currentQuestion.type === "true_false_group" &&
                renderTrueFalseQuestion(currentQuestion)}

              {currentQuestion.type === "short_answer" &&
                renderShortAnswerQuestion(currentQuestion)}

              <div style={navButtons}>
                <button
                  type="button"
                  onClick={() => goToQuestion(currentQuestionIndex - 1)}
                  disabled={currentQuestionIndex === 0}
                  style={{
                    ...secondaryBtn,
                    opacity: currentQuestionIndex === 0 ? 0.5 : 1,
                    cursor:
                      currentQuestionIndex === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  ← Câu trước
                </button>

                <button
                  type="button"
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                  disabled={currentQuestionIndex === questions.length - 1}
                  style={{
                    ...nextBtn,
                    opacity:
                      currentQuestionIndex === questions.length - 1 ? 0.5 : 1,
                    cursor:
                      currentQuestionIndex === questions.length - 1
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Câu tiếp →
                </button>
              </div>
            </article>
          )}
        </section>

        <aside style={sidePanel}>
          <h3 style={sideTitle}>
  Bảng câu hỏi
</h3>

<div style={legendRow}>
  <span style={legendItem}>
    <span
      style={{
        ...legendDot,
        background:
          "#16a34a",
      }}
    />

    Hoàn thành
  </span>

  <span style={legendItem}>
    <span
      style={{
        ...legendDot,
        background:
          "#f59e0b",
      }}
    />

    Đang làm
  </span>

  <span style={legendItem}>
    <span
      style={{
        ...legendDot,
        background:
          "#2563eb",
      }}
    />

    Hiện tại
  </span>

  <span style={legendItem}>
    <span
      style={{
        ...legendDot,
        background:
          "#fbbf24",
      }}
    />

    Đánh dấu
  </span>
</div>

<div style={sectionNavigation}>
  {sectionGroups.map(
    (
      section,
      sectionIndex
    ) => {
      const completedCount =
        section.questions.filter(
          ({
            question,
          }) =>
            getQuestionProgressStatus(
              question,
              answers[
                question.id
              ]
            ) ===
            "answered"
        ).length;

      const sectionPartialCount =
        section.questions.filter(
          ({
            question,
          }) =>
            getQuestionProgressStatus(
              question,
              answers[
                question.id
              ]
            ) ===
            "partial"
        ).length;

      return (
        <section
          key={
            section.id
          }
          style={
            sectionNavigationGroup
          }
        >
          <div
            style={
              sectionNavigationHeader
            }
          >
            <div
              style={
                sectionNavigationTitle
              }
            >
              <span
                style={
                  sectionIndexBadge
                }
              >
                {
                  sectionIndex +
                  1
                }
              </span>

              <span>
                {
                  section.title
                }
              </span>
            </div>

            <span
              style={
                sectionProgressBadge
              }
            >
              {
                completedCount
              }
              /
              {
                section
                  .questions
                  .length
              }
            </span>
          </div>

          {sectionPartialCount >
            0 && (
            <div
              style={
                sectionPartialText
              }
            >
              {
                sectionPartialCount
              }{" "}
              câu đang làm
            </div>
          )}

          <div
            style={
              questionGrid
            }
          >
            {section.questions.map(
              ({
                question,
                globalIndex,
              }) => {
                const progressStatus =
                  getQuestionProgressStatus(
                    question,
                    answers[
                      question.id
                    ]
                  );

                const active =
                  globalIndex ===
                  currentQuestionIndex;

                const bookmarked =
                  bookmarkedQuestionIds.includes(
                    question.id
                  );

                let background =
                  "#e5e7eb";

                let color =
                  "#334155";

                let borderColor =
                  "transparent";

                if (
                  progressStatus ===
                  "partial"
                ) {
                  background =
                    "#f59e0b";

                  color =
                    "white";
                }

                if (
                  progressStatus ===
                  "answered"
                ) {
                  background =
                    "#16a34a";

                  color =
                    "white";
                }

                if (
                  bookmarked
                ) {
                  borderColor =
                    "#fbbf24";
                }

                if (
                  active
                ) {
                  background =
                    "#2563eb";

                  color =
                    "white";

                  borderColor =
                    "#1d4ed8";
                }

                let buttonTitle =
                  `Đi đến câu ${
                    globalIndex +
                    1
                  }`;

                if (
                  progressStatus ===
                  "partial"
                ) {
                  buttonTitle =
                    `Câu ${
                      globalIndex +
                      1
                    } đang làm`;
                }

                if (
                  bookmarked
                ) {
                  buttonTitle +=
                    " — đã đánh dấu";
                }

                return (
                  <button
                    key={
                      question.id
                    }
                    type="button"
                    onClick={() =>
                      goToQuestion(
                        globalIndex
                      )
                    }
                    title={
                      buttonTitle
                    }
                    aria-label={
                      buttonTitle
                    }
                    style={{
                      ...questionNumberBtn,

                      background,

                      color,

                      border:
                        `2px solid ${borderColor}`,
                    }}
                  >
                    {
                      globalIndex +
                      1
                    }

                    {bookmarked && (
                      <span
                        style={
                          bookmarkIndicator
                        }
                      >
                        ★
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </section>
      );
    }
  )}
</div>

          <div style={summaryBox}>
            <div style={summaryRow}>
              <span>Đã hoàn thành</span>
              <b>
                {answeredCount}/{questions.length}
              </b>
            </div>

            <div style={summaryRow}>
  <span>Đang làm</span>
  <b>{partialCount}</b>
</div>

            <div style={summaryRow}>
            <span>Chưa bắt đầu</span>
<b>{notStartedCount}</b>
            </div>

            <div style={summaryRow}>
              <span>Đánh dấu xem lại</span>
              <b>{bookmarkedCount}</b>
            </div>

            <div style={summaryRow}>
              <span>Rời màn hình</span>
              <b>{visibilityLostCount + focusLostCount}</b>
            </div>
          </div>

          {unansweredCount > 0 && (
  <div style={unansweredWarning}>
    Bạn còn{" "}
    <b>
      {unansweredCount}
    </b>{" "}
    câu chưa hoàn thành.

    {partialCount > 0 && (
      <div
        style={{
          marginTop:
            5,
        }}
      >
        Trong đó có{" "}
        <b>
          {partialCount}
        </b>{" "}
        câu đang làm dở.
      </div>
    )}
  </div>
)}

          <button
            type="button"
            onClick={() => void saveProgress(false)}
            disabled={saveStatus === "saving" || submitting}
            style={{
              ...saveNowBtn,
              opacity: saveStatus === "saving" || submitting ? 0.6 : 1,
              cursor:
                saveStatus === "saving" || submitting
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {saveStatus === "saving" ? "Đang lưu..." : "Lưu bài ngay"}
          </button>

          <button
            type="button"
            onClick={() => void submitExam(false)}
            disabled={submitting}
            style={{
              ...submitBtn,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Đang nộp..." : "Nộp bài"}
          </button>
        </aside>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  padding: 24,
  fontFamily: "Arial, sans-serif",
  background: "#eef4ff",
  minHeight: "100vh",
  boxSizing: "border-box",
};

const examPageStyle: CSSProperties = {
  ...pageStyle,
};

const cardStyle: CSSProperties = {
  maxWidth: 720,
  margin: "40px auto",
  background: "white",
  padding: 28,
  borderRadius: 22,
  boxShadow: "0 12px 32px rgba(15,23,42,.12)",
};

const loginCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  margin: "40px auto",
  background: "white",
  padding: 30,
  borderRadius: 22,
  boxShadow: "0 12px 32px rgba(15,23,42,.12)",
  boxSizing: "border-box",
};

const brandText: CSSProperties = {
  color: "#2563eb",
  fontWeight: 900,
  letterSpacing: 1,
  marginBottom: 8,
};

const loginTitle: CSSProperties = {
  margin: "0 0 20px",
};

const infoBox: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  marginBottom: 20,
  lineHeight: 1.6,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 800,
  marginBottom: 7,
  color: "#334155",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  marginBottom: 16,
  fontSize: 16,
  boxSizing: "border-box",
};

const primaryBtn: CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  borderRadius: 14,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
};

const studentLoginKicker: CSSProperties = {
  color: "#4f46e5",
  fontWeight: 900,
  letterSpacing: 0,
  marginBottom: 8,
  textAlign: "center",
};

const studentLoginTitle: CSSProperties = {
  margin: "0 0 20px",
  color: "#111827",
  fontSize: 32,
  fontWeight: 950,
  textAlign: "center",
};

const studentInfoBox: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  marginBottom: 20,
  lineHeight: 1.6,
  color: "#0f172a",
  boxShadow: "none",
};

const studentLabelStyle: CSSProperties = {
  display: "block",
  fontWeight: 900,
  marginBottom: 7,
  color: "#334155",
};

const studentInputStyle: CSSProperties = {
  ...inputStyle,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  boxShadow: "none",
};

const studentPrimaryBtn: CSSProperties = {
  ...primaryBtn,
  background: "linear-gradient(180deg,#93c5fd,#2563eb)",
  boxShadow: "0 14px 30px rgba(37,99,235,.32)",
};

const messageStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  marginTop: 16,
  fontWeight: 800,
  lineHeight: 1.5,
};

const examMessage: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  marginBottom: 18,
  fontWeight: 800,
};

const errorBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 800,
};

const examHeader: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "white",
  borderRadius: 20,
  padding: 20,
  marginBottom: 18,
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  flexWrap: "wrap",
};

const examTitle: CSSProperties = {
  margin: 0,
  fontSize: 23,
  fontWeight: 900,
  wordBreak: "break-word",
};

const studentMeta: CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  lineHeight: 1.5,
};

const headerStatusRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  marginTop: 11,
  flexWrap: "wrap",
};

const saveBadge: CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 900,
};

const lastSavedText: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const attemptBadge: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#334155",
  fontWeight: 900,
  fontSize: 13,
};

const timerBox: CSSProperties = {
  minWidth: 175,
  textAlign: "center",
  padding: 14,
  borderRadius: 16,
  fontWeight: 800,
};

const timerText: CSSProperties = {
  display: "block",
  fontSize: 25,
  marginTop: 5,
};

const examLayout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: 20,
  alignItems: "start",
};

const questionArea: CSSProperties = {
  minWidth: 0,
};

const questionCard: CSSProperties = {
  background: "white",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  boxSizing: "border-box",
};

const questionTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 20,
  flexWrap: "wrap",
};

const questionNumberLabel: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#111827",
};

const questionMetaRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  color: "#64748b",
  marginTop: 5,
  fontSize: 13,
};

const questionTypeBadge: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#3730a3",
  fontWeight: 800,
};

const questionTopActions: CSSProperties = {
  display: "flex",
  gap: 9,
  flexWrap: "wrap",
  alignItems: "center",
};

const answeredBadge: CSSProperties = {
  padding: "8px 11px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
};

const bookmarkBtn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  fontWeight: 900,
  cursor: "pointer",
};

const questionText: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.7,
  marginBottom: 22,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const emptyContentWarning: CSSProperties = {
  padding: 14,
  marginBottom: 20,
  borderRadius: 14,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontWeight: 800,
};

const examQuestionImage: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 420,
  objectFit: "contain",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  marginBottom: 20,
};

const answerList: CSSProperties = {
  display: "grid",
  gap: 12,
};

const answerBtn: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: 16,
  borderRadius: 16,
  border: "2px solid #cbd5e1",
  fontSize: 16,
  cursor: "pointer",
  lineHeight: 1.5,
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  boxSizing: "border-box",
};

const answerOptionLabel: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const answerContent: CSSProperties = {
  minWidth: 0,
  flex: 1,
  overflowWrap: "anywhere",
};

const answerImage: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 220,
  objectFit: "contain",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  marginTop: 10,
};

const trueFalseTable: CSSProperties = {
  overflow: "hidden",
  border: "1px solid #cbd5e1",
  borderRadius: 16,
};

const trueFalseHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 84px 84px",
  background: "#f8fafc",
  borderBottom: "1px solid #cbd5e1",
  fontWeight: 900,
};

const trueFalseStatementHeader: CSSProperties = {
  padding: 14,
};

const trueFalseChoiceHeader: CSSProperties = {
  padding: 14,
  textAlign: "center",
  borderLeft: "1px solid #cbd5e1",
};

const trueFalseRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 84px 84px",
  borderBottom: "1px solid #e5e7eb",
  alignItems: "stretch",
};

const statementContent: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: 14,
  minWidth: 0,
};

const statementLabel: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 9,
  background: "#f1f5f9",
  color: "#334155",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const trueFalseButton: CSSProperties = {
  minHeight: 58,
  border: "none",
  borderLeft: "1px solid #cbd5e1",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
};

const shortAnswerLabel: CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#334155",
  fontWeight: 900,
};

const shortAnswerInput: CSSProperties = {
  width: "100%",
  minHeight: 150,
  padding: 15,
  borderRadius: 16,
  border: "2px solid #cbd5e1",
  boxSizing: "border-box",
  resize: "vertical",
  fontFamily: "Arial, sans-serif",
  fontSize: 16,
  lineHeight: 1.6,
};

const shortAnswerHint: CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 13,
};

const navButtons: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginTop: 22,
};

const secondaryBtn: CSSProperties = {
  padding: "13px 14px",
  borderRadius: 14,
  border: "none",
  background: "#64748b",
  color: "white",
  fontWeight: 900,
};

const nextBtn: CSSProperties = {
  padding: "13px 14px",
  borderRadius: 14,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
};

const sidePanel: CSSProperties = {
  background: "white",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  position: "sticky",
  top: 20,
  boxSizing: "border-box",
};

const sideTitle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 19,
  fontWeight: 900,
};

const legendRow: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
  color: "#64748b",
  fontSize: 12,
};

const legendItem: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const legendDot: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
};

const questionGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(5, minmax(0, 1fr))",
  gap: 7,
};

const questionNumberBtn: CSSProperties = {
  position: "relative",
  height: 44,
  borderRadius: 11,
  fontWeight: 900,
  cursor: "pointer",
};

const bookmarkIndicator: CSSProperties = {
  position: "absolute",
  right: 2,
  top: 0,
  fontSize: 10,
  color: "#fbbf24",
};

const summaryBox: CSSProperties = {
  marginTop: 18,
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  color: "#334155",
};

const summaryRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "7px 0",
  borderBottom: "1px solid #e5e7eb",
};

const unansweredWarning: CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  background: "#fff7ed",
  color: "#9a3412",
  fontWeight: 800,
  lineHeight: 1.5,
};

const saveNowBtn: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: "#0f172a",
  color: "white",
  fontWeight: 900,
  fontSize: 15,
  marginTop: 16,
};

const submitBtn: CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  borderRadius: 14,
  border: "none",
  background: "#dc2626",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
  marginTop: 10,
};

const submittedCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 620,
  margin: "60px auto",
  background: "white",
  padding: 34,
  borderRadius: 24,
  boxShadow: "0 12px 32px rgba(15,23,42,.12)",
  textAlign: "center",
  boxSizing: "border-box",
};

const submittedIconStyle: CSSProperties = {
  width: 76,
  height: 76,
  borderRadius: "50%",
  background: "#dcfce7",
  color: "#166534",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 42,
  fontWeight: 900,
  margin: "0 auto 18px",
};

const submittedTextStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 17,
  lineHeight: 1.6,
};

const submittedInfoBox: CSSProperties = {
  marginTop: 22,
  padding: 18,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  textAlign: "left",
};

const submittedNoticeStyle: CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 16,
  background: "#eff6ff",
  color: "#1e40af",
  fontWeight: 900,
};

const resultSummaryBox: CSSProperties = {
  marginTop: 20,
  padding: 18,
  borderRadius: 18,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e3a8a",
};

const resultScoreText: CSSProperties = {
  fontSize: 36,
  fontWeight: 950,
  lineHeight: 1,
};

const resultPercentText: CSSProperties = {
  marginTop: 8,
  fontSize: 16,
  fontWeight: 900,
};

const resultMetaGrid: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 10,
  marginTop: 12,
  color: "#475569",
  fontSize: 14,
  fontWeight: 800,
};

const answerReviewBox: CSSProperties = {
  marginTop: 20,
  textAlign: "left",
};

const answerReviewTitle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 18,
  fontWeight: 950,
  color: "#111827",
};

const answerReviewList: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 320,
  overflowY: "auto",
  paddingRight: 4,
};

const answerReviewItem: CSSProperties = {
  padding: 13,
  borderRadius: 14,
  border: "1px solid #e2e8f0",
};

const answerReviewTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 8,
  color: "#111827",
};

const answerReviewText: CSSProperties = {
  color: "#334155",
  fontSize: 14,
  lineHeight: 1.5,
};

const questionImageWrapper: CSSProperties = {
  marginBottom: 22,
};

const sectionNavigation: CSSProperties = {
  display: "grid",
  gap: 14,
};

const sectionNavigationGroup: CSSProperties = {
  padding: 13,
  borderRadius: 15,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const sectionNavigationHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  marginBottom: 10,
};

const sectionNavigationTitle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  minWidth: 0,
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.4,
  fontWeight: 900,
};

const sectionIndexBadge: CSSProperties = {
  width: 23,
  height: 23,
  borderRadius: 7,
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  flexShrink: 0,
  background: "#e0e7ff",
  color: "#3730a3",
  fontSize: 12,
  fontWeight: 900,
};

const sectionProgressBadge: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#334155",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const sectionPartialText: CSSProperties = {
  margin: "-3px 0 9px",
  color: "#b45309",
  fontSize: 12,
  fontWeight: 800,
};
