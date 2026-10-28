/**
 * Tính thuế hộ kinh doanh (phương pháp kê khai từ 01/01/2026) — số liệu ƯỚC TÍNH để đối chiếu, kế toán xác nhận trước khi nộp.
 * Nguồn tỷ lệ: Luật Thuế GTGT, TNCN sửa đổi (tổng hợp của MISA/Thư viện Pháp luật, cần đối chiếu văn bản gốc).
 * - Nhóm 1 (doanh thu năm ≤ 1 tỷ): không phải nộp GTGT, TNCN.
 * - Mỗi mặt hàng thuộc 1 ngành nghề (qua nhóm hàng); mỗi ngành có tỷ lệ % GTGT, TNCN riêng do cửa hàng khai.
 * - GTGT = Σ doanh thu chịu thuế của ngành × tỷ lệ GTGT của ngành (hàng KCT không tính).
 * - TNCN theo doanh thu = (doanh thu năm − 1 tỷ) × tỷ lệ; nhiều ngành → phần 1 tỷ được trừ chia theo tỷ trọng doanh thu
 *   từng ngành trong kỳ (giả định — kế toán xác nhận). Tính lũy kế từ đầu năm cho từng kỳ.
 * - TNCN theo thu nhập = (doanh thu − giá vốn − chi phí) × 15% / 17% / 20% theo nhóm 2 / 3 / 4 (tính chung, không theo ngành).
 */
export const THRESHOLD = 1_000_000_000;

export const PROFIT_RATE: Record<number, number> = { 1: 0, 2: 15, 3: 17, 4: 20 };

/** Mã thuế dòng hàng không chịu GTGT: KCT, KKKNT, HKD_KCT_* (VD "KCT GTGT, 1,5% TNCN"). */
export const isVatExempt = (code: string) => code === "KCT" || code === "KKKNT" || code.startsWith("HKD_KCT");

export type Sector = { code: string; name: string; vatRate: number; pitRate: number };
export type DailyRevenue = { date: string; productId: string; taxCode: string; sales: number; returns: number; cogs: number; invoiceCount: number };
export type DailyExpense = { date: string; category: string; amount: number };
/** sectorOf: mặt hàng → mã ngành (đã xét nhóm hàng, nhóm cha, ngành mặc định). */
export type TaxConfig = { vatEnabled: boolean; sectors: Sector[]; sectorOf: (productId: string) => string; defaultTaxCode: string | null };
export type ProfileConfig = { revenueGroup: number; pitMethod: "REVENUE" | "PROFIT" };
/** label: "Tháng 3" / "Quý 2" — tiếng Việt cố định (dùng trong sổ kế toán & CSV kê khai); giao diện dùng periodLabel(). */
export type Period = { label: string; from: string; to: string };

export type SectorTax = { sector: Sector; revenue: number; vatRevenue: number; exemptRevenue: number; vat: number; pitBase: number; pit: number };
export type PeriodTax = Period & {
  revenue: number; vatRevenue: number; exemptRevenue: number; cogs: number; expenses: number;
  cumulative: number; vat: number; pitBase: number; pit: number; bySector: SectorTax[];
};

/** Các kỳ trong năm: 12 tháng hoặc 4 quý (ngày dạng yyyy-MM-dd). */
export function periodsOf(year: number, kind: "MONTH" | "QUARTER"): Period[] {
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const last = (m: number) => new Date(year, m, 0).getDate();
  if (kind === "MONTH") return Array.from({ length: 12 }, (_, i) => ({ label: `Tháng ${i + 1}`, from: iso(year, i + 1, 1), to: iso(year, i + 1, last(i + 1)) }));
  return [1, 2, 3, 4].map((q) => ({ label: `Quý ${q}`, from: iso(year, q * 3 - 2, 1), to: iso(year, q * 3, last(q * 3)) }));
}

