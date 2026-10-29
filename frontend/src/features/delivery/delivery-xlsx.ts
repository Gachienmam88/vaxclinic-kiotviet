/**
 * Ghi file Excel (.xlsx) cho các danh sách giao hàng: dòng tiêu đề có lọc, cột tiền "#,##0", ô chữ bắt đầu bằng = + - @ thêm dấu '
 * (chặn công thức). Tên file theo kiểu KiotViet: Ten_KVddMMyyyy-HHmmss-SSS.xlsx.
 */
type Cell = string | number | null | undefined;

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const safe = (v: Cell) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v ?? null);

export function xlsxName(base: string, d = new Date()) {
  return `${base}_KV${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}-${pad(d.getHours())}${pad(d.getMinutes())}`
    + `${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}.xlsx`;
}

/** Dựng file (cho hàng đợi "Xuất file" chạy nền): money[i] = true → cột i là tiền. */
export async function buildXlsx(base: string, header: string[], rows: Cell[][], money: boolean[]): Promise<{ name: string; blob: Blob }> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows.map((r) => r.map(safe))]);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  ws["!autofilter"] = { ref: ws["!ref"] ?? "A1" };
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, h.length + 4) }));
  money.forEach((m, c) => {
    if (!m) return;
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell?.t === "n") cell.z = "#,##0";
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, base.slice(0, 31));
  return { name: xlsxName(base), blob: new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
}

/** Dựng và tải ngay file .xlsx. */
export async function downloadXlsx(base: string, header: string[], rows: Cell[][], money: boolean[]) {
  const { name, blob } = await buildXlsx(base, header, rows, money);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
