/** Định dạng số/tiền/ngày kiểu Việt Nam dùng chung toàn app. */

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 3590000 → "3,590,000" (tiền VNĐ không lẻ). */
export const formatMoney = (v: number | string | null | undefined) =>
  v == null || v === "" ? "" : integer.format(Number(v));

/** Số lượng / giá vốn có thể lẻ: 3288721.04 → "3,288,721.04". */
export const formatNumber = (v: number | string | null | undefined) =>
  v == null || v === "" ? "" : decimal.format(Number(v));

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

export const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";

/** Parse "3,590,000" do người dùng gõ → 3590000. */
export const parseNumber = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
