"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  BarChart3,
  Download,
  Eye,
  Filter,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import { Button, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase/client";

type TestItem = {
  id: string;
  title: string;
  subject: string;
  duration?: number;
  durationMinutes?: number;
  totalScore?: number;
  questionCount?: number;
  status?: string;
  createdAt?: string;
};

type ClassItem = {
  id: string;
  className: string;
  grade: string;
  schoolYear: string;
  status: "active" | "locked" | "deleted";
};

type ResultItem = {
  id: string;

  assignmentId?: string;
  assignmentCode?: string;

  testId: string;
  testTitle: string;

  classIds?: string[];
  classNames?: string[];
  classCount?: number;

  classId: string;
  className: string;
  subject: string;

  studentId: string;
  studentCode: string;
  studentName: string;

  correctCount: number;
  totalQuestions: number;
  score: number;
  totalScore: number;

  duration?: number;
  durationMinutes?: number;
  timeSpentSeconds?: number;
  submittedAt?: string;
  createdAt?: string;
  status?: string;
  autoSubmit?: boolean;

  visibilityLostCount?: number;
  focusLostCount?: number;
  suspiciousEventCount?: number;
  hasSuspiciousActivity?: boolean;
};

type ResultsSummary = {
  totalSubmits: number;
  averageScore: number;
  passedCount: number;
};

type TeacherTestsResponse = {
  status: "success";
  tests: TestItem[];
};

type TeacherClassesResponse = {
  status: "success";
  classes: ClassItem[];
};

type TeacherResultsResponse = {
  status: "success";
  results: ResultItem[];
  summary: ResultsSummary;
};

type LearningLevel = "good" | "average" | "weak" | "very_weak" | "no_data";

type QuestionAnalysisItem = {
  questionId: string;
  questionNumber: number;

  question: string;
  A: string;
  B: string;
  C: string;
  D: string;
  correct: string;

  subject?: string;
  grade?: string;
  topic?: string;
  knowledgeUnit?: string;
  skill?: string;
  learningOutcome?: string;
  cognitiveLevel?: string;
  difficulty?: string;

  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  correctRate: number;
  wrongRate: number;

  level: string;
  learningLevel?: LearningLevel;
  recommendation?: string;
};

type GroupAnalysisItem = {
  key: string;

  subject: string;
  grade: string;
  topic: string;
  knowledgeUnit: string;
  skill: string;
  learningOutcome: string;
  cognitiveLevel: string;
  difficulty: string;

  totalQuestions: number;
  totalAnswers: number;
  correctAnswers: number;
  wrongAnswers: number;
  blankAnswers: number;

  correctRate: number;
  wrongRate: number;

  level: LearningLevel;
  levelLabel: string;
  evidenceCount: number;
  evidenceLabel: string;
  confidence: "insufficient" | "low" | "medium" | "high";
  confidenceLabel: string;
  classificationEligible: boolean;
  recommendations: string[];
};

type StudentWeaknessItem = {
  resultId: string;

  studentName: string;
  studentCode: string;
  className: string;
  classId: string;

  score: number;
  percentage: number;
  averagePercentage: number;
  attemptCount: number;
  trendPercentagePoints: number | null;
  evidenceQuestionCount: number;

  weakTopics: string[];
  weakSkills: string[];
  strongTopics: string[];
  strongSkills: string[];

  recommendations: string[];
};

type ClassRecommendationReport = {
  weakSkillCount: number;
  prioritySkills: {
    subject: string;
    topic: string;
    knowledgeUnit: string;
    skill: string;
    learningOutcome: string;
    correctRate: number;
    level: LearningLevel;
    levelLabel: string;
    evidenceLabel: string;
    confidenceLabel: string;
  }[];
  recommendations: string[];
};

type QuestionAnalysisResponse = {
  status: "success";
  test: {
    id: string;
    title: string;
    subject: string;
    grade?: string;
    questionCount: number;
  };
  summary: {
    totalSubmits: number;
    totalQuestions: number;
    totalTopics?: number;
    totalSkills?: number;
    weakSkillCount?: number;
    averagePercent?: number;
    medianPercent?: number;
    highestPercent?: number;
    lowestPercent?: number;
    passRate?: number;
    scoreDistribution?: {
      label: string;
      count: number;
      percent: number;
    }[];
    metadataCompleteness?: {
      totalQuestions: number;
      labeledTopicQuestions: number;
      missingTopicQuestions: number;
      labeledSkillQuestions: number;
      missingSkillQuestions: number;
      labeledCognitiveLevelQuestions: number;
      missingCognitiveLevelQuestions: number;
    };
  };
  hardestQuestions: QuestionAnalysisItem[];
  analysis: QuestionAnalysisItem[];

  topicAnalysis?: GroupAnalysisItem[];
  skillAnalysis?: GroupAnalysisItem[];
  studentWeaknessAnalysis?: StudentWeaknessItem[];
  classRecommendations?: ClassRecommendationReport;
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

  if (Number.isNaN(date.getTime())) {
    return value;
  }

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

function escapeCsv(value: unknown) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function getLearningLevelStyle(level?: string): CSSProperties {
  if (level === "good") {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (level === "average") {
    return {
      background: "#fef9c3",
      color: "#854d0e",
    };
  }

  if (level === "weak") {
    return {
      background: "#ffedd5",
      color: "#9a3412",
    };
  }

  if (level === "very_weak") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
  };
}

function getLearningLevelLabel(level?: string) {
  if (level === "good") return "Tốt";
  if (level === "average") return "Cần củng cố";
  if (level === "weak") return "Yếu";
  if (level === "very_weak") return "Rất yếu";
  return "Chưa có dữ liệu";
}

function getCognitiveLevelLabel(value?: string) {
  if (value === "recognition") return "Nhận biết";
  if (value === "understanding") return "Thông hiểu";
  if (value === "application") return "Vận dụng";
  if (value === "high_application") return "Vận dụng cao";
  return value || "--";
}

function compactList(items: string[]) {
  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

export default function TeacherResultsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [tests, setTests] = useState<TestItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);

  const [analysis, setAnalysis] = useState<QuestionAnalysisItem[]>([]);
  const [hardestQuestions, setHardestQuestions] = useState<
    QuestionAnalysisItem[]
  >([]);

  const [topicAnalysis, setTopicAnalysis] = useState<GroupAnalysisItem[]>([]);
  const [skillAnalysis, setSkillAnalysis] = useState<GroupAnalysisItem[]>([]);
  const [studentWeaknessAnalysis, setStudentWeaknessAnalysis] = useState<
    StudentWeaknessItem[]
  >([]);

  const [classRecommendations, setClassRecommendations] =
    useState<ClassRecommendationReport>({
      weakSkillCount: 0,
      prioritySkills: [],
      recommendations: [],
    });

  const [analysisSummary, setAnalysisSummary] = useState({
    totalSubmits: 0,
    totalQuestions: 0,
    totalTopics: 0,
    totalSkills: 0,
    weakSkillCount: 0,
    averagePercent: 0,
    medianPercent: 0,
    highestPercent: 0,
    lowestPercent: 0,
    passRate: 0,
    scoreDistribution: [] as {
      label: string;
      count: number;
      percent: number;
    }[],
    metadataCompleteness: {
      totalQuestions: 0,
      labeledTopicQuestions: 0,
      missingTopicQuestions: 0,
      labeledSkillQuestions: 0,
      missingSkillQuestions: 0,
      labeledCognitiveLevelQuestions: 0,
      missingCognitiveLevelQuestions: 0,
    },
  });

  const [summary, setSummary] = useState<ResultsSummary>({
    totalSubmits: 0,
    averageScore: 0,
    passedCount: 0,
  });

  const [selectedTestId, setSelectedTestId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [assignmentCode, setAssignmentCode] = useState("");

  const [showAnalysis, setShowAnalysis] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const activeTests = useMemo(() => {
    return tests.filter((item) => item.status !== "deleted");
  }, [tests]);

  const activeClasses = useMemo(() => {
    return classes.filter((item) => item.status !== "deleted");
  }, [classes]);

  const suspiciousCount = useMemo(() => {
    return results.filter((item) => Number(item.suspiciousEventCount || 0) > 0)
      .length;
  }, [results]);

  const priorityStudents = useMemo(() => {
    return studentWeaknessAnalysis
      .filter((item) => item.weakSkills.length > 0 || item.weakTopics.length > 0)
      .slice(0, 10);
  }, [studentWeaknessAnalysis]);

  const metadataCompleteness = analysisSummary.metadataCompleteness;
  const hasEnoughSubmitsForDistribution = analysisSummary.totalSubmits >= 2;
  const hasLabeledSkillData =
    metadataCompleteness.labeledSkillQuestions > 0 && skillAnalysis.length > 0;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser?.email) {
        setMessage("Vui lòng đăng nhập Google trước.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        await Promise.all([loadTests(), loadClasses(), loadResults()]);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  function resetAnalysisData() {
    setAnalysis([]);
    setHardestQuestions([]);
    setTopicAnalysis([]);
    setSkillAnalysis([]);
    setStudentWeaknessAnalysis([]);
    setClassRecommendations({
      weakSkillCount: 0,
      prioritySkills: [],
      recommendations: [],
    });
    setAnalysisSummary({
      totalSubmits: 0,
      totalQuestions: 0,
      totalTopics: 0,
      totalSkills: 0,
      weakSkillCount: 0,
      averagePercent: 0,
      medianPercent: 0,
      highestPercent: 0,
      lowestPercent: 0,
      passRate: 0,
      scoreDistribution: [],
      metadataCompleteness: {
        totalQuestions: 0,
        labeledTopicQuestions: 0,
        missingTopicQuestions: 0,
        labeledSkillQuestions: 0,
        missingSkillQuestions: 0,
        labeledCognitiveLevelQuestions: 0,
        missingCognitiveLevelQuestions: 0,
      },
    });
  }

  async function loadTests() {
    try {
      const data = await teacherApi<TeacherTestsResponse>("/api/teacher/tests", {
        method: "GET",
      });

      setTests(data.tests || []);
    } catch (error: any) {
      setMessage(error?.message || "Không tải được danh sách đề.");
    }
  }

  async function loadClasses() {
    try {
      const data = await teacherApi<TeacherClassesResponse>(
        "/api/teacher/classes",
        {
          method: "GET",
        }
      );

      setClasses(data.classes || []);
    } catch (error: any) {
      setMessage(error?.message || "Không tải được danh sách lớp.");
    }
  }

  async function loadResults(customFilters?: {
    testId?: string;
    classId?: string;
    studentCode?: string;
    assignmentCode?: string;
  }) {
    try {
      setMessage("Đang tải kết quả...");

      const testId =
        customFilters?.testId !== undefined
          ? customFilters.testId
          : selectedTestId;

      const classId =
        customFilters?.classId !== undefined
          ? customFilters.classId
          : selectedClassId;

      const code =
        customFilters?.studentCode !== undefined
          ? customFilters.studentCode
          : studentCode;

      const codeAssignment =
        customFilters?.assignmentCode !== undefined
          ? customFilters.assignmentCode
          : assignmentCode;

      const params = new URLSearchParams();

      if (testId) params.set("testId", testId);
      if (classId) params.set("classId", classId);
      if (code.trim()) params.set("studentCode", code.trim().toUpperCase());
      if (codeAssignment.trim()) {
        params.set("assignmentCode", codeAssignment.trim().toUpperCase());
      }

      const url = params.toString()
        ? `/api/teacher/results?${params.toString()}`
        : "/api/teacher/results";

      const data = await teacherApi<TeacherResultsResponse>(url, {
        method: "GET",
      });

      setResults(data.results || []);
      setSummary(
        data.summary || {
          totalSubmits: 0,
          averageScore: 0,
          passedCount: 0,
        }
      );

      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Không tải được kết quả.");
    }
  }

  async function refreshAll() {
    try {
      setRefreshing(true);
      setMessage("Đang tải lại dữ liệu...");

      await Promise.all([loadTests(), loadClasses(), loadResults()]);

      setMessage("Đã tải lại dữ liệu.");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadQuestionAnalysis() {
    if (!selectedTestId) {
      setMessage("Vui lòng chọn một đề cụ thể để phân tích câu hỏi.");
      setShowAnalysis(true);
      return;
    }

    try {
      setShowAnalysis(true);
      setMessage("Đang phân tích câu hỏi...");

      const params = new URLSearchParams();
      params.set("testId", selectedTestId);

      if (selectedClassId) {
        params.set("classId", selectedClassId);
      }

      if (assignmentCode.trim()) {
        params.set("assignmentCode", assignmentCode.trim().toUpperCase());
      }

      if (studentCode.trim()) {
        params.set("studentCode", studentCode.trim().toUpperCase());
      }

      const data = await teacherApi<QuestionAnalysisResponse>(
        `/api/teacher/question-analysis?${params.toString()}`,
        {
          method: "GET",
        }
      );

      setAnalysis(data.analysis || []);
      setHardestQuestions(data.hardestQuestions || []);
      setTopicAnalysis(data.topicAnalysis || []);
      setSkillAnalysis(data.skillAnalysis || []);
      setStudentWeaknessAnalysis(data.studentWeaknessAnalysis || []);
      setClassRecommendations(
        data.classRecommendations || {
          weakSkillCount: 0,
          prioritySkills: [],
          recommendations: [],
        }
      );

      setAnalysisSummary({
        totalSubmits: data.summary?.totalSubmits || 0,
        totalQuestions: data.summary?.totalQuestions || 0,
        totalTopics: data.summary?.totalTopics || 0,
        totalSkills: data.summary?.totalSkills || 0,
        weakSkillCount: data.summary?.weakSkillCount || 0,
        averagePercent: data.summary?.averagePercent || 0,
        medianPercent: data.summary?.medianPercent || 0,
        highestPercent: data.summary?.highestPercent || 0,
        lowestPercent: data.summary?.lowestPercent || 0,
        passRate: data.summary?.passRate || 0,
        scoreDistribution: data.summary?.scoreDistribution || [],
        metadataCompleteness:
          data.summary?.metadataCompleteness || {
            totalQuestions: 0,
            labeledTopicQuestions: 0,
            missingTopicQuestions: 0,
            labeledSkillQuestions: 0,
            missingSkillQuestions: 0,
            labeledCognitiveLevelQuestions: 0,
            missingCognitiveLevelQuestions: 0,
          },
      });

      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Không phân tích được câu hỏi.");
    }
  }

  function applyFilter() {
    loadResults({
      testId: selectedTestId,
      classId: selectedClassId,
      studentCode,
      assignmentCode,
    });

    resetAnalysisData();
  }

  function clearFilter() {
    setSelectedTestId("");
    setSelectedClassId("");
    setStudentCode("");
    setAssignmentCode("");
    resetAnalysisData();

    loadResults({
      testId: "",
      classId: "",
      studentCode: "",
      assignmentCode: "",
    });
  }

  function exportResultsToCsv() {
    if (results.length === 0) {
      setMessage("Không có kết quả để xuất.");
      return;
    }

    const headers = [
      "STT",
      "Mã học sinh",
      "Tên học sinh",
      "Lớp",
      "Tên đề",
      "Môn",
      "Mã giao đề",
      "Điểm",
      "Tổng điểm",
      "Số câu đúng",
      "Tổng số câu",
      "Thời gian làm bài",
      "Nộp lúc",
      "Hình thức nộp",
      "Số lần rời màn hình",
      "Cảnh báo",
    ];

    const rows = results.map((item, index) => {
      const timeSpent = formatTime(item.timeSpentSeconds);
      const submittedAt = formatDate(item.submittedAt || item.createdAt);
      const suspiciousEventCount = Number(item.suspiciousEventCount || 0);

      return [
        index + 1,
        item.studentCode || "",
        item.studentName || "",
        item.className || "",
        item.testTitle || "",
        item.subject || "",
        item.assignmentCode || "",
        item.score ?? 0,
        item.totalScore ?? 10,
        item.correctCount ?? 0,
        item.totalQuestions ?? 0,
        timeSpent,
        submittedAt,
        item.autoSubmit ? "Tự động" : "Thủ công",
        suspiciousEventCount,
        suspiciousEventCount > 0 ? "Có cảnh báo" : "Bình thường",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const now = new Date();
    const filename = `ket-qua-kiem-tra-${now
      .toISOString()
      .slice(0, 10)}.csv`;

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);

    setMessage(`Đã xuất ${results.length} kết quả.`);
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={loadingState}>
          <span>Đang tải kết quả...</span>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <PageHeader
        eyebrow="BÁO CÁO"
        title="Kết quả bài kiểm tra"
        description="Theo dõi lượt nộp, điểm số, cảnh báo rời màn hình và phân tích ôn tập theo lớp."
        actions={
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={16} />}
            disabled={refreshing}
            onClick={refreshAll}
          >
            {refreshing ? "Đang tải..." : "Làm mới"}
          </Button>
        }
      />

      {message && (
        <div
          style={{
            ...messageStyle,
            background:
              message.includes("Đã") || message.includes("thành công")
                ? "#dcfce7"
                : message.includes("Đang")
                  ? "#dbeafe"
                  : "#fee2e2",
            color:
              message.includes("Đã") || message.includes("thành công")
                ? "#166534"
                : message.includes("Đang")
                  ? "#1e40af"
                  : "#991b1b",
          }}
        >
          {message}
        </div>
      )}

      <section style={statGrid}>
        <div style={statCard}>
          <p style={statLabel}>Tổng lượt nộp</p>
          <h2 style={statNumber}>{summary.totalSubmits}</h2>
        </div>

        <div style={statCard}>
          <p style={statLabel}>Điểm trung bình</p>
          <h2 style={statNumber}>{summary.averageScore}</h2>
        </div>

        <div style={statCard}>
          <p style={statLabel}>Đạt từ 50%</p>
          <h2 style={statNumber}>{summary.passedCount}</h2>
        </div>

        <div style={statCard}>
          <p style={statLabel}>Có cảnh báo</p>
          <h2
            style={{
              ...statNumber,
              color: suspiciousCount > 0 ? "#991b1b" : "#166534",
            }}
          >
            {suspiciousCount}
          </h2>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Bộ lọc kết quả</h2>

            <p style={sectionDesc}>
              Lọc theo đề, lớp, mã học sinh hoặc mã giao đề.
            </p>
          </div>
        </div>

        <div style={filterGrid}>
          <div>
            <label style={labelStyle}>Lọc theo đề</label>

            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Tất cả đề</option>

              {activeTests.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} - {item.subject || "--"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Lọc theo lớp</label>

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Tất cả lớp</option>

              {activeClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.className} - Khối {item.grade || "--"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Mã học sinh</label>

            <input
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="Ví dụ: FQN001"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Mã giao đề</label>

            <input
              value={assignmentCode}
              onChange={(e) => setAssignmentCode(e.target.value)}
              placeholder="Ví dụ: KT-ABC123"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={buttonRow}>
          <Button leftIcon={<Filter size={16} />} onClick={applyFilter}>
            Lọc kết quả
          </Button>

          <Button
            variant="success"
            leftIcon={<BarChart3 size={16} />}
            onClick={loadQuestionAnalysis}
          >
            Phân tích & báo cáo ôn tập
          </Button>

          <Button
            variant="outline"
            leftIcon={<Download size={16} />}
            onClick={exportResultsToCsv}
          >
            Xuất Excel
          </Button>

          <Button
            variant="secondary"
            leftIcon={<RotateCcw size={16} />}
            onClick={clearFilter}
          >
            Xóa lọc
          </Button>

          <Button
            variant="outline"
            leftIcon={<Eye size={16} />}
            onClick={() => setShowAnalysis((prev) => !prev)}
          >
            {showAnalysis ? "Ẩn phân tích" : "Hiện phân tích"}
          </Button>
        </div>
      </section>

      {showAnalysis && (
        <section style={cardStyle}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Phân tích năng lực & báo cáo ôn tập</h2>

              <p style={sectionDesc}>
                Chọn một đề cụ thể rồi bấm “Phân tích & báo cáo ôn tập”.
              </p>
            </div>
          </div>

          {!selectedTestId ? (
            <p style={subText}>
              Chưa chọn đề. Vui lòng chọn một đề trong bộ lọc phía trên.
            </p>
          ) : analysis.length === 0 ? (
            <p style={subText}>Chưa có dữ liệu phân tích.</p>
          ) : (
            <>
              <div style={analysisSummaryGrid}>
                <div style={analysisMiniCard}>
                  <p style={miniLabel}>Lượt nộp phân tích</p>
                  <h3 style={miniNumber}>{analysisSummary.totalSubmits}</h3>
                </div>

                <div style={analysisMiniCard}>
                  <p style={miniLabel}>Số câu</p>
                  <h3 style={miniNumber}>{analysisSummary.totalQuestions}</h3>
                </div>

                <div style={analysisMiniCard}>
                  <p style={miniLabel}>Chủ đề</p>
                  <h3 style={miniNumber}>{analysisSummary.totalTopics}</h3>
                </div>

                <div style={analysisMiniCard}>
                  <p style={miniLabel}>Điểm TB</p>
                  <h3 style={miniNumber}>{analysisSummary.averagePercent}%</h3>
                </div>
              </div>

              {metadataCompleteness.totalQuestions > 0 &&
                (metadataCompleteness.missingTopicQuestions > 0 ||
                  metadataCompleteness.missingSkillQuestions > 0 ||
                  metadataCompleteness.missingCognitiveLevelQuestions > 0) && (
                  <div style={dataQualityBox}>
                    <b>Giáo viên chưa gắn đủ nhãn phân tích cho câu hỏi.</b>
                    <span>
                      Chưa gắn chủ đề: {metadataCompleteness.missingTopicQuestions}/
                      {metadataCompleteness.totalQuestions} câu · Chưa gắn nhãn
                      kỹ năng:{" "}
                      {metadataCompleteness.missingSkillQuestions}/
                      {metadataCompleteness.totalQuestions} câu · Chưa gắn mức
                      nhận thức:{" "}
                      {metadataCompleteness.missingCognitiveLevelQuestions}/
                      {metadataCompleteness.totalQuestions} câu.
                    </span>
                  </div>
                )}

              {hasEnoughSubmitsForDistribution &&
                analysisSummary.scoreDistribution.length > 0 && (
                <div style={scoreDistributionBox}>
                  <div style={scoreDistributionHeader}>
                    <h3 style={blockTitle}>Phân bố điểm</h3>
                    <span style={smallText}>Theo thang phần trăm quy đổi</span>
                  </div>

                  <div style={scoreDistributionGrid}>
                    {analysisSummary.scoreDistribution.map((bucket) => (
                      <div key={bucket.label} style={scoreBucket}>
                        <div style={scoreBucketBar}>
                          <div
                            style={{
                              ...scoreBucketFill,
                              height: `${Math.max(bucket.percent, bucket.count > 0 ? 8 : 0)}%`,
                            }}
                          />
                        </div>

                        <strong>{bucket.count}</strong>
                        <span>{bucket.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {classRecommendations.prioritySkills.length > 0 && (
                <div style={recommendationBox}>
                  <h3 style={blockTitle}>Ưu tiên ôn tập cho cả lớp</h3>

                  <div style={prioritySkillGrid}>
                    {classRecommendations.prioritySkills.map((item, index) => (
                      <div
                        key={`${item.skill}-${item.topic}-${index}`}
                        style={prioritySkillCard}
                      >
                        <div style={priorityRank}>#{index + 1}</div>

                        <div>
                          <b>{item.skill || item.topic || item.knowledgeUnit}</b>

                          <div style={smallText}>
                            {item.topic || "--"}{" "}
                            {item.knowledgeUnit ? `· ${item.knowledgeUnit}` : ""}
                          </div>

                          <div style={smallText}>
                            Tỉ lệ đúng: <b>{item.correctRate}%</b>
                          </div>

                          <div style={smallText}>
                            {item.evidenceLabel} · {item.confidenceLabel}
                          </div>

                          <span
                            style={{
                              ...learningBadge,
                              ...getLearningLevelStyle(item.level),
                            }}
                          >
                            {item.levelLabel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {classRecommendations.recommendations.length > 0 && (
                    <div style={recommendationList}>
                      <b>Gợi ý ôn tập:</b>

                      <ul style={ulStyle}>
                        {compactList(classRecommendations.recommendations).map(
                          (item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {topicAnalysis.length > 0 && (
                <div style={analysisBlock}>
                  <h3 style={blockTitle}>Phân tích theo chủ đề</h3>

                  <div style={tableWrapperSmall}>
                    <table style={compactTableStyle}>
                      <thead>
                        <tr style={theadStyle}>
                          <th style={th}>Chủ đề</th>
                          <th style={th}>Số câu</th>
                          <th style={th}>Lượt trả lời</th>
                          <th style={th}>Đúng</th>
                          <th style={th}>Sai</th>
                          <th style={th}>Bỏ trống</th>
                          <th style={th}>Tỉ lệ đúng</th>
                          <th style={th}>Đánh giá</th>
                        </tr>
                      </thead>

                      <tbody>
                        {topicAnalysis.map((item) => (
                          <tr key={item.key}>
                            <td style={td}>
                              <b>{item.topic || "Chưa phân loại"}</b>

                              <div style={smallText}>
                                {item.subject || "--"} · Khối{" "}
                                {item.grade || "--"}
                              </div>
                            </td>

                            <td style={td}>
                              {item.totalQuestions}
                              <div style={smallText}>{item.confidenceLabel}</div>
                            </td>
                            <td style={td}>{item.totalAnswers}</td>
                            <td style={td}>{item.correctAnswers}</td>
                            <td style={td}>{item.wrongAnswers}</td>
                            <td style={td}>{item.blankAnswers}</td>

                            <td style={td}>
                              <b>{item.correctRate}%</b>
                              <div style={rateBar}>
                                <div
                                  style={{
                                    ...rateFill,
                                    width: `${item.correctRate}%`,
                                  }}
                                />
                              </div>
                            </td>

                            <td style={td}>
                              <span
                                style={{
                                  ...learningBadge,
                                  ...getLearningLevelStyle(item.level),
                                }}
                              >
                                {item.levelLabel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!hasLabeledSkillData && metadataCompleteness.totalQuestions > 0 ? (
                <div style={analysisBlock}>
                  <h3 style={blockTitle}>Phân tích theo kỹ năng</h3>
                  <p style={subText}>
                    Chưa đủ dữ liệu để phân tích theo nhãn kỹ năng. Đây là phần
                    giáo viên cần gắn cho câu hỏi trong ngân hàng câu hỏi hoặc
                    khi import đề; hệ thống chỉ tính năng lực học sinh sau khi
                    câu hỏi có nhãn kỹ năng thật.
                  </p>
                </div>
              ) : null}

              {hasLabeledSkillData && (
                <div style={analysisBlock}>
                  <h3 style={blockTitle}>Phân tích theo kỹ năng</h3>

                  <div style={tableWrapperSmall}>
                    <table style={skillTableStyle}>
                      <thead>
                        <tr style={theadStyle}>
                          <th style={th}>Kỹ năng</th>
                          <th style={th}>Mục tiêu cần đạt</th>
                          <th style={th}>Mức nhận thức</th>
                          <th style={th}>Số câu</th>
                          <th style={th}>Tỉ lệ đúng</th>
                          <th style={th}>Đánh giá</th>
                          <th style={th}>Gợi ý</th>
                        </tr>
                      </thead>

                      <tbody>
                        {skillAnalysis.map((item) => (
                          <tr key={item.key}>
                            <td style={td}>
                              {item.skill ? <b>{item.skill}</b> : null}

                              <div
                                style={{
                                  ...smallText,
                                  marginTop: item.skill ? 4 : 0,
                                }}
                              >
                                {item.topic || "--"}{" "}
                                {item.knowledgeUnit
                                  ? `· ${item.knowledgeUnit}`
                                  : ""}
                              </div>
                            </td>

                            <td style={td}>
                              {item.learningOutcome || "--"}
                            </td>

                            <td style={td}>
                              {getCognitiveLevelLabel(item.cognitiveLevel)}
                            </td>

                            <td style={td}>
                              {item.totalQuestions}
                              <div style={smallText}>{item.confidenceLabel}</div>
                            </td>

                            <td style={td}>
                              <b>{item.correctRate}%</b>
                              <div style={rateBar}>
                                <div
                                  style={{
                                    ...rateFill,
                                    width: `${item.correctRate}%`,
                                  }}
                                />
                              </div>
                            </td>

                            <td style={td}>
                              <span
                                style={{
                                  ...learningBadge,
                                  ...getLearningLevelStyle(item.level),
                                }}
                              >
                                {item.levelLabel}
                              </span>
                            </td>

                            <td style={td}>
                              <ul style={smallUlStyle}>
                                {compactList(item.recommendations)
                                  .slice(0, 3)
                                  .map((rec, index) => (
                                    <li key={`${item.key}-rec-${index}`}>
                                      {rec}
                                    </li>
                                  ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {priorityStudents.length > 0 && (
                <div style={analysisBlock}>
                  <h3 style={blockTitle}>Học sinh cần hỗ trợ</h3>

                  <div style={studentSupportGrid}>
                    {priorityStudents.map((item) => (
                      <div key={item.resultId} style={studentSupportCard}>
                        <div style={studentSupportTop}>
                          <div>
                            <b>{item.studentName}</b>
                            <div style={smallText}>
                              {item.studentCode} · {item.className || "--"}
                            </div>
                            <div style={smallText}>
                              {item.attemptCount} lần làm · Trung bình {item.averagePercentage}%
                              {item.trendPercentagePoints === null
                                ? ""
                                : ` · Xu hướng ${item.trendPercentagePoints >= 0 ? "+" : ""}${item.trendPercentagePoints} điểm %`}
                            </div>
                            <div style={smallText}>
                              {item.evidenceQuestionCount} câu có nhãn kỹ năng
                            </div>
                          </div>

                          <span
                            style={{
                              ...scorePill,
                              background:
                                item.percentage >= 80
                                  ? "#dcfce7"
                                  : item.percentage >= 50
                                    ? "#fef9c3"
                                    : "#fee2e2",
                              color:
                                item.percentage >= 80
                                  ? "#166534"
                                  : item.percentage >= 50
                                    ? "#854d0e"
                                    : "#991b1b",
                            }}
                          >
                            {item.percentage}%
                          </span>
                        </div>

                        {item.weakSkills.length > 0 && (
                          <div style={supportBlock}>
                            <b>Kỹ năng yếu:</b>
                            <div style={tagWrap}>
                              {item.weakSkills.map((skill) => (
                                <span key={skill} style={dangerTag}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.weakTopics.length > 0 && (
                          <div style={supportBlock}>
                            <b>Chủ đề yếu:</b>
                            <div style={tagWrap}>
                              {item.weakTopics.map((topic) => (
                                <span key={topic} style={warningTag}>
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.recommendations.length > 0 && (
                          <div style={supportBlock}>
                            <b>Gợi ý:</b>
                            <ul style={smallUlStyle}>
                              {compactList(item.recommendations)
                                .slice(0, 3)
                                .map((rec, index) => (
                                  <li key={`${item.resultId}-rec-${index}`}>
                                    {rec}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}

                        <button
                          type="button"
                          style={detailBtn}
                          onClick={() => router.push(`/teacher/results/${item.resultId}`)}
                        >
                          Xem bài gần nhất
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hardestQuestions.length > 0 && (
                <div style={hardestBox}>
                  <h3 style={blockTitle}>Câu học sinh sai nhiều nhất</h3>

                  {hardestQuestions.map((item, index) => (
                    <p key={`${item.questionId}-${index}`}>
                      Câu {item.questionNumber}: <b>{item.wrongRate}% sai</b> —{" "}
                      {item.question}
                    </p>
                  ))}
                </div>
              )}

              <div style={analysisBlock}>
                <h3 style={blockTitle}>Phân tích từng câu hỏi</h3>

                <div style={tableWrapper}>
                  <table style={analysisTableStyle}>
                    <thead>
                      <tr style={theadStyle}>
                        <th style={th}>Câu</th>
                        <th style={th}>Nội dung</th>
                        <th style={th}>Kỹ năng</th>
                        <th style={th}>Đáp án đúng</th>
                        <th style={th}>Đúng</th>
                        <th style={th}>Sai</th>
                        <th style={th}>Bỏ trống</th>
                        <th style={th}>Tỉ lệ đúng</th>
                        <th style={th}>Mức độ</th>
                      </tr>
                    </thead>

                    <tbody>
                      {analysis.map((item, index) => (
                        <tr key={`${item.questionId}-${index}`}>
                          <td style={td}>
                            <b>Câu {index + 1}</b>
                          </td>

                          <td style={td}>
                            <b>{item.question}</b>

                            <div style={smallText}>
                              A. {item.A} | B. {item.B} | C. {item.C} | D.{" "}
                              {item.D}
                            </div>

                            {item.recommendation && (
                              <div style={questionRecommendation}>
                                {item.recommendation}
                              </div>
                            )}
                          </td>

                          <td style={td}>
                            {item.skill ? <b>{item.skill}</b> : null}
                            <div
                              style={{
                                ...smallText,
                                marginTop: item.skill ? 4 : 0,
                              }}
                            >
                              {item.topic || "Chưa phân loại"}{" "}
                              {item.knowledgeUnit ? `· ${item.knowledgeUnit}` : ""}
                            </div>
                          </td>

                          <td style={td}>
                            <b>{item.correct}</b>
                          </td>

                          <td style={td}>{item.correctCount}</td>
                          <td style={td}>{item.wrongCount}</td>
                          <td style={td}>{item.blankCount}</td>

                          <td style={td}>
                            <b>{item.correctRate}%</b>

                            <div style={rateBar}>
                              <div
                                style={{
                                  ...rateFill,
                                  width: `${item.correctRate}%`,
                                }}
                              />
                            </div>
                          </td>

                          <td style={td}>
                            <span
                              style={{
                                ...levelBadge,
                                background:
                                  item.level === "Dễ"
                                    ? "#dcfce7"
                                    : item.level === "Trung bình"
                                      ? "#fef9c3"
                                      : item.level === "Khó"
                                        ? "#fee2e2"
                                        : "#f1f5f9",
                                color:
                                  item.level === "Dễ"
                                    ? "#166534"
                                    : item.level === "Trung bình"
                                      ? "#854d0e"
                                      : item.level === "Khó"
                                        ? "#991b1b"
                                        : "#475569",
                              }}
                            >
                              {item.level}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <section style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Danh sách kết quả</h2>

            <p style={sectionDesc}>
              Xem điểm, thời gian làm bài, cảnh báo và chi tiết từng bài nộp.
            </p>
          </div>

          <div style={summaryBadge}>{results.length} kết quả</div>
        </div>

        {results.length === 0 ? (
          <p style={subText}>Chưa có kết quả nào.</p>
        ) : (
          <div style={tableWrapper}>
            <table style={resultTableStyle}>
              <thead>
                <tr style={theadStyle}>
                  <th style={th}>Học sinh</th>
                  <th style={th}>Lớp</th>
                  <th style={th}>Đề</th>
                  <th style={th}>Điểm</th>
                  <th style={th}>Số câu đúng</th>
                  <th style={th}>Thời gian làm</th>
                  <th style={th}>Nộp lúc</th>
                  <th style={th}>Cảnh báo</th>
                  <th style={th}>Mã giao đề</th>
                  <th style={th}>Chi tiết</th>
                </tr>
              </thead>

              <tbody>
                {results.map((item) => {
                  const score = Number(item.score || 0);
                  const totalScore = Number(item.totalScore || 10);
                  const suspiciousEventCount = Number(
                    item.suspiciousEventCount ||
                      Number(item.visibilityLostCount || 0) +
                        Number(item.focusLostCount || 0)
                  );

                  return (
                    <tr key={item.id}>
                      <td style={td}>
                        <b>{item.studentName}</b>

                        <div style={smallText}>{item.studentCode}</div>
                      </td>

                      <td style={td}>{item.className || "--"}</td>

                      <td style={td}>
                        <b>{item.testTitle}</b>

                        <div style={smallText}>{item.subject || "--"}</div>
                      </td>

                      <td style={td}>
                        <b
                          style={{
                            color: getScoreColor(score, totalScore),
                            fontSize: 18,
                          }}
                        >
                          {score}/{totalScore}
                        </b>
                      </td>

                      <td style={td}>
                        {item.correctCount}/{item.totalQuestions}
                      </td>

                      <td style={td}>{formatTime(item.timeSpentSeconds)}</td>

                      <td style={td}>
                        {formatDate(item.submittedAt || item.createdAt)}
                      </td>

                      <td style={td}>
                        {suspiciousEventCount > 0 ? (
                          <span style={warningBadge}>
                            Rời màn hình {suspiciousEventCount} lần
                          </span>
                        ) : (
                          <span style={safeBadge}>Bình thường</span>
                        )}
                      </td>

                      <td style={td}>
                        <b>{item.assignmentCode || "--"}</b>
                      </td>

                      <td style={td}>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/teacher/results/${item.id}`)
                          }
                          style={detailBtn}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

const heroCard: CSSProperties = {
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  flexWrap: "wrap",
};

const heroKicker: CSSProperties = {
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  marginBottom: 8,
  textTransform: "uppercase",
};

const heroTitle: CSSProperties = {
  fontSize: 32,
  lineHeight: 1.2,
  margin: 0,
  fontWeight: 900,
};

const heroText: CSSProperties = {
  color: "#64748b",
  fontSize: 15,
  marginTop: 8,
  marginBottom: 0,
  lineHeight: 1.6,
  maxWidth: 760,
};

const heroMeta: CSSProperties = {
  marginTop: 10,
  color: "#64748b",
  fontSize: 14,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const heroButton: CSSProperties = {
  minHeight: 42,
  border: "1px solid #2563eb",
  borderRadius: 11,
  background: "#2563eb",
  color: "white",
  padding: "10px 15px",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const subText: CSSProperties = {
  color: "#64748b",
  margin: 0,
  lineHeight: 1.6,
  fontSize: 14,
};

const statGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const statCard: CSSProperties = {
  display: "grid",
  gap: 8,
  minHeight: 118,
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
  margin: "0 0 6px",
};

const sectionDesc: CSSProperties = {
  color: "#64748b",
  margin: 0,
  lineHeight: 1.5,
  fontSize: 14,
};

const summaryBadge: CSSProperties = {
  padding: "7px 11px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const filterGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  width: "100%",
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 850,
  marginBottom: 7,
  color: "#334155",
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  minHeight: 46,
  padding: "10px 13px",
  borderRadius: 11,
  border: "1px solid var(--ui-border)",
  marginBottom: 12,
  fontSize: 14,
  boxSizing: "border-box",
  background: "white",
  color: "var(--ui-text)",
  outline: "none",
};

const buttonRow: CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 8,
  flexWrap: "wrap",
};

const primaryBtn: CSSProperties = {
  minHeight: 42,
  padding: "10px 15px",
  borderRadius: 11,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "white",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  minHeight: 42,
  padding: "10px 15px",
  borderRadius: 11,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const successBtn: CSSProperties = {
  minHeight: 42,
  padding: "10px 15px",
  borderRadius: 11,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const excelBtn: CSSProperties = {
  minHeight: 42,
  padding: "10px 15px",
  borderRadius: 11,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const darkBtn: CSSProperties = {
  minHeight: 42,
  padding: "10px 15px",
  borderRadius: 11,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const messageStyle: CSSProperties = {
  padding: "13px 15px",
  borderRadius: 13,
  fontWeight: 800,
};

const tableWrapper: CSSProperties = {
  overflowX: "auto",
  overflowY: "auto",
  maxHeight: 560,
  borderRadius: 14,
  border: "1px solid var(--ui-border)",
};

const tableWrapperSmall: CSSProperties = {
  overflowX: "auto",
  borderRadius: 14,
  border: "1px solid var(--ui-border)",
};

const resultTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1180,
  background: "white",
};

const analysisTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1250,
  background: "white",
};

const compactTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 920,
  background: "white",
};

const skillTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1180,
  background: "white",
};

const theadStyle: CSSProperties = {
  background: "#f8fafc",
  color: "#334155",
};

const th: CSSProperties = {
  padding: "13px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
  textTransform: "uppercase",
};

const td: CSSProperties = {
  padding: "13px 14px",
  borderBottom: "1px solid var(--ui-border)",
  verticalAlign: "middle",
  color: "#334155",
  fontSize: 13,
};

const smallText: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.6,
  marginTop: 4,
};

const analysisSummaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const analysisMiniCard: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #bfdbfe",
};

const dataQualityBox: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 14,
  borderRadius: 16,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#854d0e",
  fontSize: 14,
  lineHeight: 1.55,
  marginBottom: 16,
};

const miniLabel: CSSProperties = {
  margin: 0,
  color: "#1e40af",
  fontWeight: 900,
};

const miniNumber: CSSProperties = {
  margin: "8px 0 0",
  color: "#2563eb",
  fontSize: 28,
  fontWeight: 900,
};

const recommendationBox: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#f0fdf4",
  color: "#14532d",
  border: "1px solid #bbf7d0",
  marginBottom: 18,
};

const analysisBlock: CSSProperties = {
  marginTop: 18,
};

const blockTitle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 18,
  fontWeight: 950,
};

const prioritySkillGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const scoreDistributionBox: CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 18,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
};

const scoreDistributionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 14,
};

const scoreDistributionGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(72px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const scoreBucket: CSSProperties = {
  display: "grid",
  gap: 6,
  justifyItems: "center",
  color: "#334155",
  fontSize: 13,
};

const scoreBucketBar: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  width: "100%",
  height: 118,
  borderRadius: 12,
  background: "#f1f5f9",
  overflow: "hidden",
};

const scoreBucketFill: CSSProperties = {
  width: "100%",
  minHeight: 0,
  borderRadius: "12px 12px 0 0",
  background: "#2563eb",
};

const prioritySkillCard: CSSProperties = {
  display: "flex",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  background: "white",
  border: "1px solid #bbf7d0",
};

const priorityRank: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  background: "#16a34a",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const recommendationList: CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  background: "rgba(255,255,255,.72)",
};

const ulStyle: CSSProperties = {
  margin: "8px 0 0",
  paddingLeft: 22,
  lineHeight: 1.7,
};

const smallUlStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  lineHeight: 1.6,
  color: "#334155",
};

const hardestBox: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
  marginTop: 18,
  marginBottom: 16,
};

const rateBar: CSSProperties = {
  width: "100%",
  height: 10,
  background: "#e5e7eb",
  borderRadius: 999,
  overflow: "hidden",
  marginTop: 6,
};

const rateFill: CSSProperties = {
  height: 10,
  background: "#2563eb",
};

const levelBadge: CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
};

const learningBadge: CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
  marginTop: 8,
};

const studentSupportGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const studentSupportCard: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid var(--ui-border)",
};

const studentSupportTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 12,
};

const scorePill: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  fontWeight: 900,
  flexShrink: 0,
};

const supportBlock: CSSProperties = {
  marginTop: 10,
};

const tagWrap: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 8,
};

const dangerTag: CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 800,
  fontSize: 12,
};

const warningTag: CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "#ffedd5",
  color: "#9a3412",
  fontWeight: 800,
  fontSize: 12,
};

const questionRecommendation: CSSProperties = {
  marginTop: 8,
  padding: 10,
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.6,
};

const detailBtn: CSSProperties = {
  minHeight: 34,
  padding: "8px 11px",
  borderRadius: 9,
  border: "none",
  background: "#dbeafe",
  color: "#1e40af",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const warningBadge: CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  fontSize: 13,
};

const safeBadge: CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  fontSize: 13,
};
