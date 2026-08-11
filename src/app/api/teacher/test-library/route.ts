import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { getApiErrorResponse, ApiError } from "@/server/http/apiError";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";
import { safeString } from "@/server/shared/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 40 * 1024 * 1024;
const LOCAL_LIBRARY_STORAGE_DIR = path.join(
  process.cwd(),
  ".local-storage",
  "test-library"
);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

function normalizeSubject(value: unknown): string {
  return safeString(value);
}

function normalizeGrade(value: unknown): string {
  const grade = safeString(value).replace(/^khối\s*/i, "");
  return grade;
}

function normalizeVisibility(value: unknown): "private" | "school" {
  return safeString(value) === "school" ? "school" : "private";
}

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : safeString(value)
        .split(",")
        .map((item) => item.trim());

  return Array.from(new Set(raw.map((item) => safeString(item)).filter(Boolean)))
    .slice(0, 12);
}

function getSafeFileName(value: unknown): string {
  return (
    safeString(value)
      .replace(/[^\p{L}\p{N}._ -]+/gu, "")
      .replace(/\s+/g, " ")
      .trim() || "de-kiem-tra"
  );
}

function createAccessToken(): string {
  return randomBytes(24).toString("hex");
}

function isMissingBucketError(error: unknown): boolean {
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    errors?: Array<{ reason?: unknown; message?: unknown }>;
  };

  return (
    candidate?.code === 404 ||
    String(candidate?.message ?? "").includes("bucket does not exist") ||
    candidate?.errors?.some(
      (item) =>
        item.reason === "notFound" ||
        String(item.message ?? "").includes("bucket does not exist")
    ) === true
  );
}

function createTokenizedReadUrl(
  libraryId: string,
  accessToken: string,
  mode: "preview" | "download"
): string {
  const params = new URLSearchParams({
    fileId: libraryId,
    token: accessToken,
    mode,
  });

  return `/api/teacher/test-library?${params.toString()}`;
}

async function saveLocalLibraryFile(
  buffer: Buffer,
  filePath: string
) {
  const absolutePath = path.join(
    LOCAL_LIBRARY_STORAGE_DIR,
    filePath
  );

  await mkdir(path.dirname(absolutePath), {
    recursive: true,
  });

  await writeFile(absolutePath, buffer);
}

async function readLocalLibraryFile(filePath: string): Promise<Buffer> {
  const absolutePath = path.resolve(
    LOCAL_LIBRARY_STORAGE_DIR,
    filePath
  );
  const storageRoot = path.resolve(LOCAL_LIBRARY_STORAGE_DIR);

  if (!absolutePath.startsWith(storageRoot + path.sep)) {
    throw new ApiError("Đường dẫn tài liệu không hợp lệ.", 400);
  }

  return readFile(absolutePath);
}

function canReadLibraryItem(teacher: Awaited<ReturnType<typeof getCurrentTeacher>>, item: any) {
  return safeString(item.ownerEmail).toLowerCase() === teacher.email;
}

function canWriteLibraryItem(
  teacher: Awaited<ReturnType<typeof getCurrentTeacher>>,
  item: any
) {
  return (
    safeString(item.ownerEmail).toLowerCase() === teacher.email
  );
}

async function createSignedReadUrl(path: string, filename: string, mode: "preview" | "download") {
  const bucket = getAdminStorageBucket();
  const file = bucket.file(path);
  const extension = filename.split(".").pop()?.toLowerCase();
  const isPdf = extension === "pdf";

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
    responseDisposition:
      mode === "download"
        ? `attachment; filename="${encodeURIComponent(filename)}"`
        : isPdf
          ? `inline; filename="${encodeURIComponent(filename)}"`
          : `attachment; filename="${encodeURIComponent(filename)}"`,
  });

  return url;
}

