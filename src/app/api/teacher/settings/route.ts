import {
  NextResponse,
} from "next/server";

import {
  getAdminDb,
} from "@/lib/firebase/admin";

import {
  getCurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  getApiErrorResponse,
} from "@/server/http/apiError";

import {
  DEFAULT_TEACHER_SETTINGS,
} from "@/features/teacher-settings/constants";

import {
  normalizeSubjectName,
} from "@/lib/subjects";

import type {
  DefaultCognitiveLevel,
  DefaultDifficulty,
  DefaultQuestionType,
  TeacherSettings,
  TeacherTheme,
} from "@/features/teacher-settings/types";

export const runtime =
  "nodejs";

function safeString(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

function normalizeBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  return fallback;
}

function normalizeTheme(
  value: unknown
): TeacherTheme {
  if (
    value === "light" ||
    value === "dark" ||
    value === "system"
  ) {
    return value;
  }

  return DEFAULT_TEACHER_SETTINGS.theme;
}

function normalizeSubject(
  value: unknown
): string {
  const subject =
    normalizeSubjectName(
      safeString(value).slice(0, 60)
    );

  return (
    subject ||
    DEFAULT_TEACHER_SETTINGS
      .defaultSubject
  );
}

function normalizeQuestionType(
  value: unknown
): DefaultQuestionType {
  if (
    value ===
      "single_choice" ||
    value ===
      "true_false_group" ||
    value ===
      "short_answer"
  ) {
    return value;
  }

  return DEFAULT_TEACHER_SETTINGS
    .defaultQuestionType;
}

function normalizeCognitiveLevel(
  value: unknown
): DefaultCognitiveLevel {
  if (
    value ===
      "recognition" ||
    value ===
      "understanding" ||
    value ===
      "application" ||
    value ===
      "high_application"
  ) {
    return value;
  }

  return DEFAULT_TEACHER_SETTINGS
    .defaultCognitiveLevel;
}

function normalizeDifficulty(
  value: unknown
): DefaultDifficulty {
  if (
    value === "easy" ||
    value === "medium" ||
    value === "hard"
  ) {
    return value;
  }

  return DEFAULT_TEACHER_SETTINGS
    .defaultDifficulty;
}

function normalizeSettings(
  value: unknown
): TeacherSettings {
  const settings =
    typeof value === "object" &&
    value !== null
      ? (value as Record<
          string,
          unknown
        >)
      : {};

  return {
    theme:
      normalizeTheme(
        settings.theme
      ),

    sidebarCollapsed:
      normalizeBoolean(
        settings.sidebarCollapsed,
        DEFAULT_TEACHER_SETTINGS
          .sidebarCollapsed
      ),

    defaultSubject:
      normalizeSubject(
        settings.defaultSubject
      ),

    defaultQuestionType:
      normalizeQuestionType(
        settings.defaultQuestionType
      ),

    defaultCognitiveLevel:
      normalizeCognitiveLevel(
        settings.defaultCognitiveLevel
      ),

    defaultDifficulty:
      normalizeDifficulty(
        settings.defaultDifficulty
      ),

    autosaveEnabled:
      normalizeBoolean(
        settings.autosaveEnabled,
        DEFAULT_TEACHER_SETTINGS
          .autosaveEnabled
      ),

    confirmBeforeDelete:
      normalizeBoolean(
        settings.confirmBeforeDelete,
        DEFAULT_TEACHER_SETTINGS
          .confirmBeforeDelete
      ),

    updatedAt:
      safeString(
        settings.updatedAt
      ),
  };
}

export async function GET(
  request: Request
) {
  try {
    const user =
      await getCurrentTeacher(
        request
      );

    const teacherDoc =
      await getAdminDb()
        .collection(
          "teachers"
        )
        .doc(user.email)
        .get();

    const teacher =
      teacherDoc.data() || {};

    const settings =
      normalizeSettings(
        teacher.settings
      );

    return NextResponse.json({
      status: "success",
      settings,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "GET /api/teacher/settings error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không tải được cài đặt giáo viên."
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const user =
      await getCurrentTeacher(
        request
      );

    const teacherRef =
      getAdminDb()
        .collection(
          "teachers"
        )
        .doc(user.email);

    const body =
      await request.json();

    const now =
      new Date().toISOString();

    const settings =
      normalizeSettings({
        ...body,
        updatedAt: now,
      });

    await teacherRef.update({
      settings,

      updatedAt: now,
    });

    return NextResponse.json({
      status: "success",
      settings,
      message:
        "Đã lưu cài đặt giáo viên.",
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "PATCH /api/teacher/settings error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không lưu được cài đặt giáo viên."
    );
  }
}
