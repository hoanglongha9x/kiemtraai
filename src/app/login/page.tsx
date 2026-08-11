"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import AuthMark from "@/components/auth/AuthMark";
import AnimatedLoginScene from "@/components/auth/AnimatedLoginScene";
import {
  getTeacherMe,
} from "@/features/auth/services/teacherAuthService";
import { auth } from "@/lib/firebase/client";

export default function LoginPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const queryMessage =
      new URLSearchParams(
        window.location.search
      ).get("message");

    if (queryMessage) {
      setMessage(queryMessage);
    }

    const checkingTimeout = window.setTimeout(() => {
      if (!active) {
        return;
      }

      setMessage(
        "Không hoàn tất kiểm tra phiên đăng nhập. Hãy tải lại trang hoặc đăng nhập lại."
      );
      setChecking(false);
    }, 10000);

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) {
        return;
      }

      if (!queryMessage) {
        setMessage("");
      }

      if (!currentUser) {
        window.clearTimeout(checkingTimeout);
        setChecking(false);
        return;
      }

      try {
        await handleAuthenticatedUser(
          currentUser
        );
      } catch (error: any) {
        console.error("Login auth check error:", error);

        await signOut(auth);

        if (!active) {
          return;
        }

        window.clearTimeout(checkingTimeout);

        setMessage(
          error?.message || "Tài khoản này chưa được phép sử dụng hệ thống."
        );

        setChecking(false);
      }
    });

    async function handleAuthenticatedUser(
      currentUser: User
    ) {
      const me =
        await getTeacherMe(
          currentUser
        );

      if (!active) {
        return;
      }

      window.clearTimeout(
        checkingTimeout
      );

      if (
        me.status ===
        "needs_registration"
      ) {
        setChecking(false);
        router.replace(
          "/teacher/register"
        );
        return;
      }

      if (
        me.status === "success"
      ) {
        setChecking(false);
        router.replace(
          "/teacher/dashboard"
        );
        return;
      }

      await signOut(auth);

      setMessage(
        me.message ||
          "Tài khoản này chưa được phép sử dụng hệ thống."
      );
      setChecking(false);
    }

    return () => {
      active = false;
      window.clearTimeout(checkingTimeout);
      unsub();
    };
  }, [router]);

  async function handleGoogleLogin() {
    setMessage("");

    try {
      setSigningIn(true);

      const provider = new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      await signInWithPopup(auth, provider);

      const me = await getTeacherMe();

      if (me.status === "needs_registration") {
        router.replace("/teacher/register");
        return;
      }

      if (me.status === "success") {
        router.replace("/teacher/dashboard");
        return;
      }

      await signOut(auth);

      setMessage(me.message || "Tài khoản này chưa được phép sử dụng hệ thống.");
    } catch (error: any) {
      console.error("Google login error:", error);

      await signOut(auth);

      setMessage(
        getGoogleLoginErrorMessage(error) ||
          "Không đăng nhập được. Vui lòng kiểm tra tài khoản Google."
      );
    } finally {
      setSigningIn(false);
    }
  }

  if (checking) {
    return (
      <AnimatedLoginScene>
        <AuthMark size="large" />

        <h1 style={titleStyle}>Đang kiểm tra tài khoản...</h1>

        <p style={descStyle}>Vui lòng chờ trong giây lát.</p>
      </AnimatedLoginScene>
    );
  }

  return (
    <AnimatedLoginScene>
      <AuthMark size="large" />

      <div style={kickerStyle}>KIEMTRA.AI</div>

      <h1 style={titleStyle}>Đăng nhập giáo viên</h1>

      <p style={descStyle}>
        Giáo viên sử dụng email Google đã được cấp quyền để đăng nhập hệ thống
        kiểm tra trực tuyến.
      </p>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={signingIn}
        style={{
          ...googleButton,
          opacity: signingIn ? 0.65 : 1,
          cursor: signingIn ? "not-allowed" : "pointer",
        }}
      >
        <span style={googleMark}>G</span>
        {signingIn ? "Đang đăng nhập..." : "Đăng nhập bằng Google"}
      </button>

      {message && <div style={errorBox}>{message}</div>}

      <div style={noteBox}>
        Giáo viên có email <b>@fpt.edu.vn</b> có thể hoàn tất hồ sơ sau khi đăng
        nhập lần đầu. Nếu tài khoản bị khóa, vui lòng liên hệ admin (
        <b>LongHH15@fe.edu.vn</b>).
      </div>
    </AnimatedLoginScene>
  );
}

function getAuthErrorCode(error: unknown): string {
  if (
    typeof error ===
      "object" &&
    error !== null &&
    "code" in error
  ) {
    return String(
      (error as { code?: unknown })
        .code ?? ""
    );
  }

  return "";
}

function getCurrentLoginDomain() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.hostname;
}

function getGoogleLoginErrorMessage(
  error: unknown
) {
  const code =
    getAuthErrorCode(error);

  if (
    code ===
    "auth/unauthorized-domain"
  ) {
    const domain =
      getCurrentLoginDomain();

    return `Domain ${domain || "hiện tại"} chưa được thêm vào Firebase Authentication. Vào Firebase Console > Authentication > Settings > Authorized domains và thêm domain này rồi thử lại.`;
  }

  if (
    code ===
    "auth/popup-blocked"
  ) {
    return "Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép popup cho trang này rồi thử lại.";
  }

  if (
    code ===
    "auth/popup-closed-by-user"
  ) {
    return "Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.";
  }

  if (
    typeof error ===
      "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown })
        .message ?? ""
    );
  }

  return "";
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left,#dbeafe,#eef4ff 42%,#ffffff)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily: "Arial, sans-serif",
  color: "#111827",
};

const loginCard: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  background: "white",
  borderRadius: 28,
  padding: 36,
  boxShadow: "0 24px 70px rgba(15,23,42,.14)",
  textAlign: "center",
  border: "1px solid #e5e7eb",
};

const logoCircle: CSSProperties = {
  width: 76,
  height: 76,
  borderRadius: 24,
  background: "linear-gradient(135deg,#1d4ed8,#4f46e5 48%,#7c3aed)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Georgia, serif",
  fontSize: 34,
  fontStyle: "italic",
  fontWeight: 900,
  margin: "0 auto 18px",
  boxShadow: "0 16px 36px rgba(79,70,229,.34)",
};

const kickerStyle: CSSProperties = {
  color: "#4f46e5",
  fontWeight: 900,
  letterSpacing: 0,
  marginBottom: 10,
  textAlign: "center",
};

const titleStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  margin: "0 0 12px",
  color: "#111827",
  textAlign: "center",
};

const descStyle: CSSProperties = {
  color: "#475569",
  lineHeight: 1.7,
  fontSize: 16,
  margin: "0 0 24px",
  textAlign: "center",
};

const googleButton: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 16,
  background: "linear-gradient(180deg,#93c5fd,#2563eb)",
  color: "white",
  padding: "16px 20px",
  fontSize: 17,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  boxShadow: "0 14px 30px rgba(37,99,235,.32)",
};

const googleMark: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  background: "white",
  color: "#2563eb",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const errorBox: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 800,
  textAlign: "left",
  lineHeight: 1.6,
};

const noteBox: CSSProperties = {
  marginTop: 18,
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#475569",
  lineHeight: 1.6,
  textAlign: "left",
};
