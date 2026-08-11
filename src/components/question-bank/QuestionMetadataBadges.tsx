import {
  Badge,
} from "@/components/ui";

import type {
  CognitiveLevel,
  QuestionDifficulty,
} from "./types";

import styles from "./QuestionMetadataBadges.module.css";

type QuestionMetadataBadgesProps = {
  difficulty: QuestionDifficulty;
  cognitiveLevel: CognitiveLevel;
};

const difficultyLabels: Record<
  QuestionDifficulty,
  string
> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

const cognitiveLevelLabels: Record<
  CognitiveLevel,
  string
> = {
  recognition: "Nhận biết",
  understanding: "Thông hiểu",
  application: "Vận dụng",
  high_application:
    "Vận dụng cao",
};

export default function QuestionMetadataBadges({
  difficulty,
  cognitiveLevel,
}: QuestionMetadataBadgesProps) {
  const difficultyColor =
    difficulty === "easy"
      ? "success"
      : difficulty === "hard"
        ? "danger"
        : "warning";

  const cognitiveColor =
    cognitiveLevel ===
      "recognition"
      ? "gray"
      : cognitiveLevel ===
          "understanding"
        ? "blue"
        : cognitiveLevel ===
            "application"
          ? "primary"
          : "danger";

  return (
    <div
      className={styles.badges}
    >
      <Badge
        color={difficultyColor}
      >
        {
          difficultyLabels[
            difficulty
          ]
        }
      </Badge>

      <Badge
        color={cognitiveColor}
      >
        {
          cognitiveLevelLabels[
            cognitiveLevel
          ]
        }
      </Badge>
    </div>
  );
}