import Link from "next/link";

import type {
  CSSProperties,
  ReactNode,
} from "react";

import styles from "./QuickActionCard.module.css";

type Accent =
  | "purple"
  | "blue"
  | "green"
  | "orange";

type Props = {
  href: string;

  title: string;
  description: string;

  icon?: ReactNode;
  accent?: Accent;
};

const accentMap: Record<
  Accent,
  {
    accent: string;
    softBackground: string;
  }
> = {
  purple: {
    accent: "#7c3aed",
    softBackground: "#f3e8ff",
  },

  blue: {
    accent: "#2563eb",
    softBackground: "#eff6ff",
  },

  green: {
    accent: "#059669",
    softBackground: "#ecfdf5",
  },

  orange: {
    accent: "#d97706",
    softBackground: "#fffbeb",
  },
};

export default function QuickActionCard({
  href,

  title,
  description,

  icon,
  accent = "purple",
}: Props) {
  const accentValues = accentMap[accent];

  const customProperties = {
    "--action-accent":
      accentValues.accent,

    "--action-soft-background":
      accentValues.softBackground,
  } as CSSProperties;

  return (
    <Link
      href={href}
      className={styles.link}
    >
      <article
        className={styles.card}
        style={customProperties}
      >
        <div
          className={styles.icon}
          aria-hidden="true"
        >
          {icon ?? "•"}
        </div>

        <div className={styles.content}>
          <div className={styles.title}>
            {title}
          </div>

          <div
            className={styles.description}
          >
            {description}
          </div>
        </div>

        <div
          className={styles.arrow}
          aria-hidden="true"
        >
          →
        </div>
      </article>
    </Link>
  );
}