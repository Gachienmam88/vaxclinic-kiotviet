import { NextResponse, type NextRequest } from "next/server";

/** Trang công khai (chưa đăng nhập): giới thiệu (+ hộp nhập địa chỉ cửa hàng) và màn đăng nhập. */
const PUBLIC = ["/welcome", "/login"];

/** Trang cần đăng nhập nhưng muốn quay lại đúng nó sau khi đăng nhập (giữ ?t= của mã QR chấm công). */
const RETURN_AFTER_LOGIN = ["/cham-cong"];
const RETURN_COOKIE = "vx_after_login";

/** Chưa có phiên → về trang giới thiệu; đã đăng nhập mà mở trang công khai → vào thẳng trang chủ. Backend vẫn tự kiểm tra quyền. */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("vx_refresh");
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC.includes(pathname);
  if (!hasSession && !isPublic) {
    const res = NextResponse.redirect(new URL(RETURN_AFTER_LOGIN.includes(pathname) ? "/welcome?login=1" : "/welcome", request.url));
    if (RETURN_AFTER_LOGIN.includes(pathname)) {
      res.cookies.set(RETURN_COOKIE, pathname + search, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
    }
    return res;
  }
  // Vừa đăng nhập (về "/" hoặc "/pos") mà trước đó đang mở /cham-cong → quay lại trang đó
  const back = request.cookies.get(RETURN_COOKIE)?.value;
  if (hasSession && back && (pathname === "/" || pathname === "/pos") && RETURN_AFTER_LOGIN.some((p) => back.startsWith(p + "?") || back === p)) {
    const res = NextResponse.redirect(new URL(back, request.url));
    res.cookies.delete(RETURN_COOKIE);
    return res;
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Bỏ qua API, file nội bộ Next, service worker và ảnh thương hiệu /brand (màn đăng nhập cần khi chưa có phiên).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|brand/).*)"],
};
