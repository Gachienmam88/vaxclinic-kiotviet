import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearTokens, GATEWAY_URL, REFRESH_COOKIE } from "@/lib/server/session-cookies";

/** Revoke the refresh token on the server (best effort) and clear cookies. */
export async function POST() {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${GATEWAY_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearTokens();
  return NextResponse.json({ ok: true });
}
