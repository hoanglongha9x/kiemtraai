import {
  TEST_STATUS_LABELS,
} from "../constants";

import type {
  TestStatus,
} from "../types";

import styles from "./tests.module.css";

type TestStatusBadgeProps = {
  status: TestStatus;
};

export function TestStatusBadge({
  status,
}: TestStatusBadgeProps) {
  return (
    <span
      className={[
        styles.statusBadge,
        styles[`status_${status}`],
      ].join(" ")}
    >
      {TEST_STATUS_LABELS[status]}
    </span>
  );
}