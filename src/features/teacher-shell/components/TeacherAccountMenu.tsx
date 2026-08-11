"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import useCurrentTeacher from "../hooks/useCurrentTeacher";

import styles from "./TeacherAccountMenu.module.css";

type TeacherAccountMenuProps = {
  collapsed?: boolean;
};

function getInitials(
  name: string,
  email: string
): string {
  const cleanName =
    name.trim();

  if (cleanName) {
    const words =
      cleanName
        .split(/\s+/)
        .filter(Boolean);

    if (
      words.length >= 2
    ) {
      return `${words[0][0]}${
        words[
          words.length - 1
        ][0]
      }`.toUpperCase();
    }

    return cleanName
      .slice(0, 2)
      .toUpperCase();
  }

  return email
    .slice(0, 2)
    .toUpperCase();
}

export default function TeacherAccountMenu({
  collapsed = false,
}: TeacherAccountMenuProps) {
  const pathname =
    usePathname();

  const {
    teacher,
    logout,
    loading,
  } =
    useCurrentTeacher();

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const containerRef =
    useRef<HTMLDivElement>(
      null
    );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (
      event: MouseEvent
    ) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  if (
    loading ||
    !teacher
  ) {
    return (
      <div
        className={
          styles.skeleton
        }
        aria-label="Đang tải tài khoản"
      >
        <span />

        {!collapsed && (
          <div>
            <span />
            <span />
          </div>
        )}
      </div>
    );
  }

  const initials =
    getInitials(
      teacher.name,
      teacher.email
    );

  const handleLogout =
    async () => {
      if (loggingOut) {
        return;
      }

      setLoggingOut(true);

      try {
        await logout();
      } finally {
        setLoggingOut(false);
      }
    };

  return (
    <div
      ref={containerRef}
      className={
        styles.container
      }
    >
      {open && (
        <div
          className={
            styles.menu
          }
          role="menu"
        >
          <div
            className={
              styles.menuHeader
            }
          >
            <strong>
              {teacher.name}
            </strong>

            <span>
              {teacher.email}
            </span>

            {teacher.subject && (
              <small>
                Môn:{" "}
                {
                  teacher.subject
                }
              </small>
            )}
          </div>

          <div
            className={
              styles.menuDivider
            }
          />

          <Link
            href="/teacher/profile"
            className={
              styles.menuItem
            }
            role="menuitem"
          >
            <span
              aria-hidden="true"
            >
              ♙
            </span>

            Hồ sơ cá nhân
          </Link>

          <Link
            href="/teacher/settings"
            className={
              styles.menuItem
            }
            role="menuitem"
          >
            <span
              aria-hidden="true"
            >
              ⚙
            </span>

            Cài đặt tài khoản
          </Link>

          {teacher.role ===
            "admin" && (
            <Link
              href="/admin"
              className={
                styles.menuItem
              }
              role="menuitem"
            >
              <span
                aria-hidden="true"
              >
                ◈
              </span>

              Trang quản trị
            </Link>
          )}

          <div
            className={
              styles.menuDivider
            }
          />

          <button
            type="button"
            className={`${styles.menuItem} ${styles.logoutItem}`}
            role="menuitem"
            disabled={
              loggingOut
            }
            onClick={() => {
              void handleLogout();
            }}
          >
            <span
              aria-hidden="true"
            >
              ↪
            </span>

            {loggingOut
              ? "Đang đăng xuất..."
              : "Đăng xuất"}
          </button>
        </div>
      )}

      <button
        type="button"
        className={`${styles.trigger} ${
          collapsed
            ? styles.triggerCollapsed
            : ""
        }`}
        aria-label="Mở menu tài khoản"
        aria-haspopup="menu"
        aria-expanded={
          open
        }
        title={
          collapsed
            ? teacher.name
            : undefined
        }
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
      >
        <span
          className={
            styles.avatar
          }
        >
          {teacher.picture ? (
            <img
              src={
                teacher.picture
              }
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            initials
          )}
        </span>

        {!collapsed && (
          <>
            <span
              className={
                styles.accountText
              }
            >
              <strong>
                {teacher.name}
              </strong>

              <small>
                {teacher.email}
              </small>
            </span>

            <span
              className={
                styles.moreIcon
              }
              aria-hidden="true"
            >
              ⋯
            </span>
          </>
        )}
      </button>
    </div>
  );
}