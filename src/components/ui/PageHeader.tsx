import type { ReactNode } from "react";

import styles from "./PageHeader.module.css";

type Props = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = "",
}: Props) {
  const classes = [
    styles.header,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={classes}>
      <div className={styles.content}>
        {eyebrow && (
          <div className={styles.eyebrow}>
            {eyebrow}
          </div>
        )}

        <h1 className={styles.title}>
          {title}
        </h1>

        {description && (
          <p className={styles.description}>
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className={styles.actions}>
          {actions}
        </div>
      )}
    </header>
  );
}