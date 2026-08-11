"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type TeacherShellProps = {
  children: ReactNode;
};

type TeacherProfile = {
  email: string;
  name: string;
  role: "admin" | "teacher";
  status: "active" | "locked";
  subject?: string;
  schoolId?: string;
  picture?: string;
};

type TeacherMeResponse =
  | {
      status: "success";
      teacher: TeacherProfile;
    }
  | {
      status: "needs_registration";
      email: string;
      name?: string;
      picture?: string;
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

type MenuItem = {
  href: string;
  label: string;
  icon: string;
};

const teacherMenuItems: MenuItem[] = [
  {
    href: "/teacher/dashboard",
    label: "Trang chủ",
    icon: "🏠",
  },
  {
    href: "/teacher/tests",
    label: "Tạo đề",
    icon: "📝",
  },
  {
    href: "/teacher/question-bank",
    label: "Ngân hàng câu hỏi",
    icon: "🗂️",
  },
  {
    href: "/teacher/classes",
    label: "Quản lý lớp học",
    icon: "👥",
  },
  {
    href: "/teacher/assignments",
    label: "Giao đề",
    icon: "🔗",
  },
  {
    href: "/teacher/results",
    label: "Kết quả",
    icon: "📊",
  },
];

const adminMenuItem: MenuItem = {
  href: "/admin/teachers",
  label: "Quản lý giáo viên",
  icon: "🧑‍🏫",
};

async function getTeacherMe(user: User): Promise<TeacherMeResponse> {
  const token = await user.getIdToken();

  const response = await fetch("/api/teacher/me", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();

  let data: TeacherMeResponse | any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error("GET /api/teacher/me không trả JSON:", text);
    throw new Error("Không lấy được thông tin giáo viên.");
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Không lấy được thông tin giáo viên.");
  }

  return data as TeacherMeResponse;
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/admin/teachers")) return "Quản lý giáo viên";
  if (pathname.startsWith("/teacher/tests")) return "Tạo đề";
  if (pathname.startsWith("/teacher/question-bank")) return "Ngân hàng câu hỏi";
  if (pathname.startsWith("/teacher/classes")) return "Quản lý lớp học";
  if (pathname.startsWith("/teacher/assignments")) return "Giao đề";
  if (pathname.startsWith("/teacher/results")) return "Kết quả";
  if (pathname.startsWith("/teacher/register")) return "Hoàn tất hồ sơ";
  return "Trang chủ";
}

function getInitials(name?: string, email?: string) {
  const cleanName = String(name || "").trim();

  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return cleanName.slice(0, 2).toUpperCase();
  }

  const cleanEmail = String(email || "").trim();

  if (cleanEmail) {
    return cleanEmail.slice(0, 2).toUpperCase();
  }

  return "GV";
}

