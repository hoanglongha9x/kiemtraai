"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getQuestionImageUrl,
} from "./questionImageUrl";

import styles from "./QuestionImage.module.css";

export type QuestionImageProps = {
  imageId?: string;

  imageUrl?: string;

  alt?: string;

  caption?: string;

  className?: string;

  loading?:
    | "eager"
    | "lazy";

  allowFallbackUrl?: boolean;
};

function joinClassNames(
  ...values: Array<
    string | undefined | false
  >
): string {
  return values
    .filter(
      Boolean
    )
    .join(" ");
}

export default function QuestionImage({
  imageId,
  imageUrl,
  alt =
    "Hình ảnh câu hỏi",
  caption,
  className,
  loading =
    "lazy",
  allowFallbackUrl =
    true,
}: QuestionImageProps) {
  const proxyUrl =
    useMemo(
      () =>
        imageId
          ? getQuestionImageUrl(
              imageId
            )
          : "",
      [
        imageId,
      ]
    );

  const fallbackUrl =
    useMemo(
      () =>
        imageUrl?.trim() ??
        "",
      [
        imageUrl,
      ]
    );

  const initialUrl =
    proxyUrl ||
    fallbackUrl;

  const [
    currentUrl,
    setCurrentUrl,
  ] =
    useState(
      initialUrl
    );

  const [
    hasError,
    setHasError,
  ] =
    useState(
      false
    );

  useEffect(
    () => {
      setCurrentUrl(
        initialUrl
      );

      setHasError(
        false
      );
    },
    [
      initialUrl,
    ]
  );

  if (
    !currentUrl ||
    hasError
  ) {
    return null;
  }

  function handleError() {
    const canUseFallback =
      allowFallbackUrl &&
      Boolean(
        fallbackUrl
      ) &&
      currentUrl !==
        fallbackUrl;

    if (
      canUseFallback
    ) {
      setCurrentUrl(
        fallbackUrl
      );

      return;
    }

    setHasError(
      true
    );
  }

  return (
    <figure
      className={joinClassNames(
        styles.figure,
        className
      )}
    >
      <div
        className={
          styles.imageFrame
        }
      >
        <img
          className={
            styles.image
          }
          src={currentUrl}
          alt={alt}
          loading={
            loading
          }
          decoding="async"
          onError={
            handleError
          }
        />
      </div>

      {caption ? (
        <figcaption
          className={
            styles.caption
          }
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}