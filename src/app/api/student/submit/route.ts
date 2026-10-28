import {
  NextResponse,
} from "next/server";

import {
  getAdminDb,
} from "@/lib/firebase/admin";

import {
  asRecord,
  safeString,
  safeUpper,
} from "@/features/exam/utils";

import {
  buildSubmitSuccessResponse,
  resolveApiError,
  runSubmitTransaction,
} from "@/features/exam/server";

export const runtime =
  "nodejs";

type SubmitRequestBody = {
  attemptId?: unknown;
  studentId?: unknown;
  studentCode?: unknown;
  answers?: unknown;
  antiCheat?: unknown;
  autoSubmit?: unknown;
};

type ParsedSubmitRequest = {
  attemptId: string;
  studentId: string;
  studentCode: string;
  answers: unknown;
  antiCheat: unknown;
  autoSubmit: boolean;
};

class SubmitRequestError
  extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400
  ) {
    super(message);

    this.name =
      "SubmitRequestError";

    this.statusCode =
      statusCode;
  }
}

function normalizeBoolean(
  value: unknown
): boolean {
  if (
    value === true ||
    value === 1
  ) {
    return true;
  }

  const normalized =
    safeString(value)
      .toLowerCase();

  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes"
  );
}

function parseSubmitRequest(
  value: unknown
): ParsedSubmitRequest {
  const body =
    asRecord(value);

  const attemptId =
    safeString(
      body.attemptId
    );

  const studentId =
    safeString(
      body.studentId
    );

  const studentCode =
    safeUpper(
      body.studentCode
    );

  if (!attemptId) {
    throw new SubmitRequestError(
      "Thiếu mã phiên làm bài.",
      400
    );
  }

  if (!studentId) {
    throw new SubmitRequestError(
      "Thiếu mã học sinh.",
      400
    );
  }

  if (!studentCode) {
    throw new SubmitRequestError(
      "Thiếu mã xác thực học sinh.",
      400
    );
  }

  return {
    attemptId,
    studentId,
    studentCode,

    answers:
      body.answers,

    antiCheat:
      body.antiCheat,

    autoSubmit:
      normalizeBoolean(
        body.autoSubmit
      ),
  };
}

async function readRequestBody(
  request: Request
): Promise<SubmitRequestBody> {
  try {
    return await request.json();
  } catch {
    throw new SubmitRequestError(
      "Dữ liệu gửi lên không hợp lệ.",
      400
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const requestBody =
      await readRequestBody(
        request
      );

    const {
      attemptId,
      studentId,
      studentCode,
      answers,
      antiCheat,
      autoSubmit,
    } = parseSubmitRequest(
      requestBody
    );

    const db =
      getAdminDb();

    // The transaction reads the official result before any grading, and
    // returns the committed document for both first submissions and retries.
    const transactionResult = await runSubmitTransaction({
      db,
      attemptId,
      studentId,
      studentCode,
      requestAnswers: answers,
      requestAntiCheat: antiCheat,
      submittedAt: new Date(),
      autoSubmit,
    });
    const response = buildSubmitSuccessResponse({ transactionResult });

    return NextResponse.json(
      response,
      {
        status:
          200,
      }
    );
  } catch (error) {
    console.error(
      "[POST /api/student/submit]",
      error
    );

    const resolvedError =
      resolveApiError(
        error,
        "Không thể nộp bài. Vui lòng thử lại."
      );

    return NextResponse.json(
      {
        status:
          "error",

        message:
          resolvedError.message,
      },
      {
        status:
          resolvedError.statusCode,
      }
    );
  }
}
