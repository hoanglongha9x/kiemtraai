"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  BookOpen,
  CheckCircle2,
  Edit3,
  Loader2,
  Lock,
  MoveRight,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
} from "lucide-react";

import { Button, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase/client";

import styles from "./page.module.css";

type TeacherProfile = {
  email: string;
  name: string;
  role: "admin" | "teacher";
  status: "active" | "locked";
  subject?: string;
  schoolId?: string;
};

type TeacherMeResponse = {
  status: "success";
  teacher: TeacherProfile;
};

type ClassItem = {
  id: string;
  className: string;
  grade: string;
  schoolYear: string;
  teacherEmail: string;
  teacherName: string;
  schoolId: string;
  status: "active" | "locked" | "deleted";
  studentCount?: number;
  createdAt: string;
  updatedAt?: string;
};

type StudentItem = {
  id: string;
  studentCode: string;
  studentName: string;
  gender: string;
  classId: string;
  className: string;
  teacherEmail: string;
  status: "active" | "locked" | "deleted";
  createdAt: string;
};

type TeacherClassesResponse = {
  status: "success";
  classes: ClassItem[];
};

type CreateClassResponse = {
  status: "success";
  classId: string;
  classItem: ClassItem;
  message: string;
};

type UpdateClassResponse = {
  status: "success";
  message: string;
};

type TeacherStudentsResponse = {
  status: "success";
  students: StudentItem[];
};

type CreateStudentsResponse = {
  status: "success";
  count: number;
  students: StudentItem[];
  message: string;
};

type UpdateStudentResponse = {
  status: "success";
  message: string;
};

const GRADES = ["6", "7", "8", "9", "10", "11", "12"];
const SCHOOL_YEAR_OPTIONS = ["2026-2027", "2025-2026", "2024-2025"];

function normalizeSchoolYear(value: string): string {
  return value
    .trim()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "");
}

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

    throw new Error(`API ${url} không trả về JSON. Status: ${response.status}.`);
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API.");
  }

  return data as TResponse;
}

function getStatusText(status?: string) {
  if (status === "active") return "Đang dùng";
  if (status === "locked") return "Đã khóa";
  if (status === "deleted") return "Đã xóa";
  return status || "--";
}

function getMessageType(message: string): "info" | "success" | "error" {
  if (message.includes("Đang")) return "info";
  if (message.includes("thành công") || message.includes("Đã")) return "success";
  return "error";
}

