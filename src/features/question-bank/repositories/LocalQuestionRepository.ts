import type {
  QuestionCardData,
} from "@/components/question-bank";

import {
  initialQuestions,
} from "../data/initialQuestions";

import {
  assertValidQuestionInput,
} from "../lib/validateQuestionInput";

import type {
  CreateQuestionInput,
} from "./QuestionRepository";

const STORAGE_KEY =
  "kiemtra-ai-question-bank-v1";

function cloneQuestion(
  question: QuestionCardData
): QuestionCardData {
  if (
    question.type ===
    "single_choice"
  ) {
    return {
      ...question,
      options: question.options.map(
        (option) => ({
          ...option,
        })
      ),
      tags: question.tags
        ? [...question.tags]
        : undefined,
    };
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    return {
      ...question,
      statements:
        question.statements.map(
          (statement) => ({
            ...statement,
          })
        ),
      tags: question.tags
        ? [...question.tags]
        : undefined,
    };
  }

  return {
    ...question,
    acceptedAnswers: [
      ...question.acceptedAnswers,
    ],
    tags: question.tags
      ? [...question.tags]
      : undefined,
  };
}

function cloneQuestions(
  questions: QuestionCardData[]
): QuestionCardData[] {
  return questions.map(cloneQuestion);
}

function generateQuestionId(
  questions: QuestionCardData[]
): string {
  const highestNumber =
    questions.reduce(
      (highest, question) => {
        const numericPart = Number(
          question.id.replace(
            /\D/g,
            ""
          )
        );

        if (
          Number.isNaN(
            numericPart
          )
        ) {
          return highest;
        }

        return Math.max(
          highest,
          numericPart
        );
      },
      0
    );

  return `Q-${String(
    highestNumber + 1
  ).padStart(4, "0")}`;
}

function isBrowser(): boolean {
  return (
    typeof window !== "undefined"
  );
}

function isQuestionArray(
  value: unknown
): value is QuestionCardData[] {
  return Array.isArray(value);
}

export class LocalQuestionRepository
 
{
  private questions:
    QuestionCardData[] = [];

  private initialized = false;

  private initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (!isBrowser()) {
      this.questions =
        cloneQuestions(
          initialQuestions
        );

      return;
    }

    try {
      const storedValue =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (!storedValue) {
        this.questions =
          cloneQuestions(
            initialQuestions
          );

        this.persist();
        return;
      }

      const parsedValue: unknown =
        JSON.parse(storedValue);

      if (
        !isQuestionArray(
          parsedValue
        )
      ) {
        throw new Error(
          "Dữ liệu Question Bank không hợp lệ."
        );
      }

      this.questions =
        cloneQuestions(
          parsedValue
        );
    } catch (error) {
      console.error(
        "Không thể đọc Question Bank từ localStorage:",
        error
      );

      this.questions =
        cloneQuestions(
          initialQuestions
        );

      this.persist();
    }
  }

  private persist(): void {
    if (!isBrowser()) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        this.questions
      )
    );
  }

  async getAll(): Promise<
    QuestionCardData[]
  > {
    this.initialize();

    return cloneQuestions(
      this.questions
    );
  }

  async create(
    question: CreateQuestionInput
  ): Promise<QuestionCardData> {
    this.initialize();

    assertValidQuestionInput(
  question
);

    const createdQuestion = {
      ...question,
      id: generateQuestionId(
        this.questions
      ),
    } as QuestionCardData;

    const clonedQuestion =
      cloneQuestion(
        createdQuestion
      );

    this.questions = [
      clonedQuestion,
      ...this.questions,
    ];

    this.persist();

    return cloneQuestion(
      clonedQuestion
    );
  }

  async update(
    question: QuestionCardData
  ): Promise<QuestionCardData> {
    this.initialize();

const {

    id: _questionId,

    ...questionInput

  } = question;

  assertValidQuestionInput(

    questionInput

  );

    const existingIndex =
      this.questions.findIndex(
        (item) =>
          item.id === question.id
      );

    if (existingIndex === -1) {
      throw new Error(
        "Không tìm thấy câu hỏi cần cập nhật."
      );
    }

    const updatedQuestion =
      cloneQuestion(question);

    const nextQuestions = [
      ...this.questions,
    ];

    nextQuestions[
      existingIndex
    ] = updatedQuestion;

    this.questions =
      nextQuestions;

    this.persist();

    return cloneQuestion(
      updatedQuestion
    );
  }

  async duplicate(
    questionId: string
  ): Promise<QuestionCardData> {
    this.initialize();

    const sourceIndex =
      this.questions.findIndex(
        (question) =>
          question.id ===
          questionId
      );

    if (sourceIndex === -1) {
      throw new Error(
        "Không tìm thấy câu hỏi cần nhân bản."
      );
    }

    const sourceQuestion =
      this.questions[
        sourceIndex
      ];

    const duplicatedQuestion =
      cloneQuestion({
        ...sourceQuestion,
        id: generateQuestionId(
          this.questions
        ),
        content:
          `${sourceQuestion.content} (Bản sao)`,
        updatedAt:
          "Vừa xong",
      } as QuestionCardData);

    const nextQuestions = [
      ...this.questions,
    ];

    nextQuestions.splice(
      sourceIndex + 1,
      0,
      duplicatedQuestion
    );

    this.questions =
      nextQuestions;

    this.persist();

    return cloneQuestion(
      duplicatedQuestion
    );
  }

  async delete(
    questionId: string
  ): Promise<void> {
    this.initialize();

    const exists =
      this.questions.some(
        (question) =>
          question.id ===
          questionId
      );

    if (!exists) {
      throw new Error(
        "Không tìm thấy câu hỏi cần xóa."
      );
    }

    this.questions =
      this.questions.filter(
        (question) =>
          question.id !==
          questionId
      );

    this.persist();
  }

  async deleteMany(
    questionIds: string[]
  ): Promise<void> {
    this.initialize();

    const idSet = new Set(
      questionIds
    );

    this.questions =
      this.questions.filter(
        (question) =>
          !idSet.has(
            question.id
          )
      );

    this.persist();
  }

  async reset(): Promise<
    QuestionCardData[]
  > {
    this.questions =
      cloneQuestions(
        initialQuestions
      );

    this.initialized = true;

    this.persist();

    return cloneQuestions(
      this.questions
    );
  }
}