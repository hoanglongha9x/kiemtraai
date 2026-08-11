"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  BookOpen,
  Download,
  Eye,
  FileText,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  Share2,
  Upload,
  Users,
  X,
} from "lucide-react";

import { Button, PageHeader } from "@/components/ui";
import { auth } from "@/lib/firebase/client";

import styles from "./page.module.css";

type LibraryItem = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  tags: string[];
  visibility: "private" | "school";
  ownerEmail: string;
  ownerName: string;
  schoolId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  fileExtension: string;
  createdAt: string;
  updatedAt: string;
  isPdf: boolean;
  previewUrl: string;
  downloadUrl: string;
};

type LibraryResponse = {
  status: "success";
  items: LibraryItem[];
};

type UploadResponse = {
  status: "success";
  item: LibraryItem;
  message: string;
};

type UpdateResponse = {
  status: "success";
  message: string;
};

const SUBJECTS = [
  "Toán",
  "Ngữ văn",
  "Tiếng Anh",
  "Vật lí",
  "Hóa học",
  "Sinh học",
  "Lịch sử",
  "Địa lí",
  "Tin học",
  "Công nghệ",
  "GDCD",
];

const GRADES = ["6", "7", "8", "9", "10", "11", "12"];

async function teacherApi<TResponse>(
  url: string,
  options: RequestInit = {}
): Promise<TResponse> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Bạn chưa đăng nhập.");
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(options.headers || {});

  headers.set("Authorization", `Bearer ${token}`);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`API ${url} không trả về JSON. Status: ${response.status}.`);
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API.");
  }

  return data as TResponse;
}

function getMessageType(message: string): "info" | "success" | "error" {
  if (message.includes("Đang")) return "info";
  if (message.includes("Đã")) return "success";
  return "error";
}

