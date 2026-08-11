import type { ReactNode } from "react";
import styles from "./SectionHeader.module.css";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export default function SectionHeader({
  title,
  description,
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
    <div className={classes}>
      <div className={styles.content}>
        <h2 className={styles.title}>
          {title}
        </h2>

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
    </div>
  );
}