"use client";

import {
  type ChangeEvent,
  useState,
} from "react";

import type {
  TestQuestionItem as TestQuestionItemData,
  TestQuestionSnapshot,
} from "../../types";

import QuestionContentBlocks from "@/components/question-content/QuestionContentBlocks";

import styles from "../testEditor.module.css";

type TestQuestionItemProps = {
  question:
    TestQuestionItemData;

  index: number;

  first: boolean;

  last: boolean;

  disabled?: boolean;

  onMoveUp: () => void;

  onMoveDown: () => void;

  onRemove: () => void;

  onScoreChange: (
    score: number
  ) => void;

  onRequiredChange: (
    required: boolean
  ) => void;

  onSnapshotChange: (
    snapshot:
      TestQuestionSnapshot
  ) => void;
};

function resolveAnswerImageUrl({
  imageId,
  imageUrl,
}: {
  imageId?: string;
  imageUrl?: string;
}) {
  return imageId?.trim()
    ? `/api/question-images/${encodeURIComponent(
        imageId.trim()
      )}`
    : imageUrl?.trim() ?? "";
}

const TYPE_LABELS = {
  single_choice:
    "Trắc nghiệm",

  true_false_group:
    "Đúng / Sai",

  short_answer:
    "Trả lời ngắn",
} as const;

