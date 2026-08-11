import { NextResponse } from "next/server";
import { parseQuestionsFromText } from "@/lib/import/parseQuestions";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";
import { parseDocxFile } from "@/features/question-bank/import/parsers/parseDocxFile";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function getFileExtension(fileName: string) {
  const cleanName = fileName.toLowerCase();
  const parts = cleanName.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

async function readPdfText(buffer: Buffer) {
  const pdfParseModule: any = await import("pdf-parse");
  const pdfParse = pdfParseModule.default || pdfParseModule;

  const result = await pdfParse(buffer);

  return result.text || "";
}

export async function POST(request: Request) {
  try {
    await getCurrentTeacher(request);

    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!fileValue || typeof fileValue === "string") {
      return NextResponse.json(
        {
          status: "error",
          message: "Vui lòng chọn file Word hoặc PDF.",
        },
        { status: 400 }
      );
    }

    const file = fileValue as File;

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          status: "error",
          message: "File quá lớn. Vui lòng chọn file dưới 15MB.",
        },
        { status: 400 }
      );
    }

    const fileName = file.name || "";
    const extension = getFileExtension(fileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText = "";

    if (extension === "docx") {
      rawText = await parseDocxFile(file);
    } else if (extension === "pdf") {
      rawText = await readPdfText(buffer);
    } else {
      return NextResponse.json(
        {
          status: "error",
          message: "Chỉ hỗ trợ file .docx hoặc .pdf.",
        },
        { status: 400 }
      );
    }

    const parsed = parseQuestionsFromText(rawText);

    return NextResponse.json({
      status: "success",
      fileName,
      fileType: extension,
      rawText,
      questionCount: parsed.questions.length,
      questions: parsed.questions,
      warnings: parsed.warnings,
      message: `Đã import ${parsed.questions.length} câu hỏi từ file.`,
    });
  } catch (error: any) {
    console.error("POST /api/teacher/import-questions error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không import được câu hỏi.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}