export default function TeacherShell({ children }: TeacherShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const pageTitle = getPageTitle(pathname);

  const [user, setUser] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const isAdmin = teacher?.role === "admin";
  const roleLabel = isAdmin ? "Quản trị viên" : "Giáo viên";
  const avatarText = getInitials(
    teacher?.name || user?.displayName || "",
    teacher?.email || user?.email || ""
  );

  const visibleMenuItems: MenuItem[] = teacher
    ? isAdmin
      ? [...teacherMenuItems, adminMenuItem]
      : teacherMenuItems
    : [];

  useEffect(() => {
    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (cancelled) return;

      setUser(currentUser);
      setAccountOpen(false);

      if (!currentUser) {
        setTeacher(null);
        setAuthReady(true);
        return;
      }

      try {
        const result = await getTeacherMe(currentUser);

        if (cancelled) return;

        if (result.status === "needs_registration") {
          setTeacher(null);
          setAuthReady(true);

          if (!pathname.startsWith("/teacher/register")) {
            router.push("/teacher/register");
          }

          return;
        }

        if (result.status === "success") {
          setTeacher(result.teacher);
          setAuthReady(true);
          return;
        }

        setTeacher(null);
        setAuthReady(true);
      } catch (error) {
        console.error("TeacherShell getTeacherMe error:", error);

        if (!cancelled) {
          setTeacher(null);
          setAuthReady(true);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [pathname, router]);

  async function handleLogout() {
    await signOut(auth);

    setUser(null);
    setTeacher(null);
    setAccountOpen(false);

    router.push("/login");
  }

  return (
    <div style={shellStyle}>
      <aside style={sidebarStyle}>
        <div style={brandBox}>
          <div style={brandIcon}>K</div>

          <div>
            <div style={brandTitle}>KIEMTRA.AI</div>
            <div style={brandSubtitle}>Teacher Dashboard</div>
          </div>
        </div>

        <nav style={navStyle}>
          {visibleMenuItems.length === 0 ? (
            <div style={emptyMenuStyle}>
              Hoàn tất hồ sơ giáo viên để sử dụng hệ thống.
            </div>
          ) : (
            visibleMenuItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...navItemStyle,
                    ...(active ? activeNavItemStyle : {}),
                  }}
                >
                  <span style={navIconStyle}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })
          )}
        </nav>

        <div style={sidebarFooter}>
          <b>KIEMTRA.AI V3.0</b>
          <br />
          Hệ thống kiểm tra trực tuyến
        </div>
      </aside>

      <div style={mainAreaStyle}>
        <header style={topbarStyle}>
          <div>
            <div style={pageKicker}>Màn hình chính</div>
            <div style={pageTitleStyle}>{pageTitle}</div>
          </div>

          <div style={topbarActionsStyle}>
            <div style={versionPill}>V3.0 Teacher</div>

            <div style={accountWrapperStyle}>
              {!authReady ? (
                <button type="button" style={loginButtonStyle} disabled>
                  <div style={avatarStyle}>...</div>

                  <div style={accountTextStyle}>
                    <div style={userNameStyle}>Đang tải</div>
                    <div style={userRoleStyle}>Kiểm tra tài khoản</div>
                  </div>
                </button>
              ) : !user ? (
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  style={loginButtonStyle}
                >
                  <div style={avatarStyle}>👤</div>

                  <div style={accountTextStyle}>
                    <div style={userNameStyle}>Tài khoản</div>
                    <div style={userRoleStyle}>Đăng nhập</div>
                  </div>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((prev) => !prev)}
                    style={accountButtonStyle}
                  >
                    <div style={avatarStyle}>{avatarText}</div>

                    <div style={accountTextStyle}>
                      <div style={userNameStyle}>
                        {teacher?.name || user.displayName || "Giáo viên"}
                      </div>

                      <div style={userRoleStyle}>
                        {teacher ? roleLabel : "Chưa hoàn tất hồ sơ"}
                      </div>
                    </div>
                  </button>

                  {accountOpen && (
                    <div style={accountMenuStyle}>
                      <div style={accountMenuHeaderStyle}>
                        <div style={bigAvatarStyle}>{avatarText}</div>

                        <div style={{ minWidth: 0 }}>
                          <div style={accountNameStyle}>
                            {teacher?.name || user.displayName || "Giáo viên"}
                          </div>

                          <div style={accountEmailStyle}>
                            {teacher?.email || user.email || ""}
                          </div>

                          <div
                            style={{
                              ...accountRoleBadgeStyle,
                              background: isAdmin ? "#fef3c7" : "#dbeafe",
                              color: isAdmin ? "#92400e" : "#1e40af",
                            }}
                          >
                            {teacher ? roleLabel : "Chưa hoàn tất hồ sơ"}
                          </div>
                        </div>
                      </div>

                      {teacher && (
                        <div style={profileInfoBox}>
                          <div>
                            <span style={profileLabel}>Môn:</span>{" "}
                            <b>{teacher.subject || "--"}</b>
                          </div>

                          <div>
                            <span style={profileLabel}>Trạng thái:</span>{" "}
                            <b>
                              {teacher.status === "active"
                                ? "Đang hoạt động"
                                : "Đã khóa"}
                            </b>
                          </div>
                        </div>
                      )}

                      {!teacher && (
                        <button
                          type="button"
                          onClick={() => {
                            setAccountOpen(false);
                            router.push("/teacher/register");
                          }}
                          style={accountMenuItemStyle}
                        >
                          Hoàn tất hồ sơ giáo viên
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setAccountOpen(false);
                            router.push("/admin/teachers");
                          }}
                          style={accountMenuItemStyle}
                        >
                          Quản lý giáo viên
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleLogout}
                        style={logoutMenuItemStyle}
                      >
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </header>

        <main style={contentStyle}>{children}</main>
      </div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#eef4ff",
  display: "grid",
  gridTemplateColumns: "300px minmax(0, 1fr)",
  fontFamily: "Arial, sans-serif",
  color: "#111827",
  width: "100%",
  overflowX: "hidden",
};

const sidebarStyle: CSSProperties = {
  background: "linear-gradient(180deg,#1e40af,#1d3fb0)",
  color: "white",
  minHeight: "100vh",
  padding: "24px 20px",
  position: "sticky",
  top: 0,
  display: "flex",
  flexDirection: "column",
  boxShadow: "8px 0 30px rgba(30,64,175,.18)",
};

const brandBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "8px 8px 24px",
  borderBottom: "1px solid rgba(255,255,255,.18)",
  marginBottom: 24,
};

const brandIcon: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 18,
  background: "rgba(255,255,255,.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  fontWeight: 900,
};