export default function TestQuestionItem({
  question,
  index,
  first,
  last,
  disabled = false,
  onMoveUp,
  onMoveDown,
  onRemove,
  onScoreChange,
  onRequiredChange,
  onSnapshotChange,
}: TestQuestionItemProps) {
  const [
    editing,
    setEditing,
  ] = useState(false);
  const [draft, setDraft] =
    useState<TestQuestionSnapshot>(
      question.snapshot
    );

  const handleScoreChange = (
    event:
      ChangeEvent<HTMLInputElement>
  ) => {
    onScoreChange(
      Number(
        event.target.value
      )
    );
  };

  const startEditing = () => {
    setDraft(
      question.snapshot
    );
    setEditing(true);
  };

  const saveDraft = () => {
    onSnapshotChange(draft);
    setEditing(false);
  };

  const updateContent = (
    content: string
  ) => {
    setDraft((current) => ({
      ...current,
      content,
      contentBlocks:
        current.contentBlocks
          ?.length
          ? [
              {
                type:
                  "text" as const,
                content,
              },
              ...current.contentBlocks.filter(
                (block) =>
                  block.type !==
                  "text"
              ),
            ]
          : undefined,
    }));
  };

  const renderPreview = () => (
    <>
      <QuestionContentBlocks
        className={
          styles.questionText
        }
        content={
          question.snapshot
            .content
        }
        blocks={
          question.snapshot
            .contentBlocks
        }
        questionImageId={
          question.snapshot
            .questionImageId
        }
        questionImageUrl={
          question.snapshot
            .questionImageUrl
        }
      />

      {question.snapshot.type ===
      "single_choice" ? (
        <div
          className={
            styles.optionPreview
          }
        >
          {question.snapshot.options.map(
            (option) => (
              <span
                key={
                  option.id
                }
                className={
                  styles.optionPreviewItem
                }
              >
                <strong>
                  {
                    option.id
                  }.
                </strong>{" "}
                {
                  option.content
                }

                {(option.imageId ||
                  option.imageUrl) && (
                  <img
                    src={resolveAnswerImageUrl(
                      option
                    )}
                    alt={`Ảnh phương án ${option.id}`}
                    className={
                      styles.optionPreviewImage
                    }
                  />
                )}
              </span>
            )
          )}
        </div>
      ) : null}

      {question.snapshot.type ===
      "true_false_group" ? (
        <div
          className={
            styles.optionPreview
          }
        >
          {question.snapshot.statements.map(
            (statement) => (
              <span
                key={
                  statement.id
                }
                className={
                  styles.optionPreviewItem
                }
              >
                <strong>
                  {
                    statement.id
                  }.
                </strong>{" "}
                {
                  statement.content
                }

                {(statement.imageId ||
                  statement.imageUrl) && (
                  <img
                    src={resolveAnswerImageUrl(
                      statement
                    )}
                    alt={`Ảnh mệnh đề ${statement.id}`}
                    className={
                      styles.optionPreviewImage
                    }
                  />
                )}
              </span>
            )
          )}
        </div>
      ) : null}

      {question.snapshot.type ===
      "short_answer" ? (
        <div
          className={
            styles.answerPreview
          }
        >
          Đáp án chấp nhận:{" "}
          {question.snapshot.acceptedAnswers.join(
            ", "
          ) || "Chưa có"}
        </div>
      ) : null}
    </>
  );

  const renderEditor = () => (
    <div
      className={
        styles.snapshotEditor
      }
    >
      <label
        className={
          styles.field
        }
      >
        <span>Nội dung câu hỏi</span>

        <textarea
          value={
            draft.content
          }
          disabled={
            disabled
          }
          rows={4}
          onChange={(
            event
          ) =>
            updateContent(
              event.target
                .value
            )
          }
        />
      </label>

      {draft.type ===
      "single_choice" ? (
        <div
          className={
            styles.snapshotGrid
          }
        >
          {draft.options.map(
            (option) => (
              <label
                key={
                  option.id
                }
                className={
                  styles.optionEditRow
                }
              >
                <span>
                  {option.id}
                </span>

                <input
                  type="text"
                  value={
                    option.content
                  }
                  disabled={
                    disabled
                  }
                  onChange={(
                    event
                  ) =>
                    setDraft(
                      (
                        current
                      ) =>
                        current.type ===
                        "single_choice"
                          ? {
                              ...current,
                              options:
                                current.options.map(
                                  (
                                    item
                                  ) =>
                                    item.id ===
                                    option.id
                                      ? {
                                          ...item,
                                          content:
                                            event
                                              .target
                                              .value,
                                        }
                                      : item
                                ),
                            }
                          : current
                    )
                  }
                />

                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={
                    draft.correctOptionId ===
                    option.id
                  }
                  disabled={
                    disabled
                  }
                  onChange={() =>
                    setDraft(
                      (
                        current
                      ) =>
                        current.type ===
                        "single_choice"
                          ? {
                              ...current,
                              correctOptionId:
                                option.id,
                            }
                          : current
                    )
                  }
                />
              </label>
            )
          )}
        </div>
      ) : null}

      {draft.type ===
      "true_false_group" ? (
        <div
          className={
            styles.snapshotGrid
          }
        >
          {draft.statements.map(
            (statement) => (
              <div
                key={
                  statement.id
                }
                className={
                  styles.statementEditRow
                }
              >
                <label>
                  <span>
                    {
                      statement.id
                    }
                  </span>

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
                    ) =>
                      setDraft(
                        (
                          current
                        ) =>
                          current.type ===
                          "true_false_group"
                            ? {
                                ...current,
                                statements:
                                  current.statements.map(
                                    (
                                      item
                                    ) =>
                                      item.id ===
                                      statement.id
                                        ? {
                                            ...item,
                                            content:
                                              event
                                                .target
                                                .value,
                                          }
                                        : item
                                  ),
                              }
                            : current
                      )
                    }
                  />
                </label>

                <select
                  value={
                    statement.correctAnswer
                      ? "true"
                      : "false"
                  }
                  disabled={
                    disabled
                  }
                  onChange={(
                    event
                  ) =>
                    setDraft(
                      (
                        current
                      ) =>
                        current.type ===
                        "true_false_group"
                          ? {
                              ...current,
                              statements:
                                current.statements.map(
                                  (
                                    item
                                  ) =>
                                    item.id ===
                                    statement.id
                                      ? {
                                          ...item,
                                          correctAnswer:
                                            event
                                              .target
                                              .value ===
                                            "true",
                                        }
                                      : item
                                ),
                            }
                          : current
                    )
                  }
                >
                  <option value="true">
                    Đúng
                  </option>
                  <option value="false">
                    Sai
                  </option>
                </select>
              </div>
            )
          )}
        </div>
      ) : null}

      {draft.type ===
      "short_answer" ? (
        <label
          className={
            styles.field
          }
        >
          <span>
            Đáp án chấp nhận
          </span>

          <input
            type="text"
            value={
              draft.acceptedAnswers.join(
                "; "
              )
            }
            disabled={
              disabled
            }
            placeholder="Mỗi đáp án cách nhau bằng dấu ;"
            onChange={(
              event
            ) =>
              setDraft(
                (
                  current
                ) =>
                  current.type ===
                  "short_answer"
                    ? {
                        ...current,
                        acceptedAnswers:
                          event.target.value
                            .split(";")
                            .map(
                              (
                                item
                              ) =>
                                item.trim()
                            )
                            .filter(
                              Boolean
                            ),
                      }
                    : current
              )
            }
          />
        </label>
      ) : null}

      <div
        className={
          styles.editorActions
        }
      >
        <button
          type="button"
          className={
            styles.secondaryButton
          }
          onClick={() =>
            setEditing(false)
          }
        >
          Hủy sửa
        </button>

        <button
          type="button"
          className={
            styles.primaryButton
          }
          disabled={
            disabled
          }
          onClick={
            saveDraft
          }
        >
          Lưu câu hỏi
        </button>
      </div>
    </div>
  );

  return (
    <article
      className={
        styles.questionItem
      }
    >
      <div
        className={
          styles.questionNumber
        }
      >
        {index + 1}
      </div>

      <div
        className={
          styles.questionMain
        }
      >
        <div
          className={
            styles.questionMeta
          }
        >
          <span
            className={
              styles.typeBadge
            }
          >
            {
              TYPE_LABELS[
                question.snapshot
                  .type
              ]
            }
          </span>

          <span>
            {
              question.snapshot
                .difficulty
            }
          </span>

          {question.snapshot
            .topic ? (
            <span>
              {
                question.snapshot
                  .topic
              }
            </span>
          ) : null}
        </div>

        {editing
          ? renderEditor()
          : renderPreview()}
      </div>

      <div
        className={
          styles.questionControls
        }
      >
        <label
          className={
            styles.scoreField
          }
        >
          <span>Điểm</span>

          <input
            type="number"
            min="0.1"
            step="0.1"
            value={
              question.score
            }
            disabled={
              disabled
            }
            onChange={
              handleScoreChange
            }
          />
        </label>

        <label
          className={
            styles.requiredField
          }
        >
          <input
            type="checkbox"
            checked={
              question.required
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) =>
              onRequiredChange(
                event.target
                  .checked
              )
            }
          />

          Bắt buộc
        </label>

        <button
          type="button"
          className={
            styles.secondaryButton
          }
          disabled={
            disabled
          }
          onClick={
            editing
              ? () =>
                  setEditing(false)
              : startEditing
          }
        >
          {editing ? "Đóng" : "Sửa"}
        </button>

        <div
          className={
            styles.questionActions
          }
        >
          <button
            type="button"
            className={
              styles.iconButton
            }
            disabled={
              disabled ||
              first
            }
            title="Di chuyển lên"
            onClick={
              onMoveUp
            }
          >
            ↑
          </button>

          <button
            type="button"
            className={
              styles.iconButton
            }
            disabled={
              disabled ||
              last
            }
            title="Di chuyển xuống"
            onClick={
              onMoveDown
            }
          >
            ↓
          </button>

          <button
            type="button"
            className={
              styles.dangerIconButton
            }
            disabled={
              disabled
            }
            title="Xóa khỏi đề"
            onClick={
              onRemove
            }
          >
            ×
          </button>
        </div>
      </div>
    </article>
  );
}
