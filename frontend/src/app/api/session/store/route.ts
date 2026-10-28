import { NextResponse, type NextRequest } from "next/server";
import { GATEWAY_URL } from "@/lib/server/session-cookies";

/** Bước 1 đăng nhập: kiểm tra "địa chỉ truy cập cửa hàng" (công khai) → tên + logo cửa hàng. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  try {
    const res = await fetch(`${GATEWAY_URL}/api/auth/store?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    return new NextResponse(await res.arrayBuffer(), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ code: "GATEWAY_UNREACHABLE", message: "Không kết nối được máy chủ" }, { status: 502 });
  }
}