async function mapLibraryItem(doc: { id: string; data: () => FirebaseFirestore.DocumentData | undefined }) {
  const data = doc.data() || {};
  const filename = safeString(data.originalFileName || data.title || "de-kiem-tra");
  const filePath = safeString(data.filePath);
  const mimeType = safeString(data.mimeType);
  const storageProvider = safeString(data.storageProvider) || "firebase";
  const accessToken = safeString(data.accessToken);
  const canUseLocalUrl = storageProvider === "local" && accessToken;

  return {
    id: doc.id,
    title: safeString(data.title),
    subject: safeString(data.subject),
    grade: safeString(data.grade),
    tags: Array.isArray(data.tags) ? data.tags.map(safeString).filter(Boolean) : [],
    visibility: normalizeVisibility(data.visibility),
    ownerEmail: safeString(data.ownerEmail),
    ownerName: safeString(data.ownerName),
    schoolId: safeString(data.schoolId),
    originalFileName: filename,
    mimeType,
    fileSize: Number(data.fileSize || 0),
    fileExtension: safeString(data.fileExtension),
    storageProvider,
    createdAt: safeString(data.createdAt),
    updatedAt: safeString(data.updatedAt),
    isPdf: mimeType === "application/pdf",
    previewUrl:
      canUseLocalUrl && mimeType === "application/pdf"
        ? createTokenizedReadUrl(doc.id, accessToken, "preview")
        : filePath && mimeType === "application/pdf"
          ? await createSignedReadUrl(filePath, filename, "preview")
          : "",
    downloadUrl: canUseLocalUrl
      ? createTokenizedReadUrl(doc.id, accessToken, "download")
      : filePath
        ? await createSignedReadUrl(filePath, filename, "download")
        : "",
  };
}

