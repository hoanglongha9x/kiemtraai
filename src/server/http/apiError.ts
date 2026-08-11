import {
  NextResponse,
} from "next/server";

export class ApiError extends Error {
  readonly statusCode: number;

  readonly code?: string;

  readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 400,
    options?: {
      code?: string;
      details?: unknown;
    }
  ) {
    super(
      message
    );

    this.name =
      "ApiError";

    this.statusCode =
      statusCode;

    this.code =
      options?.code;

    this.details =
      options?.details;
  }
}

export function isApiError(
  error: unknown
): error is ApiError {
  return (
    error instanceof
    ApiError
  );
}

export function getErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  if (
    error instanceof
    Error &&
    error.message
  ) {
    return error.message;
  }

  return fallbackMessage;
}

export function getApiErrorResponse(
  error: unknown,
  fallbackMessage: string
) {
  const statusCode =
    isApiError(
      error
    )
      ? error.statusCode
      : 500;

  const message =
    getErrorMessage(
      error,
      fallbackMessage
    );

  const responseBody: {
    status: "error";
    message: string;
    code?: string;
    details?: unknown;
  } = {
    status:
      "error",

    message,
  };

  if (
    isApiError(
      error
    )
  ) {
    if (
      error.code
    ) {
      responseBody.code =
        error.code;
    }

    if (
      error.details !==
      undefined
    ) {
      responseBody.details =
        error.details;
    }
  }

  return NextResponse.json(
    responseBody,
    {
      status:
        statusCode,
    }
  );
}