export default function TeacherClassesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  const [editClassName, setEditClassName] = useState("");
  const [editGrade, setEditGrade] = useState("10");
  const [editSchoolYear, setEditSchoolYear] = useState("");

  const [className, setClassName] = useState("");
  const [grade, setGrade] = useState("10");
  const [schoolYear, setSchoolYear] = useState("2026-2027");

  const [studentCode, setStudentCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [gender, setGender] = useState("Nam");
  const [bulkText, setBulkText] = useState("");
  const [actionStudent, setActionStudent] = useState<StudentItem | null>(null);
  const [studentActionMode, setStudentActionMode] = useState<
    "transfer_school" | "transfer_class" | null
  >(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeClassCount = useMemo(
    () => classes.filter((item) => item.status === "active").length,
    [classes]
  );
  const lockedClassCount = useMemo(
    () => classes.filter((item) => item.status === "locked").length,
    [classes]
  );
  const totalStudents = useMemo(
    () => classes.reduce((sum, item) => sum + (item.studentCount || 0), 0),
    [classes]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser?.email) {
        setMessage("Vui lòng đăng nhập Google trước.");
        setLoading(false);
        return;
      }

      await loadProfile();
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function loadProfile() {
    try {
      const data = await teacherApi<TeacherMeResponse>("/api/teacher/me", {
        method: "GET",
      });

      setProfile(data.teacher);
      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không tải được thông tin giáo viên.");
    }
  }

  async function loadClasses() {
    try {
      setMessage("");
      const data = await teacherApi<TeacherClassesResponse>(
        "/api/teacher/classes",
        { method: "GET" }
      );

      setClasses(data.classes || []);
    } catch (error: any) {
      setMessage(error?.message || "Không tải được danh sách lớp.");
    }
  }

  async function createClass() {
    if (!profile || !user?.email) {
      setMessage("Vui lòng đăng nhập lại.");
      return;
    }

    const cleanClassName = className.trim();
    const cleanGrade = grade.trim();
    const cleanSchoolYear = normalizeSchoolYear(schoolYear);

    if (!cleanClassName || !cleanGrade || !cleanSchoolYear) {
      setMessage("Vui lòng nhập đầy đủ tên lớp, khối lớp và năm học.");
      return;
    }

    try {
      setBusy(true);
      setMessage("Đang tạo lớp...");
      const result = await teacherApi<CreateClassResponse>("/api/teacher/classes", {
        method: "POST",
        body: JSON.stringify({
          className: cleanClassName,
          grade: cleanGrade,
          schoolYear: cleanSchoolYear,
        }),
      });

      setClassName("");
      setMessage(result.message || "Đã tạo lớp thành công.");
      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không tạo được lớp.");
    } finally {
      setBusy(false);
    }
  }

  function startEditClass(item: ClassItem) {
    setEditingClass(item);
    setEditClassName(item.className || "");
    setEditGrade(item.grade || "10");
    setEditSchoolYear(normalizeSchoolYear(item.schoolYear || ""));
    setMessage("");
  }

  function cancelEditClass() {
    setEditingClass(null);
    setEditClassName("");
    setEditGrade("10");
    setEditSchoolYear("");
  }

  async function updateClass() {
    if (!editingClass) {
      setMessage("Vui lòng chọn lớp cần sửa.");
      return;
    }

    const cleanClassName = editClassName.trim();
    const cleanGrade = editGrade.trim();
    const cleanSchoolYear = normalizeSchoolYear(editSchoolYear);

    if (!cleanClassName || !cleanGrade || !cleanSchoolYear) {
      setMessage("Vui lòng nhập đầy đủ tên lớp, khối lớp và năm học.");
      return;
    }

    try {
      setBusy(true);
      setMessage("Đang cập nhật lớp...");
      const result = await teacherApi<UpdateClassResponse>("/api/teacher/classes", {
        method: "PATCH",
        body: JSON.stringify({
          action: "update",
          classId: editingClass.id,
          className: cleanClassName,
          grade: cleanGrade,
          schoolYear: cleanSchoolYear,
        }),
      });

      setMessage(result.message || "Đã cập nhật lớp.");
      cancelEditClass();
      await loadClasses();

      if (selectedClass?.id === editingClass.id) {
        setSelectedClass({
          ...editingClass,
          className: cleanClassName,
          grade: cleanGrade,
          schoolYear: cleanSchoolYear,
        });
      }
    } catch (error: any) {
      setMessage(error?.message || "Không cập nhật được lớp.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteClass(item: ClassItem) {
    const ok = window.confirm(
      `Bạn có chắc muốn xóa lớp "${item.className}" không?\n\nLớp sẽ bị ẩn khỏi danh sách, nhưng dữ liệu cũ vẫn được giữ trong Firestore.`
    );

    if (!ok) return;

    try {
      setBusy(true);
      setMessage("Đang xóa lớp...");
      const result = await teacherApi<UpdateClassResponse>("/api/teacher/classes", {
        method: "PATCH",
        body: JSON.stringify({
          action: "delete",
          classId: item.id,
        }),
      });

      setMessage(result.message || "Đã xóa lớp.");

      if (selectedClass?.id === item.id) {
        setSelectedClass(null);
        setStudents([]);
      }

      if (editingClass?.id === item.id) {
        cancelEditClass();
      }

      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không xóa được lớp.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleClassStatus(item: ClassItem) {
    const action = item.status === "active" ? "lock" : "unlock";

    try {
      setBusy(true);
      setMessage(action === "lock" ? "Đang khóa lớp..." : "Đang mở khóa lớp...");
      const result = await teacherApi<UpdateClassResponse>("/api/teacher/classes", {
        method: "PATCH",
        body: JSON.stringify({
          action,
          classId: item.id,
        }),
      });

      setMessage(result.message || "Đã cập nhật trạng thái lớp.");

      if (selectedClass?.id === item.id) {
        setSelectedClass({
          ...item,
          status: action === "lock" ? "locked" : "active",
        });
      }

      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không cập nhật được trạng thái lớp.");
    } finally {
      setBusy(false);
    }
  }

  async function selectClass(item: ClassItem) {
    setSelectedClass(item);
    setMessage("");
    await loadStudents(item.id);
  }

  async function loadStudents(classId: string) {
    try {
      const data = await teacherApi<TeacherStudentsResponse>(
        `/api/teacher/students?classId=${encodeURIComponent(classId)}`,
        { method: "GET" }
      );

      const list = data.students || [];
      list.sort((a, b) => a.studentCode.localeCompare(b.studentCode));
      setStudents(list);
    } catch (error: any) {
      setMessage(error?.message || "Không tải được danh sách học sinh.");
    }
  }

  async function addStudent() {
    if (!profile || !selectedClass) {
      setMessage("Vui lòng chọn lớp trước.");
      return;
    }

    if (selectedClass.status !== "active") {
      setMessage("Lớp này đang bị khóa, không thể thêm học sinh.");
      return;
    }

    const cleanCode = studentCode.trim().toUpperCase();
    const cleanName = studentName.trim();

    if (!cleanCode || !cleanName) {
      setMessage("Vui lòng nhập mã học sinh và họ tên học sinh.");
      return;
    }

    try {
      setBusy(true);
      setMessage("Đang thêm học sinh...");
      const result = await teacherApi<CreateStudentsResponse>("/api/teacher/students", {
        method: "POST",
        body: JSON.stringify({
          classId: selectedClass.id,
          studentCode: cleanCode,
          studentName: cleanName,
          gender,
        }),
      });

      setStudentCode("");
      setStudentName("");
      setGender("Nam");
      setMessage(result.message || "Đã thêm học sinh thành công.");
      await loadStudents(selectedClass.id);
      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không thêm được học sinh.");
    } finally {
      setBusy(false);
    }
  }

  async function importBulkStudents() {
    if (!profile || !selectedClass) {
      setMessage("Vui lòng chọn lớp trước.");
      return;
    }

    if (selectedClass.status !== "active") {
      setMessage("Lớp này đang bị khóa, không thể import học sinh.");
      return;
    }

    const raw = bulkText.trim();

    if (!raw) {
      setMessage("Vui lòng dán danh sách học sinh cần import.");
      return;
    }

    const studentsToImport = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\t|,|;/).map((item) => item.trim());
        return {
          studentCode: String(parts[0] || "").trim().toUpperCase(),
          studentName: String(parts[1] || "").trim(),
          gender: String(parts[2] || "Nam").trim(),
        };
      })
      .filter((item) => item.studentCode && item.studentName);

    if (studentsToImport.length === 0) {
      setMessage("Không tìm thấy dòng học sinh hợp lệ để import.");
      return;
    }

    try {
      setBusy(true);
      setMessage("Đang import học sinh...");
      const result = await teacherApi<CreateStudentsResponse>("/api/teacher/students", {
        method: "POST",
        body: JSON.stringify({
          classId: selectedClass.id,
          students: studentsToImport,
        }),
      });

      setBulkText("");
      setMessage(
        result.message || `Đã import ${result.count} học sinh vào lớp ${selectedClass.className}.`
      );
      await loadStudents(selectedClass.id);
      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không import được danh sách học sinh.");
    } finally {
      setBusy(false);
    }
  }

  function openStudentAction(item: StudentItem) {
    setActionStudent(item);
    setStudentActionMode(null);
    setTransferTargetClassId("");
    setMessage("");
  }

  function closeStudentAction() {
    setActionStudent(null);
    setStudentActionMode(null);
    setTransferTargetClassId("");
  }

  async function lockStudentForSchoolTransfer(item: StudentItem) {
    const ok = window.confirm(
      `Xác nhận học sinh "${item.studentName}" đã chuyển trường?\n\nHọc sinh sẽ bị khóa và không thể bắt đầu bài kiểm tra mới.`
    );

    if (!ok) return;

    try {
      setBusy(true);
      setMessage("Đang khóa học sinh...");
      const result = await teacherApi<UpdateStudentResponse>("/api/teacher/students", {
        method: "PATCH",
        body: JSON.stringify({
          action: "lock",
          studentId: item.id,
        }),
      });

      setMessage(result.message || "Đã khóa học sinh.");
      closeStudentAction();
      if (selectedClass) {
        await loadStudents(selectedClass.id);
      }
      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không khóa được học sinh.");
    } finally {
      setBusy(false);
    }
  }

  async function unlockStudent(item: StudentItem) {
    try {
      setBusy(true);
      setMessage("Đang mở khóa học sinh...");
      const result = await teacherApi<UpdateStudentResponse>("/api/teacher/students", {
        method: "PATCH",
        body: JSON.stringify({
          action: "unlock",
          studentId: item.id,
        }),
      });

      setMessage(result.message || "Đã mở khóa học sinh.");
      if (selectedClass) {
        await loadStudents(selectedClass.id);
      }
      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không mở khóa được học sinh.");
    } finally {
      setBusy(false);
    }
  }

  async function transferStudentToClass() {
    if (!actionStudent) {
      setMessage("Vui lòng chọn học sinh cần chuyển lớp.");
      return;
    }

    if (!transferTargetClassId) {
      setMessage("Vui lòng chọn lớp chuyển đến.");
      return;
    }

    const targetClass = classes.find((item) => item.id === transferTargetClassId);
    const ok = window.confirm(
      `Chuyển học sinh "${actionStudent.studentName}" sang lớp "${
        targetClass?.className || ""
      }"?\n\nHồ sơ học sinh, bài đang làm và kết quả đã nộp sẽ được cập nhật sang lớp mới.`
    );

    if (!ok) return;

    try {
      setBusy(true);
      setMessage("Đang chuyển lớp học sinh...");
      const result = await teacherApi<UpdateStudentResponse>("/api/teacher/students", {
        method: "PATCH",
        body: JSON.stringify({
          action: "transfer",
          studentId: actionStudent.id,
          targetClassId: transferTargetClassId,
        }),
      });

      setMessage(result.message || "Đã chuyển lớp học sinh.");
      closeStudentAction();
      if (selectedClass) {
        await loadStudents(selectedClass.id);
      }
      await loadClasses();
    } catch (error: any) {
      setMessage(error?.message || "Không chuyển lớp được học sinh.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingState}>
          <Loader2 className={styles.spin} size={24} />
          <span>Đang tải lớp học...</span>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="GIẢNG DẠY"
        title="Lớp học"
        description="Tạo lớp, quản lý trạng thái lớp và import danh sách học sinh cho từng lớp."
        actions={
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={16} />}
            disabled={busy}
            onClick={() => {
              void loadClasses();
            }}
          >
            Làm mới
          </Button>
        }
      />

      {message ? (
        <div className={`${styles.message} ${styles[getMessageType(message)]}`}>
          {message}
        </div>
      ) : null}

      <section className={styles.summaryGrid}>
        <article>
          <BookOpen size={20} />
          <strong>{classes.length}</strong>
          <span>Tổng lớp</span>
        </article>
        <article>
          <CheckCircle2 size={20} />
          <strong>{activeClassCount}</strong>
          <span>Đang dùng</span>
        </article>
        <article>
          <Lock size={20} />
          <strong>{lockedClassCount}</strong>
          <span>Đã khóa</span>
        </article>
        <article>
          <Users size={20} />
          <strong>{totalStudents}</strong>
          <span>Học sinh</span>
        </article>
      </section>

      <section className={styles.workspaceGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Tạo lớp mới</h2>
              <p>Thiết lập lớp theo khối và năm học để giao bài về sau.</p>
            </div>
          </div>

          <div className={styles.formStack}>
            <label>
              <span>Tên lớp</span>
              <input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Ví dụ: 10A1" />
            </label>
            <label>
              <span>Khối lớp</span>
              <select value={grade} onChange={(event) => setGrade(event.target.value)}>
                {GRADES.map((item) => (
                  <option key={item} value={item}>Khối {item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Năm học</span>
              <input list="school-year-options" value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} placeholder="2026-2027" />
              <datalist id="school-year-options">
                {SCHOOL_YEAR_OPTIONS.map((item) => (<option key={item} value={item} />))}
              </datalist>
            </label>
            <Button leftIcon={<Plus size={16} />} disabled={busy} onClick={() => { void createClass(); }}>
              Tạo lớp
            </Button>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Thêm học sinh</h2>
              <p>Chọn một lớp ở danh sách để thêm từng học sinh hoặc import nhanh.</p>
            </div>
          </div>

          {!selectedClass ? (
            <div className={styles.classPickBox}>
              <div className={styles.emptyBox}>
                Chọn một lớp bên dưới để mở form thêm học sinh.
              </div>

              {classes.length === 0 ? (
                <div className={styles.emptyBox}>
                  Chưa có lớp nào. Hãy tạo lớp trước khi thêm học sinh.
                </div>
              ) : (
                <div className={styles.quickClassGrid}>
                  {classes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.quickClassButton}
                      disabled={busy || item.status !== "active"}
                      onClick={() => {
                        void selectClass(item);
                      }}
                    >
                      <strong>{item.className}</strong>
                      <span>
                        Khối {item.grade} · {normalizeSchoolYear(item.schoolYear)}
                      </span>
                      <small>
                        {item.studentCount || 0} học sinh · {getStatusText(item.status)}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.formStack}>
              <div className={styles.selectedBox}>
                <strong>{selectedClass.className}</strong>
                <span>Khối {selectedClass.grade} · {getStatusText(selectedClass.status)}</span>
              </div>

              <div className={styles.formGridThree}>
                <label>
                  <span>Mã học sinh</span>
                  <input value={studentCode} onChange={(event) => setStudentCode(event.target.value)} placeholder="FQN001" />
                </label>
                <label>
                  <span>Họ và tên</span>
                  <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Nguyễn Văn A" />
                </label>
                <label>
                  <span>Giới tính</span>
                  <select value={gender} onChange={(event) => setGender(event.target.value)}>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </label>
              </div>

              <Button leftIcon={<Plus size={16} />} disabled={busy} onClick={() => { void addStudent(); }}>
                Thêm học sinh
              </Button>

              <div className={styles.divider} />

              <label>
                <span>Import học sinh hàng loạt</span>
                <textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={"FQN001\tNguyễn Văn A\tNam\nFQN002\tTrần Thị B\tNữ"} />
              </label>
              <Button variant="secondary" leftIcon={<Upload size={16} />} disabled={busy} onClick={() => { void importBulkStudents(); }}>
                Import học sinh
              </Button>
            </div>
          )}
        </section>
      </section>

      {editingClass ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Sửa thông tin lớp</h2>
              <p>Đang sửa lớp {editingClass.className}.</p>
            </div>
            <Button variant="ghost" leftIcon={<X size={16} />} onClick={cancelEditClass}>Đóng</Button>
          </div>

          <div className={styles.editGrid}>
            <label><span>Tên lớp</span><input value={editClassName} onChange={(event) => setEditClassName(event.target.value)} /></label>
            <label>
              <span>Khối lớp</span>
              <select value={editGrade} onChange={(event) => setEditGrade(event.target.value)}>
                {GRADES.map((item) => (<option key={item} value={item}>Khối {item}</option>))}
              </select>
            </label>
            <label>
              <span>Năm học</span>
              <input
                list="edit-school-year-options"
                value={editSchoolYear}
                onChange={(event) => setEditSchoolYear(event.target.value)}
                placeholder="2026-2027"
              />
              <datalist id="edit-school-year-options">
                {SCHOOL_YEAR_OPTIONS.map((item) => (<option key={item} value={item} />))}
              </datalist>
            </label>
            <Button disabled={busy} onClick={() => { void updateClass(); }}>Lưu thay đổi</Button>
          </div>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Danh sách lớp</h2>
            <p>Xem học sinh, sửa thông tin, khóa hoặc xóa lớp không còn sử dụng.</p>
          </div>
          <span className={styles.countBadge}>{classes.length} lớp</span>
        </div>

        {classes.length === 0 ? (
          <div className={styles.emptyBox}>Chưa có lớp nào.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr><th>Tên lớp</th><th>Khối</th><th>Năm học</th><th>Số HS</th><th>Giáo viên</th><th>Trạng thái</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {classes.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.className}</strong><small>ID: {item.id}</small></td>
                    <td>Khối {item.grade}</td>
                    <td>{normalizeSchoolYear(item.schoolYear)}</td>
                    <td><strong>{item.studentCount || 0}</strong></td>
                    <td><strong>{item.teacherName || "--"}</strong><small>{item.teacherEmail || "--"}</small></td>
                    <td><span className={`${styles.statusBadge} ${styles[`status_${item.status}`]}`}>{getStatusText(item.status)}</span></td>
                    <td>
                      <div className={styles.actionRow}>
                        <button type="button" onClick={() => { void selectClass(item); }}><Users size={14} /> HS</button>
                        <button type="button" onClick={() => startEditClass(item)}><Edit3 size={14} /> Sửa</button>
                        <button type="button" onClick={() => { void toggleClassStatus(item); }}>{item.status === "active" ? <Lock size={14} /> : <Unlock size={14} />}{item.status === "active" ? "Khóa" : "Mở"}</button>
                        <button type="button" className={styles.dangerButton} onClick={() => { void deleteClass(item); }}><Trash2 size={14} /> Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedClass ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Học sinh lớp {selectedClass.className}</h2>
              <p>Danh sách học sinh đang thuộc lớp đã chọn.</p>
            </div>
            <Button variant="outline" leftIcon={<X size={16} />} onClick={() => { setSelectedClass(null); setStudents([]); }}>Đóng</Button>
          </div>

          {students.length === 0 ? (
            <div className={styles.emptyBox}>Chưa có học sinh trong lớp này.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Mã HS</th><th>Họ tên</th><th>Giới tính</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {students.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.studentCode}</strong></td>
                      <td>{item.studentName}</td>
                      <td>{item.gender}</td>
                      <td><span className={`${styles.statusBadge} ${styles[`status_${item.status}`]}`}>{getStatusText(item.status)}</span></td>
                      <td>
                        <div className={styles.actionRow}>
                          {item.status === "locked" ? (
                            <button type="button" onClick={() => { void unlockStudent(item); }}>
                              <Unlock size={14} /> Mở
                            </button>
                          ) : (
                            <button type="button" onClick={() => openStudentAction(item)}>
                              <MoveRight size={14} /> Xử lý
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {actionStudent ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Xử lý học sinh {actionStudent.studentName}</h2>
              <p>
                Chọn đúng tình huống để hệ thống cập nhật trạng thái và dữ liệu lớp của học sinh.
              </p>
            </div>
            <Button variant="ghost" leftIcon={<X size={16} />} onClick={closeStudentAction}>Đóng</Button>
          </div>

          <div className={styles.studentActionGrid}>
            <button
              type="button"
              className={`${styles.studentActionCard} ${
                studentActionMode === "transfer_school" ? styles.selectedActionCard : ""
              }`}
              onClick={() => setStudentActionMode("transfer_school")}
            >
              <Lock size={18} />
              <strong>Học sinh chuyển trường</strong>
              <span>Khóa học sinh, giữ dữ liệu cũ để tra cứu nhưng không cho làm bài mới.</span>
            </button>

            <button
              type="button"
              className={`${styles.studentActionCard} ${
                studentActionMode === "transfer_class" ? styles.selectedActionCard : ""
              }`}
              onClick={() => setStudentActionMode("transfer_class")}
            >
              <MoveRight size={18} />
              <strong>Học sinh chuyển lớp</strong>
              <span>Chọn lớp mới và chuyển hồ sơ, bài đang làm, kết quả sang lớp đó.</span>
            </button>
          </div>

          {studentActionMode === "transfer_school" ? (
            <div className={styles.actionConfirmBox}>
              <p>Học sinh sẽ chuyển sang trạng thái <strong>Đã khóa</strong>.</p>
              <Button
                variant="danger"
                leftIcon={<Lock size={16} />}
                disabled={busy}
                onClick={() => { void lockStudentForSchoolTransfer(actionStudent); }}
              >
                Xác nhận chuyển trường
              </Button>
            </div>
          ) : null}

          {studentActionMode === "transfer_class" ? (
            <div className={styles.transferBox}>
              <label>
                <span>Lớp chuyển đến</span>
                <select
                  value={transferTargetClassId}
                  onChange={(event) => setTransferTargetClassId(event.target.value)}
                >
                  <option value="">Chọn lớp mới</option>
                  {classes
                    .filter(
                      (item) =>
                        item.status === "active" &&
                        item.id !== actionStudent.classId
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.className} · Khối {item.grade} · {normalizeSchoolYear(item.schoolYear)}
                      </option>
                    ))}
                </select>
              </label>

              <Button
                leftIcon={<MoveRight size={16} />}
                disabled={busy || !transferTargetClassId}
                onClick={() => { void transferStudentToClass(); }}
              >
                Chuyển lớp
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
