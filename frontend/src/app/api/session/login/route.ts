import { NextResponse } from "next/server";
import { forwardedForHeader } from "@/lib/server/client-ip";
import { GATEWAY_URL, saveTokens, type TokenPair } from "@/lib/server/session-cookies";

/** POST {username, password, remember} → gateway login → tokens stored as httpOnly cookies. */
export async function POST(request: Request) {
  const { remember = true, ...credentials } = (await request.json().catch(() => ({}))) as { remember?: boolean; username?: string; password?: string };
  const body = JSON.stringify(credentials);
  try {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await forwardedForHeader()) },
      body,
      cache: "no-store",
    });
    if (!res.ok) {
      return new NextResponse(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json", ...retryAfter(res) },
      });
    }
    await saveTokens((await res.json()) as TokenPair, remember !== false);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { code: "GATEWAY_UNREACHABLE", message: "Không kết nối được máy chủ" },
      { status: 502 },
    );
  }
}

/** Giữ Retry-After của 429 (gateway giới hạn tần suất). */
function retryAfter(res: Response): Record<string, string> {
  const v = res.headers.get("retry-after");
  return v ? { "Retry-After": v } : {};
}
