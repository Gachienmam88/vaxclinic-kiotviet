/**
 * Hàm thuần cho danh mục đơn vị hành chính (không import alias để chạy được bằng node test):
 * bỏ dấu tiếng Việt, tìm kiếm không dấu, ghép địa chỉ "số nhà/đường, Phường/Xã, Tỉnh/Thành phố".
 */

/** 1 đơn vị hành chính: tỉnh/thành phố (mã 2 số) hoặc phường/xã/đặc khu (mã 5 số, có provinceCode). */
export type VnUnit = { code: string; name: string; type: string; provinceCode?: string };

/** Chữ thường, bỏ dấu (kể cả đ → d), gộp khoảng trắng; dấu nháy cong ’ coi như '. */
export function foldVietnamese(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").replace(/[’‘]/g, "'")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/** Tên rút gọn bỏ tiền tố loại đơn vị ("Phường Bến Thành" → "Bến Thành") để ưu tiên khớp đầu tên. */
const shortName = (u: VnUnit) => (u.name.startsWith(u.type + " ") ? u.name.slice(u.type.length + 1) : u.name);

/**
 * Lọc theo chuỗi tìm (không phân biệt dấu / hoa thường, mọi từ đều phải có mặt), khớp cả mã.
 * Thứ tự: khớp đầu tên rút gọn trước, rồi giữ thứ tự gốc của danh mục.
 */
export function searchUnits<T extends VnUnit>(units: T[], query: string, limit = 100): T[] {
  const q = foldVietnamese(query);
  if (!q) return units.slice(0, limit);
  const words = q.split(" ");
  const starts: T[] = [];
  const others: T[] = [];
  for (const u of units) {
    const hay = foldVietnamese(u.name) + " " + u.code;
    if (!words.every((w) => hay.includes(w))) continue;
    (foldVietnamese(shortName(u)).startsWith(q) || u.code === q ? starts : others).push(u);
  }
  return [...starts, ...others].slice(0, limit);
}

/** Ghép địa chỉ hiển thị / in: bỏ phần trống. */
export function joinAddress(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(", ");
}

/** Định dạng mã (chỉ kiểm tra hình thức, giống backend): tỉnh 2 số, phường/xã 5 số. */
export const isProvinceCode = (c: string) => /^\d{2}$/.test(c);
export const isWardCode = (c: string) => /^\d{5}$/.test(c);
