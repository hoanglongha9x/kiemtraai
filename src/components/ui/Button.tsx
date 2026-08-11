import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";

export type ButtonSize =
  | "small"
  | "medium"
  | "large";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;

  fullWidth?: boolean;

  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const Button = forwardRef<
  HTMLButtonElement,
  Props
>(function Button(
  {
    variant = "primary",
    size = "medium",
    fullWidth = false,

    leftIcon,
    rightIcon,

    className = "",
    children,
    type = "button",

    ...buttonProps
  },
  ref
) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      {...buttonProps}
    >
      {leftIcon && (
        <span aria-hidden="true">
          {leftIcon}
        </span>
      )}

      <span>{children}</span>

      {rightIcon && (
        <span aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </button>
  );
});

export default Button;