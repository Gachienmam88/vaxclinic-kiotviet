/** Browser-side API helper. Calls the BFF proxy and normalises errors to ApiRequestError. */

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
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details.length ? error.details.map((d) => d.message).join("; ") : error.message;
  }
  return "Có lỗi xảy ra";
}
