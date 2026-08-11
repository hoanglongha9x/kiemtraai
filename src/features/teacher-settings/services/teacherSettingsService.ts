import {
  auth,
} from "@/lib/firebase/client";

import type {
  TeacherSettings,
  TeacherSettingsResponse,
} from "../types";

async function parseResponse(
  response: Response
): Promise<TeacherSettingsResponse> {
  const text =
    await response.text();

  try {
    return text
      ? JSON.parse(text)
      : {
          status: "error",
          message:
            "API không trả về dữ liệu.",
        };
  } catch {
    return {
      status: "error",
      message:
        "API không trả về JSON hợp lệ.",
    };
  }
}

async function getToken(): Promise<string> {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Phiên đăng nhập đã hết hạn."
    );
  }

  return currentUser.getIdToken();
}

export async function getTeacherSettings(): Promise<TeacherSettings> {
  const token =
    await getToken();

  const response =
    await fetch(
      "/api/teacher/settings",
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        cache: "no-store",
      }
    );

  const data =
    await parseResponse(
      response
    );

  if (
    !response.ok ||
    data.status ===
      "error"
  ) {
    throw new Error(
      data.status ===
        "error"
        ? data.message
        : "Không tải được cài đặt."
    );
  }

  return data.settings;
}

export async function updateTeacherSettings(
  settings: TeacherSettings
): Promise<TeacherSettingsResponse> {
  const token =
    await getToken();

  const response =
    await fetch(
      "/api/teacher/settings",
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify(
            settings
          ),
      }
    );

  const data =
    await parseResponse(
      response
    );

  if (
    !response.ok ||
    data.status ===
      "error"
  ) {
    throw new Error(
      data.status ===
        "error"
        ? data.message
        : "Không lưu được cài đặt."
    );
  }

  return data;
}