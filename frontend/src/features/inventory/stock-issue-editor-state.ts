import { linesFromDoc } from "@/features/purchases/purchase-editor-state";
import { fromLocalInput, toLocalInput, type LineForm } from "@/features/purchases/purchase-line-form";
import type { IssueType, StockIssue } from "./inventory-types";

/**
 * Màn soạn phiếu xuất hủy / xuất dùng nội bộ. Dòng dùng lại LineForm của Mua hàng với unitPrice = giá vốn / đơn vị
 * đã chọn (chỉ để xem; giá vốn thật chốt ở backend lúc hoàn thành).
 */
export type IssueEditorState = {
  id: string | null;
  code: string | null;
  type: IssueType;
  branchId: string;
  at: string; // datetime-local
  reason: string;
  note: string;
  lines: LineForm[];
};

export const emptyIssue = (type: IssueType, branchId: string): IssueEditorState => ({
  id: null, code: null, type, branchId, at: toLocalInput(new Date().toISOString()), reason: "", note: "", lines: [],
});

export async function issueEditorFromDoc(d: StockIssue): Promise<IssueEditorState> {
  return {
    id: d.id, code: d.code, type: d.type, branchId: d.branchId, at: toLocalInput(d.issuedAt), reason: d.reason ?? "",
    note: d.note ?? "",
    lines: await linesFromDoc(d.lines.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: Number(l.quantity),
      unitPrice: Number(l.unitCost), lotNumber: l.lotNumber }))),
  };
}

export const issueRequest = (s: IssueEditorState) => ({
  branchId: s.branchId, issuedAt: fromLocalInput(s.at), reason: s.reason, note: s.note,
  lines: s.lines.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity, lotNumber: l.lotNumber || null })),
});

export const issueLineValue = (l: LineForm) => Math.round(l.quantity * l.unitPrice);
