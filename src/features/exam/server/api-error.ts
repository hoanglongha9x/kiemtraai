export class ExamApiError
  extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400
  ) {
    super(message);

    this.name =
      "ExamApiError";

    this.statusCode =
      statusCode;
  }
}

export type ResolvedApiError = {
  message: string;
  statusCode: number;
};

function hasStatusCode(
  error: unknown
): error is Error & {
  statusCode: number;
} {
  if (
    !(error instanceof Error)
  ) {
    return false;
  }

  const value =
    error as Error & {
      statusCode?: unknown;
    };

  return (
    typeof value.statusCode ===
      "number" &&
    Number.isFinite(
      value.statusCode
    )
  );
}

export function resolveApiError(
  error: unknown,
  fallbackMessage:
    string
): ResolvedApiError {
  if (
    hasStatusCode(error)
  ) {
    return {
      message:
        error.message ||
        fallbackMessage,

      statusCode:
        error.statusCode,
    };
  }

  if (
    error instanceof Error
  ) {
    return {
      message:
        error.message ||
        fallbackMessage,

      statusCode:
        500,
    };
  }

  return {
    message:
      fallbackMessage,

    statusCode:
      500,
  };
}
