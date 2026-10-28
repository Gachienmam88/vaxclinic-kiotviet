import type { EInvoiceRecord } from "@/features/integrations/integration-queries";

/**
 * Trạng thái HĐĐT theo cách gọi của KiotViet, từ bản ghi phát hành MISA (integration-service einvoice_records).
 * Cùng quy tắc với GET /internal/einvoices/statuses: đã phát hành + có mã CQT = "CQT chấp nhận".
 */
export type EInvoiceState = "NONE" | "PUBLISHED" | "ACCEPTED" | "FAILED";

export const EINVOICE_STATE_OPTIONS: readonly (readonly [EInvoiceState, string])[] = [
  ["NONE", "Chưa phát hành"], ["PUBLISHED", "Đã phát hành"], ["ACCEPTED", "CQT chấp nhận"], ["FAILED", "Phát hành lỗi"],
];

export const EINVOICE_TONE: Record<EInvoiceState, "green" | "red" | "blue" | "gray"> = {
  NONE: "gray", PUBLISHED: "blue", ACCEPTED: "green", FAILED: "red",
};

export function einvoiceState(rec: EInvoiceRecord | undefined): EInvoiceState {
  if (!rec) return "NONE";
  if (rec.status === "FAILED") return "FAILED";
  return rec.inv_code ? "ACCEPTED" : "PUBLISHED";
}

export const einvoiceLabel = (s: EInvoiceState) => EINVOICE_STATE_OPTIONS.find(([v]) => v === s)?.[1] ?? s;

/** Nhãn bộ lọc nhiều trạng thái "PUBLISHED,ACCEPTED" → "Đã phát hành, CQT chấp nhận". */
export const einvoiceStatusesLabel = (csv: string) => csv.split(",").map((s) => einvoiceLabel(s as EInvoiceState)).join(", ");

/** "3584-C26MAA" (số - ký hiệu) như KiotViet. */
export const einvoiceNumber = (rec: EInvoiceRecord) => [rec.inv_no, rec.inv_series].filter(Boolean).join("-");

/** Trang tra cứu hóa đơn của MISA meInvoice theo mã tra cứu (transaction_id). */
export const einvoiceLookupUrl = (rec: EInvoiceRecord) =>
  rec.transaction_id ? `https://www.meinvoice.vn/tra-cuu/?sc=${encodeURIComponent(rec.transaction_id)}` : null;
