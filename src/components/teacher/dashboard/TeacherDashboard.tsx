"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BrainCircuit,
  ClipboardList,
  FileText,
  Loader2,
  RefreshCw,
  School,
  Target,
  Users,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import { Button } from "@/components/ui";
import { auth } from "@/lib/firebase/client";

import styles from "./TeacherDashboard.module.css";

type DashboardSummary = {
  totalTests: number;
  draftTests: number;
  publishedTests: number;
  archivedTests: number;
  totalClasses: number;
  totalStudents: number;
  totalAssignments: number;
  activeAssignments: number;
  scheduledAssignments: number;
  closedAssignments: number;
  totalQuestions: number;
  totalSubmits: number;
  averagePercent: number;
  passRate: number;
  passedCount: number;
};

type DashboardTeacher = {
  name?: string;
  email: string;
  role: "admin" | "teacher";
};

type RecentTest = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  status: string;
  totalQuestions: number;
  totalScore: number;
  updatedAt: string;
};

type RecentAssignment = {
  id: string;
  title: string;
  className: string;
  subject: string;
  status: string;
  assignmentCode: string;
  createdAt: string;
};

type RecentResult = {
  id: string;
  studentName: string;
  testTitle: string;
  subject: string;
  scoreText: string;
  percent: number;
  submittedAt: string;
};

type DashboardData = {
  status: "success";
  teacher: DashboardTeacher;
  summary: DashboardSummary;
  recentTests: RecentTest[];
  recentAssignments: RecentAssignment[];
  recentResults: RecentResult[];
};

type DashboardError = {
  status: "error";
  message: string;
};

const EMPTY_SUMMARY: DashboardSummary = {
  totalTests: 0,
  draftTests: 0,
  publishedTests: 0,
  archivedTests: 0,
  totalClasses: 0,
  totalStudents: 0,
  totalAssignments: 0,
  activeAssignments: 0,
  scheduledAssignments: 0,
  closedAssignments: 0,
  totalQuestions: 0,
  totalSubmits: 0,
  averagePercent: 0,
  passRate: 0,
  passedCount: 0,
};

function formatDate(value: string): string {
  if (!value) return "Chưa rõ";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Chưa rõ";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getStatusLabel(status: string): string {
  if (status === "published") return "Đã xuất bản";
  if (status === "draft") return "Bản nháp";
  if (status === "archived") return "Lưu trữ";
  if (status === "active") return "Đang mở";
  if (status === "scheduled") return "Đã hẹn giờ";
  if (status === "closed") return "Đã đóng";
  return status || "Chưa rõ";
}

async function fetchDashboard(): Promise<DashboardData> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Bạn cần đăng nhập để xem tổng quan.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/teacher/dashboard", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await response.json()) as DashboardData | DashboardError;

  if (!response.ok || data.status === "error") {
    throw new Error(
      data.status === "error" ? data.message : "Không tải được dashboard."
    );
  }

  return data;
}

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");
      setData(await fetchDashboard());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        setError("Bạn cần đăng nhập để xem tổng quan.");
        return;
      }

      void loadDashboard();
    });

    return () => unsubscribe();
  }, []);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const teacherName = data?.teacher.name || "Thầy/Cô";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>Tổng quan vận hành</span>
          <h1>{teacherName}, tổng quan hệ thống hôm nay</h1>
          <p>
            Theo dõi nhanh đề kiểm tra, ngân hàng câu hỏi, lớp học, giao bài
            và kết quả học sinh trong cùng một màn hình.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={16} />}
            disabled={loading}
            onClick={() => {
              void loadDashboard();
            }}
          >
            Làm mới
          </Button>

          <Button
            onClick={() => {
              window.location.href = "/teacher/ai-generator";
            }}
          >
            AI tạo câu hỏi
          </Button>
        </div>
      </section>

      {error ? (
        <section className={styles.errorBox}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </section>
      ) : null}

      {loading && !data ? (
        <section className={styles.loadingBox}>
          <Loader2 className={styles.spin} size={22} />
          <span>Đang tải dữ liệu tổng quan...</span>
        </section>
      ) : (
        <>
          <section className={styles.metricGrid} aria-label="Chỉ số tổng quan">
            <article className={styles.metricCard}>
              <FileText size={21} />
              <strong>{summary.totalTests}</strong>
              <span>Đề kiểm tra</span>
              <small>
                {summary.publishedTests} xuất bản · {summary.draftTests} nháp
              </small>
            </article>

            <article className={styles.metricCard}>
              <BookOpen size={21} />
              <strong>{summary.totalQuestions}</strong>
              <span>Câu hỏi trong bank</span>
              <small>Sẵn sàng dùng cho tạo đề</small>
            </article>

            <article className={styles.metricCard}>
              <Target size={21} />
              <strong>{summary.activeAssignments}</strong>
              <span>Bài giao đang mở</span>
              <small>
                {summary.scheduledAssignments} đã hẹn · {summary.closedAssignments} đã đóng
              </small>
            </article>

            <article className={styles.metricCard}>
              <BarChart3 size={21} />
              <strong>{summary.averagePercent}%</strong>
              <span>Điểm trung bình</span>
              <small>{summary.passRate}% đạt · {summary.totalSubmits} bài nộp</small>
            </article>
          </section>

          <section className={styles.detailGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Đề kiểm tra gần đây</h2>
                  <p>Tiếp tục sửa, xuất bản hoặc giao bài.</p>
                </div>
                <Link href="/teacher/tests">Xem tất cả</Link>
              </div>

              <div className={styles.list}>
                {data?.recentTests.length ? (
                  data.recentTests.map((test) => (
                    <Link
                      key={test.id}
                      href={`/teacher/tests/${test.id}/edit`}
                      className={styles.listItem}
                    >
                      <FileText size={18} />
                      <div>
                        <strong>{test.title}</strong>
                        <span>
                          {test.subject || "--"} · Khối {test.grade || "--"} · {test.totalQuestions} câu
                        </span>
                      </div>
                      <small>{getStatusLabel(test.status)}</small>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyState}>Chưa có đề kiểm tra gần đây.</div>
                )}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Bài nộp mới</h2>
                  <p>Theo dõi tín hiệu học tập gần nhất.</p>
                </div>
                <Link href="/teacher/results">Xem kết quả</Link>
              </div>

              <div className={styles.list}>
                {data?.recentResults.length ? (
                  data.recentResults.map((result) => (
                    <Link
                      key={result.id}
                      href="/teacher/results"
                      className={styles.listItem}
                    >
                      <Users size={18} />
                      <div>
                        <strong>{result.studentName}</strong>
                        <span>{result.testTitle}</span>
                      </div>
                      <small>{result.scoreText}</small>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyState}>Chưa có bài nộp mới.</div>
                )}
              </div>
            </article>

            <article className={styles.panelWide}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Nhịp vận hành lớp học</h2>
                  <p>Lớp, học sinh và bài giao đang hoạt động.</p>
                </div>
              </div>

              <div className={styles.operationGrid}>
                <div>
                  <School size={20} />
                  <strong>{summary.totalClasses}</strong>
                  <span>Lớp đang quản lý</span>
                </div>
                <div>
                  <Users size={20} />
                  <strong>{summary.totalStudents}</strong>
                  <span>Học sinh</span>
                </div>
                <div>
                  <ClipboardList size={20} />
                  <strong>{summary.totalAssignments}</strong>
                  <span>Bài giao</span>
                </div>
                <div>
                  <BrainCircuit size={20} />
                  <strong>{summary.passRate}%</strong>
                  <span>Tỷ lệ đạt</span>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
