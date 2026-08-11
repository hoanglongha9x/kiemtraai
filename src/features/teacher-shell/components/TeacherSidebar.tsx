"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import useCurrentTeacher from "../hooks/useCurrentTeacher";

import TeacherAccountMenu from "./TeacherAccountMenu";

import styles from "./TeacherSidebar.module.css";

type TeacherSidebarProps = {
  children: ReactNode;
};

type SidebarIconName =
  | "dashboard"
  | "questions"
  | "tests"
  | "library"
  | "classes"
  | "assignments"
  | "results"
  | "ai"
  | "admin"
  | "settings"
  | "help";

type NavigationItem = {
  label: string;
  href: string;
  icon: SidebarIconName;
  badge?: string;
};

type NavigationGroup = {
  label?: string;
  items: NavigationItem[];
};

const SIDEBAR_STORAGE_KEY =
  "kiemtra-ai-teacher-sidebar-collapsed";

const BASE_NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    items: [
      {
        label: "Tổng quan",
        href: "/teacher/dashboard",
        icon: "dashboard",
      },
    ],
  },
  {
    label: "Nội dung",
    items: [
      {
        label: "Ngân hàng câu hỏi",
        href: "/teacher/question-bank",
        icon: "questions",
      },
      {
        label: "Đề kiểm tra",
        href: "/teacher/tests",
        icon: "tests",
      },
      {
        label: "Thư viện đề",
        href: "/teacher/test-library",
        icon: "library",
      },
    ],
  },
  {
    label: "Giảng dạy",
    items: [
      {
        label: "Lớp học",
        href: "/teacher/classes",
        icon: "classes",
      },
      {
        label: "Giao bài",
        href: "/teacher/assignments",
        icon: "assignments",
      },
      {
        label: "Kết quả",
        href: "/teacher/results",
        icon: "results",
      },
    ],
  },
  {
    label: "Trí tuệ nhân tạo",
    items: [
      {
        label: "AI tạo câu hỏi",
        href: "/teacher/ai-generator",
        icon: "ai",
        badge: "AI",
      },
    ],
  },
];

const ADMIN_NAVIGATION_GROUP: NavigationGroup = {
  label: "Quản trị",
  items: [
    {
      label: "Quản lý giáo viên",
      href: "/admin/teachers",
      icon: "admin",
    },
  ],
};

const SECONDARY_ITEMS: NavigationItem[] = [
  {
    label: "Cài đặt",
    href: "/teacher/settings",
    icon: "settings",
  },
  {
    label: "Trợ giúp",
    href: "/teacher/help",
    icon: "help",
  },
];

function getInitials(
  name?: string,
  email?: string
): string {
  const cleanName =
    String(name || "").trim();

  if (cleanName) {
    const words = cleanName
      .split(/\s+/)
      .filter(Boolean);

    if (words.length >= 2) {
      const firstLetter =
        words[0]?.[0] || "";

      const lastLetter =
        words[words.length - 1]?.[0] || "";

      return `${firstLetter}${lastLetter}`.toUpperCase();
    }

    return cleanName
      .slice(0, 2)
      .toUpperCase();
  }

  const cleanEmail =
    String(email || "").trim();

  if (cleanEmail) {
    return cleanEmail
      .slice(0, 2)
      .toUpperCase();
  }

  return "GV";
}

function isNavigationItemActive(
  pathname: string,
  href: string
): boolean {
  if (pathname === href) {
    return true;
  }

  return pathname.startsWith(
    `${href}/`
  );
}

