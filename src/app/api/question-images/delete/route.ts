import {
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";

export async function DELETE() {
  return NextResponse.json(
    {
      status:
        "error",

      message:
        "Chức năng xóa hình ảnh chưa được triển khai.",
    },
    {
      status:
        501,
    }
  );
}