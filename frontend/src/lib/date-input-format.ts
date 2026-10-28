/**
 * Chuyển đổi ngày/giờ cho các ô chọn ngày kiểu KiotViet.
 * Hiển thị luôn theo kiểu Việt Nam (dd/MM/yyyy, dd/MM/yyyy HH:mm, HH:mm 24h) bất kể ngôn ngữ trình duyệt,
 * còn giá trị trả ra giữ đúng định dạng của input gốc: "yyyy-MM-dd", "yyyy-MM-ddTHH:mm" (giờ địa phương), "HH:mm".
 */

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Thứ trong tuần, tuần bắt đầu từ Thứ 2. */
export const WEEKDAYS_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

export const DATE_MASK = "xx/xx/xxxx";
export const DATETIME_MASK = "xx/xx/xxxx xx:xx";
export const TIME_MASK = "xx:xx";

/** Date → "yyyy-MM-dd" theo giờ địa phương. */
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const isValidYmd = (y: number, m: number, d: number) => {
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
};

const isValidHm = (h: number, m: number) => h >= 0 && h <= 23 && m >= 0 && m <= 59;

/** "yyyy-MM-dd" (cho phép đuôi giờ phía sau) → Date 00:00 giờ địa phương, sai → null. */
export function parseYmd(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  if (!m || !isValidYmd(+m[1], +m[2], +m[3])) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

/** "2026-10-28" → "28/10/2026"; rỗng/sai → "". */
export function ymdToDisplay(ymd: string | null | undefined): string {
  const d = parseYmd(ymd);
  return d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` : "";
}

/** "28/10/2026" (cho phép "1/2/2026") → "2026-10-28"; sai → null. */
export function displayToYmd(text: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (!m || !isValidYmd(+m[3], +m[2], +m[1])) return null;
  return `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}`;
}

/** "9:05" | "09:05:00" → "09:05"; sai → null. */
export function normalizeHm(text: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*$/.exec(text ?? "");
  if (!m || !isValidHm(+m[1], +m[2])) return null;
  return `${pad2(+m[1])}:${m[2]}`;
}

/**
 * Giá trị ngày giờ → "yyyy-MM-ddTHH:mm" giờ địa phương.
 * Nhận "yyyy-MM-ddTHH:mm[:ss]" (datetime-local) hoặc ISO có múi giờ ("...Z", "+07:00").
 */
export function toLocalDateTime(value: string | null | undefined): string | null {
  const v = value ?? "";
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return `${toYmd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(v);
  if (!m || !parseYmd(m[1]) || !normalizeHm(m[2])) return null;
  return `${m[1]}T${m[2]}`;
}

/** "2026-10-28T22:28" → "28/10/2026 22:28"; rỗng/sai → "". */
export function dateTimeToDisplay(value: string | null | undefined): string {
  const local = toLocalDateTime(value);
  return local ? `${ymdToDisplay(local.slice(0, 10))} ${local.slice(11, 16)}` : "";
}

/** "28/10/2026 22:28" → "2026-10-28T22:28"; sai → null. */
export function displayToDateTime(text: string): string | null {
  const m = /^\s*(\S+)\s+(\S+)\s*$/.exec(text);
  if (!m) return null;
  const ymd = displayToYmd(m[1]);
  const hm = normalizeHm(m[2]);
  return ymd && hm ? `${ymd}T${hm}` : null;
}

/**
 * Định dạng chuỗi đang gõ theo mặt nạ ("xx/xx/xxxx xx:xx"): chèn dấu phân cách trước chữ số kế tiếp
 * (không tự thêm ở cuối để Backspace xóa được). Gõ dấu phân cách sớm sẽ đệm 0 cho nhóm 2 chữ số: "1/" → "01".
 */
export function applyMask(raw: string, mask: string): string {
  const sizes = mask.split(/[^x]+/).map((s) => s.length);
  const seps = mask.match(/[^x]+/g) ?? [];
  let out = "";
  let cur = "";
  let seg = 0;
  const close = () => { out += cur; cur = ""; seg++; };
  for (const ch of raw) {
    if (seg >= sizes.length) break;
    if (/\d/.test(ch)) {
      if (cur === "" && seg > 0 && !out.endsWith(seps[seg - 1])) out += seps[seg - 1];
      cur += ch;
      if (cur.length === sizes[seg]) close();
    } else if (/[/:.\-\s]/.test(ch) && cur && sizes[seg] === 2) {
      cur = cur.padStart(2, "0");
      close();
    }
  }
  return out + cur;
}

/** 42 ngày (6 tuần, bắt đầu Thứ 2) phủ tháng `month` (0-11) của năm `year`. */
export function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - lead + i));
}

/** Cộng `n` ngày vào "yyyy-MM-dd". */
export function addDaysYmd(ymd: string, n: number): string {
  const d = parseYmd(ymd) ?? new Date();
  return toYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Cộng `n` tháng, giữ ngày trong giới hạn tháng mới (31/01 + 1 tháng → 28/02). */
export function addMonthsYmd(ymd: string, n: number): string {
  const d = parseYmd(ymd) ?? new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return toYmd(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)));
}

/** Ngày nằm trong [min, max] (so chuỗi "yyyy-MM-dd"). */
export const ymdInRange = (ymd: string, min?: string, max?: string) =>
  (!min || ymd >= min) && (!max || ymd <= max);
