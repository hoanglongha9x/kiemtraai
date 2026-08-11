"use client";

import type {
  ReactNode,
} from "react";

import styles from "./AnimatedLoginScene.module.css";
import AuthMark from "./AuthMark";

type AnimatedLoginSceneProps = {
  children: ReactNode;
  eyebrow?: string;
};

export default function AnimatedLoginScene({
  children,
  eyebrow = "KIEMTRA.AI",
}: AnimatedLoginSceneProps) {
  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.stage
        }
      >
        <div
          className={
            styles.sky
          }
          aria-hidden="true"
        >
          <span
            className={
              styles.sun
            }
          />
          <span
            className={`${styles.cloud} ${styles.cloudOne}`}
          />
          <span
            className={`${styles.cloud} ${styles.cloudTwo}`}
          />
          <span
            className={`${styles.cloud} ${styles.cloudThree}`}
          />
          <span
            className={`${styles.mountain} ${styles.mountainBack}`}
          />
          <span
            className={`${styles.mountain} ${styles.mountainMid}`}
          />
          <span
            className={`${styles.mountain} ${styles.mountainFront}`}
          />
          <span
            className={`${styles.forest} ${styles.forestLeft}`}
          />
          <span
            className={`${styles.forest} ${styles.forestRight}`}
          />
          <span
            className={
              styles.glow
            }
          />
        </div>

        <header
          className={
            styles.topbar
          }
        >
          <div
            className={
              styles.brand
            }
          >
            <AuthMark />
            <span>
              {eyebrow}
            </span>
          </div>
        </header>

        <div
          className={
            styles.welcomeCopy
          }
          aria-hidden="true"
        >
          <span>
            Hello,
          </span>
          <strong>
            welcome!
          </strong>
        </div>

        <section
          className={
            styles.panel
          }
        >
          {children}
        </section>
      </div>
    </main>
  );
}
