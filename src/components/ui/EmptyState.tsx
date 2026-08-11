import type { ReactNode } from "react";

import {
  Inbox,
} from "lucide-react";

import styles from "./EmptyState.module.css";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function EmptyState({
  title,
  description,
  icon,
  actions,
  className = "",
}: Props) {
  const classes = [
    styles.container,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <div
        className={styles.icon}
        aria-hidden="true"
      >
        {icon ?? <Inbox size={25} />}
      </div>

      <h3 className={styles.title}>
        {title}
      </h3>

      {description && (
        <p className={styles.description}>
          {description}
        </p>
      )}

      {actions && (
        <div className={styles.actions}>
          {actions}
        </div>
      )}
    </section>
  );
}