import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";
import { safeString } from "@/server/shared/normalize";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  return `data:${file.type};base64,${base64}`;
}

export async function POST(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);

    const appsScriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL;

    if (!appsScriptUrl) {
      return NextResponse.json(
        {
          status: "error",
          message: "Thiếu APPS_SCRIPT_WEB_APP_URL trong .env.local.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!fileValue || typeof fileValue === "string") {
      return NextResponse.json(
        { status: "error", message: "Thiếu file ảnh." },
        { status: 400 }
      );
    }

    const file = fileValue as File;

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          status: "error",
          message: "Ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB.",
        },
        { status: 400 }
      );
    }

    const dataUrl = await fileToDataUrl(file);

    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "uploadImage",
        filename: file.name || "question_image.png",
        mimeType: file.type || "image/png",
        dataUrl,
        uploadedBy: teacher.email,
        scope: safeString(formData.get("scope") || "question"),
      }),
    });

    const text = await response.text();

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      console.error("Apps Script upload trả về không phải JSON:", text);

      return NextResponse.json(
        {
          status: "error",
          message:
            "Apps Script không trả về JSON. Kiểm tra lại Web App URL và deployment.",
        },
        { status: 500 }
      );
    }

    if (!response.ok || data?.status === "error") {
      console.error("Apps Script upload error:", data);

      return NextResponse.json(
        {
          status: "error",
          message: data?.message || "Apps Script upload ảnh thất bại.",
          detail: data?.detail || "",
          code: data?.code || "",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      imageId: data.file_id || "",
      imageUrl: data.url || "",
      name: data.name || file.name || "",
      mimeType: data.mime_type || file.type || "",
    });
  } catch (error: any) {
    console.error("POST /api/teacher/upload-image error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không upload được ảnh.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}