function formatFileSize(value: number) {
  if (!value) return "--";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

export default function TeacherTestLibraryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<LibraryItem | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Toán");
  const [grade, setGrade] = useState("10");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"private" | "school">("private");
  const [file, setFile] = useState<File | null>(null);

  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [ownerScope, setOwnerScope] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const totalMine = useMemo(
    () => items.filter((item) => item.ownerEmail === user?.email).length,
    [items, user?.email]
  );

  const totalSchoolShared = useMemo(
    () => items.filter((item) => item.visibility === "school").length,
    [items]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser?.email) {
        setMessage("Vui lòng đăng nhập Google trước.");
        setLoading(false);
        return;
      }

      await loadLibrary();
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function loadLibrary(customFilters?: {
    search?: string;
    subject?: string;
    grade?: string;
    ownerScope?: string;
  }) {
    try {
      setMessage("Đang tải thư viện đề...");

      const params = new URLSearchParams();
      const cleanSearch = customFilters?.search ?? search;
      const cleanSubject = customFilters?.subject ?? filterSubject;
      const cleanGrade = customFilters?.grade ?? filterGrade;
      const cleanOwnerScope = customFilters?.ownerScope ?? ownerScope;

      if (cleanSearch.trim()) params.set("search", cleanSearch.trim());
      if (cleanSubject) params.set("subject", cleanSubject);
      if (cleanGrade) params.set("grade", cleanGrade);
      if (cleanOwnerScope) params.set("ownerScope", cleanOwnerScope);

      const data = await teacherApi<LibraryResponse>(
        params.toString()
          ? `/api/teacher/test-library?${params.toString()}`
          : "/api/teacher/test-library",
        { method: "GET" }
      );

      setItems(data.items || []);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Không tải được thư viện đề.");
    }
  }

  async function uploadLibraryItem() {
    if (!file) {
      setMessage("Vui lòng chọn file PDF hoặc DOCX.");
      return;
    }

    if (!subject || !grade) {
      setMessage("Vui lòng chọn môn học và khối lớp.");
      return;
    }

    try {
      setBusy(true);
      setMessage("Đang upload đề...");

      const formData = new FormData();

      formData.set("file", file);
      formData.set("title", title.trim());
      formData.set("subject", subject);
      formData.set("grade", grade);
      formData.set("tags", tags);
      formData.set("visibility", visibility);

      const data = await teacherApi<UploadResponse>("/api/teacher/test-library", {
        method: "POST",
        body: formData,
      });

      setTitle("");
      setTags("");
      setFile(null);
      setVisibility("private");
      setMessage(data.message || "Đã upload đề vào thư viện.");
      await loadLibrary();
    } catch (error: any) {
      setMessage(error?.message || "Không upload được đề.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility(item: LibraryItem) {
    try {
      setBusy(true);
      setMessage("Đang cập nhật chia sẻ...");

      const nextVisibility = item.visibility === "school" ? "private" : "school";

      const data = await teacherApi<UpdateResponse>("/api/teacher/test-library", {
        method: "PATCH",
        body: JSON.stringify({
          libraryId: item.id,
          visibility: nextVisibility,
        }),
      });

      setMessage(data.message || "Đã cập nhật chế độ chia sẻ.");
      await loadLibrary();
    } catch (error: any) {
      setMessage(error?.message || "Không cập nhật được chế độ chia sẻ.");
    } finally {
      setBusy(false);
    }
  }

  function applyFilter() {
    void loadLibrary({
      search,
      subject: filterSubject,
      grade: filterGrade,
      ownerScope,
    });
  }

  function clearFilter() {
    setSearch("");
    setFilterSubject("");
    setFilterGrade("");
    setOwnerScope("");
    void loadLibrary({
      search: "",
      subject: "",
      grade: "",
      ownerScope: "",
    });
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingState}>
          <Loader2 size={18} />
          <span>Đang tải thư viện đề...</span>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="NỘI DUNG"
        title="Thư viện đề"
        description="Lưu trữ đề PDF/DOCX, chia sẻ trong trường và xem trước PDF trước khi tải về in."
        actions={
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={16} />}
            disabled={busy}
            onClick={() => void loadLibrary()}
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

      <section className={styles.workspaceGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Upload đề</h2>
              <p>Chọn môn, khối và file đề để đưa vào thư viện.</p>
            </div>
          </div>

          <div className={styles.formStack}>
            <label>
              <span>Tên đề</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ví dụ: Kiểm tra 15 phút chương 1"
              />
            </label>

            <label>
              <span>Môn học</span>
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                {SUBJECTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Khối lớp</span>
              <select value={grade} onChange={(event) => setGrade(event.target.value)}>
                {GRADES.map((item) => (
                  <option key={item} value={item}>
                    Khối {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Tag chủ đề</span>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Hàm số, phương trình, kiểm tra giữa kỳ"
              />
            </label>

            <div className={styles.scopeRow}>
              <button
                type="button"
                className={`${styles.scopeButton} ${
                  visibility === "private" ? styles.scopeSelected : ""
                }`}
                onClick={() => setVisibility("private")}
              >
                <strong>Riêng tư</strong>
                <span>Chỉ tôi nhìn thấy.</span>
              </button>

              <button
                type="button"
                className={`${styles.scopeButton} ${
                  visibility === "school" ? styles.scopeSelected : ""
                }`}
                onClick={() => setVisibility("school")}
              >
                <strong>Công khai trong trường</strong>
                <span>Đồng nghiệp cùng trường nhìn thấy.</span>
              </button>
            </div>

            <label className={styles.fileDrop}>
              <strong>{file ? file.name : "Chọn file PDF hoặc DOCX"}</strong>
              <span>PDF xem trước trực tiếp. DOCX dùng để tải xuống/in.</span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>

            <Button
              leftIcon={<Upload size={16} />}
              disabled={busy}
              onClick={() => void uploadLibraryItem()}
            >
              Upload vào thư viện
            </Button>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.libraryHeader}>
            <div className={styles.libraryHeaderText}>
              <span className={styles.eyebrow}>Kho tài liệu đề thi</span>
              <h2>Danh sách thư viện</h2>
              <p>Tìm, xem trước và tải file đề PDF/DOCX dùng để in hoặc chia sẻ trong trường.</p>
            </div>

            <div className={styles.libraryStats}>
              <div className={styles.statMini}>
                <FileText size={16} />
                <span>Tổng</span>
                <strong>{items.length}</strong>
              </div>
              <div className={styles.statMini}>
                <LockKeyhole size={16} />
                <span>Của tôi</span>
                <strong>{totalMine}</strong>
              </div>
              <div className={styles.statMini}>
                <Users size={16} />
                <span>Chia sẻ</span>
                <strong>{totalSchoolShared}</strong>
              </div>
            </div>
          </div>

          <div className={styles.libraryToolbar}>
            <label className={styles.searchField}>
              <span>Tìm kiếm tài liệu</span>
              <div className={styles.inputWithIcon}>
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nhập tên đề hoặc tag chủ đề..."
                />
              </div>
            </label>

            <label className={styles.filterField}>
              <span>Môn học</span>
              <select value={filterSubject} onChange={(event) => setFilterSubject(event.target.value)}>
                <option value="">Tất cả môn</option>
                {SUBJECTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.filterField}>
              <span>Khối lớp</span>
              <select value={filterGrade} onChange={(event) => setFilterGrade(event.target.value)}>
                <option value="">Tất cả khối</option>
                {GRADES.map((item) => (
                  <option key={item} value={item}>
                    Khối {item}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.filterField}>
              <span>Phạm vi</span>
              <select value={ownerScope} onChange={(event) => setOwnerScope(event.target.value)}>
                <option value="">Tất cả tài liệu</option>
                <option value="mine">Đề của tôi</option>
                <option value="school">Đề chung của trường</option>
              </select>
            </label>

            <div className={styles.filterActions}>
              <Button size="small" onClick={applyFilter}>Lọc</Button>
              <button type="button" className={styles.clearButton} onClick={clearFilter}>
                <X size={15} /> Xóa
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <BookOpen size={26} />
              </div>
              <div>
                <h3>Chưa có tài liệu phù hợp</h3>
                <p>Thử xóa bộ lọc hoặc upload đề mới ở khung bên trái để bắt đầu xây thư viện.</p>
              </div>
            </div>
          ) : (
            <div className={styles.libraryGrid}>
              {items.map((item) => {
                const isOwner = item.ownerEmail === user?.email;

                return (
                  <article key={item.id} className={styles.libraryCard}>
                    <div className={styles.libraryFileIcon}>
                      <FileText size={20} />
                    </div>

                    <div className={styles.libraryCardBody}>
                      <div className={styles.cardTitleRow}>
                        <h3>{item.title || item.originalFileName}</h3>
                        <span
                          className={`${styles.visibilityBadge} ${
                            styles[`visibility_${item.visibility}`]
                          }`}
                        >
                          {item.visibility === "school" ? "Trong trường" : "Riêng tư"}
                        </span>
                      </div>

                      <p className={styles.fileName}>{item.originalFileName}</p>

                      <div className={styles.metaLine}>
                        <span className={styles.metaPill}>
                          <FileText size={13} /> {item.fileExtension.toUpperCase()}
                        </span>
                        <span className={styles.metaPill}>{item.subject}</span>
                        <span className={styles.metaPill}>Khối {item.grade}</span>
                        <span className={styles.metaPill}>{formatFileSize(item.fileSize)}</span>
                        <span className={styles.metaPill}>{formatDate(item.createdAt)}</span>
                      </div>

                      <p className={styles.ownerLine}>Người đăng: {item.ownerName || item.ownerEmail}</p>

                      {item.tags.length > 0 ? (
                        <div className={styles.tagRow}>
                          {item.tags.map((tag) => (
                            <span key={tag} className={styles.tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.actionStack}>
                      {item.isPdf ? (
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => setSelectedPreview(item)}
                        >
                          <Eye size={14} /> Xem trước
                        </button>
                      ) : null}

                      <a className={styles.iconButton} href={item.downloadUrl}>
                        <Download size={14} /> Tải xuống
                      </a>

                      {isOwner ? (
                        <button
                          type="button"
                          className={styles.iconButton}
                          disabled={busy}
                          onClick={() => void toggleVisibility(item)}
                        >
                          <Share2 size={14} />
                          {item.visibility === "school" ? "Đặt riêng tư" : "Chia sẻ"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <section className={styles.previewPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Xem trước PDF</h2>
            <p>Chọn một tài liệu PDF trong danh sách để xem trước trước khi tải về in.</p>
          </div>
          {selectedPreview ? (
            <a className={styles.iconButton} href={selectedPreview.downloadUrl}>
              <Download size={14} /> Tải xuống
            </a>
          ) : null}
        </div>

        {selectedPreview?.previewUrl ? (
          <div className={styles.previewShell}>
            <strong>{selectedPreview.title}</strong>
            <iframe
              className={styles.previewFrame}
              src={selectedPreview.previewUrl}
              title={`Xem trước ${selectedPreview.title}`}
            />
          </div>
        ) : (
          <div className={styles.previewPlaceholder}>
            Chưa chọn PDF để xem trước. DOCX hiện dùng nút tải xuống để mở bằng Word.
          </div>
        )}
      </section>
    </main>
  );
}
