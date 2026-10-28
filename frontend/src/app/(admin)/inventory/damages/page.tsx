"use client";

import { StockIssueListPage } from "@/features/inventory/stock-issue-list-page";

/** /inventory/damages — danh sách phiếu xuất hủy. */
export default function DamagesPage() {
  return <StockIssueListPage type="DAMAGE" />;
}
