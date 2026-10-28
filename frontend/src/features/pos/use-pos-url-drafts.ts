"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { draftCopyOfInvoice, draftFromInvoice } from "./pos-open-invoice";
import { draftFromOrder } from "./pos-open-order";
import { SALE_ROUTE } from "./pos-storage";
import type { CatalogProduct, DraftInvoice } from "./pos-types";

/**
 * Mở tab từ trang quản lý qua tham số URL rồi xóa tham số:
 * ?edit=<HĐ> sửa hóa đơn · ?return=<HĐ> trả hàng · ?copy=<HĐ> sao chép thành hóa đơn mới ·
 * ?order=<đơn> sửa đơn đặt hàng · ?orderInvoice=<đơn> tạo hóa đơn từ đơn. Cần danh mục đã tải (trừ trả hàng).
 */
export function usePosUrlDrafts(userId: string | undefined, catalog: CatalogProduct[], loadedAt: string | null, open: (d: DraftInvoice) => void) {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const editId = params.get("edit"), returnId = params.get("return"), copyId = params.get("copy");
    const orderId = params.get("order") ?? params.get("orderInvoice");
    if (!userId || !(editId || returnId || orderId || copyId) || ((editId || orderId || copyId) && !loadedAt)) return;
    const draft = orderId ? draftFromOrder(orderId, params.get("order") ? "edit" : "invoice", catalog, userId)
      : copyId ? draftCopyOfInvoice(copyId, catalog, userId)
        : draftFromInvoice((editId ?? returnId)!, editId ? "edit" : "return", catalog, userId);
    draft.then((dr) => { open(dr); router.replace(SALE_ROUTE); })
      .catch((e) => toast.error(`Không mở được ${orderId ? "đơn đặt hàng" : "hóa đơn"}: ${(e as Error).message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy 1 lần khi có đủ user + danh mục
  }, [userId, params, loadedAt]);
}

/** Mở 1 đơn / hóa đơn chọn từ hộp thoại (Xử lý đặt hàng, Chọn hóa đơn trả hàng) — cần mạng. */
export function openPicked(load: Promise<DraftInvoice>, open: (d: DraftInvoice) => void, what: string) {
  load.then(open).catch((e) => toast.error(`Không mở được ${what}: ${(e as Error).message}`));
}
