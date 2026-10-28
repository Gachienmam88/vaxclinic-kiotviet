import { NextResponse } from "next/server";
import { GATEWAY_URL, saveTokens, type TokenPair } from "@/lib/server/session-cookies";

/** POST {username, password} → gateway login → tokens stored as httpOnly cookies. */
export async function POST(request: Request) {
  const body = await request.text();
  try {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    if (!res.ok) {
      return new NextResponse(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    await saveTokens((await res.json()) as TokenPair);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { code: "GATEWAY_UNREACHABLE", message: "Không kết nối được máy chủ" },
      { status: 502 },
    );
  }
}
