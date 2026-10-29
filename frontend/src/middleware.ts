import { NextResponse, type NextRequest } from "next/server";

/** Trang công khai (chưa đăng nhập): giới thiệu (+ hộp nhập địa chỉ cửa hàng) và màn đăng nhập. */
const PUBLIC = ["/welcome", "/login"];

/** Trang cần đăng nhập nhưng muốn quay lại đúng nó sau khi đăng nhập (giữ ?t= của mã QR chấm công). */
const RETURN_AFTER_LOGIN = ["/cham-cong"];
const RETURN_COOKIE = "vx_after_login";

/**
 * HSTS chỉ khi cookie phiên đang ở chế độ secure (production, COOKIE_SECURE khác "false") và request đi qua https
 * (trực tiếp hoặc reverse proxy báo X-Forwarded-Proto) — triển khai LAN http không bị trình duyệt ép https.
 */
function withHsts(request: NextRequest, res: NextResponse): NextResponse {
  const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  if (secure && https) res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return res;
}

export function middleware(request: NextRequest) {
  return withHsts(request, route(request));
}

/** Chưa có phiên → về trang giới thiệu; đã đăng nhập mà mở trang công khai → vào thẳng trang chủ. Backend vẫn tự kiểm tra quyền. */
function route(request: NextRequest): NextResponse {
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
  // Vừa đăng nhập (về "/" hoặc "/sale") mà trước đó đang mở /cham-cong → quay lại trang đó
  const back = request.cookies.get(RETURN_COOKIE)?.value;
  if (hasSession && back && (pathname === "/" || pathname === "/sale") && RETURN_AFTER_LOGIN.some((p) => back.startsWith(p + "?") || back === p)) {
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
  // Bỏ qua API, file nội bộ Next, service worker, ảnh thương hiệu /brand (màn đăng nhập cần khi chưa có phiên) và danh mục tĩnh /data.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|brand/|data/).*)"],
};
