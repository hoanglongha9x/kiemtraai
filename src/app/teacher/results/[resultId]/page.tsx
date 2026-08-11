"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Button, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase/client";
import MathContent from "@/components/common/MathContent";
import {
  getLearningAssessment,
  type LearningLevel,
} from "@/server/analytics/learningAssessment";

type SuspiciousEvent = {
  type: string;
  at: string;
};

type ResultDetail = {
  id: string;

  assignmentId?: string;
  assignmentCode?: string;

  testId: string;
  testTitle: string;
  subject: string;

  classId: string;
  className: string;

  studentId: string;
  studentCode: string;
  studentName: string;

  teacherEmail: string;
  teacherName: string;

  correctCount: number;
  totalQuestions: number;
  score: number;
  totalScore: number;

  duration?: number;
  durationMinutes?: number;
  timeSpentSeconds?: number;

  startedAt?: string;
  submittedAt?: string;
  createdAt?: string;

  status?: string;
  autoSubmit?: boolean;

  visibilityLostCount?: number;
  focusLostCount?: number;
  suspiciousEventCount?: number;
  hasSuspiciousActivity?: boolean;

  antiCheat?: {
    visibilityLostCount?: number;
    focusLostCount?: number;
    suspiciousEventCount?: number;
    suspiciousEvents?: SuspiciousEvent[];
  };
};

type AnswerKey = "A" | "B" | "C" | "D";

type QuestionDetail = {
  questionId: string;
  questionNumber: number;
  type?: "single_choice" | "true_false_group" | "short_answer" | string;

  question: string;
  questionImageId?: string;
  questionImageUrl?: string;

  topic?: string;
  knowledgeUnit?: string;
  skill?: string;
  learningOutcome?: string;
  cognitiveLevel?: string;
  difficulty?: string;
  explanation?: string;

  A: string;
  AImageId?: string;
  AImageUrl?: string;

  B: string;
  BImageId?: string;
  BImageUrl?: string;

  C: string;
  CImageId?: string;
  CImageUrl?: string;

  D: string;
  DImageId?: string;
  DImageUrl?: string;

  studentAnswer?: string;
  studentAnswerRaw?: Record<string, boolean> | string | null;
  correct?: string;
  correctRaw?: Record<string, boolean> | string | null;
  isCorrect?: boolean;
  isAnswered?: boolean;
  correctStatementCount?: number;
  totalStatementCount?: number;
};

type ResultDetailResponse = {
  status: "success";
  result: ResultDetail;
  questions: QuestionDetail[];
};

type LearningSummary = {
  key: string;
  label: string;
  subtitle: string;
  recommendation: string;
  topic: string;
  knowledgeUnit: string;
  skill: string;
  learningOutcome: string;
  cognitiveLevel: string;
  correctCount: number;
  questionCount: number;
  wrongCount: number;
  blankCount: number;
  correctRate: number;
  level: LearningLevel;
  levelLabel: string;
  confidenceLabel: string;
  evidenceLabel: string;
};

type LearningInsight = {
  title: string;
  value: string;
  description: string;
  tone: "danger" | "warning" | "success" | "neutral";
};

async function teacherApi<TResponse>(
  url: string,
  options: RequestInit = {}
): Promise<TResponse> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Bạn chưa đăng nhập.");
  }

  const token = await currentUser.getIdToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error("API không trả về JSON:", {
      url,
      status: response.status,
      text: text.slice(0, 500),
    });

    throw new Error(
      `API ${url} không trả về JSON. Status: ${response.status}.`
    );
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API.");
  }

  return data as TResponse;
}

function formatDate(value?: string) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN");
}

function formatTime(seconds?: number) {
  const total = Number(seconds || 0);

  if (!total) return "--";

  const minutes = Math.floor(total / 60);
  const remainSeconds = total % 60;

  return `${minutes} phút ${remainSeconds} giây`;
}

function getScoreColor(score: number, totalScore: number) {
  const ratio = totalScore > 0 ? score / totalScore : 0;

  if (ratio >= 0.8) return "#166534";
  if (ratio >= 0.5) return "#92400e";
  return "#991b1b";
}

function normalizeAnswer(answer?: string): AnswerKey | "" {
  if (answer === "A" || answer === "B" || answer === "C" || answer === "D") {
    return answer;
  }

  return "";
}

function getAnswerLabel(answer?: string) {
  const normalized = normalizeAnswer(answer);

  if (!normalized) return answer || "Bỏ trống";

  return normalized;
}

function readBooleanAnswer(
  value: QuestionDetail["studentAnswerRaw"],
  option: AnswerKey
): boolean | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const answer = value[option];

  return typeof answer === "boolean" ? answer : undefined;
}

function getTrueFalseLabel(value: boolean | undefined) {
  if (typeof value !== "boolean") return "Bỏ trống";
  return value ? "Đúng" : "Sai";
}

function hasTrueFalseStudentAnswer(question: QuestionDetail) {
  return (["A", "B", "C", "D"] as const).some(
    (option) => typeof readBooleanAnswer(question.studentAnswerRaw, option) === "boolean"
  );
}

function getOptionText(question: QuestionDetail, option: AnswerKey) {
  return question[option] || "";
}

