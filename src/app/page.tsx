import Link from "next/link";
import type { CSSProperties } from "react";

export default function AdminPage() {
  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial",
        background: "#eef4ff",
        minHeight: "100vh",
      }}
    >
      <h1>Admin Dashboard</h1>
      <p>Đăng nhập Admin thành công.</p>

      <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
        <Link href="/admin/teachers" style={cardStyle}>
          Quản lý giáo viên
        </Link>

        <Link href="/teacher/classes" style={cardStyle}>
          Quản lý lớp học
        </Link>

        <Link href="/teacher/tests" style={cardStyle}>
          Quản lý đề kiểm tra
        </Link>

        <Link href="/teacher/assignments" style={cardStyle}>
          Giao đề cho lớp
        </Link>
      </div>
    </main>
  );
}

const cardStyle: CSSProperties = {
  display: "block",
  background: "white",
  padding: 20,
  borderRadius: 18,
  textDecoration: "none",
  color: "#1e40af",
  fontWeight: "bold",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
};