/**
 * Ngành nghề của mặt hàng: nhóm hàng của nó → nhóm cha gần nhất có gắn ngành → ngành mặc định.
 * categoryOf: mặt hàng → nhóm hàng; parentOf: nhóm → nhóm cha.
 */
export function sectorResolver(categoryOf: Map<string, string | null>, parentOf: Map<string, string | null>,
                               categorySectors: Record<string, string>, defaultSector: string) {
  return (productId: string) => {
    let cat = categoryOf.get(productId) ?? null;
    for (let depth = 0; cat && depth < 20; depth++) {
      if (categorySectors[cat]) return categorySectors[cat];
      cat = parentOf.get(cat) ?? null;
    }
    return defaultSector;
  };
}

/** Doanh thu thuần 1 dòng số liệu, mã thuế trống → mã mặc định trong thiết lập. */
export const netOf = (r: DailyRevenue) => Number(r.sales) - Number(r.returns);
export const exemptOf = (r: DailyRevenue, cfg: TaxConfig) => isVatExempt(r.taxCode || cfg.defaultTaxCode || "");

/** Tính thuế từng kỳ; rows/expenses phải gồm cả năm (từ 01/01) để tính lũy kế TNCN đúng. */
export function computeTax(rows: DailyRevenue[], expenseRows: DailyExpense[], periods: Period[], cfg: TaxConfig,
                           profile: ProfileConfig): PeriodTax[] {
  const yearStart = periods[0]?.from.slice(0, 4) + "-01-01";
  const sumUntil = (date: string) => rows.filter((r) => r.date >= yearStart && r.date < date).reduce((s, r) => s + netOf(r), 0);
  const taxable = profile.revenueGroup > 1;
  return periods.map((p) => {
    const inP = rows.filter((r) => r.date >= p.from && r.date <= p.to);
    const revenue = inP.reduce((s, r) => s + netOf(r), 0);
    const cogs = inP.reduce((s, r) => s + Number(r.cogs), 0);
    const expenses = expenseRows.filter((e) => e.date >= p.from && e.date <= p.to).reduce((s, e) => s + Number(e.amount), 0);
    const before = sumUntil(p.from);
    const cumulative = before + revenue;
    // Phần doanh thu kỳ này vượt ngưỡng 1 tỷ (lũy kế năm) — chỉ dùng cho TNCN theo doanh thu
    const excess = Math.max(0, cumulative - THRESHOLD) - Math.max(0, before - THRESHOLD);
    const bySector = cfg.sectors.map((sector) => {
      const own = inP.filter((r) => cfg.sectorOf(r.productId) === sector.code);
      const sRevenue = own.reduce((s, r) => s + netOf(r), 0);
      const exempt = own.filter((r) => exemptOf(r, cfg)).reduce((s, r) => s + netOf(r), 0);
      const vat = taxable && cfg.vatEnabled ? Math.round((sRevenue - exempt) * Number(sector.vatRate) / 100) : 0;
      const pitBase = taxable && profile.pitMethod === "REVENUE" && revenue > 0 ? Math.round(excess * sRevenue / revenue) : 0;
      const pit = Math.round(pitBase * Number(sector.pitRate) / 100);
      return { sector, revenue: sRevenue, vatRevenue: sRevenue - exempt, exemptRevenue: exempt, vat, pitBase, pit };
    }).filter((s) => s.revenue !== 0);
    const sum = (k: "vatRevenue" | "exemptRevenue" | "vat" | "pitBase" | "pit") => bySector.reduce((s, x) => s + x[k], 0);
    let pitBase = sum("pitBase"), pit = sum("pit");
    if (taxable && profile.pitMethod === "PROFIT") {
      pitBase = Math.max(0, revenue - cogs - expenses);
      pit = Math.round(pitBase * PROFIT_RATE[profile.revenueGroup] / 100);
    }
    return { ...p, revenue, vatRevenue: sum("vatRevenue"), exemptRevenue: sum("exemptRevenue"), cogs, expenses, cumulative,
      vat: sum("vat"), pitBase, pit, bySector };
  });
}

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
