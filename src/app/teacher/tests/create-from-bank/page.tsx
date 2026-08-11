"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import MathContent from "@/components/common/MathContent";
import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

type AnswerKey = "A" | "B" | "C" | "D";

type BankQuestion = {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  difficulty: string;
  visibility: string;

  question: string;
  questionImageUrl?: string;

  A: string;
  B: string;
  C: string;
  D: string;

  correct: AnswerKey;
  explanation?: string;

  teacherName?: string;
  teacherEmail?: string;
  createdAt?: string;
};

type QuestionBankResponse = {
  status: "success";
  questions: BankQuestion[];
  count: number;
};

type CreateTestResponse = {
  status: "success";
  testId: string;
  message: string;
};


function getDifficultyLabel(value?: string) {
  if (value === "easy") return "Dễ";
  if (value === "hard") return "Khó";
  return "Trung bình";
}

function formatDate(value?: string) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN");
}

async function callTeacherApi<TResponse>(
  url: string,
  user: User,
  options: RequestInit = {}
): Promise<TResponse> {
  const token = await user.getIdToken();

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
    console.error("API không trả JSON:", {
      url,
      status: response.status,
      text: text.slice(0, 500),
    });

    throw new Error(`API ${url} không trả JSON. Status: ${response.status}.`);
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API.");
  }

  return data as TResponse;
}

