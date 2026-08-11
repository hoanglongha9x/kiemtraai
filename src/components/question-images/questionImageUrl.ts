function safeText(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

export function getQuestionImageUrl(
  imageId?: string,
  imageUrl?: string
): string {
  const normalizedImageId =
    safeText(
      imageId
    );

  if (
    normalizedImageId
  ) {
    return `/api/question-images/${encodeURIComponent(
      normalizedImageId
    )}`;
  }

  return safeText(
    imageUrl
  );
}

export function hasQuestionImage(
  imageId?: string,
  imageUrl?: string
): boolean {
  return Boolean(
    getQuestionImageUrl(
      imageId,
      imageUrl
    )
  );
}