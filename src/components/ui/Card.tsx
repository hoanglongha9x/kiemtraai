import type {
  HTMLAttributes,
  ReactNode,
} from "react";

import styles from "./Card.module.css";

export type CardVariant =
  | "default"
  | "elevated"
  | "flat";

export type CardPadding =
  | "none"
  | "small"
  | "medium"
  | "large";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;

  variant?: CardVariant;
  padding?: CardPadding;

  interactive?: boolean;
};

export default function Card({
  children,

  variant = "default",
  padding = "medium",

  interactive = false,

  className = "",
  ...cardProps
}: Props) {
  const classes = [
    styles.card,
    styles[variant],
    styles[padding],
    interactive ? styles.interactive : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      {...cardProps}
    >
      {children}
    </div>
  );
}