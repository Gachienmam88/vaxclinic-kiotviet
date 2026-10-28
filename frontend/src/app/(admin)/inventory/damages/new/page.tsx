"use client";

import { StockIssueNewPage } from "@/features/inventory/stock-issue-new-page";

/** /inventory/damages/new — phiếu xuất hủy mới; ?edit=<id> = mở lại phiếu tạm. */
export default function NewDamagePage() {
  return <StockIssueNewPage type="DAMAGE" />;
}
