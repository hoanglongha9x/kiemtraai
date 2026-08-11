import {
  Card,
} from "@/components/ui";

import styles from "./QuestionCardSkeleton.module.css";

export default function QuestionCardSkeleton() {
  return (
    <Card
      className={styles.card}
      aria-hidden="true"
    >
      <div className={styles.layout}>
        <div className={styles.selection}>
          <span
            className={`${styles.skeleton} ${styles.checkbox}`}
          />
        </div>

        <div className={styles.content}>
          <header className={styles.header}>
            <div className={styles.badges}>
              <span
                className={`${styles.skeleton} ${styles.badgeSmall}`}
              />

              <span
                className={`${styles.skeleton} ${styles.badgeMedium}`}
              />

              <span
                className={`${styles.skeleton} ${styles.badgeSmall}`}
              />

              <span
                className={`${styles.skeleton} ${styles.badgeMedium}`}
              />
            </div>

            <span
              className={`${styles.skeleton} ${styles.updatedAt}`}
            />
          </header>

          <div className={styles.question}>
            <span
              className={`${styles.skeleton} ${styles.questionLine}`}
            />

            <span
              className={`${styles.skeleton} ${styles.questionLineMedium}`}
            />
          </div>

          <div className={styles.classification}>
            <span
              className={`${styles.skeleton} ${styles.classificationItem}`}
            />

            <span
              className={`${styles.skeleton} ${styles.classificationItem}`}
            />

            <span
              className={`${styles.skeleton} ${styles.classificationWide}`}
            />
          </div>

          <div className={styles.answers}>
            {Array.from({
              length: 4,
            }).map((_, index) => (
              <div
                key={index}
                className={styles.answer}
              >
                <span
                  className={`${styles.skeleton} ${styles.answerId}`}
                />

                <span
                  className={`${styles.skeleton} ${
                    index % 2 === 0
                      ? styles.answerTextWide
                      : styles.answerText
                  }`}
                />
              </div>
            ))}
          </div>

          <footer className={styles.footer}>
            <span
              className={`${styles.skeleton} ${styles.footerHint}`}
            />

            <div className={styles.actions}>
              <span
                className={`${styles.skeleton} ${styles.actionButton}`}
              />

              <span
                className={`${styles.skeleton} ${styles.actionButton}`}
              />

              <span
                className={`${styles.skeleton} ${styles.actionButtonSmall}`}
              />
            </div>
          </footer>
        </div>
      </div>
    </Card>
  );
}