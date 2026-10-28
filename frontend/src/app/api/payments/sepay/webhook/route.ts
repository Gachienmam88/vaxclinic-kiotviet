import { NextResponse, type NextRequest } from "next/server";
import { GATEWAY_URL } from "@/lib/server/session-cookies";

/**
 * Webhook SePay: https://<tên miền>/api/payments/sepay/webhook → gateway (công khai cho đúng 1 đường này).
 * Chuyển nguyên header Authorization (Apikey ...) để integration-service tự xác thực; không dùng cookie đăng nhập.
 */
export async function POST(request: NextRequest) {
  const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);
  try {
    const res = await fetch(`${GATEWAY_URL}/api/payments/sepay/webhook`, {
      method: "POST", headers, body: await request.arrayBuffer(), cache: "no-store",
    });
    return new NextResponse(await res.arrayBuffer(), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ success: false }, { status: 502 });
  }
}
