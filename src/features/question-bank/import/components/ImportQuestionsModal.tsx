"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import {
  Button,
} from "@/components/ui";

import QuestionContentBlocks from "@/components/question-content/QuestionContentBlocks";

import type {
  QuestionOptionId,
} from "@/components/question-bank";

import {
  auth,
} from "@/lib/firebase/client";

import {
  isMeaningfulImportedText,
} from "../lib/pdfGeometry";

import type {
  CreateQuestionInput,
} from "../../repositories";

import type {
  ImportQuestionsErrorResponse,
  ImportQuestionsResponse,
  ParsedImportQuestion,
} from "../types";

import styles from "./ImportQuestionsModal.module.css";

type ImportQuestionsModalProps = {
  open: boolean;
  importing?: boolean;

  onClose: () => void;

  onImport: (
    questions:
      CreateQuestionInput[]
  ) => Promise<void>;
};

type ValidatedImportQuestion = {
  item:
    ParsedImportQuestion;

  errors: string[];

  valid: boolean;
};

type QuestionEditOptions = {
  confirmAnswer?: boolean;
};

type QuestionUpdater = (
  question:
    CreateQuestionInput
) => CreateQuestionInput;

type SingleChoiceImportQuestion =
  Extract<
    CreateQuestionInput,
    {
      type: "single_choice";
    }
  >;

type TrueFalseImportQuestion =
  Extract<
    CreateQuestionInput,
    {
      type: "true_false_group";
    }
  >;

type ShortAnswerImportQuestion =
  Extract<
    CreateQuestionInput,
    {
      type: "short_answer";
    }
  >;

const ACCEPTED_FILE_TYPES =
  ".docx,.pdf,.txt";

const ACCEPTED_EXTENSIONS = [
  "docx",
  "pdf",
  "txt",
] as const;

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const TEMPLATE_DOWNLOAD_URL =
  "/api/question-bank/import/template";

const PROMPT_DOWNLOAD_URL =
  "/api/question-bank/import/prompt";

const QUESTION_OPTION_IDS:
  QuestionOptionId[] = [
    "A",
    "B",
    "C",
    "D",
  ];

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Đã xảy ra lỗi không xác định.";
}

function isBlockedFirebaseTokenError(
  error: unknown
): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error ?? "");

  return (
    message.includes(
      "securetoken.googleapis.com"
    ) ||
    message.includes(
      "auth/requests-to-this-api"
    ) ||
    message.includes(
      "requests-to-this-api"
    )
  );
}

async function getImportAuthToken(): Promise<string> {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Bạn cần đăng nhập để nhập câu hỏi."
    );
  }

  const cachedToken =
    (currentUser as unknown as {
      accessToken?: unknown;
      stsTokenManager?: {
        accessToken?: unknown;
      };
    }).accessToken ??
    (currentUser as unknown as {
      stsTokenManager?: {
        accessToken?: unknown;
      };
    }).stsTokenManager
      ?.accessToken;

  if (
    typeof cachedToken ===
      "string" &&
    cachedToken.split(".").length ===
      3
  ) {
    return cachedToken;
  }

  try {
    return await currentUser.getIdToken();
  } catch (error) {
    if (
      isBlockedFirebaseTokenError(
        error
      )
    ) {
      throw new Error(
        "Không lấy được phiên đăng nhập Firebase vì trình duyệt hoặc mạng đang chặn securetoken.googleapis.com. Hãy đăng xuất rồi đăng nhập lại; nếu vẫn lỗi, tắt AdBlock/VPN/chặn tracking cho localhost hoặc cho phép Google Firebase."
      );
    }

    throw error;
  }
}

function getQuestionTypeLabel(
  question:
    CreateQuestionInput
): string {
  if (
    question.type ===
    "single_choice"
  ) {
    return "Trắc nghiệm";
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    return "Đúng / Sai";
  }

  return "Trả lời ngắn";
}

function getDifficultyLabel(
  difficulty:
    CreateQuestionInput["difficulty"]
): string {
  if (difficulty === "easy") {
    return "Dễ";
  }

  if (
    difficulty ===
    "medium"
  ) {
    return "Trung bình";
  }

  return "Khó";
}

function getCognitiveLevelLabel(
  cognitiveLevel:
    CreateQuestionInput["cognitiveLevel"]
): string {
  if (
    cognitiveLevel ===
    "recognition"
  ) {
    return "Nhận biết";
  }

  if (
    cognitiveLevel ===
    "understanding"
  ) {
    return "Thông hiểu";
  }

  if (
    cognitiveLevel ===
    "application"
  ) {
    return "Vận dụng";
  }

  return "Vận dụng cao";
}

function getAnswerSourceLabel(
  item: ParsedImportQuestion
): string | null {
  const source =
    item.answerSource ??
    item.answer_source;

  if (source === "pdf_color") {
    return "Đáp án từ màu PDF";
  }

  if (
    source ===
    "manual_required"
  ) {
    return "Cần xác nhận đáp án";
  }

  return null;
}

function getNeedsManualReview(
  item: ParsedImportQuestion
): boolean {
  return Boolean(
    item.needsManualReview ??
      item.needs_manual_review
  );
}

function getExplanation(
  question:
    CreateQuestionInput
): string {
  if (
    "explanation" in
      question &&
    typeof question.explanation ===
      "string"
  ) {
    return question.explanation.trim();
  }

  return "";
}

