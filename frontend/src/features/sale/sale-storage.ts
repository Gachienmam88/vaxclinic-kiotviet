/**
 * Lưu trữ cục bộ của máy bán hàng (localStorage). Mọi đọc/ghi đều bọc try/catch:
 * trình duyệt chặn bộ nhớ / đầy bộ nhớ thì màn bán hàng vẫn chạy, chỉ mất khả năng offline.
 */
import { migrateLegacySaleStorage } from "./sale-storage-migration";

let migrated = false;
/** Lần đọc/ghi đầu tiên: chuyển dữ liệu từ khóa cũ (trước khi đổi tên route màn bán hàng) sang khóa "sale.*". */
function ensureMigrated() {
  if (migrated) return;
  migrated = true;
  try { migrateLegacySaleStorage(window.localStorage); } catch { /* không có localStorage */ }
}

export function load<T>(key: string, fallback: T): T {
  ensureMigrated();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  ensureMigrated();
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const KEYS = {
  catalog: (branchId: string) => `sale.catalog.${branchId}`,
  customers: "sale.customers",
  tabs: (userId: string) => `sale.tabs.${userId}`,
  queue: "sale.queue",
  lookups: "sale.lookups", // kênh bán + đối tác giao hàng (bán offline vẫn chọn được)
  settings: "sale.settings", // Thiết lập in + Thiết lập & Hiển thị của máy
};

/** Đường dẫn màn bán hàng (một chỗ duy nhất — đổi tên route chỉ sửa ở đây). */
export const SALE_ROUTE = "/sale";

/** Lỗi mạng (không tới được server) → cho bán offline. Lỗi nghiệp vụ (400...) → báo người dùng. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true; // fetch failed: mất mạng / server Next không chạy
  const status = (e as { status?: number })?.status;
  return status === 502 || status === 503 || status === 504;
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
