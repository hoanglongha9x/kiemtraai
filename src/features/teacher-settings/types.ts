export type TeacherTheme =
  | "system"
  | "light"
  | "dark";

export type DefaultQuestionType =
  | "single_choice"
  | "true_false_group"
  | "short_answer";

export type DefaultCognitiveLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

export type DefaultDifficulty =
  | "easy"
  | "medium"
  | "hard";

export type TeacherSettings = {
  theme: TeacherTheme;

  sidebarCollapsed:
    boolean;

  defaultSubject:
    string;

  defaultQuestionType:
    DefaultQuestionType;

  defaultCognitiveLevel:
    DefaultCognitiveLevel;

  defaultDifficulty:
    DefaultDifficulty;

  autosaveEnabled:
    boolean;

  confirmBeforeDelete:
    boolean;

  updatedAt?: string;
};

export type TeacherSettingsSuccessResponse = {
  status: "success";
  settings:
    TeacherSettings;
  message?: string;
};

export type TeacherSettingsErrorResponse = {
  status: "error";
  message: string;
};

export type TeacherSettingsResponse =
  | TeacherSettingsSuccessResponse
  | TeacherSettingsErrorResponse;