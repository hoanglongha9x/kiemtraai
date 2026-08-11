"use client";

import {
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  Badge,
  Button,
  Card,
} from "@/components/ui";

import QuestionContentBlocks from "@/components/question-content/QuestionContentBlocks";

import MathContent from "@/components/common/MathContent";

import QuestionMetadataBadges from "./QuestionMetadataBadges";

import type {
  QuestionCardData,
} from "./types";

import styles from "./QuestionCard.module.css";

type QuestionCardProps = {
  question: QuestionCardData;
  selected: boolean;
  searchQuery?: string;

  onSelect: (
    questionId: string
  ) => void;

  onEdit: (
    questionId: string
  ) => void;

  onDuplicate: (
    questionId: string
  ) => void | Promise<void>;

  onDelete: (
    questionId: string
  ) => void;
};

const questionTypeLabels: Record<
  QuestionCardData["type"],
  string
> = {
  single_choice: "Trắc nghiệm",
  true_false_group: "Đúng / Sai",
  short_answer: "Trả lời ngắn",
};

function hasMathSyntax(
  value: string
) {
  return /(?:\\\(|\\\[|\$\$|\\(?:frac|sqrt|ce|vec|overline|sum|int|lim)\b)/u.test(
    value
  );
}

const questionTypeIcons: Record<
  QuestionCardData["type"],
  string
> = {
  single_choice: "A",
  true_false_group: "Đ/S",
  short_answer: "✎",
};

function escapeRegExp(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function highlightText(
  text: string,
  searchQuery?: string
): ReactNode {
  const normalizedQuery =
    searchQuery?.trim();

  if (!normalizedQuery) {
    return text;
  }

  const expression =
    new RegExp(
      `(${escapeRegExp(
        normalizedQuery
      )})`,
      "gi"
    );

  const parts =
    text.split(expression);

  return parts.map(
    (part, index) => {
      const matches =
        part.toLocaleLowerCase(
          "vi"
        ) ===
        normalizedQuery.toLocaleLowerCase(
          "vi"
        );

      if (!matches) {
        return part;
      }

      return (
        <mark
          key={`${part}-${index}`}
          className={
            styles.highlight
          }
        >
          {part}
        </mark>
      );
    }
  );
}

function formatUpdatedAt(
  value: string
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  const difference =
    Date.now() -
    date.getTime();

  const minutes =
    Math.floor(
      difference /
        (1000 * 60)
    );

  if (minutes < 1) {
    return "Vừa xong";
  }

  if (minutes < 60) {
    return `${minutes} phút trước`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours} giờ trước`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days < 7) {
    return `${days} ngày trước`;
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
}

function getQuestionImageUrl(
  question: QuestionCardData
): string {
  const fileId =
    question.questionImageId?.trim();

  if (fileId) {
    return `/api/teacher/question-images/${encodeURIComponent(
      fileId
    )}`;
  }

  return (
    question.questionImageUrl?.trim() ??
    ""
  );
}

function getAnswerImageUrl({
  imageId,
  imageUrl,
}: {
  imageId?: string;
  imageUrl?: string;
}) {
  const normalizedId =
    imageId?.trim();

  return normalizedId
    ? `/api/teacher/question-images/${encodeURIComponent(
        normalizedId
      )}`
    : imageUrl?.trim() ?? "";
}

function stopPropagation(
  event: MouseEvent
) {
  event.stopPropagation();
}

function QuestionImage({
  question,
}: {
  question: QuestionCardData;
}) {
  const [
    imageFailed,
    setImageFailed,
  ] = useState(false);

  const imageUrl =
    useMemo(
      () =>
        getQuestionImageUrl(
          question
        ),
      [
        question.questionImageId,
        question.questionImageUrl,
      ]
    );

  if (
    !imageUrl ||
    imageFailed
  ) {
    return null;
  }

  return (
    <div
      className={
        styles.questionImageCard
      }
      onClick={
        stopPropagation
      }
    >
      <a
        href={imageUrl}
        target="_blank"
        rel="noreferrer"
        className={
          styles.questionImageLink
        }
        aria-label="Mở hình minh họa ở kích thước đầy đủ"
      >
        <img
          key={imageUrl}
          src={imageUrl}
          alt="Hình minh họa cho câu hỏi"
          className={
            styles.questionImage
          }
          loading="lazy"
          onError={() =>
            setImageFailed(true)
          }
        />
      </a>

      <span
        className={
          styles.questionImageCaption
        }
      >
        Hình minh họa
      </span>
    </div>
  );
}

function SingleChoiceAnswer({
  question,
  searchQuery,
}: {
  question: Extract<
    QuestionCardData,
    {
      type: "single_choice";
    }
  >;

  searchQuery?: string;
}) {
  return (
    <div
      className={
        styles.answerList
      }
    >
      {question.options.map(
        (option) => {
          const isCorrect =
            option.id ===
            question.correctOptionId;

          return (
            <div
              key={option.id}
              className={[
                styles.answerItem,
                isCorrect
                  ? styles.correctAnswer
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className={
                  styles.answerId
                }
              >
                {option.id}
              </span>

              <div
                className={
                  styles.answerContent
                }
              >
                {hasMathSyntax(
                  option.content
                ) ? (
                  <MathContent
                    text={
                      option.content
                    }
                  />
                ) : (
                  highlightText(
                    option.content,
                    searchQuery
                  )
                )}

                {(option.imageId ||
                  option.imageUrl) && (
                  <img
                    src={getAnswerImageUrl(
                      option
                    )}
                    alt={`Ảnh phương án ${option.id}`}
                    className={
                      styles.answerImage
                    }
                    loading="lazy"
                  />
                )}
              </div>

              {isCorrect && (
                <span
                  className={
                    styles.correctLabel
                  }
                >
                  <span
                    aria-hidden="true"
                  >
                    ✓
                  </span>

                  Đáp án đúng
                </span>
              )}
            </div>
          );
        }
      )}
    </div>
  );
}

function TrueFalseAnswer({
  question,
  searchQuery,
}: {
  question: Extract<
    QuestionCardData,
    {
      type:
        "true_false_group";
    }
  >;

  searchQuery?: string;
}) {
  return (
    <div
      className={
        styles.statementTable
      }
    >
      <div
        className={
          styles.statementHeader
        }
      >
        <span>Mệnh đề</span>
        <span>Đáp án</span>
      </div>

      {question.statements.map(
        (statement) => (
          <div
            key={statement.id}
            className={
              styles.statementRow
            }
          >
            <div
              className={
                styles.statementContent
              }
            >
              <span
                className={
                  styles.answerId
                }
              >
                {statement.id}
              </span>

              <div>
                {hasMathSyntax(
                  statement.content
                ) ? (
                  <MathContent
                    text={
                      statement.content
                    }
                  />
                ) : (
                  highlightText(
                    statement.content,
                    searchQuery
                  )
                )}

                {(statement.imageId ||
                  statement.imageUrl) && (
                  <img
                    src={getAnswerImageUrl(
                      statement
                    )}
                    alt={`Ảnh mệnh đề ${statement.id}`}
                    className={
                      styles.answerImage
                    }
                    loading="lazy"
                  />
                )}
              </div>
            </div>

            <Badge
              color={
                statement.correctAnswer
                  ? "success"
                  : "danger"
              }
            >
              {statement.correctAnswer
                ? "Đúng"
                : "Sai"}
            </Badge>
          </div>
        )
      )}
    </div>
  );
}

function ShortAnswer({
  question,
  searchQuery,
}: {
  question: Extract<
    QuestionCardData,
    {
      type: "short_answer";
    }
  >;

  searchQuery?: string;
}) {
  return (
    <div
      className={
        styles.shortAnswer
      }
    >
      <div>
        <p
          className={
            styles.answerHeading
          }
        >
          Đáp án được chấp nhận
        </p>

        <div
          className={
            styles.acceptedAnswers
          }
        >
          {question.acceptedAnswers.map(
            (
              answer,
              index
            ) => (
              <Badge
                key={`${answer}-${index}`}
                color="blue"
              >
                {highlightText(
                  answer,
                  searchQuery
                )}
              </Badge>
            )
          )}
        </div>
      </div>

      <div
        className={
          styles.answerSettings
        }
      >
        <span>
          {question.caseSensitive
            ? "Phân biệt chữ hoa và chữ thường"
            : "Không phân biệt chữ hoa và chữ thường"}
        </span>

        <span>
          {question.trimWhitespace
            ? "Tự loại bỏ khoảng trắng thừa"
            : "Giữ nguyên khoảng trắng"}
        </span>
      </div>

      {question.explanation && (
        <div
          className={
            styles.explanation
          }
        >
          <strong>
            Giải thích:
          </strong>{" "}

          {highlightText(
            question.explanation,
            searchQuery
          )}
        </div>
      )}
    </div>
  );
}

export default function QuestionCard({
  question,
  selected,
  searchQuery,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
}: QuestionCardProps) {
  const handleCardClick =
    () => {
      onSelect(question.id);
    };

  const handleCardKeyDown = (
    event:
      React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    event.preventDefault();

    onSelect(question.id);
  };

  return (
    <Card
      className={[
        styles.card,
        selected
          ? styles.selected
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={
          styles.cardLayout
        }
        role="checkbox"
        tabIndex={0}
        aria-checked={selected}
        aria-label={`Câu hỏi ${question.id}`}
        onClick={handleCardClick}
        onKeyDown={
          handleCardKeyDown
        }
      >
        <div
          className={
            styles.selection
          }
        >
          <label
            className={
              styles.checkboxLabel
            }
            onClick={
              stopPropagation
            }
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() =>
                onSelect(
                  question.id
                )
              }
              aria-label={`Chọn câu hỏi ${question.id}`}
            />

            <span
              className={
                styles.customCheckbox
              }
              aria-hidden="true"
            >
              ✓
            </span>
          </label>
        </div>

        <div
          className={
            styles.cardContent
          }
        >
          <header
            className={
              styles.header
            }
          >
            <div
              className={
                styles.headerMain
              }
            >
              <span
                className={
                  styles.typeIcon
                }
                aria-hidden="true"
              >
                {
                  questionTypeIcons[
                    question.type
                  ]
                }
              </span>

              <div
                className={
                  styles.badges
                }
              >
                <Badge color="gray">
                  {highlightText(
                    question.id,
                    searchQuery
                  )}
                </Badge>

                <Badge color="primary">
                  {
                    questionTypeLabels[
                      question.type
                    ]
                  }
                </Badge>

                <QuestionMetadataBadges
                  difficulty={
                    question.difficulty
                  }
                  cognitiveLevel={
                    question.cognitiveLevel
                  }
                />
              </div>
            </div>

            <span
              className={
                styles.updatedAt
              }
              title={new Date(
                question.updatedAt
              ).toLocaleString(
                "vi-VN"
              )}
            >
              Cập nhật{" "}
              {formatUpdatedAt(
                question.updatedAt
              )}
            </span>
          </header>

          {question.contentBlocks
            ?.length ||
          hasMathSyntax(
            question.content
          ) ? (
            <QuestionContentBlocks
              content={
                question.content
              }
              blocks={
                question.contentBlocks
              }
              questionImageId={
                question.questionImageId
              }
              questionImageUrl={
                question.questionImageUrl
              }
              className={
                styles.questionRichContent
              }
            />
          ) : (
            <>
              <h3
                className={
                  styles.questionContent
                }
              >
                {highlightText(
                  question.content,
                  searchQuery
                )}
              </h3>

              <QuestionImage
                question={question}
              />
            </>
          )}

          <div
            className={
              styles.classification
            }
          >
            <span
              className={
                styles.classificationItem
              }
            >
              <span
                className={
                  styles.classificationLabel
                }
              >
                Môn học
              </span>

              <strong>
                {highlightText(
                  question.subject,
                  searchQuery
                )}
              </strong>
            </span>

            <span
              className={
                styles.classificationItem
              }
            >
              <span
                className={
                  styles.classificationLabel
                }
              >
                Khối
              </span>

              <strong>
                {highlightText(
                  question.grade,
                  searchQuery
                )}
              </strong>
            </span>

            {question.topic && (
              <span
                className={
                  styles.classificationItem
                }
              >
                <span
                  className={
                    styles.classificationLabel
                  }
                >
                  Chủ đề
                </span>

                <strong>
                  {highlightText(
                    question.topic,
                    searchQuery
                  )}
                </strong>
              </span>
            )}
          </div>

          <section
            className={
              styles.answerSection
            }
            aria-label="Đáp án câu hỏi"
          >
            {question.type ===
              "single_choice" && (
              <SingleChoiceAnswer
                question={question}
                searchQuery={
                  searchQuery
                }
              />
            )}

            {question.type ===
              "true_false_group" && (
              <TrueFalseAnswer
                question={question}
                searchQuery={
                  searchQuery
                }
              />
            )}

            {question.type ===
              "short_answer" && (
              <ShortAnswer
                question={question}
                searchQuery={
                  searchQuery
                }
              />
            )}
          </section>

          {question.tags &&
            question.tags.length >
              0 && (
              <div
                className={
                  styles.tags
                }
                aria-label="Thẻ câu hỏi"
              >
                {question.tags.map(
                  (
                    tag,
                    index
                  ) => (
                    <Badge
                      key={`${tag}-${index}`}
                      color="gray"
                    >
                      #
                      {highlightText(
                        tag,
                        searchQuery
                      )}
                    </Badge>
                  )
                )}
              </div>
            )}

          <footer
            className={
              styles.footer
            }
            onClick={
              stopPropagation
            }
          >
            <span
              className={
                styles.selectionStatus
              }
            >
              {selected
                ? "Câu hỏi đã được chọn"
                : "Bấm vào thẻ để chọn"}
            </span>

            <div
              className={
                styles.actions
              }
            >
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onEdit(
                    question.id
                  )
                }
              >
                Chỉnh sửa
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void onDuplicate(
                    question.id
                  );
                }}
              >
                Nhân bản
              </Button>

              <Button
                type="button"
                variant="danger"
                onClick={() =>
                  onDelete(
                    question.id
                  )
                }
              >
                Xóa
              </Button>
            </div>
          </footer>
        </div>
      </div>
    </Card>
  );
}
