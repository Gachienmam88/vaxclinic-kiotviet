import { NextResponse, type NextRequest } from "next/server";

/** Trang công khai (chưa đăng nhập): giới thiệu (+ hộp nhập địa chỉ cửa hàng) và màn đăng nhập. */
const PUBLIC = ["/welcome", "/login"];

/** Chưa có phiên → về trang giới thiệu; đã đăng nhập mà mở trang công khai → vào thẳng trang chủ. Backend vẫn tự kiểm tra quyền. */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("vx_refresh");
  const isPublic = PUBLIC.includes(request.nextUrl.pathname);
  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)"],
};
