import type {
  TeacherSettings,
} from "./types";

export const TEACHER_SUBJECTS = [
  "Toán",
  "Lý",
  "Hóa",
  "Sinh",
  "Tin học",
  "Văn",
  "Sử",
  "Địa",
  "Tiếng Anh",
  "Khác",
] as const;

export const DEFAULT_TEACHER_SETTINGS:
  TeacherSettings = {
    theme: "system",

    sidebarCollapsed:
      false,

    defaultSubject:
      "Toán",

    defaultQuestionType:
      "single_choice",

    defaultCognitiveLevel:
      "recognition",

    defaultDifficulty:
      "medium",

    autosaveEnabled:
      true,

    confirmBeforeDelete:
      true,
  };
