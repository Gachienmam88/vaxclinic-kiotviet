/**
 * Chuyển dữ liệu localStorage của màn bán hàng từ khóa cũ (trước khi đổi tên route /pos → /sale) sang khóa mới "sale.*".
 * Khóa cũ: <LEGACY_PREFIX>catalog.<branch>, customers, tabs.<user>, queue, lookups, settings → "sale." + phần đuôi giống hệt.
 * - Khóa mới chưa có → chép giá trị cũ sang.
 * - Hàng đợi offline (queue) mà cả hai đều có → gộp theo id (KHÔNG được mất phiếu chưa đồng bộ).
 * - Chỉ xóa khóa cũ khi đã ghi khóa mới thành công. Mọi lỗi bộ nhớ đều nuốt: lần mở sau sẽ thử lại.
 * File thuần (không import) để chạy được trong node test.
 */

/** Tiền tố khóa cũ — chỗ duy nhất còn chuỗi này, chỉ để đọc dữ liệu cũ. */
export const LEGACY_PREFIX = "pos.";
export const SALE_PREFIX = "sale.";
const OWNED = /^(catalog\.|tabs\.|customers$|queue$|lookups$|settings$)/;

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function mergeQueues(current: string, legacy: string): string | null {
  try {
    const a = JSON.parse(current) as { id?: string }[];
    const b = JSON.parse(legacy) as { id?: string }[];
    if (!Array.isArray(a) || !Array.isArray(b)) return null;
    const ids = new Set(a.map((x) => x?.id));
    return JSON.stringify([...a, ...b.filter((x) => !ids.has(x?.id))]);
  } catch {
    return null; // dữ liệu hỏng: giữ nguyên khóa cũ, không xóa
  }
}

/** Trả về số khóa đã chuyển. Gọi nhiều lần vô hại. */
export function migrateLegacySaleStorage(storage: KeyValueStorage): number {
  let moved = 0;
  try {
    const legacyKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(LEGACY_PREFIX) && OWNED.test(k.slice(LEGACY_PREFIX.length))) legacyKeys.push(k);
    }
    for (const oldKey of legacyKeys) {
      try {
        const oldValue = storage.getItem(oldKey);
        if (oldValue === null) continue;
        const newKey = SALE_PREFIX + oldKey.slice(LEGACY_PREFIX.length);
        const current = storage.getItem(newKey);
        let next: string | null = oldValue;
        if (current !== null) next = newKey === SALE_PREFIX + "queue" ? mergeQueues(current, oldValue) : current;
        if (next === null) continue;
        if (next !== current) storage.setItem(newKey, next);
        storage.removeItem(oldKey);
        moved++;
      } catch {
        /* đầy bộ nhớ / bị chặn: để nguyên khóa cũ, lần sau thử lại */
      }
    }
  } catch {
    /* không truy cập được localStorage */
  }
  return moved;
}
