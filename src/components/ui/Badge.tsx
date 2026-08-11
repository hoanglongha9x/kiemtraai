import type { ReactNode } from "react";

import styles from "./Badge.module.css";

export type BadgeColor =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "gray"
  | "blue";

export type BadgeSize =
  | "small"
  | "medium"
  | "large";

type Props = {
  children: ReactNode;
  color?: BadgeColor;
  size?: BadgeSize;
  className?: string;
};

export default function Badge({
  children,
  color = "gray",
  size = "medium",
  className = "",
}: Props) {
  const classes = [
    styles.badge,
    styles[color],
    styles[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {children}
    </span>
  );
}