function getOptionImageUrl(question: QuestionDetail, option: AnswerKey) {
  if (option === "A") return question.AImageUrl || "";
  if (option === "B") return question.BImageUrl || "";
  if (option === "C") return question.CImageUrl || "";
  return question.DImageUrl || "";
}

function cleanQuestionText(value?: string) {
  return String(value || "")
    .split("\n")
    .filter(
      (line) =>
        !/^\s*\[GHI CHÚ:\s*Cần chèn ảnh minh họa/i.test(line)
    )
    .join("\n")
    .replace(
      /\s*\[GHI CHÚ:\s*Cần chèn ảnh minh họa[^\]]*\]/gi,
      ""
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getQuestionStatus(question: QuestionDetail) {
  if (question.type === "true_false_group") {
    if (question.isCorrect) {
      return {
        label: "Đúng",
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (!hasTrueFalseStudentAnswer(question)) {
      return {
        label: "Bỏ trống",
        background: "#f1f5f9",
        color: "#475569",
      };
    }

    return {
      label: "Sai",
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  const studentAnswer = normalizeAnswer(question.studentAnswer);
  const correctAnswer = normalizeAnswer(question.correct);

  if (question.isCorrect) {
    return {
      label: "Đúng",
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (!question.studentAnswer) {
    return {
      label: "Bỏ trống",
      background: "#f1f5f9",
      color: "#475569",
    };
  }

  if (studentAnswer && correctAnswer && studentAnswer === correctAnswer) {
    return {
      label: "Đúng",
      background: "#dcfce7",
      color: "#166534",
    };
  }

  return {
    label: "Sai",
    background: "#fee2e2",
    color: "#991b1b",
  };
}

function getOptionStyle(question: QuestionDetail, option: AnswerKey) {
  const correctAnswer = normalizeAnswer(question.correct);
  const studentAnswer = normalizeAnswer(question.studentAnswer);

  const isCorrect = correctAnswer === option;
  const isStudentAnswer = studentAnswer === option;

  if (isCorrect && isStudentAnswer) {
    return {
      ...optionCard,
      borderColor: "#16a34a",
      background: "#dcfce7",
    };
  }

  if (isCorrect) {
    return {
      ...optionCard,
      borderColor: "#16a34a",
      background: "#f0fdf4",
    };
  }

  if (isStudentAnswer && !isCorrect) {
    return {
      ...optionCard,
      borderColor: "#dc2626",
      background: "#fee2e2",
    };
  }

  return optionCard;
}

function getEventLabel(type: string) {
  if (type === "visibility_hidden") return "Chuyển tab / ẩn màn hình";
  if (type === "window_blur") return "Mất focus cửa sổ";
  return type || "Sự kiện bất thường";
}

function formatMetadataValue(value?: string) {
  const labels: Record<string, string> = {
    recognition: "Nhận biết",
    comprehension: "Thông hiểu",
    application: "Vận dụng",
    high_application: "Vận dụng cao",
    easy: "Dễ",
    medium: "Trung bình",
    hard: "Khó",
  };

  return labels[value || ""] || value || "";
}

function getLearningLevelStyle(level: LearningLevel): CSSProperties {
  if (level === "good") return { background: "#dcfce7", color: "#166534" };
  if (level === "average") return { background: "#fef3c7", color: "#92400e" };
  if (level === "weak") return { background: "#ffedd5", color: "#9a3412" };
  if (level === "very_weak") return { background: "#fee2e2", color: "#991b1b" };
  return { background: "#f1f5f9", color: "#475569" };
}

function getInsightToneStyle(tone: LearningInsight["tone"]): CSSProperties {
  if (tone === "danger") {
    return {
      borderColor: "#fecaca",
      background: "#fef2f2",
    };
  }

  if (tone === "warning") {
    return {
      borderColor: "#fde68a",
      background: "#fffbeb",
    };
  }

  if (tone === "success") {
    return {
      borderColor: "#bbf7d0",
      background: "#f0fdf4",
    };
  }

  return {
    borderColor: "var(--ui-border)",
    background: "#f8fafc",
  };
}

function getDirectLearningLevel(correctRate: number): LearningLevel {
  if (correctRate >= 80) return "good";
  if (correctRate >= 60) return "average";
  if (correctRate >= 40) return "weak";
  return "very_weak";
}

function getDirectLearningLevelLabel(level: LearningLevel) {
  if (level === "good") return "Đã nắm tốt";
  if (level === "average") return "Cần củng cố";
  if (level === "weak") return "Yếu";
  if (level === "very_weak") return "Rất yếu";
  return "Chưa có dữ liệu";
}

function getConfidenceLabel(questionCount: number) {
  if (questionCount >= 5) return "Bằng chứng tốt";
  if (questionCount >= 3) return "Bằng chứng vừa";
  return "Bằng chứng mỏng";
}

function getQuestionAnswered(question: QuestionDetail) {
  if (question.type === "true_false_group") {
    return hasTrueFalseStudentAnswer(question);
  }

  return Boolean(String(question.studentAnswer || "").trim());
}

function getGroupRecommendation(summary: {
  label: string;
  learningOutcome: string;
  correctRate: number;
  wrongCount: number;
  blankCount: number;
}) {
  const target = summary.learningOutcome || summary.label;

  if (summary.correctRate >= 80) {
    return `Giữ nhịp bằng 1-2 câu vận dụng về ${target}.`;
  }

  if (summary.blankCount > 0 && summary.blankCount >= summary.wrongCount) {
    return `Cần ôn lại kiến thức nền của ${target}, sau đó làm lại các câu đã bỏ trống.`;
  }

  if (summary.correctRate >= 60) {
    return `Cho thêm bài luyện có nhiễu đáp án để củng cố ${target}.`;
  }

  if (summary.correctRate >= 40) {
    return `Luyện lại quy trình giải và yêu cầu học sinh giải thích từng bước cho ${target}.`;
  }

  return `Cần học lại từ đầu mục tiêu: ${target}. Nên có bài ôn riêng và kiểm tra lại sau khi luyện tập.`;
}

function buildLearningSummaries(
  questions: QuestionDetail[],
  getKey: (question: QuestionDetail) => string,
  getLabel: (question: QuestionDetail) => string,
  getSubtitle: (question: QuestionDetail) => string
): LearningSummary[] {
  const groups = new Map<
    string,
    {
      label: string;
      subtitle: string;
      topic: string;
      knowledgeUnit: string;
      skill: string;
      learningOutcome: string;
      cognitiveLevel: string;
      correctCount: number;
      questionCount: number;
      wrongCount: number;
      blankCount: number;
    }
  >();

  questions.forEach((question) => {
    const label = getLabel(question);

    if (!label) return;

    const key = getKey(question);
    const current = groups.get(key) || {
      label,
      subtitle: getSubtitle(question),
      topic: question.topic || question.knowledgeUnit || "",
      knowledgeUnit: question.knowledgeUnit || "",
      skill: question.skill || "",
      learningOutcome: question.learningOutcome || "",
      cognitiveLevel: question.cognitiveLevel || "",
      correctCount: 0,
      questionCount: 0,
      wrongCount: 0,
      blankCount: 0,
    };

    current.questionCount += 1;
    current.correctCount += question.isCorrect ? 1 : 0;
    current.blankCount += getQuestionAnswered(question) ? 0 : 1;
    current.wrongCount += !question.isCorrect && getQuestionAnswered(question) ? 1 : 0;

    if (!current.learningOutcome && question.learningOutcome) {
      current.learningOutcome = question.learningOutcome;
    }

    if (!current.cognitiveLevel && question.cognitiveLevel) {
      current.cognitiveLevel = question.cognitiveLevel;
    }

    if (!current.subtitle) {
      current.subtitle = getSubtitle(question);
    }

    groups.set(key, current);
  });

  const levelOrder: Record<LearningLevel, number> = {
    very_weak: 0,
    weak: 1,
    average: 2,
    good: 3,
    no_data: 4,
  };

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const correctRate = group.questionCount
        ? (group.correctCount / group.questionCount) * 100
        : 0;
      const evidence = getLearningAssessment({
        correctRate,
        questionCount: group.questionCount,
        responseCount: group.questionCount,
      });
      const level = getDirectLearningLevel(correctRate);

      return {
        key,
        ...group,
        correctRate,
        level,
        levelLabel: getDirectLearningLevelLabel(level),
        confidenceLabel:
          evidence.eligible
            ? evidence.confidenceLabel
            : getConfidenceLabel(group.questionCount),
        evidenceLabel: `${group.questionCount} câu, ${group.correctCount} đúng, ${group.wrongCount} sai, ${group.blankCount} bỏ trống`,
        recommendation: getGroupRecommendation({
          label: group.label,
          learningOutcome: group.learningOutcome,
          correctRate,
          wrongCount: group.wrongCount,
          blankCount: group.blankCount,
        }),
      };
    })
    .sort(
      (a, b) =>
        levelOrder[a.level] - levelOrder[b.level] ||
        a.correctRate - b.correctRate
    );
}

function buildTopicSummaries(questions: QuestionDetail[]) {
  return buildLearningSummaries(
    questions,
    (question) => question.topic || question.knowledgeUnit || "Chưa phân loại",
    (question) => question.topic || question.knowledgeUnit || "Chưa phân loại",
    (question) =>
      [question.knowledgeUnit, question.skill]
        .filter(Boolean)
        .join(" · ")
  );
}

function buildSkillSummaries(questions: QuestionDetail[]) {
  return buildLearningSummaries(
    questions,
    (question) =>
      `${question.skill || "Chưa gắn kỹ năng"}|${question.learningOutcome || ""}|${question.cognitiveLevel || ""}`,
    (question) => question.skill || question.knowledgeUnit || question.topic || "Chưa gắn kỹ năng",
    (question) =>
      [question.topic, question.knowledgeUnit]
        .filter(Boolean)
        .join(" · ")
  );
}

function buildQuestionRecommendation(question: QuestionDetail) {
  if (question.isCorrect) {
    return "Làm đúng. Có thể giao thêm câu cùng kỹ năng ở mức vận dụng cao hơn.";
  }

  const target =
    question.learningOutcome ||
    question.skill ||
    question.knowledgeUnit ||
    question.topic ||
    `câu ${question.questionNumber}`;

  if (!getQuestionAnswered(question)) {
    return `Bỏ trống. Cần kiểm tra lại kiến thức nền và yêu cầu học sinh làm lại ${target}.`;
  }

  if (question.type === "true_false_group") {
    return `Sai ở một hoặc nhiều mệnh đề. Nên yêu cầu học sinh giải thích Đúng/Sai từng mệnh đề của ${target}.`;
  }

  return `Trả lời sai. Cần phân tích lỗi chọn đáp án và luyện lại mục tiêu: ${target}.`;
}

function buildLearningInsights(
  questions: QuestionDetail[],
  skillSummaries: LearningSummary[]
): LearningInsight[] {
  const wrongQuestions = questions.filter((question) => !question.isCorrect);
  const blankQuestions = questions.filter((question) => !getQuestionAnswered(question));
  const weakSkills = skillSummaries.filter(
    (summary) => summary.level === "very_weak" || summary.level === "weak"
  );
  const strongSkills = skillSummaries.filter((summary) => summary.level === "good");

  return [
    {
      title: "Ưu tiên can thiệp",
      value: weakSkills[0]?.label || "Chưa có",
      description:
        weakSkills[0]?.recommendation ||
        "Chưa phát hiện kỹ năng yếu nổi bật trong bài này.",
      tone: weakSkills.length > 0 ? "danger" : "success",
    },
    {
      title: "Câu cần chữa ngay",
      value: `${wrongQuestions.length}/${questions.length}`,
      description:
        wrongQuestions.length > 0
          ? `Bắt đầu từ câu ${wrongQuestions
              .slice(0, 5)
              .map((question) => question.questionNumber)
              .join(", ")}.`
          : "Học sinh làm đúng toàn bộ câu hỏi.",
      tone: wrongQuestions.length > 0 ? "warning" : "success",
    },
    {
      title: "Bỏ trống",
      value: `${blankQuestions.length} câu`,
      description:
        blankQuestions.length > 0
          ? "Có dấu hiệu thiếu tự tin hoặc thiếu thời gian ở các câu bỏ trống."
          : "Không có câu bỏ trống.",
      tone: blankQuestions.length > 0 ? "warning" : "success",
    },
    {
      title: "Điểm mạnh",
      value: strongSkills[0]?.label || "Đang hình thành",
      description:
        strongSkills[0]?.recommendation ||
        "Cần thêm dữ liệu hoặc thêm câu hỏi để xác định điểm mạnh rõ hơn.",
      tone: strongSkills.length > 0 ? "success" : "neutral",
    },
  ];
}

export default function ResultDetailPage() {
  const params = useParams();
  const router = useRouter();

  const resultId = String(params?.resultId || "");

  const [user, setUser] = useState<User | null>(null);
  const [result, setResult] = useState<ResultDetail | null>(null);
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser?.email) {
        setMessage("Vui lòng đăng nhập Google trước.");
        setLoading(false);
        return;
      }

      await loadDetail();
      setLoading(false);
    });

    return () => unsub();
  }, [resultId]);

  async function loadDetail() {
    if (!resultId) {
      setMessage("Thiếu resultId.");
      return;
    }

    try {
      setMessage("Đang tải chi tiết bài làm...");

      const data = await teacherApi<ResultDetailResponse>(
        `/api/teacher/results/detail?resultId=${encodeURIComponent(resultId)}`,
        {
          method: "GET",
        }
      );

      setResult(data.result);
      setQuestions(data.questions || []);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Không tải được chi tiết bài làm.");
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={loadingState}>
          <span>Đang tải chi tiết bài làm...</span>
        </section>
      </main>
    );
  }

  if (!result) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1>Không có dữ liệu</h1>

          <p style={subText}>{message || "Không tìm thấy bài làm."}</p>

          <Button
            variant="secondary"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => router.push("/teacher/results")}
          >
            Quay lại kết quả
          </Button>
        </section>
      </main>
    );
  }

  const score = Number(result.score || 0);
  const totalScore = Number(result.totalScore || 10);
  const suspiciousEventCount = Number(
    result.suspiciousEventCount ||
      Number(result.visibilityLostCount || 0) + Number(result.focusLostCount || 0)
  );
  const visibilityLostCount = Number(result.visibilityLostCount || 0);
  const focusLostCount = Number(result.focusLostCount || 0);
  const suspiciousEvents = result.antiCheat?.suspiciousEvents || [];
  const topicSummaries = buildTopicSummaries(questions);
  const skillSummaries = buildSkillSummaries(questions);
  const learningInsights = buildLearningInsights(
    questions,
    skillSummaries
  );
  const metadataQuestionCount = questions.filter(
    (question) => question.skill || question.knowledgeUnit || question.topic
  ).length;

  return (
    <main style={pageStyle}>
      <PageHeader
        eyebrow="BÁO CÁO"
        title="Chi tiết bài làm"
        description="Xem điểm số, đáp án học sinh đã chọn, đáp án đúng và cảnh báo trong quá trình làm bài."
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => router.push("/teacher/results")}
            >
              Quay lại
            </Button>
            <Button
              variant="outline"
              leftIcon={<RefreshCw size={16} />}
              onClick={loadDetail}
            >
              Làm mới
            </Button>
          </>
        }
      />

      {message && (
        <div
          style={{
            ...messageStyle,
            background:
              message.includes("Đang") || message.includes("Đã")
                ? "#dbeafe"
                : "#fee2e2",
            color:
              message.includes("Đang") || message.includes("Đã")
                ? "#1e40af"
                : "#991b1b",
          }}
        >
          {message}
        </div>
      )}

      <section style={statGrid}>
        <div style={statCard}>
          <p style={statLabel}>Điểm</p>
          <h2
            style={{
              ...statNumber,
              color: getScoreColor(score, totalScore),
            }}
          >
            {score}/{totalScore}
          </h2>
        </div>

        <div style={statCard}>
          <p style={statLabel}>Số câu đúng</p>
          <h2 style={statNumber}>
            {result.correctCount}/{result.totalQuestions}
          </h2>
        </div>

        <div style={statCard}>
          <p style={statLabel}>Thời gian làm</p>
          <h2 style={statNumberSmall}>
            {formatTime(result.timeSpentSeconds)}
          </h2>
        </div>

        <div style={statCard}>
          <p style={statLabel}>Hình thức nộp</p>
          <h2 style={statNumberSmall}>
            {result.autoSubmit ? "Tự động" : "Thủ công"}
          </h2>
        </div>

        <div style={statCard}>
          <p style={statLabel}>Rời màn hình</p>
          <h2
            style={{
              ...statNumberSmall,
              color: suspiciousEventCount > 0 ? "#991b1b" : "#166534",
            }}
          >
            {suspiciousEventCount} lần
          </h2>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Tổng quan học tập</h2>
            <p style={subText}>
              Các điểm cần can thiệp trước, tự động rút ra từ chủ đề, kỹ năng
              và từng câu trong bài làm.
            </p>
          </div>

          <span style={codeBadge}>
            {metadataQuestionCount}/{questions.length} câu có nhãn
          </span>
        </div>

        {skillSummaries.length === 0 && topicSummaries.length === 0 ? (
          <div style={metadataWarning}>
            Đề này chưa có nhãn kỹ năng, đơn vị kiến thức hoặc chủ đề. Hãy bổ
            sung metadata trong ngân hàng câu hỏi để hệ thống phân tích được
            năng lực học sinh.
          </div>
        ) : (
          <div style={insightGrid}>
            {learningInsights.map((insight) => (
              <div
                key={insight.title}
                style={{
                  ...insightCard,
                  ...getInsightToneStyle(insight.tone),
                }}
              >
                <span style={infoLabel}>{insight.title}</span>
                <b style={insightValue}>{insight.value}</b>
                <p style={insightDescription}>{insight.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Phân tích theo chủ đề</h2>
            <p style={subText}>
              Nhìn nhanh chủ đề nào đang mất điểm, chủ đề nào đã ổn và mức độ
              tin cậy của từng nhận định.
            </p>
          </div>

          <span style={codeBadge}>{topicSummaries.length} chủ đề</span>
        </div>

        {topicSummaries.length === 0 ? (
          <div style={metadataWarning}>
            Chưa có nhãn chủ đề hoặc đơn vị kiến thức để phân tích.
          </div>
        ) : (
          <div style={learningTableWrap}>
            <table style={learningTable}>
              <thead>
                <tr>
                  <th style={tableHeaderCell}>Chủ đề</th>
                  <th style={tableHeaderCell}>Số câu</th>
                  <th style={tableHeaderCell}>Đúng</th>
                  <th style={tableHeaderCell}>Sai</th>
                  <th style={tableHeaderCell}>Bỏ trống</th>
                  <th style={tableHeaderCell}>Tỉ lệ đúng</th>
                  <th style={tableHeaderCell}>Đánh giá</th>
                  <th style={tableHeaderCell}>Gợi ý</th>
                </tr>
              </thead>
              <tbody>
                {topicSummaries.map((summary) => (
                  <tr key={summary.key}>
                    <td style={tableCell}>
                      <b>{summary.label}</b>
                      {summary.subtitle && <div style={smallText}>{summary.subtitle}</div>}
                      <div style={smallText}>{summary.confidenceLabel}</div>
                    </td>
                    <td style={tableCell}>
                      <b>{summary.questionCount}</b>
                    </td>
                    <td style={tableCell}>{summary.correctCount}</td>
                    <td style={tableCell}>{summary.wrongCount}</td>
                    <td style={tableCell}>{summary.blankCount}</td>
                    <td style={tableCell}>
                      <b>{Math.round(summary.correctRate)}%</b>
                      <div style={progressTrack}>
                        <span
                          style={{
                            ...progressFill,
                            width: `${Math.round(summary.correctRate)}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td style={tableCell}>
                      <span
                        style={{
                          ...learningBadge,
                          ...getLearningLevelStyle(summary.level),
                        }}
                      >
                        {summary.levelLabel}
                      </span>
                    </td>
                    <td style={tableCell}>
                      <div style={recommendationText}>{summary.recommendation}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Phân tích theo kỹ năng</h2>
            <p style={subText}>
              Dùng để lập kế hoạch chữa bài, giao bài bù và theo dõi mục tiêu
              cần đạt của từng học sinh.
            </p>
          </div>

          <span style={codeBadge}>{skillSummaries.length} kỹ năng</span>
        </div>

        {skillSummaries.length === 0 ? (
          <div style={metadataWarning}>
            Chưa có nhãn kỹ năng hoặc yêu cầu cần đạt để phân tích.
          </div>
        ) : (
          <div style={learningTableWrap}>
            <table style={learningTable}>
              <thead>
                <tr>
                  <th style={tableHeaderCell}>Kỹ năng</th>
                  <th style={tableHeaderCell}>Mục tiêu cần đạt</th>
                  <th style={tableHeaderCell}>Mức nhận thức</th>
                  <th style={tableHeaderCell}>Kết quả</th>
                  <th style={tableHeaderCell}>Đánh giá</th>
                  <th style={tableHeaderCell}>Gợi ý</th>
                </tr>
              </thead>
              <tbody>
                {skillSummaries.map((summary) => (
                  <tr key={summary.key}>
                    <td style={tableCell}>
                      <b>{summary.label}</b>
                      {summary.subtitle && <div style={smallText}>{summary.subtitle}</div>}
                    </td>
                    <td style={tableCell}>
                      {summary.learningOutcome || "--"}
                    </td>
                    <td style={tableCell}>
                      {formatMetadataValue(summary.cognitiveLevel) || "--"}
                    </td>
                    <td style={tableCell}>
                      <b>{Math.round(summary.correctRate)}%</b>
                      <div style={smallText}>{summary.evidenceLabel}</div>
                    </td>
                    <td style={tableCell}>
                      <span
                        style={{
                          ...learningBadge,
                          ...getLearningLevelStyle(summary.level),
                        }}
                      >
                        {summary.levelLabel}
                      </span>
                      <div style={smallText}>{summary.confidenceLabel}</div>
                    </td>
                    <td style={tableCell}>
                      <div style={recommendationText}>{summary.recommendation}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Thông tin bài làm</h2>
            <p style={subText}>Thông tin học sinh, đề kiểm tra và mã giao đề.</p>
          </div>

          <span style={codeBadge}>{result.assignmentCode || "--"}</span>
        </div>

        <div style={infoGrid}>
          <div style={infoItem}>
            <span style={infoLabel}>Học sinh</span>
            <b>{result.studentName || "--"}</b>
            <span style={smallText}>{result.studentCode || "--"}</span>
          </div>

          <div style={infoItem}>
            <span style={infoLabel}>Lớp</span>
            <b>{result.className || "--"}</b>
          </div>

          <div style={infoItem}>
            <span style={infoLabel}>Đề kiểm tra</span>
            <b>{result.testTitle || "--"}</b>
            <span style={smallText}>{result.subject || "--"}</span>
          </div>

          <div style={infoItem}>
            <span style={infoLabel}>Giáo viên</span>
            <b>{result.teacherName || "--"}</b>
            <span style={smallText}>{result.teacherEmail || "--"}</span>
          </div>

          <div style={infoItem}>
            <span style={infoLabel}>Bắt đầu</span>
            <b>{formatDate(result.startedAt)}</b>
          </div>

          <div style={infoItem}>
            <span style={infoLabel}>Nộp lúc</span>
            <b>{formatDate(result.submittedAt || result.createdAt)}</b>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Cảnh báo trong quá trình làm bài</h2>

            <p style={subText}>
              Hệ thống chỉ ghi nhận dấu hiệu bất thường để giáo viên tham khảo,
              không tự kết luận gian lận.
            </p>
          </div>

          {suspiciousEventCount > 0 ? (
            <span style={dangerBadge}>Có dấu hiệu bất thường</span>
          ) : (
            <span style={successBadge}>Bình thường</span>
          )}
        </div>

        <div style={infoGrid}>
          <div style={infoItem}>
            <span style={infoLabel}>Chuyển tab / ẩn màn hình</span>
            <b>{visibilityLostCount}</b>
          </div>

          <div style={infoItem}>
            <span style={infoLabel}>Mất focus cửa sổ</span>
            <b>{focusLostCount}</b>
          </div>

          <div style={infoItem}>
            <span style={infoLabel}>Tổng số cảnh báo</span>
            <b>{suspiciousEventCount}</b>
          </div>
        </div>

        {suspiciousEvents.length > 0 && (
          <div style={eventListBox}>
            <h3 style={eventTitle}>Lịch sử cảnh báo</h3>

            {suspiciousEvents.map((event, index) => (
              <div key={`${event.type}-${event.at}-${index}`} style={eventItem}>
                <b>
                  {index + 1}. {getEventLabel(event.type)}
                </b>

                <div style={smallText}>{formatDate(event.at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Phân tích từng câu hỏi</h2>

            <p style={subText}>
              Màu xanh là đáp án đúng. Màu đỏ là đáp án học sinh chọn sai.
            </p>
          </div>

          <span style={codeBadge}>{questions.length} câu</span>
        </div>

        {questions.length === 0 ? (
          <p style={subText}>Không có câu hỏi để hiển thị.</p>
        ) : (
          <div style={questionList}>
            {questions.map((question, index) => {
              const status = getQuestionStatus(question);
              const metadataItems = [
                question.topic && `Chủ đề: ${question.topic}`,
                question.knowledgeUnit && `Đơn vị kiến thức: ${question.knowledgeUnit}`,
                question.skill && `Kỹ năng: ${question.skill}`,
                question.cognitiveLevel &&
                  `Nhận thức: ${formatMetadataValue(question.cognitiveLevel)}`,
                question.difficulty &&
                  `Độ khó: ${formatMetadataValue(question.difficulty)}`,
              ].filter(Boolean) as string[];

              return (
                <div
                  key={`${question.questionId}-${question.questionNumber}-${index}`}
                  style={questionCard}
                >
                  <div style={questionHeader}>
                    <div>
                      <h3 style={questionTitle}>
                        Câu {question.questionNumber}
                      </h3>

                      <div style={answerSummary}>
                        {question.type === "true_false_group" ? (
                          <>
                            <span>
                              Mệnh đề đúng:{" "}
                              <b>
                                {question.correctStatementCount ?? 0}/
                                {question.totalStatementCount || 4}
                              </b>
                            </span>

                            <span>Xem chi tiết Đúng/Sai từng mệnh đề bên dưới.</span>
                          </>
                        ) : (
                          <>
                            <span>
                              Học sinh trả lời:{" "}
                              <b>{getAnswerLabel(question.studentAnswer)}</b>
                            </span>

                            <span>
                              Đáp án đúng: <b>{question.correct || "--"}</b>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        ...resultBadge,
                        background: status.background,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  {metadataItems.length > 0 && (
                    <div style={questionMetadata}>
                      {metadataItems.map((item) => (
                        <span key={item} style={metadataTag}>
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {question.learningOutcome && (
                    <div style={learningOutcomeBox}>
                      <b>Yêu cầu cần đạt</b>
                      <span>{question.learningOutcome}</span>
                    </div>
                  )}

                  <div style={questionContent}>
                    <MathContent text={cleanQuestionText(question.question)} />
                  </div>

                  {question.questionImageUrl && (
                    <img
                      src={question.questionImageUrl}
                      alt={`Câu ${question.questionNumber}`}
                      style={questionImage}
                    />
                  )}

                  {question.type === "true_false_group" ? (
                    <div style={optionsGrid}>
                      {(["A", "B", "C", "D"] as const).map((option) => {
                        const optionText = getOptionText(question, option);
                        const optionImageUrl = getOptionImageUrl(question, option);
                        const studentValue = readBooleanAnswer(
                          question.studentAnswerRaw,
                          option
                        );
                        const correctValue = readBooleanAnswer(
                          question.correctRaw,
                          option
                        );
                        const isStatementCorrect =
                          typeof studentValue === "boolean" &&
                          typeof correctValue === "boolean" &&
                          studentValue === correctValue;
                        const isAnswered = typeof studentValue === "boolean";

                        return (
                          <div
                            key={option}
                            style={{
                              ...optionCard,
                              borderColor: isStatementCorrect
                                ? "#16a34a"
                                : isAnswered
                                  ? "#dc2626"
                                  : "#e5e7eb",
                              background: isStatementCorrect
                                ? "#f0fdf4"
                                : isAnswered
                                  ? "#fef2f2"
                                  : "white",
                            }}
                          >
                            <div style={optionHeader}>
                              <b>{option}.</b>
                              <span style={studentTag}>
                                HS: {getTrueFalseLabel(studentValue)}
                              </span>
                              <span style={correctTag}>
                                Đáp án: {getTrueFalseLabel(correctValue)}
                              </span>
                            </div>

                            <MathContent text={optionText || "--"} />

                            {optionImageUrl && (
                              <img
                                src={optionImageUrl}
                                alt={`Mệnh đề ${option}`}
                                style={optionImage}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : question.type === "short_answer" ? (
                    <div style={shortAnswerGrid}>
                      <div style={shortAnswerItem}>
                        <span style={infoLabel}>Học sinh trả lời</span>
                        <MathContent text={question.studentAnswer || "Bỏ trống"} />
                      </div>
                      <div style={{ ...shortAnswerItem, borderColor: "#86efac" }}>
                        <span style={infoLabel}>Đáp án chấp nhận</span>
                        <MathContent text={question.correct || "--"} />
                      </div>
                    </div>
                  ) : (
                    <div style={optionsGrid}>
                      {(["A", "B", "C", "D"] as const).map((option) => {
                        const optionText = getOptionText(question, option);
                        const optionImageUrl = getOptionImageUrl(question, option);
                        const isCorrect = normalizeAnswer(question.correct) === option;
                        const isStudentAnswer =
                          normalizeAnswer(question.studentAnswer) === option;

                        return (
                          <div
                            key={option}
                            style={getOptionStyle(question, option)}
                          >
                            <div style={optionHeader}>
                              <b>{option}.</b>

                              {isCorrect && (
                                <span style={correctTag}>Đáp án đúng</span>
                              )}

                              {isStudentAnswer && (
                                <span
                                  style={{
                                    ...studentTag,
                                    background: isCorrect ? "#bbf7d0" : "#fecaca",
                                    color: isCorrect ? "#166534" : "#991b1b",
                                  }}
                                >
                                  HS chọn
                                </span>
                              )}
                            </div>

                            <MathContent text={optionText || "--"} />

                            {optionImageUrl && (
                              <img
                                src={optionImageUrl}
                                alt={`Đáp án ${option}`}
                                style={optionImage}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={questionRecommendationBox}>
                    <b>Gợi ý xử lý</b>
                    <span>{buildQuestionRecommendation(question)}</span>
                  </div>

                  {question.explanation && (
                    <div style={explanationBox}>
                      <b>Lời giải và phản hồi</b>
                      <MathContent text={question.explanation} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  display: "grid",
  gap: 22,
  paddingBottom: 40,
  color: "var(--ui-text)",
};

const loadingState: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 18,
  border: "1px solid var(--ui-border)",
  borderRadius: 16,
  background: "var(--ui-surface)",
  color: "#334155",
  fontSize: 14,
  fontWeight: 850,
};

const cardStyle: CSSProperties = {
  background: "var(--ui-surface)",
  padding: 18,
  borderRadius: 17,
  border: "1px solid var(--ui-border)",
  boxShadow: "var(--ui-shadow-sm)",
  overflow: "hidden",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const messageStyle: CSSProperties = {
  padding: "13px 15px",
  borderRadius: 13,
  fontWeight: "bold",
};

const statGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
};

const statCard: CSSProperties = {
  display: "grid",
  gap: 8,
  minHeight: 108,
  background: "var(--ui-surface)",
  padding: 18,
  borderRadius: 16,
  border: "1px solid var(--ui-border)",
  boxShadow: "var(--ui-shadow-sm)",
  overflow: "hidden",
  minWidth: 0,
};

const statLabel: CSSProperties = {
  color: "#64748b",
  margin: 0,
  fontWeight: 800,
};

const statNumber: CSSProperties = {
  margin: 0,
  color: "var(--ui-primary)",
  fontSize: 30,
  fontWeight: 950,
  lineHeight: 1,
};

const statNumberSmall: CSSProperties = {
  margin: 0,
  color: "var(--ui-primary)",
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1.15,
};

const sectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  marginBottom: 18,
  flexWrap: "wrap",
};

const sectionTitle: CSSProperties = {
  color: "var(--ui-text)",
  fontSize: 18,
  fontWeight: 950,
  margin: "0 0 4px",
};

const subText: CSSProperties = {
  color: "#64748b",
  lineHeight: 1.5,
  fontSize: 14,
  margin: 0,
};

const smallText: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.6,
  marginTop: 4,
};

const secondaryBtn: CSSProperties = {
  padding: "13px 16px",
  borderRadius: 14,
  border: "none",
  background: "#64748b",
  color: "white",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
};

const codeBadge: CSSProperties = {
  padding: "7px 11px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#1e40af",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
};

const infoItem: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid var(--ui-border)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const infoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const metadataWarning: CSSProperties = {
  padding: 14,
  border: "1px solid #fcd34d",
  borderRadius: 10,
  background: "#fffbeb",
  color: "#92400e",
  fontSize: 14,
  lineHeight: 1.6,
};

const insightGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const insightCard: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 16,
  borderRadius: 14,
  border: "1px solid var(--ui-border)",
  minHeight: 132,
};

const insightValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  lineHeight: 1.25,
};

const insightDescription: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.55,
};

const learningTableWrap: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const learningTable: CSSProperties = {
  width: "100%",
  minWidth: 720,
  borderCollapse: "collapse",
  fontSize: 14,
};

const tableHeaderCell: CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  color: "#475569",
  borderBottom: "1px solid var(--ui-border)",
  background: "#f8fafc",
};

const tableCell: CSSProperties = {
  padding: 12,
  textAlign: "left",
  verticalAlign: "top",
  borderBottom: "1px solid var(--ui-border)",
};

const learningBadge: CSSProperties = {
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const learningOutcomeText: CSSProperties = {
  marginTop: 6,
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.5,
};

const recommendationText: CSSProperties = {
  color: "#334155",
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 420,
};

const progressTrack: CSSProperties = {
  position: "relative",
  width: 120,
  maxWidth: "100%",
  height: 8,
  marginTop: 8,
  borderRadius: 999,
  background: "#e5e7eb",
  overflow: "hidden",
};

const progressFill: CSSProperties = {
  position: "absolute",
  inset: 0,
  right: "auto",
  borderRadius: 999,
  background: "#2563eb",
};

const questionList: CSSProperties = {
  display: "grid",
  gap: 18,
};

const questionCard: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid var(--ui-border)",
  background: "#f8fafc",
};

const questionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 14,
  flexWrap: "wrap",
};

const questionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 18,
  fontWeight: 950,
};

const questionMetadata: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 12,
};

const metadataTag: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 7,
  background: "#e0f2fe",
  color: "#075985",
  fontSize: 12,
  fontWeight: 800,
};

const learningOutcomeBox: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  marginBottom: 12,
  borderLeft: "3px solid #0284c7",
  background: "#f0f9ff",
  color: "#0c4a6e",
  fontSize: 13,
  lineHeight: 1.5,
};

const answerSummary: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  color: "#475569",
  fontSize: 14,
};

const resultBadge: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const questionContent: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: "white",
  border: "1px solid var(--ui-border)",
  marginBottom: 12,
};

const questionImage: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 360,
  objectFit: "contain",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "white",
  marginBottom: 12,
};

const optionImage: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 220,
  objectFit: "contain",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "white",
  marginTop: 8,
};

const optionsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const shortAnswerGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const shortAnswerItem: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 14,
  borderRadius: 10,
  background: "white",
  border: "1px solid var(--ui-border)",
};

const explanationBox: CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 12,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  lineHeight: 1.6,
};

const questionRecommendationBox: CSSProperties = {
  display: "grid",
  gap: 6,
  marginTop: 12,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#9a3412",
  lineHeight: 1.6,
};

const optionCard: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "white",
  border: "1px solid var(--ui-border)",
};

const optionHeader: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 8,
};

const correctTag: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "#bbf7d0",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
};

const studentTag: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const dangerBadge: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const successBadge: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const eventListBox: CSSProperties = {
  marginTop: 18,
  padding: 16,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
};

const eventTitle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 18,
  fontWeight: 900,
};

const eventItem: CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #e5e7eb",
};
