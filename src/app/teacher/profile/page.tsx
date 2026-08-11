"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  auth,
} from "@/lib/firebase/client";

import useCurrentTeacher from "@/features/teacher-shell/hooks/useCurrentTeacher";
import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

import styles from "./page.module.css";

const OTHER_SUBJECT = "Khác";

function getSubjectOption(value: string): string {
  return TEACHER_SUBJECTS.includes(
    value as (typeof TEACHER_SUBJECTS)[number]
  )
    ? value
    : OTHER_SUBJECT;
}

type ProfileResponse =
  | {
      status: "success";
      teacher: {
        uid?: string;
        email: string;
        name: string;
        role:
          | "admin"
          | "teacher";
        status:
          | "active"
          | "locked";
        subject?: string;
        schoolId?: string;
        picture?: string;
        createdAt?: string;
        updatedAt?: string;
      };
      message?: string;
    }
  | {
      status: "error";
      message: string;
    };

function getInitials(
  name: string,
  email: string
): string {
  const words =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length >= 2
  ) {
    return `${words[0][0]}${
      words[
        words.length - 1
      ][0]
    }`.toUpperCase();
  }

  if (
    words.length === 1
  ) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return email
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(
  value?: string
): string {
  if (!value) {
    return "Chưa có dữ liệu";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

async function parseResponse(
  response: Response
): Promise<ProfileResponse> {
  const text =
    await response.text();

  try {
    return text
      ? JSON.parse(text)
      : {
          status: "error",
          message:
            "API không trả về dữ liệu.",
        };
  } catch {
    return {
      status: "error",
      message:
        "API không trả về JSON hợp lệ.",
    };
  }
}

export default function TeacherProfilePage() {
  const {
    teacher,
    refreshTeacher,
  } =
    useCurrentTeacher();

  const [
    name,
    setName,
  ] = useState("");

  const [
    subject,
    setSubject,
  ] =
    useState("Khác");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    messageType,
    setMessageType,
  ] = useState<
    | "success"
    | "error"
    | ""
  >("");

  useEffect(() => {
    if (!teacher) {
      return;
    }

    setName(
      teacher.name || ""
    );

    setSubject(
      teacher.subject ||
        "Khác"
    );
  }, [teacher]);

  const initials =
    useMemo(
      () =>
        getInitials(
          teacher?.name || "",
          teacher?.email || ""
        ),
      [
        teacher?.email,
        teacher?.name,
      ]
    );

  const hasChanges =
    useMemo(() => {
      if (!teacher) {
        return false;
      }

      return (
        name.trim() !==
          teacher.name.trim() ||
        subject !==
          (teacher.subject ||
            "Khác")
      );
    }, [
      name,
      subject,
      teacher,
    ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    const cleanName =
      name.trim();

    if (!cleanName) {
      setMessage(
        "Vui lòng nhập họ và tên giáo viên."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      setMessage(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      );

      setMessageType(
        "error"
      );

      return;
    }

    try {
      setSaving(true);

      const token =
        await currentUser
          .getIdToken();

      const response =
        await fetch(
          "/api/teacher/profile",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: cleanName,
              subject,
            }),
          }
        );

      const data =
        await parseResponse(
          response
        );

      if (
        !response.ok ||
        data.status ===
          "error"
      ) {
        throw new Error(
          data.status ===
            "error"
            ? data.message
            : "Không cập nhật được hồ sơ."
        );
      }

      await refreshTeacher();

      setMessage(
        data.message ||
          "Đã cập nhật hồ sơ giáo viên."
      );

      setMessageType(
        "success"
      );
    } catch (
      error: unknown
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không cập nhật được hồ sơ giáo viên."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!teacher) {
      return;
    }

    setName(
      teacher.name
    );

    setSubject(
      teacher.subject ||
        "Khác"
    );

    setMessage("");
    setMessageType("");
  }

  if (!teacher) {
    return null;
  }

  return (
    <div
      className={
        styles.page
      }
    >
      <section
        className={
          styles.hero
        }
      >
        <div>
          <div
            className={
              styles.kicker
            }
          >
            TÀI KHOẢN GIÁO VIÊN
          </div>

          <h1>
            Hồ sơ cá nhân
          </h1>

          <p>
            Quản lý thông tin hiển thị trong hệ thống KIEMTRA.AI.
          </p>
        </div>

        <div
          className={
            styles.heroBadge
          }
        >
          {teacher.role ===
          "admin"
            ? "Quản trị viên"
            : "Giáo viên"}
        </div>
      </section>

      <div
        className={
          styles.layout
        }
      >
        <aside
          className={
            styles.profileCard
          }
        >
          <div
            className={
              styles.avatar
            }
          >
            {teacher.picture ? (
              <img
                src={
                  teacher.picture
                }
                alt={`Ảnh đại diện của ${teacher.name}`}
                referrerPolicy="no-referrer"
              />
            ) : (
              initials
            )}
          </div>

          <h2>
            {teacher.name}
          </h2>

          <p
            className={
              styles.email
            }
          >
            {teacher.email}
          </p>

          <div
            className={
              styles.statusBadge
            }
          >
            <span />

            Tài khoản đang hoạt động
          </div>

          <dl
            className={
              styles.details
            }
          >
            <div>
              <dt>
                Vai trò
              </dt>

              <dd>
                {teacher.role ===
                "admin"
                  ? "Quản trị viên"
                  : "Giáo viên"}
              </dd>
            </div>

            <div>
              <dt>
                Đơn vị
              </dt>

              <dd>
                {teacher.schoolId ||
                  "fpt"}
              </dd>
            </div>

            <div>
              <dt>
                Môn giảng dạy
              </dt>

              <dd>
                {teacher.subject ||
                  "Chưa thiết lập"}
              </dd>
            </div>

            <div>
              <dt>
                Ngày tạo hồ sơ
              </dt>

              <dd>
                {formatDate(
                  teacher.createdAt
                )}
              </dd>
            </div>

            <div>
              <dt>
                Cập nhật gần nhất
              </dt>

              <dd>
                {formatDate(
                  teacher.updatedAt
                )}
              </dd>
            </div>
          </dl>
        </aside>

        <section
          className={
            styles.formCard
          }
        >
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <h2>
                Thông tin hồ sơ
              </h2>

              <p>
                Tên và môn giảng dạy sẽ được sử dụng trong các đề kiểm tra và lớp học.
              </p>
            </div>
          </div>

          <form
            onSubmit={
              handleSubmit
            }
            className={
              styles.form
            }
          >
            <div
              className={
                styles.field
              }
            >
              <label
                htmlFor="teacher-name"
              >
                Họ và tên giáo viên
              </label>

              <input
                id="teacher-name"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target
                      .value
                  )
                }
                maxLength={100}
                placeholder="Nhập họ và tên giáo viên"
                disabled={saving}
              />

              <small>
                Tối đa 100 ký tự.
              </small>
            </div>

            <div
              className={
                styles.field
              }
            >
              <label
                htmlFor="teacher-email"
              >
                Email Google
              </label>

              <input
                id="teacher-email"
                value={
                  teacher.email
                }
                disabled
                readOnly
              />

              <small>
                Email đăng nhập không thể thay đổi tại đây.
              </small>
            </div>

            <div
              className={
                styles.field
              }
            >
              <label
                htmlFor="teacher-subject"
              >
                Môn giảng dạy
              </label>

              <select
                id="teacher-subject"
                value={getSubjectOption(
                  subject
                )}
                onChange={(event) =>
                  setSubject(
                    event.target
                      .value
                  )
                }
                disabled={saving}
              >
                {TEACHER_SUBJECTS.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>

              {getSubjectOption(subject) ===
              OTHER_SUBJECT ? (
                <input
                  value={
                    subject === OTHER_SUBJECT
                      ? ""
                      : subject
                  }
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                  placeholder="Nhập tên môn học"
                  disabled={saving}
                />
              ) : null}
            </div>

            <div
              className={
                styles.readonlyGrid
              }
            >
              <div>
                <span>
                  Vai trò
                </span>

                <strong>
                  {teacher.role ===
                  "admin"
                    ? "Quản trị viên"
                    : "Giáo viên"}
                </strong>
              </div>

              <div>
                <span>
                  Trạng thái
                </span>

                <strong>
                  Đang hoạt động
                </strong>
              </div>
            </div>

            {message && (
              <div
                className={`${styles.message} ${
                  messageType ===
                  "success"
                    ? styles.messageSuccess
                    : styles.messageError
                }`}
                role="status"
              >
                {message}
              </div>
            )}

            <div
              className={
                styles.actions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  handleReset
                }
                disabled={
                  saving ||
                  !hasChanges
                }
              >
                Khôi phục
              </button>

              <button
                type="submit"
                className={
                  styles.primaryButton
                }
                disabled={
                  saving ||
                  !hasChanges
                }
              >
                {saving
                  ? "Đang lưu..."
                  : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}