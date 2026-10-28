"use client";

import { StockIssueNewPage } from "@/features/inventory/stock-issue-new-page";

/** /inventory/internal-use/new — phiếu xuất dùng nội bộ mới; ?edit=<id> = mở lại phiếu tạm. */
export default function NewInternalUsePage() {
  return <StockIssueNewPage type="INTERNAL" />;
}
