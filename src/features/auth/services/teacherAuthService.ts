import {
  signOut,
  type User,
} from "firebase/auth";

import {
  auth,
} from "@/lib/firebase/client";

import type {
  TeacherMeResponse,
} from "../types";

function getFallbackMessage(
  status: number
): string {
  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn.";
  }

  if (status === 403) {
    return "Tài khoản không được phép sử dụng hệ thống.";
  }

  return "Không tải được thông tin giáo viên.";
}

function isBlockedFirebaseTokenError(
  error: unknown
): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error ?? "");

  return (
    message.includes(
      "securetoken.googleapis.com"
    ) ||
    message.includes(
      "auth/requests-to-this-api"
    ) ||
    message.includes(
      "requests-to-this-api"
    )
  );
}

export async function getFirebaseIdTokenWithFallback(
  user?: User | null
): Promise<string> {
  const currentUser =
    user ?? auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Bạn chưa đăng nhập."
    );
  }

  const tokenLikeUser =
    currentUser as unknown as {
      accessToken?: unknown;
      stsTokenManager?: {
        accessToken?: unknown;
      };
    };

  const cachedToken =
    tokenLikeUser.accessToken ??
    tokenLikeUser.stsTokenManager
      ?.accessToken;

  if (
    typeof cachedToken ===
      "string" &&
    cachedToken.split(".").length ===
      3
  ) {
    return cachedToken;
  }

  try {
    return await currentUser.getIdToken();
  } catch (error) {
    if (
      isBlockedFirebaseTokenError(
        error
      )
    ) {
      throw new Error(
        "Không lấy được phiên đăng nhập Firebase vì trình duyệt hoặc mạng đang chặn securetoken.googleapis.com. Hãy đăng xuất rồi đăng nhập lại; nếu vẫn lỗi, tắt AdBlock/VPN/chặn tracking cho localhost hoặc cho phép Google Firebase."
      );
    }

    throw error;
  }
}

export async function getTeacherMe(
  user?: User | null
): Promise<TeacherMeResponse> {
  const currentUser =
    user ?? auth.currentUser;

  if (!currentUser) {
    return {
      status: "error",
      message:
        "Bạn chưa đăng nhập.",
    };
  }

  try {
    const token =
      await getFirebaseIdTokenWithFallback(
        currentUser
      );

    const response =
      await fetch(
        "/api/teacher/me",
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          cache: "no-store",
        }
      );

    const text =
      await response.text();

    let data: unknown;

    try {
      data = text
        ? JSON.parse(text)
        : null;
    } catch {
      return {
        status: "error",
        message:
          "API giáo viên không trả về JSON hợp lệ.",
      };
    }

    if (
      typeof data !==
        "object" ||
      data === null
    ) {
      return {
        status: "error",
        message:
          "Dữ liệu giáo viên không hợp lệ.",
      };
    }

    const result =
      data as TeacherMeResponse;

    if (
      !response.ok ||
      result.status ===
        "error"
    ) {
      return {
        status: "error",
        message:
          result.status ===
          "error"
            ? result.message
            : getFallbackMessage(
                response.status
              ),
      };
    }

    if (
      result.status !==
        "success" &&
      result.status !==
        "needs_registration"
    ) {
      return {
        status: "error",
        message:
          "Không xác định được trạng thái tài khoản.",
      };
    }

    return result;
  } catch (error) {
    console.error(
      "getTeacherMe error:",
      error
    );

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Không tải được thông tin giáo viên.",
    };
  }
}

export async function logoutTeacher(): Promise<void> {
  await signOut(auth);
}
