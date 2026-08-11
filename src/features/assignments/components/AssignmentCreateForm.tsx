"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import type {
  AssignmentClassOption,
  AssignmentTestOption,
  CreateAssignmentInput,
} from "../types";

import styles from "./assignments.module.css";

type AssignmentCreateFormProps = {
  tests: AssignmentTestOption[];

  classes: AssignmentClassOption[];

  initialTestId?: string;

  submitting: boolean;

  onSubmit: (
    input: CreateAssignmentInput
  ) => Promise<boolean>;
};

const DEFAULT_MAX_ATTEMPTS =
  "1";

export function AssignmentCreateForm({
  tests,
  classes,
  initialTestId = "",
  submitting,
  onSubmit,
}: AssignmentCreateFormProps) {
  const [
    selectedTestId,
    setSelectedTestId,
  ] = useState("");

  const [
    selectedClassIds,
    setSelectedClassIds,
  ] = useState<string[]>([]);

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    maxAttempts,
    setMaxAttempts,
  ] = useState(
    DEFAULT_MAX_ATTEMPTS
  );

  const [
    startTime,
    setStartTime,
  ] = useState("");

  const [
    endTime,
    setEndTime,
  ] = useState("");

  const [
    shuffleQuestions,
    setShuffleQuestions,
  ] = useState(false);

  const [
    shuffleOptions,
    setShuffleOptions,
  ] = useState(false);

  const [
    showResultImmediately,
    setShowResultImmediately,
  ] = useState(true);

  const [
    showCorrectAnswers,
    setShowCorrectAnswers,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState("");

  const selectedTest =
    useMemo(() => {
      return (
        tests.find(
          (test) =>
            test.id ===
            selectedTestId
        ) ?? null
      );
    }, [
      selectedTestId,
      tests,
    ]);

  const selectedClasses =
    useMemo(() => {
      return classes.filter(
        (classItem) =>
          selectedClassIds.includes(
            classItem.id
          )
      );
    }, [
      classes,
      selectedClassIds,
    ]);

  useEffect(() => {
    if (
      !initialTestId ||
      tests.length === 0
    ) {
      return;
    }

    const matchingTest =
      tests.find(
        (test) =>
          test.id ===
          initialTestId
      );

    if (matchingTest) {
      setSelectedTestId(
        matchingTest.id
      );
    }
  }, [
    initialTestId,
    tests,
  ]);

  function resetForm() {
    setSelectedTestId("");
    setSelectedClassIds([]);
    setPassword("");
    setMaxAttempts(
      DEFAULT_MAX_ATTEMPTS
    );
    setStartTime("");
    setEndTime("");
    setShuffleQuestions(false);
    setShuffleOptions(false);
    setShowResultImmediately(true);
    setShowCorrectAnswers(false);
    setFormError("");
  }

  function toggleClass(
    classId: string
  ) {
    setSelectedClassIds(
      (currentClassIds) => {
        if (
          currentClassIds.includes(
            classId
          )
        ) {
          return currentClassIds.filter(
            (currentClassId) =>
              currentClassId !==
              classId
          );
        }

        return [
          ...currentClassIds,
          classId,
        ];
      }
    );
  }

  function selectAllClasses() {
    setSelectedClassIds(
      classes.map(
        (classItem) =>
          classItem.id
      )
    );
  }

  function clearSelectedClasses() {
    setSelectedClassIds([]);
  }

  function validateForm(): string {
    if (!selectedTestId) {
      return "Vui lòng chọn đề kiểm tra.";
    }

    if (
      selectedClassIds.length ===
      0
    ) {
      return "Vui lòng chọn ít nhất một lớp.";
    }

    const parsedAttempts =
      Number(maxAttempts);

    if (
      !Number.isInteger(
        parsedAttempts
      ) ||
      parsedAttempts < 1 ||
      parsedAttempts > 20
    ) {
      return "Số lượt làm bài phải là số nguyên từ 1 đến 20.";
    }

    if (
      startTime &&
      Number.isNaN(
        new Date(
          startTime
        ).getTime()
      )
    ) {
      return "Thời gian mở bài không hợp lệ.";
    }

    if (
      endTime &&
      Number.isNaN(
        new Date(
          endTime
        ).getTime()
      )
    ) {
      return "Thời gian đóng bài không hợp lệ.";
    }

    if (
      startTime &&
      endTime &&
      new Date(endTime).getTime() <=
        new Date(startTime).getTime()
    ) {
      return "Thời gian đóng bài phải sau thời gian mở bài.";
    }

    return "";
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const validationError =
      validateForm();

    if (validationError) {
      setFormError(
        validationError
      );
      return;
    }

    setFormError("");

    const created =
      await onSubmit({
        testId:
          selectedTestId,

        classIds:
          selectedClassIds,

        password:
          password.trim() ||
          undefined,

        maxAttempts:
          Number(maxAttempts),

        startTime:
          startTime ||
          undefined,

        endTime:
          endTime ||
          undefined,

        shuffleQuestions,

        shuffleOptions,

        resultVisibility:
          showResultImmediately
            ? "immediately"
            : "after_close",

        showCorrectAnswers,
      });

    if (created) {
      resetForm();
    }
  }

  return (
    <form
      className={styles.createForm}
      onSubmit={handleSubmit}
    >
      <div
        className={
          styles.sectionHeading
        }
      >
        <div>
          <h2
            className={
              styles.sectionTitle
            }
          >
            Tạo lượt giao đề
          </h2>

          <p
            className={
              styles.sectionDescription
            }
          >
            Chọn đề đã xuất bản,
            lớp học và các thiết lập
            làm bài.
          </p>
        </div>
      </div>

      {formError && (
        <div
          className={
            styles.inlineError
          }
          role="alert"
        >
          {formError}
        </div>
      )}

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
          <span
            className={
              styles.label
            }
          >
            Đề kiểm tra
          </span>

          <select
            className={
              styles.input
            }
            value={
              selectedTestId
            }
            disabled={
              submitting
            }
            onChange={(event) => {
              setSelectedTestId(
                event.target.value
              );
            }}
          >
            <option value="">
              -- Chọn đề đã xuất bản --
            </option>

            {tests.map(
              (test) => (
                <option
                  key={test.id}
                  value={test.id}
                >
                  {test.title}
                  {" · "}
                  {test.subject}
                  {" · Khối "}
                  {test.grade}
                </option>
              )
            )}
          </select>
        </label>

        <label
          className={
            styles.field
          }
        >
          <span
            className={
              styles.label
            }
          >
            Số lượt làm tối đa
          </span>

          <input
            className={
              styles.input
            }
            type="number"
            min={1}
            max={20}
            step={1}
            value={maxAttempts}
            disabled={
              submitting
            }
            onChange={(event) => {
              setMaxAttempts(
                event.target.value
              );
            }}
          />
        </label>

        <label
          className={
            styles.field
          }
        >
          <span
            className={
              styles.label
            }
          >
            Thời gian mở bài
          </span>

          <input
            className={
              styles.input
            }
            type="datetime-local"
            value={startTime}
            disabled={
              submitting
            }
            onChange={(event) => {
              setStartTime(
                event.target.value
              );
            }}
          />
        </label>

        <label
          className={
            styles.field
          }
        >
          <span
            className={
              styles.label
            }
          >
            Thời gian đóng bài
          </span>

          <input
            className={
              styles.input
            }
            type="datetime-local"
            value={endTime}
            disabled={
              submitting
            }
            onChange={(event) => {
              setEndTime(
                event.target.value
              );
            }}
          />
        </label>

        <label
          className={
            styles.fieldFull
          }
        >
          <span
            className={
              styles.label
            }
          >
            Mật khẩu truy cập
          </span>

          <input
            className={
              styles.input
            }
            type="text"
            value={password}
            disabled={
              submitting
            }
            placeholder="Để trống nếu không yêu cầu mật khẩu"
            onChange={(event) => {
              setPassword(
                event.target.value
              );
            }}
          />
        </label>
      </div>

      <div
        className={
          styles.classSelector
        }
      >
        <div
          className={
            styles.classSelectorHeader
          }
        >
          <div>
            <h3
              className={
                styles.subsectionTitle
              }
            >
              Chọn lớp
            </h3>

            <p
              className={
                styles.smallDescription
              }
            >
              Đã chọn{" "}
              <strong>
                {
                  selectedClassIds.length
                }
              </strong>{" "}
              trên{" "}
              <strong>
                {classes.length}
              </strong>{" "}
              lớp.
            </p>
          </div>

          <div
            className={
              styles.inlineActions
            }
          >
            <button
              type="button"
              className={
                styles.textButton
              }
              disabled={
                submitting ||
                classes.length === 0
              }
              onClick={
                selectAllClasses
              }
            >
              Chọn tất cả
            </button>

            <button
              type="button"
              className={
                styles.textButton
              }
              disabled={
                submitting ||
                selectedClassIds.length ===
                  0
              }
              onClick={
                clearSelectedClasses
              }
            >
              Bỏ chọn
            </button>
          </div>
        </div>

        {classes.length === 0 ? (
          <div
            className={
              styles.emptyInline
            }
          >
            Chưa có lớp đang hoạt động.
          </div>
        ) : (
          <div
            className={
              styles.classGrid
            }
          >
            {classes.map(
              (classItem) => {
                const checked =
                  selectedClassIds.includes(
                    classItem.id
                  );

                return (
                  <label
                    key={
                      classItem.id
                    }
                    className={`${styles.classOption} ${
                      checked
                        ? styles.classOptionSelected
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={
                        submitting
                      }
                      onChange={() => {
                        toggleClass(
                          classItem.id
                        );
                      }}
                    />

                    <span
                      className={
                        styles.classOptionContent
                      }
                    >
                      <strong>
                        {
                          classItem.className
                        }
                      </strong>

                      <span>
                        Khối{" "}
                        {
                          classItem.grade
                        }
                        {" · "}
                        {
                          classItem.schoolYear
                        }
                      </span>

                      <span>
                        {
                          classItem.studentCount
                        }{" "}
                        học sinh
                      </span>
                    </span>
                  </label>
                );
              }
            )}
          </div>
        )}
      </div>

      <div
        className={
          styles.settingsGrid
        }
      >
        <label
          className={
            styles.settingOption
          }
        >
          <input
            type="checkbox"
            checked={
              shuffleQuestions
            }
            disabled={
              submitting
            }
            onChange={(event) => {
              setShuffleQuestions(
                event.target.checked
              );
            }}
          />

          <span>
            <strong>
              Trộn câu hỏi
            </strong>

            <small>
              Mỗi học sinh có thể nhận
              thứ tự câu khác nhau.
            </small>
          </span>
        </label>

        <label
          className={
            styles.settingOption
          }
        >
          <input
            type="checkbox"
            checked={
              shuffleOptions
            }
            disabled={
              submitting
            }
            onChange={(event) => {
              setShuffleOptions(
                event.target.checked
              );
            }}
          />

          <span>
            <strong>
              Trộn đáp án
            </strong>

            <small>
              Thay đổi thứ tự lựa chọn
              A, B, C, D.
            </small>
          </span>
        </label>

        <label
          className={
            styles.settingOption
          }
        >
          <input
            type="checkbox"
            checked={
              showResultImmediately
            }
            disabled={
              submitting
            }
            onChange={(event) => {
              setShowResultImmediately(
                event.target.checked
              );
            }}
          />

          <span>
            <strong>
              Hiển thị điểm ngay
            </strong>

            <small>
              Học sinh xem điểm sau khi
              nộp bài.
            </small>
          </span>
        </label>

        <label
          className={
            styles.settingOption
          }
        >
          <input
            type="checkbox"
            checked={
              showCorrectAnswers
            }
            disabled={
              submitting
            }
            onChange={(event) => {
              setShowCorrectAnswers(
                event.target.checked
              );
            }}
          />

          <span>
            <strong>
              Hiển thị đáp án đúng
            </strong>

            <small>
              Chỉ nên bật khi bài kiểm
              tra đã kết thúc.
            </small>
          </span>
        </label>
      </div>

      {(selectedTest ||
        selectedClasses.length >
          0) && (
        <div
          className={
            styles.previewGrid
          }
        >
          {selectedTest && (
            <article
              className={
                styles.previewCard
              }
            >
              <span
                className={
                  styles.previewLabel
                }
              >
                Đề đã chọn
              </span>

              <h3>
                {
                  selectedTest.title
                }
              </h3>

              <dl
                className={
                  styles.detailList
                }
              >
                <div>
                  <dt>Môn</dt>
                  <dd>
                    {
                      selectedTest.subject
                    }
                  </dd>
                </div>

                <div>
                  <dt>Khối</dt>
                  <dd>
                    {
                      selectedTest.grade
                    }
                  </dd>
                </div>

                <div>
                  <dt>Thời lượng</dt>
                  <dd>
                    {
                      selectedTest.durationMinutes
                    }{" "}
                    phút
                  </dd>
                </div>

                <div>
                  <dt>Số câu</dt>
                  <dd>
                    {
                      selectedTest.totalQuestions
                    }
                  </dd>
                </div>

                <div>
                  <dt>Tổng điểm</dt>
                  <dd>
                    {
                      selectedTest.totalQuestions > 0
                        ? 10
                        : 0
                    }
                  </dd>
                </div>

                <div>
                  <dt>Phiên bản</dt>
                  <dd>
                    v
                    {
                      selectedTest.versionNumber
                    }
                  </dd>
                </div>
              </dl>
            </article>
          )}

          {selectedClasses.length >
            0 && (
            <article
              className={
                styles.previewCard
              }
            >
              <span
                className={
                  styles.previewLabel
                }
              >
                Lớp nhận đề
              </span>

              <h3>
                {
                  selectedClasses.length
                }{" "}
                lớp
              </h3>

              <div
                className={
                  styles.selectedClassList
                }
              >
                {selectedClasses.map(
                  (classItem) => (
                    <span
                      key={
                        classItem.id
                      }
                    >
                      {
                        classItem.className
                      }
                    </span>
                  )
                )}
              </div>
            </article>
          )}
        </div>
      )}

      <button
        type="submit"
        className={
          styles.primaryButton
        }
        disabled={
          submitting ||
          tests.length === 0 ||
          classes.length === 0
        }
      >
        {submitting
          ? "Đang giao đề..."
          : "Giao đề cho lớp"}
      </button>
    </form>
  );
}
