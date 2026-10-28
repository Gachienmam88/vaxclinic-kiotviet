import "server-only";
import { cookies } from "next/headers";

/**
 * JWTs never reach browser JavaScript: they live in httpOnly cookies and the
 * Next.js route handlers (BFF) attach them when calling the API gateway.
 */
export const ACCESS_COOKIE = "vx_access";
export const REFRESH_COOKIE = "vx_refresh";
/** "Duy trì đăng nhập": 1 = giữ phiên 7 ngày; 0 = phiên kết thúc khi đóng trình duyệt. */
const PERSIST_COOKIE = "vx_persist";
const REFRESH_MAX_AGE = 7 * 24 * 3600;

export const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

export async function saveTokens(tokens: TokenPair, persist?: boolean) {
  const jar = await cookies();
  // Khi làm mới phiên (persist không truyền) giữ nguyên lựa chọn lúc đăng nhập
  const keep = persist ?? jar.get(PERSIST_COOKIE)?.value !== "0";
  // Secure cookies need HTTPS (localhost is exempt in browsers). For an internal LAN server reached via
  // plain http://192.168.x.x set COOKIE_SECURE=false — or better, put HTTPS in front.
  const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: tokens.expiresIn,
  });
  // Không có maxAge = cookie phiên: trình duyệt xóa khi đóng
  jar.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true, sameSite: "lax", secure, path: "/", ...(keep ? { maxAge: REFRESH_MAX_AGE } : {}),
  });
  jar.set(PERSIST_COOKIE, keep ? "1" : "0", {
    httpOnly: true, sameSite: "lax", secure, path: "/", ...(keep ? { maxAge: REFRESH_MAX_AGE } : {}),
  });
}

export async function clearTokens() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(PERSIST_COOKIE);
}

/** Exchange the refresh cookie for a new token pair; returns null when the session is over. */
export async function refreshTokens(): Promise<TokenPair | null> {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const res = await fetch(`${GATEWAY_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as TokenPair;
  await saveTokens(tokens);
  return tokens;
}