async function serveLibraryFile(request: Request) {
  const url = new URL(request.url);
  const libraryId = safeString(url.searchParams.get("fileId"));
  const accessToken = safeString(url.searchParams.get("token"));
  const mode = safeString(url.searchParams.get("mode")) === "preview" ? "preview" : "download";

  if (!libraryId || !accessToken) {
    return null;
  }

  const doc = await getAdminDb().collection("testLibrary").doc(libraryId).get();

  if (!doc.exists) {
    throw new ApiError("Không tìm thấy tài liệu.", 404);
  }

  const data = doc.data() || {};

  if (safeString(data.accessToken) !== accessToken) {
    throw new ApiError("Link tài liệu không hợp lệ hoặc đã hết hạn.", 403);
  }

  if (safeString(data.storageProvider) !== "local") {
    throw new ApiError("Tài liệu này không được lưu ở bộ nhớ local.", 400);
  }

  const filename = safeString(data.originalFileName || data.title || "de-kiem-tra");
  const mimeType = safeString(data.mimeType) || "application/octet-stream";
  const buffer = await readLocalLibraryFile(safeString(data.filePath));
  const isInlinePdf = mode === "preview" && mimeType === "application/pdf";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${isInlinePdf ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function GET(request: Request) {
  try {
    const fileResponse = await serveLibraryFile(request);

    if (fileResponse) {
      return fileResponse;
    }

    const teacher = await getCurrentTeacher(request);
    const db = getAdminDb();
    const url = new URL(request.url);

    const subject = normalizeSubject(url.searchParams.get("subject"));
    const grade = normalizeGrade(url.searchParams.get("grade"));
    const ownerScope = safeString(url.searchParams.get("ownerScope"));
    const search = safeString(url.searchParams.get("search")).toLowerCase();

    const snapshot = await db
      .collection("testLibrary")
      .where("ownerEmail", "==", teacher.email)
      .get();

    const visibleDocs = snapshot.docs
      .filter((doc) => {
        const item = doc.data();
        if (safeString(item.status) === "deleted") return false;
        if (!canReadLibraryItem(teacher, item)) return false;
        if (subject && safeString(item.subject) !== subject) return false;
        if (grade && safeString(item.grade) !== grade) return false;
        if (
          ownerScope === "mine" &&
          safeString(item.ownerEmail).toLowerCase() !== teacher.email
        ) {
          return false;
        }
        if (
          ownerScope === "school" &&
          safeString(item.ownerEmail).toLowerCase() === teacher.email
        ) {
          return false;
        }
        if (search) {
          const haystack = [
            item.title,
            item.originalFileName,
            ...(Array.isArray(item.tags) ? item.tags : []),
          ]
            .map((value) => safeString(value).toLowerCase())
            .join(" ");

          if (!haystack.includes(search)) return false;
        }

        return true;
      })
      .sort((a, b) =>
        safeString(b.data().createdAt).localeCompare(safeString(a.data().createdAt))
      );

    const items = await Promise.all(visibleDocs.map(mapLibraryItem));

    return NextResponse.json({
      status: "success",
      items,
    });
  } catch (error: unknown) {
    console.error("GET /api/teacher/test-library error:", error);
    return getApiErrorResponse(error, "Không tải được thư viện đề.");
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const formData = await request.formData();

    const fileValue = formData.get("file");

    if (!fileValue || typeof fileValue === "string") {
      throw new ApiError("Vui lòng chọn file PDF hoặc DOCX.", 400);
    }

    const file = fileValue as File;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new ApiError("Chỉ hỗ trợ upload file PDF hoặc DOCX.", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError("File quá lớn. Vui lòng chọn file dưới 40MB.", 400);
    }

    const subject = normalizeSubject(formData.get("subject"));
    const grade = normalizeGrade(formData.get("grade"));

    if (!subject) {
      throw new ApiError("Vui lòng chọn môn học.", 400);
    }

    if (!grade) {
      throw new ApiError("Vui lòng chọn khối lớp.", 400);
    }

    const db = getAdminDb();
    const now = new Date().toISOString();
    const libraryRef = db.collection("testLibrary").doc();
    const extension = MIME_EXTENSIONS[file.type] || "bin";
    const originalFileName = getSafeFileName(file.name);
    const title = safeString(formData.get("title")) || originalFileName.replace(/\.[^.]+$/, "");
    let filePath = `test-library/${teacher.schoolId}/${libraryRef.id}/${Date.now()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const accessToken = createAccessToken();
    let storageProvider: "firebase" | "local" = "firebase";

    try {
      const bucket = getAdminStorageBucket();

      await bucket.file(filePath).save(buffer, {
        contentType: file.type,
        resumable: false,
        metadata: {
          metadata: {
            ownerEmail: teacher.email,
            schoolId: teacher.schoolId,
            libraryId: libraryRef.id,
          },
        },
      });
    } catch (uploadError) {
      if (!isMissingBucketError(uploadError)) {
        throw uploadError;
      }

      storageProvider = "local";
      filePath = `${teacher.schoolId}/${libraryRef.id}/${Date.now()}.${extension}`;

      await saveLocalLibraryFile(buffer, filePath);
    }

    const data = {
      title,
      subject,
      grade,
      tags: normalizeTags(formData.get("tags")),
      visibility: normalizeVisibility(formData.get("visibility")),
      ownerEmail: teacher.email,
      ownerName: teacher.name,
      ownerUid: teacher.uid,
      schoolId: teacher.schoolId,
      originalFileName,
      mimeType: file.type,
      fileExtension: extension,
      fileSize: file.size,
      filePath,
      storageProvider,
      accessToken,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    await libraryRef.set(data);

    const itemDoc = await libraryRef.get();

    return NextResponse.json({
      status: "success",
      item: await mapLibraryItem(itemDoc),
      message: "Đã upload đề vào thư viện.",
    });
  } catch (error: unknown) {
    console.error("POST /api/teacher/test-library error:", error);
    return getApiErrorResponse(error, "Không upload được đề.");
  }
}

export async function PATCH(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const body = await request.json();
    const libraryId = safeString(body.libraryId);

    if (!libraryId) {
      throw new ApiError("Thiếu mã tài liệu.", 400);
    }

    const db = getAdminDb();
    const ref = db.collection("testLibrary").doc(libraryId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new ApiError("Không tìm thấy tài liệu.", 404);
    }

    const item = doc.data() || {};

    if (!canWriteLibraryItem(teacher, item)) {
      throw new ApiError("Bạn không có quyền cập nhật tài liệu này.", 403);
    }

    await ref.update({
      visibility: normalizeVisibility(body.visibility),
      updatedAt: new Date().toISOString(),
      updatedBy: teacher.email,
    });

    return NextResponse.json({
      status: "success",
      message: "Đã cập nhật chế độ chia sẻ.",
    });
  } catch (error: unknown) {
    console.error("PATCH /api/teacher/test-library error:", error);
    return getApiErrorResponse(error, "Không cập nhật được thư viện đề.");
  }
}
