import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, GATEWAY_URL, refreshTokens } from "@/lib/server/session-cookies";

/**
 * BFF proxy: /api/backend/<path> → gateway /api/<path> with the access token attached.
 * On 401 it refreshes once and retries, so the browser never handles tokens.
 */
async function forward(request: NextRequest, path: string[], accessToken?: string) {
  const url = `${GATEWAY_URL}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const hasBody = !["GET", "HEAD"].includes(request.method);
  return fetch(url, {
    method: request.method,
    headers,
    body: hasBody ? await request.clone().arrayBuffer() : undefined,
    cache: "no-store",
  });
}

async function handle(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try {
    let res = await forward(request, path, (await cookies()).get(ACCESS_COOKIE)?.value);
    if (res.status === 401) {
      const tokens = await refreshTokens();
      if (tokens) res = await forward(request, path, tokens.accessToken);
    }
    return new NextResponse(res.status === 204 ? null : await res.arrayBuffer(), {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json(
      { code: "GATEWAY_UNREACHABLE", message: "Không kết nối được máy chủ" },
      { status: 502 },
    );
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
