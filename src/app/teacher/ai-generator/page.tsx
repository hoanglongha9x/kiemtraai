"use client";

import {
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";

import MathContent from "@/components/common/MathContent";
import {
  Button,
  PageHeader,
} from "@/components/ui";
import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";
import type {
  CreateQuestionInput,
} from "@/features/question-bank/repositories";
import {
  questionRepository,
} from "@/features/question-bank/repositories";
import {
  auth,
} from "@/lib/firebase/client";

import styles from "./page.module.css";

type AiGeneratorResponse = {
  status: "success";
  questions: CreateQuestionInput[];
  model: string;
};

type QuestionType =
  CreateQuestionInput["type"];

type Difficulty =
  CreateQuestionInput["difficulty"];

type CognitiveLevel =
  CreateQuestionInput["cognitiveLevel"];

type SubjectOption =
  (typeof TEACHER_SUBJECTS)[number];

const OTHER_SUBJECT =
  "Khác" satisfies SubjectOption;

const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionType;
  label: string;
}> = [
  {
    value: "single_choice",
    label: "Trắc nghiệm A-D",
  },
  {
    value: "true_false_group",
    label: "Đúng / Sai theo nhóm",
  },
  {
    value: "short_answer",
    label: "Trả lời ngắn",
  },
];

const DIFFICULTY_OPTIONS: Array<{
  value: Difficulty;
  label: string;
}> = [
  {
    value: "easy",
    label: "Dễ",
  },
  {
    value: "medium",
    label: "Trung bình",
  },
  {
    value: "hard",
    label: "Khó",
  },
];

const COGNITIVE_LEVEL_OPTIONS: Array<{
  value: CognitiveLevel;
  label: string;
}> = [
  {
    value: "recognition",
    label: "Nhận biết",
  },
  {
    value: "understanding",
    label: "Thông hiểu",
  },
  {
    value: "application",
    label: "Vận dụng",
  },
  {
    value: "high_application",
    label: "Vận dụng cao",
  },
];

function getTypeLabel(
  type: QuestionType
): string {
  return (
    QUESTION_TYPE_OPTIONS.find(
      (option) =>
        option.value === type
    )?.label ?? type
  );
}

function getDifficultyLabel(
  difficulty: Difficulty
): string {
  return (
    DIFFICULTY_OPTIONS.find(
      (option) =>
        option.value === difficulty
    )?.label ?? difficulty
  );
}

function getCognitiveLevelLabel(
  cognitiveLevel: CognitiveLevel
): string {
  return (
    COGNITIVE_LEVEL_OPTIONS.find(
      (option) =>
        option.value === cognitiveLevel
    )?.label ?? cognitiveLevel
  );
}

async function generateQuestions(
  payload: {
    subject: string;
    grade: string;
    topic: string;
    questionType: QuestionType;
    difficulty: Difficulty;
    cognitiveLevel: CognitiveLevel;
    count: number;
    requirements: string;
  }
): Promise<AiGeneratorResponse> {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Bạn cần đăng nhập để tạo câu hỏi bằng AI."
    );
  }

  const token =
    await currentUser.getIdToken();

  const response = await fetch(
    "/api/teacher/ai-generator",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Authorization:
          `Bearer ${token}`,
      },
      body: JSON.stringify(
        payload
      ),
    }
  );

  const data =
    (await response.json()) as
      | AiGeneratorResponse
      | {
          status: "error";
          message?: string;
        };

  if (!response.ok) {
    throw new Error(
      "message" in data
        ? data.message ||
            "Không tạo được câu hỏi bằng AI."
        : "Không tạo được câu hỏi bằng AI."
    );
  }

  if (data.status === "error") {
    throw new Error(
      data.message ||
        "Không tạo được câu hỏi bằng AI."
    );
  }

  return data;
}

