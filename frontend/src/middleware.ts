import { NextResponse, type NextRequest } from "next/server";

/** Redirect to /login when there is no session cookie. Real auth is enforced by the backend. */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("vx_refresh");
  const isLogin = request.nextUrl.pathname === "/login";
  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)"],
};
