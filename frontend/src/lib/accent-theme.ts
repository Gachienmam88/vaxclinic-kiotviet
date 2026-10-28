/**
 * Màu chủ đề (KiotViet "Chủ đề"): 9 màu, chọn theo từng người dùng, lưu localStorage trên máy
 * (backend chưa có API lưu tuỳ chọn người dùng).
 * Như KiotViet chỉ tô khung ứng dụng: đặt biến --chrome trên <html> (thanh menu, nút "Bán hàng", avatar, thanh trên +
 * nút THANH TOÁN màn bán hàng — các lớp bg-chrome / text-chrome / bg-chrome-active trong app/globals.css).
 * Nội dung trang (--primary: bảng, nút, liên kết…) luôn giữ xanh mặc định.
 */

export type Accent = { id: string; hex: string; label: string };

/** Thứ tự ô 3×3 theo ảnh KiotViet (đọc từ trái sang phải, trên xuống dưới). */
export const ACCENTS: Accent[] = [
  { id: "blue", hex: "#0070f4", label: "Xanh dương" },
  { id: "slate", hex: "#4b6580", label: "Xanh đá" },
  { id: "green", hex: "#27ae61", label: "Xanh lá" },
  { id: "purple", hex: "#9b59b6", label: "Tím" },
  { id: "red", hex: "#d64457", label: "Đỏ" },
  { id: "sage", hex: "#6e9992", label: "Xanh xám" },
  { id: "teal", hex: "#16a085", label: "Xanh ngọc" },
  { id: "orange", hex: "#e67e22", label: "Cam" },
  { id: "pink", hex: "#d73b8c", label: "Hồng" },
];

export const DEFAULT_ACCENT = ACCENTS[0];

/** Người dùng đăng nhập gần nhất trên máy — script trước khi vẽ trang dùng để chọn đúng màu. */
const LAST_USER_KEY = "kv-accent-user";
const keyFor = (userId: string) => `kv-accent:${userId}`;

/** Màu đã lưu của người dùng; chưa chọn / dữ liệu lạ → màu mặc định. */
export function readAccent(userId: string): Accent {
  try {
    const hex = localStorage.getItem(keyFor(userId));
    return ACCENTS.find((a) => a.hex === hex) ?? DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/** Gắn màu khung lên <html>; màu mặc định thì bỏ biến để dùng giá trị trong globals.css. */
export function applyAccent(accent: Accent) {
  const style = document.documentElement.style;
  if (accent.hex === DEFAULT_ACCENT.hex) style.removeProperty("--chrome");
  else style.setProperty("--chrome", accent.hex);
}

/** Lưu màu cho người dùng + nhớ người dùng hiện tại (cho lần tải trang sau). */
export function saveAccent(userId: string, accent: Accent) {
  try {
    localStorage.setItem(keyFor(userId), accent.hex);
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // localStorage bị chặn (chế độ riêng tư…) → vẫn đổi màu trong phiên hiện tại
  }
}

/** Đồng bộ khi biết người dùng đăng nhập: áp màu của họ và ghi nhớ họ là người dùng gần nhất. */
export function syncAccentForUser(userId: string) {
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // bỏ qua: chỉ ảnh hưởng tới việc áp màu sớm ở lần tải sau
  }
  applyAccent(readAccent(userId));
}

/**
 * Script nhúng trong <head> (chạy trước khi vẽ) để không bị nháy màu xanh mặc định.
 * Trang đăng nhập / chào mừng (trước khi chọn chủ đề) luôn giữ màu mặc định.
 */
export const ACCENT_BOOT_SCRIPT =
  `(function(){try{if(/^\\/(login|welcome)(\\/|$)/.test(location.pathname))return;var s=localStorage,` +
  `u=s.getItem("${LAST_USER_KEY}"),h=u&&s.getItem("kv-accent:"+u);` +
  `if(h&&/^#[0-9a-f]{6}$/i.test(h))document.documentElement.style.setProperty("--chrome",h)}catch(e){}})()`;