export default function AiGeneratorPage() {
  const [subjectOption, setSubjectOption] =
    useState<SubjectOption>("Toán");
  const [customSubject, setCustomSubject] =
    useState("");
  const [grade, setGrade] =
    useState("10");
  const [topic, setTopic] =
    useState("");
  const [questionType, setQuestionType] =
    useState<QuestionType>(
      "single_choice"
    );
  const [difficulty, setDifficulty] =
    useState<Difficulty>(
      "medium"
    );
  const [cognitiveLevel, setCognitiveLevel] =
    useState<CognitiveLevel>(
      "understanding"
    );
  const [count, setCount] =
    useState(5);
  const [requirements, setRequirements] =
    useState("");
  const [questions, setQuestions] =
    useState<CreateQuestionInput[]>([]);
  const [model, setModel] =
    useState("");
  const [generating, setGenerating] =
    useState(false);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [messageType, setMessageType] =
    useState<
      "success" | "error" | ""
    >("");

  const subject =
    subjectOption === OTHER_SUBJECT
      ? customSubject.trim()
      : subjectOption;

  const summary =
    useMemo(
      () =>
        questions.length > 0
          ? `${questions.length} câu hỏi nháp${
              model ? ` · ${model}` : ""
            }`
          : "Chưa có câu hỏi nháp",
      [questions.length, model]
    );

  async function handleGenerate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setGenerating(true);
      setMessage("");
      setMessageType("");

      const result =
        await generateQuestions({
          subject,
          grade,
          topic,
          questionType,
          difficulty,
          cognitiveLevel,
          count,
          requirements,
        });

      setQuestions(
        result.questions
      );
      setModel(result.model);
      setMessage(
        `Đã tạo ${result.questions.length} câu hỏi nháp.`
      );
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tạo được câu hỏi bằng AI."
      );
      setMessageType("error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (questions.length === 0) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      await questionRepository.createMany(
        questions
      );

      setMessage(
        `Đã lưu ${questions.length} câu hỏi vào ngân hàng câu hỏi.`
      );
      setMessageType("success");
      setQuestions([]);
      setModel("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không lưu được câu hỏi."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="TRÍ TUỆ NHÂN TẠO"
        title="AI tạo câu hỏi"
        description="Tạo câu hỏi theo môn, khối, chủ đề, mức độ nhận thức rồi duyệt trước khi lưu vào ngân hàng câu hỏi."
        actions={
          <div className={styles.headerBadge}>
            <Sparkles size={16} />
            {summary}
          </div>
        }
      />

      {message && (
        <div
          className={
            messageType === "error"
              ? styles.error
              : styles.success
          }
        >
          {message}
        </div>
      )}

      <section className={styles.grid}>
        <form
          className={styles.panel}
          onSubmit={handleGenerate}
        >
          <div className={styles.panelHeader}>
            <div>
              <h2>Thiết lập tạo câu hỏi</h2>
              <p>
                Mô tả càng rõ, AI càng tạo câu hỏi gần đúng ý giáo viên.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label>
              <span>Môn học</span>
              <select
                value={subjectOption}
                onChange={(event) => {
                  const value =
                    event.target
                      .value as SubjectOption;

                  setSubjectOption(value);

                  if (value !== OTHER_SUBJECT) {
                    setCustomSubject("");
                  }
                }}
                required
              >
                {TEACHER_SUBJECTS.map(
                  (option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  )
                )}
              </select>
            </label>

            {subjectOption ===
              OTHER_SUBJECT && (
              <label>
                <span>Tên môn học</span>
                <input
                  value={customSubject}
                  onChange={(event) =>
                    setCustomSubject(
                      event.target.value
                    )
                  }
                  placeholder="Nhập tên môn học"
                  required
                />
              </label>
            )}

            <label>
              <span>Khối lớp</span>
              <input
                value={grade}
                onChange={(event) =>
                  setGrade(
                    event.target.value
                  )
                }
                placeholder="10, 11, 12..."
                required
              />
            </label>

            <label className={styles.fullWidth}>
              <span>Chủ đề</span>
              <input
                value={topic}
                onChange={(event) =>
                  setTopic(
                    event.target.value
                  )
                }
                placeholder="Ví dụ: phương trình bậc hai, phản ứng oxi hóa khử..."
              />
            </label>

            <label>
              <span>Loại câu hỏi</span>
              <select
                value={questionType}
                onChange={(event) =>
                  setQuestionType(
                    event.target
                      .value as QuestionType
                  )
                }
              >
                {QUESTION_TYPE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>Số lượng</span>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(event) =>
                  setCount(
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </label>

            <label>
              <span>Độ khó</span>
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(
                    event.target
                      .value as Difficulty
                  )
                }
              >
                {DIFFICULTY_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>Mức độ nhận thức</span>
              <select
                value={cognitiveLevel}
                onChange={(event) =>
                  setCognitiveLevel(
                    event.target
                      .value as CognitiveLevel
                  )
                }
              >
                {COGNITIVE_LEVEL_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className={styles.fullWidth}>
              <span>Yêu cầu thêm</span>
              <textarea
                value={requirements}
                onChange={(event) =>
                  setRequirements(
                    event.target.value
                  )
                }
                rows={6}
                placeholder="Ví dụ: có 2 câu chứa công thức LaTeX, tránh mẹo quá đánh đố, bám sát chương trình FPT School..."
              />
            </label>
          </div>

          <Button
            type="submit"
            disabled={generating || saving}
            leftIcon={
              generating ? (
                <Loader2
                  size={16}
                  className={styles.spin}
                />
              ) : (
                <Sparkles size={16} />
              )
            }
            fullWidth
          >
            {generating
              ? "Đang tạo câu hỏi"
              : "Tạo câu hỏi nháp"}
          </Button>
        </form>

        <section className={styles.previewPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Bản nháp AI</h2>
              <p>
                Kiểm tra nội dung trước khi đưa vào ngân hàng câu hỏi.
              </p>
            </div>

            <Button
              variant="success"
              disabled={
                saving ||
                generating ||
                questions.length === 0
              }
              leftIcon={
                saving ? (
                  <Loader2
                    size={16}
                    className={styles.spin}
                  />
                ) : (
                  <Save size={16} />
                )
              }
              onClick={() => {
                void handleSave();
              }}
            >
              Lưu vào bank
            </Button>
          </div>

          {questions.length === 0 ? (
            <div className={styles.emptyPreview}>
              <Sparkles size={28} />
              <h3>Chưa có câu hỏi nháp</h3>
              <p>
                Nhập cấu hình bên trái rồi bấm tạo. Câu hỏi sinh ra sẽ hiện ở đây để duyệt.
              </p>
            </div>
          ) : (
            <div className={styles.questionList}>
              {questions.map(
                (question, index) => (
                  <article
                    key={`${question.type}-${index}`}
                    className={styles.questionCard}
                  >
                    <div className={styles.questionTop}>
                      <span>
                        Câu {index + 1}
                      </span>
                      <div className={styles.badges}>
                        <em>
                          {getTypeLabel(
                            question.type
                          )}
                        </em>
                        <em>
                          {getDifficultyLabel(
                            question.difficulty
                          )}
                        </em>
                        <em>
                          {getCognitiveLevelLabel(
                            question.cognitiveLevel
                          )}
                        </em>
                      </div>
                    </div>

                    <MathContent
                      className={styles.questionContent}
                      text={question.content}
                    />

                    {question.type ===
                      "single_choice" && (
                      <div className={styles.options}>
                        {question.options.map(
                          (option) => (
                            <div
                              key={option.id}
                              className={
                                option.id ===
                                question.correctOptionId
                                  ? styles.correctOption
                                  : styles.option
                              }
                            >
                              <strong>{option.id}</strong>
                              <MathContent
                                text={option.content}
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {question.type ===
                      "true_false_group" && (
                      <div className={styles.options}>
                        {question.statements.map(
                          (statement) => (
                            <div
                              key={statement.id}
                              className={
                                statement.correctAnswer
                                  ? styles.correctOption
                                  : styles.option
                              }
                            >
                              <strong>
                                {statement.id}
                              </strong>
                              <MathContent
                                text={statement.content}
                              />
                              <span className={styles.answerMark}>
                                {statement.correctAnswer
                                  ? "Đúng"
                                  : "Sai"}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {question.type ===
                      "short_answer" && (
                      <div className={styles.shortAnswer}>
                        <strong>Đáp án</strong>
                        <span>
                          {question.acceptedAnswers.join(
                            "; "
                          )}
                        </span>
                        {question.explanation && (
                          <MathContent
                            text={
                              question.explanation
                            }
                          />
                        )}
                      </div>
                    )}

                    <div className={styles.cardFooter}>
                      <span>
                        {question.subject} · Khối {question.grade}
                        {question.topic
                          ? ` · ${question.topic}`
                          : ""}
                      </span>
                      <Check size={15} />
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
