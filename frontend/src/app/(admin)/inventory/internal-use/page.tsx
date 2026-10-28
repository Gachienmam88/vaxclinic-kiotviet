"use client";

import { StockIssueListPage } from "@/features/inventory/stock-issue-list-page";

/** /inventory/internal-use — danh sách phiếu xuất dùng nội bộ. */
export default function InternalUsePage() {
  return <StockIssueListPage type="INTERNAL" />;
}