function SidebarIcon({
  name,
}: {
  name: SidebarIconName;
}) {
  const commonProps = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "dashboard") {
    return (
      <svg {...commonProps}>
        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="2"
        />

        <rect
          x="14"
          y="3"
          width="7"
          height="7"
          rx="2"
        />

        <rect
          x="3"
          y="14"
          width="7"
          height="7"
          rx="2"
        />

        <rect
          x="14"
          y="14"
          width="7"
          height="7"
          rx="2"
        />
      </svg>
    );
  }

  if (name === "questions") {
    return (
      <svg {...commonProps}>
        <path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" />
        <path d="M8 4.5v15" />
        <path d="M11.5 9h4" />
        <path d="M11.5 13h4" />
      </svg>
    );
  }

  if (name === "tests") {
    return (
      <svg {...commonProps}>
        <rect
          x="5"
          y="3"
          width="14"
          height="18"
          rx="2"
        />

        <path d="M9 3.5h6v3H9z" />
        <path d="m9 12 1.5 1.5L14 10" />
        <path d="M9 17h6" />
      </svg>
    );
  }

  if (name === "library") {
    return (
      <svg {...commonProps}>
        <path d="M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2" />
        <path d="M8 7h6" />
        <path d="M8 11h7" />
      </svg>
    );
  }

  if (name === "classes") {
    return (
      <svg {...commonProps}>
        <circle
          cx="9"
          cy="8"
          r="3"
        />

        <circle
          cx="17"
          cy="9"
          r="2"
        />

        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M14 15.5a4 4 0 0 1 6.5 3.1" />
      </svg>
    );
  }

  if (name === "assignments") {
    return (
      <svg {...commonProps}>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M15 3v5h5" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </svg>
    );
  }

  if (name === "results") {
    return (
      <svg {...commonProps}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </svg>
    );
  }

  if (name === "ai") {
    return (
      <svg {...commonProps}>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2z" />
        <path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" />
        <path d="m5.5 13 .6 1.8 1.9.7-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.7z" />
      </svg>
    );
  }

  if (name === "admin") {
    return (
      <svg {...commonProps}>
        <path d="M12 3 4.5 6v5c0 4.8 3 8.4 7.5 10 4.5-1.6 7.5-5.2 7.5-10V6z" />

        <circle
          cx="12"
          cy="10"
          r="2"
        />

        <path d="M8.5 16a3.5 3.5 0 0 1 7 0" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...commonProps}>
        <circle
          cx="12"
          cy="12"
          r="3"
        />

        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .6-1.5 1.1-1.5 2" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CollapseIcon({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {collapsed ? (
        <path d="m9 18 6-6-6-6" />
      ) : (
        <path d="m15 18-6-6 6-6" />
      )}
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

