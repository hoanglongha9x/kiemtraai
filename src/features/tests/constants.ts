import type {
  TestSectionPreset,
  TestSettings,
  TestVisibility,
} from "./types";

export const DEFAULT_TEST_DURATION_MINUTES =
  45;

export const DEFAULT_TEST_TOTAL_SCORE =
  10;

export const DEFAULT_TEST_VISIBILITY:
  TestVisibility =
    "private";

export const DEFAULT_TEST_SETTINGS:
  TestSettings = {
    shuffleQuestions:
      false,

    shuffleOptions:
      false,

    allowBackNavigation:
      true,

    showQuestionNumbers:
      true,

    showProgress:
      true,

    autosaveAnswers:
      true,
  };

export const TEST_SECTION_PRESETS:
  TestSectionPreset[] = [
    {
      type:
        "single_choice",

      title:
        "Phần 1. Trắc nghiệm nhiều lựa chọn",

      description:
        "Chọn một đáp án đúng cho mỗi câu hỏi.",

      scorePerQuestion:
        0.25,
    },

    {
      type:
        "true_false_group",

      title:
        "Phần 2. Trắc nghiệm đúng/sai",

      description:
        "Chọn đúng hoặc sai cho từng mệnh đề.",

      scorePerQuestion:
        1,
    },

    {
      type:
        "short_answer",

      title:
        "Phần 3. Trả lời ngắn",

      description:
        "Nhập câu trả lời ngắn theo yêu cầu của câu hỏi.",

      scorePerQuestion:
        0.5,
    },
  ];

export const TEST_STATUS_LABELS = {
  draft:
    "Bản nháp",

  published:
    "Đã xuất bản",

  archived:
    "Đã lưu trữ",

  deleted:
    "Đã xóa",
} as const;

export const TEST_VISIBILITY_LABELS = {
  private:
    "Riêng tư",

  school:
    "Trong trường",

  public:
    "Công khai",
} as const;

export const TEST_TYPE_LABELS = {
  single_choice:
    "Trắc nghiệm",

  true_false_group:
    "Nhóm đúng/sai",

  short_answer:
    "Trả lời ngắn",
} as const;

export const TEST_MIN_DURATION_MINUTES =
  1;

export const TEST_MAX_DURATION_MINUTES =
  600;

export const TEST_MIN_QUESTION_SCORE =
  0.01;

export const TEST_MAX_QUESTION_SCORE =
  100;

export const TEST_TITLE_MAX_LENGTH =
  200;

export const TEST_DESCRIPTION_MAX_LENGTH =
  2000;

export const TEST_INSTRUCTIONS_MAX_LENGTH =
  5000;