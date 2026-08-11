"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

type TeacherProfile = {
  email: string;
  name: string;
  role: "admin" | "teacher";
  status: "active" | "locked";
  subject?: string;
  schoolId?: string;
  picture?: string;
};

type TeacherRegisterResponse = {
  status: "success";
  teacher: TeacherProfile;
  message: string;
};

const OTHER_SUBJECT = "Khác";

function getSubjectOption(value: string): string {
  return TEACHER_SUBJECTS.includes(
    value as (typeof TEACHER_SUBJECTS)[number]
  )
    ? value
    : OTHER_SUBJECT;
}

export default function TeacherRegisterPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Toán");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setMessage("Vui lòng đăng nhập Google trước.");
        setChecking(false);
        router.push("/login");
        return;
      }

      setName(currentUser.displayName || "");
      setChecking(false);
    });

    return () => unsub();
  }, [router]);

  async function registerTeacher() {
    setMessage("");

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setMessage("Bạn chưa đăng nhập.");
      return;
    }

    const cleanName = name.trim();

    if (!cleanName) {
      setMessage("Vui lòng nhập họ và tên giáo viên.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("Đang hoàn tất hồ sơ giáo viên...");

      const token = await currentUser.getIdToken();

      const response = await fetch("/api/teacher/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: cleanName,
          subject,
        }),
      });

      const text = await response.text();

      let data: TeacherRegisterResponse | any = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        console.error("Register API không trả JSON:", text);
        throw new Error("API đăng ký không trả JSON. Kiểm tra terminal server.");
      }

      if (!response.ok || data?.status === "error") {
        throw new Error(data?.message || "Không đăng ký được giáo viên.");
      }

      setMessage(data.message || "Đã hoàn tất hồ sơ giáo viên.");

      router.push("/teacher/dashboard");
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "Không đăng ký được giáo viên.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1>Đang kiểm tra tài khoản...</h1>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCard}>
        <div>
          <div style={heroKicker}>KIEMTRA.AI</div>
          <h1 style={heroTitle}>Hoàn tất hồ sơ giáo viên</h1>
          <p style={heroText}>
            Vui lòng nhập họ tên và chọn môn giảng dạy để bắt đầu sử dụng hệ
            thống.
          </p>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={accountBox}>
          <div style={avatarStyle}>
            {(user?.displayName || user?.email || "GV").slice(0, 2).toUpperCase()}
          </div>

          <div>
            <div style={accountName}>
              {user?.displayName || "Giáo viên FPT"}
            </div>
            <div style={accountEmail}>{user?.email}</div>
          </div>
        </div>

        <label style={labelStyle}>Họ và tên giáo viên</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nhập họ và tên"
          style={inputStyle}
        />

        <label style={labelStyle}>Môn giảng dạy</label>
        <select
          value={getSubjectOption(subject)}
          onChange={(e) => setSubject(e.target.value)}
          style={inputStyle}
        >
          {TEACHER_SUBJECTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {getSubjectOption(subject) === OTHER_SUBJECT && (
          <>
            <label style={labelStyle}>Tên môn học</label>
            <input
              value={subject === OTHER_SUBJECT ? "" : subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Nhập tên môn học"
              style={inputStyle}
            />
          </>
        )}

        <button
          type="button"
          onClick={registerTeacher}
          disabled={submitting}
          style={{
            ...primaryBtn,
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Đang xử lý..." : "Hoàn tất đăng ký"}
        </button>

        {message && (
          <div
            style={{
              ...messageStyle,
              background:
                message.includes("Đã") || message.includes("hoàn tất")
                  ? "#dcfce7"
                  : message.includes("Đang")
                  ? "#dbeafe"
                  : "#fee2e2",
              color:
                message.includes("Đã") || message.includes("hoàn tất")
                  ? "#166534"
                  : message.includes("Đang")
                  ? "#1e40af"
                  : "#991b1b",
            }}
          >
            {message}
          </div>
        )}

        <div style={noteBox}>
          Chỉ tài khoản email có đuôi <b>@fpt.edu.vn</b> mới được phép tự đăng
          ký giáo viên.
        </div>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  fontFamily: "Arial, sans-serif",
  color: "#111827",
};

const heroCard: CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1d4ed8)",
  color: "white",
  borderRadius: 24,
  padding: "32px 36px",
  marginBottom: 24,
  boxShadow: "0 14px 34px rgba(30,64,175,.18)",
};

const heroKicker: CSSProperties = {
  color: "#bfdbfe",
  fontWeight: 900,
  marginBottom: 10,
};

const heroTitle: CSSProperties = {
  fontSize: 34,
  margin: 0,
  fontWeight: 900,
};

const heroText: CSSProperties = {
  color: "#dbeafe",
  fontSize: 17,
  marginTop: 14,
  marginBottom: 0,
  lineHeight: 1.6,
};

const cardStyle: CSSProperties = {
  background: "white",
  padding: 28,
  borderRadius: 24,
  maxWidth: 620,
  boxShadow: "0 10px 28px rgba(15,23,42,.07)",
};

const accountBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: 18,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  marginBottom: 22,
};

const avatarStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#2563eb,#22c55e)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 22,
  flexShrink: 0,
};

const accountName: CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
};

const accountEmail: CSSProperties = {
  color: "#64748b",
  marginTop: 4,
  fontWeight: 700,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 900,
  marginBottom: 8,
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
  padding: "15px 18px",
  borderRadius: 14,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
};

const messageStyle: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  fontWeight: 900,
};

const noteBox: CSSProperties = {
  marginTop: 18,
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#475569",
  lineHeight: 1.6,
};