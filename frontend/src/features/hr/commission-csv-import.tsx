import type { ProductListItem } from "@/features/products/product-types";
import { parseNumber } from "@/lib/format";
import type { CommissionTable } from "./hr-types";

type Item = { productId: string; rateType: "PERCENT" | "AMOUNT"; value: number | null };

/** Tách 1 dòng CSV (dấu phẩy hoặc chấm phẩy, hỗ trợ ô trong ngoặc kép). */
function splitLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (c === sep && !quoted) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Đọc file CSV import hoa hồng: cột "Mã hàng" + mỗi cột tên bảng hoa hồng (giá trị "5%" = 5% doanh thu,
 * "5000" = 5.000đ / đơn vị bán, "x" hoặc "-" = bỏ hoa hồng, trống = giữ nguyên). Mã hàng đối chiếu với danh sách đang tải.
 */
export function parseCommissionCsv(text: string, products: ProductListItem[], tables: CommissionTable[]) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { error: "File không có dữ liệu", batches: [], skipped: [] as string[] };
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const head = splitLine(lines[0], sep).map((h) => h.toLowerCase());
  const codeCol = head.findIndex((h) => h === "mã hàng" || h === "ma hang" || h === "code");
  if (codeCol < 0) return { error: "Thiếu cột \"Mã hàng\"", batches: [], skipped: [] as string[] };
  const cols = tables.map((t) => ({ table: t, col: head.indexOf(t.name.toLowerCase()) })).filter((c) => c.col >= 0);
  if (!cols.length) return { error: "Không có cột nào trùng tên bảng hoa hồng", batches: [], skipped: [] as string[] };
  const byCode = new Map(products.map((p) => [p.code.toUpperCase(), p.id]));
  const items = new Map<string, Item[]>(cols.map((c) => [c.table.id, []]));
  const skipped: string[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, sep);
    const code = (cells[codeCol] ?? "").toUpperCase();
    const productId = byCode.get(code);
    if (!productId) { if (code) skipped.push(code); continue; }
    for (const { table, col } of cols) {
      const raw = (cells[col] ?? "").trim();
      if (!raw) continue;
      const remove = raw === "x" || raw === "-";
      items.get(table.id)!.push({
        productId, rateType: raw.endsWith("%") ? "PERCENT" : "AMOUNT",
        value: remove ? null : parseNumber(raw.replace("%", "")),
      });
    }
  }
  const batches = [...items.entries()].filter(([, v]) => v.length).map(([tableId, v]) => ({ tableId, items: v }));
  return { error: batches.length ? null : "Không có mức hoa hồng nào để import", batches, skipped };
}
