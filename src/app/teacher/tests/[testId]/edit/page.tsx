"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  auth,
} from "@/lib/firebase/client";

import {
  TestEditorPage,
} from "@/features/tests";

import styles from "./page.module.css";

type RouteParams = {
  testId?: string | string[];
};

function getTestId(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export default function EditTestRoute() {
  const params =
    useParams<RouteParams>();

  const router =
    useRouter();

  const testId =
    getTestId(
      params.testId
    );

  const [
    user,
    setUser,
  ] = useState<User | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,

        (currentUser) => {
          setUser(
            currentUser
          );

          setLoading(
            false
          );
        },

        (authError) => {
          console.error(
            "Không thể kiểm tra Firebase Auth:",
            authError
          );

          setUser(null);

          setError(
            authError.message ||
            "Không thể kiểm tra trạng thái đăng nhập."
          );

          setLoading(
            false
          );
        }
      );

    return unsubscribe;
  }, []);

  if (!testId) {
    return (
      <main
        className={
          styles.page
        }
      >
        <section
          className={
            styles.stateCard
          }
        >
          <h1>
            Đường dẫn không hợp lệ
          </h1>

          <p>
            Không tìm thấy mã đề kiểm tra.
          </p>

          <button
            type="button"
            className={
              styles.primaryButton
            }
            onClick={() =>
              router.push(
                "/teacher/tests"
              )
            }
          >
            Quay lại danh sách đề
          </button>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main
        className={
          styles.page
        }
      >
        <section
          className={
            styles.stateCard
          }
        >
          <div
            className={
              styles.spinner
            }
          />

          <h1>
            Đang tải trình chỉnh sửa
          </h1>

          <p>
            Vui lòng chờ trong giây lát.
          </p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main
        className={
          styles.page
        }
      >
        <section
          className={
            styles.stateCard
          }
        >
          <h1>
            Không thể xác thực
          </h1>

          <p
            className={
              styles.errorText
            }
          >
            {error}
          </p>

          <button
            type="button"
            className={
              styles.primaryButton
            }
            onClick={() =>
              window.location.reload()
            }
          >
            Thử lại
          </button>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        className={
          styles.page
        }
      >
        <section
          className={
            styles.stateCard
          }
        >
          <h1>
            Bạn chưa đăng nhập
          </h1>

          <p>
            Vui lòng đăng nhập bằng tài khoản giáo viên.
          </p>

          <button
            type="button"
            className={
              styles.primaryButton
            }
            onClick={() =>
              router.push(
                "/login"
              )
            }
          >
            Đăng nhập
          </button>
        </section>
      </main>
    );
  }

  return (
    <TestEditorPage
      testId={
        testId
      }
      ownerUid={
        user.uid
      }
    />
  );
}