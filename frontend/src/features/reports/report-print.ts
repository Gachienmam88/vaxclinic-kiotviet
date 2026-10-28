/**
 * Kiểu trình bày "tờ giấy" báo cáo (dùng chung cho màn hình và bản in) + in qua iframe sandbox ẩn (như features/print).
 * Lớp CSS có tiền tố rp- để không ảnh hưởng phần còn lại của ứng dụng.
 */
import { sanitizeHtml } from "@/features/print/print-render";

export const REPORT_CSS = `
.rp { font-family: Arial, Helvetica, sans-serif; color: #222; font-size: 11px; }
.rp-made { font-size: 10px; color: #333; }
.rp-title { text-align: center; font-size: 18px; font-weight: bold; margin: 0 0 6px; }
.rp-meta { text-align: center; font-size: 11px; line-height: 18px; margin: 0; }
.rp-note { text-align: right; font-style: italic; font-size: 10px; margin: 6px 0 2px; }
.rp-table { width: 100%; border-collapse: collapse; margin-top: 18px; }
.rp-table th { background: #b9e3fb; font-weight: bold; text-align: left; padding: 7px 6px; vertical-align: middle; font-size: 11px; }
.rp-table td { padding: 7px 6px; border-bottom: 1px solid #d5d5d5; vertical-align: top; }
.rp-table .r { text-align: right; } .rp-table .c { text-align: center; }
.rp-table tr.rp-sum td { background: #efebd9; font-weight: bold; }
.rp-table tr.rp-group td { background: #f4f4f4; font-weight: bold; }
.rp-table tr.rp-sub td { background: #fafafa; }
.rp-table td.rp-l1 { padding-left: 22px; } .rp-table td.rp-l2 { padding-left: 40px; }
.rp-table a, .rp-link { color: #2171bc; text-decoration: none; }
.rp-table a:hover { color: #1a9dcc; text-decoration: underline; }
.rp-toggle { display: inline-flex; width: 11px; height: 11px; border: 1px solid #555; align-items: center; justify-content: center;
  font-size: 10px; line-height: 1; margin-right: 6px; cursor: pointer; background: #fff; vertical-align: -1px; }
.rp-empty { text-align: center; color: #777; padding: 24px 0; }
`;

/** In nội dung tờ báo cáo (HTML) khổ A4 dọc / ngang. */
export function printReportHtml(body: string, landscape: boolean) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  frame.setAttribute("sandbox", "allow-modals allow-same-origin");
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { margin: 0; }
.rp-toggle { display: none; } ${REPORT_CSS}</style></head><body><div class="rp">${sanitizeHtml(body)}</div></body></html>`);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 50);
}

/** "Ngày lập: 28/10/2026 19:39" */
export function madeAt(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `Ngày lập: ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
