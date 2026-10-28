/**
 * Tính thuế hộ kinh doanh (phương pháp kê khai từ 01/01/2026) — số liệu ƯỚC TÍNH để đối chiếu, kế toán xác nhận trước khi nộp.
 * Nguồn tỷ lệ: Luật Thuế GTGT, TNCN sửa đổi (tổng hợp của MISA/Thư viện Pháp luật, cần đối chiếu văn bản gốc).
 * - Nhóm 1 (doanh thu năm ≤ 1 tỷ): không phải nộp GTGT, TNCN.
 * - GTGT = doanh thu hàng/dịch vụ chịu thuế × tỷ lệ % theo ngành (hàng KCT không tính).
 * - TNCN theo doanh thu = (doanh thu năm − 1 tỷ) × tỷ lệ % theo ngành; tính lũy kế từ đầu năm cho từng kỳ.
 * - TNCN theo thu nhập = (doanh thu − giá vốn − chi phí) × 15% / 17% / 20% theo nhóm 2 / 3 / 4.
 */
export const THRESHOLD = 1_000_000_000;

export const SECTORS: Record<string, { label: string; vat: number; pit: number }> = {
  PHAN_PHOI: { label: "Phân phối, cung cấp hàng hóa", vat: 1, pit: 0.5 },
  SAN_XUAT: { label: "Sản xuất, vận tải, dịch vụ có gắn với hàng hóa", vat: 3, pit: 1.5 },
  DICH_VU: { label: "Dịch vụ, xây dựng không bao thầu nguyên vật liệu", vat: 5, pit: 2 },
  CHO_THUE: { label: "Cho thuê tài sản, đại lý, nội dung số", vat: 5, pit: 5 },
  KHAC: { label: "Hoạt động kinh doanh khác", vat: 2, pit: 1 },
};

export const GROUPS: Record<number, string> = {
  1: "Nhóm 1: Từ 1 tỷ trở xuống", 2: "Nhóm 2: Trên 1 tỷ - 3 tỷ", 3: "Nhóm 3: Trên 3 tỷ - 50 tỷ", 4: "Nhóm 4: Trên 50 tỷ",
};

export const PROFIT_RATE: Record<number, number> = { 1: 0, 2: 15, 3: 17, 4: 20 };

/** Mã thuế dòng hàng không chịu GTGT: KCT, KKKNT, HKD_KCT_* (VD "KCT GTGT, 1,5% TNCN"). */
export const isVatExempt = (code: string) => code === "KCT" || code === "KKKNT" || code.startsWith("HKD_KCT");

export type DailyRevenue = { date: string; taxCode: string; sales: number; returns: number; cogs: number; invoiceCount: number };
export type DailyExpense = { date: string; category: string; amount: number };
export type TaxConfig = { vatEnabled: boolean; vatRate: number; pitRate: number; defaultTaxCode: string | null };
export type ProfileConfig = { revenueGroup: number; pitMethod: "REVENUE" | "PROFIT" };
export type Period = { label: string; from: string; to: string };

export type PeriodTax = Period & {
  revenue: number; vatRevenue: number; exemptRevenue: number; cogs: number; expenses: number;
  cumulative: number; vat: number; pitBase: number; pit: number;
};

/** Các kỳ trong năm: 12 tháng hoặc 4 quý (ngày dạng yyyy-MM-dd). */
export function periodsOf(year: number, kind: "MONTH" | "QUARTER"): Period[] {
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const last = (m: number) => new Date(year, m, 0).getDate();
  if (kind === "MONTH") return Array.from({ length: 12 }, (_, i) => ({ label: `Tháng ${i + 1}`, from: iso(year, i + 1, 1), to: iso(year, i + 1, last(i + 1)) }));
  return [1, 2, 3, 4].map((q) => ({ label: `Quý ${q}`, from: iso(year, q * 3 - 2, 1), to: iso(year, q * 3, last(q * 3)) }));
}

/** Doanh thu thuần 1 dòng số liệu, mã thuế trống → mã mặc định trong thiết lập. */
export const netOf = (r: DailyRevenue) => Number(r.sales) - Number(r.returns);
export const exemptOf = (r: DailyRevenue, cfg: TaxConfig) => isVatExempt(r.taxCode || cfg.defaultTaxCode || "");

/** Tính thuế từng kỳ; rows/expenses phải gồm cả năm (từ 01/01) để tính lũy kế TNCN đúng. */
export function computeTax(rows: DailyRevenue[], expenses: DailyExpense[], periods: Period[], cfg: TaxConfig,
                           profile: ProfileConfig): PeriodTax[] {
  const yearStart = periods[0]?.from.slice(0, 4) + "-01-01";
  const sumUntil = (date: string) => rows.filter((r) => r.date >= yearStart && r.date < date).reduce((s, r) => s + netOf(r), 0);
  return periods.map((p) => {
    const inP = rows.filter((r) => r.date >= p.from && r.date <= p.to);
    const revenue = inP.reduce((s, r) => s + netOf(r), 0);
    const exemptRevenue = inP.filter((r) => exemptOf(r, cfg)).reduce((s, r) => s + netOf(r), 0);
    const vatRevenue = revenue - exemptRevenue;
    const cogs = inP.reduce((s, r) => s + Number(r.cogs), 0);
    const expenses = expensesOf(expenses, p);
    const before = sumUntil(p.from);
    const cumulative = before + revenue;
    const taxable = profile.revenueGroup > 1 && cfg.vatEnabled;
    const vat = taxable ? Math.round(vatRevenue * cfg.vatRate / 100) : 0;
    let pitBase = 0, pit = 0;
    if (profile.revenueGroup > 1) {
      if (profile.pitMethod === "REVENUE") {
        pitBase = Math.max(0, cumulative - THRESHOLD) - Math.max(0, before - THRESHOLD);
        pit = Math.round(pitBase * cfg.pitRate / 100);
      } else {
        pitBase = Math.max(0, revenue - cogs - expenses);
        pit = Math.round(pitBase * PROFIT_RATE[profile.revenueGroup] / 100);
      }
    }
    return { ...p, revenue, vatRevenue, exemptRevenue, cogs, expenses, cumulative, vat, pitBase, pit };
  });
}

const expensesOf = (list: DailyExpense[], p: Period) =>
  list.filter((e) => e.date >= p.from && e.date <= p.to).reduce((s, e) => s + Number(e.amount), 0);

/** Xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt); chặn công thức Excel ở đầu ô. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
