"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { saleNs, type SaleT } from "@/messages/sale";
import { draftCopyOfInvoice, draftFromInvoice } from "./sale-open-invoice";
import { draftFromOrder } from "./sale-open-order";
import { SALE_ROUTE } from "./sale-storage";
import type { CatalogProduct, DraftInvoice } from "./sale-types";

/**
 * Mở tab từ trang quản lý qua tham số URL rồi xóa tham số:
 * ?edit=<HĐ> sửa hóa đơn · ?return=<HĐ> trả hàng · ?copy=<HĐ> sao chép thành hóa đơn mới ·
 * ?order=<đơn> sửa đơn đặt hàng · ?orderInvoice=<đơn> tạo hóa đơn từ đơn. Cần danh mục đã tải (trừ trả hàng).
 */
export function useSaleUrlDrafts(userId: string | undefined, catalog: CatalogProduct[], loadedAt: string | null, open: (d: DraftInvoice) => void) {
  const params = useSearchParams();
  const router = useRouter();
  const t = useT(saleNs);
  useEffect(() => {
    const editId = params.get("edit"), returnId = params.get("return"), copyId = params.get("copy");
    const orderId = params.get("order") ?? params.get("orderInvoice");
    if (!userId || !(editId || returnId || orderId || copyId) || ((editId || orderId || copyId) && !loadedAt)) return;
    const draft = orderId ? draftFromOrder(orderId, params.get("order") ? "edit" : "invoice", catalog, userId, t)
      : copyId ? draftCopyOfInvoice(copyId, catalog, userId, t)
        : draftFromInvoice((editId ?? returnId)!, editId ? "edit" : "return", catalog, userId, t);
    draft.then((dr) => { open(dr); router.replace(SALE_ROUTE); })
      .catch((e) => toast.error(t("screen.openFailed", { what: t(orderId ? "screen.what.order" : "screen.what.invoice"), message: (e as Error).message })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy 1 lần khi có đủ user + danh mục
  }, [userId, params, loadedAt]);
}

/** ?returnPicker=1 (nút "+ Trả hàng" ở danh sách Trả hàng) → mở "Chọn hóa đơn trả hàng" rồi xóa tham số. */
export function useSaleUrlDialog(openReturnPicker: () => void) {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (!params.get("returnPicker")) return;
    openReturnPicker();
    router.replace(SALE_ROUTE);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ theo tham số URL
  }, [params]);
}

/** Mở 1 đơn / hóa đơn chọn từ hộp thoại (Xử lý đặt hàng, Chọn hóa đơn trả hàng) — cần mạng. */
export function openPicked(load: Promise<DraftInvoice>, open: (d: DraftInvoice) => void, what: string, t: SaleT) {
  load.then(open).catch((e) => toast.error(t("screen.openFailed", { what, message: (e as Error).message })));
}
