"use client";

import { DocCodeLink } from "@/components/ui/doc-code-link";
import { useEInvoiceRecords, type EInvoiceRecord } from "@/features/integrations/integration-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { useStoreProfile } from "@/features/store-profile/store-profile-queries";
import { useT, type TFunction } from "@/lib/i18n";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { deliveryNs } from "@/messages/delivery";
import { salesNs } from "@/messages/sales";
import { einvoiceState } from "./invoice-einvoice-state";
import { STATE_TONE } from "./invoice-filter-model";
import { StatusBadge } from "./invoice-list-kit";
import { EINVOICE_COLUMNS, type InvoiceColumn } from "./invoice-list-prefs";
import type { InvoiceListItem } from "./sales-types";

/** Cột tiền: căn phải; 4 cột đầu có dòng tổng. */
export const MONEY_COLUMNS: InvoiceColumn[] = ["subtotal", "discount", "total", "paid", "cod", "partnerFee"];

/** Dữ liệu ngoài dòng danh sách: bản ghi HĐĐT, tên chi nhánh, mã số thuế cửa hàng (chỉ tải khi có cột cần). */
export type CellContext = {
  t: TFunction<typeof salesNs.vi>; td: TFunction<typeof deliveryNs.vi>;
  einv: Map<string, EInvoiceRecord>; branches: Map<string, string>; sellerTaxCode: string | null;
};

export function useCellContext(items: InvoiceListItem[] | undefined, cols: InvoiceColumn[]): CellContext {
  const t = useT(salesNs);
  const td = useT(deliveryNs);
  const ids = cols.some((c) => EINVOICE_COLUMNS.includes(c)) ? (items?.map((i) => i.id) ?? []) : [];
  const { data: records } = useEInvoiceRecords(ids);
  const { data: branchList } = useBranches();
  const { data: store } = useStoreProfile();
  return {
    t, td, einv: new Map((records ?? []).map((r) => [r.invoice_id, r])),
    branches: new Map((branchList ?? []).map((b) => [b.id, b.name])), sellerTaxCode: store?.taxCode ?? null,
  };
}

export function invoiceCell(i: InvoiceListItem, c: InvoiceColumn, x: CellContext): React.ReactNode {
  const rec = x.einv.get(i.id);
  const published = einvoiceState(rec);
  switch (c) {
    case "einvoice": return published === "NONE" ? null : x.t(`enums.einvoiceState.${published}`); // như KiotViet: chưa phát hành để trống
    case "einvoiceNature": return published === "PUBLISHED" || published === "ACCEPTED" ? x.t("enums.einvoiceNature.ORIGINAL") : null;
    case "einvoiceNo": return rec?.status === "PUBLISHED" ? rec.inv_no : null;
    case "einvoiceSeries": return rec?.status === "PUBLISHED" ? rec.inv_series : null;
    case "soldAt": case "createdAt": case "updatedAt": case "deliveryTime": return formatDateTime(i[c]);
    case "customerBirthday": return formatDate(i.customerBirthday);
    case "state": return <StatusBadge tone={STATE_TONE[i.state]}>{x.t(`enums.invoiceState.${i.state}`)}</StatusBadge>;
    case "shipmentStatus": return i.shipmentStatus ? x.td(`status.${i.shipmentStatus as "PENDING"}`) : null;
    case "subtotal": case "discount": case "total": case "paid": return formatMoney(i[c]);
    case "cod": case "partnerFee": return i[c] == null ? null : formatMoney(i[c]);
    case "customerCode": return <DocCodeLink code={i.customerCode} kind="/customers" />;
    case "orderCode": return <DocCodeLink code={i.orderCode} kind="/orders" />;
    case "shipmentCode": return <DocCodeLink code={i.shipmentCode} kind="/delivery/shipments" />;
    case "returnCodes": return i.returnCodes?.split(", ").map((r, n) => <span key={r}>{n > 0 && ", "}<DocCodeLink code={r} kind="/returns" /></span>);
    case "branch": return x.branches.get(i.branchId) ?? null;
    case "sellerTaxCode": return x.sellerTaxCode;
    default: return i[c];
  }
}
