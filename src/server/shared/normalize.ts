export function safeString(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

export function safeLower(
  value: unknown
): string {
  return safeString(
    value
  ).toLocaleLowerCase(
    "vi"
  );
}

export function normalizeEmail(
  value: unknown
): string {
  return safeString(
    value
  ).toLowerCase();
}

export function normalizeNumber(
  value: unknown,
  fallback = 0
): number {
  const parsedValue =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    return fallback;
  }

  return parsedValue;
}

export function normalizeInteger(
  value: unknown,
  fallback = 0
): number {
  const parsedValue =
    normalizeNumber(
      value,
      fallback
    );

  if (
    !Number.isInteger(
      parsedValue
    )
  ) {
    return fallback;
  }

  return parsedValue;
}

export function normalizeBoolean(
  value: unknown,
  fallback = false
): boolean {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "number"
  ) {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    return fallback;
  }

  const normalizedValue =
    safeLower(
      value
    );

  if (
    normalizedValue ===
      "true" ||
    normalizedValue ===
      "1" ||
    normalizedValue ===
      "yes" ||
    normalizedValue ===
      "đúng" ||
    normalizedValue ===
      "dung"
  ) {
    return true;
  }

  if (
    normalizedValue ===
      "false" ||
    normalizedValue ===
      "0" ||
    normalizedValue ===
      "no" ||
    normalizedValue ===
      "sai"
  ) {
    return false;
  }

  return fallback;
}

export function normalizeStringArray(
  value: unknown
): string[] {
  if (
    Array.isArray(
      value
    )
  ) {
    return Array.from(
      new Set(
        value
          .map(
            (
              item
            ) =>
              safeString(
                item
              )
          )
          .filter(
            Boolean
          )
      )
    );
  }

  const text =
    safeString(
      value
    );

  if (!text) {
    return [];
  }

  return Array.from(
    new Set(
      text
        .split(",")
        .map(
          (
            item
          ) =>
            item.trim()
        )
        .filter(
          Boolean
        )
    )
  );
}

export function normalizeOptionalIsoDate(
  value: unknown
): string | undefined {
  const text =
    safeString(
      value
    );

  if (!text) {
    return undefined;
  }

  const date =
    new Date(
      text
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return undefined;
  }

  return date.toISOString();
}

export function removeUndefinedValues<
  TValue
>(
  value: TValue
): TValue {
  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      (
        item
      ) =>
        removeUndefinedValues(
          item
        )
    ) as TValue;
  }

  if (
    value &&
    typeof value ===
      "object" &&
    !(value instanceof Date)
  ) {
    const cleanedEntries =
      Object.entries(
        value as Record<
          string,
          unknown
        >
      )
        .filter(
          (
            [
              ,
              entryValue,
            ]
          ) =>
            entryValue !==
            undefined
        )
        .map(
          (
            [
              key,
              entryValue,
            ]
          ) => [
            key,
            removeUndefinedValues(
              entryValue
            ),
          ]
        );

    return Object.fromEntries(
      cleanedEntries
    ) as TValue;
  }

  return value;
}