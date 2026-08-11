import type {
  CSSProperties,
  ReactNode,
} from "react";

import styles from "./StatCard.module.css";

type Accent =
  | "purple"
  | "blue"
  | "green"
  | "orange";

type TrendDirection =
  | "up"
  | "down"
  | "neutral";

type Props = {
  label: string;
  value: string | number;

  description?: string;
  icon?: ReactNode;

  trend?: string;
  trendDirection?: TrendDirection;

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

const trendMap: Record<
  TrendDirection,
  {
    background: string;
    color: string;
    symbol: string;
  }
> = {
  up: {
    background: "#ecfdf5",
    color: "#047857",
    symbol: "↗",
  },

  down: {
    background: "#fef2f2",
    color: "#dc2626",
    symbol: "↘",
  },

  neutral: {
    background: "#f1f5f9",
    color: "#475569",
    symbol: "→",
  },
};

export default function StatCard({
  label,
  value,

  description,
  icon,

  trend,
  trendDirection = "neutral",

  accent = "purple",
}: Props) {
  const accentValues = accentMap[accent];
  const trendValues =
    trendMap[trendDirection];

  const customProperties = {
    "--stat-accent": accentValues.accent,
    "--stat-soft-background":
      accentValues.softBackground,

    "--trend-background":
      trendValues.background,

    "--trend-color":
      trendValues.color,
  } as CSSProperties;

  return (
    <article
      className={styles.card}
      style={customProperties}
    >
      <div className={styles.topRow}>
        <div
          className={styles.icon}
          aria-hidden="true"
        >
          {icon ?? "•"}
        </div>

        {trend && (
          <div className={styles.trend}>
            <span aria-hidden="true">
              {trendValues.symbol}
            </span>

            <span>{trend}</span>
          </div>
        )}
      </div>

      <div className={styles.value}>
        {value}
      </div>

      <div className={styles.label}>
        {label}
      </div>

      {description && (
        <div className={styles.description}>
          {description}
        </div>
      )}

      <div
        className={styles.decoration}
        aria-hidden="true"
      />
    </article>
  );
}