"use client";

import { useBranches, useShopSettings } from "@/features/settings/settings-queries";
import type { Invoice } from "@/features/sales/sales-types";
import { invoiceData, storeFields, usePrintTemplates } from "@/features/print/print-data";
import { printHtml, renderTemplate } from "@/features/print/print-render";
import { DELIVERY_INVOICE_TEMPLATE, deliveryInvoiceData } from "@/features/print/delivery-invoice-print-template";
import { PRINT_DEFS } from "@/features/print/print-template-defaults";
import { useSaleSettings } from "./use-sale-settings";

/** Gộp hàng cùng loại khi in: cùng mã + đơn vị + giá bán → 1 dòng (cộng số lượng, thành tiền, nối lô). */
export function mergeInvoiceLines(inv: Invoice): Invoice {
  const merged = new Map<string, Invoice["lines"][number]>();
  for (const l of inv.lines) {
    const key = `${l.productCode}|${l.unitName}|${Number(l.unitPrice)}|${Number(l.discount)}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, quantity: Number(prev.quantity) + Number(l.quantity), amount: Number(prev.amount) + Number(l.amount),
      lots: [prev.lots, l.lots].filter(Boolean).join(", ") || null } : l);
  }
  return { ...inv, lines: [...merged.values()] };
}

/**
 * In hóa đơn theo Thiết lập in của máy: mẫu in hóa đơn của cửa hàng (hoặc mẫu mặc định), số bản in (liên),
 * gộp hàng cùng loại. Mỗi liên 1 trang. Hóa đơn giao hàng dùng mẫu in giao hàng.
 */
export function useSaleInvoicePrinter() {
  const { settings } = useSaleSettings();
  const { data: templates } = usePrintTemplates();
  const { data: shop } = useShopSettings();
  const { data: branches = [] } = useBranches();
  return (inv: Invoice) => {
    const branchName = branches.find((b) => b.id === inv.branchId)?.name ?? "";
    const shown = settings.mergePrintLines ? mergeInvoiceLines(inv) : inv;
    // Hóa đơn Bán giao hàng (có vận đơn đang hoạt động): mẫu in giao hàng (người nhận + địa chỉ giao)
    const delivery = !!inv.shipment && inv.shipment.status !== "CANCELLED";
    const template = delivery ? DELIVERY_INVOICE_TEMPLATE : templates?.INVOICE ?? PRINT_DEFS.INVOICE.template;
    const data = { ...storeFields(shop?.store ?? null, branchName), ...(delivery ? deliveryInvoiceData(shown) : invoiceData(shown)) };
    const page = renderTemplate(template, data);
    printHtml(Array.from({ length: settings.printCopies }, () => page).join('<div style="break-after:page;page-break-after:always"></div>'));
  };
}