export default function TeacherSidebar({
  children,
}: TeacherSidebarProps) {
  const pathname =
    usePathname();

  const {
    teacher,
  } =
    useCurrentTeacher();

  const [
    collapsed,
    setCollapsed,
  ] = useState(false);

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    hydrated,
    setHydrated,
  ] = useState(false);

  const navigationGroups =
    useMemo(() => {
      if (
        teacher?.role ===
        "admin"
      ) {
        return [
          ...BASE_NAVIGATION_GROUPS,
          ADMIN_NAVIGATION_GROUP,
        ];
      }

      return BASE_NAVIGATION_GROUPS;
    }, [teacher?.role]);

  const teacherInitials =
    useMemo(
      () =>
        getInitials(
          teacher?.name,
          teacher?.email
        ),
      [
        teacher?.name,
        teacher?.email,
      ]
    );

  useEffect(() => {
    try {
      const savedValue =
        window.localStorage.getItem(
          SIDEBAR_STORAGE_KEY
        );

      setCollapsed(
        savedValue === "true"
      );
    } catch {
      setCollapsed(false);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setMobileOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [mobileOpen]);

  const shellClassName =
    useMemo(
      () =>
        [
          styles.shell,
          collapsed
            ? styles.shellCollapsed
            : "",
          hydrated
            ? styles.shellHydrated
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      [
        collapsed,
        hydrated,
      ]
    );

  function handleToggleCollapsed() {
    setCollapsed(
      (currentValue) => {
        const nextValue =
          !currentValue;

        try {
          window.localStorage.setItem(
            SIDEBAR_STORAGE_KEY,
            String(nextValue)
          );
        } catch {
          // Không chặn thao tác nếu
          // localStorage không khả dụng.
        }

        return nextValue;
      }
    );
  }

  function renderNavigationItem(
    item: NavigationItem
  ) {
    const active =
      isNavigationItemActive(
        pathname,
        item.href
      );

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`${styles.navigationLink} ${
          active
            ? styles.navigationLinkActive
            : ""
        }`}
        aria-current={
          active
            ? "page"
            : undefined
        }
        title={
          collapsed
            ? item.label
            : undefined
        }
      >
        <span
          className={
            styles.navigationIcon
          }
        >
          <SidebarIcon
            name={item.icon}
          />
        </span>

        <span
          className={
            styles.navigationLabel
          }
        >
          {item.label}
        </span>

        {item.badge && (
          <span
            className={
              styles.navigationBadge
            }
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div
      className={
        shellClassName
      }
    >
      <header
        className={
          styles.mobileHeader
        }
      >
        <button
          type="button"
          className={
            styles.mobileMenuButton
          }
          aria-label="Mở menu điều hướng"
          aria-expanded={
            mobileOpen
          }
          aria-controls="teacher-sidebar"
          onClick={() =>
            setMobileOpen(true)
          }
        >
          <MenuIcon />
        </button>

        <Link
          href="/teacher/dashboard"
          className={
            styles.mobileBrand
          }
        >
          <span
            className={
              styles.mobileBrandMark
            }
          >
            K
          </span>

          <span>
            KIEMTRA.AI
          </span>
        </Link>

        <Link
          href="/teacher/profile"
          className={
            styles.mobileAccountLink
          }
          aria-label="Mở hồ sơ giáo viên"
          title={
            teacher?.name ||
            "Hồ sơ giáo viên"
          }
        >
          <span
            className={
              styles.mobileAvatar
            }
          >
            {teacher?.picture ? (
              <img
                src={
                  teacher.picture
                }
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              teacherInitials
            )}
          </span>
        </Link>
      </header>

      <button
        type="button"
        className={`${styles.mobileOverlay} ${
          mobileOpen
            ? styles.mobileOverlayVisible
            : ""
        }`}
        aria-label="Đóng menu điều hướng"
        tabIndex={
          mobileOpen
            ? 0
            : -1
        }
        onClick={() =>
          setMobileOpen(false)
        }
      />

      <aside
        id="teacher-sidebar"
        className={`${styles.sidebar} ${
          mobileOpen
            ? styles.sidebarMobileOpen
            : ""
        }`}
        aria-label="Thanh điều hướng giáo viên"
      >
        <div
          className={
            styles.sidebarHeader
          }
        >
          <Link
            href="/teacher/dashboard"
            className={
              styles.brand
            }
            title={
              collapsed
                ? "KIEMTRA.AI"
                : undefined
            }
          >
            <span
              className={
                styles.brandMark
              }
            >
              K
            </span>

            <span
              className={
                styles.brandContent
              }
            >
              <strong>
                KIEMTRA.AI
              </strong>

              <small>
                {teacher?.role ===
                "admin"
                  ? "Administrator"
                  : "Teacher"}
              </small>
            </span>
          </Link>

          <button
            type="button"
            className={
              styles.mobileCloseButton
            }
            aria-label="Đóng menu điều hướng"
            onClick={() =>
              setMobileOpen(false)
            }
          >
            <CloseIcon />
          </button>
        </div>

        <nav
          className={
            styles.navigation
          }
          aria-label="Điều hướng giáo viên"
        >
          {navigationGroups.map(
            (
              group,
              groupIndex
            ) => (
              <div
                key={`${group.label ?? "main"}-${groupIndex}`}
                className={
                  styles.navigationGroup
                }
              >
                {group.label && (
                  <div
                    className={
                      styles.navigationGroupLabel
                    }
                  >
                    {group.label}
                  </div>
                )}

                <div
                  className={
                    styles.navigationGroupItems
                  }
                >
                  {group.items.map(
                    renderNavigationItem
                  )}
                </div>
              </div>
            )
          )}
        </nav>

        <div
          className={
            styles.sidebarBottom
          }
        >
          <nav
            className={
              styles.secondaryNavigation
            }
            aria-label="Cài đặt và trợ giúp"
          >
            {SECONDARY_ITEMS.map(
              renderNavigationItem
            )}
          </nav>

          <TeacherAccountMenu
            collapsed={collapsed}
          />

          <button
            type="button"
            className={
              styles.collapseButton
            }
            aria-label={
              collapsed
                ? "Mở rộng thanh điều hướng"
                : "Thu gọn thanh điều hướng"
            }
            title={
              collapsed
                ? "Mở rộng"
                : "Thu gọn"
            }
            onClick={
              handleToggleCollapsed
            }
          >
            <CollapseIcon
              collapsed={collapsed}
            />

            <span
              className={
                styles.collapseLabel
              }
            >
              Thu gọn sidebar
            </span>
          </button>
        </div>
      </aside>

      <div
        className={
          styles.contentArea
        }
      >
        <main
          className={
            styles.main
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}