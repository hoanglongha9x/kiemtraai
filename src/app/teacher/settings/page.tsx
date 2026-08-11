"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  setTeacherSettingsCache,
} from "@/features/teacher-settings/hooks";

import {
  DEFAULT_TEACHER_SETTINGS,
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

import {
  getTeacherSettings,
  updateTeacherSettings,
} from "@/features/teacher-settings/services/teacherSettingsService";

import type {
  TeacherSettings,
} from "@/features/teacher-settings/types";

import {
  applyTeacherTheme,
} from "@/features/teacher-settings/utils/applyTeacherTheme";

import styles from "./page.module.css";

const SIDEBAR_STORAGE_KEY =
  "kiemtra-ai-teacher-sidebar-collapsed";

const OTHER_SUBJECT = "Khác";

function getSubjectOption(value: string): string {
  return TEACHER_SUBJECTS.includes(
    value as (typeof TEACHER_SUBJECTS)[number]
  )
    ? value
    : OTHER_SUBJECT;
}

function settingsEqual(
  first: TeacherSettings,
  second: TeacherSettings
): boolean {
  return (
    first.theme ===
      second.theme &&
    first.sidebarCollapsed ===
      second.sidebarCollapsed &&
    first.defaultSubject ===
      second.defaultSubject &&
    first.defaultQuestionType ===
      second.defaultQuestionType &&
    first.defaultCognitiveLevel ===
      second.defaultCognitiveLevel &&
    first.defaultDifficulty ===
      second.defaultDifficulty &&
    first.autosaveEnabled ===
      second.autosaveEnabled &&
    first.confirmBeforeDelete ===
      second.confirmBeforeDelete
  );
}

export default function TeacherSettingsPage() {
  const [
    settings,
    setSettings,
  ] =
    useState<TeacherSettings>(
      DEFAULT_TEACHER_SETTINGS
    );

  const [
    savedSettings,
    setSavedSettings,
  ] =
    useState<TeacherSettings>(
      DEFAULT_TEACHER_SETTINGS
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

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
    "success" |
    "error" |
    ""
  >("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        setLoading(true);
        setMessage("");
        setMessageType("");

        const result =
          await getTeacherSettings();

        if (!active) {
          return;
        }

        setSettings(
          result
        );

        setSavedSettings(
          result
        );

        applyTeacherTheme(
          result.theme
        );
      } catch (
        error: unknown
      ) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Không tải được cài đặt."
        );

        setMessageType(
          "error"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const hasChanges =
    useMemo(
      () =>
        !settingsEqual(
          settings,
          savedSettings
        ),
      [
        settings,
        savedSettings,
      ]
    );

  function updateSetting<
    Key extends keyof TeacherSettings
  >(
    key: Key,
    value:
      TeacherSettings[Key]
  ) {
    setSettings(
      (current) => ({
        ...current,
        [key]: value,
      })
    );

    setMessage("");
    setMessageType("");
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const response =
        await updateTeacherSettings(
          settings
        );

      if (
        response.status !==
        "success"
      ) {
        throw new Error(
          response.message
        );
      }

      setSettings(
        response.settings
      );

      setSavedSettings(
        response.settings
      );

      setTeacherSettingsCache(
  response.settings
);

      applyTeacherTheme(
        response.settings
          .theme
      );

      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          String(
            response.settings
              .sidebarCollapsed
          )
        );
      } catch {
        // Không chặn quá trình lưu.
      }

      setMessage(
        response.message ||
          "Đã lưu cài đặt."
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
          : "Không lưu được cài đặt."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSettings(
      savedSettings
    );

    applyTeacherTheme(
      savedSettings.theme
    );

    setMessage("");
    setMessageType("");
  }

  function handleRestoreDefaults() {
    setSettings({
      ...DEFAULT_TEACHER_SETTINGS,
    });

    applyTeacherTheme(
      DEFAULT_TEACHER_SETTINGS
        .theme
    );

    setMessage(
      "Đã khôi phục giá trị mặc định. Nhấn “Lưu thay đổi” để xác nhận."
    );

    setMessageType("");
  }

  if (loading) {
    return (
      <main
        className={
          styles.loadingPage
        }
      >
        <section
          className={
            styles.loadingCard
          }
        >
          <div
            className={
              styles.spinner
            }
          />

          <h1>
            Đang tải cài đặt
          </h1>

          <p>
            Vui lòng chờ trong giây lát.
          </p>
        </section>
      </main>
    );
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
            KIEMTRA.AI
          </div>

          <h1>
            Cài đặt giáo viên
          </h1>

          <p>
            Tùy chỉnh giao diện và thiết lập mặc định khi tạo câu hỏi, đề kiểm tra.
          </p>
        </div>

        <button
          type="button"
          className={
            styles.restoreButton
          }
          onClick={
            handleRestoreDefaults
          }
          disabled={saving}
        >
          Khôi phục mặc định
        </button>
      </section>

      <form
        onSubmit={
          handleSubmit
        }
        className={
          styles.settingsForm
        }
      >
        <section
          className={
            styles.card
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div
              className={
                styles.cardIcon
              }
            >
              ◐
            </div>

            <div>
              <h2>
                Giao diện
              </h2>

              <p>
                Thiết lập cách hiển thị KIEMTRA.AI trên thiết bị của bạn.
              </p>
            </div>
          </div>

          <div
            className={
              styles.cardBody
            }
          >
            <fieldset
              className={
                styles.fieldset
              }
            >
              <legend>
                Chế độ giao diện
              </legend>

              <div
                className={
                  styles.themeGrid
                }
              >
                <label
                  className={`${styles.choiceCard} ${
                    settings.theme ===
                    "system"
                      ? styles.choiceCardActive
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value="system"
                    checked={
                      settings.theme ===
                      "system"
                    }
                    onChange={() => {
                      updateSetting(
                        "theme",
                        "system"
                      );

                      applyTeacherTheme(
                        "system"
                      );
                    }}
                  />

                  <span
                    className={
                      styles.themePreviewSystem
                    }
                  />

                  <strong>
                    Theo hệ thống
                  </strong>

                  <small>
                    Dùng giao diện của thiết bị.
                  </small>
                </label>

                <label
                  className={`${styles.choiceCard} ${
                    settings.theme ===
                    "light"
                      ? styles.choiceCardActive
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={
                      settings.theme ===
                      "light"
                    }
                    onChange={() => {
                      updateSetting(
                        "theme",
                        "light"
                      );

                      applyTeacherTheme(
                        "light"
                      );
                    }}
                  />

                  <span
                    className={
                      styles.themePreviewLight
                    }
                  />

                  <strong>
                    Sáng
                  </strong>

                  <small>
                    Nền sáng, độ tương phản cao.
                  </small>
                </label>

                <label
                  className={`${styles.choiceCard} ${
                    settings.theme ===
                    "dark"
                      ? styles.choiceCardActive
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={
                      settings.theme ===
                      "dark"
                    }
                    onChange={() => {
                      updateSetting(
                        "theme",
                        "dark"
                      );

                      applyTeacherTheme(
                        "dark"
                      );
                    }}
                  />

                  <span
                    className={
                      styles.themePreviewDark
                    }
                  />

                  <strong>
                    Tối
                  </strong>

                  <small>
                    Giảm độ sáng khi làm việc lâu.
                  </small>
                </label>
              </div>
            </fieldset>

            <SettingSwitch
              title="Thu gọn sidebar mặc định"
              description="Sidebar sẽ ở trạng thái thu gọn khi mở khu vực giáo viên."
              checked={
                settings.sidebarCollapsed
              }
              onChange={(
                value
              ) =>
                updateSetting(
                  "sidebarCollapsed",
                  value
                )
              }
            />
          </div>
        </section>

        <section
          className={
            styles.card
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div
              className={
                styles.cardIcon
              }
            >
              ✎
            </div>

            <div>
              <h2>
                Mặc định khi tạo câu hỏi
              </h2>

              <p>
                Các giá trị này sẽ được chọn sẵn khi mở biểu mẫu tạo câu hỏi mới.
              </p>
            </div>
          </div>

          <div
            className={
              styles.cardBody
            }
          >
            <div
              className={
                styles.formGrid
              }
            >
              <label
                className={
                  styles.field
                }
              >
                <span>
                  Môn học
                </span>

                <select
                  value={getSubjectOption(
                    settings.defaultSubject
                  )}
                  onChange={(event) =>
                    updateSetting(
                      "defaultSubject",
                      event.target.value
                    )
                  }
                >
                  {TEACHER_SUBJECTS.map(
                    (subject) => (
                      <option
                        key={subject}
                        value={subject}
                      >
                        {subject}
                      </option>
                    )
                  )}
                </select>

                {getSubjectOption(
                  settings.defaultSubject
                ) === OTHER_SUBJECT ? (
                  <input
                    value={
                      settings.defaultSubject ===
                      OTHER_SUBJECT
                        ? ""
                        : settings.defaultSubject
                    }
                    onChange={(event) =>
                      updateSetting(
                        "defaultSubject",
                        event.target.value
                      )
                    }
                    placeholder="Nhập tên môn học"
                  />
                ) : null}
              </label>

              <label
                className={
                  styles.field
                }
              >
                <span>
                  Loại câu hỏi
                </span>

                <select
                  value={
                    settings.defaultQuestionType
                  }
                  onChange={(event) =>
                    updateSetting(
                      "defaultQuestionType",
                      event.target
                        .value as TeacherSettings["defaultQuestionType"]
                    )
                  }
                >
                  <option value="single_choice">
                    Trắc nghiệm một đáp án
                  </option>

                  <option value="true_false_group">
                    Nhóm câu đúng/sai
                  </option>

                  <option value="short_answer">
                    Trả lời ngắn
                  </option>
                </select>
              </label>

              <label
                className={
                  styles.field
                }
              >
                <span>
                  Mức độ nhận thức
                </span>

                <select
                  value={
                    settings.defaultCognitiveLevel
                  }
                  onChange={(event) =>
                    updateSetting(
                      "defaultCognitiveLevel",
                      event.target
                        .value as TeacherSettings["defaultCognitiveLevel"]
                    )
                  }
                >
                  <option value="recognition">
                    Nhận biết
                  </option>

                  <option value="understanding">
                    Thông hiểu
                  </option>

                  <option value="application">
                    Vận dụng
                  </option>

                  <option value="high_application">
                    Vận dụng cao
                  </option>
                </select>
              </label>

              <label
                className={
                  styles.field
                }
              >
                <span>
                  Độ khó
                </span>

                <select
                  value={
                    settings.defaultDifficulty
                  }
                  onChange={(event) =>
                    updateSetting(
                      "defaultDifficulty",
                      event.target
                        .value as TeacherSettings["defaultDifficulty"]
                    )
                  }
                >
                  <option value="easy">
                    Dễ
                  </option>

                  <option value="medium">
                    Trung bình
                  </option>

                  <option value="hard">
                    Khó
                  </option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section
          className={
            styles.card
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div
              className={
                styles.cardIcon
              }
            >
              ⚙
            </div>

            <div>
              <h2>
                Hành vi hệ thống
              </h2>

              <p>
                Tùy chỉnh cách trình soạn đề và thao tác dữ liệu hoạt động.
              </p>
            </div>
          </div>

          <div
            className={
              styles.cardBody
            }
          >
            <SettingSwitch
              title="Tự động lưu nội dung"
              description="Tự động lưu bản nháp khi bạn chỉnh sửa đề kiểm tra."
              checked={
                settings.autosaveEnabled
              }
              onChange={(
                value
              ) =>
                updateSetting(
                  "autosaveEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              title="Xác nhận trước khi xóa"
              description="Hiển thị hộp thoại xác nhận trước khi xóa câu hỏi hoặc đề kiểm tra."
              checked={
                settings.confirmBeforeDelete
              }
              onChange={(
                value
              ) =>
                updateSetting(
                  "confirmBeforeDelete",
                  value
                )
              }
            />
          </div>
        </section>

        {message && (
          <div
            className={`${styles.message} ${
              messageType ===
              "success"
                ? styles.messageSuccess
                : messageType ===
                  "error"
                ? styles.messageError
                : styles.messageInfo
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
            disabled={
              saving ||
              !hasChanges
            }
            onClick={
              handleReset
            }
          >
            Hủy thay đổi
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
    </div>
  );
}

type SettingSwitchProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange:
    (value: boolean) => void;
};

function SettingSwitch({
  title,
  description,
  checked,
  onChange,
}: SettingSwitchProps) {
  return (
    <label
      className={
        styles.switchRow
      }
    >
      <span
        className={
          styles.switchContent
        }
      >
        <strong>
          {title}
        </strong>

        <small>
          {description}
        </small>
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
      />

      <span
        className={
          styles.switchControl
        }
        aria-hidden="true"
      >
        <span />
      </span>
    </label>
  );
}