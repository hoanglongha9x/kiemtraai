import type {
  TeacherTheme,
} from "../types";

const THEME_STORAGE_KEY =
  "kiemtra-ai-theme";

export function applyTeacherTheme(
  theme: TeacherTheme
) {
  const root =
    document.documentElement;

  root.dataset.theme =
    theme;

  try {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      theme
    );
  } catch {
    // Không chặn giao diện nếu
    // localStorage không khả dụng.
  }
}