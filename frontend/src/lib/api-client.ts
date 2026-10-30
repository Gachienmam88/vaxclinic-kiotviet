/** Browser-side API helper. Calls the BFF proxy and normalises errors to ApiRequestError. */
import { genericErrorText, translateApiError, translateValidationDetails } from "@/lib/i18n/translate-api-error";

export type FieldViolation = { field: string; message: string };

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: FieldViolation[] = [],
  ) {
    super(message);
  }
}

export type PageResponse<T> = { items: T[]; total: number; page: number; size: number };

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login"; // session expired and refresh failed
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiRequestError(res.status, err.code ?? "UNKNOWN", err.message ?? "Có lỗi xảy ra", err.details);
  }
  if (res.status === 204) return undefined as T;
  // Endpoint void của Spring trả 200 với thân rỗng (VD PUT ánh xạ hàng, PATCH gắn phiếu) → không parse JSON
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Câu lỗi để hiện toast: giao diện khác tiếng Việt thì dịch theo error.code (namespace "errors"), không có thì giữ message server. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.details.length) return translateValidationDetails(error.details.map((d) => d.message).join("; "));
    return error.message ? translateApiError(error.code, error.message) : genericErrorText();
  }
  return genericErrorText();
}