const brandTitle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const brandSubtitle: CSSProperties = {
  fontSize: 14,
  opacity: 0.8,
  marginTop: 4,
};

const navStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const navItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "16px 18px",
  borderRadius: 16,
  color: "rgba(255,255,255,.86)",
  textDecoration: "none",
  fontSize: 17,
  fontWeight: 800,
};

const activeNavItemStyle: CSSProperties = {
  background: "white",
  color: "#1e40af",
  boxShadow: "0 10px 24px rgba(15,23,42,.16)",
};

const navIconStyle: CSSProperties = {
  width: 26,
  textAlign: "center",
};

const emptyMenuStyle: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,.12)",
  color: "rgba(255,255,255,.86)",
  lineHeight: 1.6,
  fontWeight: 700,
};

const sidebarFooter: CSSProperties = {
  marginTop: "auto",
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,.12)",
  fontSize: 14,
  lineHeight: 1.6,
};

const mainAreaStyle: CSSProperties = {
  minWidth: 0,
  width: "100%",
  overflowX: "hidden",
};

const topbarStyle: CSSProperties = {
  height: 104,
  padding: "0 34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const pageKicker: CSSProperties = {
  color: "#64748b",
  fontSize: 15,
  marginBottom: 6,
};

const pageTitleStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  color: "#111827",
};

const topbarActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const versionPill: CSSProperties = {
  background: "white",
  borderRadius: 999,
  padding: "14px 22px",
  color: "#1e40af",
  fontWeight: 900,
  boxShadow: "0 6px 18px rgba(15,23,42,.08)",
};

const accountWrapperStyle: CSSProperties = {
  position: "relative",
};

const accountButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: "white",
  border: "none",
  borderRadius: 999,
  padding: "10px 18px 10px 10px",
  boxShadow: "0 6px 18px rgba(15,23,42,.08)",
  cursor: "pointer",
};

const loginButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: "white",
  border: "none",
  borderRadius: 999,
  padding: "10px 18px 10px 10px",
  boxShadow: "0 6px 18px rgba(15,23,42,.08)",
  cursor: "pointer",
};

const avatarStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#2563eb,#22c55e)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const userNameStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 17,
};

const userRoleStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
};

const accountTextStyle: CSSProperties = {
  textAlign: "left",
};

const accountMenuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 12px)",
  right: 0,
  zIndex: 50,
  width: 360,
  background: "white",
  borderRadius: 24,
  boxShadow: "0 20px 50px rgba(15,23,42,.18)",
  border: "1px solid #e5e7eb",
  padding: 16,
};

const accountMenuHeaderStyle: CSSProperties = {
  display: "flex",
  gap: 14,
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  marginBottom: 12,
};

const bigAvatarStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#2563eb,#22c55e)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 20,
  flexShrink: 0,
};

const accountNameStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
  color: "#111827",
  marginBottom: 4,
};

const accountEmailStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
  overflowWrap: "anywhere",
  marginBottom: 8,
};

const accountRoleBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
};

const profileInfoBox: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#334155",
  lineHeight: 1.7,
  marginBottom: 10,
};

const profileLabel: CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};

const accountMenuItemStyle: CSSProperties = {
  width: "100%",
  border: "none",
  background: "white",
  padding: "13px 14px",
  borderRadius: 14,
  textAlign: "left",
  fontWeight: 900,
  color: "#334155",
  cursor: "pointer",
  marginTop: 6,
};

const logoutMenuItemStyle: CSSProperties = {
  width: "100%",
  border: "none",
  background: "#fee2e2",
  padding: "13px 14px",
  borderRadius: 14,
  textAlign: "left",
  fontWeight: 900,
  color: "#991b1b",
  cursor: "pointer",
  marginTop: 8,
};

const contentStyle: CSSProperties = {
  padding: "18px 34px 50px",
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  minWidth: 0,
};