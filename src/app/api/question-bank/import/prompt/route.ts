import {
  NextResponse,
} from "next/server";

import {
  IMPORT_PROMPT_CONTENT,
  IMPORT_PROMPT_FILE_NAME,
} from "@/features/question-bank/import/lib/importPrompt";

export const runtime =
  "nodejs";

export async function GET() {
  return new NextResponse(
    `\uFEFF${IMPORT_PROMPT_CONTENT}`,
    {
      status: 200,

      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",

        "Content-Disposition":
          `attachment; filename="${IMPORT_PROMPT_FILE_NAME}"`,

        "Cache-Control":
          "no-store",
      },
    }
  );
}