export default function CreateTestFromBankPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("45");

  const [filterSubject, setFilterSubject] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");

  const [message, setMessage] = useState("");

  const selectedQuestions = questions.filter((q) => selectedIds.includes(q.id));

  const loadQuestions = useCallback(
    async (user: User, useFilters = false) => {
      try {
        setLoading(true);

        const params = new URLSearchParams();

        if (useFilters) {
          if (filterSubject) params.set("subject", filterSubject);
          if (filterGrade.trim()) params.set("grade", filterGrade.trim());
          if (filterTopic.trim()) params.set("topic", filterTopic.trim());
          if (filterDifficulty) params.set("difficulty", filterDifficulty);
          if (filterKeyword.trim()) params.set("keyword", filterKeyword.trim());
        }

        const query = params.toString();

        const data = await callTeacherApi<QuestionBankResponse>(
          `/api/teacher/question-bank${query ? `?${query}` : ""}`,
          user,
          {
            method: "GET",
          }
        );

        setQuestions(data.questions || []);

        setMessage(
          useFilters
            ? `Đã lọc được ${data.questions?.length || 0} câu hỏi.`
            : "Đã tải ngân hàng câu hỏi."
        );
      } catch (error: any) {
        console.error("Load bank questions error:", error);
        setMessage(error?.message || "Không tải được ngân hàng câu hỏi.");
      } finally {
        setLoading(false);
      }
    },
    [filterSubject, filterGrade, filterTopic, filterDifficulty, filterKeyword]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        setMessage("Bạn chưa đăng nhập.");
        setLoading(false);
        return;
      }

      await loadQuestions(user, false);
    });

    return () => unsub();
  }, [loadQuestions]);

  function toggleQuestion(questionId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(questionId)) {
        return prev.filter((id) => id !== questionId);
      }

      return [...prev, questionId];
    });
  }

  function selectAllVisibleQuestions() {
    const visibleIds = questions.map((q) => q.id);

    setSelectedIds((prev) => {
      const merged = new Set([...prev, ...visibleIds]);
      return Array.from(merged);
    });

    setMessage(`Đã chọn ${visibleIds.length} câu hỏi đang hiển thị.`);
  }

  function clearSelectedQuestions() {
    setSelectedIds([]);
    setMessage("Đã bỏ chọn toàn bộ câu hỏi.");
  }

  async function applyFilters() {
    if (!currentUser) {
      setMessage("Bạn chưa đăng nhập.");
      return;
    }

    await loadQuestions(currentUser, true);
  }

  async function clearFilters() {
    if (!currentUser) {
      setMessage("Bạn chưa đăng nhập.");
      return;
    }

    setFilterSubject("");
    setFilterGrade("");
    setFilterTopic("");
    setFilterDifficulty("");
    setFilterKeyword("");

    try {
      setLoading(true);

      const data = await callTeacherApi<QuestionBankResponse>(
        "/api/teacher/question-bank",
        currentUser,
        {
          method: "GET",
        }
      );

      setQuestions(data.questions || []);
      setMessage("Đã xóa bộ lọc.");
    } catch (error: any) {
      console.error("Clear filter error:", error);
      setMessage(error?.message || "Không xóa được bộ lọc.");
    } finally {
      setLoading(false);
    }
  }

  function validateBeforeCreate() {
    if (!title.trim()) return "Vui lòng nhập tên đề kiểm tra.";

    const duration = Number(durationMinutes);

    if (!Number.isFinite(duration) || duration <= 0) {
      return "Thời gian làm bài không hợp lệ.";
    }

    if (selectedIds.length === 0) {
      return "Vui lòng chọn ít nhất 1 câu hỏi.";
    }

    return "";
  }

  async function createTestFromBank() {
    if (!currentUser) {
      setMessage("Bạn chưa đăng nhập.");
      return;
    }

    const error = validateBeforeCreate();

    if (error) {
      setMessage(error);
      return;
    }

    try {
      setCreating(true);
      setMessage("Đang tạo đề kiểm tra từ ngân hàng câu hỏi...");

      const firstQuestion = selectedQuestions[0];

      const result = await callTeacherApi<CreateTestResponse>(
        "/api/teacher/tests/from-question-bank",
        currentUser,
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            durationMinutes: Number(durationMinutes),
            subject: firstQuestion?.subject || "",
            grade: firstQuestion?.grade || "",
            questionIds: selectedIds,
          }),
        }
      );

      setMessage(result.message || "Đã tạo đề kiểm tra.");

      router.push("/teacher/tests");
    } catch (error: any) {
      console.error("Create test from bank error:", error);
      setMessage(error?.message || "Không tạo được đề kiểm tra.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={heroCard}>
        <div>
          <div style={heroKicker}>CREATE TEST</div>
          <h1 style={heroTitle}>Tạo đề từ ngân hàng câu hỏi</h1>
          <p style={heroText}>
            Chọn câu hỏi đã có trong Question Bank để tạo nhanh một đề kiểm tra.
          </p>
        </div>

        <div style={heroBadge}>
          Đã chọn: {selectedIds.length} câu
        </div>
      </section>

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

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Thông tin đề kiểm tra</h2>

        <div style={testInfoGrid}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tên đề kiểm tra. Ví dụ: Kiểm tra Hàm số lần 1"
            style={inputStyle}
          />

          <input
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="Thời gian làm bài, ví dụ: 45"
            style={inputStyle}
          />
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả đề kiểm tra nếu có"
          style={smallTextareaStyle}
        />

        <div style={selectedSummary}>
          <b>Số câu đã chọn:</b> {selectedIds.length}
        </div>

        <button
          type="button"
          onClick={createTestFromBank}
          disabled={creating}
          style={{
            ...primaryBtn,
            opacity: creating ? 0.6 : 1,
            cursor: creating ? "not-allowed" : "pointer",
          }}
        >
          {creating ? "Đang tạo đề..." : "Tạo đề từ câu hỏi đã chọn"}
        </button>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Lọc câu hỏi</h2>

        <div style={filterBox}>
          <div style={filterGrid}>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              style={inputStyle}
            >
              <option value="">Tất cả môn</option>
              {TEACHER_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>

            <input
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              placeholder="Lọc theo khối/lớp"
              style={inputStyle}
            />

            <input
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              placeholder="Lọc theo chủ đề"
              style={inputStyle}
            />

            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              style={inputStyle}
            >
              <option value="">Tất cả độ khó</option>
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>

            <input
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              placeholder="Tìm từ khóa"
              style={inputStyle}
            />
          </div>

          <div style={filterButtonRow}>
            <button type="button" onClick={applyFilters} style={filterBtn}>
              Lọc câu hỏi
            </button>

            <button type="button" onClick={clearFilters} style={clearFilterBtn}>
              Xóa lọc
            </button>

            <button
              type="button"
              onClick={selectAllVisibleQuestions}
              style={selectAllBtn}
            >
              Chọn tất cả đang hiển thị
            </button>

            <button
              type="button"
              onClick={clearSelectedQuestions}
              style={clearSelectedBtn}
            >
              Bỏ chọn tất cả
            </button>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Danh sách câu hỏi</h2>

        {loading ? (
          <div style={emptyState}>Đang tải câu hỏi...</div>
        ) : questions.length === 0 ? (
          <div style={emptyState}>Không có câu hỏi phù hợp.</div>
        ) : (
          <div style={questionList}>
            {questions.map((q, index) => {
              const isSelected = selectedIds.includes(q.id);

              return (
                <article
                  key={q.id}
                  style={{
                    ...questionCard,
                    ...(isSelected ? selectedQuestionCard : {}),
                  }}
                >
                  <div style={questionTop}>
                    <label style={selectQuestionBox}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleQuestion(q.id)}
                      />

                      <span>
                        {isSelected ? "Đã chọn" : "Chọn câu này"}
                      </span>
                    </label>

                    <div style={badgeRow}>
                      <span style={difficultyBadge}>
                        {getDifficultyLabel(q.difficulty)}
                      </span>

                      <span style={visibilityBadge}>
                        {q.visibility === "private"
                          ? "Riêng tư"
                          : "Trong trường"}
                      </span>
                    </div>
                  </div>

                  <div style={questionMeta}>
                    Câu {index + 1} · {q.subject || "--"} ·{" "}
                    {q.grade || "Chưa có khối"} ·{" "}
                    {q.topic || "Chưa có chủ đề"}
                  </div>

                  <div style={questionText}>
                    <MathContent text={q.question} />
                  </div>

                  {q.questionImageUrl && (
                    <img
                      src={q.questionImageUrl}
                      alt={`Hình câu ${index + 1}`}
                      style={questionImage}
                    />
                  )}

                  <div style={answerList}>
                    {(["A", "B", "C", "D"] as const).map((key) => (
                      <div
                        key={key}
                        style={{
                          ...answerItem,
                          ...(q.correct === key ? correctAnswerItem : {}),
                        }}
                      >
                        <b>{key}.</b>
                        <div style={answerContentStyle}>
                          <MathContent text={q[key]} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={correctLine}>
                    Đáp án đúng: <b>{q.correct}</b>
                  </div>

                  {q.explanation && (
                    <div style={explanationBox}>
                      <b>Giải thích:</b>
                      <MathContent text={q.explanation} />
                    </div>
                  )}

                  <div style={footerMeta}>
                    GV: {q.teacherName || q.teacherEmail || "--"} · Tạo lúc:{" "}
                    {formatDate(q.createdAt)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  fontFamily: "Arial, sans-serif",
  color: "#111827",
};

const heroCard: CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#7c3aed)",
  color: "white",
  borderRadius: 24,
  padding: "32px 36px",
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  boxShadow: "0 14px 34px rgba(124,58,237,.18)",
};

const heroKicker: CSSProperties = {
  color: "#ddd6fe",
  fontWeight: 900,
  marginBottom: 10,
};

const heroTitle: CSSProperties = {
  fontSize: 34,
  margin: 0,
  fontWeight: 900,
};

const heroText: CSSProperties = {
  color: "#ede9fe",
  fontSize: 17,
  marginTop: 14,
  marginBottom: 0,
  lineHeight: 1.6,
};

const heroBadge: CSSProperties = {
  background: "rgba(255,255,255,.16)",
  padding: "14px 18px",
  borderRadius: 999,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const messageStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  marginBottom: 18,
  fontWeight: 900,
};

const cardStyle: CSSProperties = {
  background: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 24,
  boxShadow: "0 10px 28px rgba(15,23,42,.07)",
};

const sectionTitle: CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  margin: "0 0 16px",
};

const testInfoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: 14,
  marginBottom: 14,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  boxSizing: "border-box",
};

const smallTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 90,
  padding: "15px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  resize: "vertical",
  boxSizing: "border-box",
  marginBottom: 14,
};

const selectedSummary: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "#f5f3ff",
  color: "#5b21b6",
  fontWeight: 900,
  marginBottom: 14,
};

const primaryBtn: CSSProperties = {
  width: "100%",
  padding: "15px 18px",
  borderRadius: 14,
  border: "none",
  background: "#7c3aed",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const filterBox: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
};

const filterGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
  marginBottom: 12,
};

const filterButtonRow: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const filterBtn: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: "#0f172a",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const clearFilterBtn: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
};

const selectAllBtn: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const clearSelectedBtn: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  cursor: "pointer",
};

const emptyState: CSSProperties = {
  padding: 28,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 700,
};

const questionList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const questionCard: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 20,
  background: "#ffffff",
  boxShadow: "0 8px 20px rgba(15,23,42,.04)",
};

const selectedQuestionCard: CSSProperties = {
  border: "2px solid #7c3aed",
  background: "#f5f3ff",
};

const questionTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 12,
};

const selectQuestionBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 900,
  color: "#334155",
  cursor: "pointer",
};

const badgeRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const difficultyBadge: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#1e40af",
  fontWeight: 900,
};

const visibilityBadge: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#334155",
  fontWeight: 900,
};

const questionMeta: CSSProperties = {
  color: "#64748b",
  marginBottom: 12,
};

const questionText: CSSProperties = {
  fontWeight: 800,
  lineHeight: 1.7,
  marginBottom: 12,
  whiteSpace: "pre-wrap",
};

const questionImage: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 360,
  objectFit: "contain",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  margin: "12px 0 16px",
};

const answerList: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const answerItem: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  padding: 12,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  lineHeight: 1.6,
};

const answerContentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const correctAnswerItem: CSSProperties = {
  border: "1px solid #22c55e",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 800,
};

const correctLine: CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  background: "#eff6ff",
  color: "#1e40af",
  fontWeight: 900,
};

const explanationBox: CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  lineHeight: 1.7,
};

const footerMeta: CSSProperties = {
  marginTop: 14,
  color: "#94a3b8",
  fontSize: 13,
};