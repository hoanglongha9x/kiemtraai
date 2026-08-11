import styles from "./Avatar.module.css";

export type AvatarSize =
  | "small"
  | "medium"
  | "large";

type Props = {
  name: string;
  imageUrl?: string;
  size?: AvatarSize;
  circle?: boolean;
  className?: string;
};

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "GV";
  }

  return words
    .slice(-2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export default function Avatar({
  name,
  imageUrl,
  size = "medium",
  circle = false,
  className = "",
}: Props) {
  const classes = [
    styles.avatar,
    styles[size],
    circle ? styles.circle : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      title={name}
      aria-label={name}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={styles.image}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}