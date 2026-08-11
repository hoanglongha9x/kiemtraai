"use client";

import styles from "./AuthMark.module.css";

type AuthMarkProps = {
  size?: "small" | "large";
};

export default function AuthMark({
  size = "small",
}: AuthMarkProps) {
  return (
    <span
      className={`${styles.mark} ${
        size === "large"
          ? styles.large
          : styles.small
      }`}
      aria-hidden="true"
    >
      K
    </span>
  );
}
