import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    fileId: string;
  }>;
};

function isValidFileId(
  value: string
): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(
    value
  );
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      fileId,
    } = await context.params;

    if (
      !fileId ||
      !isValidFileId(fileId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Google Drive fileId không hợp lệ.",
        },
        {
          status: 400,
        }
      );
    }

    const driveUrl =
      new URL(
        "https://drive.google.com/uc"
      );

    driveUrl.searchParams.set(
      "export",
      "download"
    );

    driveUrl.searchParams.set(
      "id",
      fileId
    );

    const driveResponse =
      await fetch(
        driveUrl.toString(),
        {
          method: "GET",
          cache: "no-store",
          redirect: "follow",
          headers: {
            Accept:
              "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
          },
        }
      );

    if (
      !driveResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Không thể tải hình ảnh từ Google Drive.",
        },
        {
          status:
            driveResponse.status,
        }
      );
    }

    const contentType =
      driveResponse.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.startsWith(
        "image/"
      )
    ) {
      const responsePreview =
        (
          await driveResponse.text()
        ).slice(0, 500);

      console.error(
        "Google Drive không trả ảnh:",
        {
          fileId,
          contentType,
          responsePreview,
        }
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Google Drive không trả dữ liệu hình ảnh trực tiếp.",
        },
        {
          status: 502,
        }
      );
    }

    const imageBuffer =
      await driveResponse.arrayBuffer();

    return new NextResponse(
      imageBuffer,
      {
        status: 200,
        headers: {
          "Content-Type":
            contentType,

          "Content-Length":
            String(
              imageBuffer.byteLength
            ),

          "Cache-Control":
            "public, max-age=3600, s-maxage=86400",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET question image error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Không thể hiển thị hình ảnh.",
      },
      {
        status: 500,
      }
    );
  }
}