"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  auth,
} from "@/lib/firebase/client";
import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

import styles from "./page.module.css";

type TeacherRole = "admin" | "teacher";
type TeacherStatus = "active" | "locked";

type Teacher = {
  id?: string;
  email: string;
  name: string;
  role: TeacherRole;
  status: TeacherStatus;
  subject: string;
  schoolId: string;
  createdAt?: string;
  updatedAt?: string;
};

type AdminTeachersResponse = {
  status: "success";
  teachers: Teacher[];
};

type AdminTeacherMutationResponse = {
  status: "success";
  teacher?: Teacher;
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

async function adminApi<TResponse>(
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
      Authorization: "Bearer " + token,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error("Admin API không trả JSON:", {
      url,
      status: response.status,
      text: text.slice(0, 500),
    });

    throw new Error("API " + url + " không trả về JSON. Status: " + response.status + ".");
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API admin.");
  }

  return data as TResponse;
}

function formatDate(value?: string) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getMessageClass(message: string) {
  if (message.includes("thành công") || message.includes("Đã")) {
    return styles.message + " " + styles.messageSuccess;
  }

  if (message.includes("Đang")) {
    return styles.message + " " + styles.messageInfo;
  }

  return styles.message + " " + styles.messageError;
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState("");
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Toán");

  const teacherStats = useMemo(() => {
    const activeCount = teachers.filter(
      (teacher) => teacher.status === "active"
    ).length;
    const lockedCount = teachers.filter(
      (teacher) => teacher.status === "locked"
    ).length;
    const adminCount = teachers.filter(
      (teacher) => teacher.role === "admin"
    ).length;

    return {
      activeCount,
      lockedCount,
      adminCount,
    };
  }, [teachers]);

  async function loadTeachers() {
    setLoading(true);
    setMessage("");

    try {
      const data = await adminApi<AdminTeachersResponse>("/api/admin/teachers", {
        method: "GET",
      });

      const list = data.teachers || [];
      list.sort((a, b) => a.email.localeCompare(b.email));
      setTeachers(list);
    } catch (error: any) {
      setMessage(error?.message || "Không tải được danh sách giáo viên.");
    } finally {
      setLoading(false);
    }
  }

  async function addTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const teacherName = name.trim();

    if (!normalizedEmail) {
      setMessage("Vui lòng nhập email giáo viên.");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setMessage("Email giáo viên không hợp lệ.");
      return;
    }

    if (!teacherName) {
      setMessage("Vui lòng nhập họ tên giáo viên.");
      return;
    }

    try {
      setAdding(true);

      const result = await adminApi<AdminTeacherMutationResponse>(
        "/api/admin/teachers",
        {
          method: "POST",
          body: JSON.stringify({
            email: normalizedEmail,
            name: teacherName,
            subject,
            role: "teacher",
            status: "active",
          }),
        }
      );

      setEmail("");
      setName("");
      setSubject("Toán");
      setMessage(result.message || "Đã thêm giáo viên thành công.");
      await loadTeachers();
    } catch (error: any) {
      setMessage(error?.message || "Không thêm được giáo viên.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleStatus(teacher: Teacher) {
    if (teacher.role === "admin") {
      setMessage("Không thể khóa tài khoản admin từ giao diện này.");
      return;
    }

    const newStatus: TeacherStatus =
      teacher.status === "active" ? "locked" : "active";

    try {
      setUpdatingEmail(teacher.email);
      setMessage("");

      const result = await adminApi<AdminTeacherMutationResponse>(
        "/api/admin/teachers",
        {
          method: "PATCH",
          body: JSON.stringify({
            email: teacher.email,
            status: newStatus,
          }),
        }
      );

      setMessage(
        result.message ||
          (newStatus === "active"
            ? "Đã mở khóa giáo viên."
            : "Đã khóa giáo viên.")
      );

      await loadTeachers();
    } catch (error: any) {
      setMessage(error?.message || "Không cập nhật được trạng thái.");
    } finally {
      setUpdatingEmail("");
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setMessage("Vui lòng đăng nhập bằng tài khoản admin.");
        setLoading(false);
        return;
      }

      await loadTeachers();
    });

    return () => unsub();
  }, []);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.kicker}>Quản trị hệ thống</div>
          <h1>Quản lý giáo viên</h1>
          <p>
            Thêm giáo viên bằng email Google, theo dõi vai trò và kiểm soát trạng thái tài khoản trong cùng một màn hình.
          </p>
        </div>

        <div className={styles.heroBadge}>{teachers.length} tài khoản</div>
      </section>

      <section className={styles.statsGrid} aria-label="Thống kê giáo viên">
        <div className={styles.statCard}>
          <span>Tổng giáo viên</span>
          <strong>{teachers.length}</strong>
        </div>

        <div className={styles.statCard}>
          <span>Đang hoạt động</span>
          <strong className={styles.goodText}>{teacherStats.activeCount}</strong>
        </div>

        <div className={styles.statCard}>
          <span>Đã khóa</span>
          <strong className={styles.dangerText}>{teacherStats.lockedCount}</strong>
        </div>

        <div className={styles.statCard}>
          <span>Admin</span>
          <strong>{teacherStats.adminCount}</strong>
        </div>
      </section>

      {message && <div className={getMessageClass(message)}>{message}</div>}

      <section className={styles.contentGrid}>
        <form className={styles.formCard} onSubmit={addTeacher}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>+</div>
            <div>
              <h2>Thêm giáo viên</h2>
              <p>Tài khoản mới được tạo với vai trò giáo viên và trạng thái đang hoạt động.</p>
            </div>
          </div>

          <div className={styles.cardBody}>
            <label className={styles.field}>
              <span>Email Google</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teacher@school.edu.vn"
                autoComplete="email"
              />
            </label>

            <label className={styles.field}>
              <span>Họ và tên</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nguyễn Văn A"
                autoComplete="name"
              />
            </label>

            <label className={styles.field}>
              <span>Môn phụ trách</span>
              <select
                value={getSubjectOption(subject)}
                onChange={(event) => setSubject(event.target.value)}
              >
                {TEACHER_SUBJECTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {getSubjectOption(subject) === OTHER_SUBJECT ? (
                <input
                  value={subject === OTHER_SUBJECT ? "" : subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Nhập tên môn học"
                />
              ) : null}
            </label>

            <button
              className={styles.primaryButton}
              type="submit"
              disabled={adding}
            >
              {adding ? "Đang thêm..." : "Thêm giáo viên"}
            </button>
          </div>
        </form>

        <section className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>GV</div>
            <div>
              <h2>Danh sách giáo viên</h2>
              <p>Admin có thể khóa hoặc mở khóa tài khoản giáo viên khi cần.</p>
            </div>
            <span className={styles.countBadge}>{teachers.length} giáo viên</span>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Đang tải danh sách giáo viên...</div>
          ) : teachers.length === 0 ? (
            <div className={styles.emptyState}>Chưa có giáo viên nào trong hệ thống.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Họ tên</th>
                    <th>Môn</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {teachers.map((teacher) => (
                    <tr key={teacher.email}>
                      <td>
                        <strong className={styles.emailCell}>{teacher.email}</strong>
                      </td>
                      <td>{teacher.name || "--"}</td>
                      <td>
                        <span className={styles.subjectBadge}>{teacher.subject || "--"}</span>
                      </td>
                      <td>
                        <span
                          className={
                            teacher.role === "admin"
                              ? styles.badge + " " + styles.adminBadge
                              : styles.badge + " " + styles.teacherBadge
                          }
                        >
                          {teacher.role === "admin" ? "Admin" : "Giáo viên"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            teacher.status === "active"
                              ? styles.badge + " " + styles.activeBadge
                              : styles.badge + " " + styles.lockedBadge
                          }
                        >
                          {teacher.status === "active" ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td>{formatDate(teacher.createdAt)}</td>
                      <td>
                        {teacher.role === "admin" ? (
                          <span className={styles.mutedText}>Không thao tác</span>
                        ) : (
                          <button
                            className={
                              teacher.status === "active"
                                ? styles.dangerButton
                                : styles.successButton
                            }
                            type="button"
                            onClick={() => toggleStatus(teacher)}
                            disabled={updatingEmail === teacher.email}
                          >
                            {updatingEmail === teacher.email
                              ? "Đang xử lý..."
                              : teacher.status === "active"
                                ? "Khóa"
                                : "Mở khóa"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
