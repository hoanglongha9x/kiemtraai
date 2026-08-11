import {
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      status: "error",
      message:
        "Route upload ảnh cũ không còn được sử dụng.",
    },
    {
      status: 410,
    }
  );
}