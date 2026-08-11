"use client";

import type {
  ReactNode,
} from "react";

import {
  usePathname,
} from "next/navigation";

import TeacherSidebar from "./TeacherSidebar";

import useCurrentTeacher from "../hooks/useCurrentTeacher";

import styles from "./TeacherArea.module.css";

type TeacherAreaProps = {
  children: ReactNode;
};

const REGISTER_PATH =
  "/teacher/register";

export default function TeacherArea({
  children,
}: TeacherAreaProps) {
  const pathname =
    usePathname();

  const {
    status,
  } =
    useCurrentTeacher();

  if (
    pathname ===
    REGISTER_PATH
  ) {
    return (
      <div
        className={
          styles.registrationArea
        }
      >
        {children}
      </div>
    );
  }

  if (
    status ===
      "loading" ||
    status ===
      "unauthenticated" ||
    status ===
      "needs_registration"
  ) {
    return (
      <main
        className={
          styles.loadingPage
        }
      >
        <section
          className={
            styles.loadingCard
          }
        >
          <div
            className={
              styles.logo
            }
          >
            K
          </div>

          <h1>
            Đang kiểm tra tài khoản
          </h1>

          <p>
            Vui lòng chờ trong giây lát.
          </p>
        </section>
      </main>
    );
  }

  if (
    status ===
    "error"
  ) {
    return (
      <main
        className={
          styles.loadingPage
        }
      >
        <section
          className={
            styles.loadingCard
          }
        >
          <h1>
            Không thể truy cập
          </h1>

          <p>
            Đang chuyển về trang đăng nhập.
          </p>
        </section>
      </main>
    );
  }

  return (
    <TeacherSidebar>
      {children}
    </TeacherSidebar>
  );
}