function formatFileSize(
  size: number
): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (
    size <
    1024 * 1024
  ) {
    return `${(
      size / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}

function normalizeText(
  value: unknown
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function validateQuestion(
  question:
    CreateQuestionInput
): string[] {
  const errors: string[] =
    [];

  if (
    !isMeaningfulImportedText(
      question.content
    )
  ) {
    errors.push(
      "Thiếu nội dung câu hỏi."
    );
  }

  if (
    !normalizeText(
      question.subject
    )
  ) {
    errors.push(
      "Thiếu môn học."
    );
  }

  if (
    !normalizeText(
      question.grade
    )
  ) {
    errors.push(
      "Thiếu khối lớp."
    );
  }

  if (
    question.type ===
    "single_choice"
  ) {
    if (
      !Array.isArray(
        question.options
      ) ||
      question.options.length <
        2
    ) {
      errors.push(
        "Câu trắc nghiệm phải có ít nhất 2 phương án."
      );

      return errors;
    }

    const optionIds =
      new Set(
        question.options.map(
          (option) =>
            option.id
        )
      );

    const emptyOptions =
      question.options.filter(
        (option) =>
          !isMeaningfulImportedText(
            option.content
          )
      );

    if (
      emptyOptions.length > 0
    ) {
      errors.push(
        "Có phương án trả lời trống hoặc chỉ chứa ký tự rác; ảnh chỉ được gắn vào phần câu hỏi."
      );
    }

    if (
      !question.correctOptionId
    ) {
      errors.push(
        "Chưa xác định đáp án đúng."
      );
    } else if (
      !optionIds.has(
        question.correctOptionId
      )
    ) {
      errors.push(
        "Đáp án đúng không tồn tại trong danh sách phương án."
      );
    }

    return errors;
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    if (
      !Array.isArray(
        question.statements
      ) ||
      question.statements.length ===
        0
    ) {
      errors.push(
        "Câu đúng/sai chưa có mệnh đề."
      );

      return errors;
    }

    const emptyStatements =
      question.statements.filter(
        (statement) =>
          !isMeaningfulImportedText(
            statement.content
          )
      );

    if (
      emptyStatements.length > 0
    ) {
      errors.push(
        "Có mệnh đề đúng/sai trống hoặc chỉ chứa ký tự rác."
      );
    }

    const invalidAnswers =
      question.statements.filter(
        (statement) =>
          typeof statement.correctAnswer !==
          "boolean"
      );

    if (
      invalidAnswers.length > 0
    ) {
      errors.push(
        "Có mệnh đề chưa xác định đáp án Đúng hoặc Sai."
      );
    }

    return errors;
  }

  const acceptedAnswers =
    Array.isArray(
      question.acceptedAnswers
    )
      ? question.acceptedAnswers.filter(
          (answer) =>
            normalizeText(
              answer
            )
        )
      : [];

  if (
    acceptedAnswers.length ===
    0
  ) {
    errors.push(
      "Câu trả lời ngắn chưa có đáp án chấp nhận."
    );
  }

  return errors;
}

function validateImportedQuestions(
  questions:
    ParsedImportQuestion[]
): ValidatedImportQuestion[] {
  return questions.map(
    (item) => {
      const errors =
        validateQuestion(
          item.question
        );
      const needsReview =
        getNeedsManualReview(
          item
        );

      if (needsReview) {
        errors.unshift(
          item.reviewReason ||
            "Chưa xác định được đáp án — cần giáo viên xác nhận trước khi sử dụng."
        );
      }

      return {
        item,
        errors,
        valid:
          errors.length === 0,
      };
    }
  );
}

function clearManualReview(
  item: ParsedImportQuestion
): ParsedImportQuestion {
  return {
    ...item,
    answerSource:
      undefined,
    answer_source:
      undefined,
    needsManualReview:
      false,
    needs_manual_review:
      false,
    reviewReason:
      undefined,
  };
}

function QuestionDetail({
  item,
  disabled,
  onConfirmAnswer,
  onQuestionChange,
}: {
  item:
    ParsedImportQuestion;
  disabled: boolean;
  onConfirmAnswer: () => void;
  onQuestionChange: (
    updater:
      QuestionUpdater,
    options?:
      QuestionEditOptions
  ) => void;
}) {
  const {
    question,
  } = item;
  const explanation =
    getExplanation(
      question
    );
  const needsManualReview =
    getNeedsManualReview(
      item
    );

  const updateBaseField = (
    field:
      | "content"
      | "explanation",
    value: string
  ) => {
    onQuestionChange(
      (current) => {
        const nextQuestion = {
          ...current,
          [field]:
            field ===
              "explanation" &&
            !value.trim()
              ? undefined
              : value,
        };

        if (
          field !== "content" ||
          !current.contentBlocks
            ?.length
        ) {
          return nextQuestion;
        }

        return {
          ...nextQuestion,
          contentBlocks: [
            {
              type:
                "text" as const,
              content: value,
            },
            ...current.contentBlocks.filter(
              (block) =>
                block.type !==
                "text"
            ),
          ],
        };
      }
    );
  };

  if (
    question.type ===
    "single_choice"
  ) {
    const updateSingleChoice =
      (
        updater: (
          current:
            SingleChoiceImportQuestion
        ) =>
          SingleChoiceImportQuestion,
        options?:
          QuestionEditOptions
      ) => {
        onQuestionChange(
          (current) =>
            current.type ===
            "single_choice"
              ? updater(
                  current
                )
              : current,
          options
        );
      };

    return (
      <div
        className={
          styles.questionDetails
        }
      >
        <div
          className={
            styles.editPanel
          }
        >
          <label
            className={
              styles.editField
            }
          >
            <span>
              Nội dung câu hỏi
            </span>

            <textarea
              value={
                question.content
              }
              disabled={
                disabled
              }
              rows={3}
              onChange={(
                event
              ) =>
                updateBaseField(
                  "content",
                  event.target
                    .value
                )
              }
            />
          </label>
        </div>

        <div
          className={
            styles.answerSection
          }
        >
          <h4>
            Phương án trả lời
          </h4>

          <div
            className={
              styles.optionList
            }
          >
            {question.options.map(
              (option) => {
                const isCorrect =
                  !needsManualReview &&
                  option.id ===
                    question.correctOptionId;

                return (
                  <div
                    key={
                      option.id
                    }
                    className={`${styles.optionRow} ${
                      isCorrect
                        ? styles.optionRowCorrect
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      className={
                        styles.answerRadio
                      }
                      aria-label={`Chọn ${option.id} là đáp án đúng`}
                      name={`correct-${item.importId}`}
                      checked={
                        isCorrect
                      }
                      disabled={
                        disabled
                      }
                      onChange={() => {
                        updateSingleChoice(
                          (
                            current
                          ) => ({
                            ...current,
                            correctOptionId:
                              option.id,
                          }),
                          {
                            confirmAnswer:
                              true,
                          }
                        );
                      }}
                    />

                    <span
                      className={
                        styles.optionId
                      }
                    >
                      {option.id}
                    </span>

                    <span
                      className={
                        styles.optionContent
                      }
                    >
                      <textarea
                        value={
                          option.content
                        }
                        disabled={
                          disabled
                        }
                        rows={2}
                        onChange={(
                          event
                        ) => {
                          const value =
                            event.target
                              .value;

                          updateSingleChoice(
                            (
                              current
                            ) => ({
                              ...current,
                              options:
                                current.options.map(
                                  (
                                    currentOption
                                  ) =>
                                    currentOption.id ===
                                    option.id
                                      ? {
                                          ...currentOption,
                                          content:
                                            value,
                                        }
                                      : currentOption
                                ),
                            })
                          );
                        }}
                      />
                    </span>

                    {isCorrect && (
                      <span
                        className={
                          styles.correctLabel
                        }
                      >
                        {needsManualReview
                          ? "Đáp án đề xuất"
                          : "Đáp án đúng"}
                      </span>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>

        <label
          className={
            styles.editField
          }
        >
          <span>
            Giải thích
          </span>

          <textarea
            value={
              explanation
            }
            disabled={
              disabled
            }
            rows={2}
            onChange={(
              event
            ) =>
              updateBaseField(
                "explanation",
                event.target.value
              )
            }
          />
        </label>

        {needsManualReview && (
          <button
            type="button"
            className={
              styles.resolveButton
            }
            disabled={
              disabled
            }
            onClick={
              onConfirmAnswer
            }
          >
            Dùng đáp án đã chọn
          </button>
        )}
      </div>
    );
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    const updateTrueFalse =
      (
        updater: (
          current:
            TrueFalseImportQuestion
        ) =>
          TrueFalseImportQuestion,
        options?:
          QuestionEditOptions
      ) => {
        onQuestionChange(
          (current) =>
            current.type ===
            "true_false_group"
              ? updater(
                  current
                )
              : current,
          options
        );
      };

    return (
      <div
        className={
          styles.questionDetails
        }
      >
        <div
          className={
            styles.editPanel
          }
        >
          <label
            className={
              styles.editField
            }
          >
            <span>
              Nội dung câu hỏi
            </span>

            <textarea
              value={
                question.content
              }
              disabled={
                disabled
              }
              rows={3}
              onChange={(
                event
              ) =>
                updateBaseField(
                  "content",
                  event.target
                    .value
                )
              }
            />
          </label>
        </div>

        <div
          className={
            styles.answerSection
          }
        >
          <h4>
            Các mệnh đề
          </h4>

          <div
            className={
              styles.statementList
            }
          >
            {question.statements.map(
              (statement) => (
                <div
                  key={
                    statement.id
                  }
                  className={
                    styles.statementRow
                  }
                >
                  <span
                    className={
                      styles.optionId
                    }
                  >
                    {statement.id}
                  </span>

                  <span
                    className={
                      styles.optionContent
                    }
                  >
                    <textarea
                      value={
                        statement.content
                      }
                      disabled={
                        disabled
                      }
                      rows={2}
                      onChange={(
                        event
                      ) => {
                        const value =
                          event.target
                            .value;

                        updateTrueFalse(
                          (
                            current
                          ) => ({
                            ...current,
                            statements:
                              current.statements.map(
                                (
                                  currentStatement
                                ) =>
                                  currentStatement.id ===
                                  statement.id
                                    ? {
                                        ...currentStatement,
                                        content:
                                          value,
                                      }
                                    : currentStatement
                              ),
                          })
                        );
                      }}
                    />
                  </span>

                  <div
                    className={
                      styles.booleanToggle
                    }
                  >
                    <button
                      type="button"
                      className={
                        statement.correctAnswer
                          ? styles.booleanToggleActive
                          : ""
                      }
                      disabled={
                        disabled
                      }
                      onClick={() => {
                        updateTrueFalse(
                          (
                            current
                          ) => ({
                            ...current,
                            statements:
                              current.statements.map(
                                (
                                  currentStatement
                                ) =>
                                  currentStatement.id ===
                                  statement.id
                                    ? {
                                        ...currentStatement,
                                        correctAnswer:
                                          true,
                                      }
                                    : currentStatement
                              ),
                          }),
                          {
                            confirmAnswer:
                              true,
                          }
                        );
                      }}
                    >
                      Đúng
                    </button>

                    <button
                      type="button"
                      className={
                        !statement.correctAnswer
                          ? styles.booleanToggleActive
                          : ""
                      }
                      disabled={
                        disabled
                      }
                      onClick={() => {
                        updateTrueFalse(
                          (
                            current
                          ) => ({
                            ...current,
                            statements:
                              current.statements.map(
                                (
                                  currentStatement
                                ) =>
                                  currentStatement.id ===
                                  statement.id
                                    ? {
                                        ...currentStatement,
                                        correctAnswer:
                                          false,
                                      }
                                    : currentStatement
                              ),
                          }),
                          {
                            confirmAnswer:
                              true,
                          }
                        );
                      }}
                    >
                      Sai
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <label
          className={
            styles.editField
          }
        >
          <span>
            Giải thích
          </span>

          <textarea
            value={
              explanation
            }
            disabled={
              disabled
            }
            rows={2}
            onChange={(
              event
            ) =>
              updateBaseField(
                "explanation",
                event.target.value
              )
            }
          />
        </label>

        {needsManualReview && (
          <button
            type="button"
            className={
              styles.resolveButton
            }
            disabled={
              disabled
            }
            onClick={
              onConfirmAnswer
            }
          >
            Đã kiểm tra Đúng/Sai
          </button>
        )}
      </div>
    );
  }

  const updateShortAnswer =
    (
      updater: (
        current:
          ShortAnswerImportQuestion
      ) =>
        ShortAnswerImportQuestion,
      options?:
        QuestionEditOptions
    ) => {
      onQuestionChange(
        (current) =>
          current.type ===
          "short_answer"
            ? updater(current)
            : current,
        options
      );
    };

  return (
    <div
      className={
        styles.questionDetails
      }
    >
      <div
        className={
          styles.editPanel
        }
      >
        <label
          className={
            styles.editField
          }
        >
          <span>
            Nội dung câu hỏi
          </span>

          <textarea
            value={
              question.content
            }
            disabled={
              disabled
            }
            rows={3}
            onChange={(
              event
            ) =>
              updateBaseField(
                "content",
                event.target
                  .value
              )
            }
          />
        </label>
      </div>

      <div
        className={
          styles.answerSection
        }
      >
        <h4>
          Đáp án được chấp nhận
        </h4>

        <div
          className={
            styles.acceptedAnswerList
          }
        >
          <textarea
            className={
              styles.answerTextarea
            }
            value={
              question.acceptedAnswers.join(
                "; "
              )
            }
            disabled={
              disabled
            }
            rows={2}
            onChange={(
              event
            ) => {
              const acceptedAnswers =
                event.target.value
                  .split(/[;|]/)
                  .map((answer) =>
                    answer.trim()
                  )
                  .filter(Boolean);

              updateShortAnswer(
                (current) => ({
                  ...current,
                  acceptedAnswers,
                }),
                {
                  confirmAnswer:
                    acceptedAnswers.length >
                    0,
                }
              );
            }}
          />
        </div>

        <div
          className={
            styles.answerSettings
          }
        >
          <span>
            Phân biệt hoa thường:{" "}
            <strong>
              {question.caseSensitive
                ? "Có"
                : "Không"}
            </strong>
          </span>

          <span>
            Bỏ khoảng trắng thừa:{" "}
            <strong>
              {question.trimWhitespace
                ? "Có"
                : "Không"}
            </strong>
          </span>
        </div>
      </div>

      <label
        className={
          styles.editField
        }
      >
        <span>
          Giải thích
        </span>

        <textarea
          value={
            explanation
          }
          disabled={
            disabled
          }
          rows={2}
          onChange={(
            event
          ) =>
            updateBaseField(
              "explanation",
              event.target.value
            )
          }
        />
      </label>

      {needsManualReview && (
        <button
          type="button"
          className={
            styles.resolveButton
          }
          disabled={
            disabled
          }
          onClick={
            onConfirmAnswer
          }
        >
          Dùng đáp án đã nhập
        </button>
      )}
    </div>
  );
}

export default function ImportQuestionsModal({
  open,
  importing = false,
  onClose,
  onImport,
}: ImportQuestionsModalProps) {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );
  const docxAssetInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const importRequestRef =
    useRef(false);
  const analysisCompleteTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(
    null
  );
  const [
    selectedDocxAssetFile,
    setSelectedDocxAssetFile,
  ] = useState<File | null>(
    null
  );

  const [
    parsedData,
    setParsedData,
  ] =
    useState<ImportQuestionsResponse | null>(
      null
    );

  const [
    selectedImportIds,
    setSelectedImportIds,
  ] = useState<string[]>(
    []
  );

  const [
    expandedImportIds,
    setExpandedImportIds,
  ] = useState<string[]>(
    []
  );

  const [
    parsing,
    setParsing,
  ] = useState(false);
  const [
    analysisCharged,
    setAnalysisCharged,
  ] = useState(false);

  const [
    dragging,
    setDragging,
  ] = useState(false);

  const [
    guideExpanded,
    setGuideExpanded,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const isBusy =
    parsing ||
    importing;

  useEffect(() => {
    if (!open) {
      return;
    }

    importRequestRef.current =
      false;

    setSelectedFile(null);
    setSelectedDocxAssetFile(null);
    setParsedData(null);
    setSelectedImportIds([]);
    setExpandedImportIds([]);
    setParsing(false);
    setAnalysisCharged(false);
    setDragging(false);
    setGuideExpanded(false);
    setError("");
    setNotice("");

    if (
      analysisCompleteTimerRef.current
    ) {
      clearTimeout(
        analysisCompleteTimerRef.current
      );
      analysisCompleteTimerRef.current =
        null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (
        analysisCompleteTimerRef.current
      ) {
        clearTimeout(
          analysisCompleteTimerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event:
        globalThis.KeyboardEvent
    ) => {
      if (
        event.key ===
          "Escape" &&
        !isBusy
      ) {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    isBusy,
    onClose,
    open,
  ]);

  const validatedQuestions =
    useMemo(() => {
      if (!parsedData) {
        return [];
      }

      return validateImportedQuestions(
        parsedData.questions
      );
    }, [parsedData]);

  const validQuestions =
    useMemo(() => {
      return validatedQuestions.filter(
        (entry) =>
          entry.valid
      );
    }, [validatedQuestions]);

  const invalidQuestions =
    useMemo(() => {
      return validatedQuestions.filter(
        (entry) =>
          !entry.valid
      );
    }, [validatedQuestions]);

  const pendingReviewQuestions =
    useMemo(() => {
      return invalidQuestions.filter(
        (entry) =>
          getNeedsManualReview(
            entry.item
          )
      );
    }, [invalidQuestions]);

  const structuralInvalidQuestions =
    useMemo(() => {
      return invalidQuestions.filter(
        (entry) =>
          !getNeedsManualReview(
            entry.item
          )
      );
    }, [invalidQuestions]);

  const validImportIds =
    useMemo(() => {
      return new Set(
        validQuestions.map(
          (entry) =>
            entry.item.importId
        )
      );
    }, [validQuestions]);

  useEffect(() => {
    setSelectedImportIds(
      (currentIds) => {
        const nextIds =
          currentIds.filter(
            (id) =>
              validImportIds.has(
                id
              )
          );

        return nextIds.length ===
          currentIds.length
          ? currentIds
          : nextIds;
      }
    );
  }, [validImportIds]);

  const selectedQuestions =
    useMemo(() => {
      const selectedSet =
        new Set(
          selectedImportIds
        );

      return validQuestions.filter(
        (entry) =>
          selectedSet.has(
            entry.item.importId
          )
      );
    }, [
      selectedImportIds,
      validQuestions,
    ]);

  const allValidSelected =
    validQuestions.length >
      0 &&
    validQuestions.every(
      (entry) =>
        selectedImportIds.includes(
          entry.item.importId
        )
    );

  const selectionIsPartial =
    selectedQuestions.length >
      0 &&
    selectedQuestions.length <
      validQuestions.length;

  const allQuestionsExpanded =
    validatedQuestions.length >
      0 &&
    validatedQuestions.every(
      (entry) =>
        expandedImportIds.includes(
          entry.item.importId
        )
    );

  const selectedFileExtension =
    selectedFile?.name
      .split(".")
      .pop()
      ?.toLocaleLowerCase() ??
    "";
  const canAttachDocxAssets =
    selectedFileExtension ===
    "pdf";

  const validateFile = (
    file: File
  ): string => {
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLocaleLowerCase();

    if (
      !extension ||
      !ACCEPTED_EXTENSIONS.includes(
        extension as
          (typeof ACCEPTED_EXTENSIONS)[number]
      )
    ) {
      return "Chỉ hỗ trợ file .docx, .pdf hoặc .txt.";
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return "Dung lượng file không được vượt quá 10 MB.";
    }

    if (file.size === 0) {
      return "File đang trống.";
    }

    return "";
  };

  const validateDocxAssetFile = (
    file: File
  ): string => {
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLocaleLowerCase();

    if (
      extension !== "docx"
    ) {
      return "File lấy hình minh họa phải là .docx.";
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return "Dung lượng file DOCX phụ không được vượt quá 10 MB.";
    }

    if (file.size === 0) {
      return "File DOCX phụ đang trống.";
    }

    return "";
  };

  const resetParsedResult =
    () => {
      setParsedData(null);
      setSelectedImportIds([]);
      setExpandedImportIds([]);
      setAnalysisCharged(false);
      setError("");

      if (
        analysisCompleteTimerRef.current
      ) {
        clearTimeout(
          analysisCompleteTimerRef.current
        );
        analysisCompleteTimerRef.current =
          null;
      }
    };

  const handleFile = (
    file: File
  ) => {
    if (isBusy) {
      return;
    }

    const validationError =
      validateFile(file);

    if (validationError) {
      setSelectedFile(null);
      setSelectedDocxAssetFile(
        null
      );
      resetParsedResult();

      setError(
        validationError
      );

      return;
    }

    setSelectedFile(file);
    if (
      !file.name
        .toLocaleLowerCase()
        .endsWith(".pdf")
    ) {
      setSelectedDocxAssetFile(
        null
      );
    }
    resetParsedResult();
  };

  const handleFileInputChange = (
    event:
      ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (file) {
      handleFile(file);
    }

    event.target.value = "";
  };

  const handleDrop = (
    event:
      DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    setDragging(false);

    if (isBusy) {
      return;
    }

    const file =
      event.dataTransfer
        .files[0];

    if (file) {
      handleFile(file);
    }
  };

  const handleDropzoneKeyDown = (
    event:
      KeyboardEvent<HTMLDivElement>
  ) => {
    if (isBusy) {
      return;
    }

    if (
      event.key ===
        "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      fileInputRef.current?.click();
    }
  };

  const handleChooseFile =
    () => {
      if (isBusy) {
        return;
      }

      fileInputRef.current?.click();
    };

  const handleRemoveFile =
    () => {
      if (isBusy) {
        return;
      }

      setSelectedFile(null);
      setSelectedDocxAssetFile(
        null
      );
      resetParsedResult();
    };

  const handleDocxAssetFile = (
    file: File
  ) => {
    if (isBusy) {
      return;
    }

    const validationError =
      validateDocxAssetFile(
        file
      );

    if (validationError) {
      setSelectedDocxAssetFile(
        null
      );
      resetParsedResult();
      setError(
        validationError
      );
      return;
    }

    setSelectedDocxAssetFile(
      file
    );
    resetParsedResult();
  };

  const handleDocxAssetInputChange =
    (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target.files?.[0];

      if (file) {
        handleDocxAssetFile(
          file
        );
      }

      event.target.value = "";
    };

  const handleChooseDocxAssetFile =
    () => {
      if (isBusy) {
        return;
      }

      docxAssetInputRef.current?.click();
    };

  const handleRemoveDocxAssetFile =
    () => {
      if (isBusy) {
        return;
      }

      setSelectedDocxAssetFile(
        null
      );
      resetParsedResult();
    };

  const handleTemplateClick = (
    event:
      MouseEvent<HTMLAnchorElement>
  ) => {
    if (isBusy) {
      event.preventDefault();
    }
  };

  const handleCopyPrompt =
    async () => {
      if (isBusy) {
        return;
      }

      try {
        setError("");
        setNotice("");

        const response =
          await fetch(
            PROMPT_DOWNLOAD_URL,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (!response.ok) {
          throw new Error(
            "Không tải được prompt chuẩn."
          );
        }

        const promptText =
          await response.text();

        if (
          !navigator.clipboard
        ) {
          throw new Error(
            "Trình duyệt không cho phép copy prompt tự động."
          );
        }

        await navigator.clipboard.writeText(
          promptText.replace(
            /^\uFEFF/,
            ""
          )
        );

        setNotice(
          "Đã copy prompt chuẩn v8. Giáo viên có thể dán vào AI khi cần chuyển tài liệu thủ công."
        );
      } catch (
        copyError
      ) {
        setNotice("");
        setError(
          getErrorMessage(
            copyError
          )
        );
      }
    };

  const handleParseFile =
    async () => {
      if (
        !selectedFile ||
        isBusy
      ) {
        return;
      }

      setParsing(true);
      setAnalysisCharged(false);
      setError("");
      setNotice("");

      if (
        analysisCompleteTimerRef.current
      ) {
        clearTimeout(
          analysisCompleteTimerRef.current
        );
        analysisCompleteTimerRef.current =
          null;
      }

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          selectedFile
        );

        if (
          canAttachDocxAssets &&
          selectedDocxAssetFile
        ) {
          formData.append(
            "docxAssetFile",
            selectedDocxAssetFile
          );
        }

        const idToken =
          await getImportAuthToken();

        const response =
          await fetch(
            "/api/question-bank/import",
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${idToken}`,
              },
              body: formData,
            }
          );

        let responseData:
          | ImportQuestionsResponse
          | ImportQuestionsErrorResponse;

        try {
          responseData =
            (await response.json()) as
              | ImportQuestionsResponse
              | ImportQuestionsErrorResponse;
        } catch {
          throw new Error(
            "Máy chủ trả về dữ liệu không hợp lệ."
          );
        }

        if (!response.ok) {
          throw new Error(
            "message" in
              responseData
              ? responseData.message
              : "Không thể xử lý file."
          );
        }

        const successfulData =
          responseData as
            ImportQuestionsResponse;

        const validated =
          validateImportedQuestions(
            successfulData.questions
          );

        const validIds =
          validated
            .filter(
              (entry) =>
                entry.valid
            )
            .map(
              (entry) =>
                entry.item.importId
            );

        setParsedData(
          successfulData
        );

        setSelectedImportIds(
          validIds
        );

        setExpandedImportIds(
          validated.length <= 5
            ? validated.map(
                (entry) =>
                  entry.item.importId
              )
            : []
        );

        setAnalysisCharged(true);
        analysisCompleteTimerRef.current =
          setTimeout(() => {
            setAnalysisCharged(false);
            analysisCompleteTimerRef.current =
              null;
          }, 1400);

        if (
          successfulData.questions
            .length === 0
        ) {
          const duplicateWarnings =
            successfulData.warnings.filter(
              (warning) =>
                warning.message.includes(
                  "trùng"
                ) ||
                warning.message.includes(
                  "đã tồn tại"
                )
            );

          setError(
            duplicateWarnings.length >
              0
              ? "Tất cả câu hỏi nhận diện được đều bị trùng nên không có câu nào để nhập."
              : "Không nhận diện được câu hỏi nào trong file."
          );
        }
      } catch (
        parseError
      ) {
        setParsedData(null);
        setSelectedImportIds([]);
        setExpandedImportIds([]);
        setAnalysisCharged(false);
        setNotice("");

        setError(
          getErrorMessage(
            parseError
          )
        );
      } finally {
        setParsing(false);
      }
    };

  const handleToggleQuestion = (
    importId: string
  ) => {
    if (
      isBusy ||
      !validImportIds.has(
        importId
      )
    ) {
      return;
    }

    setSelectedImportIds(
      (currentIds) => {
        if (
          currentIds.includes(
            importId
          )
        ) {
          return currentIds.filter(
            (id) =>
              id !== importId
          );
        }

        return [
          ...currentIds,
          importId,
        ];
      }
    );
  };

  const handleToggleExpanded = (
    importId: string
  ) => {
    setExpandedImportIds(
      (currentIds) => {
        if (
          currentIds.includes(
            importId
          )
        ) {
          return currentIds.filter(
            (id) =>
              id !== importId
          );
        }

        return [
          ...currentIds,
          importId,
        ];
      }
    );
  };

  const handleToggleAll =
    () => {
      if (
        isBusy ||
        validQuestions.length ===
          0
      ) {
        return;
      }

      if (allValidSelected) {
        setSelectedImportIds(
          []
        );

        return;
      }

      setSelectedImportIds(
        validQuestions.map(
          (entry) =>
            entry.item.importId
        )
      );
    };

  const handleToggleAllExpanded =
    () => {
      if (
        validatedQuestions.length ===
        0
      ) {
        return;
      }

      if (
        allQuestionsExpanded
      ) {
        setExpandedImportIds(
          []
        );

        return;
      }

      setExpandedImportIds(
        validatedQuestions.map(
          (entry) =>
            entry.item.importId
        )
      );
    };

  const handleUpdateQuestion = (
    importId: string,
    updater:
      QuestionUpdater,
    options:
      QuestionEditOptions = {}
  ) => {
    if (isBusy) {
      return;
    }

    setParsedData(
      (currentData) => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          questions:
            currentData.questions.map(
              (item) => {
                if (
                  item.importId !==
                  importId
                ) {
                  return item;
                }

                const nextItem = {
                  ...item,
                  question:
                    updater(
                      item.question
                    ),
                };

                return options.confirmAnswer
                  ? clearManualReview(
                      nextItem
                    )
                  : nextItem;
              }
            ),
        };
      }
    );

    if (
      options.confirmAnswer
    ) {
      setSelectedImportIds(
        (currentIds) =>
          currentIds.includes(
            importId
          )
            ? currentIds
            : [
                ...currentIds,
                importId,
              ]
      );
    }
  };

  const handleConfirmAnswer = (
    importId: string
  ) => {
    if (isBusy) {
      return;
    }

    setParsedData(
      (currentData) => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          questions:
            currentData.questions.map(
              (item) =>
                item.importId ===
                importId
                  ? clearManualReview(
                      item
                    )
                  : item
            ),
        };
      }
    );

    setSelectedImportIds(
      (currentIds) =>
        currentIds.includes(
          importId
        )
          ? currentIds
          : [
              ...currentIds,
              importId,
            ]
    );
  };

  const handleImport =
    async () => {
      if (
        selectedQuestions.length ===
          0 ||
        isBusy ||
        importRequestRef.current
      ) {
        return;
      }

      importRequestRef.current =
        true;

      setError("");

      try {
        await onImport(
          selectedQuestions.map(
            (entry) =>
              entry.item.question
          )
        );
      } catch (
        importError
      ) {
        importRequestRef.current =
          false;

        setError(
          getErrorMessage(
            importError
          )
        );
      }
    };

  if (!open) {
    return null;
  }

  return (
    <div
      className={
        styles.backdrop
      }
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !isBusy
        ) {
          onClose();
        }
      }}
    >
      <section
        className={
          styles.modal
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-questions-title"
        aria-busy={
          isBusy
        }
      >
        <header
          className={
            styles.header
          }
        >
          <div>
            <h2
              id="import-questions-title"
              className={
                styles.title
              }
            >
              Nhập câu hỏi từ tài liệu
            </h2>

            <p
              className={
                styles.description
              }
            >
              Hỗ trợ PDF, Word .docx và
              văn bản .txt, tối đa 10 MB.
            </p>
          </div>

          <button
            type="button"
            className={
              styles.closeButton
            }
            aria-label="Đóng"
            disabled={
              isBusy
            }
            onClick={
              onClose
            }
          >
            ×
          </button>
        </header>

        <div
          className={
            styles.body
          }
        >
          <section
            className={
              styles.templatePanel
            }
            aria-labelledby="import-template-title"
          >
            <div
              className={
                styles.templateIcon
              }
              aria-hidden="true"
            >
              ↓
            </div>

            <div
              className={
                styles.templateContent
              }
            >
              <h3
                id="import-template-title"
              >
                Chưa có tài liệu đúng
                định dạng?
              </h3>

                <p>
                Tải file mẫu để nhập thủ
                công, hoặc copy prompt
                chuẩn v8 khi cần chuyển
                tài liệu thủ công bằng AI.
              </p>
            </div>

            <div
              className={
                styles.templateActions
              }
            >
              <a
                href={
                  TEMPLATE_DOWNLOAD_URL
                }
                download
                aria-disabled={
                  isBusy
                }
                className={`${styles.templateButton} ${
                  isBusy
                    ? styles.templateButtonDisabled
                    : ""
                }`}
                onClick={
                  handleTemplateClick
                }
              >
                Tải file mẫu
              </a>

              <button
                type="button"
                className={`${styles.templateButton} ${styles.templateButtonSecondary}`}
                disabled={
                  isBusy
                }
                onClick={
                  handleCopyPrompt
                }
              >
                Copy prompt
              </button>

            </div>
          </section>

          <section
            className={
              styles.guide
            }
          >
            <button
              type="button"
              className={
                styles.guideToggle
              }
              aria-expanded={
                guideExpanded
              }
              aria-controls="import-format-guide"
              onClick={() => {
                setGuideExpanded(
                  (current) =>
                    !current
                );
              }}
            >
              <span>
                Hướng dẫn định dạng tài
                liệu
              </span>

              <span
                className={`${styles.guideChevron} ${
                  guideExpanded
                    ? styles.guideChevronExpanded
                    : ""
                }`}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>

            {guideExpanded && (
              <div
                id="import-format-guide"
                className={
                  styles.guideContent
                }
              >
                <div
                  className={
                    styles.guideRules
                  }
                >
                  <strong>
                    Quy tắc cơ bản
                  </strong>

                  <ul>
                    <li>
                      Mỗi câu bắt đầu bằng
                      “Câu 1.”, “Câu 2.”...
                    </li>

                    <li>
                      Câu trắc nghiệm và
                      đúng/sai nên có đủ A,
                      B, C, D.
                    </li>

                    <li>
                      Dòng đáp án bắt đầu
                      bằng “Đáp án:”.
                    </li>

                    <li>
                      Không cần thêm dòng
                      “Loại”, hệ thống tự
                      nhận diện từ cấu trúc
                      câu hỏi.
                    </li>

                    <li>
                      Nhiều đáp án trả lời
                      ngắn được ngăn cách
                      bằng dấu chấm phẩy.
                    </li>
                  </ul>
                </div>

                <pre
                  className={
                    styles.guideExample
                  }
                >
{`Câu 1. Thủ đô Việt Nam là gì?
Môn: Địa lý
Khối: 10
Chủ đề: Địa lý Việt Nam
Độ khó: Dễ
Mức độ: Nhận biết
A. Hà Nội
B. Huế
C. Đà Nẵng
D. TP. Hồ Chí Minh
Đáp án: A`}
                </pre>
              </div>
            )}
          </section>

          <div
            className={`${styles.dropzone} ${
              dragging
                ? styles.dropzoneDragging
                : ""
            } ${
              isBusy
                ? styles.dropzoneDisabled
                : ""
            }`}
            role="button"
            tabIndex={
              isBusy ? -1 : 0
            }
            aria-disabled={
              isBusy
            }
            onClick={
              handleChooseFile
            }
            onKeyDown={
              handleDropzoneKeyDown
            }
            onDragEnter={(
              event
            ) => {
              event.preventDefault();

              if (!isBusy) {
                setDragging(true);
              }
            }}
            onDragOver={(
              event
            ) => {
              event.preventDefault();
            }}
            onDragLeave={(
              event
            ) => {
              if (
                event.currentTarget ===
                event.target
              ) {
                setDragging(false);
              }
            }}
            onDrop={
              handleDrop
            }
          >
            <input
              ref={
                fileInputRef
              }
              type="file"
              accept={
                ACCEPTED_FILE_TYPES
              }
              className={
                styles.hiddenInput
              }
              disabled={
                isBusy
              }
              onChange={
                handleFileInputChange
              }
            />

            <div
              className={
                styles.uploadIcon
              }
              aria-hidden="true"
            >
              ↑
            </div>

            <strong>
              Kéo file vào đây hoặc nhấn
              để chọn
            </strong>

            <span>
              .pdf, .docx, .txt · tối đa 10 MB
            </span>
          </div>

          {selectedFile && (
            <div
              className={`${styles.fileCard} ${styles.fileCardReady}`}
            >
              <div
                className={
                  styles.fileInfo
                }
              >
                <strong>
                  {
                    selectedFile.name
                  }
                </strong>

                <span>
                  {formatFileSize(
                    selectedFile.size
                  )}
                </span>
              </div>

              <div
                className={
                  styles.fileActions
                }
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isBusy
                  }
                  onClick={
                    handleRemoveFile
                  }
                >
                  Chọn file khác
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={`${styles.parseButton} ${
                    parsing
                      ? styles.parseButtonCharging
                      : analysisCharged
                        ? styles.parseButtonCharged
                        : styles.parseButtonReady
                  }`}
                  disabled={
                    isBusy
                  }
                  onClick={() => {
                    void handleParseFile();
                  }}
                >
                  <span
                    className={
                      styles.batteryIcon
                    }
                    aria-hidden="true"
                  >
                    <span
                      className={
                        styles.batteryLevel
                      }
                    />
                  </span>

                  <span>
                    {parsing
                      ? "Đang phân tích..."
                      : analysisCharged
                        ? "Đã phân tích"
                        : parsedData
                          ? "Phân tích lại"
                          : "Phân tích file"}
                  </span>
                </Button>
              </div>
            </div>
          )}

          {selectedFile &&
            canAttachDocxAssets && (
              <section
                className={
                  styles.assetPanel
                }
                aria-labelledby="docx-asset-title"
              >
                <input
                  ref={
                    docxAssetInputRef
                  }
                  type="file"
                  accept=".docx"
                  className={
                    styles.hiddenInput
                  }
                  disabled={
                    isBusy
                  }
                  onChange={
                    handleDocxAssetInputChange
                  }
                />

                <div
                  className={
                    styles.assetInfo
                  }
                >
                  <strong
                    id="docx-asset-title"
                  >
                    DOCX cùng bộ đề để lấy
                    hình minh họa
                  </strong>

                  <span>
                    PDF vẫn dùng để đọc câu
                    hỏi/đáp án; DOCX chỉ bổ
                    sung hình, bảng, đồ thị.
                  </span>
                </div>

                <div
                  className={
                    styles.assetActions
                  }
                >
                  {selectedDocxAssetFile ? (
                    <div
                      className={
                        styles.assetFileName
                      }
                    >
                      <strong>
                        {
                          selectedDocxAssetFile.name
                        }
                      </strong>

                      <span>
                        {formatFileSize(
                          selectedDocxAssetFile.size
                        )}
                      </span>
                    </div>
                  ) : (
                    <span
                      className={
                        styles.assetEmpty
                      }
                    >
                      Chưa chọn DOCX phụ
                    </span>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      isBusy
                    }
                    onClick={
                      handleChooseDocxAssetFile
                    }
                  >
                    {selectedDocxAssetFile
                      ? "Đổi DOCX"
                      : "Chọn DOCX"}
                  </Button>

                  {selectedDocxAssetFile && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        isBusy
                      }
                      onClick={
                        handleRemoveDocxAssetFile
                      }
                    >
                      Bỏ DOCX
                    </Button>
                  )}
                </div>
              </section>
            )}

          {notice && (
            <div
              className={
                styles.notice
              }
              role="status"
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              className={
                styles.error
              }
              role="alert"
            >
              {error}
            </div>
          )}

          {parsedData && (
            <>
              <div
                className={
                  styles.previewHeader
                }
              >
                <div>
                  <h3>
                    Xem trước câu hỏi
                  </h3>

                  <p>
                    Nhận diện{" "}
                    <strong>
                      {
                        validatedQuestions.length
                      }
                    </strong>{" "}
                    câu ·{" "}
                    <strong>
                      {
                        validQuestions.length
                      }
                    </strong>{" "}
                    hợp lệ ·{" "}
                    <strong>
                      {
                        pendingReviewQuestions.length
                      }
                    </strong>{" "}
                    chờ xác nhận ·{" "}
                    <strong>
                      {
                        structuralInvalidQuestions.length
                      }
                    </strong>{" "}
                    lỗi · đã chọn{" "}
                    <strong>
                      {
                        selectedQuestions.length
                      }
                    </strong>
                    .
                  </p>
                </div>

                <div
                  className={
                    styles.previewActions
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.expandAllButton
                    }
                    onClick={
                      handleToggleAllExpanded
                    }
                  >
                    {allQuestionsExpanded
                      ? "Thu gọn tất cả"
                      : "Mở rộng tất cả"}
                  </button>

                  <label
                    className={
                      styles.selectAll
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        allValidSelected
                      }
                      ref={(
                        input
                      ) => {
                        if (input) {
                          input.indeterminate =
                            selectionIsPartial;
                        }
                      }}
                      disabled={
                        isBusy ||
                        validQuestions.length ===
                          0
                      }
                      onChange={
                        handleToggleAll
                      }
                    />

                    Chọn tất cả câu hợp lệ
                  </label>
                </div>
              </div>

              {structuralInvalidQuestions.length >
                0 && (
                <div
                  className={
                    styles.warningBox
                  }
                >
                  <strong>
                    Câu hỏi chưa hợp lệ
                  </strong>

                  <ul>
                    {structuralInvalidQuestions.map(
                      (
                        entry
                      ) => (
                        <li
                          key={
                            entry.item
                              .importId
                          }
                        >
                          Câu{" "}
                          {
                            entry.item
                              .sourceNumber
                          }
                          :{" "}
                          {entry.errors.join(
                            " "
                          )}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              <div
                className={
                  styles.previewList
                }
              >
                {validatedQuestions.map(
                  (
                    entry
                  ) => {
                    const {
                      item,
                      valid,
                      errors,
                    } = entry;

                    const selected =
                      selectedImportIds.includes(
                        item.importId
                      );

                    const expanded =
                      expandedImportIds.includes(
                        item.importId
                      );
                    const answerSourceLabel =
                      getAnswerSourceLabel(
                        item
                      );
                    const answerSource =
                      item.answerSource ??
                      item.answer_source;
                    const needsManualReview =
                      getNeedsManualReview(
                        item
                      );

                    return (
                      <article
                        key={
                          item.importId
                        }
                        className={`${styles.previewCard} ${
                          selected
                            ? styles.previewCardSelected
                            : ""
                        } ${
                          !valid
                            ? styles.previewCardInvalid
                            : ""
                        }`}
                        aria-invalid={
                          !valid
                        }
                      >
                        <div
                          className={
                            styles.previewCardTop
                          }
                        >
                          <label
                            className={
                              styles.questionSelect
                            }
                          >
                            <input
                              type="checkbox"
                              checked={
                                selected
                              }
                              disabled={
                                isBusy ||
                                !valid
                              }
                              onChange={() =>
                                handleToggleQuestion(
                                  item.importId
                                )
                              }
                            />

                            <span>
                              Câu{" "}
                              {
                                item.sourceNumber
                              }
                            </span>
                          </label>

                          <div
                            className={
                              styles.questionContent
                            }
                          >
                            <div
                              className={
                                styles.badges
                              }
                            >
                              <span>
                                {getQuestionTypeLabel(
                                  item.question
                                )}
                              </span>

                              <span>
                                {
                                  item
                                    .question
                                    .subject
                                }
                              </span>

                              <span>
                                Khối{" "}
                                {
                                  item
                                    .question
                                    .grade
                                }
                              </span>

                              <span>
                                {getDifficultyLabel(
                                  item
                                    .question
                                    .difficulty
                                )}
                              </span>

                              <span>
                                {getCognitiveLevelLabel(
                                  item
                                    .question
                                    .cognitiveLevel
                                )}
                              </span>

                              {answerSourceLabel && (
                                <span
                                  className={
                                    answerSource ===
                                    "pdf_color"
                                      ? styles.answerSourcePdf
                                      : styles.answerSourceManual
                                  }
                                >
                                  {
                                    answerSourceLabel
                                  }
                                </span>
                              )}

                              <span
                                className={
                                  valid
                                    ? styles.validBadge
                                    : needsManualReview
                                      ? styles.reviewBadge
                                    : styles.invalidBadge
                                }
                              >
                                {valid
                                  ? "Hợp lệ"
                                  : needsManualReview
                                    ? "Chờ xác nhận"
                                    : "Có lỗi"}
                              </span>
                            </div>

                            <QuestionContentBlocks
                              className={
                                styles.questionRichPreview
                              }
                              content={
                                item.question
                                  .content
                              }
                              blocks={
                                item.question
                                  .contentBlocks
                              }
                              questionImageId={
                                item.question
                                  .questionImageId
                              }
                              questionImageUrl={
                                item.question
                                  .questionImageUrl
                              }
                            />

                            {item.question
                              .topic && (
                              <p
                                className={
                                  styles.metadataLine
                                }
                              >
                                <strong>
                                  Chủ đề:
                                </strong>{" "}
                                {
                                  item.question
                                    .topic
                                }
                              </p>
                            )}

                            {item.question
                              .tags &&
                              item.question.tags
                                .length >
                                0 && (
                                <div
                                  className={
                                    styles.tagList
                                  }
                                >
                                  {item.question.tags.map(
                                    (
                                      tag,
                                      index
                                    ) => (
                                      <span
                                        key={`${tag}-${index}`}
                                      >
                                        #{tag}
                                      </span>
                                    )
                                  )}
                                </div>
                              )}

                            {!valid && (
                              <div
                                className={
                                  needsManualReview
                                    ? styles.inlineReview
                                    : styles.inlineError
                                }
                                role="alert"
                              >
                                {errors.join(
                                  " "
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className={
                              styles.expandButton
                            }
                            aria-expanded={
                              expanded
                            }
                            aria-label={
                              expanded
                                ? `Thu gọn câu ${item.sourceNumber}`
                                : `Xem chi tiết câu ${item.sourceNumber}`
                            }
                            onClick={() =>
                              handleToggleExpanded(
                                item.importId
                              )
                            }
                          >
                            <span>
                              {expanded
                                ? "Thu gọn"
                                : "Chi tiết"}
                            </span>

                            <span
                              className={`${styles.expandChevron} ${
                                expanded
                                  ? styles.expandChevronOpen
                                  : ""
                              }`}
                              aria-hidden="true"
                            >
                              ▼
                            </span>
                          </button>
                        </div>

                        {expanded && (
                          <div
                            className={
                              styles.previewCardDetail
                            }
                          >
                            <QuestionDetail
                              item={
                                item
                              }
                              disabled={
                                isBusy
                              }
                              onConfirmAnswer={() =>
                                handleConfirmAnswer(
                                  item.importId
                                )
                              }
                              onQuestionChange={(
                                updater,
                                options
                              ) =>
                                handleUpdateQuestion(
                                  item.importId,
                                  updater,
                                  options
                                )
                              }
                            />
                          </div>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            </>
          )}
        </div>

        <footer
          className={
            styles.footer
          }
        >
          <Button
            type="button"
            variant="outline"
            disabled={
              isBusy
            }
            onClick={
              onClose
            }
          >
            Hủy
          </Button>

          <Button
            type="button"
            disabled={
              selectedQuestions.length ===
                0 ||
              isBusy
            }
            onClick={() => {
              void handleImport();
            }}
          >
            {importing
              ? `Đang nhập ${selectedQuestions.length} câu hỏi...`
              : `Nhập ${selectedQuestions.length} câu hỏi`}
          </Button>
        </footer>
      </section>
    </div>
  );
}
