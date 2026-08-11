"use client";

import type {
  ChangeEvent,
  InputHTMLAttributes,
} from "react";

import {
  Search,
  X,
} from "lucide-react";

import styles from "./SearchInput.module.css";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
};

export default function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Tìm kiếm...",
  className = "",
  ...inputProps
}: Props) {
  function handleChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    onChange(event.target.value);
  }

  function handleClear() {
    onChange("");
    onClear?.();
  }

  return (
    <div
      className={[
        styles.wrapper,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={styles.icon}
        aria-hidden="true"
      >
        <Search size={17} />
      </span>

      <input
        {...inputProps}
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={styles.input}
      />

      {value.length > 0 && (
        <button
          type="button"
          className={styles.clearButton}
          aria-label="Xóa nội dung tìm kiếm"
          onClick={handleClear}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}