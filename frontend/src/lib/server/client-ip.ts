import "server-only";
import { headers } from "next/headers";

/**
 * Header X-Forwarded-For gửi kèm request BFF → gateway, để giới hạn tần suất (gateway RateLimitFilter) tính theo máy người
 * dùng chứ không theo máy chạy Next.js. Lấy phần tử đầu của X-Forwarded-For mà Next nhận được (Next tự điền địa chỉ
 * socket khi trình duyệt không gửi; sau reverse proxy thì proxy phải ghi đè header này).
 */
export async function forwardedForHeader(): Promise<Record<string, string>> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? { "X-Forwarded-For": ip } : {};
}
